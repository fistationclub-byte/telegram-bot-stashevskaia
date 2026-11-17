import pg from "pg";
import { warmupDays, type WarmupDay } from "../domain/warmup-content.js";

export interface WarmupAudience {
  enroll(telegramId: number): Promise<void>;
  markJoined(telegramId: number): Promise<void>;
}

const schema = `
  CREATE TABLE IF NOT EXISTS warmup_control (
    id BOOLEAN PRIMARY KEY CHECK (id),
    paused_at TIMESTAMPTZ
  );
  INSERT INTO warmup_control (id, paused_at) VALUES (TRUE, NOW())
    ON CONFLICT (id) DO NOTHING;
  CREATE TABLE IF NOT EXISTS warmup_audience (
    telegram_id BIGINT PRIMARY KEY,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_step INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    joined_at TIMESTAMPTZ,
    stopped BOOLEAN NOT NULL DEFAULT FALSE
  );
  CREATE INDEX IF NOT EXISTS warmup_pending_idx ON warmup_audience (due_at, telegram_id)
    WHERE NOT stopped AND joined_at IS NULL AND next_step < 7;
`;

export function openWarmupStore(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 5_000,
  });
  pool.on("error", () =>
    console.error(JSON.stringify({ event: "warmup_db_failed" })),
  );

  return {
    initialize: () => pool.query(schema),
    close: () => pool.end(),
    async enroll(telegramId: number) {
      await pool.query(
        "INSERT INTO warmup_audience (telegram_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [telegramId],
      );
    },
    async markJoined(telegramId: number) {
      await pool.query(
        `INSERT INTO warmup_audience (telegram_id, joined_at) VALUES ($1, NOW())
         ON CONFLICT (telegram_id) DO UPDATE SET joined_at = COALESCE(warmup_audience.joined_at, excluded.joined_at)`,
        [telegramId],
      );
    },
    async pause() {
      await pool.query(
        "UPDATE warmup_control SET paused_at = COALESCE(paused_at, clock_timestamp()) WHERE id",
      );
    },
    async resume() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM warmup_control WHERE id FOR UPDATE");
        await client.query(`
          UPDATE warmup_audience AS a
          SET due_at = a.due_at + GREATEST(INTERVAL '0 seconds', NOW() - GREATEST(c.paused_at, a.enrolled_at))
          FROM warmup_control AS c
          WHERE c.id AND c.paused_at IS NOT NULL AND NOT a.stopped AND a.joined_at IS NULL
            AND a.next_step < 7
        `);
        await client.query(
          "UPDATE warmup_control SET paused_at = NULL WHERE id",
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async sendNext(
      send: (telegramId: string, day: WarmupDay) => Promise<"sent" | "blocked">,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const control = await client.query<{ paused_at: Date | null }>(
          "SELECT paused_at FROM warmup_control WHERE id FOR SHARE",
        );
        if (control.rows[0]?.paused_at !== null) {
          await client.query("ROLLBACK");
          return false;
        }
        const result = await client.query<{
          telegram_id: string;
          next_step: number;
        }>(
          `SELECT telegram_id, next_step FROM warmup_audience
           WHERE due_at <= NOW() AND NOT stopped AND joined_at IS NULL AND next_step < $1
           ORDER BY due_at, telegram_id LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [warmupDays.length],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return false;
        }
        const day = warmupDays[row.next_step];
        if (!day) throw new Error("Invalid warmup step");
        const nextDay = warmupDays[row.next_step + 1] ?? day;
        const outcome = await send(row.telegram_id, day);
        await client.query(
          `UPDATE warmup_audience
           SET next_step = next_step + 1, stopped = $2,
               due_at = date_trunc('day', clock_timestamp(), 'UTC') + ($3 * INTERVAL '24 hours')
           WHERE telegram_id = $1`,
          [row.telegram_id, outcome === "blocked", nextDay - day],
        );
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

import type { PoolClient } from "pg";
import { openDatabase, type DatabaseConfig } from "./database.js";

export interface WarmupAudience {
  markJoined(telegramId: number): Promise<void>;
}

type Outcome = "sent" | "blocked";

async function optedIn(client: PoolClient, id: string) {
  const { rows } = await client.query<{ subscribed: boolean }>(
    "SELECT subscribed FROM bot.mailing_subscriptions WHERE telegram_id = $1 FOR SHARE",
    [id],
  );
  return rows[0]?.subscribed === true;
}

export function openWarmupStore(config: DatabaseConfig) {
  const pool = openDatabase(config);
  return {
    close: () => pool.end(),
    async markJoined(telegramId: number) {
      await pool.query(
        "UPDATE bot.warmup_audience SET joined_at = COALESCE(joined_at, NOW()) WHERE telegram_id = $1",
        [telegramId],
      );
    },
    async pause() {
      await pool.query(
        "UPDATE bot.warmup_control SET paused_at = COALESCE(paused_at, clock_timestamp()) WHERE id",
      );
    },
    async resume() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT id FROM bot.warmup_control WHERE id FOR UPDATE",
        );
        await client.query(`
          UPDATE bot.warmup_audience AS a
          SET due_at = a.due_at + GREATEST(INTERVAL '0 seconds', NOW() - GREATEST(c.paused_at, a.enrolled_at))
          FROM bot.warmup_control AS c
          WHERE c.id AND c.paused_at IS NOT NULL AND NOT a.stopped AND a.joined_at IS NULL
            AND a.next_step < 7
        `);
        await client.query(
          "UPDATE bot.warmup_control SET paused_at = NULL WHERE id",
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
      send: (
        telegramId: string,
        messageKey: string,
        personalized: boolean,
      ) => Promise<Outcome>,
      allowWarmup: boolean,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const general = await client.query<{
          telegram_id: string;
          campaign_id: string;
          message_key: string;
        }>(
          `SELECT d.telegram_id, d.campaign_id, c.message_key FROM bot.message_deliveries d
           JOIN bot.campaigns c ON c.id = d.campaign_id
           JOIN bot.mailing_subscriptions s ON s.telegram_id = d.telegram_id AND s.subscribed
           WHERE d.sent_at IS NULL AND d.due_at <= NOW() AND c.enabled AND c.scheduled_at <= NOW()
           ORDER BY d.due_at, d.campaign_id, d.telegram_id LIMIT 1 FOR UPDATE OF d SKIP LOCKED`,
        );
        const broadcast = general.rows[0];
        if (broadcast) {
          if (!(await optedIn(client, broadcast.telegram_id))) {
            await client.query("ROLLBACK");
            return true;
          }
          const outcome = await send(
            broadcast.telegram_id,
            broadcast.message_key,
            false,
          );
          await client.query(
            `UPDATE bot.message_deliveries SET sent_at = clock_timestamp(), outcome = $3
             WHERE campaign_id = $1 AND telegram_id = $2`,
            [broadcast.campaign_id, broadcast.telegram_id, outcome],
          );
          if (outcome === "blocked") {
            await client.query(
              "UPDATE bot.warmup_audience SET stopped = true WHERE telegram_id = $1",
              [broadcast.telegram_id],
            );
          }
          await client.query("COMMIT");
          return true;
        }
        const control = await client.query<{ paused_at: Date | null }>(
          "SELECT paused_at FROM bot.warmup_control WHERE id FOR SHARE",
        );
        if (!allowWarmup || control.rows[0]?.paused_at !== null) {
          await client.query("ROLLBACK");
          return false;
        }
        const { rows } = await client.query<{
          telegram_id: string;
          next_step: number;
          message_key: string;
          delay: number;
        }>(
          `SELECT a.telegram_id, a.next_step, p.message_key, COALESCE(n.day - p.day, 0) AS delay
           FROM bot.warmup_audience a
           JOIN bot.campaign_steps p ON p.step = a.next_step
           LEFT JOIN bot.campaign_steps n ON n.step = p.step + 1
           JOIN bot.mailing_subscriptions s ON s.telegram_id = a.telegram_id AND s.subscribed
           WHERE a.due_at <= NOW() AND NOT a.stopped AND a.joined_at IS NULL AND a.next_step < 7
           ORDER BY a.due_at, a.telegram_id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,
        );
        const row = rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return false;
        }
        if (!(await optedIn(client, row.telegram_id))) {
          await client.query("ROLLBACK");
          return true;
        }
        const outcome = await send(row.telegram_id, row.message_key, true);
        await client.query(
          `INSERT INTO bot.message_deliveries (telegram_id, warmup_step, due_at, sent_at, outcome)
           SELECT telegram_id, next_step, due_at, clock_timestamp(), $2 FROM bot.warmup_audience WHERE telegram_id = $1`,
          [row.telegram_id, outcome],
        );
        await client.query(
          `UPDATE bot.warmup_audience
           SET next_step = next_step + 1, stopped = $2,
               due_at = clock_timestamp() + ($3 * INTERVAL '24 hours')
           WHERE telegram_id = $1`,
          [row.telegram_id, outcome === "blocked", row.delay],
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

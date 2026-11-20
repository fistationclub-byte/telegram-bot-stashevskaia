import { openDatabase, type DatabaseConfig } from "./database.js";
import type { WaitlistEntry } from "./waitlist.js";

const upsert = `
  INSERT INTO course_waitlist (telegram_id, username, tier, registered_at, updated_at)
  VALUES ($1, $2, $3, $4, $4)
  ON CONFLICT (telegram_id) DO UPDATE SET
    username = excluded.username,
    tier = excluded.tier,
    updated_at = excluded.updated_at
  WHERE course_waitlist.tier <> excluded.tier
     OR course_waitlist.username IS DISTINCT FROM excluded.username
`;

export function openProductionWaitlist(config: DatabaseConfig) {
  const pool = openDatabase(config);
  const sql = upsert.replaceAll("course_waitlist", "bot.course_waitlist");
  return {
    close: () => pool.end(),
    save: async ({ telegramId, username, tier }: WaitlistEntry) => {
      const now = new Date().toISOString();
      await pool.query(sql, [telegramId, username, tier, now]);
    },
  };
}

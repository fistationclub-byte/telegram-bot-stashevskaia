import { chmodSync, closeSync, openSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type CourseTier =
  "self_study" | "anastasia_feedback" | "mentor_feedback";

export interface WaitlistEntry {
  telegramId: number;
  username: string | null;
  tier: CourseTier;
}

export type SaveWaitlistEntry = (entry: WaitlistEntry) => Promise<void>;

export const waitlistSchema = `
  CREATE TABLE IF NOT EXISTS course_waitlist (
    telegram_id BIGINT PRIMARY KEY NOT NULL,
    username TEXT,
    tier TEXT NOT NULL CHECK (tier IN ('self_study', 'anastasia_feedback', 'mentor_feedback')),
    registered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

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

export function openLocalWaitlist(path: string) {
  if (path !== ":memory:") {
    closeSync(openSync(path, "a", 0o600));
    chmodSync(path, 0o600);
  }

  const db = new DatabaseSync(path);
  db.exec(waitlistSchema);
  const save = db.prepare(upsert);
  return {
    db,
    save: async ({ telegramId, username, tier }: WaitlistEntry) => {
      save.run({
        $1: telegramId,
        $2: username,
        $3: tier,
        $4: new Date().toISOString(),
      });
    },
  };
}

export { openProductionWaitlist } from "./production-waitlist.js";

import { openDatabase, type DatabaseConfig } from "./database.js";

export interface TelegramProfile {
  id: number;
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
}

export interface TrafficSource {
  platform: string;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

export interface BotStore {
  register(
    user: TelegramProfile,
    code: string,
  ): Promise<TrafficSource | undefined>;
  courseSource(id: number | string): Promise<TrafficSource | undefined>;
  subscription(id: number): Promise<boolean | undefined>;
  subscribe(user: TelegramProfile, subscribed: boolean): Promise<void>;
  texts(): Promise<Record<string, string>>;
}

const upsertUser = `
  INSERT INTO bot.telegram_users AS u (telegram_id, first_name, last_name, username, source_code)
  VALUES ($1, $2, $3, $4, (SELECT code FROM bot.traffic_sources WHERE code = $5))
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name = excluded.first_name, last_name = excluded.last_name,
    username = excluded.username, source_code = COALESCE(u.source_code, excluded.source_code)
  RETURNING telegram_id, source_code
`;

const values = (user: TelegramProfile, code: string | null) => [
  user.id,
  user.first_name,
  user.last_name ?? null,
  user.username ?? null,
  code,
];

export function openBotStore(config: DatabaseConfig) {
  const pool = openDatabase(config);
  return {
    close: () => pool.end(),
    async register(user: TelegramProfile, code: string) {
      const { rows } = await pool.query<TrafficSource>(
        `
        WITH profile AS (${upsertUser}),
        enrollment AS (
          INSERT INTO bot.warmup_audience (telegram_id, due_at)
          SELECT telegram_id, clock_timestamp() + (p.day * INTERVAL '24 hours')
          FROM profile CROSS JOIN bot.campaign_steps AS p
          WHERE p.step = 0 ON CONFLICT DO NOTHING
        )
        SELECT s.platform, s.campaign, s.content, s.term FROM profile AS p
        JOIN bot.traffic_sources AS s ON s.code = p.source_code
      `,
        values(user, /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : null),
      );
      return rows[0];
    },
    async courseSource(id: number | string) {
      const { rows } = await pool.query<TrafficSource>(
        `
        SELECT s.platform, s.campaign, s.content, s.term FROM bot.telegram_users AS u
        JOIN bot.traffic_sources AS s ON s.code = u.source_code WHERE u.telegram_id = $1
      `,
        [id],
      );
      return rows[0];
    },
    async subscription(id: number) {
      const { rows } = await pool.query<{ subscribed: boolean }>(
        "SELECT subscribed FROM bot.mailing_subscriptions WHERE telegram_id = $1",
        [id],
      );
      return rows[0]?.subscribed;
    },
    async subscribe(user: TelegramProfile, subscribed: boolean) {
      await pool.query(
        `
        WITH profile AS (${upsertUser})
        INSERT INTO bot.mailing_subscriptions AS s (telegram_id, subscribed)
        SELECT telegram_id, $6 FROM profile
        ON CONFLICT (telegram_id) DO UPDATE SET
          subscribed = excluded.subscribed, changed_at = clock_timestamp()
        WHERE s.subscribed IS DISTINCT FROM excluded.subscribed
      `,
        [...values(user, null), subscribed],
      );
    },
    async texts() {
      const { rows } = await pool.query<{ key: string; text: string }>(
        "SELECT key, text FROM bot.bot_messages",
      );
      return Object.fromEntries(rows.map(({ key, text }) => [key, text]));
    },
  } satisfies BotStore & { close: () => Promise<void> };
}

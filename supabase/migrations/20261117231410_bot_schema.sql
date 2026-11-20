CREATE SCHEMA IF NOT EXISTS bot;
REVOKE ALL ON SCHEMA bot FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'telegram_bot_runtime') THEN
    CREATE ROLE telegram_bot_runtime NOLOGIN;
  END IF;
END;
$$;

CREATE TABLE bot.traffic_sources (
  code text PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9_-]{1,64}$'),
  platform text NOT NULL CHECK (platform ~ '^[a-z0-9_-]{1,64}$'),
  campaign text,
  medium text,
  content text,
  term text
);

CREATE TABLE bot.telegram_users (
  telegram_id bigint PRIMARY KEY,
  first_name text NOT NULL,
  last_name text,
  username text,
  started_at timestamptz NOT NULL DEFAULT now(),
  source_code text REFERENCES bot.traffic_sources(code)
);

CREATE TABLE bot.course_waitlist (
  telegram_id bigint PRIMARY KEY REFERENCES bot.telegram_users(telegram_id),
  username text,
  tier text NOT NULL CHECK (tier IN ('self_study', 'anastasia_feedback', 'mentor_feedback')),
  registered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE bot.mailing_subscriptions (
  telegram_id bigint PRIMARY KEY REFERENCES bot.telegram_users(telegram_id),
  subscribed boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bot.bot_messages (
  key text PRIMARY KEY,
  text text NOT NULL
);

CREATE TABLE bot.warmup_control (
  id boolean PRIMARY KEY CHECK (id),
  paused_at timestamptz
);
INSERT INTO bot.warmup_control (id, paused_at) VALUES (TRUE, now());

CREATE TABLE bot.warmup_audience (
  telegram_id bigint PRIMARY KEY REFERENCES bot.telegram_users(telegram_id),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_step integer NOT NULL DEFAULT 0 CHECK (next_step BETWEEN 0 AND 7),
  due_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  joined_at timestamptz,
  stopped boolean NOT NULL DEFAULT false
);
CREATE INDEX warmup_pending_idx ON bot.warmup_audience (due_at, telegram_id)
  WHERE NOT stopped AND joined_at IS NULL AND next_step < 7;

CREATE TABLE bot.campaign_steps (
  step integer PRIMARY KEY CHECK (step BETWEEN 0 AND 6),
  day integer UNIQUE NOT NULL CHECK (day > 0),
  message_key text NOT NULL REFERENCES bot.bot_messages(key)
);

CREATE TABLE bot.campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_key text NOT NULL REFERENCES bot.bot_messages(key),
  scheduled_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE bot.message_deliveries (
  telegram_id bigint NOT NULL REFERENCES bot.telegram_users(telegram_id),
  campaign_id bigint REFERENCES bot.campaigns(id),
  warmup_step integer REFERENCES bot.campaign_steps(step),
  due_at timestamptz NOT NULL,
  sent_at timestamptz,
  outcome text CHECK (outcome IN ('sent','blocked')),
  CHECK ((campaign_id IS NULL) <> (warmup_step IS NULL)),
  CHECK ((sent_at IS NULL) = (outcome IS NULL)),
  UNIQUE (campaign_id, telegram_id),
  UNIQUE (warmup_step, telegram_id)
);
CREATE INDEX campaign_pending_idx ON bot.message_deliveries (due_at, campaign_id, telegram_id)
  WHERE sent_at IS NULL AND campaign_id IS NOT NULL;

GRANT USAGE ON SCHEMA bot TO telegram_bot_runtime;
GRANT SELECT ON bot.traffic_sources, bot.bot_messages, bot.campaign_steps, bot.campaigns TO telegram_bot_runtime;
GRANT SELECT, INSERT, UPDATE ON bot.telegram_users, bot.course_waitlist,
  bot.mailing_subscriptions, bot.warmup_audience, bot.message_deliveries TO telegram_bot_runtime;
GRANT SELECT, UPDATE ON bot.warmup_control TO telegram_bot_runtime;

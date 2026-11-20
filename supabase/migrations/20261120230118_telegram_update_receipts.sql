CREATE TABLE bot.telegram_update_receipts (
  update_id bigint PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT, INSERT ON bot.telegram_update_receipts TO telegram_bot_runtime;

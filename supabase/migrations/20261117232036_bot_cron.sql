CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE FUNCTION bot.dispatch_due()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  endpoint text;
  secret text;
BEGIN
  SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name = 'bot_dispatch_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'bot_dispatch_secret';
  IF endpoint IS NULL OR endpoint !~ '^https://[^/]+/api/warmup$' OR secret IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bot.message_deliveries (telegram_id, campaign_id, due_at)
  SELECT s.telegram_id, c.id, c.scheduled_at
  FROM bot.campaigns c
  JOIN bot.mailing_subscriptions s ON s.subscribed AND s.changed_at <= c.scheduled_at
  WHERE c.enabled AND c.scheduled_at <= now()
  ON CONFLICT (campaign_id, telegram_id) DO NOTHING;

  PERFORM net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 45000
  );
END;
$$;

REVOKE ALL ON FUNCTION bot.dispatch_due() FROM PUBLIC;
SELECT cron.schedule('telegram-bot-dispatch', '* * * * *', 'SELECT bot.dispatch_due()');

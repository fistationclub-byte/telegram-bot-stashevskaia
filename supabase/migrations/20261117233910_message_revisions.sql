ALTER TABLE bot.bot_messages
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE bot.bot_message_revisions (
  key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  text text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by text NOT NULL DEFAULT current_user,
  operation text NOT NULL CHECK (operation IN ('snapshot', 'insert', 'update', 'delete')),
  PRIMARY KEY (key, version)
);

INSERT INTO bot.bot_message_revisions (key, version, text, operation)
SELECT key, version, text, 'snapshot' FROM bot.bot_messages;

CREATE FUNCTION bot.set_message_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    SELECT COALESCE(max(version), 0) + 1 INTO NEW.version
    FROM bot.bot_message_revisions WHERE key = NEW.key;
  ELSE
    IF NEW.key <> OLD.key THEN
      RAISE EXCEPTION 'Message key cannot be renamed';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := OLD.updated_at;
    NEW.version := OLD.version;
    IF NEW.text IS DISTINCT FROM OLD.text THEN
      NEW.updated_at := clock_timestamp();
      NEW.version := OLD.version + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION bot.record_message_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO bot.bot_message_revisions (key, version, text, operation)
    VALUES (OLD.key, OLD.version + 1, OLD.text, 'delete');
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO bot.bot_message_revisions (key, version, text, recorded_at, operation)
    VALUES (NEW.key, NEW.version, NEW.text, NEW.updated_at, 'insert');
  ELSIF NEW.version <> OLD.version THEN
    INSERT INTO bot.bot_message_revisions (key, version, text, recorded_at, operation)
    VALUES (NEW.key, NEW.version, NEW.text, NEW.updated_at, 'update');
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION bot.set_message_revision(), bot.record_message_revision() FROM PUBLIC;
CREATE TRIGGER set_message_revision
BEFORE INSERT OR UPDATE ON bot.bot_messages
FOR EACH ROW EXECUTE FUNCTION bot.set_message_revision();

CREATE TRIGGER record_message_revision
AFTER INSERT OR UPDATE OR DELETE ON bot.bot_messages
FOR EACH ROW EXECUTE FUNCTION bot.record_message_revision();

import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  openDatabase,
  supabaseConfig,
} from "../dist/src/infrastructure/database.js";

const runtime = parseEnv(readFileSync(".env.supabase.runtime", "utf8"));
const token = process.env.TELEGRAM_PROD_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !webhookSecret) throw new Error("Production bot secrets missing");
const config = {
  token,
  webhookSecret,
  database: {
    host: runtime.SUPABASE_HOST,
    port: Number(runtime.SUPABASE_PORT ?? 5432),
    user: runtime.SUPABASE_USER,
    password: runtime.SUPABASE_PASS,
    database: runtime.SUPABASE_DB,
  },
};
const pool = openDatabase(supabaseConfig(), 1);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    "SELECT id FROM vault.secrets WHERE name = $1",
    ["telegram_bot_edge_runtime"],
  );
  if (rows[0]) {
    await client.query("SELECT vault.update_secret($1, $2)", [
      rows[0].id,
      JSON.stringify(config),
    ]);
  } else {
    await client.query("SELECT vault.create_secret($1, $2, $3)", [
      JSON.stringify(config),
      "telegram_bot_edge_runtime",
      "Production Telegram bot Edge Function runtime",
    ]);
  }
  await client.query("COMMIT");
  console.log("Production-настройки сохранены в зашифрованном Supabase Vault.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Не удалось сохранить настройки", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

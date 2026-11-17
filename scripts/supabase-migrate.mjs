import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import {
  openDatabase,
  supabaseConfig,
} from "../dist/src/infrastructure/database.js";

const directory = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(directory))
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
const settings = supabaseConfig({
  ...process.env,
  SUPABASE_USER:
    process.env.SUPABASE_MIGRATION_USER ?? process.env.SUPABASE_USER,
  SUPABASE_PASS:
    process.env.SUPABASE_MIGRATION_PASS ?? process.env.SUPABASE_PASS,
});
const pool = openDatabase({ ...settings, statement_timeout: 30_000 }, 1);
let connection;
try {
  connection = await pool.connect();
  await connection.query("SELECT pg_advisory_lock(173489, 661907)");
  await connection.query(`
    CREATE SCHEMA IF NOT EXISTS bot;
    REVOKE ALL ON SCHEMA bot FROM PUBLIC;
    CREATE TABLE IF NOT EXISTS bot.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await connection.query(
      "SELECT checksum FROM bot.schema_migrations WHERE name = $1",
      [file],
    );
    if (applied.rows[0]) {
      if (applied.rows[0].checksum !== checksum)
        throw Error("Содержимое применённой миграции изменилось.");
      console.log("Уже применена", file);
      continue;
    }
    await connection.query("BEGIN");
    try {
      await connection.query(sql);
      await connection.query(
        "INSERT INTO bot.schema_migrations (name, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
      await connection.query("COMMIT");
      console.log("Применена", file);
    } catch (error) {
      await connection.query("ROLLBACK");
      console.error("Ошибка миграции", file);
      throw error;
    }
  }
} catch (error) {
  console.error("Миграция остановлена", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  connection?.release(true);
  await pool.end();
}

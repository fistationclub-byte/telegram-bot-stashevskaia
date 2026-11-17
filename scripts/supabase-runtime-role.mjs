import { randomBytes, createHmac, createHash, pbkdf2Sync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import {
  openDatabase,
  supabaseConfig,
} from "../dist/src/infrastructure/database.js";

const file = ".env.supabase.runtime";
const admin = supabaseConfig();
const user = admin.host.endsWith(".pooler.supabase.com")
  ? `telegram_bot_runtime.${admin.user.split(".").at(-1)}`
  : "telegram_bot_runtime";
let created = false;
try {
  const entries = {
    SUPABASE_HOST: admin.host,
    SUPABASE_PORT: String(admin.port),
    SUPABASE_USER: user,
    SUPABASE_DB: admin.database,
    SUPABASE_PASS: randomBytes(32).toString("hex"),
  };
  await writeFile(
    file,
    Object.entries(entries)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  created = true;
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}

const runtime = supabaseConfig(parseEnv(await readFile(file, "utf8")));
let pool;
try {
  if (
    runtime.host !== admin.host ||
    runtime.user !== user ||
    !/^[a-f0-9]{64}$/.test(runtime.password)
  ) {
    throw Error("Некорректный локальный файл роли.");
  }
  if (created || process.argv.includes("--repair")) {
    const salt = randomBytes(16);
    const salted = pbkdf2Sync(runtime.password, salt, 4096, 32, "sha256");
    const hmac = (key) => createHmac("sha256", salted).update(key).digest();
    const stored = createHash("sha256")
      .update(hmac("Client Key"))
      .digest("base64");
    const server = hmac("Server Key").toString("base64");
    const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`;
    pool = openDatabase(admin, 1);
    await pool.query(
      `ALTER ROLE telegram_bot_runtime LOGIN PASSWORD '${verifier}'`,
    );
    await pool.end();
    pool = undefined;
  }
  pool = openDatabase(runtime, 1);
  const { rows } = await pool.query(`
    SELECT current_user = 'telegram_bot_runtime' AS runtime,
      has_table_privilege(current_user, 'bot.bot_messages', 'SELECT') AS can_read,
      NOT has_table_privilege(current_user, 'bot.bot_messages', 'UPDATE') AS cannot_edit,
      NOT has_schema_privilege(current_user, 'bot', 'CREATE') AS cannot_migrate
  `);
  if (!Object.values(rows[0]).every(Boolean))
    throw Error("Права роли не подтверждены.");
  console.log("Отдельный доступ бота проверен.");
} catch (error) {
  console.error("Доступ бота не подтверждён", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await pool?.end();
}

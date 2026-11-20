import { readFileSync } from "node:fs";
import pg, { type PoolConfig } from "pg";

export type DatabaseConfig = string | PoolConfig;

export function supabaseConfig(
  env = process.env,
  useTransactionPooler = false,
): PoolConfig {
  const ssl = {
    ca: readFileSync("config/supabase-ca.pem", "utf8"),
    rejectUnauthorized: true,
  };
  if (useTransactionPooler && env.SUPABASE_TP_URL) {
    const url = new URL(env.SUPABASE_TP_URL);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname.endsWith(".pooler.supabase.com") ||
      url.port !== "6543"
    ) {
      throw new Error("Проверьте адрес SUPABASE_TP_URL.");
    }
    return {
      connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}${url.pathname}`,
      ssl,
    };
  }
  const host = env.SUPABASE_HOST;
  const user = env.SUPABASE_USER;
  const password = env.SUPABASE_PASS;
  const database = env.SUPABASE_DB;
  const port = Number(env.SUPABASE_PORT ?? 5432);
  if (
    !host ||
    !/^[a-z0-9.-]+\.supabase\.(co|com)$/i.test(host) ||
    !user ||
    !password ||
    !database ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "Проверьте параметры подключения SUPABASE_HOST, USER, PASS, DB и PORT.",
    );
  }
  return {
    host,
    port,
    user,
    password,
    database,
    ssl,
  };
}

export function openDatabase(config: DatabaseConfig, max = 2) {
  const connection =
    typeof config === "string" ? { connectionString: config } : config;
  const pool = new pg.Pool({
    ...connection,
    max,
    connectionTimeoutMillis: 3_000,
    statement_timeout: connection.statement_timeout ?? 5_000,
  });
  pool.on("error", () =>
    console.error(JSON.stringify({ event: "postgres_connection_failed" })),
  );
  return pool;
}

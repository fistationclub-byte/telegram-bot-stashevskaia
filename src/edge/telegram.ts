import pg, { type PoolConfig } from "pg";
import { Bot, webhookCallback } from "grammy";
import { z } from "zod";
import settings from "./settings.json" with { type: "json" };
import { createBot } from "../bot.js";
import { createWebhook } from "../webhook.js";
import { openBotStore } from "../infrastructure/bot-store.js";
import { openDatabase } from "../infrastructure/database.js";
import { openProductionWaitlist } from "../infrastructure/production-waitlist.js";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

const configuration = z.object({
  token: z.string().regex(/^\d+:[A-Za-z0-9_-]+$/),
  webhookSecret: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
  database: z.object({
    host: z.string().regex(/^[a-z0-9.-]+\.pooler\.supabase\.com$/),
    port: z.number().int().positive(),
    user: z.literal("telegram_bot_runtime.nkmroabbxywwowfpaevm"),
    password: z.string().min(1),
    database: z.string().min(1),
  }),
});

async function initialize() {
  const raw = Deno.env.get("SUPABASE_DB_URL");
  if (!raw) throw new Error("Supabase database configuration unavailable");
  const url = new URL(raw);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) {
    url.searchParams.delete(key);
  }
  const ssl = { ca: settings.databaseCa, rejectUnauthorized: true };
  const bootstrap = new pg.Client({
    connectionString: url.href,
    ssl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  });
  let config: z.infer<typeof configuration>;
  try {
    await bootstrap.connect();
    const { rows } = await bootstrap.query<{ decrypted_secret: string }>(
      "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_bot_edge_runtime'",
    );
    const json: unknown = JSON.parse(rows[0]?.decrypted_secret ?? "null");
    config = configuration.parse(json);
  } finally {
    await bootstrap.end();
  }
  const connection: PoolConfig = { ...config.database, ssl };
  const store = openBotStore(connection);
  const waitlist = openProductionWaitlist(connection);
  const receipts = openDatabase(connection);
  const bot: Bot = createBot(
    config.token,
    waitlist.save,
    undefined,
    undefined,
    store,
  );
  const callback = webhookCallback(bot, "std/http", {
    onTimeout: "throw",
    timeoutMilliseconds: 20_000,
  });

  return createWebhook(config.webhookSecret, async (update) => {
    const envelope = z.object({ update_id: z.number().int() }).parse(update);
    const client = await receipts.connect();
    try {
      await client.query("BEGIN");
      const recorded = await client.query(
        "INSERT INTO bot.telegram_update_receipts (update_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING update_id",
        [envelope.update_id],
      );
      if (!recorded.rowCount) {
        await client.query("ROLLBACK");
        return new Response(null, { status: 200 });
      }
      const response = await callback(
        new Request("https://telegram.internal/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(update),
        }),
      );
      if (!response.ok) throw new Error("Telegram update failed");
      await client.query("COMMIT");
      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

let handler: ReturnType<typeof initialize> | undefined;

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== settings.webhookSha256)
    return new Response(null, { status: 403 });

  try {
    handler ??= initialize().catch((error: unknown) => {
      handler = undefined;
      throw error;
    });
    return await (
      await handler
    )(request);
  } catch (error) {
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;
    console.error(
      JSON.stringify({
        event: "edge_bot_request_failed",
        code,
        type: error instanceof Error ? error.name : "unknown",
        reference: error instanceof ReferenceError ? error.message : undefined,
      }),
    );
    return new Response(null, { status: 503 });
  }
}

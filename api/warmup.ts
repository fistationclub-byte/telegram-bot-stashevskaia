import { timingSafeEqual } from "node:crypto";
import { Api } from "grammy";
import { loadWarmupContent, sendWarmup } from "../src/bot/warmup.js";
import { loadToken } from "../src/config.js";
import { openWarmupStore } from "../src/infrastructure/warmup.js";

export default async function warmup(request: Request): Promise<Response> {
  if (request.method !== "GET") return new Response(null, { status: 405 });
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return new Response(null, { status: 401 });
  }
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.WARMUP_ENABLED !== "1"
  ) {
    return new Response(null, { status: 204 });
  }

  const cutoff = performance.now() + 45_000;
  const databaseUrl = process.env.WAITLIST_DATABASE_URL;
  if (!databaseUrl) return new Response(null, { status: 503 });

  const store = openWarmupStore(databaseUrl);
  try {
    const content = loadWarmupContent();
    const api = new Api(loadToken("production"), { timeoutSeconds: 5 });
    let processed = 0;
    while (
      performance.now() < cutoff &&
      (await store.sendNext((id, day) => sendWarmup(api, id, day, content)))
    ) {
      processed++;
    }
    return Response.json({ processed });
  } catch {
    console.error(JSON.stringify({ event: "warmup_dispatch_failed" }));
    return new Response(null, { status: 503 });
  } finally {
    await store.close();
  }
}

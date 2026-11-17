import { timingSafeEqual } from "node:crypto";
import { Api } from "grammy";
import {
  loadWarmupContent,
  sendBroadcast,
  sendWarmup,
} from "../src/bot/warmup.js";
import { loadToken } from "../src/config.js";
import { warmupDays } from "../src/domain/warmup-content.js";
import { openBotStore } from "../src/infrastructure/bot-store.js";
import { supabaseConfig } from "../src/infrastructure/database.js";
import { openWarmupStore } from "../src/infrastructure/warmup.js";

export default async function warmup(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST")
    return new Response(null, { status: 405 });
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
    (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") ||
    process.env.MAILING_ENABLED !== "1"
  ) {
    return new Response(null, { status: 204 });
  }
  try {
    const config = supabaseConfig(
      process.env,
      process.env.VERCEL_ENV === "production",
    );
    const store = openWarmupStore(config);
    const bot = openBotStore(config);
    try {
      const texts = await bot.texts();
      let content: ReturnType<typeof loadWarmupContent> | undefined;
      if (process.env.WARMUP_ENABLED === "1") {
        try {
          content = loadWarmupContent(texts);
        } catch {
          console.error(JSON.stringify({ event: "warmup_content_incomplete" }));
        }
      }
      const api = new Api(loadToken("production"), { timeoutSeconds: 5 });
      const cutoff = performance.now() + 25_000;
      let processed = 0;
      while (
        performance.now() < cutoff &&
        (await store.sendNext(async (id, key, personalized) => {
          if (!personalized) {
            const text = texts[key];
            if (!text) throw new Error("Нет текста рассылки.");
            return sendBroadcast(api, id, text);
          }
          const day = warmupDays.find((value) => `warmup.${value}` === key);
          if (!day || !content)
            throw new Error("Нет материалов для шага прогрева.");
          return sendWarmup(
            api,
            id,
            day,
            content,
            texts,
            await bot.courseSource(id),
          );
        }, !!content))
      ) {
        processed++;
      }
      return Response.json({ processed });
    } finally {
      await Promise.all([store.close(), bot.close()]);
    }
  } catch {
    console.error(JSON.stringify({ event: "mailing_dispatch_failed" }));
    return new Response(null, { status: 503 });
  }
}

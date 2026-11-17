import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";
import {
  loadProject,
  loadToken,
  readSecret,
  webhookSecret,
} from "../src/config.js";
import { openProductionWaitlist } from "../src/infrastructure/waitlist.js";
import { openWarmupStore } from "../src/infrastructure/warmup.js";
import { supabaseConfig } from "../src/infrastructure/database.js";
import { openBotStore } from "../src/infrastructure/bot-store.js";
import { createWebhook } from "../src/webhook.js";

let handler: ReturnType<typeof createWebhook> | undefined;

export default async function telegram(request: Request): Promise<Response> {
  try {
    if (!handler) {
      const project = loadProject();
      const secret = readSecret(
        project.production.telegram.webhook_secret_env,
        webhookSecret,
      );
      if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
        return new Response(null, { status: 503 });
      }
      const config = supabaseConfig(
        process.env,
        process.env.VERCEL_ENV === "production",
      );
      const storage = openProductionWaitlist(config);
      const warmup =
        project.production.warmup_enabled && process.env.WARMUP_ENABLED === "1"
          ? openWarmupStore(config)
          : undefined;
      const store = openBotStore(config);
      const callback = webhookCallback(
        createBot(
          loadToken("production", project),
          storage.save,
          undefined,
          warmup,
          store,
        ),
        "std/http",
      );
      handler = createWebhook(secret, async (update) => {
        const response = await callback(
          new Request("https://localhost/api/telegram", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(update),
          }),
        );
        if (!response.ok) throw new Error("Telegram adapter failed");
        return response;
      });
    }
    return await handler(request);
  } catch {
    console.error(JSON.stringify({ event: "webhook_configuration_failed" }));
    return new Response(null, { status: 503 });
  }
}

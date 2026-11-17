import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";
import {
  loadProject,
  loadToken,
  readSecret,
  webhookSecret,
} from "../src/config.js";
import { openProductionWaitlist } from "../src/infrastructure/waitlist.js";
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
      const databaseUrl = process.env.WAITLIST_DATABASE_URL;
      const storage = databaseUrl
        ? openProductionWaitlist(databaseUrl)
        : undefined;
      const callback = webhookCallback(
        createBot(loadToken("production", project), async (entry) => {
          if (!storage) throw new Error("WAITLIST_DATABASE_URL отсутствует");
          await storage.save(entry);
        }),
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

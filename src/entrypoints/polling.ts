import { closeSync, openSync, utimesSync } from "node:fs";
import { createBot } from "../bot.js";
import { loadToken } from "../config.js";
import { openProductionWaitlist } from "../infrastructure/waitlist.js";
import { openBotStore } from "../infrastructure/bot-store.js";
import { supabaseConfig } from "../infrastructure/database.js";

async function main() {
  const activity = ".runtime/activity";
  closeSync(openSync(activity, "a"));
  const config = supabaseConfig();
  const storage = openProductionWaitlist(config);
  const store = openBotStore(config);
  await store.texts();
  const bot = createBot(
    loadToken("development"),
    storage.save,
    () => {
      const now = new Date();
      utimesSync(activity, now, now);
    },
    undefined,
    store,
  );
  bot.catch(() =>
    console.error(JSON.stringify({ event: "polling_update_failed" })),
  );
  if ((await bot.api.getWebhookInfo()).url) {
    console.error(
      "У dev-бота уже настроен вебхук. Отключите его перед запуском polling.",
    );
    process.exitCode = 1;
    return;
  }
  process.once("SIGTERM", () => void bot.stop());
  process.once("SIGINT", () => void bot.stop());
  try {
    await bot.start({
      allowed_updates: ["message", "callback_query"],
      onStart: () => console.log("Dev-бот запущен с Supabase"),
    });
  } finally {
    await Promise.all([storage.close(), store.close()]);
  }
}

main().catch(() => {
  console.error(
    "Не удалось запустить dev-бота. Проверьте настройки и токен в .env.local.",
  );
  process.exitCode = 1;
});

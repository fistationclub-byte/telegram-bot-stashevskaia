import { closeSync, openSync, utimesSync } from "node:fs";
import { createBot } from "../bot.js";
import { loadToken } from "../config.js";
import { openLocalWaitlist } from "../infrastructure/waitlist.js";

async function main() {
  const activity = ".runtime/activity";
  closeSync(openSync(activity, "a"));
  const { save } = openLocalWaitlist(".runtime/waitlist.sqlite");
  const bot = createBot(loadToken("development"), save, () => {
    const now = new Date();
    utimesSync(activity, now, now);
  });
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
  await bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: () => console.log("Dev-бот запущен"),
  });
}

main().catch(() => {
  console.error(
    "Не удалось запустить dev-бота. Проверьте настройки и токен в .env.local.",
  );
  process.exitCode = 1;
});

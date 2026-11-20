import { Bot, type ApiClientOptions } from "grammy";
import { registerMailing } from "./bot/mailing.js";
import type { BotStore } from "./infrastructure/bot-store.js";
import { registerWaitlist } from "./bot/waitlist.js";
import type { SaveWaitlistEntry } from "./infrastructure/waitlist.js";
import type { WarmupAudience } from "./infrastructure/warmup.js";
import { registerWelcome } from "./bot/welcome.js";

export function createBot(
  token: string,
  saveWaitlistEntry: SaveWaitlistEntry,
  recordActivity?: () => void,
  warmup?: WarmupAudience,
  store?: BotStore,
  client?: ApiClientOptions,
) {
  const bot = new Bot(token, client ? { client } : {});

  if (recordActivity) {
    bot.on(["message", "callback_query"], async (_context, next) => {
      recordActivity();
      await next();
    });
  }

  if (warmup) {
    bot.callbackQuery("warmup:joined", async (context) => {
      if (context.chat?.type !== "private") {
        await context.answerCallbackQuery("Откройте личный чат с ботом.");
        return;
      }
      try {
        await warmup.markJoined(context.from.id);
      } catch {
        console.error(JSON.stringify({ event: "warmup_joined_failed" }));
        await context.answerCallbackQuery(
          "Не удалось сохранить ответ. Попробуйте ещё раз.",
        );
        return;
      }
      await context.answerCallbackQuery("Спасибо, отметила!");
    });
  }

  registerWelcome(bot, store, !!warmup);
  registerWaitlist(bot, saveWaitlistEntry, store);
  if (store && warmup) registerMailing(bot, store);

  return bot;
}

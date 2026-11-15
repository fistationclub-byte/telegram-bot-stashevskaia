import { Bot } from "grammy";
import { registerWelcome } from "./bot/welcome.js";

export function createBot(token: string, recordActivity?: () => void) {
  const bot = new Bot(token);

  if (recordActivity) {
    bot.on(["message", "callback_query"], async (_context, next) => {
      recordActivity();
      await next();
    });
  }

  registerWelcome(bot);

  return bot;
}

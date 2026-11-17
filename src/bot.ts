import { Bot } from "grammy";
import { registerWaitlist } from "./bot/waitlist.js";
import type { SaveWaitlistEntry } from "./infrastructure/waitlist.js";
import { registerWelcome } from "./bot/welcome.js";

export function createBot(
  token: string,
  saveWaitlistEntry: SaveWaitlistEntry,
  recordActivity?: () => void,
) {
  const bot = new Bot(token);

  if (recordActivity) {
    bot.on(["message", "callback_query"], async (_context, next) => {
      recordActivity();
      await next();
    });
  }

  registerWelcome(bot);
  registerWaitlist(bot, saveWaitlistEntry);

  return bot;
}

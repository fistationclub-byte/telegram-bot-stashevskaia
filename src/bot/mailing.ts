import { InlineKeyboard, type Bot } from "grammy";
import type { BotStore } from "../infrastructure/bot-store.js";

export const mailingTexts = {
  "mailing.prompt":
    "Хотите получать бесплатные уроки, полезные материалы и новости курса в этом чате?",
  "mailing.yes": "Подписаться",
  "mailing.no": "Отписаться",
  "mailing.subscribed":
    "Вы подписались на рассылку. Отписаться можно командой /unsubscribe.",
  "mailing.unsubscribed": "Вы отписались от рассылки.",
};

export function mailingPrompt(text: Record<string, string>) {
  return {
    message: text["mailing.prompt"] ?? mailingTexts["mailing.prompt"],
    keyboard: new InlineKeyboard()
      .text(text["mailing.yes"] ?? mailingTexts["mailing.yes"], "mailing:yes")
      .text(text["mailing.no"] ?? mailingTexts["mailing.no"], "mailing:no"),
  };
}

export function registerMailing(bot: Bot, store: BotStore) {
  bot.command("mailing", async (context) => {
    if (context.chat.type !== "private") return;
    const prompt = mailingPrompt(await store.texts());
    await context.reply(prompt.message, { reply_markup: prompt.keyboard });
  });
  bot.command("unsubscribe", async (context) => {
    if (context.chat.type !== "private" || !context.from) return;
    await store.subscribe(context.from, false);
    const texts = await store.texts();
    await context.reply(
      texts["mailing.unsubscribed"] ?? mailingTexts["mailing.unsubscribed"],
    );
  });
  for (const subscribed of [true, false]) {
    bot.callbackQuery(
      `mailing:${subscribed ? "yes" : "no"}`,
      async (context) => {
        if (context.chat?.type !== "private") {
          await context.answerCallbackQuery("Откройте личный чат с ботом.");
          return;
        }
        await store.subscribe(context.from, subscribed);
        const key = subscribed ? "mailing.subscribed" : "mailing.unsubscribed";
        const texts = await store.texts();
        await context.answerCallbackQuery();
        await context.reply(texts[key] ?? mailingTexts[key]);
      },
    );
  }
}

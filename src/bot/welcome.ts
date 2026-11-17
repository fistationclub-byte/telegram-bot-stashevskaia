import { InlineKeyboard, type Bot } from "grammy";
import { courseUrl, trackedCourseUrl } from "../domain/traffic.js";
import type { BotStore } from "../infrastructure/bot-store.js";
import { mailingPrompt } from "./mailing.js";

export const welcomeTexts = {
  "welcome.body": [
    "Привет! Давайте знакомиться! Расскажу, куда вы попали и чем я могу быть вам полезна.",
    "Меня зовут Анастасия, я преподаватель танцев и автор онлайн-курса «Пластика бёдер с нуля». Я уверена, что научиться красиво и свободно двигаться под музыку можно в любом возрасте, с любой комплекцией и даже совсем без танцевального опыта.",
    "Хотите научиться двигать бёдрами свободно и уверенно? У меня есть для вас несколько возможностей - выбирайте сердцем  😊👇",
  ].join("\n\n"),
  "welcome.course": "Сайт курса",
  "welcome.channel": "Бесплатный канал с хореографиями",
  "welcome.waitlist": "Хочу в предзапись на курс",
  "welcome.help": "/start — открыть меню курса и бесплатного канала.",
  "welcome.channel_pending": "Ссылка на бесплатный канал скоро появится.",
  "links.course": courseUrl,
  "links.channel": "",
};

export function registerWelcome(
  bot: Bot,
  store?: BotStore,
  mailingEnabled = false,
) {
  bot.command("start", async (context) => {
    const user = context.chat.type === "private" ? context.from : undefined;
    const source = user
      ? await store?.register(user, context.match)
      : undefined;
    const text = { ...welcomeTexts, ...(await store?.texts()) };
    const website = store
      ? trackedCourseUrl(text["links.course"], source)
      : text["links.course"];
    const keyboard = new InlineKeyboard()
      .url(text["welcome.course"], website)
      .row();
    if (text["links.channel"]) {
      keyboard.url(text["welcome.channel"], text["links.channel"]);
    } else {
      keyboard.text(text["welcome.channel"], "free_channel");
    }
    keyboard.row().text(text["welcome.waitlist"], "buy_course");
    await context.reply(text["welcome.body"], { reply_markup: keyboard });

    if (
      mailingEnabled &&
      store &&
      user &&
      (await store.subscription(user.id)) === undefined
    ) {
      const prompt = mailingPrompt(text);
      await context.reply(prompt.message, { reply_markup: prompt.keyboard });
    }
  });

  bot.command("help", async (context) => {
    const text = { ...welcomeTexts, ...(await store?.texts()) };
    const mailing = mailingEnabled
      ? "\n/mailing — настроить подписку на рассылку."
      : "";
    await context.reply(text["welcome.help"] + mailing);
  });

  bot.callbackQuery("free_channel", async (context) => {
    const text = { ...welcomeTexts, ...(await store?.texts()) };
    await context.answerCallbackQuery(
      text["links.channel"] ? undefined : text["welcome.channel_pending"],
    );
    if (text["links.channel"]) await context.reply(text["links.channel"]);
  });
}

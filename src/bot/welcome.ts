import { InlineKeyboard, type Bot } from "grammy";
import { courseUrl } from "./waitlist.js";

export function registerWelcome(bot: Bot) {
  bot.command("start", async (context) => {
    await context.reply(
      [
        "Привет! Давайте знакомиться! Расскажу, куда вы попали и чем я могу быть вам полезна.",
        "Меня зовут Анастасия, я преподаватель танцев и автор онлайн-курса «Пластика бёдер с нуля». Я уверена, что научиться красиво и свободно двигаться под музыку можно в любом возрасте, с любой комплекцией и даже совсем без танцевального опыта.",
        "Хотите научиться двигать бёдрами свободно и уверенно? У меня есть для вас несколько возможностей - выбирайте сердцем  😊👇",
      ].join("\n\n"),
      {
        reply_markup: new InlineKeyboard()
          .url("Сайт курса", courseUrl)
          .row()
          .text("Вступить в бесплатный канал с хореографиями", "free_channel")
          .row()
          .text("Хочу в предзапись на курс", "buy_course"),
      },
    );
  });

  bot.command("help", async (context) => {
    await context.reply("/start — открыть меню курса и бесплатного канала.");
  });

  bot.callbackQuery("free_channel", async (context) => {
    await context.answerCallbackQuery(
      "Ссылка на бесплатный канал скоро появится.",
    );
  });
}

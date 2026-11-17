import { InlineKeyboard, type Bot } from "grammy";

export function registerWelcome(bot: Bot) {
  bot.command("start", async (context) => {
    await context.reply(
      [
        "Я Настя, преподаватель танцев и автор онлайн-курса «Пластика бёдер с нуля».",
        "Я помогаю девушкам и женщинам научиться красиво, свободно и уверенно двигаться под музыку — независимо от возраста, комплекции и танцевального опыта.",
        "Хотите научиться двигать бёдрами свободно и уверенно? У меня есть для вас несколько возможностей: выбирайте, что интересно 👇",
      ].join("\n\n"),
      {
        reply_markup: new InlineKeyboard()
          .url("Сайт курса", "https://www.stashevskaya.space/")
          .row()
          .text("Вступить в бесплатный канал с хореографиями", "free_channel")
          .row()
          .text("Записаться в список раннего доступа на курс", "buy_course"),
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

  bot.callbackQuery("buy_course", async (context) => {
    await context.answerCallbackQuery(
      "Запись в список раннего доступа скоро откроется.",
    );
  });
}

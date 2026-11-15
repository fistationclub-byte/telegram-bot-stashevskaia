import { InlineKeyboard, type Bot } from "grammy";

export function registerWelcome(bot: Bot) {
  bot.command("start", async (context) => {
    await context.reply(
      "Привет! Здесь можно узнать больше о моём онлайн-курсе, " +
        "перейти в бесплатный Telegram-канал с хореографиями или выбрать покупку курса.\n\n" +
        "С чего начнём?",
      {
        reply_markup: new InlineKeyboard()
          .text("О курсе", "course_info")
          .text("Хореографии", "free_channel")
          .text("Хочу купить", "buy_course"),
      },
    );
  });

  bot.command("help", async (context) => {
    await context.reply("/start — открыть меню курса и бесплатного канала.");
  });

  bot.callbackQuery("course_info", async (context) => {
    await context.answerCallbackQuery();
    await context.reply(
      "Подробнее об онлайн-курсе «Пластика бёдер с нуля»:\nhttps://www.stashevskaya.space/",
    );
  });

  bot.callbackQuery("free_channel", async (context) => {
    await context.answerCallbackQuery(
      "Ссылка на бесплатный канал скоро появится.",
    );
  });

  bot.callbackQuery("buy_course", async (context) => {
    await context.answerCallbackQuery("Информация о покупке скоро появится.");
  });
}

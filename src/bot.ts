import { Bot, InlineKeyboard } from "grammy";

export function createBot(token: string, recordActivity?: () => void) {
  const bot = new Bot(token);

  if (recordActivity) {
    bot.on(["message", "callback_query"], async (_context, next) => {
      recordActivity();
      await next();
    });
  }

  bot.command("start", async (context) => {
    await context.reply(
      "Привет! Нажмите кнопку, чтобы проверить работу бота.",
      {
        reply_markup: new InlineKeyboard().text("Проверить", "check"),
      },
    );
  });

  bot.command("help", async (context) => {
    await context.reply(
      "/start — открыть кнопку проверки\n/help — показать подсказку",
    );
  });

  bot.callbackQuery("check", async (context) => {
    await context.answerCallbackQuery("Бот работает!");
  });

  return bot;
}

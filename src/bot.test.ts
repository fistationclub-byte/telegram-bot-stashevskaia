import { expect, test } from "vitest";
import { createBot } from "./bot.js";

test("приветствие показывает три кнопки в отдельных строках, первая ведёт на сайт", async () => {
  const bot = createBot("123:fake-token");
  const calls: { method: string; payload: unknown }[] = [];
  bot.botInfo = {
    id: 123,
    is_bot: true,
    first_name: "Test",
    username: "test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload });
    return { ok: true, result: true } as Awaited<ReturnType<typeof _previous>>;
  });

  const user = { id: 1, is_bot: false, first_name: "Test" };
  for (const text of ["/start", "/help"]) {
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: 1,
        chat: { id: 1, type: "private", first_name: "Test" },
        from: user,
        text,
        entities: [{ type: "bot_command", offset: 0, length: text.length }],
      },
    });
  }
  for (const data of ["free_channel", "buy_course"]) {
    await bot.handleUpdate({
      update_id: 2,
      callback_query: {
        id: "test",
        from: user,
        chat_instance: "test",
        data,
        message: {
          message_id: 1,
          date: 1,
          chat: { id: 1, type: "private", first_name: "Test" },
        },
      },
    });
  }
  expect(calls[0]).toMatchObject({
    method: "sendMessage",
    payload: {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Сайт курса",
              url: "https://www.stashevskaya.space/",
            },
          ],
          [
            {
              text: "Вступить в бесплатный канал с хореографиями",
              callback_data: "free_channel",
            },
          ],
          [
            {
              text: "Записаться в список раннего доступа на курс",
              callback_data: "buy_course",
            },
          ],
        ],
      },
    },
  });
  expect(calls[1]?.method).toBe("sendMessage");
  expect(calls.slice(2)).toEqual(
    [
      "Ссылка на бесплатный канал скоро появится.",
      "Запись в список раннего доступа скоро откроется.",
    ].map((text) => ({
      method: "answerCallbackQuery",
      payload: { callback_query_id: "test", text },
    })),
  );
});

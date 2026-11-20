import { expect, test } from "vitest";
import { createBot } from "./bot.js";
import { openLocalWaitlist } from "./infrastructure/waitlist.js";

test("предзапись показывает тарифы, сохраняет выбор и обновляет запись при смене тарифа", async () => {
  const { db, save } = openLocalWaitlist(":memory:");
  const bot = createBot("123:fake-token", save);
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
  for (const data of [
    "buy_course",
    "waitlist:self_study",
    "waitlist:anastasia_feedback",
    "waitlist:mentor_feedback",
  ]) {
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
              text: "Бесплатный канал с хореографиями",
              url: "https://t.me/bundachoreo",
            },
          ],
          [
            {
              text: "Хочу в предзапись на курс",
              callback_data: "buy_course",
            },
          ],
        ],
      },
    },
  });
  expect(calls[1]?.method).toBe("sendMessage");
  expect(calls[3]).toMatchObject({
    method: "sendMessage",
    payload: {
      parse_mode: "HTML",
      text: expect.stringContaining(
        '<a href="https://www.stashevskaya.space/">ссылке на сайт</a>',
      ),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Самостоятельный", callback_data: "waitlist:self_study" }],
          [
            {
              text: "С обратной связью от Анастасии",
              callback_data: "waitlist:anastasia_feedback",
            },
          ],
          [
            {
              text: "С обратной связью от куратора",
              callback_data: "waitlist:mentor_feedback",
            },
          ],
        ],
      },
    },
  });
  for (const [index, tier] of [
    [5, "Самостоятельный"],
    [7, "С обратной связью от Анастасии Сташевской - автора курса"],
    [9, "С обратной связью от куратора"],
  ] as const) {
    expect(calls[index]).toMatchObject({
      method: "sendMessage",
      payload: {
        text: expect.stringContaining(
          `Супер! Вы в списке раннего доступа на тариф «${tier}»!`,
        ),
      },
    });
  }
  expect(
    db.prepare("SELECT telegram_id, username, tier FROM course_waitlist").all(),
  ).toEqual([{ telegram_id: 1, username: null, tier: "mentor_feedback" }]);
  db.close();
});

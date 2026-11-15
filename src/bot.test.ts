import { expect, test } from "vitest";
import { createBot } from "./bot.js";

test("команды и кнопка вызывают Telegram API", async () => {
  const bot = createBot("123:fake-token");
  const methods: string[] = [];
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
  bot.api.config.use(async (_previous, method) => {
    methods.push(method);
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
  await bot.handleUpdate({
    update_id: 2,
    callback_query: {
      id: "test",
      from: user,
      chat_instance: "test",
      data: "check",
    },
  });
  expect(methods).toEqual([
    "sendMessage",
    "sendMessage",
    "answerCallbackQuery",
  ]);
});

import { expect, test, vi } from "vitest";
import { createWebhook } from "./webhook.js";

const url = "https://example.com/api/telegram";
const headers = { "X-Telegram-Bot-Api-Secret-Token": "expected" };

test("отклоняет неверный метод, секрет и тело до вызова бота", async () => {
  const handle = vi.fn(async () => new Response());
  const webhook = createWebhook("expected", handle);
  expect((await webhook(new Request(url))).status).toBe(405);
  expect((await webhook(new Request(url, { method: "POST" }))).status).toBe(
    403,
  );
  expect(
    (
      await webhook(
        new Request(url, {
          method: "POST",
          headers: { "X-Telegram-Bot-Api-Secret-Token": "incorrect" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await webhook(new Request(url, { method: "POST", headers, body: "{}" })))
      .status,
  ).toBe(400);
  expect(handle).not.toHaveBeenCalled();
});

test("передаёт обновление и скрывает ошибки обработчика", async () => {
  const handle = vi.fn(async () => new Response());
  const webhook = createWebhook("expected", handle);
  const request = () =>
    new Request(url, { method: "POST", headers, body: '{"update_id":1}' });
  expect((await webhook(request())).status).toBe(200);
  expect(handle).toHaveBeenCalledWith({ update_id: 1 });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    handle.mockRejectedValueOnce(new Error("private data"));
    expect((await webhook(request())).status).toBe(500);
    expect(log).toHaveBeenCalledWith('{"event":"webhook_update_failed"}');
  } finally {
    log.mockRestore();
  }
});

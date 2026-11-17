import { expect, test } from "vitest";
import { warmupMessage } from "./warmup.js";
import { warmupDays } from "../domain/warmup-content.js";

test("семь касаний выводят заданные кнопки и вложения, приглашение только в день 19", () => {
  const channel = "https://t.me/dance_test";
  const content = {
    channel,
    videos: {
      1: "video1",
      4: "video4",
      7: "video7",
      10: "video10",
      13: "video13",
    },
    photo: "photo16",
  };
  expect(warmupDays).toEqual([1, 4, 7, 10, 13, 16, 19]);
  const messages = warmupDays.map((day) => warmupMessage(day, content));
  expect(messages.map((message) => message.video)).toEqual([
    "video1",
    "video4",
    "video7",
    "video10",
    "video13",
    undefined,
    undefined,
  ]);
  expect(
    messages.map((message) => message.keyboard?.inline_keyboard.flat()),
  ).toEqual([
    [{ text: "Хочу ещё бесплатные танцы", url: channel }],
    undefined,
    [{ text: "Хочу ещё бесплатные танцы", url: channel }],
    [
      {
        text: "Посмотреть программу курса",
        url: "https://www.stashevskaya.space/",
      },
    ],
    undefined,
    [{ text: "Узнать о курсе", url: "https://www.stashevskaya.space/" }],
    [
      { text: "Хочу в предзапись на курс", callback_data: "buy_course" },
      { text: "Я уже записалась на курс", callback_data: "warmup:joined" },
    ],
  ]);
  expect(messages[3]?.text).toContain(
    "Это результаты моих учениц, которые когда-то тоже начинали с нуля.",
  );
  expect(messages[5]?.photo).toBe(content.photo);
  for (const message of messages) {
    if (message.video || message.photo)
      expect(message.text.length).toBeLessThanOrEqual(1024);
  }
});

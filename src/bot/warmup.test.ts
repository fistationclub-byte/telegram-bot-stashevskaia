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
  const texts = Object.fromEntries(
    warmupDays.map((day) => [`warmup.${day}`, `Тестовый текст дня ${day}`]),
  );
  const messages = warmupDays.map((day) => warmupMessage(day, content, texts));
  expect(() => warmupMessage(10, content, {})).toThrow(
    "Текст прогрева отсутствует",
  );
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
        url: "https://www.stashevskaya.space/?source2=telegram&utm_medium=telegram",
      },
    ],
    undefined,
    [
      {
        text: "Узнать о курсе",
        url: "https://www.stashevskaya.space/?source2=telegram&utm_medium=telegram",
      },
    ],
    [
      { text: "Хочу в предзапись на курс", callback_data: "buy_course" },
      { text: "Я уже записалась на курс", callback_data: "warmup:joined" },
    ],
  ]);
  expect(messages[3]?.text).toBe("Тестовый текст дня 10");
  expect(messages[5]?.photo).toBe(content.photo);
  for (const message of messages) {
    if (message.video || message.photo)
      expect(message.text.length).toBeLessThanOrEqual(1024);
  }
});

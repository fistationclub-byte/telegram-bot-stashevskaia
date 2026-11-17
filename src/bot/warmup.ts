import { GrammyError, InlineKeyboard, type Api } from "grammy";
import { warmupText, type WarmupDay } from "../domain/warmup-content.js";
import { courseUrl } from "./waitlist.js";

export function loadWarmupContent() {
  const day10 = process.env.WARMUP_DAY_10_TEXT?.trim();
  const channel = process.env.WARMUP_CHANNEL_URL?.trim();
  if (
    !day10 ||
    day10.length > 4096 ||
    !channel ||
    !/^https:\/\/t\.me\/[\w+/-]+$/.test(channel)
  ) {
    throw new Error("Нужны текст дня 10 и HTTPS-ссылка на Telegram-канал.");
  }
  const videos = {
    1: process.env.WARMUP_DAY_1_VIDEO,
    4: process.env.WARMUP_DAY_4_VIDEO,
    7: process.env.WARMUP_DAY_7_VIDEO,
    13: process.env.WARMUP_DAY_13_VIDEO,
  };
  if (Object.values(videos).some((video) => !video?.trim())) {
    throw new Error("Нужны видео для дней 1, 4, 7 и 13.");
  }
  return { day10, channel, videos, photo: process.env.WARMUP_DAY_16_PHOTO };
}

export function warmupMessage(
  day: WarmupDay,
  content: ReturnType<typeof loadWarmupContent>,
) {
  const text = day === 10 ? content.day10 : warmupText[day];
  if (!text) throw new Error("Нет текста сообщения");
  const keyboard = new InlineKeyboard();
  if (day === 1 || day === 7)
    keyboard.url("Хочу ещё бесплатные танцы", content.channel);
  if (day === 10) keyboard.url("Посмотреть программу курса", courseUrl);
  if (day === 16) keyboard.url("Узнать о курсе", courseUrl);
  if (day === 19) {
    keyboard
      .text("Хочу в предзапись на курс", "buy_course")
      .row()
      .text("Я уже записалась на курс", "warmup:joined");
  }
  const video =
    day === 1 || day === 4 || day === 7 || day === 13
      ? content.videos[day]
      : undefined;
  return {
    text,
    ...(keyboard.inline_keyboard[0]?.length ? { keyboard } : {}),
    video,
    photo: day === 16 ? content.photo : undefined,
  };
}

export async function sendWarmup(
  api: Api,
  telegramId: string,
  day: WarmupDay,
  content: ReturnType<typeof loadWarmupContent>,
) {
  const message = warmupMessage(day, content);
  const options = {
    ...(message.keyboard ? { reply_markup: message.keyboard } : {}),
    ...(day === 13 ? { parse_mode: "HTML" as const } : {}),
  };
  try {
    if (message.video) {
      await api.sendVideo(telegramId, message.video, {
        ...options,
        caption: message.text,
      });
    } else if (message.photo) {
      await api.sendPhoto(telegramId, message.photo, {
        ...options,
        caption: message.text,
      });
    } else {
      await api.sendMessage(telegramId, message.text, {
        ...options,
        link_preview_options: { is_disabled: true },
      });
    }
    return "sent";
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 403)
      return "blocked";
    throw error;
  }
}

import { GrammyError, InlineKeyboard, type Api } from "grammy";
import { warmupText, type WarmupDay } from "../domain/warmup-content.js";
import { courseUrl, trackedCourseUrl } from "../domain/traffic.js";
import type { TrafficSource } from "../infrastructure/bot-store.js";

export const warmupTexts = {
  ...Object.fromEntries(
    Object.entries(warmupText).map(([day, text]) => [`warmup.${day}`, text]),
  ),
  "warmup.channel_button": "Хочу ещё бесплатные танцы",
  "warmup.program_button": "Посмотреть программу курса",
  "warmup.course_button": "Узнать о курсе",
  "warmup.joined_button": "Я уже записалась на курс",
  "warmup.joined": "Спасибо, отметила!",
  "warmup.joined_error": "Не удалось сохранить ответ. Попробуйте ещё раз.",
  "warmup.video.1": "",
  "warmup.video.4": "",
  "warmup.video.7": "",
  "warmup.video.10": "",
  "warmup.video.13": "",
  "warmup.photo.16": "",
};

export function loadWarmupContent(texts: Record<string, string>) {
  const channel = texts["links.channel"]?.trim();
  if (!channel || !/^https:\/\/t\.me\/[\w+/-]+$/.test(channel)) {
    throw new Error("Нужна HTTPS-ссылка на Telegram-канал.");
  }
  const videos = {
    1: texts["warmup.video.1"],
    4: texts["warmup.video.4"],
    7: texts["warmup.video.7"],
    10: texts["warmup.video.10"],
    13: texts["warmup.video.13"],
  };
  if (Object.values(videos).some((video) => !video?.trim())) {
    throw new Error("Нужны видео для дней 1, 4, 7, 10 и 13.");
  }
  return { channel, videos, photo: texts["warmup.photo.16"] };
}

export function warmupMessage(
  day: WarmupDay,
  content: ReturnType<typeof loadWarmupContent>,
  texts?: Record<string, string>,
  source?: TrafficSource,
) {
  const text = texts?.[`warmup.${day}`] ?? warmupText[day];
  const website = texts
    ? trackedCourseUrl(texts["links.course"] ?? courseUrl, source)
    : courseUrl;
  const keyboard = new InlineKeyboard();
  if (day === 1 || day === 7)
    keyboard.url(
      texts?.["warmup.channel_button"] ?? warmupTexts["warmup.channel_button"],
      content.channel,
    );
  if (day === 10)
    keyboard.url(
      texts?.["warmup.program_button"] ?? warmupTexts["warmup.program_button"],
      website,
    );
  if (day === 16)
    keyboard.url(
      texts?.["warmup.course_button"] ?? warmupTexts["warmup.course_button"],
      website,
    );
  if (day === 19) {
    keyboard
      .text(
        texts?.["welcome.waitlist"] ?? "Хочу в предзапись на курс",
        "buy_course",
      )
      .row()
      .text(
        texts?.["warmup.joined_button"] ?? warmupTexts["warmup.joined_button"],
        "warmup:joined",
      );
  }
  const video =
    day === 1 || day === 4 || day === 7 || day === 10 || day === 13
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
  texts?: Record<string, string>,
  source?: TrafficSource,
) {
  const message = warmupMessage(day, content, texts, source);
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

export async function sendBroadcast(
  api: Api,
  telegramId: string,
  text: string,
) {
  try {
    await api.sendMessage(telegramId, text, {
      link_preview_options: { is_disabled: true },
    });
    return "sent";
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 403)
      return "blocked";
    throw error;
  }
}

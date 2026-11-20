import { InlineKeyboard, type Bot } from "grammy";
import type {
  CourseTier,
  SaveWaitlistEntry,
} from "../infrastructure/waitlist.js";

import type { BotStore } from "../infrastructure/bot-store.js";
import {
  courseUrl,
  htmlAttribute,
  trackedCourseUrl,
} from "../domain/traffic.js";
export { courseUrl };

const tiers = {
  self_study: {
    button: "Самостоятельный",
    confirmation: [
      "Супер! Вы в списке раннего доступа на тариф «Самостоятельный»!",
      "Как только откроется набор, я пришлю вам сообщение, чтобы вы могли первыми присоединиться к курсу и получить бонус раннего доступа.",
    ],
  },
  anastasia_feedback: {
    button: "С обратной связью от Анастасии",
    confirmation: [
      "Супер! Вы в списке раннего доступа на тариф «С обратной связью от Анастасии Сташевской - автора курса»!",
    ],
  },
  mentor_feedback: {
    button: "С обратной связью от куратора",
    confirmation: [
      "Супер! Вы в списке раннего доступа на тариф «С обратной связью от куратора»!",
    ],
  },
} satisfies Record<CourseTier, { button: string; confirmation: string[] }>;

const tierOrder: CourseTier[] = [
  "self_study",
  "anastasia_feedback",
  "mentor_feedback",
];

const prompt = [
  "Отлично! Давайте запишем вас в список раннего доступа на ближайший поток онлайн-курса «Пластика бёдер с нуля»!",
  'Перед записью обязательно ознакомьтесь с программой курса, форматами участия и стоимостью по <a href="{{course_url}}">ссылке на сайт</a>.',
  "После этого выберите тариф, который вам больше подходит, нажав на соответствующую кнопку ниже 👇",
].join("\n\n");

function confirmation(tier: CourseTier) {
  const paragraphs = [...tiers[tier].confirmation];
  if (tier !== "self_study") {
    paragraphs.push(
      "На этом тарифе всего 10 мест, поэтому участницы списка раннего доступа первыми получат возможность записаться.",
      "Как только откроется набор, я пришлю вам всю информацию - не останавливайте этот чат.",
    );
  }
  paragraphs.push(
    "А пока оставайтесь на связи — впереди будет много интересного!",
  );
  return paragraphs.join("\n\n");
}

export const waitlistTexts = {
  "waitlist.prompt": prompt,
  "waitlist.private": "Для предзаписи откройте личный чат с ботом.",
  "waitlist.error":
    "Не удалось сохранить предзапись. Пожалуйста, выберите тариф ещё раз чуть позже.",
  ...Object.fromEntries(
    tierOrder.flatMap((tier) => [
      [`waitlist.button.${tier}`, tiers[tier].button],
      [`waitlist.confirmation.${tier}`, confirmation(tier)],
    ]),
  ),
};

export function registerWaitlist(
  bot: Bot,
  save: SaveWaitlistEntry,
  store?: BotStore,
) {
  bot.callbackQuery("buy_course", async (context) => {
    await context.answerCallbackQuery();
    const text: Record<string, string> = {
      ...waitlistTexts,
      ...(await store?.texts()),
    };
    const url = store
      ? trackedCourseUrl(
          text["links.course"] ?? courseUrl,
          await store.courseSource(context.from.id),
        )
      : courseUrl;
    const keyboard = new InlineKeyboard(
      tierOrder.map((tier) => [
        {
          text: text[`waitlist.button.${tier}`] ?? tiers[tier].button,
          callback_data: `waitlist:${tier}`,
        },
      ]),
    );
    await context.reply(
      (text["waitlist.prompt"] ?? prompt).replaceAll(
        "{{course_url}}",
        htmlAttribute(url),
      ),
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      },
    );
  });

  for (const tier of tierOrder) {
    bot.callbackQuery(`waitlist:${tier}`, async (context) => {
      const text: Record<string, string> = {
        ...waitlistTexts,
        ...(await store?.texts()),
      };
      if (context.chat?.type !== "private") {
        await context.answerCallbackQuery(
          text["waitlist.private"] ?? waitlistTexts["waitlist.private"],
        );
        return;
      }

      await context.answerCallbackQuery();
      try {
        await store?.register(context.from, "");
        await save({
          telegramId: context.from.id,
          username: context.from.username ?? null,
          tier,
        });
      } catch {
        console.error(JSON.stringify({ event: "waitlist_save_failed" }));
        await context.reply(
          text["waitlist.error"] ?? waitlistTexts["waitlist.error"],
        );
        return;
      }
      await context.reply(
        text[`waitlist.confirmation.${tier}`] ?? confirmation(tier),
      );
    });
  }
}

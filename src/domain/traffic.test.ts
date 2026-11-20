import { expect, test } from "vitest";
import { htmlAttribute, trackedCourseUrl } from "./traffic.js";

test("ссылка сохраняет исходный источник, Telegram и параметры сайта", () => {
  const link = new URL(
    trackedCourseUrl("https://www.stashevskaya.space/?page=course", {
      platform: "tiktok",
      campaign: "осень 2026",
      content: "до & после",
      term: null,
    }),
  );
  expect(Object.fromEntries(link.searchParams)).toEqual({
    page: "course",
    source1: "tiktok",
    source2: "telegram",
    utm_source: "tiktok",
    utm_medium: "telegram",
    utm_campaign: "осень 2026",
    utm_content: "до & после",
  });
  expect(htmlAttribute(link.href)).toContain("&amp;source2=telegram");
});

test("ссылка без известного первичного источника отмечает только Telegram", () => {
  const link = new URL(trackedCourseUrl("https://www.stashevskaya.space/"));
  expect(Object.fromEntries(link.searchParams)).toEqual({
    source2: "telegram",
    utm_medium: "telegram",
  });
});

import type { TrafficSource } from "../infrastructure/bot-store.js";

export const courseUrl = "https://www.stashevskaya.space/";

export function trackedCourseUrl(base: string, source?: TrafficSource) {
  const url = new URL(base);
  if (source) {
    url.searchParams.set("source1", source.platform);
    url.searchParams.set("utm_source", source.platform);
    if (source.campaign) url.searchParams.set("utm_campaign", source.campaign);
    if (source.content) url.searchParams.set("utm_content", source.content);
    if (source.term) url.searchParams.set("utm_term", source.term);
  }
  url.searchParams.set("source2", "telegram");
  url.searchParams.set("utm_medium", "telegram");
  return url.href;
}

export function htmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

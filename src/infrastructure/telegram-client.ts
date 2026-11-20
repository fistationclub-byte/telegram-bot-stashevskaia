import fetchModule, { Headers } from "node-fetch";
import type { ApiClientOptions } from "grammy";

export function telegramClientOptions(token: string): ApiClientOptions {
  const relay = process.env.TELEGRAM_API_RELAY_URL;
  if (!relay) return { timeoutSeconds: 8 };
  const root = new URL(relay);
  if (
    root.protocol !== "https:" ||
    root.hostname !== "nkmroabbxywwowfpaevm.supabase.co" ||
    root.pathname !== "/functions/v1/telegram-transport/api" ||
    root.username ||
    root.password ||
    root.search ||
    root.hash
  )
    throw new Error("Проверьте TELEGRAM_API_RELAY_URL.");

  const fetch = fetchModule.default;
  const relayFetch = Object.assign(
    (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    },
    { isRedirect: fetch.isRedirect },
  );

  return {
    apiRoot: root.href,
    timeoutSeconds: 10,
    buildUrl: (url, _token, method) => {
      const endpoint = new URL(url);
      endpoint.searchParams.set("method", method);
      return endpoint.href;
    },
    fetch: relayFetch,
  };
}

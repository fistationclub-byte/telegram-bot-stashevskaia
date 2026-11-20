import fingerprints from "./fingerprints.json" with { type: "json" };

declare const Deno: {
  serve(handler: (request: Request) => Promise<Response>): void;
};

const methods = new Set([
  "getMe",
  "sendMessage",
  "answerCallbackQuery",
  "sendVideo",
  "sendPhoto",
  "getWebhookInfo",
  "setWebhook",
]);

async function matches(value: string, expected: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const actual = Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return actual === expected;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const url = new URL(request.url);
  let destination: string;
  const headers = new Headers();
  if (url.pathname.endsWith("/webhook")) {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!(await matches(secret, fingerprints.webhook)))
      return new Response(null, { status: 403 });
    destination = "https://bot.stashevskaya.space/api/telegram";
    headers.set("X-Telegram-Bot-Api-Secret-Token", secret);
  } else if (url.pathname.endsWith("/api")) {
    const token = (request.headers.get("authorization") ?? "").replace(
      /^Bearer /,
      "",
    );
    if (!(await matches(token, fingerprints.bot)))
      return new Response(null, { status: 403 });
    const method = url.searchParams.get("method") ?? "";
    if (!methods.has(method)) return new Response(null, { status: 400 });
    destination = `https://api.telegram.org/bot${token}/${method}`;
  } else {
    return new Response(null, { status: 404 });
  }
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 1_048_576)
      return new Response(null, { status: 413 });
    headers.set(
      "content-type",
      request.headers.get("content-type") ?? "application/json",
    );
    const response = await fetch(destination, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    console.error("telegram_transport_failed");
    return new Response(null, { status: 502 });
  }
});

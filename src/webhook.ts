import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const updateEnvelope = z.object({ update_id: z.number().int().nonnegative() });

export function createWebhook(
  secret: string,
  handle: (update: unknown) => Promise<Response>,
) {
  const expected = Buffer.from(secret);
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    const received = Buffer.from(
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "",
    );
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return new Response(null, { status: 403 });
    }

    const update: unknown = await request.json().catch(() => undefined);
    if (!updateEnvelope.safeParse(update).success) {
      return new Response(null, { status: 400 });
    }

    try {
      return await handle(update);
    } catch {
      console.error(JSON.stringify({ event: "webhook_update_failed" }));
      return new Response(null, { status: 500 });
    }
  };
}

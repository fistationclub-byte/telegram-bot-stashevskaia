import { z } from "zod";
import {
  loadProject,
  loadToken,
  readSecret,
  webhookSecret,
} from "../../src/config.ts";

const webhookInfo = z.object({
  ok: z.literal(true),
  result: z.object({ url: z.string(), pending_update_count: z.number() }),
});

async function main() {
  const action = process.argv[2];
  if (action !== "set" && action !== "status")
    throw new Error("Укажите set или status");
  const project = loadProject();
  const token = loadToken("production", project);
  const call = async (method, body) => {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error();
    return response.json();
  };

  if (action === "set") {
    const telegram = project.production.telegram;
    const secret = readSecret(telegram.webhook_secret_env, webhookSecret);
    const url = new URL(process.env.TELEGRAM_PROD_WEBHOOK_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== telegram.webhook_path
    )
      throw new Error();
    const result = z
      .object({ ok: z.literal(true), result: z.literal(true) })
      .parse(
        await call("setWebhook", {
          url: url.href,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
        }),
      );
    if (!result.ok) throw new Error();
    const info = webhookInfo.parse(await call("getWebhookInfo", {})).result;
    if (info.url !== url.href) throw new Error();
    console.log("Telegram подтвердил адрес вебхука.");
    return;
  }

  const info = webhookInfo.parse(await call("getWebhookInfo", {})).result;
  console.log(info.url ? "Вебхук настроен." : "Вебхук отсутствует.");
  console.log(`Обновлений в очереди: ${info.pending_update_count}`);
}

main().catch(() => {
  console.error(
    "Не удалось выполнить команду. Проверьте параметры и доступ к Telegram.",
  );
  process.exitCode = 1;
});

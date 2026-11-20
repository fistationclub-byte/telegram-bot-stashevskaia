# Боевой бот в Supabase Edge Functions

Бот работает в функции `telegram-bot` проекта `nkmroabbxywwowfpaevm`.

Вебхук Telegram — `https://nkmroabbxywwowfpaevm.supabase.co/functions/v1/telegram-bot`. Стандартная JWT-проверка этого webhook отключена, входящие запросы проверяются по `X-Telegram-Bot-Api-Secret-Token`. Проверка отпечатка выполняется до подключения базы. Секрет дополнительно сверяется с конфигурацией в Vault.

## Выпуск

После `pnpm install --frozen-lockfile` выполните `pnpm build` и `pnpm build:edge`. Загрузите три файла из `supabase/functions/telegram-bot`: `index.ts`, `handler.js`, `deno.json`. При повторном выпуске явно указывайте import map `deno.json`.

Runtime токен Telegram и параметры ограниченной роли базы хранятся в зашифрованном Vault под именем `telegram_bot_edge_runtime`. Для первичного чтения Vault используется встроенный `SUPABASE_DB_URL` Edge Functions. Данные пользователей обрабатываются через роль `telegram_bot_runtime`.

Скрипт `node --env-file=.env.production.local scripts/configure-edge-runtime.mjs` обновляет конфигурацию Vault из локального production-токена, секрета webhook и закрытого файла `.env.supabase.runtime`. Если изменился секрет вебхука, обновите SHA-256 в `src/edge/settings.json`, пересоберите функцию и обновите webhook Telegram. В файле настроек хранится публичный сертификат CA и отпечаток, значения секретов туда не помещаются.

## Проверка

У неавторизованного POST должен быть статус 403, у GET — 405. Авторизованный POST с пустым обновлением должен вернуть 200. Затем проверьте реальную доставку Telegram, очередь `getWebhookInfo` и строки `bot.telegram_update_receipts`. Успешное обновление фиксируется в одной транзакции с отметкой, повторная доставка с тем же ID пропускается. При отказе между отправкой сообщения и фиксацией транзакции повторная отправка остаётся возможной.

Тексты и версии — `bot.bot_messages` и `bot.bot_message_revisions`, участники — `bot.telegram_users`, тарифы предзаписи — `bot.course_waitlist`. Прогрев и рассылки в этой функции выключены. Для их будущего включения требуется отдельный обработчик очереди и подключение Cron.

Контейнер на IsHosting больше не обслуживает боевого бота. Локальный тестовый бот продолжает работать отдельно через Docker.

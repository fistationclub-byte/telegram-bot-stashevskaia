# Производственный бот на IsHosting

Подготовьте Node.js 24 и HTTPS-прокси. Запустите из корня релиза `node dist/src/entrypoints/webhook.js` отдельным служебным пользователем. Сервис слушает `127.0.0.1:3000` по умолчанию. Направьте HTTPS-пути `/api/telegram` и `/api/warmup` на этот порт.

Храните закрытый файл окружения на сервере с правами `0600`. В него входят отдельная роль базы из `.env.supabase.runtime`, production-токен Telegram, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` и флаги `MAILING_ENABLED=0`, `WARMUP_ENABLED=0`. Административный пароль на сервер бота не переносите. Сертификат PostgreSQL лежит в `config/supabase-ca.pem`.

## Supabase

После `pnpm build`:

- Миграции: `node --env-file=.env.production.local scripts/supabase-migrate.mjs`. Используется Session pooler. В `bot.schema_migrations` ведётся журнал версий.
- Ограниченная роль: `node --env-file=.env.production.local scripts/supabase-runtime-role.mjs`. Параметры хранятся в игнорируемом файле `.env.supabase.runtime`.
- Список предзаписи находится в `bot.course_waitlist`, имена и источники — в `bot.telegram_users`. Для новой метки ссылки добавьте код в `bot.traffic_sources`. Ссылка на канал хранится под ключом `links.channel`, медиа — под `warmup.video.<день>` и `warmup.photo.16` в `bot.bot_messages`.

В Vault добавьте `bot_dispatch_url` с публичным адресом пути `/api/warmup` и `bot_dispatch_secret`, равный `CRON_SECRET`. Задача `telegram-bot-dispatch` проверяет очередь раз в минуту и делает HTTP-вызовы после настройки обоих значений. До включения рассылки проверьте обработчик по HTTPS. Для отправок требуется `MAILING_ENABLED=1`. Для персональной цепочки подготовьте ссылку канала и все пять видео, включите `WARMUP_ENABLED=1` и снимите паузу.

Общую рассылку задают текст в `bot.bot_messages` и запись в `bot.campaigns` с временем и флагом `enabled`. Получатели — подписавшиеся до времени кампании. Бот повторно проверяет подписку перед отправкой и записывает результат. При сбое между отправкой Telegram и фиксацией результата возможна повторная доставка.

Пауза и возобновление: `node --env-file=.env.production.local scripts/warmup-control.mjs pause` или `resume`. Пауза относится к персональной цепочке. Пользователь управляет подпиской через `/mailing` и `/unsubscribe`. Подписки и предзаписи хранятся отдельно.

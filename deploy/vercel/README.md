# Выпуск бота через Vercel

1. В Vercel выберите **Add New → Project**, затем импортируйте существующий репозиторий GitHub. В настройках проекта выберите ветку `master` для Production и Node.js 24.x. Production обновляется при слиянии PR в эту ветку.
2. В **Settings → Environment Variables** добавьте `TELEGRAM_PROD_BOT_TOKEN` для отдельного бота из @BotFather и `TELEGRAM_WEBHOOK_SECRET` со случайным значением из букв, цифр, дефисов или подчёркиваний. Для обеих переменных выберите только **Production**. Проверьте область видимости в списке. В репозитории автоматические сборки Vercel включены для `master`. Сверьте это в истории Deployments при первом PR.
3. После успешного, согласованного выпуска используйте адрес production-проекта с путём `/api/telegram`. В отдельном локальном файле `.env.production.local` сохраните токен, тот же секрет и `TELEGRAM_PROD_WEBHOOK_URL` с полным HTTPS-адресом. Из корня проекта выполните `node --env-file=.env.production.local deploy/vercel/webhook.mjs set`. Успех подтверждается строкой «Telegram подтвердил адрес вебхука».
4. Для проверки без изменения настроек выполните `node --env-file=.env.production.local deploy/vercel/webhook.mjs status` и отправьте production-боту `/start`. При ошибке проверьте состояние выпуска, полный адрес и совпадение секрета. В сообщениях о проблеме используйте только статус и текст ошибки.

## Защита веток GitHub

Откройте **Settings → Rules → Rulesets → New branch ruleset**. Выберите Active и ветку `master`. Включите **Require a pull request before merging**, **Require status checks to pass** (проверка CI **checks** появится после первого запуска), **Block force pushes** и **Restrict deletions**. Оставьте список обхода пустым, если это доступно. Сохраните правило и проверьте, что оно помечено Active и применяется к `master`. Аналогично можно настроить `development`. Для выпуска открывайте PR из `development` в `master`. Если GitHub не даёт сохранить правило, проверьте права администратора и доступность rulesets для тарифа.

## Список раннего доступа

Для боевого бота нужен PostgreSQL. Добавьте адрес подключения с TLS в `WAITLIST_DATABASE_URL` только в окружение **Production**. До выпуска создайте таблицу командой `node --env-file=.env.production.local deploy/vercel/init-waitlist.mjs` из корня проекта. Используйте роль с правом создать таблицу для настройки и роль с доступом к таблице для работы бота.

Таблица `course_waitlist` содержит одну строку на Telegram ID. В ней сохраняются `telegram_id`, ник `username` при наличии, код тарифа `tier`, время первой записи `registered_at` и время последнего изменения `updated_at` в UTC. При повторном выборе другого тарифа обновляется прежняя строка. Коды тарифов: `self_study`, `anastasia_feedback`, `mentor_feedback`.

Список можно выгрузить в CSV из панели PostgreSQL. Для просмотра по порядку записи выполните `SELECT * FROM course_waitlist ORDER BY registered_at, telegram_id;`. Тестовый бот хранит отдельную копию в локальном файле `.runtime/waitlist.sqlite`. Запись в список сохраняет получателей для будущего уведомления. Рассылка при открытии набора подключается отдельно.

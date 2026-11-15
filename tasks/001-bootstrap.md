# Задание № 001 — создать основу Telegram-бота

**Для Codex.** Работай непосредственно в репозитории проекта. Сначала прочитай корневой `AGENTS.md`, затем `.agents/skills/telegram-bot-engineering/SKILL.md`. Общие правила не дублируются здесь. Это задача **на создание работающего минимального приложения и инфраструктуры**, а не на написание только плана.

## Конкретные функции бота (сюда пользователь вписывает требования)

<!-- НАЧАЛО ПОЛЯ ДЛЯ ПОЛЬЗОВАТЕЛЯ -->



<!-- КОНЕЦ ПОЛЯ ДЛЯ ПОЛЬЗОВАТЕЛЯ -->

Если раздел пуст, реализуй **только минимальные `/start`, `/help` и одну демонстрационную inline-кнопку**, чтобы проверить инфраструктуру. Не выдумывай дополнительные бизнес-функции. Если требования вписаны, сначала реализуй их минимальную полезную версию, тесты и понятную навигацию. Кнопки должны вызывать реальные обработчики, а не быть заглушками без действия.

## Что нужно сделать в этой первой задаче

### A. Проверка среды и репозитория

1. Определи существующие файлы, тип проекта, операционную систему и доступность `git`, `gh`, Docker Compose, Node.js/pnpm. Не удаляй и не перезаписывай существующий код без анализа.
2. Репозиторий создаёт владелец отдельно; не создавай новый удалённый репозиторий без разрешения. Если `origin` уже указан, используй его. Если не указан — полностью сделай локальную работу, а затем дай одну простую инструкцию пользователю, куда вставить URL репозитория.
3. Если есть `main` и требуется `master`, аккуратно подготовь переименование; для существующего общего remote сначала проверь default branch/protections. Если репозиторий пуст, создай `master` и `development`, а работу веди в `feat/project-bootstrap` от `development`. Не переписывай существующую историю.
4. `gh` использовать только если авторизован (`gh auth status`). Если нет доступа — не блокируй разработку и не выдумывай созданный PR.

### B. Рабочий TypeScript + grammY бот

1. Создай строгий TypeScript проект на **Node.js 24.x** и `pnpm` с lockfile, ESLint, Prettier, Vitest, Zod. Версии совместимы; не ставь бесполезные зависимости.
2. Создай модульную структуру по skill. Раздели функции Telegram, бизнес-логику, конфигурацию, сервисы и инфраструктурные адаптеры. `api/telegram.ts` — тонкая точка входа Vercel; `src/entrypoints/polling.ts` — только локальное dev polling.
3. Production route `/api/telegram` принимает только POST, проверяет `X-Telegram-Bot-Api-Secret-Token`, безопасно обрабатывает обновления и отдаёт корректный HTTP-ответ. Вынеси конфигурацию и инициализацию в переиспользуемые модули. Не используй Edge Runtime, отдельный постоянный Node HTTP server на Vercel или глобальные in-memory sessions.
4. Создай общую, безопасную обработку ошибок и минимальные полезные логи. По умолчанию не записывай токены и личные данные пользователей в логи.
5. Реализуй `/start`, `/help` и как минимум одну реально отвечающую inline-кнопку, если раздел конкретных функций пуст.
6. Не регистрируй production webhook без отдельного подтверждения и данных от владельца. Сделай безопасный вспомогательный script для установки/проверки webhook после прод-деплоя — токен передавай только через env и HTTP POST, не через URL в браузере.

### C. Конфигурация и секреты

1. Возьми `config/project.yaml` как начальный образец. Прочитай настройки через типизированный валидатор; опиши понятные ошибки при некорректных полях. **Никогда не помещай** токены, SSH-ключи, пароли, webhook secret в YAML или Git.
2. Добавь `.env.example`, `.gitignore`, `.dockerignore` и убедись, что `.env.local`, `.vercel`, `.runtime`/`tmp`, `.terraform`, `node_modules`, build output игнорируются.
3. Два полностью разных Telegram-токена: dev и prod. Локальный запуск не должен вообще нуждаться в production токене.
4. Все изменения конфигурации объясняй обычными словами; если агент может внести их сам, делай это сам.

### D. Docker Compose — маленькие образы и автоостановка

1. Реализуй `deploy/local/compose.yaml` и нужный Dockerfile с `node:24-bookworm-slim` (проверь актуальный тег; по возможности digest), используй multi-stage если это помогает. Не используй полный `node:24` без причины; минимальный runtime без ненужных утилит, non-root, лимиты CPU/RAM. Никакого опасного `docker.sock` в контейнере.
2. Docker Compose запускает **только development-бота**, который читает dev token из локального ignored env; для этого токена — `polling`, без публичного порта и туннеля. Docker сам по себе не требует VPS/SSH.
3. Реализуй простые скрипты `pnpm dev:up`, `pnpm dev:stop`, `pnpm dev:status`, `pnpm dev:logs` с понятными сообщениями по-русски. Запуск — одной командой. `dev:up` должен быть идемпотентным.
4. Реализуй host-side idle watchdog, который при отсутствии **входящих сообщений/нажатий** 120 минут останавливает **только этот Compose project**, а не все контейнеры пользователя. Polling и таймеры/healthchecks не считаются активностью. Таймаут и интервал берутся из YAML. Независимо от idle предусмотрен разумный максимальный срок сессии, например 8 часов; watchdog не должен умирать при закрытии терминала и не должен дублироваться при повторном `dev:up`.
5. Используй локальный activity timestamp, записываемый при значимом Telegram update; обновляй его без гонок и с учётом прав на запись. Watchdog держи снаружи Docker, с безопасным PID/lock и ограниченной зоной действия. Если по реально обнаруженной ОС надёжный detached host watchdog не выходит, вместо имитации реализуй понятный безопасный time-limited fallback и честно укажи ограничение.
6. Тестируй watchdog на коротком idle timeout автоматически/интеграционно (по возможности), не дожидаясь 2 часов. Не выполняй `docker system prune` и не останавливай чужие контейнеры.

### E. Директория `deploy` и расширяемость

Создай и задокументируй:

```text
deploy/
  local/                # compose, Dockerfile, local operation
  vercel/               # Vercel instructions, webhook scripts/reference
  vps/                  # future IsHosting deployment via `ssh deploy`
  cloudflare-tunnel/    # future dev webhook using owned domain
  terraform/            # future IaC; .gitkeep if empty
```

- Для Vercel опиши подключение GitHub, production branch `master`, Node.js runtime, безопасное внесение prod env secrets, URL `/api/telegram`, шаги установки webhook.
- **Не запускай** деплой на VPS, Cloudflare Tunnel или Terraform. В соответствующих директориях оставь минимальные README с требованиями и точками расширения, без заготовок, которые автоматически изменят чужую инфраструктуру.
- `config/project.yaml` должен предусматривать `ssh_alias: deploy`, будущий домен туннеля и переключатель транспорта dev-бота. Для туннеля не нужно никакого реального DNS-записи на данном этапе.

### F. GitHub CI/CD без автоматического dev-деплоя

1. Добавь `.github/workflows/ci.yml`, запускаемый для PR в `development` и `master`; checks: frozen install, format, ESLint, TypeScript, Vitest, build.
2. Не добавляй workflow автодеплоя на `development` и на VPS — это будущая задача.
3. Для production выбери **один** механизм: Git-интеграция Vercel отслеживает **`master`** и деплоит **после фактического merge** PR (push в master), **не при открытии PR**. Не добавляй дублирующий production deploy через GitHub Actions.
4. Vercel Git integration по умолчанию может делать preview для PR/других веток. Предусмотри настройку `Only build production`/эквивалент для v1 или безопасный preview без prod secrets; задокументируй проверку, что production bot token недоступен в preview.
5. GitHub Settings: `master` защищён через branch protection/ruleset (PR required, status checks required, block force push/deletion; без админ-bypass по возможности), желательно ограничить маршрут релиза через PR `development` → `master`; `development` тоже лучше защитить PR/checks, если это совместимо с выбранным тарифом. **GitHub Actions не могут самостоятельно заменить branch protection**. Если возможно настроить правила через `gh` с разрешением пользователя — настрой; иначе предоставь точные клики и критерии проверки. Не утверждай, что прямой push запрещён, пока не проверил правило.
6. Не мержи PR сам без согласия; не пушь напрямую в `master`.

### G. Тесты, документация и завершение

1. Автотесты на обработчики `/start`, `/help` и inline callback, валидацию YAML/env, webhook security, ошибки, watchdog/timeouts. Mock Telegram API.
2. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `docker compose -f deploy/local/compose.yaml config` и dev smoke при доступном Docker.
3. `README.md` на русском, минимально технический: что умеет бот, как начать работу, где взять dev token через BotFather (без просьбы прислать токен в чат), как стартует и *сам* останавливается Docker, как сделать ручной smoke test, как выпускать релиз через PR.
4. Укажи в документации, какие внешние действия ещё **не сделаны**: подключение репозитория, создание двух ботов, ввод env secrets, GitHub rules, Vercel project, вебхук, домен.
5. Отчитайся по-русски: какие файлы созданы, какие проверки действительно прошли, какие были пропущены, что пользователь должен сделать лично (если нужно), PR/commit SHA. В явных ручных шагах следуй формату из skill.

## Приёмка (checklist для агента)

- [ ] Строгий TypeScript, нет `any`, modular architecture, 2 entrypoints (polling/webhook)
- [ ] Разные dev/prod bot tokens, production webhook with secret header check
- [ ] Local Compose runs with small Node image, self-stops after idle; no other Docker containers affected
- [ ] No secrets in repository, validated YAML config
- [ ] Git `master`/`development`/`feat`, CI PR checks, no automatic dev deploy
- [ ] No uncontrolled production/VPS deployment, plans reserved for VPS/tunnel/Terraform
- [ ] Tests run or clearly marked unavailable
- [ ] Every required user action written in nontechnical Russian with success/error cues

---
name: telegram-bot-engineering
# Used by Codex when building/maintaining this project. Keep the description specific.
description: Design, implement, test, review and deploy the project's modular TypeScript/grammY Telegram bot using Docker Compose locally, Vercel Functions in production and GitHub PR workflows; explain unavoidable manual tasks to a non-technical Russian-speaking operator.
---

# Telegram bot engineering skill

Use for all work on this Telegram bot, including new features, debugging, tests, CLI setup, Git/GitHub, deployment, containers and infrastructure. Respect `AGENTS.md` at the repository root. Treat this skill as **durable engineering rules**; the task file specifies what to implement in a particular iteration.

## 1. Operator UX — highest priority

The person requesting changes is comfortable describing desired functionality but **not** with technical administration. The agent owns operational complexity.

1. First inspect the project and available tools. Perform ordinary tasks autonomously if authorized. Do not ask the person to type `docker ps`, `git status`, `ssh-add`, configure YAML, or debug logs when you can do these things yourself.
2. If manual intervention is unavoidable, use this exact response pattern (in Russian):

   **🔴 ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ — <понятная цель>**
   - **Зачем:** one sentence, non-jargon.
   - **Что сделать:** app to open, where to click or **how to open the terminal**, then one exact command to copy/paste, if needed.
   - **Если получилось:** exact recognizable UI indication or safe sample terminal output.
   - **Если не получилось:** likely error, what to screenshot/copy back, and what **not** to share (tokens, private keys, passwords).
   - **Как продолжить:** what the agent will check next.

3. Never combine multiple unrelated manual tasks in an opaque checklist. Do not say merely “configure SSH”, “create webhook”, “add secret”, “check Docker” or “run migration”. Translate each to concrete UI actions.
4. Explain the difference between a bot's public `@username` and its **secret token**. Tell the operator to input secrets only into a secure local or provider secret field. Never request sensitive content in chat.
5. After changes, produce a short user-facing summary with: functionality delivered, tests run and their pass/fail status, deployment status and any outstanding manual step. Do not mask skipped tests.

## 2. Stack and engineering standard

- TypeScript on Node.js **24.x** (pin major via `package.json` `engines`; match Docker and Vercel), `pnpm`, `grammY`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `noEmitOnError` as appropriate. No `any`, `as any`, `@ts-ignore` or unsafe blanket assertions. Prefer `unknown`, discriminated unions, type guards and schemas.
- Keep dependencies minimal. Use ESLint with TypeScript rules, Prettier, Vitest; use Zod at env/config and external-data boundaries. Commit the lockfile. Avoid unnecessary web frameworks (Express/Fastify/Nest) solely to receive one Telegram webhook.
- Separate pure business logic from grammY and runtime/platform adapters; use dependency injection for services. Encapsulate external API clients. No direct `process.env` in arbitrary domain or feature files.
- Log useful structured events and errors without including message text, PII or tokens by default. Fail fast on bad configuration. Handle retries, callback acknowledgments, command errors and rate limits. Avoid accumulating sessions exclusively in memory for production.
- Keep comments about *why* a non-obvious decision exists, not narration of trivial code.
- Prefer pragmatic module boundaries; don't create dozens of empty abstractions or stub database layers before needed.

## 3. Environments and Telegram transport

**Production:** separate production Telegram bot token, HTTPS webhook on Vercel **Node.js runtime**, e.g. `api/telegram.ts`. Validate `X-Telegram-Bot-Api-Secret-Token` against an environment secret using a proper comparison; reject missing/invalid headers with non-200 status. Route only POST requests to the bot. Use appropriate grammY `webhookCallback` adapter for selected Node.js handler and test it; choose current APIs from official docs. Never create a permanent background process inside a Vercel Function.

**Development (initial):** separate **development Telegram bot**, local Docker Compose + grammY `bot.start()` long polling. Do not use the production token for local development. Ensure only one polling process consumes the dev bot's updates; detect a preexisting webhook and offer a safe, explicit switch for the **dev token only**. No public port/tunnel necessary for polling. Telegram cannot use polling and webhook simultaneously **for the same bot token**.

**Optional development webhook (later):** Cloudflare Tunnel using an existing domain (host/subdomain specified in non-secret YAML) **or** a persistent dev webhook endpoint on IsHosting VPS (`ssh deploy`). Implement only when asked, with HTTPS, authorization and secret validation; switching the same dev bot between polling and webhook requires explicit handling of `deleteWebhook`/`setWebhook` and a documented rollback.

- Never send production credentials to Vercel Preview deployments. Watch defaults of the Vercel Git integration: it can deploy every branch/PR automatically; previews should be disabled/ignored or have safely isolated test credentials and no production webhook registration.
- Configure production webhook **only after** a successful production deployment and explicit authorization. Use a script that reads secrets locally, posts to Telegram via HTTPS, and verifies `getWebhookInfo`, without printing sensitive tokens or putting them in visible browser URLs.
- If processing risks exceeding a request deadline, design a durable queue/worker, idempotency (`update_id`), retries and monitoring rather than relying on `setTimeout` or fire-and-forget work after the serverless response. Keep the initial scaffold simple.

## 4. Docker — minimal and self-cleaning

- Use a supported small image: `node:24-bookworm-slim` is the safe default, ideally **pinned by digest** after verifying the current digest. Consider `node:24-alpine` only if native dependencies and libc compatibility are proven. Use multi-stage builds, `.dockerignore`, non-root execution, explicit resource limits, lockfile-based install (`pnpm install --frozen-lockfile`). Smaller images affect disk/pull/start-up; they do not, by themselves, eliminate memory usage.
- Local development MUST be started using a single documented wrapper (e.g., `pnpm dev:up`), not an unexplained sequence of Docker commands. Wrapper handles prerequisites, idempotent start and an **independent host-side idle watcher**.
- Compose project name must be **unique and fixed to this repository**. All stop commands must target only this Compose project. No `docker system prune`, `docker stop $(docker ps -q)`, whole-Docker shutdown, or Docker socket mounted inside application containers.
- `config/project.yaml` has `development.docker.idle_timeout_minutes` (default 120), `check_interval_seconds` and optional `max_session_hours` (e.g. 8). Inactivity means **no meaningful Telegram update received by local dev bot** since last activity; Telegram's network polling is not user activity. On startup initialize activity time; on message/callback update it. Tests and dev requests can explicitly refresh activity via a script if needed. Watchdog checks status periodically and runs project-specific `docker compose down` when idle; also enforces a maximum lifetime as a safety net. It MUST survive shell closure, be restart-safe (one watcher only), and not kill other projects. Prefer host-side Node.js background process or a user-level scheduler; support the actual workstation OS after checking it.
- Add `pnpm dev:stop`, `pnpm dev:status` and `pnpm dev:logs`, with safe commands and clear Russian feedback. Show when containers stop automatically. `dev:status` should report both Docker and watchdog status in normal language. `dev:up` after shutdown brings bot back.
- Validate watchdog logic by unit testing time calculations and by a small integration check with a short idle timeout. If reliable idle monitoring is not possible on the detected machine, use a **documented time-limited safety fallback**, visibly mark the limitation and do not claim true idle detection.

## 5. Repository & GitHub workflow

- Default branch is `master` (rename existing `main` **safely**, coordinate remote default/branch protections; do not rewrite shared history).
- Persistent integration branch: `development`.
- Every task: start from `development`, create `feat/<slug>`, `fix/<slug>` or `refactor/<slug>`, commit the changes, push the feature branch only when GitHub permissions and remote are ready, then open a PR **to `development`** via `gh`. Do not merge it without authorization.
- Release: PR `development` → `master`; merge via GitHub only after checks and explicit user approval. Never direct-push or local-merge to `master`.
- Set up CI on PRs to `development` and `master`: typecheck, lint, format check, unit tests, build. Do not create an automatic deployment for `development` in v1.
- Production deployment should follow **merge into `master`** via Vercel Git integration. Do not deploy production on merely opening a PR. Keep deployment settings described in `deploy/vercel/README.md` and verify Vercel's configured Production Branch is `master`.
- Request GitHub branch protection/ruleset for `master` (require PR, passing checks; no forced pushes/deletes, no bypass where available) and optionally `development`. A workflow YAML alone **cannot prevent direct push**; enforcement is in GitHub repository settings, subject to GitHub plan/repository limitations. If agent has permitted authenticated access and authorization, configure it; otherwise provide exact UI steps.
- Use `gh auth status`, `gh repo view`, `gh pr ...` as appropriate; do not assume authentication until verified. Never overwrite the user's repository/remote.

## 6. Architecture & planned adapters

Suggested baseline (adjust only when requirements justify it):

```text
api/telegram.ts                  # very thin Vercel function adapter
src/app/create-bot.ts            # composition root for grammY bot
src/bot/commands/                # Telegram commands
src/bot/callbacks/               # button callbacks
src/bot/keyboards/               # keyboard builders
src/domain/                      # business rules, pure TS
src/services/                    # application use cases
src/infrastructure/config/       # parsing and typed config
src/infrastructure/telegram/     # API abstractions where needed
src/entrypoints/polling.ts       # local development runtime only
src/shared/                      # small reused utilities
src/__tests__/ or colocated *.test.ts
config/project.yaml              # non-secrets
api/                             # deployable Vercel entrypoints only
deploy/local/                    # Compose + Dockerfile
deploy/vercel/                   # Vercel operations docs/config aids
deploy/vps/                      # reserved for SSH alias `deploy`
deploy/cloudflare-tunnel/        # reserved, no tunnel in v1
deploy/terraform/                # reserved, no Terraform apply in v1
scripts/                         # safe developer wrappers and webhook scripts
.github/workflows/ci.yml         # checks only
```

`vercel.json`, if needed, belongs at **project root**, not buried under `deploy/vercel`; keep documentation and helper scripts inside the latter. Avoid broad rewrites or a heavy monorepo for a single small bot.

## 7. Test strategy and definition of done

**Unit:** pure domain logic, command handlers with mocked Telegram API, YAML/env schema validation, error paths, helper functions and watchdog clock logic.

**Adapter/integration:** simulate webhook HTTP POST (valid, missing and wrong secret, non-POST, malformed update); verify Telegram API calls are mocked, no live Bot API. Compose configuration validation and a local start/stop/timeout smoke test when Docker is accessible.

**Manual dev smoke:** run development bot locally in polling mode, send `/start` and a sample button via Telegram, confirm responses, wait/test idle auto-stop; use an isolated dev bot token, not production. Give the operator concrete steps if agent cannot interact with Telegram.

**Production smoke:** only after permission, deploy master, set webhook, query `getWebhookInfo`, send `/start` to production bot, monitor errors without leaking tokens.

For every PR: install with frozen lockfile, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` (scripts must exist); explain skipped validations. Prefer automated tests to “works on my machine”.

## 8. Guardrails / scope

Never make unrequested payments, delete existing unrelated resources, rotate keys, change public DNS, expose ports, deploy to the VPS, apply Terraform or flip production webhooks without approval. If external connection is unavailable, deliver complete code/config, report what was verified locally and give one clear next action to the user. The current task's explicit scope supersedes speculative future features, but not these safety constraints.

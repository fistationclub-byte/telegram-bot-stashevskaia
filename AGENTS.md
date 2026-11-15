# Instructions for coding agents

This repository contains a Telegram bot written in TypeScript. The primary operator is a **non-technical Russian-speaking user**. Read this file at the beginning of every task. For Telegram development, deployment, testing, or Git operations, also follow `.agents/skills/telegram-bot-engineering/SKILL.md`.

## Working with the user

- Respond in **Russian**, with short, understandable explanations. Do not assume familiarity with terminals, SSH, environment variables, Git, Docker or cloud consoles.
- **Do all authorized work yourself using your tools** when technically possible: editing files, invoking commands, running tests, inspecting Docker status, creating commits and PRs via `gh`. Do not outsource routine commands to the user.
- Every unavoidable manual step must appear in a conspicuous **`🔴 ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ`** block. Include: purpose; exact app/page or how to open a terminal; a copyable command or click sequence; what success looks like; common failure and what to send back; a warning if a secret is involved. Explain one action at a time where possible.
- Never request a user to paste a bot token, private SSH key, password, webhook secret, or other credentials into chat. Explain how to add it securely to the local ignored `.env.local`, Vercel secrets, or GitHub secrets. Do not print secrets in logs or status output.
- When a step requires authorization, billing, creating externally visible resources, changing DNS, granting permissions, production deployment, or destructive operations, ask for a clear approval before performing it. Don't claim success without verifying it.
- A task description may include nontechnical wishes. Convert them to acceptance criteria without overwhelming the user; ask questions only when critical to avoid wrong or risky behavior. Otherwise proceed with reasonable defaults and document assumptions.
- Finish with: what changed (plain Russian), test results, what the user needs to do (if anything), any URL/PR, and remaining limitations. Say explicitly if steps were not performed.

## Invariants

- TypeScript strict, **no `any`** (including `as any`), explicit boundary validation, sound types, modular architecture, small functions and focused modules.
- Node.js 24.x LTS, pnpm with committed lockfile, grammY, Vitest, ESLint, Prettier; use Zod for runtime validation at untrusted boundaries when appropriate. Avoid framework proliferation.
- Production: **Vercel Node.js Functions**, Telegram **webhook**, never long polling. Local development: Docker Compose with a **separate development bot token** and long polling by default. No secret/shared state between environments.
- Keep framework entry points thin; put Telegram orchestration in `src/bot`, business rules in `src/domain`, integrations in `src/infrastructure`. No flat pile of files, no global mutable conversation state.
- Use minimal, supported Docker images (prefer pinned `node:24-bookworm-slim` with digest for reproducibility, multi-stage production images); no bloated full default Node image. Evaluate Alpine only after compatibility testing. `.dockerignore` required.
- Docker development sessions must stop automatically after configured inactivity. Watchdog runs **on the host** and scopes `docker compose down` to this project's unique Compose project name. Never mount `/var/run/docker.sock` into a container just to perform shutdown. Do not stop unrelated containers.
- Git branches: production `master` (not `main`); integration `development`; work on `feat/*`, `fix/*`, `refactor/*`. Code flows feature → PR to `development` → PR from `development` to `master`. Never push directly to `master`; no direct merges to `master` in a local clone. Use `gh` when authenticated.
- CI: lint, format, typecheck, tests, build on PRs to `development` and `master`. **No automatic deployment for `development` in v1**. Production deployment after merge into `master`, preferably via Vercel Git integration; no second duplicate deploy mechanism.
- Treat Vercel previews as **unsafe for production tokens**. Configure preview env without production `BOT_TOKEN` or skip previews, and never register preview URLs as the production bot webhook.
- Only production on Vercel at first. Reserve infrastructure under `deploy/vercel`, `deploy/local`, `deploy/vps`, `deploy/cloudflare-tunnel`, `deploy/terraform`. Do not deploy to VPS or provision Terraform until explicitly requested.
- VPS SSH alias `deploy` is already configured in the operator's `~/.ssh/config` and is expected to refer to IsHosting. Verify the SSH host identity before use. Never assume that a command on the VPS is safe; don't modify unrelated services.
- `config/project.yaml` contains **non-secret** application/environment settings. Secrets live in ignored environment files or platform secret stores, with a `.env.example` documenting names only.
- Prefer tests with mocked grammY API and webhook/request adapters; tests must not contact real Telegram unless they are clearly labeled manual integration tests.

If a task asks to violate an invariant, identify the conflict and seek specific user approval instead of silently breaking it.

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const identifier = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const botToken = z.string().regex(/^\d+:[A-Za-z0-9_-]+$/);
export const webhookSecret = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);

const projectSchema = z
  .object({
    project: z.object({
      name: z.string().min(1),
      language: z.literal("ru"),
      node_major: z.literal(24),
      package_manager: z.literal("pnpm"),
    }),
    git: z.object({
      production_branch: z.literal("master"),
      integration_branch: z.literal("development"),
      feature_prefixes: z.array(z.string()).min(1),
      github_repository: z.string(),
      remote_name: z.literal("origin"),
    }),
    development: z.object({
      telegram: z.object({
        transport: z.literal("polling"),
        display_name: z.string(),
        username: z.string(),
        token_env: identifier,
      }),
      docker: z.object({
        compose_project_name: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
        idle_timeout_minutes: z.number().positive(),
        check_interval_seconds: z.number().positive(),
        max_session_hours: z.number().positive(),
      }),
      webhook: z.object({
        transport: z.literal("none"),
        public_hostname: z.string(),
      }),
    }),
    production: z.object({
      telegram: z.object({
        transport: z.literal("webhook"),
        display_name: z.string(),
        username: z.string(),
        token_env: identifier,
        webhook_secret_env: identifier,
        webhook_path: z.literal("/api/telegram"),
      }),
      hosting: z.object({ provider: z.literal("vercel"), region: z.string() }),
    }),
    infrastructure: z.object({
      vps: z.object({ ssh_alias: z.literal("deploy") }),
      terraform: z.object({ enabled: z.literal(false) }),
    }),
  })
  .refine(
    (config) =>
      new Set([
        config.development.telegram.token_env,
        config.production.telegram.token_env,
        config.production.telegram.webhook_secret_env,
      ]).size === 3,
    {
      path: ["production", "telegram"],
      message: "Нужны разные переменные для dev, prod и webhook",
    },
  );

export function parseProject(source: string) {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch {
    throw new Error("Проверьте синтаксис config/project.yaml");
  }
  const result = projectSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      "Проверьте config/project.yaml: " +
        result.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  }
  return result.data;
}

export function loadProject() {
  return parseProject(readFileSync("config/project.yaml", "utf8"));
}

export function readSecret(name: string, schema: z.ZodType<string>) {
  const result = schema.safeParse(process.env[name]);
  if (!result.success) throw new Error(`Проверьте переменную ${name}`);
  return result.data;
}

export function loadToken(
  mode: "development" | "production",
  config = loadProject(),
) {
  return readSecret(config[mode].telegram.token_env, botToken);
}

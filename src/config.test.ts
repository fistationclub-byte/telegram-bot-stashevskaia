import { expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { loadToken, parseProject } from "./config.js";

const source = readFileSync("config/project.yaml", "utf8");

test("проверяет конфигурацию и указывает путь некорректного поля", () => {
  expect(parseProject(source).project.node_major).toBe(24);
  expect(() =>
    parseProject(source.replace("node_major: 24", "node_major: 20")),
  ).toThrow("project.node_major");
});

test("dev-токен не требует prod-токена", () => {
  vi.stubEnv("TELEGRAM_DEV_BOT_TOKEN", "123:fake-token");
  vi.stubEnv("TELEGRAM_PROD_BOT_TOKEN", undefined);
  try {
    expect(loadToken("development")).toBe("123:fake-token");
    expect(() => loadToken("production")).toThrow("TELEGRAM_PROD_BOT_TOKEN");
  } finally {
    vi.unstubAllEnvs();
  }
});

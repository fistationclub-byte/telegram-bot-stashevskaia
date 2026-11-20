import { expect, test } from "vitest";
import { stopReason } from "./local.mjs";

const settings = { idle_timeout_minutes: 0.001, max_session_hours: 1 };

test("останавливается по истечении короткого периода бездействия", () => {
  expect(stopReason(59, 0, 0, settings)).toBeUndefined();
  expect(stopReason(60, 0, 0, settings)).toBe("нет активности");
  expect(stopReason(60, 30, 0, settings)).toBeUndefined();
});

test("останавливается после максимального срока даже при активности", () => {
  expect(stopReason(3_600_000, 3_600_000, 0, settings)).toBe("лимит сессии");
});

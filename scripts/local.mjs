import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export function stopReason(now, activity, started, settings) {
  if (now - started >= settings.max_session_hours * 3_600_000)
    return "лимит сессии";
  if (now - activity >= settings.idle_timeout_minutes * 60_000)
    return "нет активности";
}

async function main() {
  process.chdir(fileURLToPath(new URL("../", import.meta.url)));
  const { docker: settings, telegram } = (
    await import("../src/config.ts")
  ).loadProject().development;
  const pidFile = ".runtime/watchdog.pid";
  const activityFile = ".runtime/activity";
  const stopFile = ".runtime/watchdog.stop";
  const plugin = spawnSync("docker", ["compose", "version"], {
    stdio: "ignore",
  });
  const standalone = plugin.status !== 0;
  if (
    standalone &&
    spawnSync("docker-compose", ["version"], { stdio: "ignore" }).status !== 0
  ) {
    throw new Error("Docker Compose недоступен.");
  }
  const composeCommand = standalone ? "docker-compose" : "docker";
  const composeArgs = [
    ...(standalone ? [] : ["compose"]),
    "-f",
    "deploy/local/compose.yaml",
    "-p",
    settings.compose_project_name,
  ];
  if (existsSync(".env.local")) composeArgs.push("--env-file", ".env.local");
  const env = {
    ...process.env,
    BOT_TOKEN_ENV: telegram.token_env,
    BOT_UID: String(process.getuid()),
    BOT_GID: String(process.getgid()),
  };
  const compose = (...args) =>
    spawnSync(composeCommand, [...composeArgs, ...args], {
      stdio: "inherit",
      env,
    }).status === 0;

  const action = process.argv[2];
  const monitorState = () => {
    if (!existsSync(pidFile)) return "off";
    try {
      const pid = Number(readFileSync(pidFile, "utf8"));
      if (!Number.isSafeInteger(pid) || pid <= 0) return "starting";
      process.kill(pid, 0);
      return "running";
    } catch (error) {
      if (error.code === "ENOENT") return "off";
      if (error.code === "ESRCH") return "stale";
      if (error.code === "EPERM") return "running";
      throw error;
    }
  };
  if (action === "ps" || action === "logs") {
    if (action === "ps") {
      const state = monitorState();
      console.log(
        {
          off: "Наблюдатель выключен",
          running: "Наблюдатель работает",
          starting: "Наблюдатель запускается",
          stale: "Запись о наблюдателе устарела",
        }[state],
      );
    }
    if (!compose(action)) process.exitCode = 1;
    return;
  }
  if (action === "stop") {
    const state = monitorState();
    if (state === "off" || state === "stale") {
      if (!compose("down")) process.exitCode = 1;
      return;
    }
    writeFileSync(stopFile, "", { mode: 0o600 });
    const deadline = Date.now() + 30_000;
    while (existsSync(pidFile) && Date.now() < deadline) await delay(250);
    if (existsSync(pidFile)) {
      throw new Error(
        "Остановка ещё не подтверждена. Проверьте .runtime/watchdog.log.",
      );
    }
    console.log("Dev-бот остановлен.");
    return;
  }
  if (action === "up") {
    if (!existsSync(".env.local"))
      throw new Error("Заполните TELEGRAM_DEV_BOT_TOKEN в .env.local.");
    mkdirSync(".runtime", { recursive: true, mode: 0o700 });
    const log = openSync(".runtime/watchdog.log", "a");
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "watch"],
      {
        detached: true,
        stdio: ["ignore", log, log, "ipc"],
      },
    );
    closeSync(log);
    await new Promise((resolve, reject) => {
      child.once("message", (message) => {
        child.disconnect();
        child.unref();
        if (message === "ready") resolve();
        else reject(new Error(String(message)));
      });
      child.once("error", reject);
      child.once("exit", () =>
        reject(new Error("Проверьте .runtime/watchdog.log")),
      );
    });
    console.log("Dev-бот запущен под наблюдением. Логи: pnpm dev:logs");
    return;
  }
  if (action !== "watch" || !process.send)
    throw new Error("Неизвестная команда.");

  let lock;
  try {
    lock = openSync(pidFile, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const state = monitorState();
    if (state === "running") process.send("ready");
    else if (state === "stale") {
      process.send(
        "Осталась запись о завершившемся наблюдателе. После pnpm dev:stop удалите .runtime/watchdog.pid и повторите запуск.",
      );
    } else {
      process.send(
        "Состояние наблюдателя меняется. Повторите команду через несколько секунд.",
      );
    }
    return;
  }

  try {
    if (existsSync(stopFile)) unlinkSync(stopFile);
    writeFileSync(lock, String(process.pid));
    closeSync(lock);
    closeSync(openSync(activityFile, "a", 0o600));
    const started = Date.now();
    utimesSync(activityFile, new Date(started), new Date(started));
    if (!compose("up", "-d", "--build")) {
      process.send(
        "Docker не смог запустить бота. Подробности в .runtime/watchdog.log",
      );
      return;
    }
    process.send("ready");

    let nextCheck = started + settings.check_interval_seconds * 1_000;
    for (;;) {
      await delay(250);
      if (existsSync(stopFile) && compose("down")) return;
      const now = Date.now();
      if (now < nextCheck) continue;
      nextCheck = now + settings.check_interval_seconds * 1_000;
      const reason = stopReason(
        now,
        statSync(activityFile).mtimeMs,
        started,
        settings,
      );
      if (reason && compose("down")) {
        console.log(`Dev-бот остановлен: ${reason}`);
        return;
      }
      const status = spawnSync(
        composeCommand,
        [...composeArgs, "ps", "--status", "running", "-q"],
        { encoding: "utf8", env },
      );
      if (status.status === 0 && !status.stdout.trim()) return;
    }
  } finally {
    if (existsSync(stopFile)) unlinkSync(stopFile);
    unlinkSync(pidFile);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

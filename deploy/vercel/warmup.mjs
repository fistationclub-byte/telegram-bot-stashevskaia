import { loadWarmupContent } from "../../dist/src/bot/warmup.js";
import { openWarmupStore } from "../../dist/src/infrastructure/warmup.js";

const action = process.argv[2];
const url = process.env.WAITLIST_DATABASE_URL;
if (!url || !["init", "pause", "resume"].includes(action)) {
  console.error(
    "Нужен защищённый адрес базы и команда init, pause или resume.",
  );
  process.exit(1);
}

const store = openWarmupStore(url);
try {
  if (action === "init") {
    await store.initialize();
    console.log("Хранилище цепочки подготовлено.");
  } else if (action === "pause") {
    await store.pause();
    console.log("Цепочка приостановлена.");
  } else {
    loadWarmupContent();
    await store.resume();
    console.log("Цепочка возобновлена.");
  }
} catch {
  console.error(
    "Не удалось выполнить команду. Проверьте подключение, таблицы и материалы цепочки.",
  );
  process.exitCode = 1;
} finally {
  await store.close();
}

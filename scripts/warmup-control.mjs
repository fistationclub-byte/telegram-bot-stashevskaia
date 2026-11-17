import { loadWarmupContent } from "../dist/src/bot/warmup.js";
import { openBotStore } from "../dist/src/infrastructure/bot-store.js";
import { supabaseConfig } from "../dist/src/infrastructure/database.js";
import { openWarmupStore } from "../dist/src/infrastructure/warmup.js";

const action = process.argv[2];
if (action !== "pause" && action !== "resume") {
  console.error("Укажите pause или resume.");
  process.exit(1);
}
const config = supabaseConfig();
const warmup = openWarmupStore(config);
const bot = openBotStore(config);
try {
  if (action === "pause") await warmup.pause();
  else {
    loadWarmupContent(await bot.texts());
    await warmup.resume();
  }
  console.log(
    action === "pause" ? "Цепочка приостановлена." : "Цепочка возобновлена.",
  );
} catch {
  console.error("Не удалось изменить режим. Проверьте базу и материалы.");
  process.exitCode = 1;
} finally {
  await Promise.all([warmup.close(), bot.close()]);
}

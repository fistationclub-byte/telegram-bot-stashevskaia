import { openProductionWaitlist } from "../../src/infrastructure/waitlist.ts";

const url = process.env.WAITLIST_DATABASE_URL;
if (!url) {
  console.error("Укажите WAITLIST_DATABASE_URL в защищённой конфигурации.");
  process.exit(1);
}

const storage = openProductionWaitlist(url);
try {
  await storage.initialize();
  console.log("Таблица предзаписи готова.");
} catch {
  console.error("Не удалось подготовить таблицу предзаписи.");
  process.exitCode = 1;
} finally {
  await storage.close();
}

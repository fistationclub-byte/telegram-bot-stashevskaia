import { build } from "esbuild";

await build({
  entryPoints: ["src/edge/telegram.ts"],
  outfile: "supabase/functions/telegram-bot/handler.js",
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  packages: "external",
});

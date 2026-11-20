import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "supabase/functions/telegram-bot/handler.js",
      ".runtime/**",
      ".vercel/**",
    ],
  },
  ...tseslint.configs.recommended,
];

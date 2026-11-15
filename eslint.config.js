import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", ".runtime/**", ".vercel/**"] },
  ...tseslint.configs.recommended,
];

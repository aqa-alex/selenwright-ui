import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["server.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["playwright.config.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["tests/e2e/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

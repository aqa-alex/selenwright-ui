import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vuePlugin.configs["flat/recommended"],
  {
    files: ["server.mjs", "server-*.mjs", "scripts/**/*.mjs", "playwright.config.mjs"],
    languageOptions: {
      globals: globals.node,
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
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
    },
  },
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  {
    files: ["tests/unit/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tseslint.parser,
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "vendor/**", "test-results/**"],
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.vue", "tests/unit/**/*.ts"],
    rules: {
      // TypeScript handles unused detection; the base rule flags type-only params.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

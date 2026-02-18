// eslint.config.ts
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import jsonc from "eslint-plugin-jsonc";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist", "build", "node_modules", "coverage", "logs", "package-lock.json", "*.log"],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "no-var": "error",
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-require-imports": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Browser scripts - shared base config
  {
    files: ["src/web/public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
    },
  },

  // api.js - defines shared globals, so suppress unused-vars and no-redeclare
  {
    files: ["src/web/public/js/api.js"],
    rules: {
      "no-unused-vars": "off",
    },
  },

  // Page scripts - consume globals from api.js and CDN libs
  {
    files: [
      "src/web/public/js/dashboard.js",
      "src/web/public/js/memories.js",
      "src/web/public/js/snippets.js",
      "src/web/public/js/agents.js",
    ],
    languageOptions: {
      globals: {
        // From api.js
        api: "readonly",
        renderTags: "readonly",
        escapeHtml: "readonly",
        formatDate: "readonly",
        truncate: "readonly",
        isExpiringSoon: "readonly",
        setupModalClose: "readonly",
        debounce: "readonly",
        // CDN libraries
        marked: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^(handle|open|close|bulk|toggle|view|navigate|load)" },
      ],
    },
  },

  // JSON files
  ...jsonc.configs["flat/recommended-with-jsonc"],
  {
    files: ["**/*.json"],
    rules: {
      "jsonc/no-comments": "error",
    },
  },

  eslintPluginPrettierRecommended,
]);

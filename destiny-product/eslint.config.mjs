import { defineConfig, globalIgnores } from "eslint/config";
import { readFileSync } from "node:fs";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { englishOnlyRule } from "./scripts/eslint/rules/english-only.mjs";

const exemptionLedger = readFileSync(new URL("./DB_EXEMPTIONS.md", import.meta.url), "utf8");
const databaseExemptions = [...exemptionLedger.matchAll(/^\| `([^`]+)` \|/gm)]
  .map((match) => match[1].replaceAll("[", "[[]"));
const testFiles = ["**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db/**", "src/lib/supabase/**", ...databaseExemptions],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/lib/supabase/*", "@supabase/*"],
          message: "Use the typed scope in @/lib/db or add a reviewed row to DB_EXEMPTIONS.md.",
        }],
      }],
    },
  },
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/lib/notifications/**/*.{ts,tsx}",
    ],
    ignores: testFiles,
    plugins: { destiny: { rules: { "english-only": englishOnlyRule } } },
    rules: { "destiny/english-only": "error" },
    settings: { destinyEnglishOnlyEscape: "i18n-ok:" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agent/**",
    ".brain/**",
    "prisma/**/*.ts",
    "prisma/**/*.js",
    "scripts/**/*.ts",
    "scripts/**/*.js",
    "script_*.ts",
    "export_*.ts",
    "test_query_*.ts",
    "find_*.ts",
  ]),
]);

export default eslintConfig;

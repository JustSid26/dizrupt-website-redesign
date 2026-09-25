import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // ported verbatim from the original vanilla site; typed at their boundaries, not inside
    files: ["lib/engine/{shapes,edgeField,spiral,atmosphere,staticNoise,windowField}.ts"],
    rules: { "@typescript-eslint/ban-ts-comment": "off", "@typescript-eslint/no-unused-vars": "off", "@typescript-eslint/no-unused-expressions": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "*.js",
      "legacy/**",
      "*-lab/**",
      "mascot3d/**",
    ],
  },
];

export default eslintConfig;

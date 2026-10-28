import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.vite/**", "**/*.sqlite"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript already catches undefined identifiers; this rule only
      // produces false positives for ambient globals (console, process, ...)
      // without pulling in a separate `globals` package.
      "no-undef": "off"
    }
  }
);

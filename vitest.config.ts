import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "dist/**",
        "coverage/**",
        "tsup.config.ts",
        "vitest.config.ts",
        "commitlint.config.js",
      ],
    },
  },
});

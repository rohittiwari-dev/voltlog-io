import { defineConfig } from "tsup";

export default defineConfig([
  // Node.js entry — shims enabled so __dirname/__filename work in ESM
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "node18",
    shims: true,
  },
  // Browser-safe entry — no Node.js shims, no platform-specific built-ins.
  // splitting MUST be false so tsup never creates a shared chunk that could
  // pull in the esm_shims (fileURLToPath / __filename) from the index build.
  {
    entry: { client: "src/client.ts" },
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: false,
    outDir: "dist",
    platform: "browser",
    shims: false,
  },
]);

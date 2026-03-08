import { defineConfig } from "tsup";

export default defineConfig([
  // ── Node.js entry ────────────────────────────────────────────────────────
  // shims: true injects __dirname / __filename ESM compatibility for Node 18+.
  // splitting: true allows tsup to emit shared chunks, reducing total output size.
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

  // ── Browser / Client entry ────────────────────────────────────────────────
  // Uses an isolated outDir (dist/browser) so the chunk splitter never touches
  // the Node.js build artifacts. This means we can safely re-enable
  // splitting: true without risking the esm_shims chunk from the index build
  // being referenced by the browser bundle.
  //
  // shims: false + platform: "browser" ensures no Node.js polyfills are injected.
  {
    entry: { client: "src/client.ts" },
    format: ["cjs", "esm"],
    dts: true,
    splitting: true,
    sourcemap: false,
    outDir: "dist/browser",
    platform: "browser",
    shims: false,
    clean: false, // index build already ran clean
  },
]);

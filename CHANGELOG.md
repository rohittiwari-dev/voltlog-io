# voltlog-io

## 1.0.6

### Patch Changes

- fix: `voltlog-io/client` browser bundle no longer contains Node.js ESM shims (`fileURLToPath`, `__filename`) in v1.0.6. Root cause was `splitting: true` on the client tsup config — with both builds sharing the same `outDir`, the chunk splitter could reference the shim chunk emitted by the `index` (Node.js) build. Setting `splitting: false` on the client entry forces a self-contained bundle with no shared chunks, so the `esm_shims` injection never occurs.

## 1.0.5

### Patch Changes

- fix: `voltlog-io/client` browser entry no longer imports Node.js built-ins (`fileURLToPath` from `"url"`, `createRequire` from `"module"`). Split tsup config into two targets — `index` keeps `shims: true` / `target: "node18"`, while `client` uses `platform: "browser"` and `shims: false` to prevent tsup's ESM shim chunk from being emitted into the browser bundle.

## 1.0.4

### Patch Changes

- client side import added client entry point for browser-safe use

## 1.0.3

### Patch Changes

- ## ⚡ Performance Optimizations

  - **Replaced `cuid2` with native `crypto.randomUUID()`** — ID generation is now 10-100x faster. The package is now **zero runtime dependencies**.
  - **Added early level short-circuit** — Filtered-out log calls (e.g., `debug()` when level is `INFO`) now return in ~0.02μs instead of ~5μs, a **100-250x improvement** for dropped logs.
  - **Configurable `idGenerator`** — Set a custom ID function or `false` to disable entirely for maximum throughput.
  - **File transport date caching** — Date computation for rotation is cached with 1-second granularity, eliminating `new Date()` allocation on every write.

  ## 🚀 New Features

  ### Core Logger

  - **`setLevel(level)`** — Change the minimum log level at runtime without recreating the logger.
  - **`getLevel()`** — Get the current minimum log level.
  - **`isLevelEnabled(level)`** — Check if a level would produce output, useful to guard expensive metadata computation.
  - **`startTimer(level?)`** — Returns a timer object; call `timer.done('message', meta)` to auto-log elapsed `durationMs`.
  - **`removeMiddleware(middleware)`** — Remove a previously added middleware by reference (symmetric to `addMiddleware`).
  - **Error cause chain** — Errors with `Error.cause` (ES2022) are now recursively serialized up to 5 levels deep.

  ### OpenTelemetry Integration

  - **`otelTraceMiddleware()`** — Automatically picks up `traceId`, `spanId`, and `traceFlags` from the active OpenTelemetry span context. Works with SigNoz, Jaeger, Grafana Tempo. Uses `createRequire` pattern for optional `@opentelemetry/api` peer dependency.
  - **`otelTransport(options)`** — Sends logs to any OTLP HTTP/JSON endpoint (SigNoz, OTel Collector, etc.) with batching, severity mapping, and resource attributes. Zero SDK dependency — speaks OTLP protocol directly via `fetch()`.

  ### AsyncLocalStorage Context

  - **`asyncContextMiddleware()`** — Automatic context propagation across async boundaries using Node.js `AsyncLocalStorage`. Set context once with `runInContext({ requestId, userId }, handler)` and all downstream logs auto-include it. Eliminates manual `child()` logger threading.

  ### Ring Buffer Transport

  - **`ringBufferTransport(options)`** — In-memory circular buffer storing the last N entries. Query with `getEntries({ level, since, limit })` for debugging dashboards and diagnostic API endpoints.

  ### File Transport Enhancements

  - **Size-based rotation** — New `maxSize` option rotates log files when they exceed a byte threshold (e.g., 10MB), in addition to existing daily rotation.

  ### Loki Transport Enhancements

  - **Dynamic labels** — `dynamicLabels` option extracts Loki stream labels from each log entry for better query performance.
  - **Structured metadata** — `includeMetadata` option (default: `true`) includes `context`, `error`, and `correlationId` in the Loki payload.
  - **Retry with backoff** — `retry` + `maxRetries` options enable exponential backoff on transient Loki push failures.

  ## 🏗️ Architecture

  - **Zero runtime dependencies** — Removed `@paralleldrive/cuid2`. `@opentelemetry/api` is an optional peer dep.
  - **Tree-shaking enabled** — `splitting: true` in tsup config so unused transports/middleware are eliminated by bundlers.
  - **New exports** — `TimerResult`, `RingBufferTransport`, `RingBufferQueryOptions`, `OtelTransportOptions`, `OtelTraceMiddlewareOptions`, `AsyncContextResult`.

## 1.0.0

### Patch Changes

- updated name of transformer to transport and added coverage of total test cases to 95%^

### Minor Changes

- feat: added middleware (IP, user-agent, correlation-id, etc.) and transformers (Slack, Discord, Sentry, Datadog, etc.)

### Patch Changes

- 8af88a5: added middlewares, transformers, liniting for industry grade practice and contribution controll for commits

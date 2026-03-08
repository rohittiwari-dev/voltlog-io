/**
 * @module voltlog-io/client
 *
 * Browser-safe entry point — only includes APIs that work in all environments
 * (browsers, React, Next.js client components, edge runtimes, etc.).
 *
 * Use this import in client-side code:
 * ```ts
 * import { createLogger, consoleTransport } from 'voltlog-io/client';
 * ```
 *
 * Excluded (Node.js-only — use main `voltlog-io` entry on the server):
 * - fileTransport          → node:fs, node:path
 * - jsonStreamTransport    → NodeJS.WritableStream
 * - asyncContextMiddleware → node:async_hooks
 * - correlationIdMiddleware→ uses globalThis.crypto (safe), but conceptually request-scoped / server middleware
 * - redisTransport         → TCP socket Redis (ioredis)
 * - nodeHttpMappers        → Node.js IncomingMessage / ServerResponse concepts
 */

// ─── Level Utilities ─────────────────────────────────────────────
export { resolveLevel, shouldIncludeStack, shouldLog } from "./core/levels.js";
// ─── Core ────────────────────────────────────────────────────────
export { createLogger } from "./core/logger.js";
// ─── Types ───────────────────────────────────────────────────────
export {
  type AlertRule,
  type LogEntry,
  type LogError,
  type Logger,
  type LoggerOptions,
  LogLevel,
  type LogLevelName,
  LogLevelNameMap,
  type LogLevelValue,
  LogLevelValueMap,
  type LogMiddleware,
  type OcppExchangeMeta,
  type TimerResult,
  type Transport,
} from "./core/types.js";

// ─── Middleware (browser-safe) ───────────────────────────────────
export {
  type AiEnrichmentOptions,
  aiEnrichmentMiddleware,
  createOpenAiErrorAnalyzer,
} from "./middleware/ai-enrichment.js";
export { alertMiddleware } from "./middleware/alert.js";
export { createMiddleware } from "./middleware/create-middleware.js";
export {
  type DeduplicationOptions,
  deduplicationMiddleware,
} from "./middleware/deduplication.js";
// heapUsageMiddleware is guarded with `typeof process !== undefined` — safe in browsers (no-op)
export { heapUsageMiddleware } from "./middleware/heap-usage.js";
// createHttpLogger is framework-agnostic (no Node imports). nodeHttpMappers is excluded (Node-specific).
export {
  createHttpLogger,
  type HttpLoggerOptions,
  type HttpRequestMapper,
  type HttpResponseMapper,
} from "./middleware/http.js";
export { ipMiddleware } from "./middleware/ip.js";
export {
  type LevelOverrideOptions,
  levelOverrideMiddleware,
} from "./middleware/level-override.js";
export {
  type OcppMiddlewareOptions,
  ocppMiddleware,
} from "./middleware/ocpp.js";
// otelTraceMiddleware now uses dynamic import() — browser-safe
export {
  type OtelTraceMiddlewareOptions,
  otelTraceMiddleware,
} from "./middleware/otel-trace.js";
export {
  type RedactionOptions,
  redactionMiddleware,
} from "./middleware/redaction.js";
export {
  type SamplingOptions,
  samplingMiddleware,
} from "./middleware/sampling.js";
export {
  type UserAgentOptions,
  userAgentMiddleware,
} from "./middleware/user-agent.js";

// ─── Transports (browser-safe) ──────────────────────────────────
export {
  type BatchTransportOptions,
  batchTransport,
} from "./transports/batch.js";
export {
  type BrowserJsonStreamTransportOptions,
  browserJsonStreamTransport,
} from "./transports/browser-json-stream.js";
export {
  type ConsoleTransportOptions,
  consoleTransport,
} from "./transports/console.js";
export { createTransport } from "./transports/create-transport.js";
export {
  type DatadogTransportOptions,
  datadogTransport,
} from "./transports/datadog.js";
export {
  type DiscordTransportOptions,
  discordTransport,
} from "./transports/discord.js";
export { type LokiTransportOptions, lokiTransport } from "./transports/loki.js";
export { type OtelTransportOptions, otelTransport } from "./transports/otel.js";
export {
  type PrettyTransportOptions,
  prettyTransport,
} from "./transports/pretty.js";
export {
  type RingBufferQueryOptions,
  type RingBufferTransport,
  type RingBufferTransportOptions,
  ringBufferTransport,
} from "./transports/ring-buffer.js";
export {
  type SentryInstance,
  type SentryTransportOptions,
  sentryTransport,
} from "./transports/sentry.js";
export {
  type SlackTransportOptions,
  slackTransport,
} from "./transports/slack.js";
export {
  type WebhookTransportOptions,
  webhookTransport,
} from "./transports/webhook.js";

/**
 * @module voltlog-io
 *
 * OCPP-aware structured logger — lightweight, type-safe, framework-agnostic.
 *
 * Works as a standalone package or via `ocpp-ws-io/logger` re-export.
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
export {
  type AiEnrichmentOptions,
  aiEnrichmentMiddleware,
  createOpenAiErrorAnalyzer,
} from "./middleware/ai-enrichment.js";
export { alertMiddleware } from "./middleware/alert.js";
export {
  type CorrelationIdOptions,
  correlationIdMiddleware,
} from "./middleware/correlation-id.js";
export { createMiddleware } from "./middleware/create-middleware.js";
export {
  type DeduplicationOptions,
  deduplicationMiddleware,
} from "./middleware/deduplication.js";
// Extended Middleware
export { heapUsageMiddleware } from "./middleware/heap-usage.js";
export {
  createHttpLogger,
  type HttpLoggerOptions,
  type HttpRequestMapper,
  type HttpResponseMapper,
  nodeHttpMappers,
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
// ─── Middleware ──────────────────────────────────────────────────
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
export {
  type BatchTransportOptions,
  batchTransport,
} from "./transports/batch.js";
export {
  type BrowserJsonStreamTransportOptions,
  browserJsonStreamTransport,
} from "./transports/browser-json-stream.js";
// ─── Transports ────────────────────────────────────────────────
export {
  type ConsoleTransportOptions,
  consoleTransport,
} from "./transports/console.js";
// Extended Transports
export { createTransport } from "./transports/create-transport.js";
export {
  type DatadogTransportOptions,
  datadogTransport,
} from "./transports/datadog.js";
export {
  type DiscordTransportOptions,
  discordTransport,
} from "./transports/discord.js";
export { type FileTransportOptions, fileTransport } from "./transports/file.js";
export {
  type JsonStreamTransportOptions,
  jsonStreamTransport,
} from "./transports/json-stream.js";
export { type LokiTransportOptions, lokiTransport } from "./transports/loki.js";
export {
  type PrettyTransportOptions,
  prettyTransport,
} from "./transports/pretty.js";
export {
  type RedisClient,
  type RedisTransportOptions,
  redisTransport,
} from "./transports/redis.js";
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
// ─── OpenTelemetry ─────────────────────────────────────────────
export {
  type OtelTraceMiddlewareOptions,
  otelTraceMiddleware,
} from "./middleware/otel-trace.js";
export { type OtelTransportOptions, otelTransport } from "./transports/otel.js";
// ─── Async Context ─────────────────────────────────────────────
export {
  type AsyncContextResult,
  asyncContextMiddleware,
} from "./middleware/async-context.js";

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
  type Transformer,
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
} from "./transformers/batch.js";
export {
  type BrowserJsonStreamTransportOptions,
  browserJsonStreamTransport,
} from "./transformers/browser-json-stream.js";
// ─── Transformers ────────────────────────────────────────────────
export {
  type ConsoleTransportOptions,
  consoleTransport,
} from "./transformers/console.js";
// Extended Transformers
export { createTransformer } from "./transformers/create-transformer.js";
export {
  type DatadogTransportOptions,
  datadogTransport,
} from "./transformers/datadog.js";
export {
  type DiscordTransportOptions,
  discordTransport,
} from "./transformers/discord.js";
export {
  type FileTransportOptions,
  fileTransport,
} from "./transformers/file.js";
export {
  type JsonStreamTransportOptions,
  jsonStreamTransport,
} from "./transformers/json-stream.js";
export {
  type LokiTransportOptions,
  lokiTransport,
} from "./transformers/loki.js";
export {
  type PrettyTransportOptions,
  prettyTransport,
} from "./transformers/pretty.js";
export {
  type RedisClient,
  type RedisTransportOptions,
  redisTransport,
} from "./transformers/redis.js";
export {
  type SentryInstance,
  type SentryTransportOptions,
  sentryTransport,
} from "./transformers/sentry.js";
export {
  type SlackTransportOptions,
  slackTransport,
} from "./transformers/slack.js";
export {
  type WebhookTransportOptions,
  webhookTransport,
} from "./transformers/webhook.js";

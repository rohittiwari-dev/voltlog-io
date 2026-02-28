/**
 * @module voltlog-io
 * @description Type definitions for the OCPP-aware structured logger.
 */

// ─── Log Levels ──────────────────────────────────────────────────

export const LogLevel = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
  SILENT: Infinity,
} as const;

export type LogLevelName = keyof typeof LogLevel;

/** Numeric log level value */
export type LogLevelValue = (typeof LogLevel)[LogLevelName];

/** Map from level name (lowercase) to numeric value */
export const LogLevelNameMap: Record<string, number> = Object.fromEntries(
  Object.entries(LogLevel).map(([k, v]) => [k.toLowerCase(), v]),
);

/** Map from numeric value to level name */
export const LogLevelValueMap: Record<number, LogLevelName> =
  Object.fromEntries(
    Object.entries(LogLevel)
      .filter(([, v]) => Number.isFinite(v))
      .map(([k, v]) => [v, k as LogLevelName]),
  ) as Record<number, LogLevelName>;

// ─── Log Entry ───────────────────────────────────────────────────

export interface LogEntry<TMeta = Record<string, unknown>> {
  /** Unique log ID */
  id: string;
  /** Numeric log level */
  level: number;
  /** Human-readable level name */
  levelName: LogLevelName;
  /** Log message */
  message: string;
  /** Unix epoch timestamp (ms) */
  timestamp: number;
  /** User-defined structured metadata (type-safe via generics) */
  meta: TMeta;
  /** Bound context from child logger (e.g. chargePointId, sessionId) */
  context?: Record<string, unknown>;
  /** Correlation ID for tracing across async operations */
  correlationId?: string;
  /** Error information */
  error?: LogError;
  /** @internal Cached JSON serialization — avoids redundant stringify across transports */
  _json?: string;
}

export interface LogError {
  message: string;
  stack?: string;
  code?: string;
  name?: string;
  /** Nested cause chain (ES2022 Error.cause support) */
  cause?: LogError;
}

// ─── OCPP Exchange Meta ──────────────────────────────────────────

export interface OcppExchangeMeta {
  /** Charge point / station identity */
  chargePointId?: string;
  /** OCPP message type */
  messageType?: "CALL" | "CALLRESULT" | "CALLERROR";
  /** OCPP action name (e.g. BootNotification) */
  action?: string;
  /** Message direction */
  direction?: "IN" | "OUT";
  /** Correlation ID for request/response matching */
  correlationId?: string;
  /** Negotiated OCPP protocol version */
  protocol?: string;
  /** Serialized payload size in bytes */
  payloadSize?: number;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Response status (e.g. Accepted, Rejected) */
  status?: string;
}

// ─── Transport ─────────────────────────────────────────────────

/**
 * A Transport receives formatted log entries and delivers them
 * to a destination (console, file, webhook, database, etc.).
 *
 * Transports are async-safe — `write()` can return a Promise.
 */
export interface Transport<TMeta = Record<string, unknown>> {
  /** Unique name for this transport */
  name: string;
  /** Optional per-transport level filter */
  level?: LogLevelName;
  /** Process a log entry */
  write(entry: LogEntry<TMeta>): void | Promise<void>;
  /** Flush any buffered entries */
  flush?(): void | Promise<void>;
  /** Graceful shutdown */
  close?(): void | Promise<void>;
}

// ─── Middleware ───────────────────────────────────────────────────

/**
 * Middleware intercepts log entries before they reach transports.
 * Used for redaction, sampling, enrichment, alerting, etc.
 *
 * Call `next(entry)` to continue the pipeline.
 * Omit `next()` to drop the entry (e.g. sampling).
 */
export type LogMiddleware<TMeta = Record<string, unknown>> = (
  entry: LogEntry<TMeta>,
  next: (entry: LogEntry<TMeta>) => void,
) => void;

// ─── Alert Rule ──────────────────────────────────────────────────

/**
 * Alert rules evaluate log entries and fire callbacks
 * when configurable conditions are met.
 */
export interface AlertRule<TMeta = Record<string, unknown>> {
  /** Alert name (for identification) */
  name: string;
  /** Condition — return true if this entry should count toward the alert */
  when: (entry: LogEntry<TMeta>) => boolean;
  /** Number of matching entries required to fire (default: 1) */
  threshold?: number;
  /** Time window in ms for threshold counting */
  windowMs?: number;
  /** Minimum cooldown in ms between alert firings (default: 0) */
  cooldownMs?: number;
  /** Callback fired when alert conditions are met */
  onAlert: (entries: LogEntry<TMeta>[]) => void | Promise<void>;
}

// ─── Timer Result ────────────────────────────────────────────────

export interface TimerResult<TMeta = Record<string, unknown>> {
  /** End the timer and log the duration */
  done(message: string, meta?: Partial<TMeta>): void;
  /** Get elapsed time in ms without logging */
  elapsed(): number;
}

// ─── Logger Options ──────────────────────────────────────────────

export interface LoggerOptions<TMeta = Record<string, unknown>> {
  /** Minimum log level (default: INFO) */
  level?: LogLevelName;
  /** Transports for log output */
  transports?: Transport<TMeta>[];
  /** Middleware pipeline */
  middleware?: LogMiddleware<TMeta>[];
  /** Alert rules */
  alerts?: AlertRule<TMeta>[];
  /** Default bound context for all log entries */
  context?: Record<string, unknown>;
  /** Field paths to auto-redact (e.g. ['idToken', 'password']) */
  redact?: string[];
  /**
   * When to include error stack traces:
   * - `true` — always include
   * - `false` — never include
   * - `LogLevelName` — include at this level and above
   * Default: 'ERROR'
   */
  includeStack?: boolean | LogLevelName;
  /**
   * Exchange log mode:
   * - `true` — exchange logs alongside normal logs
   * - `'only'` — only exchange-formatted logs
   * - `false` — disabled (default)
   */
  exchangeLog?: boolean | "only";
  /** Custom timestamp function (default: Date.now) */
  timestamp?: () => number;
  /**
   * Custom ID generator function.
   * Default: `crypto.randomUUID()` (native, fast).
   * Set to `false` to disable ID generation entirely for max performance.
   */
  idGenerator?: (() => string) | false;
}

// ─── Logger Interface ────────────────────────────────────────────

export interface Logger<TMeta = Record<string, unknown>> {
  trace(message: string, meta?: Partial<TMeta>): void;
  debug(message: string, meta?: Partial<TMeta>): void;
  info(message: string, meta?: Partial<TMeta>): void;
  warn(message: string, meta?: Partial<TMeta>): void;
  error(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void;
  fatal(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void;

  /** Create a child logger with additional bound context */
  child(context: Record<string, unknown>): Logger<TMeta>;

  /** Add a transport at runtime */
  addTransport(transport: Transport<TMeta>): void;
  /** Remove a transport by name */
  removeTransport(name: string): void;
  /** Add middleware at runtime */
  addMiddleware(middleware: LogMiddleware<TMeta>): void;
  /** Remove middleware by reference */
  removeMiddleware(middleware: LogMiddleware<TMeta>): void;

  /** Change the minimum log level at runtime */
  setLevel(level: LogLevelName): void;
  /** Get the current minimum log level */
  getLevel(): LogLevelName;
  /** Check if a given level would produce output (useful to guard expensive meta computation) */
  isLevelEnabled(level: LogLevelName): boolean;

  /** Start a timer — call `.done(msg)` to log elapsed duration */
  startTimer(level?: LogLevelName): TimerResult<TMeta>;

  /** Flush all transports */
  flush(): Promise<void>;
  /** Close all transports gracefully */
  close(): Promise<void>;
}

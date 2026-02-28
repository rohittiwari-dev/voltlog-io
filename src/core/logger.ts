/**
 * @module voltlog-io
 * @description Core Logger class — zero external dependencies (only cuid2), runtime-agnostic.
 *
 * @example Basic usage
 * ```ts
 * import { createLogger, consoleTransport } from 'voltlog-io';
 *
 * const logger = createLogger({
 *   level: 'INFO',
 *   transports: [consoleTransport()],
 * });
 *
 * logger.info('Server started', { port: 9000 });
 * ```
 *
 * @example Child logger with bound context
 * ```ts
 * const cpLogger = logger.child({ chargePointId: 'CP-101' });
 * cpLogger.info('BootNotification received');
 * // → auto-includes context: { chargePointId: 'CP-101' }
 * ```
 *
 * @example Error with stack trace
 * ```ts
 * logger.error('Connection failed', new Error('ETIMEDOUT'));
 * logger.error('Handler crashed', { action: 'BootNotification' }, new Error('null ref'));
 * ```
 *
 * @example With ocpp-ws-io (if user has both packages)
 * ```ts
 * import { createLogger } from 'ocpp-ws-io/logger'; // re-export
 * ```
 */

import { randomUUID } from "node:crypto";
import { resolveLevel, shouldIncludeStack, shouldLog } from "./levels.js";
import { composeMiddleware, fanOutToTransports } from "./pipeline.js";
import {
  type LogEntry,
  type LogError,
  type Logger,
  type LoggerOptions,
  type LogLevelName,
  LogLevelValueMap,
  type LogMiddleware,
  type TimerResult,
  type Transport,
} from "./types.js";

// ─── Logger Implementation ──────────────────────────────────────

class LoggerImpl<TMeta = Record<string, unknown>> implements Logger<TMeta> {
  private _level: number;
  private _transports: Transport<TMeta>[];
  private _middlewareList: LogMiddleware<TMeta>[];
  private _pipeline: (entry: LogEntry<TMeta>) => void;
  private _context: Record<string, unknown>;
  private _includeStack: boolean | LogLevelName;
  private _timestampFn: () => number;
  private _idFn: (() => string) | false;

  constructor(options: LoggerOptions<TMeta> = {}) {
    this._level = resolveLevel(options.level ?? "INFO");
    this._transports = [...(options.transports ?? [])];
    this._middlewareList = [...(options.middleware ?? [])];
    this._context = options.context ? { ...options.context } : {};
    this._includeStack = options.includeStack ?? "ERROR";
    this._timestampFn = options.timestamp ?? Date.now;
    this._idFn =
      options.idGenerator !== undefined ? options.idGenerator : randomUUID;
    this._pipeline = this._buildPipeline();
  }

  // ─── Log Methods ────────────────────────────────────────────

  trace(message: string, meta?: Partial<TMeta>): void {
    if (10 < this._level) return; // fast-fail short-circuit
    this._log(10, "TRACE", message, meta);
  }

  debug(message: string, meta?: Partial<TMeta>): void {
    if (20 < this._level) return;
    this._log(20, "DEBUG", message, meta);
  }

  info(message: string, meta?: Partial<TMeta>): void {
    if (30 < this._level) return;
    this._log(30, "INFO", message, meta);
  }

  warn(message: string, meta?: Partial<TMeta>): void {
    if (40 < this._level) return;
    this._log(40, "WARN", message, meta);
  }

  error(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void {
    if (50 < this._level) return;
    if (metaOrError instanceof Error) {
      this._log(50, "ERROR", message, undefined, metaOrError);
    } else {
      this._log(50, "ERROR", message, metaOrError, error);
    }
  }

  fatal(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void {
    if (metaOrError instanceof Error) {
      this._log(60, "FATAL", message, undefined, metaOrError);
    } else {
      this._log(60, "FATAL", message, metaOrError, error);
    }
  }

  // ─── Child Logger ───────────────────────────────────────────

  child(context: Record<string, unknown>): Logger<TMeta> {
    return new ChildLoggerImpl<TMeta>(this, { ...this._context, ...context });
  }

  // ─── Dynamic Configuration ─────────────────────────────────

  addTransport(transport: Transport<TMeta>): void {
    this._transports.push(transport);
  }

  removeTransport(name: string): void {
    this._transports = this._transports.filter((t) => t.name !== name);
  }

  addMiddleware(middleware: LogMiddleware<TMeta>): void {
    this._middlewareList.push(middleware);
    this._pipeline = this._buildPipeline();
  }

  removeMiddleware(middleware: LogMiddleware<TMeta>): void {
    this._middlewareList = this._middlewareList.filter((m) => m !== middleware);
    this._pipeline = this._buildPipeline();
  }

  // ─── Level Control ─────────────────────────────────────────

  setLevel(level: LogLevelName): void {
    this._level = resolveLevel(level);
  }

  getLevel(): LogLevelName {
    return (LogLevelValueMap[this._level] ?? "INFO") as LogLevelName;
  }

  isLevelEnabled(level: LogLevelName): boolean {
    return resolveLevel(level) >= this._level;
  }

  // ─── Timer ─────────────────────────────────────────────────

  startTimer(level?: LogLevelName): TimerResult<TMeta> {
    const start = performance.now();
    const logLevel = level ?? "INFO";
    return {
      done: (message: string, meta?: Partial<TMeta>) => {
        const durationMs = Math.round(performance.now() - start);
        const merged = { ...meta, durationMs } as unknown as Partial<TMeta>;
        const methodKey = logLevel.toLowerCase() as
          | "trace"
          | "debug"
          | "info"
          | "warn"
          | "error"
          | "fatal";
        this[methodKey](message, merged);
      },
      elapsed: () => Math.round(performance.now() - start),
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  async flush(): Promise<void> {
    await Promise.all(this._transports.map((t) => t.flush?.()).filter(Boolean));
  }

  async close(): Promise<void> {
    await this.flush();
    await Promise.all(this._transports.map((t) => t.close?.()).filter(Boolean));
  }

  // ─── Internal ───────────────────────────────────────────────

  /** @internal */
  _log(
    level: number,
    levelName: string,
    message: string,
    meta?: Partial<TMeta>,
    error?: Error,
  ): void {
    this._logWithContext(level, levelName, message, this._context, meta, error);
  }

  /** @internal — used by child loggers to inject bound context */
  _logWithContext(
    level: number,
    levelName: string,
    message: string,
    context: Record<string, unknown>,
    meta?: Partial<TMeta>,
    error?: Error,
  ): void {
    if (!shouldLog(level, this._level)) return;

    const entry: LogEntry<TMeta> = {
      id: this._idFn ? this._idFn() : "",
      level,
      levelName: levelName as LogLevelName,
      message,
      timestamp: this._timestampFn(),
      meta: (meta ?? {}) as TMeta,
      context: Object.keys(context).length > 0 ? context : undefined,
    };

    if (error) {
      entry.error = serializeError(
        error,
        shouldIncludeStack(level, this._includeStack),
      );
    }

    this._pipeline(entry);
  }

  private _buildPipeline(): (entry: LogEntry<TMeta>) => void {
    return composeMiddleware(this._middlewareList, (entry) => {
      fanOutToTransports(entry, this._transports, this._level);
    });
  }
}

// ─── Error Serialization ─────────────────────────────────────────

/** Recursively serialize an Error including the ES2022 cause chain */
function serializeError(
  error: Error,
  includeStack: boolean,
  depth = 0,
): LogError {
  const logError: LogError = {
    message: error.message,
    name: error.name,
    code: (error as NodeJS.ErrnoException).code,
  };
  if (includeStack) {
    logError.stack = error.stack;
  }
  // Recursively serialize cause chain (cap depth at 5 to prevent infinite loops)
  if (error.cause instanceof Error && depth < 5) {
    logError.cause = serializeError(error.cause, includeStack, depth + 1);
  }
  return logError;
}

// ─── Child Logger ────────────────────────────────────────────────

class ChildLoggerImpl<TMeta = Record<string, unknown>>
  implements Logger<TMeta>
{
  constructor(
    private _parent: LoggerImpl<TMeta>,
    private _context: Record<string, unknown>,
  ) {}

  trace(message: string, meta?: Partial<TMeta>): void {
    this._parent._logWithContext(10, "TRACE", message, this._context, meta);
  }
  debug(message: string, meta?: Partial<TMeta>): void {
    this._parent._logWithContext(20, "DEBUG", message, this._context, meta);
  }
  info(message: string, meta?: Partial<TMeta>): void {
    this._parent._logWithContext(30, "INFO", message, this._context, meta);
  }
  warn(message: string, meta?: Partial<TMeta>): void {
    this._parent._logWithContext(40, "WARN", message, this._context, meta);
  }
  error(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void {
    if (metaOrError instanceof Error) {
      this._parent._logWithContext(
        50,
        "ERROR",
        message,
        this._context,
        undefined,
        metaOrError,
      );
    } else {
      this._parent._logWithContext(
        50,
        "ERROR",
        message,
        this._context,
        metaOrError,
        error,
      );
    }
  }
  fatal(
    message: string,
    metaOrError?: Partial<TMeta> | Error,
    error?: Error,
  ): void {
    if (metaOrError instanceof Error) {
      this._parent._logWithContext(
        60,
        "FATAL",
        message,
        this._context,
        undefined,
        metaOrError,
      );
    } else {
      this._parent._logWithContext(
        60,
        "FATAL",
        message,
        this._context,
        metaOrError,
        error,
      );
    }
  }

  child(context: Record<string, unknown>): Logger<TMeta> {
    return new ChildLoggerImpl<TMeta>(this._parent, {
      ...this._context,
      ...context,
    });
  }

  addTransport(transport: Transport<TMeta>): void {
    this._parent.addTransport(transport);
  }
  removeTransport(name: string): void {
    this._parent.removeTransport(name);
  }
  addMiddleware(middleware: LogMiddleware<TMeta>): void {
    this._parent.addMiddleware(middleware);
  }
  removeMiddleware(middleware: LogMiddleware<TMeta>): void {
    this._parent.removeMiddleware(middleware);
  }
  setLevel(level: LogLevelName): void {
    this._parent.setLevel(level);
  }
  getLevel(): LogLevelName {
    return this._parent.getLevel();
  }
  isLevelEnabled(level: LogLevelName): boolean {
    return this._parent.isLevelEnabled(level);
  }
  startTimer(level?: LogLevelName): TimerResult<TMeta> {
    return this._parent.startTimer(level);
  }
  flush(): Promise<void> {
    return this._parent.flush();
  }
  close(): Promise<void> {
    return this._parent.close();
  }
}

// ─── Factory ─────────────────────────────────────────────────────

/**
 * Create a new logger instance.
 *
 * @example Minimal
 * ```ts
 * const logger = createLogger();
 * logger.info('Hello');
 * ```
 *
 * @example Full options
 * ```ts
 * import { createLogger, consoleTransport, prettyTransport } from 'voltlog-io';
 *
 * const logger = createLogger({
 *   level: 'DEBUG',
 *   transports: [prettyTransport()],
 *   redact: ['password', 'idToken'],
 *   includeStack: 'ERROR',
 * });
 * ```
 *
 * @example OCPP-aware with child loggers
 * ```ts
 * import { createLogger, prettyTransport } from 'voltlog-io';
 * import type { OcppExchangeMeta } from 'voltlog-io';
 *
 * const logger = createLogger<OcppExchangeMeta>({
 *   level: 'INFO',
 *   transports: [prettyTransport()],
 * });
 *
 * // Per-connection child logger
 * const cpLog = logger.child({ chargePointId: 'CP-101' });
 * cpLog.info('OCPP message', {
 *   messageType: 'CALL',
 *   action: 'BootNotification',
 *   direction: 'IN',
 * });
 * ```
 */
export function createLogger<TMeta = Record<string, unknown>>(
  options?: LoggerOptions<TMeta>,
): Logger<TMeta> {
  return new LoggerImpl<TMeta>(options);
}

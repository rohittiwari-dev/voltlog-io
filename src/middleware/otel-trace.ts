/**
 * @module voltlog-io
 * @description OpenTelemetry middleware — automatically picks up the active trace context.
 * Works like Winston's @opentelemetry/instrumentation-winston but as a simple middleware.
 *
 * @server-only Requires `@opentelemetry/api` as an optional peer dependency.
 *
 * When the OpenTelemetry SDK is active (e.g., with SigNoz, Jaeger, Grafana Tempo),
 * this middleware automatically injects traceId, spanId, and traceFlags into every log entry.
 *
 * @example
 * ```ts
 * import { createLogger, otelTraceMiddleware, otelTransport } from 'voltlog-io';
 *
 * const logger = createLogger({
 *   middleware: [otelTraceMiddleware()],
 *   transports: [
 *     otelTransport({
 *       endpoint: 'http://localhost:4318',
 *       serviceName: 'my-app',
 *     }),
 *   ],
 * });
 *
 * // If an OTel span is active, every log automatically gets:
 * // { traceId: "abc123...", spanId: "def456...", traceFlags: 1 }
 * logger.info("Processing request");
 * ```
 */

import type { LogMiddleware } from "../core/types.js";

export interface OtelTraceMiddlewareOptions {
  /**
   * Custom reference to `@opentelemetry/api` trace module.
   * If not provided, we attempt `require('@opentelemetry/api')` or dynamic import.
   * This allows the middleware to work without a hard dependency.
   */
  traceApi?: {
    trace: {
      getActiveSpan: () => unknown;
    };
  };
}

/**
 * Middleware that automatically injects OpenTelemetry trace context into log entries.
 *
 * How it works:
 * 1. On each log call, checks for an active OTel span
 * 2. If found, extracts traceId, spanId, and traceFlags
 * 3. Injects them into the log entry's metadata
 *
 * This is the equivalent of Winston's @opentelemetry/instrumentation-winston
 * but implemented as a zero-dependency middleware.
 */
export function otelTraceMiddleware<TMeta = Record<string, unknown>>(
  options: OtelTraceMiddlewareOptions = {},
): LogMiddleware<TMeta> {
  // Try to resolve @opentelemetry/api at middleware creation time
  let traceApi: any = options.traceApi ?? null;
  let resolved = !!traceApi;

  // Lazy-resolve @opentelemetry/api on first log call (async, non-blocking).
  // Using dynamic import() — works in Node 18+, Bun, Deno, and modern browsers.
  // No hard dependency; if the package isn't installed this is a silent no-op.
  let resolvePromise: Promise<void> | null = null;

  function ensureResolved(): Promise<void> {
    if (resolved || resolvePromise) return resolvePromise ?? Promise.resolve();
    // @ts-expect-error — @opentelemetry/api is an optional peer dep; TS error is expected when not installed.
    resolvePromise = import("@opentelemetry/api")
      .then((api: any) => {
        traceApi = api;
        resolved = true;
      })
      .catch(() => {
        // @opentelemetry/api not installed — middleware becomes a no-op
        resolved = true; // mark resolved to stop retrying
      });
    return resolvePromise;
  }

  return (entry, next) => {
    // Kick off lazy resolution on first use (subsequent calls are no-ops)
    ensureResolved().catch(() => {});

    if (resolved && traceApi?.trace) {
      try {
        const activeSpan = traceApi.trace.getActiveSpan?.();
        if (activeSpan) {
          const spanContext = activeSpan.spanContext?.();
          if (spanContext) {
            // Inject trace context into metadata
            const meta = entry.meta as Record<string, unknown>;
            meta.traceId = spanContext.traceId;
            meta.spanId = spanContext.spanId;
            meta.traceFlags = spanContext.traceFlags;

            // Also set correlationId to traceId for cross-referencing
            if (!entry.correlationId) {
              entry.correlationId = spanContext.traceId;
            }
          }
        }
      } catch {
        // OTel API call failed — skip silently
      }
    }

    next(entry);
  };
}

/**
 * @module voltlog-io
 * @description OpenTelemetry OTLP transport — sends logs via OTLP HTTP/JSON protocol.
 * @server-only Uses `fetch()` to send logs to an OTLP-compatible collector.
 *
 * Compatible with: SigNoz, Jaeger, Grafana Alloy, OpenTelemetry Collector, and any OTLP endpoint.
 *
 * @example
 * ```ts
 * import { createLogger, otelTraceMiddleware, otelTransport } from 'voltlog-io';
 *
 * // SigNoz Cloud
 * const logger = createLogger({
 *   middleware: [otelTraceMiddleware()],
 *   transports: [
 *     otelTransport({
 *       endpoint: 'https://ingest.signoz.io',
 *       headers: { 'signoz-access-token': 'YOUR_TOKEN' },
 *       serviceName: 'my-app',
 *     }),
 *   ],
 * });
 *
 * // Self-hosted OTel Collector
 * const logger2 = createLogger({
 *   transports: [
 *     otelTransport({
 *       endpoint: 'http://localhost:4318', // OTLP HTTP port
 *       serviceName: 'volt-csms',
 *       resource: {
 *         'deployment.environment': 'production',
 *         'service.version': '2.0.0',
 *       },
 *     }),
 *   ],
 * });
 *
 * logger.info('Request processed', { userId: 'u-42' });
 * // → Sent to SigNoz with traceId, spanId, severity, resource attributes
 * ```
 */

import type { LogEntry, LogLevelName, Transport } from "../core/types.js";

export interface OtelTransportOptions {
  /**
   * OTLP HTTP endpoint (e.g. http://localhost:4318 or https://ingest.signoz.io).
   * The `/v1/logs` path is appended automatically.
   */
  endpoint: string;
  /** Service name reported to the collector */
  serviceName: string;
  /** Additional resource attributes (e.g. deployment.environment, service.version) */
  resource?: Record<string, string>;
  /** Extra headers (e.g. signoz-access-token, Authorization) */
  headers?: Record<string, string>;
  /** Transport level filter */
  level?: LogLevelName;
  /** Batch size before flush (default: 20) */
  batchSize?: number;
  /** Batch interval in ms (default: 5000) */
  interval?: number;
}

// Map voltlog-io levels to OTel severity numbers
// https://opentelemetry.io/docs/specs/otel/logs/data-model/#severity-fields
const OTEL_SEVERITY_MAP: Record<string, { number: number; text: string }> = {
  TRACE: { number: 1, text: "TRACE" },
  DEBUG: { number: 5, text: "DEBUG" },
  INFO: { number: 9, text: "INFO" },
  WARN: { number: 13, text: "WARN" },
  ERROR: { number: 17, text: "ERROR" },
  FATAL: { number: 21, text: "FATAL" },
};

/**
 * Creates an OTLP HTTP/JSON transport for OpenTelemetry-compatible backends.
 *
 * Sends logs using the OTLP Logs protocol:
 * https://opentelemetry.io/docs/specs/otlp/#otlphttp-request
 */
export function otelTransport(options: OtelTransportOptions): Transport {
  const { endpoint, serviceName, level, resource = {} } = options;
  const batchSize = options.batchSize ?? 20;
  const interval = options.interval ?? 5000;

  const url = `${endpoint.replace(/\/$/, "")}/v1/logs`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Build resource attributes once
  const resourceAttributes = [
    { key: "service.name", value: { stringValue: serviceName } },
    ...Object.entries(resource).map(([key, val]) => ({
      key,
      value: { stringValue: val },
    })),
  ];

  let buffer: LogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function toOtlpLogRecord(entry: LogEntry): Record<string, unknown> {
    const severity =
      OTEL_SEVERITY_MAP[entry.levelName] ?? OTEL_SEVERITY_MAP.INFO;

    // Build attributes from metadata
    const attributes: Array<{ key: string; value: Record<string, unknown> }> =
      [];

    if (entry.meta && typeof entry.meta === "object") {
      for (const [key, val] of Object.entries(entry.meta)) {
        if (key === "traceId" || key === "spanId" || key === "traceFlags")
          continue;
        if (val !== undefined && val !== null) {
          attributes.push({
            key,
            value:
              typeof val === "number"
                ? { intValue: val }
                : { stringValue: String(val) },
          });
        }
      }
    }

    // Add context as attributes
    if (entry.context) {
      for (const [key, val] of Object.entries(entry.context)) {
        if (val !== undefined && val !== null) {
          attributes.push({
            key: `context.${key}`,
            value: { stringValue: String(val) },
          });
        }
      }
    }

    // Add error info
    if (entry.error) {
      attributes.push({
        key: "error.message",
        value: { stringValue: entry.error.message },
      });
      if (entry.error.name) {
        attributes.push({
          key: "error.type",
          value: { stringValue: entry.error.name },
        });
      }
      if (entry.error.stack) {
        attributes.push({
          key: "error.stack",
          value: { stringValue: entry.error.stack },
        });
      }
    }

    const record: Record<string, unknown> = {
      timeUnixNano: String(entry.timestamp * 1_000_000), // ms → ns
      severityNumber: severity?.number,
      severityText: severity?.text,
      body: { stringValue: entry.message },
      attributes,
    };

    // Attach trace context if available (from otelTraceMiddleware)
    const meta = entry.meta as Record<string, unknown> | undefined;
    if (meta?.traceId) {
      record.traceId = meta.traceId;
    }
    if (meta?.spanId) {
      record.spanId = meta.spanId;
    }
    if (meta?.traceFlags !== undefined) {
      record.flags = meta.traceFlags;
    }

    return record;
  }

  async function sendBatch(batch: LogEntry[]): Promise<void> {
    const payload = {
      resourceLogs: [
        {
          resource: { attributes: resourceAttributes },
          scopeLogs: [
            {
              scope: { name: "voltlog-io" },
              logRecords: batch.map(toOtlpLogRecord),
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(
          `[voltlog] OTLP push failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      console.error("[voltlog] OTLP push failed", err);
    }
  }

  function flush(): void {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    sendBatch(batch).catch(() => {});
  }

  function schedule(): void {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, interval);
    }
  }

  return {
    name: "otel",
    level,
    write(entry: LogEntry): void {
      buffer.push(entry);
      if (buffer.length >= batchSize) {
        if (timer) clearTimeout(timer);
        timer = null;
        flush();
      } else {
        schedule();
      }
    },
    async flush(): Promise<void> {
      if (timer) clearTimeout(timer);
      timer = null;
      if (buffer.length === 0) return;
      const batch = buffer;
      buffer = [];
      await sendBatch(batch);
    },
    async close(): Promise<void> {
      await this.flush?.();
    },
  };
}

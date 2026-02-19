/**
 * @module voltlog-io
 * @description Loki transformer — pushes logs to Grafana Loki.
 * @universal Works in all environments (uses `fetch`).
 *
 * > **Security Note**: Using this in the browser exposes auth details and may face CORS issues.
 * > Recommended for server-side use.
 */

import type { LogEntry, LogLevelName, Transport } from "../core/types.js";

export interface LokiTransportOptions {
  /** Loki URL (e.g. http://localhost:3100) */
  host: string;
  /** Basic Auth username */
  basicAuthUser?: string;
  /** Basic Auth password/token */
  basicAuthPassword?: string;
  /** Tenant ID (header X-Scope-OrgID) */
  tenantId?: string;
  /** Labels to attach to every stream (e.g. { app: 'volt-server' }) */
  labels?: Record<string, string>;
  /** Transport level filter */
  level?: LogLevelName;
  /** Batch size (default: 10) */
  batchSize?: number;
  /** Batch interval ms (default: 5000) */
  interval?: number;
}

/**
 * Pushes logs to Grafana Loki via HTTP API.
 * Uses batching to improve performance.
 */
export function lokiTransport(options: LokiTransportOptions): Transport {
  const { host, labels = { app: "voltlog" }, level } = options;
  const batchSize = options.batchSize ?? 10;
  const interval = options.interval ?? 5000;

  const url = `${host.replace(/\/$/, "")}/loki/api/v1/push`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.basicAuthUser && options.basicAuthPassword) {
    const creds = btoa(`${options.basicAuthUser}:${options.basicAuthPassword}`);
    headers.Authorization = `Basic ${creds}`;
  }

  if (options.tenantId) {
    headers["X-Scope-OrgID"] = options.tenantId;
  }

  let buffer: LogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];

    const streams = [
      {
        stream: labels,
        values: batch.map((e) => [
          String(e.timestamp * 1000000), // Loki wants nanoseconds
          JSON.stringify({
            level: e.levelName,
            message: e.message,
            ...e.meta,
          }),
        ]),
      },
    ];

    try {
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ streams }),
      });
    } catch (err) {
      console.error("[voltlog] Loki push failed", err);
    }
  };

  const schedule = () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, interval);
    }
  };

  return {
    name: "loki",
    level,
    write(entry) {
      buffer.push(entry);
      if (buffer.length >= batchSize) {
        if (timer) clearTimeout(timer);
        timer = null;
        flush();
      } else {
        schedule();
      }
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await flush();
    },
    async close() {
      await this.flush?.();
    },
  };
}

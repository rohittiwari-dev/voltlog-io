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
  /** Static labels to attach to every stream (e.g. { app: 'volt-server' }) */
  labels?: Record<string, string>;
  /**
   * Extract dynamic labels from each log entry.
   * These are merged with static labels and used as Loki stream labels.
   * Keep cardinality low — use only a few well-known values.
   * @example (entry) => ({ level: entry.levelName, service: entry.context?.service })
   */
  dynamicLabels?: (entry: LogEntry) => Record<string, string | undefined>;
  /**
   * Include context, error, and correlationId in the Loki log payload.
   * Default: true
   */
  includeMetadata?: boolean;
  /** Transport level filter */
  level?: LogLevelName;
  /** Batch size (default: 10) */
  batchSize?: number;
  /** Batch interval ms (default: 5000) */
  interval?: number;
  /** Enable retry on push failure (default: false) */
  retry?: boolean;
  /** Maximum retries (default: 3) */
  maxRetries?: number;
}

/**
 * Pushes logs to Grafana Loki via HTTP API.
 * Uses batching to improve performance.
 */
export function lokiTransport(options: LokiTransportOptions): Transport {
  const { host, level } = options;
  const staticLabels = options.labels ?? { app: "voltlog" };
  const batchSize = options.batchSize ?? 10;
  const interval = options.interval ?? 5000;
  const includeMetadata = options.includeMetadata !== false;
  const retryEnabled = options.retry ?? false;
  const maxRetries = options.maxRetries ?? 3;

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

  function buildLogLine(entry: LogEntry): string {
    const payload: Record<string, unknown> = {
      level: entry.levelName,
      message: entry.message,
      ...(entry.meta as Record<string, unknown>),
    };

    if (includeMetadata) {
      if (entry.correlationId) {
        payload.correlationId = entry.correlationId;
      }
      if (entry.context) {
        payload.context = entry.context;
      }
      if (entry.error) {
        payload.error = entry.error;
      }
    }

    return JSON.stringify(payload);
  }

  function buildStreams(batch: LogEntry[]): unknown[] {
    if (!options.dynamicLabels) {
      // Simple path — all entries go to one stream
      return [
        {
          stream: staticLabels,
          values: batch.map((e) => [
            String(e.timestamp * 1000000), // Loki wants nanoseconds
            buildLogLine(e),
          ]),
        },
      ];
    }

    // Group entries by their label set
    const grouped = new Map<
      string,
      { labels: Record<string, string>; values: [string, string][] }
    >();

    for (const entry of batch) {
      const dynamic = options.dynamicLabels(entry);
      const merged: Record<string, string> = { ...staticLabels };
      for (const [k, v] of Object.entries(dynamic)) {
        if (v !== undefined) merged[k] = v;
      }

      const key = JSON.stringify(merged);
      let group = grouped.get(key);
      if (!group) {
        group = { labels: merged, values: [] };
        grouped.set(key, group);
      }
      group.values.push([
        String(entry.timestamp * 1000000),
        buildLogLine(entry),
      ]);
    }

    return Array.from(grouped.values()).map((g) => ({
      stream: g.labels,
      values: g.values,
    }));
  }

  async function pushWithRetry(batch: LogEntry[]): Promise<void> {
    const body = JSON.stringify({ streams: buildStreams(batch) });
    let lastError: unknown;

    const attempts = retryEnabled ? maxRetries : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(url, { method: "POST", headers, body });
        if (response.ok) return;

        // Don't retry 4xx (client errors)
        if (response.status >= 400 && response.status < 500) {
          console.error(`[voltlog] Loki push failed: ${response.status}`);
          return;
        }
        lastError = new Error(`Loki HTTP ${response.status}`);
      } catch (err) {
        lastError = err;
      }

      // Exponential backoff: 100ms, 200ms, 400ms...
      if (attempt < attempts - 1) {
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
      }
    }

    console.error("[voltlog] Loki push failed after retries", lastError);
  }

  const doFlush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await pushWithRetry(batch);
  };

  const schedule = () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        doFlush();
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
        doFlush();
      } else {
        schedule();
      }
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await doFlush();
    },
    async close() {
      await this.flush?.();
    },
  };
}

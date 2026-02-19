/**
 * @module voltlog-io
 * @description Datadog transformer — sends logs directly to Datadog Intake API.
 * @universal Works in all environments (uses `fetch`).
 *
 * > **Security Note**: Using this in the browser will expose your API Key.
 * > Recommended for server-side use only.
 */

import type { LogLevelName, Transformer } from "../core/types.js";

export interface DatadogTransportOptions {
  /** Datadog API Key */
  apiKey: string;
  /** Datadog Site (default: datadoghq.com) */
  site?: string; // e.g., datadoghq.eu
  /** Service name tag */
  service?: string;
  /** Source tag (default: nodejs) */
  ddSource?: string;
  /** Hostname override */
  hostname?: string;
  /** Tags (comma separated: env:prod,version:1.0) */
  tags?: string;
  /** Transport level filter */
  level?: LogLevelName;
}

/**
 * Sends logs to Datadog via HTTP POST.
 * Uses built-in batching (not implemented here for brevity, typically would use batchTransport wrapper).
 * This implementation sends immediately for simplicity or relies on `batchTransport` composition.
 */
export function datadogTransport(
  options: DatadogTransportOptions,
): Transformer {
  const {
    apiKey,
    site = "datadoghq.com",
    service,
    ddSource = "nodejs",
    hostname,
    tags,
    level,
  } = options;
  const url = `https://http-intake.logs.${site}/api/v2/logs`;

  return {
    name: "datadog",
    level,
    async transform(entry) {
      const payload = {
        ddsource: ddSource,
        ddtags: tags,
        hostname,
        service,
        message: entry.message,
        status: entry.levelName.toLowerCase(), // Datadog uses lowercase status
        ...entry.meta,
        timestamp: entry.timestamp, // Datadog auto-parses this
      };

      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": apiKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("[voltlog] Datadog push failed", err);
      }
    },
  };
}

/**
 * @module voltlog-io
 * @description Correlation ID middleware — adds tracing IDs to logs.
 * @universal Works in all environments.
 * Useful for tracking requests across microservices.
 */

import { createId } from "@paralleldrive/cuid2";
import type { LogMiddleware } from "../core/types.js";

export interface CorrelationIdOptions {
  /**
   * Header name or meta key to check for existing ID.
   * Default: 'x-correlation-id' (and checks 'traceId', 'correlationId')
   */
  header?: string;
  /**
   * Function to generate new IDs.
   * Default: cuid2
   */
  generator?: () => string;
}

/**
 * Middleware that ensures every log entry has a correlation ID.
 * checks:
 * 1. entry.correlationId
 * 2. entry.meta.correlationId
 * 3. entry.meta.traceId
 * 4. entry.meta[header]
 *
 * If none found, generates a new one.
 */
export function correlationIdMiddleware<TMeta = Record<string, unknown>>(
  options: CorrelationIdOptions = {},
): LogMiddleware<TMeta> {
  const header = options.header ?? "x-correlation-id";
  const generate = options.generator ?? createId;

  return (entry, next) => {
    // 1. Check direct property
    if (entry.correlationId) {
      return next(entry);
    }

    // 2. Check meta
    const meta = entry.meta as Record<string, unknown>;
    let id =
      (meta.correlationId as string) ||
      (meta.traceId as string) ||
      (meta[header] as string);

    // 3. Generate if missing
    if (!id) {
      id = generate();
    }

    // 4. Assign
    entry.correlationId = id;

    // Also ensure it's in meta for visibility if desired (optional, but good for transports that only dump meta)
    // We won't overwrite existing keys to avoid side effects, but we can standardize on correlationId
    if (!meta.correlationId) {
      // cast to allows assignment
      (entry.meta as Record<string, unknown>).correlationId = id;
    }

    next(entry);
  };
}

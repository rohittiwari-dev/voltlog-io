/**
 * @module voltlog-io
 * @description Sampling middleware — rate limits or probabilistically samples logs.
 * @universal Works in all environments.
 * @example
 * ```ts
 * import { createLogger, consoleTransport, samplingMiddleware } from 'voltlog-io';
 *
 * const logger = createLogger({
 *   transports: [consoleTransport()],
 *   middleware: [
 *     samplingMiddleware({
 *       keyFn: (entry) => `${entry.meta.action}:${entry.meta.chargePointId}`,
 *       maxPerWindow: 10,
 *       windowMs: 60_000, // 10 logs per minute per action+CP combo
 *     }),
 *   ],
 * });
 * ```
 */

import type { LogEntry, LogMiddleware } from "../core/types.js";

export interface SamplingOptions<TMeta = Record<string, unknown>> {
  /**
   * Function to extract a sampling key from a log entry.
   * Entries with the same key share a rate limit.
   * Default: uses `entry.message`
   */
  keyFn?: (entry: LogEntry<TMeta>) => string;
  /** Maximum entries allowed per key per window (default: 100) */
  maxPerWindow?: number;
  /** Time window in ms (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Probability to keep a log (0 to 1). Default: 1 (keep all) */
  sampleRate?: number;
  /** Logs at this level or higher always pass. Default: 40 (WARN) */
  priorityLevel?: number;
}

interface BucketEntry {
  count: number;
  windowStart: number;
}

/**
 * Create a sampling middleware that drops logs exceeding the rate limit.
 */
export function samplingMiddleware<TMeta = Record<string, unknown>>(
  options: SamplingOptions<TMeta> = {},
): LogMiddleware<TMeta> {
  const keyFn = options.keyFn ?? ((entry: LogEntry<TMeta>) => entry.message);
  const maxPerWindow = options.maxPerWindow ?? 100;
  const windowMs = options.windowMs ?? 60_000;
  const sampleRate = options.sampleRate ?? 1;
  // Default priority to WARN (40) so INFO (30) gets sampled/limited
  const priorityLevel = options.priorityLevel ?? 40;

  const buckets = new Map<string, BucketEntry>();

  return (entry: LogEntry<TMeta>, next) => {
    // 1. High priority logs always pass
    if (entry.level >= priorityLevel) {
      return next(entry);
    }

    // 2. Probabilistic Sampling
    if (sampleRate < 1 && Math.random() > sampleRate) {
      return; // Dropped
    }

    // 3. Rate Limiting
    const key = keyFn(entry);
    const now = entry.timestamp;

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }

    if (bucket.count < maxPerWindow) {
      bucket.count++;
      next(entry);
    }
    // else: Dropped (rate limited)

    // Periodic cleanup (simple heuristic)
    if (buckets.size > 2000) {
      // ... cleanup logic ...
      const expireBefore = now - windowMs * 2;
      for (const [k, b] of buckets) {
        if (b.windowStart < expireBefore) {
          buckets.delete(k);
        }
      }
    }
  };
}

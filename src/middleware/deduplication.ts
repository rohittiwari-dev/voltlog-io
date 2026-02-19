/**
 * @module voltlog-io
 * @description Deduplication middleware — groups identical logs in a time window.
 * @universal Works in all environments.
 */

import type { LogEntry, LogMiddleware } from "../core/types.js";

export interface DeduplicationOptions<TMeta = Record<string, unknown>> {
  /**
   * Time window in ms to group logs.
   * Logs matching the key within this window will be aggregated.
   * Default: 1000ms
   */
  windowMs?: number;
  /**
   * Function to generate a unique key for deduplication.
   * Default: uses `entry.message` + `entry.level`
   */
  keyFn?: (entry: LogEntry<TMeta>) => string;
}

interface DedupState<TMeta> {
  entry: LogEntry<TMeta>;
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Deduplication middleware.
 * Buffers logs for `windowMs`. If identical logs arrive, increments a counter.
 * Emits the log once at the end of the window with `meta.duplicateCount`.
 */
export function deduplicationMiddleware<TMeta = Record<string, unknown>>(
  options: DeduplicationOptions<TMeta> = {},
): LogMiddleware<TMeta> {
  const windowMs = options.windowMs ?? 1000;
  const keyFn =
    options.keyFn ??
    ((e) => `${e.level}:${e.message}:${e.error?.message ?? ""}`);

  const buffer = new Map<string, DedupState<TMeta>>();

  return (entry, next) => {
    const key = keyFn(entry);

    if (buffer.has(key)) {
      // Duplicate found
      // biome-ignore lint/style/noNonNullAssertion: Guarded by buffer.has check
      const state = buffer.get(key)!;
      state.count++;
      return; // Drop this instance
    }

    // New entry
    const timer = setTimeout(() => {
      const state = buffer.get(key);
      if (state) {
        buffer.delete(key);
        if (state.count > 1) {
          state.entry.meta = {
            ...state.entry.meta,
            duplicateCount: state.count,
          };
        }
        next(state.entry);
      }
    }, windowMs);

    buffer.set(key, {
      entry,
      count: 1,
      timer,
    });
  };
}

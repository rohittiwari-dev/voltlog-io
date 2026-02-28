/**
 * @module voltlog-io
 * @description Ring buffer transport — stores last N log entries in memory for on-demand retrieval.
 * @universal Works in all environments.
 *
 * Useful for debugging, in-app log viewers, and diagnostic endpoints.
 *
 * @example
 * ```ts
 * import { createLogger, ringBufferTransport } from 'voltlog-io';
 *
 * const ring = ringBufferTransport({ maxSize: 500 });
 * const logger = createLogger({ transports: [ring] });
 *
 * logger.info('Hello');
 * logger.error('Oops', new Error('fail'));
 *
 * // Retrieve buffered entries
 * const entries = ring.getEntries();
 * const errors = ring.getEntries({ level: 'ERROR' });
 * ```
 */

import { resolveLevel } from "../core/levels.js";
import type { LogEntry, LogLevelName, Transport } from "../core/types.js";

export interface RingBufferTransportOptions {
  /** Maximum number of entries to keep (default: 1000) */
  maxSize?: number;
  /** Per-transport level filter */
  level?: LogLevelName;
}

export interface RingBufferQueryOptions {
  /** Filter by minimum level */
  level?: LogLevelName;
  /** Return only entries after this timestamp */
  since?: number;
  /** Maximum entries to return (default: all) */
  limit?: number;
}

export interface RingBufferTransport extends Transport {
  /** Retrieve buffered log entries with optional filtering */
  getEntries(query?: RingBufferQueryOptions): LogEntry[];
  /** Clear all buffered entries */
  clear(): void;
  /** Get current buffer size */
  size: number;
}

/**
 * Creates a ring buffer (circular buffer) transport.
 * Stores the most recent `maxSize` entries in memory.
 * Oldest entries are evicted when the buffer is full.
 */
export function ringBufferTransport(
  options: RingBufferTransportOptions = {},
): RingBufferTransport {
  const maxSize = options.maxSize ?? 1000;
  const buffer: LogEntry[] = [];
  let head = 0;
  let count = 0;

  return {
    name: "ring-buffer",
    level: options.level,

    write(entry: LogEntry): void {
      if (count < maxSize) {
        buffer.push(entry);
        count++;
      } else {
        buffer[head] = entry;
      }
      head = (head + 1) % maxSize;
    },

    getEntries(query?: RingBufferQueryOptions): LogEntry[] {
      // Reconstruct ordered array (oldest → newest)
      let entries: LogEntry[];
      if (count < maxSize) {
        entries = buffer.slice();
      } else {
        entries = [...buffer.slice(head), ...buffer.slice(0, head)];
      }

      // Apply filters
      if (query?.level) {
        const minLevel = resolveLevel(query.level);
        entries = entries.filter((e) => e.level >= minLevel);
      }
      if (query?.since) {
        const since = query.since;
        entries = entries.filter((e) => e.timestamp >= since);
      }
      if (query?.limit) {
        entries = entries.slice(-query.limit);
      }

      return entries;
    },

    clear(): void {
      buffer.length = 0;
      head = 0;
      count = 0;
    },

    get size() {
      return count;
    },
  };
}

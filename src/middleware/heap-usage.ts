/**
 * @module voltlog-io
 * @description Heap usage middleware — adds memory stats to logs.
 * @universal Works in all environments, but only adds data in Node.js/Bun/Deno.
 * Checks for `process.memoryUsage` presence before execution.
 */

import type { LogMiddleware } from "../core/types.js";

export interface HeapUsageOptions {
  /**
   * Field name to store memory stats in `entry.meta`.
   * Default: 'memory'
   */
  fieldName?: string;
}

/**
 * Adds `rss`, `heapTotal`, and `heapUsed` to log metadata.
 * Only works in environments where `process.memoryUsage` is available (Node.js/Bun/Deno).
 */
export function heapUsageMiddleware<TMeta = Record<string, unknown>>(
  options: HeapUsageOptions = {},
): LogMiddleware<TMeta> {
  const fieldName = options.fieldName ?? "memory";

  return (entry, next) => {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memory = process.memoryUsage();
      entry.meta = {
        ...entry.meta,
        [fieldName]: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
        },
      };
    }
    next(entry);
  };
}

/**
 * @module voltlog-io
 * @description Level Override middleware — allows forcing a log level for specific requests.
 * @universal Works in all environments.
 * Useful for debugging specific users/requests in production without changing global config.
 */

import type { LogMiddleware } from "../core/types.js";
import { LogLevel, type LogLevelName } from "../core/types.js";

export interface LevelOverrideOptions {
  /**
   * Header name or meta key to trigger override.
   * Default: 'x-log-level'
   */
  key?: string;
  /**
   * If true, removes the trigger key from metadata before logging.
   * Default: true
   */
  cleanup?: boolean;
}

/**
 * Dynamically changes the log entry level if a specific key is found in meta/context.
 * E.g. passing `x-log-level: DEBUG` allows a specific request to bypass INFO filters.
 */
export function levelOverrideMiddleware<TMeta = Record<string, unknown>>(
  options: LevelOverrideOptions = {},
): LogMiddleware<TMeta> {
  const key = options.key ?? "x-log-level";
  const cleanup = options.cleanup ?? true;

  return (entry, next) => {
    const meta = entry.meta as Record<string, unknown>;
    const context = entry.context as Record<string, unknown> | undefined;

    // Check meta, then context, then headers in meta
    const levelName =
      (meta[key] as string) ||
      (context?.[key] as string) ||
      ((meta.headers as Record<string, unknown>)?.[key] as string);

    if (levelName && typeof levelName === "string") {
      const upperName = levelName.toUpperCase() as LogLevelName;
      if (LogLevel[upperName]) {
        // Upgrade the entry level so it passes transport filters
        // NOTE: This modifies the entry itself, which affects all transports
        entry.level = LogLevel[upperName];
        entry.levelName = upperName;

        if (cleanup) {
          delete meta[key];
          if (meta.headers) {
            delete (meta.headers as Record<string, unknown>)[key];
          }
        }
      }
    }

    next(entry);
  };
}

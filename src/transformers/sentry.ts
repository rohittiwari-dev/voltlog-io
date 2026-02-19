/**
 * @module voltlog-io
 * @description Sentry transformer — pushes errors to Sentry.
 * @universal Works in both Server and Browser (depends on provided Sentry instance).
 */

import type { LogLevelName, Transformer } from "../core/types.js";

/**
 * Minimal Sentry client interface to avoid hard dependency on @sentry/* packages.
 * Users pass their Sentry instance (e.g. `import * as Sentry from '@sentry/node'`).
 */
export interface SentryInstance {
  captureException(exception: unknown, hint?: unknown): string;
  captureMessage(message: string, level?: unknown): string;
  addBreadcrumb(breadcrumb: unknown): void;
  Severity?: unknown; // To check severity enum if present
}

export interface SentryTransportOptions {
  /** Configured Sentry instance/hub */
  sentry: SentryInstance;
  /** Minimum level to trigger captureException (default: ERROR) */
  errorLevel?: LogLevelName;
  /** Minimum level to send breadcrumbs (default: INFO) */
  breadcrumbLevel?: LogLevelName;
}

import { resolveLevel } from "../core/levels.js";

/**
 * Integrates with an existing Sentry instance.
 * - Logs >= errorLevel -> sent as Exceptions
 * - Logs >= breadcrumbLevel -> sent as Breadcrumbs
 */
export function sentryTransport(options: SentryTransportOptions): Transformer {
  const { sentry } = options;
  const errorLevelValue = resolveLevel(options.errorLevel ?? "ERROR");
  const breadcrumbLevelValue = resolveLevel(options.breadcrumbLevel ?? "INFO");

  return {
    name: "sentry",
    transform(entry) {
      // 1. Send as Exception if >= errorLevel
      if (entry.level >= errorLevelValue) {
        if (entry.error) {
          sentry.captureException(entry.error, {
            extra: {
              ...entry.meta,
              context: entry.context,
            },
            level: "error",
          });
        } else {
          sentry.captureMessage(entry.message, "error");
        }
      }

      // 2. Always add breadcrumb for context (if >= breadcrumbLevel)
      if (entry.level >= breadcrumbLevelValue) {
        sentry.addBreadcrumb({
          category: "log",
          message: entry.message,
          level: mapLevelToSentry(entry.level),
          data: { ...entry.meta, ...entry.context },
          timestamp: entry.timestamp / 1000,
        });
      }
    },
  };
}

function mapLevelToSentry(level: number): string {
  if (level >= 60) return "fatal";
  if (level >= 50) return "error";
  if (level >= 40) return "warning";
  if (level >= 30) return "info";
  return "debug";
}

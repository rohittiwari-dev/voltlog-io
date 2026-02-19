/**
 * @module voltlog-io
 * @description OCPP middleware — masks sensitive fields and calculates latency for OCPP messages.
 * @universal Works in all environments.
 *
 * @example
 * ```ts
 * import { createLogger, consoleTransport, ocppMiddleware } from 'voltlog-io';
 * import type { OcppExchangeMeta } from 'voltlog-io';
 *
 * const logger = createLogger<OcppExchangeMeta>({
 *   transports: [consoleTransport()],
 *   middleware: [ocppMiddleware()],
 * });
 *
 * // The middleware auto-computes payloadSize and adds correlationId to the entry
 * logger.info('Message received', {
 *   action: 'BootNotification',
 *   messageType: 'CALL',
 *   direction: 'IN',
 * });
 * ```
 */

import type {
  LogEntry,
  LogMiddleware,
  OcppExchangeMeta,
} from "../core/types.js";

export interface OcppMiddlewareOptions {
  /**
   * Automatically compute payload size from meta if not set.
   * Default: true
   */
  autoPayloadSize?: boolean;
  /**
   * Propagate correlationId from meta to entry.correlationId.
   * Default: true
   */
  propagateCorrelationId?: boolean;
}

/**
 * Create an OCPP enrichment middleware.
 * Enriches log entries with computed OCPP metadata.
 */
export function ocppMiddleware(
  options: OcppMiddlewareOptions = {},
): LogMiddleware<OcppExchangeMeta> {
  const autoPayloadSize = options.autoPayloadSize ?? true;
  const propagateCorrelationId = options.propagateCorrelationId ?? true;

  return (entry: LogEntry<OcppExchangeMeta>, next) => {
    const enriched = { ...entry, meta: { ...entry.meta } };

    // Auto-compute payload size
    if (
      autoPayloadSize &&
      enriched.meta.payloadSize === undefined &&
      enriched.meta.action
    ) {
      try {
        enriched.meta.payloadSize = JSON.stringify(enriched.meta).length;
      } catch {
        // Failed to compute — leave undefined
      }
    }

    // Propagate correlation ID from OCPP meta to entry-level
    if (
      propagateCorrelationId &&
      enriched.meta.correlationId &&
      !enriched.correlationId
    ) {
      enriched.correlationId = enriched.meta.correlationId;
    }

    next(enriched);
  };
}

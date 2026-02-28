/**
 * @module voltlog-io
 * @description AsyncLocalStorage context middleware — automatically propagates
 * context across async boundaries without manual child logger threading.
 *
 * @server-only Requires Node.js 16+ (AsyncLocalStorage).
 *
 * @example
 * ```ts
 * import { createLogger, prettyTransport } from 'voltlog-io';
 * import { asyncContextMiddleware } from 'voltlog-io';
 *
 * const asyncCtx = asyncContextMiddleware();
 *
 * const logger = createLogger({
 *   middleware: [asyncCtx.middleware],
 *   transports: [prettyTransport()],
 * });
 *
 * // In Express middleware — set context once
 * app.use((req, res, next) => {
 *   asyncCtx.runInContext({ requestId: req.id, userId: req.user?.id }, next);
 * });
 *
 * // Anywhere downstream — context is automatic
 * async function processOrder(orderId: string) {
 *   logger.info('Processing', { orderId });
 *   // → auto-includes: { requestId: 'req-123', userId: 'u-42', orderId: '...' }
 *
 *   await chargePayment(orderId);
 *   logger.info('Payment charged');
 *   // → still has requestId and userId, even after await!
 * }
 * ```
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { LogMiddleware } from "../core/types.js";

export interface AsyncContextResult<TMeta = Record<string, unknown>> {
  /** Middleware to add to your logger — injects async context into entries */
  middleware: LogMiddleware<TMeta>;

  /**
   * Run a function with the given context.
   * All logs within the function (and any async calls it makes) will
   * automatically include this context in their metadata.
   */
  runInContext: (context: Record<string, unknown>, fn: () => void) => void;

  /**
   * Get the current async context, or undefined if not inside a runInContext call.
   */
  getContext: () => Record<string, unknown> | undefined;

  /**
   * Update the current async context by merging new values.
   * Only works inside a runInContext call.
   */
  updateContext: (updates: Record<string, unknown>) => void;
}

/**
 * Creates an AsyncLocalStorage-based context system.
 *
 * Returns a middleware (to add to the logger) and helper functions
 * to manage the async context.
 *
 * How it works:
 * 1. Call `runInContext({ requestId, userId }, handler)` at the start of a request
 * 2. The middleware automatically injects that context into every log entry
 * 3. Context propagates across await, setTimeout, Promise.then, etc.
 * 4. Each request gets its own isolated context (no cross-contamination)
 */
export function asyncContextMiddleware<
  TMeta = Record<string, unknown>,
>(): AsyncContextResult<TMeta> {
  const storage = new AsyncLocalStorage<Record<string, unknown>>();

  const middleware: LogMiddleware<TMeta> = (entry, next) => {
    const ctx = storage.getStore();
    if (ctx) {
      // Merge async context into entry's metadata
      const meta = entry.meta as Record<string, unknown>;
      for (const [key, value] of Object.entries(ctx)) {
        // Don't overwrite explicitly provided metadata
        if (!(key in meta)) {
          meta[key] = value;
        }
      }

      // Also set correlationId if present in context and not already set
      if (ctx.requestId && !entry.correlationId) {
        entry.correlationId = String(ctx.requestId);
      }
    }
    next(entry);
  };

  return {
    middleware,

    runInContext(context: Record<string, unknown>, fn: () => void): void {
      // If already inside a context, merge with parent
      const parentCtx = storage.getStore();
      const mergedCtx = parentCtx
        ? { ...parentCtx, ...context }
        : { ...context };
      storage.run(mergedCtx, fn);
    },

    getContext(): Record<string, unknown> | undefined {
      return storage.getStore();
    },

    updateContext(updates: Record<string, unknown>): void {
      const ctx = storage.getStore();
      if (ctx) {
        Object.assign(ctx, updates);
      }
    },
  };
}

/**
 * @module voltlog-io
 * @description Universal HTTP middleware builder. Allows integration with Express, Fastify, exact node:http, etc.
 * without introducing third-party framework dependencies.
 */

import type { Logger } from "../core/types.js";

/**
 * Extracts essential logic from a given raw HTTP Request object
 * regardless of the underlying framework (Express, Fastify, etc.)
 */
export interface HttpRequestMapper<TReq = any> {
  getMethod: (req: TReq) => string;
  getUrl: (req: TReq) => string;
  getIp?: (req: TReq) => string | undefined;
  getUserAgent?: (req: TReq) => string | undefined;
  /** Extract a particular header value */
  getHeader?: (req: TReq, name: string) => string | undefined;
}

/**
 * Extracts essential logic from a given raw HTTP Response object
 */
export interface HttpResponseMapper<TRes = any> {
  getStatusCode: (res: TRes) => number;
  /** Execute callback when response is fully sent to the client */
  onFinish: (res: TRes, callback: () => void) => void;
}

/**
 * Options for configuring the HTTP access logger
 */
export interface HttpLoggerOptions<TReq = any, TRes = any> {
  reqMapper: HttpRequestMapper<TReq>;
  resMapper: HttpResponseMapper<TRes>;
  /** Log level to use for HTTP requests (default: INFO) */
  level?: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  /** Extract specific dynamic context values from the request to add to meta */
  extractContext?: (req: TReq, res: TRes) => Record<string, unknown>;
  /** Function to skip logging certain requests (e.g., /health) */
  skip?: (req: TReq) => boolean;
}

/**
 * Common mappers for the raw Node.js `http.IncomingMessage` and `http.ServerResponse`.
 * Since Express and many others extend these objects, they work universally.
 */
export const nodeHttpMappers = {
  req: {
    getMethod: (req: any) => req.method || "UNKNOWN",
    getUrl: (req: any) => req.originalUrl || req.url || "/",
    getIp: (req: any) =>
      req.ip ||
      req.socket?.remoteAddress ||
      req.headers?.["x-forwarded-for"] ||
      undefined,
    getUserAgent: (req: any) => req.headers?.["user-agent"] || undefined,
    getHeader: (req: any, name: string) => req.headers?.[name] || undefined,
  } as HttpRequestMapper,
  res: {
    getStatusCode: (res: any) => res.statusCode || 200,
    onFinish: (res: any, callback: () => void) => {
      // Connect to standard Node events
      if (typeof res.on === "function") {
        res.on("finish", callback);
        res.on("close", callback); // Handles client disconnects
      } else {
        // Fallback for weird runtimes
        callback();
      }
    },
  } as HttpResponseMapper,
};

/**
 * Creates a generic HTTP logging middleware function.
 * Use this inside Express, Fastify, or custom routers.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createHttpLogger, nodeHttpMappers, createLogger } from 'voltlog-io';
 *
 * const app = express();
 * const logger = createLogger();
 *
 * const httpLogger = createHttpLogger(logger, {
 *   reqMapper: nodeHttpMappers.req,
 *   resMapper: nodeHttpMappers.res,
 * });
 *
 * app.use((req, res, next) => {
 *   httpLogger(req, res);
 *   next();
 * });
 * ```
 */
export function createHttpLogger<TReq = any, TRes = any>(
  logger: Logger,
  options: HttpLoggerOptions<TReq, TRes>,
) {
  const {
    reqMapper,
    resMapper,
    level = "INFO",
    skip,
    extractContext,
  } = options;

  return (req: TReq, res: TRes) => {
    if (skip?.(req)) {
      return;
    }

    const startTime = performance.now();
    let finished = false;

    // Attach listener for request completion
    resMapper.onFinish(res, () => {
      if (finished) return;
      finished = true;

      const durationMs = Math.round(performance.now() - startTime);
      const statusCode = resMapper.getStatusCode(res);
      const method = reqMapper.getMethod(req);
      const url = reqMapper.getUrl(req);

      const meta: Record<string, unknown> = {
        method,
        url,
        statusCode,
        durationMs,
        ip: reqMapper.getIp ? reqMapper.getIp(req) : undefined,
        userAgent: reqMapper.getUserAgent
          ? reqMapper.getUserAgent(req)
          : undefined,
      };

      if (extractContext) {
        Object.assign(meta, extractContext(req, res));
      }

      // Automatically elevate level for 4xx/5xx responses if default was provided
      let finalLevel = level;
      if (statusCode >= 500) finalLevel = "ERROR";
      else if (statusCode >= 400 && level === "INFO") finalLevel = "WARN";

      const methodKey = finalLevel.toLowerCase() as
        | "info"
        | "warn"
        | "error"
        | "debug"
        | "trace"
        | "fatal";

      logger[methodKey](
        `${method} ${url} - ${statusCode} (${durationMs}ms)`,
        meta,
      );
    });
  };
}

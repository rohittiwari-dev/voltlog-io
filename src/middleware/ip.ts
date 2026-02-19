/**
 * @module voltlog-io
 * @description IP middleware — extracts client IP from headers (x-forwarded-for, etc.).
 * @universal Works in any environment where headers are available in metadata.
 */

import type { LogMiddleware } from "../core/types.js";

export interface IpMiddlewareOptions {
  /**
   * Field name to store the extracted IP in `entry.meta`.
   * Default: 'ip'
   */
  fieldName?: string;

  /**
   * Custom list of headers/keys to check for IP address.
   * Default: ['x-forwarded-for', 'x-real-ip', 'req.ip', 'ip']
   */
  headerKeys?: string[];
}

/**
 * Extracts IP address from commonly used headers in `entry.meta`.
 */
export function ipMiddleware<TMeta = Record<string, unknown>>(
  options: IpMiddlewareOptions = {},
): LogMiddleware<TMeta> {
  const targetField = options.fieldName ?? "ip";
  const keysToCheck = options.headerKeys ?? [
    "x-forwarded-for",
    "x-real-ip",
    "req.ip",
    "ip",
    "x-client-ip",
  ];

  return (entry, next) => {
    const meta = entry.meta as Record<string, unknown>;
    const headers = (meta.headers || {}) as Record<string, unknown>;
    const req = (meta.req || {}) as Record<string, unknown>; // Express/Fastify request object often in meta.req

    let foundIp: string | undefined;

    // Check meta root, meta.headers, meta.req in order for each key
    for (const key of keysToCheck) {
      // 1. Check meta root
      if (typeof meta[key] === "string") {
        foundIp = meta[key] as string;
        break;
      }
      // 2. Check headers
      if (typeof headers[key] === "string") {
        foundIp = headers[key] as string;
        break;
      }
      // 3. Check req object properties (e.g. req.ip)
      if (typeof req[key] === "string") {
        foundIp = req[key] as string;
        break;
      }
      // Special case for 'req.ip' dotted notation if key is 'req.ip'
      if (key === "req.ip" && typeof req.ip === "string") {
        foundIp = req.ip as string;
        break;
      }
    }

    if (foundIp) {
      // Handle comma-separated X-Forwarded-For (take first)
      const firstIp =
        typeof foundIp === "string"
          ? foundIp.split(",")[0].trim()
          : String(foundIp);

      entry.meta = {
        ...entry.meta,
        [targetField]: firstIp,
      };
    }

    next(entry);
  };
}

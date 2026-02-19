/**
 * @module voltlog-io
 * @description User Agent middleware — parses UA strings into browser/os/device info.
 * @universal Works in all environments (Server/Browser).
 * Lightweight regex-based parsing to avoid heavy dependencies.
 */

import type { LogMiddleware } from "../core/types.js";

export interface UserAgentOptions {
  /**
   * Field to look for user agent string (source).
   * Default checks `entry.meta.userAgent`, `entry.meta['user-agent']`, or context.
   */
  sourceField?: string;

  /**
   * Field to store the parsed info (target).
   * Default: 'client'
   */
  targetField?: string;
}

/**
 * Parses user-agent string into structured data (browser, os).
 */
export function userAgentMiddleware<TMeta = Record<string, unknown>>(
  options: UserAgentOptions = {},
): LogMiddleware<TMeta> {
  const sourceField = options.sourceField;
  const targetField = options.targetField ?? "client";

  return (entry, next) => {
    const meta = entry.meta as Record<string, unknown>;
    const context = entry.context as Record<string, unknown> | undefined;

    // Find UA string
    const ua =
      (sourceField ? (meta[sourceField] as string) : undefined) ||
      (meta.userAgent as string) ||
      (meta["user-agent"] as string) ||
      (context?.userAgent as string) ||
      (context?.["user-agent"] as string);

    if (ua) {
      const info = parseUserAgent(ua);
      entry.meta = {
        ...entry.meta,
        [targetField]: info,
      };
    }

    next(entry);
  };
}

// Simple lightweight parser to avoid deps
function parseUserAgent(ua: string) {
  const browser =
    /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i.exec(ua) ||
    [];
  let name = browser[1] ? browser[1].toLowerCase() : "unknown";
  let version = browser[2] || "unknown";

  if (/trident/i.test(name)) {
    name = "ie";
  } else if (name === "chrome") {
    const edge = /edg(e)?\/(\d+)/i.exec(ua);
    if (edge) {
      name = "edge";
      version = edge[2];
    }
  }

  const osResult =
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.exec(
      ua,
    );
  const os = osResult ? osResult[0].toLowerCase() : "desktop";

  return { browser: name, version, os };
}

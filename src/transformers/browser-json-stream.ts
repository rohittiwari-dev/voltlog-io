/**
 * @module voltlog-io
 * @description Browser stream transformer — writes newline-delimited JSON to a WHATWG WritableStream.
 * @browser-only Depends on WHATWG Streams API (typical in Browsers/Edge).
 * Useful for streaming logs in browser environments (e.g. to `fetch` streams or ServiceWorkers).
 */

import type { LogEntry, LogLevelName, Transformer } from "../core/types.js";

export interface BrowserJsonStreamTransportOptions {
  /**
   * Writable stream to output to.
   * Must be a standard WHATWG WritableStream (available in modern browsers).
   */
  stream: WritableStream<string>;
  /** Per-transport level filter */
  level?: LogLevelName;
  /**
   * Custom serializer. Return the string to write.
   * Default: JSON.stringify(entry) + '\n'
   */
  serializer?: (entry: LogEntry) => string;
}

/**
 * Create a JSON stream transformer for browsers that writes to a WritableStream.
 */
export function browserJsonStreamTransport(
  options: BrowserJsonStreamTransportOptions,
): Transformer {
  const stream = options.stream;
  const writer = stream.getWriter();

  const serialize =
    options.serializer ?? ((entry: LogEntry) => `${JSON.stringify(entry)}\n`);

  return {
    name: "browser-stream",
    level: options.level,
    async transform(entry: LogEntry): Promise<void> {
      try {
        const data = serialize(entry);
        await writer.ready;
        await writer.write(data);
      } catch (err) {
        console.error("[voltlog] Failed to write to browser stream", err);
      }
    },
    async close(): Promise<void> {
      try {
        await writer.close();
      } catch (_err) {
        // Ignore close errors
      }
    },
  };
}

/**
 * @module voltlog-io
 * @description JSON stream transformer — writes newline-delimited JSON to any writable stream.
 * @server-only
 * This transport relies on Node.js-style `Writable` streams (e.g. `process.stdout`, `fs.createWriteStream`).
 * Browser streams (WHATWG Streams API) use a different interface.
 *
 * Useful for file logging, piping to external tools, etc.
 *
 * @example Write to file
 * ```ts
 * import { createWriteStream } from 'node:fs';
 * import { createLogger, jsonStreamTransport } from 'voltlog-io';
 *
 * const logger = createLogger({
 *   transports: [
 *     jsonStreamTransport({ stream: createWriteStream('./app.log', { flags: 'a' }) }),
 *   ],
 * });
 * ```
 *
 * @example Write to stdout
 * ```ts
 * const logger = createLogger({
 *   transports: [jsonStreamTransport({ stream: process.stdout })],
 * });
 * ```
 */

import type { LogEntry, LogLevelName, Transformer } from "../core/types.js";

export interface JsonStreamTransportOptions {
  /** Writable stream to output to (e.g. fs.createWriteStream, process.stdout) */
  stream: NodeJS.WritableStream;
  /** Per-transport level filter */
  level?: LogLevelName;
  /**
   * Custom serializer. Return the string to write.
   * Default: JSON.stringify(entry) + '\n'
   */
  serializer?: (entry: LogEntry) => string;
}

/**
 * Create a JSON stream transformer that writes newline-delimited JSON.
 */
export function jsonStreamTransport(
  options: JsonStreamTransportOptions,
): Transformer {
  const stream = options.stream;
  const serialize =
    options.serializer ?? ((entry: LogEntry) => `${JSON.stringify(entry)}\n`);

  return {
    name: "json-stream",
    level: options.level,
    transform(entry: LogEntry): void {
      const data = serialize(entry);
      stream.write(data);
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        if ("end" in stream && typeof stream.end === "function") {
          stream.end(() => resolve());
        } else {
          resolve();
        }
      });
    },
  };
}

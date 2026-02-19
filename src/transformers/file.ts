/**
 * @module voltlog-io
 * @description File transformer — writes logs to disk with daily rotation.
 * @server-only
 * This transport relies on the `node:fs` module to write files to the local filesystem.
 * Browsers do not have direct access to the filesystem for security reasons.
 */

import fs from "node:fs";
import path from "node:path";
import type { LogEntry, LogLevelName, Transformer } from "../core/types.js";

export interface FileTransportOptions {
  /** Directory to store logs. Created if missing. */
  dir: string;
  /**
   * Filename pattern. Use `%DATE%` for YYYY-MM-DD.
   * Default: `app-%DATE%.log`
   */
  filename?: string;
  /** Per-transport level filter */
  level?: LogLevelName;
}

/**
 * Creates a file transformer that writes newline-delimited JSON.
 * Rotates files daily based on the `%DATE%` pattern.
 */
export function fileTransport(options: FileTransportOptions): Transformer {
  const { dir, level } = options;
  const filenamePattern = options.filename ?? "app-%DATE%.log";

  let currentStream: fs.WriteStream | null = null;
  let currentPath = "";

  // Ensure directory exists synchronously on startup
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`[voltlog] Failed to create log directory: ${dir}`, err);
  }

  function getPath(): string {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = filenamePattern.replace("%DATE%", dateStr);
    return path.join(dir, filename);
  }

  function rotate(): void {
    const newPath = getPath();
    if (newPath !== currentPath) {
      if (currentStream) {
        currentStream.end();
      }
      currentPath = newPath;
      // 'a' flag for append
      currentStream = fs.createWriteStream(newPath, { flags: "a" });

      // Handle stream errors to prevent crashing the app
      currentStream.on("error", (err) => {
        console.error(`[voltlog] File write error to ${newPath}:`, err);
      });
    }
  }

  // Initialize
  rotate();

  return {
    name: "file",
    level,
    transform(entry: LogEntry): void {
      // Check rotation on every write (low overhead string comparison)
      // For extremely high throughput, this could be optimized to check only every N writes or every few seconds
      rotate();

      if (currentStream && !currentStream.writableEnded) {
        const line = `${JSON.stringify(entry)}\n`;
        currentStream.write(line);
      }
    },
    async flush(): Promise<void> {
      // Streams flush automatically on write usually, but we can try to ensure
      // limited control over fs stream flushing in Node without callbacks
      // No-op for standard fs streams as they handle backpressure internally
    },
    async close(): Promise<void> {
      if (currentStream) {
        return new Promise((resolve) => {
          currentStream?.end(() => resolve());
        });
      }
    },
  };
}

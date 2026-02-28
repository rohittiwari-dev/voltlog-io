/**
 * @module voltlog-io
 * @description File transformer — writes logs to disk with daily rotation and optional size-based rotation.
 * @server-only
 * This transport relies on the `node:fs` module to write files to the local filesystem.
 * Browsers do not have direct access to the filesystem for security reasons.
 */

import fs from "node:fs";
import path from "node:path";
import type { LogEntry, LogLevelName, Transport } from "../core/types.js";

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
  /**
   * Maximum file size in bytes before rotating to a new file.
   * When exceeded, the current file is renamed with a numeric suffix.
   * Default: no size limit (daily rotation only).
   */
  maxSize?: number;
}

/**
 * Creates a file transport that writes newline-delimited JSON.
 * Rotates files daily based on the `%DATE%` pattern and optionally by size.
 */
export function fileTransport(options: FileTransportOptions): Transport {
  const { dir, level, maxSize } = options;
  const filenamePattern = options.filename ?? "app-%DATE%.log";

  let currentStream: fs.WriteStream | null = null;
  let currentPath = "";
  let currentSize = 0;
  let rotationIndex = 0;

  // Date caching — avoid new Date() allocation on every write
  let cachedDate = "";
  let cacheExpiry = 0;

  function getCachedDate(): string {
    const now = Date.now();
    if (now >= cacheExpiry) {
      cachedDate = new Date(now).toISOString().split("T")[0] as string;
      cacheExpiry = now + 1000; // recompute every second
    }
    return cachedDate;
  }

  // Ensure directory exists synchronously on startup
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`[voltlog] Failed to create log directory: ${dir}`, err);
  }

  function getPath(sizeRotation = false): string {
    const dateStr = getCachedDate();
    const filename = filenamePattern.replace("%DATE%", dateStr);
    if (sizeRotation && rotationIndex > 0) {
      const ext = path.extname(filename);
      const base = filename.slice(0, -ext.length || undefined);
      return path.join(dir, `${base}.${rotationIndex}${ext}`);
    }
    return path.join(dir, filename);
  }

  function openStream(filePath: string): void {
    if (currentStream) {
      currentStream.end();
    }
    currentPath = filePath;
    currentSize = 0;
    currentStream = fs.createWriteStream(filePath, { flags: "a" });

    // Try to get existing file size for append mode
    try {
      const stat = fs.statSync(filePath);
      currentSize = stat.size;
    } catch {
      // File doesn't exist yet — size stays 0
    }

    currentStream.on("error", (err) => {
      console.error(`[voltlog] File write error to ${filePath}:`, err);
    });
  }

  function rotate(): void {
    const newPath = getPath();
    if (newPath !== currentPath) {
      rotationIndex = 0;
      openStream(newPath);
    }
  }

  // Initialize
  rotate();

  return {
    name: "file",
    level,
    write(entry: LogEntry): void {
      // Check date-based rotation (uses cached date — very cheap)
      rotate();

      const line = `${JSON.stringify(entry)}\n`;

      // Check size-based rotation
      if (maxSize && currentSize + line.length > maxSize) {
        rotationIndex++;
        openStream(getPath(true));
      }

      if (currentStream && !currentStream.writableEnded) {
        currentStream.write(line);
        currentSize += line.length;
      }
    },
    async flush(): Promise<void> {
      // No-op for standard fs streams — they handle backpressure internally
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

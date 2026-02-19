import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { levelOverrideMiddleware } from "../src/middleware/level-override.js";

describe("Level Override Middleware", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30, // INFO
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should upgrade level if key present in meta", () => {
    const middleware = levelOverrideMiddleware();
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      level: 30,
      levelName: "INFO",
      meta: { "x-log-level": "ERROR" },
    } as LogEntry;

    middleware(entry, next);

    expect(entry.level).toBe(50);
    expect(entry.levelName).toBe("ERROR");
    expect((entry.meta as any)["x-log-level"]).toBeUndefined(); // Cleanup default true
  });

  it("should upgrade level if key present in context", () => {
    const middleware = levelOverrideMiddleware();
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      context: { "x-log-level": "DEBUG" },
    } as LogEntry;

    middleware(entry, next);

    expect(entry.level).toBe(20);
    expect(entry.levelName).toBe("DEBUG");
  });

  it("should upgrade level if key present in headers (in meta)", () => {
    const middleware = levelOverrideMiddleware();
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      meta: { headers: { "x-log-level": "FATAL" } },
    } as LogEntry;

    middleware(entry, next);

    expect(entry.level).toBe(60);
    expect(entry.levelName).toBe("FATAL");
  });

  it("should verify custom key and cleanup behavior", () => {
    const middleware = levelOverrideMiddleware({
      key: "debug-mode",
      cleanup: false,
    });
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      meta: { "debug-mode": "TRACE" },
    } as LogEntry;

    middleware(entry, next);

    expect(entry.level).toBe(10);
    expect(entry.levelName).toBe("TRACE");
    expect((entry.meta as any)["debug-mode"]).toBe("TRACE"); // No cleanup
  });

  it("should ignore invalid level strings", () => {
    const middleware = levelOverrideMiddleware();
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      meta: { "x-log-level": "INVALID" },
    } as LogEntry;

    middleware(entry, next);

    expect(entry.level).toBe(30); // Unchanged
    expect(entry.levelName).toBe("INFO");
    expect((entry.meta as any)["x-log-level"]).toBe("INVALID"); // Not cleaned up because not used?
    // Implementation: "if (LogLevel[upperName]) { ... }"
    // So if it doesn't match, it skips everything including cleanup.
  });
});

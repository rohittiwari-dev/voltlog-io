import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { heapUsageMiddleware } from "../src/middleware/heap-usage.js";

describe("Heap Usage Middleware", () => {
  let mockEntry: LogEntry;

  beforeEach(() => {
    mockEntry = {
      id: "abc",
      level: 30,
      levelName: "INFO",
      message: "test",
      timestamp: Date.now(),
      meta: {},
    };
  });

  it("should add memory stats to meta", () => {
    const middleware = heapUsageMiddleware();
    const next = vi.fn();

    // Mock process.memoryUsage
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 100,
      heapTotal: 50,
      heapUsed: 25,
      external: 0,
      arrayBuffers: 0,
    }) as any;

    middleware(mockEntry, next);

    expect(process.memoryUsage).toHaveBeenCalled();
    expect((mockEntry.meta as any).memory).toEqual({
      rss: 100,
      heapTotal: 50,
      heapUsed: 25,
    });
    expect(next).toHaveBeenCalledWith(mockEntry);

    // Restore
    process.memoryUsage = originalMemoryUsage;
  });

  it("should use custom field name", () => {
    const middleware = heapUsageMiddleware({ fieldName: "stats" });
    const next = vi.fn();

    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 100,
      heapTotal: 50,
      heapUsed: 25,
    }) as any;

    middleware(mockEntry, next);

    expect((mockEntry.meta as any).stats).toBeDefined();
    expect((mockEntry.meta as any).memory).toBeUndefined();

    process.memoryUsage = originalMemoryUsage;
  });

  it("should gracefully handle missing process.memoryUsage", () => {
    const middleware = heapUsageMiddleware();
    const next = vi.fn();

    const originalProcess = global.process;
    (global as any).process = undefined; // Simulate browser-like env

    const entry = { ...mockEntry, meta: {} };
    middleware(entry, next);

    expect((entry.meta as any).memory).toBeUndefined();
    expect(next).toHaveBeenCalledWith(entry);

    global.process = originalProcess;
  });
});

import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { alertMiddleware } from "../src/middleware/alert.js";

describe("Alert Middleware", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 40,
    levelName: "WARN",
    message: "Something unexpected",
    timestamp: Date.now(),
    meta: {},
  };

  it("should trigger alert when rule matches", () => {
    const onAlert = vi.fn();
    const middleware = alertMiddleware([
      {
        name: "test-rule",
        when: (e) => e.level >= 40,
        onAlert,
        threshold: 1,
        windowMs: 1000,
      },
    ]);

    const next = vi.fn();
    middleware(mockEntry, next);

    expect(next).toHaveBeenCalledWith(mockEntry);
    expect(onAlert).toHaveBeenCalledWith([mockEntry]);
  });

  it("should respect threshold and window", () => {
    const onAlert = vi.fn();
    const middleware = alertMiddleware([
      {
        name: "threshold-rule",
        when: (e) => e.message === "error",
        onAlert,
        threshold: 2,
        windowMs: 100,
      },
    ]);

    const next = vi.fn();
    const errorEntry = { ...mockEntry, message: "error" };

    // 1st hit
    middleware(errorEntry, next);
    expect(onAlert).not.toHaveBeenCalled();

    // 2nd hit (triggers)
    middleware(errorEntry, next);
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith([errorEntry, errorEntry]);
  });

  it("should reset window after triggering", async () => {
    vi.useFakeTimers();
    const onAlert = vi.fn();
    const middleware = alertMiddleware([
      {
        name: "reset-rule",
        when: () => true,
        onAlert,
        threshold: 2,
        windowMs: 1000,
      },
    ]);

    const next = vi.fn();

    // 1st hit
    middleware({ ...mockEntry, timestamp: Date.now() }, next);

    // Wait for window to expire
    await vi.advanceTimersByTimeAsync(1001);

    // 2nd hit (should be new window)
    middleware({ ...mockEntry, timestamp: Date.now() }, next);
    expect(onAlert).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should handle error in onAlert gracefully", () => {
    const middleware = alertMiddleware([
      {
        name: "error-rule",
        when: () => true,
        onAlert: () => {
          throw new Error("Alert failed");
        },
        threshold: 1,
      },
    ]);

    const next = vi.fn();
    // Should not throw
    middleware(mockEntry, next);

    expect(next).toHaveBeenCalled(); // Flow continues
  });
});

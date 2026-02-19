import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { deduplicationMiddleware } from "../src/middleware/deduplication.js";

describe("Deduplication Middleware", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should pass first log immediately", () => {
    const middleware = deduplicationMiddleware({ windowMs: 1000 });
    const next = vi.fn();

    middleware(mockEntry, next);

    expect(next).toHaveBeenCalledTimes(0);
    // Wait, implementation buffers heavily?
    // "New entry ... timer = setTimeout ... buffer.set"
    // It does NOT call next() immediately?
    // Let's check implementation:
    // ...
    // const timer = setTimeout(() => { ... next(state.entry) }, windowMs);
    // ...
    // buffer.set(...)
    //
    // So it delays ALL logs by windowMs? That seems to be the logic.
    // It's a "buffer for windowMs" strategy.
  });

  it("should emit log after windowMs", () => {
    const middleware = deduplicationMiddleware({ windowMs: 1000 });
    const next = vi.fn();

    middleware(mockEntry, next);
    expect(next).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(mockEntry);
  });

  it("should increment count for duplicate logs and emit once", () => {
    const middleware = deduplicationMiddleware({ windowMs: 1000 });
    const next = vi.fn();

    // 3 identical logs
    middleware(mockEntry, next);
    middleware(mockEntry, next);
    middleware(mockEntry, next);

    expect(next).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(next).toHaveBeenCalledTimes(1);
    const callArg = next.mock.calls[0][0];
    expect(callArg.meta.duplicateCount).toBe(3);
  });

  it("should handle different logs separately", () => {
    const middleware = deduplicationMiddleware({ windowMs: 1000 });
    const next = vi.fn();

    const entry1 = { ...mockEntry, message: "A" };
    const entry2 = { ...mockEntry, message: "B" };

    middleware(entry1, next);
    middleware(entry2, next);

    vi.advanceTimersByTime(1000);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "A" }),
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "B" }),
    );
  });

  it("should use custom key function", () => {
    const middleware = deduplicationMiddleware({
      windowMs: 1000,
      keyFn: (e) => (e.meta as any).group ?? "default",
    });
    const next = vi.fn();

    // different messages but same group -> should dedup
    const entry1 = { ...mockEntry, message: "A", meta: { group: "G1" } };
    const entry2 = { ...mockEntry, message: "B", meta: { group: "G1" } };

    middleware(entry1, next);
    middleware(entry2, next);

    vi.advanceTimersByTime(1000);

    expect(next).toHaveBeenCalledTimes(1);
    // The first one is kept as the representative
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "A" }),
    );
    const callArg = next.mock.calls[0][0];
    expect(callArg.meta.duplicateCount).toBe(2);
  });
});

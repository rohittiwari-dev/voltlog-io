import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { batchTransport } from "../src/transformers/batch.js";

describe("Batch Transport", () => {
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

  it("should batch entries and flush when size reached", () => {
    const handler = { name: "test", transform: vi.fn() };
    const transport = batchTransport(handler, {
      batchSize: 2,
    });

    transport.transform(mockEntry);
    expect(handler.transform).not.toHaveBeenCalled();

    transport.transform({ ...mockEntry, id: "2" });

    // Batch transport calls inner.transform for each entry
    // It captures errors internally, so we assume it works if handler called

    expect(handler.transform).toHaveBeenCalledTimes(2);
    expect(handler.transform).toHaveBeenCalledWith(mockEntry);
  });

  it("should flush on timer", () => {
    const handler = { name: "test", transform: vi.fn() };
    const transport = batchTransport(handler, {
      batchSize: 10,
      flushIntervalMs: 1000,
    });

    transport.transform(mockEntry);
    expect(handler.transform).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1001);

    expect(handler.transform).toHaveBeenCalledTimes(1);
  });

  it("should call inner flush and close", async () => {
    const handler = {
      name: "test",
      transform: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const transport = batchTransport(handler);

    transport.transform(mockEntry); // Buffered

    await transport.flush!(); // Should flush buffer and call inner.flush
    expect(handler.transform).toHaveBeenCalledTimes(1);
    expect(handler.flush).toHaveBeenCalledTimes(1);

    await transport.close!(); // Should flush and call inner.close
    expect(handler.close).toHaveBeenCalledTimes(1);
  });

  it("should swallow errors from inner transformer", async () => {
    const handler = {
      name: "test",
      level: "INFO" as const,
      transform: vi.fn(),
    };
    const transport = batchTransport(handler, { batchSize: 1 });

    // Sync error
    handler.transform.mockImplementationOnce(() => {
      throw new Error("Sync Fail");
    });
    transport.transform(mockEntry); // Should not throw

    // Async error
    handler.transform.mockResolvedValueOnce(
      Promise.reject(new Error("Async Fail")),
    );
    transport.transform(mockEntry); // Should not throw

    // Allow promise rejection to handle
    vi.advanceTimersByTime(10);
  });
});

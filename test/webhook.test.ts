import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { webhookTransport } from "../src/transformers/webhook.js";
import { LogEntry } from "../src/core/types.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Validating Webhook Transport", () => {
  const mockEntry: LogEntry = {
    id: "test-id",
    level: 30,
    levelName: "INFO",
    message: "Test message",
    timestamp: Date.now(),
    meta: {},
  };

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should send logs immediately if batchSize is 1", async () => {
    const transport = webhookTransport({
      url: "https://api.example.com",
      batchSize: 1,
    });

    transport.transform(mockEntry);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Test message"),
      }),
    );
  });

  it("should batch logs and flush when batchSize is reached", async () => {
    const transport = webhookTransport({
      url: "https://api.example.com",
      batchSize: 2,
    });

    transport.transform(mockEntry); // 1
    transport.transform({ ...mockEntry, id: "2" }); // 2

    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.entries).toHaveLength(2);
  });

  it("should retry on failure if configured", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const transport = webhookTransport({
      url: "https://api.example.com",
      retry: true,
      maxRetries: 2,
    });

    transport.transform(mockEntry);
    await vi.runAllTimersAsync(); // Initial call

    // Retry delay is exp backoff: 1000ms
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should flush and close", async () => {
    const transport = webhookTransport({
      url: "https://api.example.com",
      batchSize: 10,
    });

    transport.transform(mockEntry);
    expect(fetchMock).not.toHaveBeenCalled();

    await transport.flush!();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Close should also flush
    transport.transform(mockEntry);
    await transport.close!();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should swallow final error after retries", async () => {
    fetchMock.mockRejectedValue(new Error("Always Fail"));
    const transport = webhookTransport({
      url: "https://api.example.com",
      retry: true,
      maxRetries: 1, // 1 retry
    });

    transport.transform(mockEntry);

    await vi.runAllTimersAsync(); // Initial
    await vi.advanceTimersByTimeAsync(2000); // Retry

    // Should have called twice (initial + 1 retry)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Should not throw unhandled rejection
  });
});

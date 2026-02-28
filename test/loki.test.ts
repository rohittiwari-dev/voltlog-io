import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { lokiTransport } from "../src/transports/loki.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Loki Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: 1600000000000, // ms
    meta: { app: "volt" },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should batch logs and flush after interval", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 2,
      interval: 1000,
    });

    transport.write(mockEntry);
    // Should NOT flush yet
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance time
    await vi.advanceTimersByTimeAsync(1000);

    // Should flush
    expect(fetchMock).toHaveBeenCalledWith(
      "http://loki:3100/loki/api/v1/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.streams).toHaveLength(1);
    expect(body.streams[0].stream).toEqual({ app: "voltlog" }); // Default label
    expect(body.streams[0].values[0][0]).toBe("1600000000000000000"); // nanoseconds
    expect(body.streams[0].values[0][1]).toContain("test");
  });

  it("should flush immediately when batch size reached", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 2,
    });

    transport.write(mockEntry);
    expect(fetchMock).not.toHaveBeenCalled();

    transport.write({ ...mockEntry, id: "def" });
    // Should flush now
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Timer should be cleared
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // No double flush
  });

  it("should add auth headers if provided", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      basicAuthUser: "user",
      basicAuthPassword: "pass",
      tenantId: "my-org",
      batchSize: 1,
    });

    transport.write(mockEntry);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toContain("Basic");
    expect(headers["X-Scope-OrgID"]).toBe("my-org");
  });

  it("should flush on close", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 10,
    });

    transport.write(mockEntry);
    expect(fetchMock).not.toHaveBeenCalled();

    await transport.close!();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should group entries by dynamic labels", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 3,
      labels: { app: "test" },
      dynamicLabels: (entry) => ({ level: entry.levelName }),
    });

    transport.write({ ...mockEntry, levelName: "INFO" });
    transport.write({ ...mockEntry, id: "b", levelName: "ERROR", level: 50 });
    transport.write({ ...mockEntry, id: "c", levelName: "INFO" });

    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Should have 2 streams: one for INFO, one for ERROR
    expect(body.streams.length).toBe(2);

    const infoStream = body.streams.find((s: any) => s.stream.level === "INFO");
    const errorStream = body.streams.find(
      (s: any) => s.stream.level === "ERROR",
    );
    expect(infoStream.values).toHaveLength(2);
    expect(errorStream.values).toHaveLength(1);
  });

  it("should include structured metadata when enabled", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 1,
      includeMetadata: true,
    });

    const entry: LogEntry = {
      ...mockEntry,
      correlationId: "corr-123",
      context: { service: "csms" },
      error: { message: "boom", name: "Error" },
    };

    transport.write(entry);
    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const logLine = JSON.parse(body.streams[0].values[0][1]);
    expect(logLine.correlationId).toBe("corr-123");
    expect(logLine.context).toEqual({ service: "csms" });
    expect(logLine.error.message).toBe("boom");
  });

  it("should exclude metadata when includeMetadata is false", async () => {
    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 1,
      includeMetadata: false,
    });

    const entry: LogEntry = {
      ...mockEntry,
      correlationId: "corr-123",
      context: { service: "csms" },
    };

    transport.write(entry);
    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const logLine = JSON.parse(body.streams[0].values[0][1]);
    expect(logLine.correlationId).toBeUndefined();
    expect(logLine.context).toBeUndefined();
  });

  it("should retry on server error", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 1,
      retry: true,
      maxRetries: 3,
    });

    transport.write(mockEntry);

    // Flush is async — advance timers to let retry backoff resolve
    await vi.advanceTimersByTimeAsync(500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should NOT retry on 4xx client errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    const transport = lokiTransport({
      host: "http://loki:3100",
      batchSize: 1,
      retry: true,
      maxRetries: 3,
    });

    transport.write(mockEntry);
    await vi.advanceTimersByTimeAsync(500);

    // Should not retry — 400 is a client error
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

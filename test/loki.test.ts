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
});

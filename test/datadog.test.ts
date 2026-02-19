import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { datadogTransport } from "../src/transports/datadog.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Datadog Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: 1600000000000,
    meta: { userId: 123 },
  };

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("should send log to Datadog API", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    const transport = datadogTransport({
      apiKey: "test-key",
      service: "my-service",
      tags: "env:prod",
    });

    await transport.write(mockEntry);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://http-intake.logs.datadoghq.com/api/v2/logs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "DD-API-KEY": "test-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        ddsource: "nodejs",
        ddtags: "env:prod",
        service: "my-service",
        message: "test",
        status: "info",
        timestamp: 1600000000000,
        userId: 123,
      }),
    );
  });

  it("should support custom site and hostname", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    const transport = datadogTransport({
      apiKey: "key",
      site: "datadoghq.eu",
      hostname: "server-1",
    });

    await transport.write(mockEntry);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://http-intake.logs.datadoghq.eu/api/v2/logs",
      expect.any(Object),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.hostname).toBe("server-1");
  });

  it("should handle fetch errors gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("Network Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const transport = datadogTransport({ apiKey: "key" });

    // Should not throw
    await transport.write(mockEntry);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Datadog push failed"),
      expect.any(Error),
    );
  });
});

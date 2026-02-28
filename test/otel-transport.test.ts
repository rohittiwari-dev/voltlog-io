import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { otelTransport } from "../src/transports/otel.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("OTel OTLP Transport", () => {
  const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: "test-id",
    level: 30,
    levelName: "INFO",
    message: "test message",
    timestamp: 1700000000000,
    meta: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should batch and send OTLP-formatted logs", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test-app",
      batchSize: 1,
    });

    transport.write(makeEntry({ message: "hello" }));

    // Let the flush run
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4318/v1/logs",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.resourceLogs).toHaveLength(1);

    const resourceLog = body.resourceLogs[0];
    const attrs = resourceLog.resource.attributes;
    expect(attrs).toContainEqual({
      key: "service.name",
      value: { stringValue: "test-app" },
    });

    const logRecord = resourceLog.scopeLogs[0].logRecords[0];
    expect(logRecord.body.stringValue).toBe("hello");
    expect(logRecord.severityNumber).toBe(9); // INFO
    expect(logRecord.severityText).toBe("INFO");
  });

  it("should map severity levels correctly", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test-app",
      batchSize: 1,
    });

    const levels = [
      { levelName: "TRACE", expected: 1 },
      { levelName: "DEBUG", expected: 5 },
      { levelName: "INFO", expected: 9 },
      { levelName: "WARN", expected: 13 },
      { levelName: "ERROR", expected: 17 },
      { levelName: "FATAL", expected: 21 },
    ] as const;

    for (const { levelName, expected } of levels) {
      fetchMock.mockClear();
      transport.write(makeEntry({ levelName }));
      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
      expect(record.severityNumber).toBe(expected);
    }
  });

  it("should include resource attributes", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "my-svc",
      resource: {
        "deployment.environment": "production",
        "service.version": "2.0.0",
      },
      batchSize: 1,
    });

    transport.write(makeEntry());
    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const attrs = body.resourceLogs[0].resource.attributes;
    expect(attrs).toContainEqual({
      key: "deployment.environment",
      value: { stringValue: "production" },
    });
    expect(attrs).toContainEqual({
      key: "service.version",
      value: { stringValue: "2.0.0" },
    });
  });

  it("should include custom headers", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      headers: { "signoz-access-token": "my-token" },
      batchSize: 1,
    });

    transport.write(makeEntry());
    await vi.advanceTimersByTimeAsync(0);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["signoz-access-token"]).toBe("my-token");
  });

  it("should attach traceId and spanId from meta", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      batchSize: 1,
    });

    transport.write(
      makeEntry({
        meta: { traceId: "abc123", spanId: "def456", traceFlags: 1 },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(record.traceId).toBe("abc123");
    expect(record.spanId).toBe("def456");
    expect(record.flags).toBe(1);
  });

  it("should batch logs and flush on interval", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      batchSize: 100,
      interval: 2000,
    });

    transport.write(makeEntry({ message: "a" }));
    transport.write(makeEntry({ message: "b" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(2);
  });

  it("should flush immediately when batch size reached", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      batchSize: 2,
    });

    transport.write(makeEntry());
    expect(fetchMock).not.toHaveBeenCalled();

    transport.write(makeEntry());
    // Flush is fire-and-forget, wait for microtask
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should include error attributes", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      batchSize: 1,
    });

    transport.write(
      makeEntry({
        error: { message: "boom", name: "Error", stack: "Error: boom\n..." },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
    expect(attrs).toContainEqual({
      key: "error.message",
      value: { stringValue: "boom" },
    });
    expect(attrs).toContainEqual({
      key: "error.type",
      value: { stringValue: "Error" },
    });
  });

  it("should flush on close", async () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
      batchSize: 100,
    });

    transport.write(makeEntry());
    expect(fetchMock).not.toHaveBeenCalled();

    await transport.close!();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should append /v1/logs to endpoint", async () => {
    const transport = otelTransport({
      endpoint: "https://ingest.signoz.io/",
      serviceName: "test",
      batchSize: 1,
    });

    transport.write(makeEntry());
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock.mock.calls[0][0]).toBe("https://ingest.signoz.io/v1/logs");
  });

  it("should have correct transport name", () => {
    const transport = otelTransport({
      endpoint: "http://localhost:4318",
      serviceName: "test",
    });
    expect(transport.name).toBe("otel");
  });
});

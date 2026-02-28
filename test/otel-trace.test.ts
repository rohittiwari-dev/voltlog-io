import { describe, expect, it } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { otelTraceMiddleware } from "../src/middleware/otel-trace.js";

describe("OTel Trace Middleware", () => {
  const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: "test-id",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
    ...overrides,
  });

  it("should inject traceId and spanId when OTel span is active", () => {
    // Simulate a fake OTel API with an active span
    const fakeTraceApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({
            traceId: "abc123def456",
            spanId: "span789",
            traceFlags: 1,
          }),
        }),
      },
    };

    const middleware = otelTraceMiddleware({ traceApi: fakeTraceApi });
    const entry = makeEntry();
    let passedEntry: LogEntry | null = null;

    middleware(entry, (e) => {
      passedEntry = e;
    });

    expect(passedEntry).not.toBeNull();
    const meta = passedEntry!.meta as Record<string, unknown>;
    expect(meta.traceId).toBe("abc123def456");
    expect(meta.spanId).toBe("span789");
    expect(meta.traceFlags).toBe(1);
  });

  it("should set correlationId to traceId", () => {
    const fakeTraceApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({
            traceId: "trace-123",
            spanId: "span-456",
            traceFlags: 0,
          }),
        }),
      },
    };

    const middleware = otelTraceMiddleware({ traceApi: fakeTraceApi });
    const entry = makeEntry();

    middleware(entry, () => {});

    expect(entry.correlationId).toBe("trace-123");
  });

  it("should NOT overwrite existing correlationId", () => {
    const fakeTraceApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({
            traceId: "trace-new",
            spanId: "span-456",
            traceFlags: 0,
          }),
        }),
      },
    };

    const middleware = otelTraceMiddleware({ traceApi: fakeTraceApi });
    const entry = makeEntry();
    entry.correlationId = "existing-id";

    middleware(entry, () => {});

    expect(entry.correlationId).toBe("existing-id");
  });

  it("should be a no-op when no active span", () => {
    const fakeTraceApi = {
      trace: {
        getActiveSpan: () => null,
      },
    };

    const middleware = otelTraceMiddleware({ traceApi: fakeTraceApi });
    const entry = makeEntry();

    middleware(entry, () => {});

    const meta = entry.meta as Record<string, unknown>;
    expect(meta.traceId).toBeUndefined();
    expect(meta.spanId).toBeUndefined();
  });

  it("should be a no-op when no traceApi provided and SDK not installed", () => {
    // No traceApi option — and @opentelemetry/api is not installed in dev
    const middleware = otelTraceMiddleware();
    const entry = makeEntry();

    middleware(entry, () => {});

    const meta = entry.meta as Record<string, unknown>;
    expect(meta.traceId).toBeUndefined();
    // Should still call next (not drop the entry)
  });

  it("should always call next even if OTel fails", () => {
    const fakeTraceApi = {
      trace: {
        getActiveSpan: () => {
          throw new Error("OTel crashed");
        },
      },
    };

    const middleware = otelTraceMiddleware({ traceApi: fakeTraceApi });
    const entry = makeEntry();
    let nextCalled = false;

    middleware(entry, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

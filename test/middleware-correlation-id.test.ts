import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { correlationIdMiddleware } from "../src/middleware/correlation-id.js";

describe("Correlation ID Middleware", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should generate new ID if missing", () => {
    const middleware = correlationIdMiddleware();
    const next = vi.fn();
    const entry = { ...mockEntry, meta: {} };

    middleware(entry, next);

    expect(entry.correlationId).toBeDefined();
    expect((entry.meta as any).correlationId).toBe(entry.correlationId);
  });

  it("should use existing ID from entry property", () => {
    const middleware = correlationIdMiddleware();
    const next = vi.fn();
    const entry = { ...mockEntry, correlationId: "existing-id" };

    middleware(entry, next);

    expect(entry.correlationId).toBe("existing-id");
    // Should NOT have overwritten meta if it wasn't there?
    // Implementation check: if entry.correlationId exists, it returns next(entry) immediately.
    expect((entry.meta as any).correlationId).toBeUndefined();
  });

  it("should extract ID from meta (standard keys)", () => {
    const middleware = correlationIdMiddleware();
    const next = vi.fn();
    const entry = { ...mockEntry, meta: { traceId: "trace-123" } };

    middleware(entry, next);

    expect(entry.correlationId).toBe("trace-123");
    expect((entry.meta as any).correlationId).toBe("trace-123");
  });

  it("should extract ID from custom header", () => {
    const middleware = correlationIdMiddleware({ header: "x-request-id" });
    const next = vi.fn();
    const entry = {
      ...mockEntry,
      meta: { "x-request-id": "req-abc" },
    };

    middleware(entry, next);

    expect(entry.correlationId).toBe("req-abc");
    expect((entry.meta as any).correlationId).toBe("req-abc");
  });

  it("should use custom generator", () => {
    const middleware = correlationIdMiddleware({
      generator: () => "custom-gen-id",
    });
    const next = vi.fn();
    const entry = { ...mockEntry, meta: {} };

    middleware(entry, next);

    expect(entry.correlationId).toBe("custom-gen-id");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { ipMiddleware } from "../src/middleware/ip.js";

describe("IP Middleware", () => {
  const mockEntry: LogEntry = {
    id: "test-id",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should extract IP from meta root", () => {
    const middleware = ipMiddleware();
    const entry = { ...mockEntry, meta: { "x-forwarded-for": "1.2.3.4" } };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBe("1.2.3.4");
    expect(next).toHaveBeenCalledWith(entry);
  });

  it("should extract IP from headers", () => {
    const middleware = ipMiddleware();
    const entry = {
      ...mockEntry,
      meta: { headers: { "x-real-ip": "5.6.7.8" } },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBe("5.6.7.8");
  });

  it("should extract IP from req object", () => {
    const middleware = ipMiddleware();
    const entry = {
      ...mockEntry,
      meta: { req: { ip: "9.10.11.12" } },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBe("9.10.11.12");
  });

  it("should prioritize keys in order (meta > headers > req)", () => {
    const middleware = ipMiddleware();
    const entry = {
      ...mockEntry,
      meta: {
        "x-forwarded-for": "1.1.1.1",
        headers: { "x-forwarded-for": "2.2.2.2" },
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBe("1.1.1.1");
  });

  it("should handle comma-separated IPs (take first)", () => {
    const middleware = ipMiddleware();
    const entry = {
      ...mockEntry,
      meta: { headers: { "x-forwarded-for": "10.0.0.1, 192.168.1.1" } },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBe("10.0.0.1");
  });

  it("should support custom field name", () => {
    const middleware = ipMiddleware({ fieldName: "client_ip" });
    const entry = { ...mockEntry, meta: { "x-client-ip": "127.0.0.1" } };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client_ip).toBe("127.0.0.1");
    // Should not set default 'ip'
    expect((entry.meta as any).ip).toBeUndefined();
  });

  it("should ignore non-string values", () => {
    const middleware = ipMiddleware();
    const entry = {
      ...mockEntry,
      meta: { headers: { "x-forwarded-for": 12345 } }, // Number should be ignored
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).ip).toBeUndefined();
  });
});

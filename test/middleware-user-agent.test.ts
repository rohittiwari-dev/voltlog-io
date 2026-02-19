import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { userAgentMiddleware } from "../src/middleware/user-agent.js";

describe("User-Agent Middleware", () => {
  const mockEntry: LogEntry = {
    id: "test-id",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should parse Chrome UA", () => {
    const middleware = userAgentMiddleware();
    const entry = {
      ...mockEntry,
      meta: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client).toBeDefined();
    expect((entry.meta as any).client.browser).toBe("chrome");
    expect((entry.meta as any).client.version).toBe("91");
    expect((entry.meta as any).client.os).toBe("desktop");
  });

  it("should parse Firefox UA", () => {
    const middleware = userAgentMiddleware();
    const entry = {
      ...mockEntry,
      meta: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client.browser).toBe("firefox");
    expect((entry.meta as any).client.version).toBe("89");
  });

  it("should identify mobile devices", () => {
    const middleware = userAgentMiddleware();
    const entry = {
      ...mockEntry,
      meta: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client.os).toContain("iphone");
  });

  it("should support custom source field", () => {
    const middleware = userAgentMiddleware({ sourceField: "custom_ua" });
    const entry = {
      ...mockEntry,
      meta: {
        custom_ua:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client.browser).toBe("chrome");
  });

  it("should support custom target field", () => {
    const middleware = userAgentMiddleware({ targetField: "device_info" });
    const entry = {
      ...mockEntry,
      meta: {
        userAgent: "Mozilla/5.0",
      },
    };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).device_info).toBeDefined();
    expect((entry.meta as any).client).toBeUndefined();
  });

  it("should handle missing UA gracefully", () => {
    const middleware = userAgentMiddleware();
    const entry = { ...mockEntry, meta: {} };
    const next = vi.fn();

    middleware(entry, next);

    expect((entry.meta as any).client).toBeUndefined();
    expect(next).toHaveBeenCalledWith(entry);
  });
});

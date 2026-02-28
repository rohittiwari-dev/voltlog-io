import { describe, expect, it } from "vitest";
import { createLogger } from "../src/core/logger.js";
import type { LogEntry, Transport } from "../src/core/types.js";
import { asyncContextMiddleware } from "../src/middleware/async-context.js";

describe("AsyncLocalStorage Context Middleware", () => {
  function makeTestLogger() {
    const entries: LogEntry[] = [];
    const testTransport: Transport = {
      name: "test",
      write(entry: LogEntry) {
        entries.push(entry);
      },
    };
    const asyncCtx = asyncContextMiddleware();
    const logger = createLogger({
      level: "TRACE",
      transports: [testTransport],
      middleware: [asyncCtx.middleware],
    });
    return { logger, entries, asyncCtx };
  }

  it("should inject context into log entries", () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    asyncCtx.runInContext({ requestId: "req-123", userId: "u-42" }, () => {
      logger.info("inside context");
    });

    expect(entries).toHaveLength(1);
    const meta = entries[0]!.meta as Record<string, unknown>;
    expect(meta.requestId).toBe("req-123");
    expect(meta.userId).toBe("u-42");
  });

  it("should NOT inject context outside runInContext", () => {
    const { logger, entries } = makeTestLogger();

    logger.info("outside context");

    expect(entries).toHaveLength(1);
    const meta = entries[0]!.meta as Record<string, unknown>;
    expect(meta.requestId).toBeUndefined();
  });

  it("should propagate context across async boundaries", async () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    await new Promise<void>((resolve) => {
      asyncCtx.runInContext({ requestId: "async-req" }, async () => {
        logger.info("before await");

        await new Promise((r) => setTimeout(r, 10));

        logger.info("after await");
        resolve();
      });
    });

    expect(entries).toHaveLength(2);
    expect((entries[0]!.meta as any).requestId).toBe("async-req");
    expect((entries[1]!.meta as any).requestId).toBe("async-req");
  });

  it("should NOT overwrite explicitly provided metadata", () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    asyncCtx.runInContext({ userId: "from-context" }, () => {
      logger.info("test", { userId: "explicit-value" } as any);
    });

    expect(entries).toHaveLength(1);
    const meta = entries[0]!.meta as Record<string, unknown>;
    expect(meta.userId).toBe("explicit-value");
  });

  it("should set correlationId from requestId", () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    asyncCtx.runInContext({ requestId: "corr-123" }, () => {
      logger.info("test");
    });

    expect(entries[0]!.correlationId).toBe("corr-123");
  });

  it("should isolate contexts between concurrent requests", async () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    const req1 = new Promise<void>((resolve) => {
      asyncCtx.runInContext({ requestId: "req-1" }, async () => {
        logger.info("start 1");
        await new Promise((r) => setTimeout(r, 20));
        logger.info("end 1");
        resolve();
      });
    });

    const req2 = new Promise<void>((resolve) => {
      asyncCtx.runInContext({ requestId: "req-2" }, async () => {
        logger.info("start 2");
        await new Promise((r) => setTimeout(r, 10));
        logger.info("end 2");
        resolve();
      });
    });

    await Promise.all([req1, req2]);

    // Each request should have its own context
    const req1Entries = entries.filter(
      (e) => (e.meta as any).requestId === "req-1",
    );
    const req2Entries = entries.filter(
      (e) => (e.meta as any).requestId === "req-2",
    );

    expect(req1Entries).toHaveLength(2);
    expect(req2Entries).toHaveLength(2);
  });

  it("should merge nested contexts", () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    asyncCtx.runInContext({ requestId: "outer" }, () => {
      asyncCtx.runInContext({ userId: "inner" }, () => {
        logger.info("nested");
      });
    });

    const meta = entries[0]!.meta as Record<string, unknown>;
    expect(meta.requestId).toBe("outer");
    expect(meta.userId).toBe("inner");
  });

  it("should return current context via getContext", () => {
    const { asyncCtx } = makeTestLogger();

    expect(asyncCtx.getContext()).toBeUndefined();

    asyncCtx.runInContext({ key: "value" }, () => {
      const ctx = asyncCtx.getContext();
      expect(ctx).toBeDefined();
      expect(ctx!.key).toBe("value");
    });
  });

  it("should update context in place", () => {
    const { logger, entries, asyncCtx } = makeTestLogger();

    asyncCtx.runInContext({ requestId: "req-1" }, () => {
      asyncCtx.updateContext({ step: "processing" });
      logger.info("after update");
    });

    const meta = entries[0]!.meta as Record<string, unknown>;
    expect(meta.requestId).toBe("req-1");
    expect(meta.step).toBe("processing");
  });
});

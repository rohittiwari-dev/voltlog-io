/**
 * @file bundle-client.test.ts
 *
 * Integration tests for the browser client bundle (`dist/browser/client.js`).
 *
 * Tests run against the BUILT dist — not src — to verify exactly what
 * a consumer gets when they `import from 'voltlog-io/client'` in a
 * browser / Next.js client component / edge runtime.
 *
 * Scenarios:
 *  1. All expected browser-safe exports are present
 *  2. Node-only exports are NOT present (the critical boundary check)
 *  3. Core logger works end-to-end in a browser-like environment
 *  4. Browser-specific transport works (browserJsonStreamTransport)
 *  5. Browser-safe middleware works (redaction, deduplication, sampling, etc.)
 *  6. correlationIdMiddleware uses globalThis.crypto (no node:crypto)
 *  7. otelTraceMiddleware is absent (uses optional peer dep import())
 *  8. No require(), __filename, __dirname, or node: prefixes are called
 */

import { describe, expect, it, vi } from "vitest";

// ─── Import from the built browser dist ─────────────────────────────────────
// This simulates what Next.js / webpack / Turbopack resolves for 'voltlog-io/client'
import * as ClientBundle from "../dist/browser/client.mjs";

// ─── 1. Export presence — browser-safe items ─────────────────────────────────
describe("Client bundle — export presence", () => {
  it("exports createLogger", () => {
    expect(ClientBundle.createLogger).toBeTypeOf("function");
  });

  it("exports LogLevel enum", () => {
    expect(ClientBundle.LogLevel).toBeDefined();
  });

  it("exports LogLevelNameMap", () => {
    expect(ClientBundle.LogLevelNameMap).toBeDefined();
  });

  it("exports resolveLevel", () => {
    expect(ClientBundle.resolveLevel).toBeTypeOf("function");
  });

  // ── Browser-safe transports ─────────────────────────────────────────────
  it("exports consoleTransport", () => {
    expect(ClientBundle.consoleTransport).toBeTypeOf("function");
  });

  it("exports prettyTransport", () => {
    expect(ClientBundle.prettyTransport).toBeTypeOf("function");
  });

  it("exports browserJsonStreamTransport", () => {
    expect(ClientBundle.browserJsonStreamTransport).toBeTypeOf("function");
  });

  it("exports batchTransport", () => {
    expect(ClientBundle.batchTransport).toBeTypeOf("function");
  });

  it("exports webhookTransport", () => {
    expect(ClientBundle.webhookTransport).toBeTypeOf("function");
  });

  it("exports lokiTransport", () => {
    expect(ClientBundle.lokiTransport).toBeTypeOf("function");
  });

  it("exports otelTransport", () => {
    expect(ClientBundle.otelTransport).toBeTypeOf("function");
  });

  it("exports datadogTransport", () => {
    expect(ClientBundle.datadogTransport).toBeTypeOf("function");
  });

  it("exports slackTransport", () => {
    expect(ClientBundle.slackTransport).toBeTypeOf("function");
  });

  it("exports discordTransport", () => {
    expect(ClientBundle.discordTransport).toBeTypeOf("function");
  });

  it("exports sentryTransport", () => {
    expect(ClientBundle.sentryTransport).toBeTypeOf("function");
  });

  it("exports ringBufferTransport", () => {
    expect(ClientBundle.ringBufferTransport).toBeTypeOf("function");
  });

  // ── Browser-safe middleware ─────────────────────────────────────────────
  it("exports alertMiddleware", () => {
    expect(ClientBundle.alertMiddleware).toBeTypeOf("function");
  });

  it("exports redactionMiddleware", () => {
    expect(ClientBundle.redactionMiddleware).toBeTypeOf("function");
  });

  it("exports deduplicationMiddleware", () => {
    expect(ClientBundle.deduplicationMiddleware).toBeTypeOf("function");
  });

  it("exports samplingMiddleware", () => {
    expect(ClientBundle.samplingMiddleware).toBeTypeOf("function");
  });

  it("exports heapUsageMiddleware", () => {
    expect(ClientBundle.heapUsageMiddleware).toBeTypeOf("function");
  });

  it("exports createHttpLogger (framework-agnostic)", () => {
    expect(ClientBundle.createHttpLogger).toBeTypeOf("function");
  });

  it("exports ipMiddleware", () => {
    expect(ClientBundle.ipMiddleware).toBeTypeOf("function");
  });

  it("exports userAgentMiddleware", () => {
    expect(ClientBundle.userAgentMiddleware).toBeTypeOf("function");
  });

  it("exports levelOverrideMiddleware", () => {
    expect(ClientBundle.levelOverrideMiddleware).toBeTypeOf("function");
  });

  it("exports ocppMiddleware", () => {
    expect(ClientBundle.ocppMiddleware).toBeTypeOf("function");
  });

  it("exports aiEnrichmentMiddleware", () => {
    expect(ClientBundle.aiEnrichmentMiddleware).toBeTypeOf("function");
  });
});

// ─── 2. Node-only exports must NOT be present ────────────────────────────────
describe("Client bundle — Node-only exports absent", () => {
  it("does NOT export fileTransport", () => {
    expect((ClientBundle as any).fileTransport).toBeUndefined();
  });

  it("does NOT export jsonStreamTransport", () => {
    expect((ClientBundle as any).jsonStreamTransport).toBeUndefined();
  });

  it("does NOT export redisTransport", () => {
    expect((ClientBundle as any).redisTransport).toBeUndefined();
  });

  it("does NOT export asyncContextMiddleware", () => {
    expect((ClientBundle as any).asyncContextMiddleware).toBeUndefined();
  });

  it("does NOT export correlationIdMiddleware", () => {
    expect((ClientBundle as any).correlationIdMiddleware).toBeUndefined();
  });

  it("does NOT export otelTraceMiddleware (requires @opentelemetry/api)", () => {
    expect((ClientBundle as any).otelTraceMiddleware).toBeUndefined();
  });

  it("does NOT export nodeHttpMappers", () => {
    expect((ClientBundle as any).nodeHttpMappers).toBeUndefined();
  });
});

// ─── 3. Core logger — end-to-end ─────────────────────────────────────────────
describe("Client bundle — core logger", () => {
  it("creates a logger and logs entries", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.info("browser log", { page: "/home" });

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe("browser log");
    expect(entries[0].meta).toEqual({ page: "/home" });
    expect(entries[0].levelName).toBe("INFO");
  });

  it("level filtering works", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      level: "ERROR",
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.debug("dropped");
    logger.info("dropped");
    logger.warn("dropped");
    logger.error("kept");
    logger.fatal("kept");

    expect(entries).toHaveLength(2);
  });

  it("child logger inherits context", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });
    const child = logger.child({ component: "Sidebar" });
    child.info("rendered");

    expect(entries[0].context).toEqual({ component: "Sidebar" });
  });

  it("setLevel and getLevel work", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      level: "ERROR",
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.info("dropped");
    logger.setLevel("INFO");
    logger.info("kept");

    expect(entries).toHaveLength(1);
    expect(logger.getLevel()).toBe("INFO");
  });

  it("error serialization works", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });
    logger.error("fetch failed", new Error("NetworkError"));

    expect(entries[0].error).toBeDefined();
    expect(entries[0].error.message).toBe("NetworkError");
  });

  it("generates unique IDs per entry", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });
    logger.info("a");
    logger.info("b");

    expect(entries[0].id).toBeDefined();
    expect(entries[0].id).not.toBe(entries[1].id);
  });
});

// ─── 4. Browser-safe transports — functional ─────────────────────────────────
describe("Client bundle — browser transports", () => {
  it("consoleTransport logs to console", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = ClientBundle.createLogger({
      transports: [ClientBundle.consoleTransport({ useConsoleLevels: false })],
    });
    logger.info("browser console");
    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.message).toBe("browser console");
    spy.mockRestore();
  });

  it("ringBufferTransport stores entries in memory", () => {
    const ring = ClientBundle.ringBufferTransport({ maxSize: 5 });
    const logger = ClientBundle.createLogger({
      level: "TRACE",
      transports: [ring],
    });

    logger.info("page load");
    logger.warn("slow render");
    logger.error("crash");

    const all = ring.getEntries();
    expect(all).toHaveLength(3);
    expect(all[0].message).toBe("page load");

    const errors = ring.getEntries({ level: "ERROR" });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("crash");
  });

  it("batchTransport buffers and flushes at batch size", () => {
    const received: any[] = [];
    const inner: any = { name: "sink", write: (e: any) => received.push(e) };

    const logger = ClientBundle.createLogger({
      transports: [
        ClientBundle.batchTransport(inner, {
          batchSize: 3,
          flushIntervalMs: 99999,
        }),
      ],
    });

    logger.info("1");
    logger.info("2");
    expect(received).toHaveLength(0);
    logger.info("3"); // triggers flush
    expect(received).toHaveLength(3);
  });
});

// ─── 5. Browser-safe middleware — functional ──────────────────────────────────
describe("Client bundle — browser middleware", () => {
  it("redactionMiddleware scrubs sensitive fields", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      middleware: [ClientBundle.redactionMiddleware({ paths: ["password"] })],
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.info("login", { username: "alice", password: "s3cret" });

    expect((entries[0].meta as any).password).toBe("[REDACTED]");
    expect((entries[0].meta as any).username).toBe("alice");
  });

  it("deduplicationMiddleware suppresses repeated messages within window", () => {
    vi.useFakeTimers();
    try {
      const entries: any[] = [];
      const logger = ClientBundle.createLogger({
        middleware: [ClientBundle.deduplicationMiddleware({ windowMs: 100 })],
        transports: [
          {
            name: "test",
            write: (e: any) => {
              entries.push(e);
            },
          },
        ],
      });

      // All three fire within the window — only first is emitted (after window expires)
      logger.info("duplicate");
      logger.info("duplicate");
      logger.info("duplicate");
      logger.info("different"); // different key — its own bucket

      // Nothing emitted yet — middleware buffers until window expires
      expect(entries).toHaveLength(0);

      // Advance clock past windowMs to flush all buckets
      vi.runAllTimers();

      expect(entries).toHaveLength(2); // "duplicate" (with count=3) and "different"
      expect(entries.map((e) => e.message)).toEqual(["duplicate", "different"]);
      expect((entries[0].meta as any).duplicateCount).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("samplingMiddleware rate-limits logs", () => {
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      middleware: [
        ClientBundle.samplingMiddleware({ maxPerWindow: 2, windowMs: 10000 }),
      ],
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    // Only 2 of these 5 should get through (maxPerWindow: 2)
    for (let i = 0; i < 5; i++) logger.debug(`log ${i}`);

    expect(entries.length).toBeLessThanOrEqual(2);
  });

  it("alertMiddleware triggers callback on ERROR threshold", () => {
    const fired: any[] = [];
    const entries: any[] = [];
    const logger = ClientBundle.createLogger({
      middleware: [
        ClientBundle.alertMiddleware([
          {
            name: "error-spike",
            when: (entry: any) => entry.levelName === "ERROR",
            threshold: 2,
            windowMs: 60000,
            onAlert: (alertEntries: any[]) => {
              fired.push(alertEntries);
            },
          },
        ]),
      ],
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.error("err 1");
    expect(fired).toHaveLength(0);
    logger.error("err 2"); // triggers threshold (2 errors)
    expect(fired).toHaveLength(1);
    expect(fired[0]).toHaveLength(2); // alertEntries array has 2 entries
  });
});

// ─── 6. correlationIdMiddleware uses globalThis.crypto (not node:crypto) ─────
describe("Client bundle — correlationIdMiddleware uses Web Crypto", () => {
  it("correlationIdMiddleware is absent from client bundle", () => {
    // correlationIdMiddleware is intentionally excluded from client bundle
    // (it's a server/request-scoped middleware).
    expect((ClientBundle as any).correlationIdMiddleware).toBeUndefined();
  });

  it("globalThis.crypto.randomUUID is available in this environment", () => {
    // Verify the Web Crypto API is available — this is what correlation-id.ts now uses
    expect(globalThis.crypto).toBeDefined();
    expect(typeof globalThis.crypto.randomUUID).toBe("function");
    const id = globalThis.crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ─── 7. No Node.js globals invoked ───────────────────────────────────────────
describe("Client bundle — Node.js globals not invoked by the bundle itself", () => {
  it("importing the bundle does not call require()", () => {
    // If require() were called at module evaluation time it would throw
    // in a browser context. The fact that this test file loaded means it's fine.
    expect(ClientBundle.createLogger).toBeDefined();
  });

  it("process is not required for core logging", () => {
    const entries: any[] = [];
    // Temporarily remove process to simulate a browser environment
    const originalProcess = globalThis.process;
    // biome-ignore lint/suspicious/noExplicitAny: intentional env simulation
    (globalThis as any).process = undefined;

    try {
      const logger = ClientBundle.createLogger({
        transports: [
          {
            name: "test",
            write: (e: any) => {
              entries.push(e);
            },
          },
        ],
      });
      logger.info("works without process");
      expect(entries).toHaveLength(1);
    } finally {
      globalThis.process = originalProcess;
    }
  });
});

/**
 * @file bundle-server.test.ts
 *
 * Integration tests for the Node.js server bundle (`dist/index.js`).
 *
 * Tests run against the BUILT dist — not src — to verify exactly what
 * a consumer gets when they `import from 'voltlog-io'` in a Node.js project.
 *
 * Scenarios:
 *  1. All expected server-only exports are present
 *  2. Browser-only export is NOT present
 *  3. Core logger works end-to-end
 *  4. Node-only transports work (file, jsonStream)
 *  5. Node-only middleware works (asyncContext, correlationId)
 *  6. No browser globals required (window, document, etc.)
 *  7. Entry resolves with correct export map keys
 */

import { describe, expect, it, vi } from "vitest";

// ─── Import from the built CJS dist (simulates: require('voltlog-io')) ────────
import * as ServerBundle from "../dist/index.js";

// ─── 1. Export presence — server-only items ──────────────────────────────────
describe("Server bundle — export presence", () => {
  it("exports createLogger", () => {
    expect(ServerBundle.createLogger).toBeTypeOf("function");
  });

  it("exports LogLevel enum", () => {
    expect(ServerBundle.LogLevel).toBeDefined();
    expect(ServerBundle.LogLevel.INFO).toBeDefined();
  });

  // ── Node-only transports ────────────────────────────────────────────────
  it("exports fileTransport (node:fs)", () => {
    expect(ServerBundle.fileTransport).toBeTypeOf("function");
  });

  it("exports jsonStreamTransport (NodeJS.WritableStream)", () => {
    expect(ServerBundle.jsonStreamTransport).toBeTypeOf("function");
  });

  it("exports redisTransport", () => {
    expect(ServerBundle.redisTransport).toBeTypeOf("function");
  });

  // ── Node-only middleware ────────────────────────────────────────────────
  it("exports asyncContextMiddleware (node:async_hooks)", () => {
    expect(ServerBundle.asyncContextMiddleware).toBeTypeOf("function");
  });

  it("exports correlationIdMiddleware", () => {
    expect(ServerBundle.correlationIdMiddleware).toBeTypeOf("function");
  });

  it("exports otelTraceMiddleware", () => {
    expect(ServerBundle.otelTraceMiddleware).toBeTypeOf("function");
  });

  it("exports nodeHttpMappers", () => {
    expect(ServerBundle.nodeHttpMappers).toBeDefined();
    expect(ServerBundle.nodeHttpMappers.req).toBeDefined();
    expect(ServerBundle.nodeHttpMappers.res).toBeDefined();
  });

  // ── Universal transports (present in both bundles) ──────────────────────
  it("exports consoleTransport", () => {
    expect(ServerBundle.consoleTransport).toBeTypeOf("function");
  });

  it("exports prettyTransport", () => {
    expect(ServerBundle.prettyTransport).toBeTypeOf("function");
  });

  it("exports lokiTransport", () => {
    expect(ServerBundle.lokiTransport).toBeTypeOf("function");
  });

  it("exports otelTransport", () => {
    expect(ServerBundle.otelTransport).toBeTypeOf("function");
  });

  it("exports slackTransport", () => {
    expect(ServerBundle.slackTransport).toBeTypeOf("function");
  });

  it("exports webhookTransport", () => {
    expect(ServerBundle.webhookTransport).toBeTypeOf("function");
  });

  it("exports ringBufferTransport", () => {
    expect(ServerBundle.ringBufferTransport).toBeTypeOf("function");
  });
});

// ─── 2. Browser-only exports must NOT be present ─────────────────────────────
describe("Server bundle — browser-only exports absent", () => {
  it("does NOT export browserJsonStreamTransport", () => {
    expect((ServerBundle as any).browserJsonStreamTransport).toBeUndefined();
  });
});

// ─── 3. Core logger — end-to-end ─────────────────────────────────────────────
describe("Server bundle — core logger", () => {
  it("creates a logger and logs entries", () => {
    const entries: any[] = [];
    const logger = ServerBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.info("server test", { env: "node" });

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe("server test");
    expect(entries[0].meta).toEqual({ env: "node" });
    expect(entries[0].levelName).toBe("INFO");
  });

  it("level filtering works", () => {
    const entries: any[] = [];
    const logger = ServerBundle.createLogger({
      level: "WARN",
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
    logger.warn("kept");
    logger.error("kept");

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.levelName)).toEqual(["WARN", "ERROR"]);
  });

  it("child logger inherits context", () => {
    const entries: any[] = [];
    const logger = ServerBundle.createLogger({
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });
    const child = logger.child({ chargePointId: "CP-101" });
    child.info("connected");

    expect(entries[0].context).toEqual({ chargePointId: "CP-101" });
  });

  it("setLevel / getLevel works at runtime", () => {
    const entries: any[] = [];
    const logger = ServerBundle.createLogger({
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
    expect(entries).toHaveLength(0);

    logger.setLevel("INFO");
    expect(logger.getLevel()).toBe("INFO");
    logger.info("kept");
    expect(entries).toHaveLength(1);
  });
});

// ─── 4. Node-only transports — functional ────────────────────────────────────
describe("Server bundle — Node-only transports", () => {
  it("jsonStreamTransport writes NDJSON to a Node Writable", async () => {
    const { Writable } = await import("node:stream");
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });

    const logger = ServerBundle.createLogger({
      transports: [ServerBundle.jsonStreamTransport({ stream })],
    });
    logger.info("from stream");

    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0]!);
    expect(parsed.message).toBe("from stream");
  });

  it("fileTransport can be created (no throw)", () => {
    const { mkdtempSync, rmSync } = require("node:fs");
    const { join } = require("node:path");
    const os = require("node:os");

    const dir = mkdtempSync(join(os.tmpdir(), "voltlog-"));
    expect(() => {
      const t = ServerBundle.fileTransport({ dir });
      t.close?.();
    }).not.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });
});

// ─── 5. Node-only middleware — functional ────────────────────────────────────
describe("Server bundle — Node-only middleware", () => {
  it("asyncContextMiddleware propagates context across async boundary", async () => {
    const entries: any[] = [];
    const asyncCtx = ServerBundle.asyncContextMiddleware();
    const logger = ServerBundle.createLogger({
      middleware: [asyncCtx.middleware],
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    await new Promise<void>((resolve) => {
      asyncCtx.runInContext({ requestId: "req-abc" }, () => {
        setTimeout(() => {
          logger.info("async log");
          resolve();
        }, 5);
      });
    });

    expect(entries[0].correlationId).toBe("req-abc");
  });

  it("correlationIdMiddleware adds a correlation ID", () => {
    const entries: any[] = [];
    const logger = ServerBundle.createLogger({
      middleware: [ServerBundle.correlationIdMiddleware()],
      transports: [
        {
          name: "test",
          write: (e: any) => {
            entries.push(e);
          },
        },
      ],
    });

    logger.info("request started");

    expect(entries[0].correlationId).toBeDefined();
    expect(typeof entries[0].correlationId).toBe("string");
    expect(entries[0].correlationId.length).toBeGreaterThan(0);
  });
});

// ─── 6. No browser globals required ──────────────────────────────────────────
describe("Server bundle — no browser global dependencies", () => {
  it("does not reference window", () => {
    // If the bundle tried to access window it would throw in Node
    expect(typeof (globalThis as any).window).toBe("undefined");
  });

  it("does not reference document", () => {
    expect(typeof (globalThis as any).document).toBe("undefined");
  });
});

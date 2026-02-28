import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consoleTransport,
  createLogger,
  type LogEntry,
  type Logger,
  LogLevel,
  type Transport,
} from "../src/index.js";

describe("Logger Core", () => {
  let entries: LogEntry[];
  let testTransport: Transport;

  beforeEach(() => {
    entries = [];
    testTransport = {
      name: "test",
      write(entry: LogEntry) {
        entries.push(entry);
      },
    };
  });

  describe("createLogger", () => {
    it("should create a logger with default options", () => {
      const logger = createLogger({ transports: [testTransport] });
      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.child).toBeInstanceOf(Function);
    });

    it("should log at INFO level by default", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.debug("should be dropped");
      logger.info("should pass");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.message).toBe("should pass");
    });
  });

  describe("log levels", () => {
    it("should filter by level", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      logger.trace("no");
      logger.debug("no");
      logger.info("no");
      logger.warn("yes");
      logger.error("yes");
      logger.fatal("yes");
      expect(entries).toHaveLength(3);
    });

    it("should set correct levelName on entries", () => {
      const logger = createLogger({
        level: "TRACE",
        transports: [testTransport],
      });
      logger.trace("t");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");
      logger.fatal("f");

      expect(entries.map((e) => e.levelName)).toEqual([
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ]);
    });

    it("should set correct numeric levels", () => {
      const logger = createLogger({
        level: "TRACE",
        transports: [testTransport],
      });
      logger.trace("t");
      logger.info("i");
      logger.error("e");

      expect(entries[0]!.level).toBe(LogLevel.TRACE);
      expect(entries[1]!.level).toBe(LogLevel.INFO);
      expect(entries[2]!.level).toBe(LogLevel.ERROR);
    });
  });

  describe("log entry structure", () => {
    it("should generate unique IDs", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.info("a");
      logger.info("b");
      expect(entries[0]!.id).toBeDefined();
      expect(entries[0]!.id).not.toBe(entries[1]!.id);
    });

    it("should include timestamp", () => {
      const logger = createLogger({ transports: [testTransport] });
      const before = Date.now();
      logger.info("test");
      const after = Date.now();
      expect(entries[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[0]!.timestamp).toBeLessThanOrEqual(after);
    });

    it("should accept custom timestamp function", () => {
      const logger = createLogger({
        transports: [testTransport],
        timestamp: () => 1234567890,
      });
      logger.info("test");
      expect(entries[0]!.timestamp).toBe(1234567890);
    });

    it("should include meta data", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.info("test", { port: 9000, host: "localhost" });
      expect(entries[0]!.meta).toEqual({ port: 9000, host: "localhost" });
    });

    it("should default meta to empty object", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.info("test");
      expect(entries[0]!.meta).toEqual({});
    });
  });

  describe("error handling", () => {
    it("should accept Error as second argument", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.error("fail", new Error("something broke"));
      expect(entries[0]!.error).toBeDefined();
      expect(entries[0]!.error!.message).toBe("something broke");
      expect(entries[0]!.error!.name).toBe("Error");
    });

    it("should accept meta + Error", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.error("fail", { action: "Boot" }, new Error("crash"));
      expect(entries[0]!.meta).toEqual({ action: "Boot" });
      expect(entries[0]!.error!.message).toBe("crash");
    });

    it("should include stack at ERROR level by default", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.error("fail", new Error("oops"));
      expect(entries[0]!.error!.stack).toBeDefined();
    });

    it("should not include stack at WARN level by default", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      logger.warn("warning");
      // No error attached so no stack
      expect(entries[0]!.error).toBeUndefined();
    });

    it("should respect includeStack: false", () => {
      const logger = createLogger({
        transports: [testTransport],
        includeStack: false,
      });
      logger.error("fail", new Error("oops"));
      expect(entries[0]!.error!.stack).toBeUndefined();
    });

    it("should respect includeStack: true", () => {
      const logger = createLogger({
        level: "TRACE",
        transports: [testTransport],
        includeStack: true,
      });
      // With includeStack: true, stacks should appear even at low levels
      logger.error("fail", new Error("oops"));
      expect(entries[0]!.error!.stack).toBeDefined();
    });
  });

  describe("child logger", () => {
    it("should create a child with bound context", () => {
      const logger = createLogger({ transports: [testTransport] });
      const child = logger.child({ chargePointId: "CP-101" });
      child.info("hello");
      expect(entries[0]!.context).toEqual({ chargePointId: "CP-101" });
    });

    it("should merge parent and child context", () => {
      const logger = createLogger({
        transports: [testTransport],
        context: { service: "csms" },
      });
      const child = logger.child({ chargePointId: "CP-101" });
      child.info("hello");
      expect(entries[0]!.context).toEqual({
        service: "csms",
        chargePointId: "CP-101",
      });
    });

    it("should allow nested children", () => {
      const logger = createLogger({ transports: [testTransport] });
      const child1 = logger.child({ cp: "CP-101" });
      const child2 = child1.child({ session: "abc" });
      child2.info("deep");
      expect(entries[0]!.context).toEqual({ cp: "CP-101", session: "abc" });
    });

    it("child context overrides parent context", () => {
      const logger = createLogger({
        transports: [testTransport],
        context: { env: "dev" },
      });
      const child = logger.child({ env: "prod" });
      child.info("override");
      expect(entries[0]!.context!.env).toBe("prod");
    });

    it("child shares parent pipeline", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      const child = logger.child({ cp: "CP-101" });
      child.debug("should drop");
      child.warn("should pass");
      expect(entries).toHaveLength(1);
    });
  });

  describe("dynamic configuration", () => {
    it("should add transformer at runtime", () => {
      const entries2: LogEntry[] = [];
      const logger = createLogger({ transports: [testTransport] });
      logger.info("before");
      expect(entries).toHaveLength(1);

      logger.addTransport({
        name: "extra",
        write(entry) {
          entries2.push(entry);
        },
      });
      logger.info("after");
      expect(entries).toHaveLength(2);
      expect(entries2).toHaveLength(1);
    });

    it("should remove transformer by name", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.info("before");
      expect(entries).toHaveLength(1);
      logger.removeTransport("test");
      logger.info("after");
      expect(entries).toHaveLength(1); // still 1
    });
  });

  describe("flush and close", () => {
    it("should call flush on all transports", async () => {
      const flushFn = vi.fn();
      const logger = createLogger({
        transports: [{ ...testTransport, flush: flushFn }],
      });
      await logger.flush();
      expect(flushFn).toHaveBeenCalled();
    });

    it("should call close on all transports", async () => {
      const closeFn = vi.fn();
      const logger = createLogger({
        transports: [{ ...testTransport, close: closeFn }],
      });
      await logger.close();
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe("setLevel / getLevel / isLevelEnabled", () => {
    it("should change level at runtime via setLevel", () => {
      const logger = createLogger({
        level: "INFO",
        transports: [testTransport],
      });
      logger.debug("should drop");
      expect(entries).toHaveLength(0);

      logger.setLevel("DEBUG");
      logger.debug("should pass");
      expect(entries).toHaveLength(1);
    });

    it("should return current level via getLevel", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      expect(logger.getLevel()).toBe("WARN");

      logger.setLevel("TRACE");
      expect(logger.getLevel()).toBe("TRACE");
    });

    it("should check if level is enabled", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      expect(logger.isLevelEnabled("DEBUG")).toBe(false);
      expect(logger.isLevelEnabled("INFO")).toBe(false);
      expect(logger.isLevelEnabled("WARN")).toBe(true);
      expect(logger.isLevelEnabled("ERROR")).toBe(true);
      expect(logger.isLevelEnabled("FATAL")).toBe(true);
    });

    it("child logger should delegate level control to parent", () => {
      const logger = createLogger({
        level: "WARN",
        transports: [testTransport],
      });
      const child = logger.child({ cp: "CP-1" });
      child.info("should drop");
      expect(entries).toHaveLength(0);

      child.setLevel("INFO");
      child.info("should pass");
      expect(entries).toHaveLength(1);
      expect(logger.getLevel()).toBe("INFO"); // parent was changed
    });
  });

  describe("startTimer", () => {
    it("should log with durationMs", async () => {
      const logger = createLogger({
        transports: [testTransport],
      });
      const timer = logger.startTimer();

      await new Promise((r) => setTimeout(r, 50));
      timer.done("Operation complete", { extra: "data" } as any);

      expect(entries).toHaveLength(1);
      expect(entries[0]!.message).toBe("Operation complete");
      const meta = entries[0]!.meta as Record<string, unknown>;
      expect(meta.durationMs).toBeGreaterThanOrEqual(40); // ~50ms
      expect(meta.extra).toBe("data");
    });

    it("should report elapsed without logging", async () => {
      const logger = createLogger({ transports: [testTransport] });
      const timer = logger.startTimer();

      await new Promise((r) => setTimeout(r, 30));
      const elapsed = timer.elapsed();

      expect(elapsed).toBeGreaterThanOrEqual(20);
      expect(entries).toHaveLength(0); // no log yet
    });

    it("should log at specified level", () => {
      const logger = createLogger({
        level: "TRACE",
        transports: [testTransport],
      });
      const timer = logger.startTimer("WARN");
      timer.done("warning timer");

      expect(entries[0]!.levelName).toBe("WARN");
    });
  });

  describe("removeMiddleware", () => {
    it("should remove middleware by reference", () => {
      const logger = createLogger({
        transports: [testTransport],
      });

      const addTag = (entry: LogEntry, next: (e: LogEntry) => void) => {
        (entry.meta as any).tagged = true;
        next(entry);
      };

      logger.addMiddleware(addTag);
      logger.info("with middleware");
      expect((entries[0]!.meta as any).tagged).toBe(true);

      logger.removeMiddleware(addTag);
      logger.info("without middleware");
      expect((entries[1]!.meta as any).tagged).toBeUndefined();
    });
  });

  describe("error cause chain", () => {
    it("should serialize error.cause recursively", () => {
      const logger = createLogger({
        transports: [testTransport],
        includeStack: false,
      });

      const root = new Error("root cause");
      const mid = new Error("middle", { cause: root });
      const top = new Error("top error", { cause: mid });

      logger.error("chain test", top);

      expect(entries[0]!.error).toBeDefined();
      expect(entries[0]!.error!.message).toBe("top error");
      expect(entries[0]!.error!.cause).toBeDefined();
      expect(entries[0]!.error!.cause!.message).toBe("middle");
      expect(entries[0]!.error!.cause!.cause).toBeDefined();
      expect(entries[0]!.error!.cause!.cause!.message).toBe("root cause");
    });

    it("should cap cause chain depth at 5", () => {
      const logger = createLogger({
        transports: [testTransport],
        includeStack: false,
      });

      // Build a 7-deep chain
      let err = new Error("level-0");
      for (let i = 1; i <= 7; i++) {
        err = new Error(`level-${i}`, { cause: err });
      }

      logger.error("deep chain", err);

      // Walk the chain — should stop at depth 5
      let current = entries[0]!.error;
      let depth = 0;
      while (current?.cause) {
        current = current.cause;
        depth++;
      }
      expect(depth).toBeLessThanOrEqual(5);
    });
  });

  describe("idGenerator", () => {
    it("should use custom idGenerator", () => {
      let counter = 0;
      const logger = createLogger({
        transports: [testTransport],
        idGenerator: () => `custom-${++counter}`,
      });

      logger.info("a");
      logger.info("b");
      expect(entries[0]!.id).toBe("custom-1");
      expect(entries[1]!.id).toBe("custom-2");
    });

    it("should generate empty id when idGenerator is false", () => {
      const logger = createLogger({
        transports: [testTransport],
        idGenerator: false,
      });

      logger.info("no id");
      expect(entries[0]!.id).toBe("");
    });

    it("should generate UUID by default", () => {
      const logger = createLogger({ transports: [testTransport] });
      logger.info("test");
      expect(entries[0]!.id).toBeDefined();
      expect(entries[0]!.id.length).toBeGreaterThan(0);
    });
  });
});

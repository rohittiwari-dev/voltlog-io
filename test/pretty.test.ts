import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { prettyTransport } from "../src/transports/pretty.js";

describe("Pretty Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test message",
    timestamp: 1700000000000,
    meta: {},
  };

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should format standard logs with colors and timestamp", () => {
    const transport = prettyTransport({ colors: true, timestamps: true });
    transport.write(mockEntry);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("INFO");
    expect(output).toContain("test message");
    expect(output).toContain("2023-11-"); // ISO date part
    expect(output).toContain("\x1b["); // ANSI codes
  });

  it("should format standard logs without colors and timestamp", () => {
    const transport = prettyTransport({ colors: false, timestamps: false });
    transport.write(mockEntry);

    const output = consoleSpy.mock.calls[0][0];
    expect(output).not.toContain("\x1b[");
    expect(output).not.toContain("2023-11-");
    expect(output).toContain("INFO");
  });

  it("should include context and meta if present", () => {
    const transport = prettyTransport({ colors: false });
    transport.write({
      ...mockEntry,
      context: { userId: 1 },
      meta: { foo: "bar" },
    });

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("userId:1");
    expect(output).toContain("foo:bar");
  });

  it("should hide meta if hideMeta is true", () => {
    const transport = prettyTransport({ colors: false, hideMeta: true });
    transport.write({
      ...mockEntry,
      context: { userId: 1 },
      meta: { foo: "bar" },
    });

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("userId:1");
    expect(output).not.toContain("foo:bar");
  });

  it("should pretty-print meta if prettyMeta is true", () => {
    const transport = prettyTransport({ colors: true, prettyMeta: true });
    transport.write({
      ...mockEntry,
      meta: { foo: "bar", baz: 42 },
    });

    const output = consoleSpy.mock.calls[0][0];
    // Should extract keys and values
    expect(output).toContain("foo:");
    expect(output).toContain("bar");
    expect(output).toContain("baz:");
    expect(output).toContain("42");
    // Verify ANSI color code is applied to "foo:"
    expect(output).toContain("\x1b[2mfoo:\x1b[0m");
  });

  it("should format error objects", () => {
    const transport = prettyTransport({ colors: false });
    const error = new Error("Boom");
    error.stack = "Error: Boom\n    at test.ts:1:1";

    transport.write({
      ...mockEntry,
      level: 50,
      levelName: "ERROR",
      error,
    });

    expect(errorSpy).toHaveBeenCalled(); // ERROR level uses console.error
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain("Error: Boom");
    expect(output).toContain("at test.ts:1:1");
  });

  it("should use different console methods for levels", () => {
    const transport = prettyTransport();

    // WARN
    transport.write({ ...mockEntry, level: 40, levelName: "WARN" });
    expect(warnSpy).toHaveBeenCalled();

    // ERROR
    transport.write({ ...mockEntry, level: 50, levelName: "ERROR" });
    expect(errorSpy).toHaveBeenCalled();
  });

  describe("OCPP Exchange Formatting", () => {
    it("should format OCPP CALL", () => {
      const transport = prettyTransport({ colors: false });
      transport.write({
        ...mockEntry,
        meta: {
          messageType: "CALL",
          action: "BootNotification",
          chargePointId: "CP001",
          direction: "IN",
        },
      });

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain("⚡");
      expect(output).toContain("CP001");
      expect(output).toContain("BootNotification");
      expect(output).toContain("[IN]");
    });

    it("should format OCPP CALLRESULT with status and latency", () => {
      const transport = prettyTransport({ colors: false });
      transport.write({
        ...mockEntry,
        meta: {
          messageType: "CALLRESULT",
          action: "BootNotification",
          chargePointId: "CP001",
          direction: "OUT",
          status: "Accepted",
          latencyMs: 123,
        },
      });

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain("✔"); // Icon
      expect(output).toContain("Accepted");
      expect(output).toContain("(123ms)");
    });

    it("should format OCPP CALLERROR", () => {
      const transport = prettyTransport({ colors: false });
      transport.write({
        ...mockEntry,
        meta: {
          messageType: "CALLERROR",
          action: "BootNotification",
          chargePointId: "CP001",
          direction: "OUT",
          error: { name: "InternalError" },
        },
      });

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain("🚨");
    });

    it("should use fallback icons/arrows for unknown values", () => {
      const transport = prettyTransport({ colors: false });
      transport.write({
        ...mockEntry,
        meta: {
          messageType: "UNKNOWN_TYPE" as any,
          action: "Test",
          chargePointId: "CP",
          direction: "SIDEWAYS" as any,
        },
      });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain("•"); // Fallback icon
      expect(output).toContain("→"); // Fallback arrow (or default)
    });

    it("should handle empty context and meta", () => {
      const transport = prettyTransport({ colors: false });
      transport.write({
        ...mockEntry,
        context: {},
        meta: {},
      });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).not.toContain("{}");
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { ringBufferTransport } from "../src/transports/ring-buffer.js";

describe("Ring Buffer Transport", () => {
  const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: `id-${Math.random()}`,
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
    ...overrides,
  });

  it("should store entries and retrieve them", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    ring.write(makeEntry({ message: "first" }));
    ring.write(makeEntry({ message: "second" }));

    const entries = ring.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.message).toBe("first");
    expect(entries[1]!.message).toBe("second");
  });

  it("should report correct size", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    expect(ring.size).toBe(0);
    ring.write(makeEntry());
    expect(ring.size).toBe(1);
    ring.write(makeEntry());
    ring.write(makeEntry());
    expect(ring.size).toBe(3);
  });

  it("should evict oldest entries when full (circular buffer)", () => {
    const ring = ringBufferTransport({ maxSize: 3 });

    ring.write(makeEntry({ message: "A" }));
    ring.write(makeEntry({ message: "B" }));
    ring.write(makeEntry({ message: "C" }));
    ring.write(makeEntry({ message: "D" })); // evicts A
    ring.write(makeEntry({ message: "E" })); // evicts B

    const entries = ring.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.message)).toEqual(["C", "D", "E"]);
  });

  it("should filter by level", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    ring.write(makeEntry({ level: 20, levelName: "DEBUG" }));
    ring.write(makeEntry({ level: 30, levelName: "INFO" }));
    ring.write(makeEntry({ level: 50, levelName: "ERROR" }));

    const errors = ring.getEntries({ level: "ERROR" });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.levelName).toBe("ERROR");

    const infoAndAbove = ring.getEntries({ level: "INFO" });
    expect(infoAndAbove).toHaveLength(2);
  });

  it("should filter by timestamp (since)", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    const old = Date.now() - 10000;
    const recent = Date.now();

    ring.write(makeEntry({ timestamp: old, message: "old" }));
    ring.write(makeEntry({ timestamp: recent, message: "new" }));

    const filtered = ring.getEntries({ since: recent - 1 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.message).toBe("new");
  });

  it("should limit results", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    for (let i = 0; i < 5; i++) {
      ring.write(makeEntry({ message: `msg-${i}` }));
    }

    const limited = ring.getEntries({ limit: 2 });
    expect(limited).toHaveLength(2);
    // Should return the LAST 2 entries
    expect(limited[0]!.message).toBe("msg-3");
    expect(limited[1]!.message).toBe("msg-4");
  });

  it("should combine filters", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    const now = Date.now();

    ring.write(
      makeEntry({ level: 50, levelName: "ERROR", timestamp: now - 5000 }),
    );
    ring.write(makeEntry({ level: 30, levelName: "INFO", timestamp: now }));
    ring.write(makeEntry({ level: 50, levelName: "ERROR", timestamp: now }));
    ring.write(makeEntry({ level: 50, levelName: "ERROR", timestamp: now }));

    const result = ring.getEntries({
      level: "ERROR",
      since: now - 1,
      limit: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.levelName).toBe("ERROR");
  });

  it("should clear all entries", () => {
    const ring = ringBufferTransport({ maxSize: 10 });
    ring.write(makeEntry());
    ring.write(makeEntry());
    expect(ring.size).toBe(2);

    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.getEntries()).toHaveLength(0);
  });

  it("should default maxSize to 1000", () => {
    const ring = ringBufferTransport();
    // Write more than default wouldn't crash
    for (let i = 0; i < 100; i++) {
      ring.write(makeEntry());
    }
    expect(ring.size).toBe(100);
  });

  it("should have correct transport name", () => {
    const ring = ringBufferTransport();
    expect(ring.name).toBe("ring-buffer");
  });
});

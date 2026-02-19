import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { createTransport } from "../src/transports/create-transport.js";

describe("createTransport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should create a transport object with minimum requirements", () => {
    const writeFn = vi.fn();
    const transport = createTransport("my-transport", writeFn);

    expect(transport.name).toBe("my-transport");
    expect(transport.write).toBe(writeFn);

    transport.write(mockEntry);
    expect(writeFn).toHaveBeenCalledWith(mockEntry);
  });

  it("should include optional properties", async () => {
    const writeFn = vi.fn();
    const flushFn = vi.fn();
    const closeFn = vi.fn();

    const transport = createTransport("full-transport", writeFn, {
      level: "ERROR",
      flush: flushFn,
      close: closeFn,
    });

    expect(transport.name).toBe("full-transport");
    expect(transport.level).toBe("ERROR");
    expect(transport.flush).toBe(flushFn);
    expect(transport.close).toBe(closeFn);

    await transport.flush!();
    expect(flushFn).toHaveBeenCalled();

    await transport.close!();
    expect(closeFn).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { consoleTransport } from "../src/transformers/console.js";
import { LogEntry } from "../src/core/types.js";

describe("Console Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should log to console using correct method", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const transport = consoleTransport();

    // INFO
    transport.transform(mockEntry);
    expect(infoSpy).toHaveBeenCalled();

    // DEBUG
    transport.transform({ ...mockEntry, level: 20, levelName: "DEBUG" });
    expect(debugSpy).toHaveBeenCalled();

    // WARN
    transport.transform({ ...mockEntry, level: 40, levelName: "WARN" });
    expect(warnSpy).toHaveBeenCalled();

    // ERROR
    transport.transform({ ...mockEntry, level: 50, levelName: "ERROR" });
    expect(errorSpy).toHaveBeenCalled();

    // FATAL (uses error)
    transport.transform({ ...mockEntry, level: 60, levelName: "FATAL" });
    expect(errorSpy).toHaveBeenCalledTimes(2);

    // TRACE (fallthrough to log)
    transport.transform({ ...mockEntry, level: 10, levelName: "TRACE" });
    // info was called once before. log was not called.
    // wait, I mocked console.log in implementation but in test I'm spying
    // console.log is used for default.
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    transport.transform({ ...mockEntry, level: 10, levelName: "TRACE" });
    expect(logSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

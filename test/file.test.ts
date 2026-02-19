import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { fileTransport } from "../src/transports/file.js";

// Mock fs
vi.mock("node:fs");

describe("File Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test message",
    timestamp: Date.now(),
    meta: {},
  };

  const mockDir = "/logs";
  let writeStreamMock: any;

  beforeEach(() => {
    vi.resetAllMocks();

    writeStreamMock = {
      write: vi.fn(),
      end: vi.fn((cb) => cb?.()),
      on: vi.fn(),
      writableEnded: false,
    };

    (fs.createWriteStream as any).mockReturnValue(writeStreamMock);
    (fs.mkdirSync as any).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create directory on startup", () => {
    fileTransport({ dir: mockDir });
    expect(fs.mkdirSync).toHaveBeenCalledWith(mockDir, { recursive: true });
  });

  it("should write to file with correct name", () => {
    const transport = fileTransport({ dir: mockDir });
    transport.write(mockEntry);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const expectedPath = path.join(mockDir, `app-${dateStr}.log`);

    expect(fs.createWriteStream).toHaveBeenCalledWith(expectedPath, {
      flags: "a",
    });
    expect(writeStreamMock.write).toHaveBeenCalledWith(
      expect.stringContaining('"message":"test message"'),
    );
    expect(writeStreamMock.write).toHaveBeenCalledWith(
      expect.stringContaining("\n"),
    );
  });

  it("should rotate file if date changes", () => {
    // 1. Initial write
    const transport = fileTransport({ dir: mockDir });
    transport.write(mockEntry);
    expect(fs.createWriteStream).toHaveBeenCalledTimes(1);

    // 2. Mock time travel to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.useFakeTimers();
    vi.setSystemTime(tomorrow);

    // 3. Write again
    transport.write(mockEntry);
    expect(fs.createWriteStream).toHaveBeenCalledTimes(2);

    // Should have closed old stream
    expect(writeStreamMock.end).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should handle write errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fileTransport({ dir: mockDir });

    const errorHandler = (writeStreamMock.on as any).mock.calls.find(
      (c: any) => c[0] === "error",
    )[1];

    errorHandler(new Error("Disk full"));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("File write error"),
      expect.any(Error),
    );
  });

  it("should close stream on close", async () => {
    const transport = fileTransport({ dir: mockDir });
    await transport.close!();
    expect(writeStreamMock.end).toHaveBeenCalled();
  });
});

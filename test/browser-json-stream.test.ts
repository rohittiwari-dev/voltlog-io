import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { browserJsonStreamTransport } from "../src/transports/browser-json-stream.js";

describe("Browser JSON Stream Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 30,
    levelName: "INFO",
    message: "test",
    timestamp: Date.now(),
    meta: {},
  };

  it("should write to stream using writer", async () => {
    const writerMock = {
      write: vi.fn(),
      close: vi.fn(),
      ready: Promise.resolve(),
    };
    const streamMock = {
      getWriter: vi.fn().mockReturnValue(writerMock),
    };

    const transport = browserJsonStreamTransport({
      stream: streamMock as any,
    });

    await transport.write(mockEntry);

    expect(streamMock.getWriter).toHaveBeenCalled();
    expect(writerMock.write).toHaveBeenCalledWith(
      expect.stringContaining('"message":"test"'),
    );
    expect(writerMock.write).toHaveBeenCalledWith(
      expect.stringContaining("\n"),
    );
  });

  it("should use custom serializer", async () => {
    const writerMock = {
      write: vi.fn(),
      close: vi.fn(),
      ready: Promise.resolve(),
    };
    const streamMock = {
      getWriter: vi.fn().mockReturnValue(writerMock),
    };

    const transport = browserJsonStreamTransport({
      stream: streamMock as any,
      serializer: (e) => `[${e.levelName}] ${e.message}`,
    });

    await transport.write(mockEntry);

    expect(writerMock.write).toHaveBeenCalledWith("[INFO] test");
  });

  it("should close the writer on close", async () => {
    const writerMock = {
      write: vi.fn(),
      close: vi.fn(),
      ready: Promise.resolve(),
    };
    const streamMock = {
      getWriter: vi.fn().mockReturnValue(writerMock),
    };

    const transport = browserJsonStreamTransport({
      stream: streamMock as any,
    });

    await transport.close!();

    expect(writerMock.close).toHaveBeenCalled();
  });
});

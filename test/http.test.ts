import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogLevel } from "../src/core/types.js";
import { createHttpLogger, HttpLoggerOptions } from "../src/middleware/http.js";

describe("createHttpLogger", () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    };
  });

  const mockMapper: HttpLoggerOptions<any, any> = {
    reqMapper: {
      getMethod: () => "GET",
      getUrl: () => "/api/test",
      getIp: () => "127.0.0.1",
      getUserAgent: () => "TestAgent/1.0",
      getHeader: (req, name) => req.headers[name],
    },
    resMapper: {
      getStatusCode: (res) => res.status,
      onFinish: (res, cb) => cb(), // Immediately fire for testing
    },
  };

  it("should log request basics on finish", () => {
    const httpLogger = createHttpLogger(mockLogger, mockMapper);

    httpLogger({ headers: {} }, { status: 200 });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(/GET \/api\/test \- 200 \(\d+ms\)/),
      expect.objectContaining({
        method: "GET",
        url: "/api/test",
        statusCode: 200,
        ip: "127.0.0.1",
        userAgent: "TestAgent/1.0",
      }),
    );
  });

  it("should auto-elevate log level for 500 errors", () => {
    const httpLogger = createHttpLogger(mockLogger, mockMapper);

    httpLogger({ headers: {} }, { status: 500 });

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should auto-elevate log level for 400 errors if level is INFO", () => {
    const httpLogger = createHttpLogger(mockLogger, mockMapper);

    httpLogger({ headers: {} }, { status: 404 });

    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should respect skip option", () => {
    const httpLogger = createHttpLogger(mockLogger, {
      ...mockMapper,
      skip: () => true,
    });

    httpLogger({ headers: {} }, { status: 200 });

    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should extract dynamic context", () => {
    const httpLogger = createHttpLogger(mockLogger, {
      ...mockMapper,
      extractContext: (req) => ({ traceId: req.headers["x-trace-id"] }),
    });

    httpLogger({ headers: { "x-trace-id": "abc-123" } }, { status: 200 });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ traceId: "abc-123" }),
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { sentryTransport } from "../src/transports/sentry.js";

describe("Sentry Transport", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 50,
    levelName: "ERROR",
    message: "Critical Error",
    timestamp: 1600000000000,
    meta: { user: "admin" },
    context: { trace: "123" },
    error: new Error("Boom"),
  };

  const sentryMock = {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should capture exception for errors", () => {
    const transport = sentryTransport({
      sentry: sentryMock,
      errorLevel: "ERROR",
    });

    transport.write(mockEntry);

    expect(sentryMock.captureException).toHaveBeenCalledWith(
      mockEntry.error,
      expect.objectContaining({
        extra: {
          user: "admin",
          context: { trace: "123" },
        },
        level: "error",
      }),
    );
  });

  it("should capture message if no error object present", () => {
    const transport = sentryTransport({
      sentry: sentryMock,
      errorLevel: "ERROR",
    });

    const entry = { ...mockEntry, error: undefined };
    transport.write(entry);

    expect(sentryMock.captureMessage).toHaveBeenCalledWith(
      "Critical Error",
      "error",
    );
  });

  it("should add breadcrumbs for info logs", () => {
    const transport = sentryTransport({
      sentry: sentryMock,
      breadcrumbLevel: "INFO",
    });

    const infoEntry = {
      ...mockEntry,
      level: 30,
      levelName: "INFO" as const,
      message: "User Logged In",
      error: undefined,
    };

    transport.write(infoEntry);

    expect(sentryMock.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "log",
        message: "User Logged In",
        level: "info",
        timestamp: 1600000000,
      }),
    );
  });

  it("should respect level filters", () => {
    const transport = sentryTransport({
      sentry: sentryMock,
      errorLevel: "ERROR", // 50
      breadcrumbLevel: "WARN", // 40
    });

    // INFO (30) - Should be ignored completely
    transport.write({ ...mockEntry, level: 30, levelName: "INFO" as const });
    expect(sentryMock.captureException).not.toHaveBeenCalled();
    expect(sentryMock.addBreadcrumb).not.toHaveBeenCalled();

    // WARN (40) - Breadcrumb only
    transport.write({ ...mockEntry, level: 40, levelName: "WARN" as const });
    expect(sentryMock.captureException).not.toHaveBeenCalled();
    expect(sentryMock.addBreadcrumb).toHaveBeenCalledTimes(1);
  });
});

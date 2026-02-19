import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import {
  aiEnrichmentMiddleware,
  createOpenAiErrorAnalyzer,
} from "../src/middleware/ai-enrichment.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("AI Enrichment Middleware", () => {
  const mockEntry: LogEntry = {
    id: "abc",
    level: 50,
    levelName: "ERROR",
    message: "Critical failure",
    timestamp: Date.now(),
    meta: {},
  };

  it("should skip logs below threshold level", async () => {
    const middleware = aiEnrichmentMiddleware({
      level: "ERROR",
      analyzer: vi.fn(),
    });
    const next = vi.fn();
    const entry = { ...mockEntry, level: 30, levelName: "INFO" as const };

    await middleware(entry, next);

    expect(next).toHaveBeenCalledWith(entry);
    // Analyzer should not be called
  });

  it("should Call analyzer and attach result to meta", async () => {
    const analyzer = vi.fn().mockResolvedValue("Analysis result");
    const middleware = aiEnrichmentMiddleware({
      level: "ERROR",
      analyzer,
      targetField: "analysis",
    });
    const next = vi.fn();

    await middleware(mockEntry, next);

    expect(analyzer).toHaveBeenCalledWith(mockEntry);
    expect((mockEntry.meta as any).analysis).toBe("Analysis result");
    expect(next).toHaveBeenCalledWith(mockEntry);
  });

  it("should handle timeout", async () => {
    const analyzer = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "Too slow";
    });
    const middleware = aiEnrichmentMiddleware({
      level: "ERROR",
      analyzer,
      timeout: 10, // Very short timeout
      swallowErrors: true,
    });
    const next = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await middleware(mockEntry, next);

    // Should proceed without attaching result
    expect((mockEntry.meta as any).ai_analysis).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("should swallow errors if configured", async () => {
    const analyzer = vi.fn().mockRejectedValue(new Error("API Error"));
    const middleware = aiEnrichmentMiddleware({
      level: "ERROR",
      analyzer,
      swallowErrors: true,
    });
    const next = vi.fn();

    await middleware(mockEntry, next);

    expect(next).toHaveBeenCalled(); // Flow continues
  });

  it("should throw errors if swallowErrors is false", async () => {
    const analyzer = vi.fn().mockRejectedValue(new Error("API Error"));
    const middleware = aiEnrichmentMiddleware({
      level: "ERROR",
      analyzer,
      swallowErrors: false,
    });
    const next = vi.fn();

    await expect(middleware(mockEntry, next)).rejects.toThrow("API Error");
  });
});

describe("createOpenAiErrorAnalyzer", () => {
  it("should return analysis on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "It's a bug." } }],
      }),
    });

    const analyzer = createOpenAiErrorAnalyzer("fake-key");
    const result = await analyzer({
      message: "Error",
      meta: {},
    } as any);

    expect(result).toBe("It's a bug.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fake-key",
        }),
      }),
    );
  });

  it("should return null on API failure", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    const analyzer = createOpenAiErrorAnalyzer("fake-key");
    const result = await analyzer({ message: "Error", meta: {} } as any);

    expect(result).toBeNull();
  });
});

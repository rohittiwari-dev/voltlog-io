import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { slackTransport } from "../src/transformers/slack.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Slack Transformer", () => {
  const mockEntry: LogEntry = {
    id: "test-id",
    level: 50,
    levelName: "ERROR",
    message: "Critical failure",
    timestamp: Date.now(),
    meta: { userId: 123 },
    error: new Error("Test Error"),
  };
  mockEntry.error!.stack = "Error: Test Error\n    at test.ts:1:1";

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
  });

  it("should send POST request to webhookUrl", async () => {
    const transport = slackTransport({ webhookUrl: "https://slack.com/hook" });
    await transport.transform(mockEntry);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("should respects level filter (default ERROR)", async () => {
    const transport = slackTransport({ webhookUrl: "https://slack.com/hook" });
    expect(transport.level).toBe("ERROR");
  });

  it("should format payload correctly with blocks", async () => {
    const transport = slackTransport({ webhookUrl: "https://slack.com/hook" });
    await transport.transform(mockEntry);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    // Slack transport puts blocks inside attachments[0]
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].blocks).toBeDefined();

    const blocks = body.attachments[0].blocks;

    // Header (Block 0)
    expect(blocks[0].text.text).toContain("🚨 ERROR: Critical failure");

    // Metadata (Should be in blocks array)
    const metaBlock = blocks.find(
      (b: any) => b.type === "section" && b.text?.text?.includes("Metadata"),
    );
    expect(metaBlock).toBeDefined();
    expect(metaBlock.text.text).toContain("userId");

    // Error Stack
    const stackBlock = blocks.find(
      (b: any) => b.type === "section" && b.text?.text?.includes("Error Stack"),
    );
    expect(stackBlock).toBeDefined();
    expect(stackBlock.text.text).toContain("Error: Test Error");
  });

  it("should allow custom username and emoji", async () => {
    const transport = slackTransport({
      webhookUrl: "https://slack.com/hook",
      username: "Bot",
      iconEmoji: ":robot_face:",
    });
    await transport.transform(mockEntry);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.username).toBe("Bot");
    expect(body.icon_emoji).toBe(":robot_face:");
  });

  it("should swallow fetch errors", async () => {
    fetchMock.mockRejectedValue(new Error("Network Error"));
    const transport = slackTransport({ webhookUrl: "https://slack.com/hook" });

    // Should not throw
    await expect(transport.transform(mockEntry)).resolves.not.toThrow();
  });

  it("should handle non-200 response gracefully", async () => {
    fetchMock.mockResolvedValue({ ok: false, statusText: "Bad Request" });
    const transport = slackTransport({ webhookUrl: "https://slack.com/hook" });

    // Should not throw
    await expect(transport.transform(mockEntry)).resolves.not.toThrow();
  });
});

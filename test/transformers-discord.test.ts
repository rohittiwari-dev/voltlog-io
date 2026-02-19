import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { discordTransport } from "../src/transformers/discord.js";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Discord Transformer", () => {
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
    const transport = discordTransport({
      webhookUrl: "https://discord.com/hook",
    });
    await transport.transform(mockEntry);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("should format payload correctly with embeds", async () => {
    const transport = discordTransport({
      webhookUrl: "https://discord.com/hook",
    });
    await transport.transform(mockEntry);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toBe("ERROR - Critical failure");

    // Check fields
    const fields = body.embeds[0].fields;
    const metaField = fields.find((f: any) => f.name === "Meta");
    expect(metaField).toBeDefined();
    expect(metaField.value).toContain("userId");

    const stackField = fields.find((f: any) => f.name === "Stack");
    expect(stackField).toBeDefined();
    expect(stackField.value).toContain("Error: Test Error");
  });

  it("should allow custom username and avatar", async () => {
    const transport = discordTransport({
      webhookUrl: "https://discord.com/hook",
      username: "Bot",
      avatarUrl: "https://example.com/avatar.png",
    });
    await transport.transform(mockEntry);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.username).toBe("Bot");
    expect(body.avatar_url).toBe("https://example.com/avatar.png");
  });

  it("should swallow fetch errors", async () => {
    fetchMock.mockRejectedValue(new Error("Network Error"));
    const transport = discordTransport({
      webhookUrl: "https://discord.com/hook",
    });

    await expect(transport.transform(mockEntry)).resolves.not.toThrow();
  });
});

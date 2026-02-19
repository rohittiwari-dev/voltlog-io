import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { redisTransport } from "../src/transformers/redis.js";

// Mock Redis client
const mockRedis = {
	xadd: vi.fn().mockResolvedValue("1-0"),
};

describe("Validating Redis Transport", () => {
	const mockEntry: LogEntry = {
		id: "test-id",
		level: 30,
		levelName: "INFO",
		message: "Test message",
		timestamp: Date.now(),
		meta: { foo: "bar" },
	};

	beforeEach(() => {
		mockRedis.xadd.mockReset();
		mockRedis.xadd.mockResolvedValue("1-0");
	});

	it("should publish log entry to stream key", () => {
		const transport = redisTransport({
			client: mockRedis,
			streamKey: "my-logs",
		});

		transport.transform(mockEntry);

		expect(mockRedis.xadd).toHaveBeenCalledWith(
			"my-logs",
			"*", // ID auto-generation
			"id",
			expect.any(String),
			"level",
			"30",
			"levelName",
			"INFO",
			"message",
			"Test message",
			"timestamp",
			expect.any(String),
			"data",
			expect.stringContaining('"foo":"bar"'),
		);
	});

	it("should include MAXLEN if configured", () => {
		const transport = redisTransport({
			client: mockRedis,
			maxLen: 1000,
		});

		transport.transform(mockEntry);

		// Check first few args
		const args = mockRedis.xadd.mock.calls[0];
		expect(args[0]).toBe("logs");
		expect(args[1]).toBe("MAXLEN");
		expect(args[2]).toBe("~");
		expect(args[3]).toBe(1000);
	});

	it("should swallow errors from xadd", async () => {
		mockRedis.xadd.mockRejectedValue(new Error("Redis Down"));
		const transport = redisTransport({ client: mockRedis });

		// Should not throw
		transport.transform(mockEntry);

		// Give time for promise rejection to be handled
		await new Promise((r) => setTimeout(r, 20));
	});

	it("should fulfill close contract (no-op)", async () => {
		const transport = redisTransport({ client: mockRedis });
		await expect(transport.close!()).resolves.toBeUndefined();
	});
});

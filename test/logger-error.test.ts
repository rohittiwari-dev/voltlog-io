import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/index.js";

describe("Logger Error Handling", () => {
	it("should handle error in transport transform safely", () => {
		const explodingTransport = {
			name: "exploding",
			transform: () => {
				throw new Error("Boom");
			},
		};

		const logger = createLogger({
			transports: [explodingTransport],
		});

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		// Should not throw (logger swallows transport errors silently)
		logger.info("test");

		expect(consoleSpy).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("should propagate error in transport flush", async () => {
		const explodingTransport = {
			name: "exploding",
			transform: () => {},
			flush: async () => {
				throw new Error("Boom Flush");
			},
		};

		const logger = createLogger({
			transports: [explodingTransport],
		});

		// flush() awaits Promise.all, so it SHOULD reject
		await expect(logger.flush()).rejects.toThrow("Boom Flush");
	});

	it("should propagate middleware errors", () => {
		const logger = createLogger();
		logger.addMiddleware((entry, next) => {
			throw new Error("Middleware Boom");
		});

		// Middleware is executed synchronously
		expect(() => logger.info("test")).toThrow("Middleware Boom");
	});
});

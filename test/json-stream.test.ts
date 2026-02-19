import { Writable } from "stream";
import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { jsonStreamTransport } from "../src/transformers/json-stream.js";

describe("JSON Stream Transport", () => {
	const mockEntry: LogEntry = {
		id: "abc",
		level: 30,
		levelName: "INFO",
		message: "test",
		timestamp: 1234567890,
		meta: {},
	};

	it("should write JSON to stream", () => {
		let output = "";
		const stream = new Writable({
			write(chunk, encoding, callback) {
				output += chunk.toString();
				callback();
			},
		});

		const transport = jsonStreamTransport({ stream });
		transport.transform(mockEntry);

		expect(output.trim()).toBe(JSON.stringify(mockEntry));
	});

	it("should support custom serializer", () => {
		let output = "";
		const stream = new Writable({
			write(chunk, encoding, callback) {
				output += chunk.toString();
				callback();
			},
		});

		const transport = jsonStreamTransport({
			stream,
			serializer: () => "CUSTOM\n",
		});
		transport.transform(mockEntry);

		expect(output).toBe("CUSTOM\n");
	});

	it("should close stream if it has end method", async () => {
		const stream = new Writable({
			write(chunk, encoding, callback) {
				callback();
			},
		});
		const endSpy = vi.spyOn(stream, "end");

		const transport = jsonStreamTransport({ stream });
		await transport.close!();

		expect(endSpy).toHaveBeenCalled();
	});

	it("should resolve close immediately if stream has no end method", async () => {
		const stream = { write: vi.fn() }; // No end()
		const transport = jsonStreamTransport({ stream: stream as any });

		await expect(transport.close!()).resolves.toBeUndefined();
	});
});

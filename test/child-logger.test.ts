import { describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { createLogger } from "../src/index.js";

describe("Child Logger", () => {
	it("should handle error and fatal methods with various arguments", () => {
		const entries: LogEntry[] = [];
		const transport = {
			name: "test",
			transform: (e: LogEntry) => {
				entries.push(e);
			},
		};

		const logger = createLogger({
			level: "TRACE",
			transports: [transport],
		});
		const child = logger.child({ ctx: "child" });

		// Error with message + Error
		child.error("error 1", new Error("e1"));
		expect(entries[0].message).toBe("error 1");
		expect(entries[0].error?.message).toBe("e1");
		expect(entries[0].context).toEqual({ ctx: "child" });

		// Error with message + meta + Error
		child.error("error 2", { context: "meta" }, new Error("e2"));
		expect(entries[1].message).toBe("error 2");
		expect(entries[1].meta).toEqual({ context: "meta" });
		expect(entries[1].error?.message).toBe("e2");

		// Fatal with message + Error
		child.fatal("fatal 1", new Error("f1"));
		expect(entries[2].message).toBe("fatal 1");
		expect(entries[2].levelName).toBe("FATAL");
		expect(entries[2].error?.message).toBe("f1");

		// Fatal with message + meta + Error
		child.fatal("fatal 2", { context: "meta" }, new Error("f2"));
		expect(entries[3].message).toBe("fatal 2");
		expect(entries[3].meta).toEqual({ context: "meta" });
		expect(entries[3].error?.message).toBe("f2");

		// Trace
		child.trace("trace 1");
		expect(entries[4].levelName).toBe("TRACE");
	});
});

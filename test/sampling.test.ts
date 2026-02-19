import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../src/core/types.js";
import { samplingMiddleware } from "../src/middleware/sampling.js";

describe("Sampling Middleware", () => {
	const mockEntry: LogEntry = {
		id: "abc",
		level: 30, // INFO
		levelName: "INFO",
		message: "test",
		timestamp: Date.now(),
		meta: {},
	};

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should pass all logs if sampleRate is 1", () => {
		const middleware = samplingMiddleware({ sampleRate: 1 });
		const next = vi.fn();

		middleware(mockEntry, next);
		expect(next).toHaveBeenCalled();
	});

	it("should drop all logs if sampleRate is 0", () => {
		const middleware = samplingMiddleware({ sampleRate: 0 });
		const next = vi.fn();

		middleware(mockEntry, next);
		expect(next).not.toHaveBeenCalled();
	});

	it("should always pass high priority logs", () => {
		// High priority passes even if sampleRate is 0
		const middleware = samplingMiddleware({
			sampleRate: 0,
			priorityLevel: 40, // WARN
		});
		const next = vi.fn();

		// INFO (30) < WARN (40) -> Dropped by sampleRate 0
		middleware(mockEntry, next);
		expect(next).not.toHaveBeenCalled();

		// WARN (40) >= WARN (40) -> Passed
		const warnEntry = { ...mockEntry, level: 40, levelName: "WARN" as const };
		middleware(warnEntry, next);
		expect(next).toHaveBeenCalledWith(warnEntry);
	});

	it("should sample statistically (approximate)", () => {
		const randomSpy = vi.spyOn(Math, "random");

		const middleware = samplingMiddleware({ sampleRate: 0.5 });
		const next = vi.fn();

		// Case 1: random < 0.5 -> Pass
		// Implementation: if (sampleRate < 1 && random > sampleRate) -> DROP.
		// So if we want PASS: random <= sampleRate?
		// Wait, standard logic: pass if random < rate.
		// My impl: if (random > sampleRate) return.
		// So if rate is 0.5.
		// random 0.4 -> 0.4 > 0.5 is False -> Pass. Correct.
		// random 0.6 -> 0.6 > 0.5 is True -> Drop. Correct.

		randomSpy.mockReturnValue(0.4);
		middleware(mockEntry, next);
		expect(next).toHaveBeenCalledTimes(1);

		randomSpy.mockReturnValue(0.6);
		middleware(mockEntry, next);
		expect(next).toHaveBeenCalledTimes(1); // Still 1

		randomSpy.mockRestore();
	});
});

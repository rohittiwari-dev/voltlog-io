import { describe, expect, it, vi } from "vitest";

import { createMiddleware } from "../src/middleware/create-middleware.js";

describe("createMiddleware", () => {
	it("should return the function passed to it", () => {
		const fn = (entry: any, next: any) => next(entry);
		const middleware = createMiddleware(fn);
		expect(middleware).toBe(fn);
	});

	it("should enforce types correctly (compile-time check)", () => {
		const middleware = createMiddleware((entry, next) => {
			entry.meta = { ...entry.meta, checked: true };
			next(entry);
		});

		const nextSpy = vi.fn();
		const entry = {
			level: 30,
			message: "test",
			timestamp: 123,
			meta: {},
			id: "abc",
			levelName: "INFO" as const,
		};

		middleware(entry, nextSpy);
		expect(nextSpy).toHaveBeenCalledWith({
			...entry,
			meta: { checked: true },
		});
	});
});

/**
 * @module voltlog-io
 * @description Helper to create custom transformers easily.
 * @universal Works in all environments.
 */

import type { LogEntry, Transformer } from "../core/types.js";

/**
 * Helper to build a transformer without manually defining the object structure.
 *
 * @example
 * const myTransport = createTransformer('my-api', async (entry) => {
 *   await fetch('https://api.example.com/logs', { body: JSON.stringify(entry) });
 * });
 *
 * @param name - Unique name for the transformer
 * @param transform - Function to process log entries
 * @param options - Optional overrides (level, flush, close)
 */
export function createTransformer(
  name: string,
  transform: (entry: LogEntry) => void | Promise<void>,
  options: Partial<Omit<Transformer, "name" | "transform">> = {},
): Transformer {
  return {
    name,
    transform,
    ...options,
  };
}

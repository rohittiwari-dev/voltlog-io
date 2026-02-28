/**
 * @module voltlog-io
 * @description AI Enrichment middleware — enriches logs with AI analysis (e.g. error explanation).
 * @universal Works in all environments (uses `fetch`).
 *
 * > **Security Note**: Requires an API Key. Using this in the browser will expose your key to the client.
 * > Recommended for server-side use only.
 */

import { resolveLevel } from "../core/levels.js";
import type { LogEntry, LogLevelName, LogMiddleware } from "../core/types.js";

export interface AiEnrichmentOptions {
  /**
   * Only trigger for logs at or above this level.
   * Default: ERROR
   */
  level?: LogLevelName;

  /**
   * Field name to store the analysis result in `entry.meta`.
   * Default: 'ai_analysis'
   */
  targetField?: string;

  /**
   * Custom analyzer function.
   * Return a string (analysis) or object (structured data) to attach to `meta[targetField]`.
   */
  analyzer: (
    entry: LogEntry,
  ) => Promise<string | Record<string, unknown> | null>;

  /**
   * Timeout in milliseconds for the AI call.
   * Default: 2000ms (fail fast to avoid blocking for too long)
   */
  timeout?: number;

  /**
   * If true, errors in the analyzer are swallowed (logged to console.error but don't crash).
   * Default: true
   */
  swallowErrors?: boolean;
}

/**
 * Enriches log entries by calling an asynchronous AI analyzer.
 * Appends result to `entry.meta[targetField]`.
 *
 * @example
 * ```ts
 * const ai = aiEnrichmentMiddleware({
 *   analyzer: createOpenAiErrorAnalyzer(process.env.OPENAI_API_KEY!),
 *   level: "ERROR",
 *   targetField: "error_explanation"
 * });
 * ```
 */
export function aiEnrichmentMiddleware<TMeta = Record<string, unknown>>(
  options: AiEnrichmentOptions,
): LogMiddleware<TMeta> {
  const minLevel = resolveLevel(options.level ?? "ERROR");
  const timeoutMs = options.timeout ?? 2000;
  const swallow = options.swallowErrors ?? true;
  const fieldName = options.targetField ?? "ai_analysis";

  return async (entry, next) => {
    // 1. Check level
    if (entry.level < minLevel) {
      next(entry);
      return;
    }

    try {
      // 2. Call analyzer with timeout
      const analysisPromise = options.analyzer(entry as unknown as LogEntry);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("AI Analysis Timeout")), timeoutMs),
      );

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      if (result) {
        entry.meta = {
          ...entry.meta,
          [fieldName]: result,
        };
      }
    } catch (err) {
      if (!swallow) {
        throw err;
      }
      // Otherwise ignore
    }

    next(entry);
  };
}

/**
 * Helper to create an OpenAI-compatible analyzer specifically for Error explanation.
 */
export function createOpenAiErrorAnalyzer(
  apiKey: string,
  model = "gpt-3.5-turbo",
  systemPrompt = "You are a log analyzer. Explain this error briefly and suggest a fix in 1 sentence.",
): (entry: LogEntry) => Promise<string | null> {
  return async (entry) => {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Error Message: ${
                  entry.message
                }\nContext: ${JSON.stringify(entry.meta)}`,
              },
            ],
            max_tokens: 150,
          }),
        },
      );

      if (!response.ok) return null;
      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  };
}

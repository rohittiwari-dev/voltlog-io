/**
 * @module voltlog-io
 * @description Discord transformer — sends logs to Discord via Webhook.
 * @universal Works in all environments (uses `fetch`).
 *
 * > **Security Note**: Using this in the browser will expose your Webhook URL.
 * > Recommended for server-side use only.
 */

import type { LogEntry, LogLevelName, Transformer } from "../core/types.js";

export interface DiscordTransportOptions {
  /** Discord Webhook URL */
  webhookUrl: string;
  /** Minimum log level (default: ERROR) */
  level?: LogLevelName;
  /** Username override */
  username?: string;
  /** Avatar URL override */
  avatarUrl?: string;
}

/**
 * Sends formatted embeds to Discord.
 * Best used for Alerts/Errors.
 */
export function discordTransport(
  options: DiscordTransportOptions,
): Transformer {
  const { webhookUrl, username, avatarUrl, level = "ERROR" } = options;

  return {
    name: "discord",
    level,
    async transform(entry) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            formatDiscordPayload(entry, username, avatarUrl),
          ),
        });
      } catch (_err) {
        // swallow
      }
    },
  };
}

function formatDiscordPayload(
  entry: LogEntry,
  username?: string,
  avatar_url?: string,
): Record<string, unknown> {
  const color = getLevelColor(entry.level);

  return {
    username: username || "VoltLog",
    avatar_url,
    embeds: [
      {
        title: `${entry.levelName} - ${entry.message}`,
        color,
        timestamp: new Date(entry.timestamp).toISOString(),
        fields: [
          {
            name: "Meta",
            value: `\`\`\`json\n${JSON.stringify(entry.meta, null, 2).slice(
              0,
              1000,
            )}\n\`\`\``,
          },
          entry.error?.stack
            ? {
                name: "Stack",
                value: `\`\`\`js\n${entry.error.stack.slice(0, 1000)}\n\`\`\``,
              }
            : null,
        ].filter(Boolean),
      },
    ],
  };
}

function getLevelColor(level: number): number {
  if (level >= 50) return 15158332; // Red (Error)
  if (level >= 40) return 16776960; // Yellow (Warn)
  if (level >= 30) return 3447003; // Blue (Info)
  return 9807270; // Grey/Green
}

/**
 * @module voltlog-io
 * @description Slack transformer — sends rich notifications to Slack via Incoming Webhook.
 * @universal Works in all environments (uses `fetch`).
 *
 * > **Security Note**: Using this in the browser will expose your Webhook URL.
 * > Recommended for server-side use only.
 * Best used with a filter (e.g. ERROR only) or alert middleware.
 */

import type { LogEntry, LogLevelName, Transport } from "../core/types.js";

export interface SlackTransportOptions {
  /** Slack Incoming Webhook URL */
  webhookUrl: string;
  /** Filter level (default: ERROR) */
  level?: LogLevelName;
  /** Custom username (overrides webhook default) */
  username?: string;
  /** Custom icon emoji (overrides webhook default) */
  iconEmoji?: string;
}

/**
 * Sends logs to Slack with formatting.
 * Best suited for ERROR/FATAL logs or specific alerts.
 */
export function slackTransport(options: SlackTransportOptions): Transport {
  const { webhookUrl, username, iconEmoji, level } = options;

  return {
    name: "slack",
    level: level ?? "ERROR", // Default to ERROR to prevent spamming
    async write(entry: LogEntry): Promise<void> {
      try {
        const payload = formatSlackMessage(entry, username, iconEmoji);
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          // We don't want to throw and crash the logger, just console.error
          // console.error(`[voltlog] Slack transport failed: ${response.statusText}`);
        }
      } catch (_err) {
        // console.error(`[voltlog] Slack transport error`, err);
      }
    },
  };
}

function formatSlackMessage(
  entry: LogEntry,
  username?: string,
  icon_emoji?: string,
): Record<string, unknown> {
  const levelEmoji = getLevelEmoji(entry.level);
  const color = getLevelColor(entry.level);

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${levelEmoji} ${entry.levelName}: ${entry.message}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Time:* ${new Date(entry.timestamp).toISOString()}`,
        },
        {
          type: "mrkdwn",
          text: `*ID:* \`${entry.id}\``,
        },
      ],
    },
  ];

  // Add correlation ID if present
  if (entry.correlationId) {
    (blocks[1].elements as any[]).push({
      type: "mrkdwn",
      text: `*Trace:* \`${entry.correlationId}\``,
    });
  }

  // Meta section
  if (Object.keys(entry.meta).length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Metadata:*\n\`\`\`${JSON.stringify(entry.meta, null, 2)}\`\`\``,
        emoji: true,
      },
    });
  }

  // Error stack
  if (entry.error?.stack) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Error Stack:*\n\`\`\`${entry.error.stack}\`\`\``,
        emoji: true,
      },
    });
  }

  return {
    username,
    icon_emoji,
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };
}

function getLevelEmoji(level: number): string {
  if (level >= 60) return "🔥"; // FATAL
  if (level >= 50) return "🚨"; // ERROR
  if (level >= 40) return "⚠️"; // WARN
  if (level >= 30) return "ℹ️"; // INFO
  if (level >= 20) return "🐛"; // DEBUG
  return "🔍"; // TRACE
}

function getLevelColor(level: number): string {
  if (level >= 60) return "#ff0000"; // FATAL (Red)
  if (level >= 50) return "#ff4444"; // ERROR (Light Red)
  if (level >= 40) return "#ffbb33"; // WARN (Orange)
  if (level >= 30) return "#33b5e5"; // INFO (Blue)
  if (level >= 20) return "#99cc00"; // DEBUG (Green)
  return "#aa66cc"; // TRACE (Purple)
}

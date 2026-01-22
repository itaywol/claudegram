/**
 * Telegram utility functions
 * Message splitting and sending helpers
 */

import type { Context } from "grammy";

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Send a long message, splitting into chunks if necessary
 */
export async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, { parse_mode: "Markdown" });
    } catch {
      // If markdown parsing fails, try without formatting
      await ctx.reply(chunk);
    }
  }
}

/**
 * Split a message into chunks that fit Telegram's limit
 */
export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a paragraph boundary
    let splitIndex = remaining.lastIndexOf(
      "\n\n",
      TELEGRAM_MAX_MESSAGE_LENGTH
    );

    // If no paragraph boundary, try a line boundary
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_MESSAGE_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf("\n", TELEGRAM_MAX_MESSAGE_LENGTH);
    }

    // If no line boundary, try a sentence boundary
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_MESSAGE_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf(". ", TELEGRAM_MAX_MESSAGE_LENGTH);
      if (splitIndex !== -1) splitIndex++; // Include the period
    }

    // If no good boundary, just split at the limit
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_MESSAGE_LENGTH / 2) {
      splitIndex = TELEGRAM_MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

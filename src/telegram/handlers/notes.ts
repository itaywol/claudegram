/**
 * Notes command handler
 * /note - Quick capture to Obsidian inbox
 */

import type { Context } from "grammy";
import { botLogger } from "../../logger";
import { createInboxNote } from "../../notes";

/**
 * Handle /note command
 */
export async function handleNote(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  if (!text) return;

  // Extract content after /note command
  const content = text.replace(/^\/note\s*/, "").trim();

  if (!content) {
    botLogger.debug("Empty /note command received", { userId });
    await ctx.reply(
      "Usage: `/note Your note content here`\n\nThis will create a new note in your Obsidian inbox.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  botLogger.info("Creating inbox note", { userId, contentLength: content.length });

  try {
    const filename = await createInboxNote(content);
    botLogger.info("Note created successfully", { userId, filename });
    await ctx.reply(`✅ Note saved: \`${filename}\``, { parse_mode: "Markdown" });
  } catch (error) {
    botLogger.error("Failed to create note", error instanceof Error ? error : new Error(String(error)), { userId });
    await ctx.reply(
      `❌ Failed to create note: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

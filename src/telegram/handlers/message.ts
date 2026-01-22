/**
 * Text message handler
 * Handles regular text messages and routes to Claude
 */

import type { Context } from "grammy";
import { botLogger } from "../../logger";
import { sendMessage } from "../../claude/cli";
import {
  hasPendingOAuthFlow,
  completeOAuthFlow,
  cancelOAuthFlow,
} from "../../oauth";
import { tryExecuteSkillCommand } from "./skills";
import { StreamingMessageManager } from "../streaming";

/**
 * Handle text messages
 */
export async function handleTextMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const userMessage = ctx.message?.text;
  if (!userMessage) return;

  const username = ctx.from?.username;

  botLogger.debug("Received text message", {
    userId,
    username,
    messageLength: userMessage.length,
    messagePreview: userMessage.slice(0, 50),
  });

  // Check for pending OAuth flow - intercept code/URL responses
  if (hasPendingOAuthFlow(userId)) {
    // Check if this looks like an OAuth code or redirect URL
    const looksLikeOAuthResponse =
      userMessage.includes("code=") ||
      userMessage.match(/^[a-zA-Z0-9_\-/.]+$/) || // Simple code format
      userMessage.startsWith("http://localhost") ||
      userMessage.startsWith("4/"); // Google OAuth code format

    if (looksLikeOAuthResponse && userMessage.length > 10) {
      botLogger.info("Processing OAuth code", { userId });
      const result = await completeOAuthFlow(userId, userMessage);

      if (result.success) {
        await ctx.reply(
          `✅ *${result.provider} authenticated successfully!*\n\n` +
            `Tokens have been stored securely. You can now use MCP servers that require ${result.provider} authentication.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          `❌ *Authentication failed*\n\n${result.error}\n\n` +
            `Please try again or send /cancel to abort.`,
          { parse_mode: "Markdown" }
        );
      }
      return;
    }

    // Check for cancel command
    if (userMessage.toLowerCase() === "/cancel" || userMessage.toLowerCase() === "cancel") {
      cancelOAuthFlow(userId);
      await ctx.reply("OAuth flow cancelled.");
      return;
    }
  }

  // Check for skill command or pending skill
  const handledBySkill = await tryExecuteSkillCommand(ctx, userMessage, userId);
  if (handledBySkill) {
    return;
  }

  // Skip other command messages
  if (userMessage.startsWith("/")) {
    botLogger.debug("Skipping unknown command", { userId, command: userMessage.split(" ")[0] });
    return;
  }

  botLogger.info("Processing message with Claude", { userId, username, messageLength: userMessage.length });

  // Create streaming message manager
  const streamingManager = new StreamingMessageManager(ctx);
  await streamingManager.start();

  try {
    await sendMessage(userId, userMessage, {
      onText: async (text) => {
        await streamingManager.appendText(text);
      },
      onToolUse: (toolName, _input) => {
        botLogger.debug("Claude using tool", { userId, toolName });
      },
      onToolResult: (result) => {
        botLogger.debug("Claude tool result received", { userId, resultLength: result.length });
      },
      onError: async (error) => {
        botLogger.error("Claude error during message processing", { userId, error });
        await streamingManager.error(error);
      },
      onComplete: async () => {
        botLogger.info("Claude response complete", { userId });
        await streamingManager.finalize();
      },
    });
  } catch (error) {
    botLogger.error("Error processing message", error instanceof Error ? error : new Error(String(error)), { userId });
    await streamingManager.error(
      error instanceof Error ? error.message : String(error)
    );
  }
}

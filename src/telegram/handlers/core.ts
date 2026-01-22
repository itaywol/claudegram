/**
 * Core command handlers
 * /start, /reset, /restart, /status
 */

import type { Context } from "grammy";
import { botLogger } from "../../logger";
import { sessionManager } from "../../claude/session";
import { checkHealth } from "../../claude/cli";
import { config } from "../../config";

/**
 * Handle /start command
 */
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.info("Received /start command", { userId });
  await ctx.reply(
    `Welcome to Claudegram!

I'm a Claude-powered assistant with access to your Obsidian vault and my own source code.

*Core Commands:*
/skills - Browse available skills and agents
/mcp - View and manage MCP servers
/note - Quick capture to Obsidian inbox
/menu - Interactive menu
/reset - Clear conversation history
/status - Check bot status

*Development:*
/capabilities - List installed skills/agents/MCPs
/develop - Enter self-development mode
/pr - Show pending PRs

*Tip:* Use /skills to see all available skills with quick-tap buttons, or just send me a message to chat!`,
    { parse_mode: "Markdown" }
  );
}

/**
 * Handle /reset command
 */
export async function handleReset(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  botLogger.info("Received /reset command", { userId });
  sessionManager.resetSession(userId);
  await ctx.reply(
    "Conversation reset. Starting fresh! Send me a message to begin a new conversation."
  );
}

/**
 * Handle /restart command
 */
export async function handleRestart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.info("Received /restart command - initiating restart", { userId });
  await ctx.reply("Restarting bot...");
  setTimeout(() => {
    process.exit(0); // Exit with 0, runner script will restart
  }, 500);
}

/**
 * Handle /status command
 */
export async function handleStatus(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  botLogger.debug("Received /status command", { userId });

  const health = await checkHealth();
  const session = sessionManager.getSession(userId);
  const stats = sessionManager.getStats();

  const statusMessage = `*Bot Status*

*Claude CLI:* ${health.ok ? "✅" : "❌"} ${health.message}
*Vault Path:* \`${config.obsidianVaultPath}\`
*Active Sessions:* ${stats.totalSessions}
*Your Session:* ${session.conversationId ? `Active (${session.conversationId.slice(0, 8)}...)` : "New"}`;

  await ctx.reply(statusMessage, { parse_mode: "Markdown" });
}

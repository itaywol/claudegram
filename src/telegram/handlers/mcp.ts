/**
 * MCP command handlers
 * /mcp and MCP-related callbacks
 */

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botLogger } from "../../logger";
import { listMcpServers, formatMcpServersForDisplay } from "../../mcp";
import { listAuthenticatedProviders } from "../../oauth";

/**
 * Handle /mcp command
 */
export async function handleMcp(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /mcp command", { userId });

  await ctx.reply("🔍 _Checking MCP servers..._", { parse_mode: "Markdown" });

  try {
    const [servers, authenticatedProviders] = await Promise.all([
      listMcpServers(),
      listAuthenticatedProviders(),
    ]);

    let display = formatMcpServersForDisplay(servers);

    // Add authenticated OAuth providers section
    if (authenticatedProviders.length > 0) {
      display += "\n\n*🔐 Authenticated Providers:*\n";
      display += authenticatedProviders.map((p) => `• ${p}`).join("\n");
    }

    // Build inline keyboard for actions
    const keyboard = new InlineKeyboard();
    keyboard.text("➕ Add Server", "mcp:add");
    keyboard.text("🔄 Refresh", "mcp:refresh");

    await ctx.reply(display, { parse_mode: "Markdown", reply_markup: keyboard });
  } catch (error) {
    botLogger.error("Failed to list MCP servers", error instanceof Error ? error : new Error(String(error)));
    await ctx.reply("❌ Failed to list MCP servers. Check logs for details.");
  }
}

/**
 * Handle MCP button callbacks
 */
export async function handleMcpCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const match = ctx.match as RegExpMatchArray;
  const action = match[1];
  botLogger.debug("MCP callback action", { userId, action });

  await ctx.answerCallbackQuery();

  if (action === "refresh") {
    try {
      const [servers, authenticatedProviders] = await Promise.all([
        listMcpServers(),
        listAuthenticatedProviders(),
      ]);

      let display = formatMcpServersForDisplay(servers);

      if (authenticatedProviders.length > 0) {
        display += "\n\n*🔐 Authenticated Providers:*\n";
        display += authenticatedProviders.map((p) => `• ${p}`).join("\n");
      }

      const keyboard = new InlineKeyboard();
      keyboard.text("➕ Add Server", "mcp:add");
      keyboard.text("🔄 Refresh", "mcp:refresh");
      await ctx.editMessageText(display, { parse_mode: "Markdown", reply_markup: keyboard });
    } catch {
      await ctx.reply("❌ Failed to refresh MCP servers.");
    }
  } else if (action === "add") {
    // Trigger the mcp-manager agent
    await ctx.reply(
      "*Add MCP Server*\n\n" +
        "Tell me what functionality you need, and I'll help you find and configure the right MCP server.\n\n" +
        "Examples:\n" +
        "• _I need to search the web_\n" +
        "• _I want to access my GitHub repos_\n" +
        "• _Add Google Calendar integration_\n\n" +
        "Or specify a server directly:\n" +
        "• `add mcp github` - Add GitHub MCP\n" +
        "• `add mcp filesystem /path` - Add filesystem access",
      { parse_mode: "Markdown" }
    );
  }
}

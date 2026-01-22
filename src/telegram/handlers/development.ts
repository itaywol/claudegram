/**
 * Development command handlers
 * /menu, /capabilities, /develop, /pr
 */

import type { Context } from "grammy";
import { botLogger } from "../../logger";
import { discoverSkills } from "../../skills";
import { listMcpServers } from "../../mcp";
import { createMainMenu, createDevelopmentMenu } from "../menus";
import { listOpenPRs, getCurrentBranch } from "../../development/git";
import { config } from "../../config";

/**
 * Handle /menu command
 */
export async function handleMenu(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /menu command", { userId });

  const keyboard = createMainMenu();
  await ctx.reply(
    "*Claudegram Menu*\n\nQuick access to common actions:",
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

/**
 * Handle /capabilities command
 */
export async function handleCapabilities(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /capabilities command", { userId });

  await ctx.reply("🔍 _Gathering capabilities..._", { parse_mode: "Markdown" });

  try {
    const [skills, mcpServers] = await Promise.all([
      discoverSkills(),
      listMcpServers(),
    ]);

    const commands = skills.filter(s => s.type === "command");
    const agents = skills.filter(s => s.type === "agent");

    let response = "*Installed Capabilities*\n\n";

    // Commands
    if (commands.length > 0) {
      response += "*⚡ Commands:*\n";
      response += commands.map(c => `• \`/${c.name}\` - ${c.description.slice(0, 50)}`).join("\n");
      response += "\n\n";
    }

    // Agents
    if (agents.length > 0) {
      response += "*🤖 Agents:*\n";
      response += agents.map(a => `• \`${a.name}\` - ${a.description.slice(0, 50)}`).join("\n");
      response += "\n\n";
    }

    // MCP Servers
    if (mcpServers.length > 0) {
      response += "*🔌 MCP Servers:*\n";
      response += mcpServers.map(s => `• \`${s.name}\` - ${s.type}`).join("\n");
      response += "\n\n";
    }

    // Summary
    response += `_Total: ${commands.length} commands, ${agents.length} agents, ${mcpServers.length} MCP servers_`;

    await ctx.reply(response, { parse_mode: "Markdown" });
  } catch (error) {
    botLogger.error("Failed to list capabilities", error instanceof Error ? error : new Error(String(error)));
    await ctx.reply("❌ Failed to list capabilities. Check logs for details.");
  }
}

/**
 * Handle /develop command
 */
export async function handleDevelop(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /develop command", { userId });

  const keyboard = createDevelopmentMenu();

  let branchInfo = "";
  try {
    const branch = await getCurrentBranch();
    branchInfo = `\n*Current Branch:* \`${branch}\``;
  } catch {
    // Ignore error, branch info is optional
  }

  await ctx.reply(
    `*Self-Development Mode*${branchInfo}

Claudegram can modify its own code. What would you like to do?

• *Add a skill* - Create a new slash command
• *Add an agent* - Create a specialized agent
• *Add MCP* - Configure a new MCP server
• *Modify code* - Change bot behavior

All changes will be made on a feature branch and require PR approval.`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

/**
 * Handle /pr command
 */
export async function handlePR(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /pr command", { userId });

  if (!config.githubToken || !config.githubRepo) {
    await ctx.reply(
      "*GitHub not configured*\n\n" +
        "To enable PR management, set these environment variables:\n" +
        "• `GITHUB_TOKEN` - Your GitHub personal access token\n" +
        "• `GITHUB_REPO` - Repository in format `owner/repo`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  await ctx.reply("🔍 _Checking for pending PRs..._", { parse_mode: "Markdown" });

  try {
    const prs = await listOpenPRs();

    if (prs.length === 0) {
      await ctx.reply(
        "*No pending PRs*\n\nAll PRs have been reviewed or there are none open.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    let response = `*Pending PRs (${prs.length})*\n\n`;
    for (const pr of prs) {
      response += `*#${pr.number}* - ${pr.title}\n`;
      response += `  Branch: \`${pr.branch}\`\n`;
      response += `  URL: ${pr.url}\n\n`;
    }

    await ctx.reply(response, { parse_mode: "Markdown" });
  } catch (error) {
    botLogger.error("Failed to list PRs", error instanceof Error ? error : new Error(String(error)));
    await ctx.reply(
      `❌ Failed to list PRs: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Handle development menu callbacks
 */
export async function handleDevelopmentCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const match = ctx.match as RegExpMatchArray;
  const action = match[1];
  botLogger.debug("Development callback action", { userId, action });

  await ctx.answerCallbackQuery();

  switch (action) {
    case "skill":
      await ctx.reply(
        "*Add a Skill*\n\n" +
          "Tell me what you want the skill to do, and I'll create it.\n\n" +
          "Example: _Create a skill that summarizes the current daily note_",
        { parse_mode: "Markdown" }
      );
      break;

    case "agent":
      await ctx.reply(
        "*Add an Agent*\n\n" +
          "Describe the specialized agent you need.\n\n" +
          "Example: _Create an agent that helps with code review_",
        { parse_mode: "Markdown" }
      );
      break;

    case "mcp":
      await ctx.reply(
        "*Add MCP Server*\n\n" +
          "Tell me what functionality you need, and I'll help configure the MCP.\n\n" +
          "Example: _Add Google Calendar integration_",
        { parse_mode: "Markdown" }
      );
      break;

    case "code":
      await ctx.reply(
        "*Modify Bot Code*\n\n" +
          "Describe what you want to change about the bot's behavior.\n\n" +
          "Example: _Add a command to show daily statistics_",
        { parse_mode: "Markdown" }
      );
      break;
  }
}

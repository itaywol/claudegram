/**
 * Telegram bot setup using grammY
 * Slim setup file that registers middleware and handlers
 */

import { Bot } from "grammy";
import { config } from "../config";
import { botLogger } from "../logger";
import { registerCommands } from "./commands";
import {
  handleStart,
  handleReset,
  handleRestart,
  handleStatus,
  handleNote,
  handleMcp,
  handleMcpCallback,
  handleSkills,
  handleSkillCallback,
  handleTextMessage,
  handleMenu,
  handleCapabilities,
  handleDevelop,
  handlePR,
  handleDevelopmentCallback,
  setCachedSkills,
} from "./handlers";

/**
 * Create and configure the bot instance
 */
export function createBot(): Bot {
  botLogger.info("Creating bot instance");
  const bot = new Bot(config.telegramBotToken);

  // Register commands with Telegram on startup
  registerCommands(bot).then((skills) => {
    setCachedSkills(skills);
  });

  // Authorization middleware - only allow specific users
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    if (!userId) {
      botLogger.debug("Received update without user ID", {
        updateType: ctx.update ? Object.keys(ctx.update).join(",") : "unknown",
      });
      return;
    }

    // If allowedUserIds is empty, allow all users
    if (
      config.allowedUserIds.length > 0 &&
      !config.allowedUserIds.includes(userId)
    ) {
      botLogger.warn("Unauthorized access attempt", { userId, username });
      await ctx.reply("Sorry, you are not authorized to use this bot.");
      return;
    }

    botLogger.debug("Request authorized", { userId, username });
    await next();
  });

  // Core commands
  bot.command("start", handleStart);
  bot.command("reset", handleReset);
  bot.command("restart", handleRestart);
  bot.command("status", handleStatus);

  // Note command
  bot.command("note", handleNote);

  // MCP commands
  bot.command("mcp", handleMcp);
  bot.callbackQuery(/^mcp:(.+)$/, handleMcpCallback);

  // Skills commands
  bot.command("skills", handleSkills);
  bot.callbackQuery(/^skill:(.+)$/, handleSkillCallback);

  // Development commands
  bot.command("menu", handleMenu);
  bot.command("capabilities", handleCapabilities);
  bot.command("develop", handleDevelop);
  bot.command("pr", handlePR);
  bot.callbackQuery(/^dev:(.+)$/, handleDevelopmentCallback);

  // Menu callbacks (route to appropriate handlers)
  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    const action = (ctx.match as RegExpMatchArray)[1];
    await ctx.answerCallbackQuery();

    switch (action) {
      case "skills":
        await handleSkills(ctx);
        break;
      case "mcp":
        await handleMcp(ctx);
        break;
      case "note":
        await ctx.reply("Usage: `/note Your note content here`", { parse_mode: "Markdown" });
        break;
      case "status":
        await handleStatus(ctx);
        break;
      case "develop":
        await handleDevelop(ctx);
        break;
      case "pr":
        await handlePR(ctx);
        break;
    }
  });

  // Text message handler (must be last)
  bot.on("message:text", handleTextMessage);

  // Error handler
  bot.catch((err) => {
    botLogger.error("Unhandled bot error", err.error instanceof Error ? err.error : new Error(String(err.error)), {
      updateType: err.ctx?.update ? Object.keys(err.ctx.update).join(",") : "unknown",
      userId: err.ctx?.from?.id,
    });
  });

  return bot;
}

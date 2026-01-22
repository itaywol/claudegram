/**
 * Telegram bot command definitions
 * Centralized command list for registration with BotFather
 */

import type { Bot } from "grammy";
import { discoverSkills, sanitizeSkillName, type Skill } from "../skills";
import { botLogger } from "../logger";

export interface CommandDefinition {
  command: string;
  description: string;
}

/**
 * Core bot commands
 */
export const CORE_COMMANDS: CommandDefinition[] = [
  { command: "start", description: "Show welcome message" },
  { command: "skills", description: "Browse available skills" },
  { command: "mcp", description: "View and manage MCP servers" },
  { command: "note", description: "Quick capture to Obsidian inbox" },
  { command: "reset", description: "Clear conversation history" },
  { command: "status", description: "Check bot status" },
  { command: "restart", description: "Restart the bot" },
  { command: "menu", description: "Interactive menu" },
  { command: "capabilities", description: "List capabilities" },
  { command: "develop", description: "Self-development mode" },
  { command: "pr", description: "Show pending PRs" },
];

/**
 * Register bot commands with Telegram
 * Includes core commands plus discovered skills
 */
export async function registerCommands(bot: Bot): Promise<Skill[]> {
  botLogger.debug("Registering commands with Telegram");

  try {
    // Discover skills to include in command list
    const skills = await discoverSkills();

    // Build command list: core commands + skills
    const commands: CommandDefinition[] = [...CORE_COMMANDS];

    // Add discovered skills as commands
    for (const skill of skills) {
      const icon = skill.type === "command" ? "⚡" : "🤖";
      commands.push({
        command: sanitizeSkillName(skill.name),
        description: `${icon} ${skill.description.slice(0, 200)}`,
      });
    }

    await bot.api.setMyCommands(commands);
    botLogger.info("Registered commands with Telegram", {
      commandCount: commands.length,
      skillCount: skills.length,
    });

    return skills;
  } catch (error) {
    botLogger.error("Failed to register commands", error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

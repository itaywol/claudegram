/**
 * Interactive menu keyboards for Telegram
 */

import { InlineKeyboard } from "grammy";
import type { Skill } from "../skills";

/**
 * Create the main menu keyboard
 */
export function createMainMenu(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Row 1: Core actions
  keyboard.text("📋 Skills", "menu:skills");
  keyboard.text("🔌 MCP", "menu:mcp");
  keyboard.row();

  // Row 2: Notes and status
  keyboard.text("📝 Note", "menu:note");
  keyboard.text("📊 Status", "menu:status");
  keyboard.row();

  // Row 3: Development
  keyboard.text("🔧 Develop", "menu:develop");
  keyboard.text("📥 PRs", "menu:pr");

  return keyboard;
}

/**
 * Create the capabilities browser menu
 */
export function createCapabilitiesMenu(skills: Skill[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Group skills by type
  const commands = skills.filter(s => s.type === "command");
  const agents = skills.filter(s => s.type === "agent");

  // Commands row
  if (commands.length > 0) {
    keyboard.text(`⚡ Commands (${commands.length})`, "cap:commands");
  }

  // Agents row
  if (agents.length > 0) {
    keyboard.text(`🤖 Agents (${agents.length})`, "cap:agents");
  }

  keyboard.row();
  keyboard.text("🔌 MCP Servers", "cap:mcp");
  keyboard.text("🔄 Refresh", "cap:refresh");

  return keyboard;
}

/**
 * Create the development menu keyboard
 */
export function createDevelopmentMenu(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Row 1: Add capabilities
  keyboard.text("⚡ Add Skill", "dev:skill");
  keyboard.text("🤖 Add Agent", "dev:agent");
  keyboard.row();

  // Row 2: More options
  keyboard.text("🔌 Add MCP", "dev:mcp");
  keyboard.text("📝 Modify Code", "dev:code");

  return keyboard;
}

/**
 * Create an inline keyboard for a list of skills
 */
export function createSkillsKeyboard(skills: Skill[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i]!;
    const icon = skill.type === "command" ? "⚡" : "🤖";
    keyboard.text(`${icon} ${skill.name}`, `skill:${skill.name}`);
    // Two buttons per row
    if (i % 2 === 1) keyboard.row();
  }
  if (skills.length % 2 === 1) keyboard.row();

  return keyboard;
}

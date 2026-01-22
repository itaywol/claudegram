/**
 * Skills command handlers
 * /skills and skill-related callbacks
 */

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botLogger } from "../../logger";
import { discoverSkills, formatSkillDisplay, sanitizeSkillName, type Skill } from "../../skills";
import { sessionManager } from "../../claude/session";
import { sendMessage } from "../../claude/cli";
import { StreamingMessageManager } from "../streaming";

// Store discovered skills for quick access
let cachedSkills: Skill[] = [];

/**
 * Get cached skills
 */
export function getCachedSkills(): Skill[] {
  return cachedSkills;
}

/**
 * Set cached skills
 */
export function setCachedSkills(skills: Skill[]): void {
  cachedSkills = skills;
}

/**
 * Handle /skills command
 */
export async function handleSkills(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  botLogger.debug("Received /skills command", { userId });

  const skills = await discoverSkills();
  cachedSkills = skills;

  // Separate commands (invokable) from agents (context/reference)
  const commands = skills.filter((s) => s.type === "command");
  const agents = skills.filter((s) => s.type === "agent");

  if (skills.length === 0) {
    await ctx.reply(
      "No skills found.\n\nAdd skills to:\n• `.claude/commands/` for commands\n• `.claude/agents/` for agents",
      { parse_mode: "Markdown" }
    );
    return;
  }

  let response = "*Available Skills*\n\n";

  // Commands section - these are invokable
  if (commands.length > 0) {
    response += "*⚡ Commands* (tap to run)\n";
    response += commands.map(formatSkillDisplay).join("\n\n");
    response += "\n\n";
  }

  // Agents section - these are for Claude's context, not directly invokable
  if (agents.length > 0) {
    response += "*🤖 Agents* (used by Claude for context)\n";
    for (const agent of agents) {
      response += `• *${agent.name}* - ${agent.description}\n`;
    }
  }

  // Build inline keyboard with ONLY command buttons (not agents)
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < commands.length; i++) {
    const skill = commands[i]!;
    keyboard.text(`⚡ ${skill.name}`, `skill:${skill.name}`);
    // Two buttons per row
    if (i % 2 === 1) keyboard.row();
  }
  if (commands.length % 2 === 1) keyboard.row();

  response += "\n_Tap a command button or type it directly_";

  await ctx.reply(response, { parse_mode: "Markdown", reply_markup: keyboard });
}

/**
 * Handle skill button callbacks
 */
export async function handleSkillCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const match = ctx.match as RegExpMatchArray;
  const skillName = match[1];
  const skill = cachedSkills.find((s) => s.name === skillName);

  if (!skill) {
    botLogger.warn("Skill not found from callback", { userId, skillName });
    await ctx.answerCallbackQuery({ text: "Skill not found" });
    return;
  }

  // Agents are not directly invokable - they're for Claude's context
  if (skill.type === "agent") {
    botLogger.debug("Agent selected (not directly invokable)", { userId, skillName });
    await ctx.answerCallbackQuery({ text: "Agents are used by Claude for context" });
    await ctx.reply(
      `*${skill.name}* is an agent, not a command.\n\nAgents provide context for Claude when handling complex tasks. Just describe what you need and Claude will use the appropriate agent.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  botLogger.info("Skill selected from button", { userId, skillName });
  await ctx.answerCallbackQuery();

  // Prompt user for arguments if needed
  if (skill.argumentHint) {
    await ctx.reply(
      `*${skill.name}*\n\nUsage: \`/${skill.name} ${skill.argumentHint}\`\n\n_Reply with your request:_`,
      { parse_mode: "Markdown" }
    );
    // Store pending skill in session for next message
    if (userId) {
      const session = sessionManager.getSession(userId);
      (session as any).pendingSkill = skillName;
    }
  } else {
    // Execute skill directly
    await ctx.reply(`Running *${skill.name}*...`, { parse_mode: "Markdown" });
    await executeSkill(ctx, skill.name, "");
  }
}

/**
 * Execute a skill by sending it to Claude
 */
export async function executeSkill(
  ctx: Context,
  skillName: string,
  args: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  botLogger.info("Executing skill", { userId, skillName, hasArgs: !!args });

  // Create streaming message manager
  const streamingManager = new StreamingMessageManager(ctx);
  await streamingManager.start();

  // Format the message to trigger the skill in Claude
  // Claude Code recognizes /<skill> format from ~/.claude/commands/
  const skillMessage = `/${skillName} ${args}`.trim();

  try {
    await sendMessage(userId, skillMessage, {
      onText: async (text) => {
        await streamingManager.appendText(text);
      },
      onToolUse: (toolName) => {
        botLogger.debug("Skill using tool", { userId, skillName, toolName });
      },
      onToolResult: (result) => {
        botLogger.debug("Skill tool result", { userId, skillName, resultLength: result.length });
      },
      onError: async (error) => {
        botLogger.error("Skill execution error", { userId, skillName, error });
        await streamingManager.error(`Error running ${skillName}: ${error}`);
      },
      onComplete: async () => {
        botLogger.info("Skill completed successfully", { userId, skillName });
        await streamingManager.finalize();
      },
    });
  } catch (error) {
    botLogger.error("Skill execution failed", error instanceof Error ? error : new Error(String(error)), { userId, skillName });
    await streamingManager.error(
      `Failed to run skill: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if a message matches a skill command and execute it
 * Returns true if a skill was executed, false otherwise
 */
export async function tryExecuteSkillCommand(
  ctx: Context,
  userMessage: string,
  userId: number
): Promise<boolean> {
  // Check for pending skill from button click
  const session = sessionManager.getSession(userId);
  const pendingSkill = (session as any).pendingSkill;
  if (pendingSkill) {
    delete (session as any).pendingSkill;
    botLogger.info("Executing pending skill", { userId, skillName: pendingSkill });
    await executeSkill(ctx, pendingSkill, userMessage);
    return true;
  }

  // Check if message is a skill command (e.g., /schedule ...)
  const skillMatch = userMessage.match(/^\/(\w+)\s*(.*)?$/);
  if (skillMatch) {
    const commandName = skillMatch[1];
    const args = skillMatch[2] || "";
    // Match skill by original name or sanitized name (underscores match hyphens)
    // Only match commands, not agents (agents are for Claude's context, not direct invocation)
    const skill = cachedSkills.find(
      (s) =>
        s.type === "command" &&
        (s.name === commandName || sanitizeSkillName(s.name) === commandName)
    );
    if (skill && commandName) {
      botLogger.info("Executing skill command", { userId, skillName: skill.name, hasArgs: !!args });
      await executeSkill(ctx, skill.name, args);
      return true;
    }
  }

  return false;
}

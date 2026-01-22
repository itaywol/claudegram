/**
 * Skill discovery and management
 * Scans project .claude/commands and .claude/agents for available skills
 * Uses project directory so skills are tracked by git and included in PRs
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { skillsLogger } from "./logger";
import { config } from "./config";

export interface Skill {
  name: string;
  type: "command" | "agent";
  description: string;
  argumentHint?: string;
  filePath: string;
}

// Use project directory for git-tracked capabilities
const COMMANDS_DIR = join(config.botDirectory, ".claude", "commands");
const AGENTS_DIR = join(config.botDirectory, ".claude", "agents");

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match || !match[1]) return {};

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Handle multi-line values that start with |
      if (value === "|") {
        continue; // Skip, we'll just use the first line
      }
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * Extract first meaningful line from content as fallback description
 */
function extractFallbackDescription(content: string): string {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n*/, "");

  // Find first non-empty, non-header line
  const lines = withoutFrontmatter.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.slice(0, 100) + (trimmed.length > 100 ? "..." : "");
    }
  }

  return "No description available";
}

/**
 * Scan a directory for skill files
 */
async function scanDirectory(
  dir: string,
  type: "command" | "agent"
): Promise<Skill[]> {
  const skills: Skill[] = [];

  skillsLogger.debug("Scanning directory for skills", { dir, type });

  try {
    const files = await readdir(dir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(dir, file);
      const content = await readFile(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);

      const name = file.replace(".md", "");
      const description =
        frontmatter.description || extractFallbackDescription(content);

      skills.push({
        name,
        type,
        description: description.split("\n")[0] || description,
        argumentHint: frontmatter["argument-hint"],
        filePath,
      });

      skillsLogger.debug("Found skill", { name, type, filePath });
    }

    skillsLogger.debug("Directory scan complete", { dir, skillCount: skills.length });
  } catch (error) {
    // Directory doesn't exist or can't be read
    skillsLogger.debug("Could not scan directory", { dir, error: error instanceof Error ? error.message : String(error) });
  }

  return skills;
}

/**
 * Discover all available skills
 */
export async function discoverSkills(): Promise<Skill[]> {
  skillsLogger.debug("Discovering all skills");

  const [commands, agents] = await Promise.all([
    scanDirectory(COMMANDS_DIR, "command"),
    scanDirectory(AGENTS_DIR, "agent"),
  ]);

  const allSkills = [...commands, ...agents];
  skillsLogger.info("Skills discovered", {
    commands: commands.length,
    agents: agents.length,
    total: allSkills.length,
  });

  return allSkills;
}

/**
 * Get a specific skill by name
 */
export async function getSkill(name: string): Promise<Skill | undefined> {
  const skills = await discoverSkills();
  return skills.find((s) => s.name === name);
}

/**
 * Sanitize skill name for Telegram command (lowercase, underscores only)
 */
export function sanitizeSkillName(name: string): string {
  return name.toLowerCase().replace(/-/g, "_");
}

/**
 * Format skill for display
 */
export function formatSkillDisplay(skill: Skill): string {
  const icon = skill.type === "command" ? "⚡" : "🤖";
  const hint = skill.argumentHint ? ` ${skill.argumentHint}` : "";
  const commandName = sanitizeSkillName(skill.name);
  return `${icon} */${commandName}*${hint}\n   ${skill.description}`;
}

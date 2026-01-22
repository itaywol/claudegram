/**
 * Capability installation utilities
 * Install/uninstall skills, agents, hooks, and MCP configs
 */

import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { createLogger } from "../logger";
import { config } from "../config";

const devLogger = createLogger("development");

export type CapabilityType = "command" | "agent" | "hook" | "mcp";

export interface InstallRequest {
  type: CapabilityType;
  name: string;
  content: string;
}

export interface InstallResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Get the directory for a capability type
 * Uses project-level .claude/ directory so capabilities are tracked by git
 * and can be included in PRs for review
 */
function getCapabilityDir(type: CapabilityType): string {
  const projectClaudeDir = join(config.botDirectory, ".claude");

  switch (type) {
    case "command":
      return join(projectClaudeDir, "commands");
    case "agent":
      return join(projectClaudeDir, "agents");
    case "hook":
      return join(projectClaudeDir, "hooks");
    case "mcp":
      return projectClaudeDir; // MCP configs go in project settings.local.json
    default:
      throw new Error(`Unknown capability type: ${type}`);
  }
}

/**
 * Install a capability (skill, agent, or hook)
 */
export async function installCapability(request: InstallRequest): Promise<InstallResult> {
  const { type, name, content } = request;

  devLogger.info("Installing capability", { type, name });

  try {
    if (type === "mcp") {
      // MCP configs are handled differently - they go in settings.json
      return installMcpConfig(name, content);
    }

    // For commands, agents, hooks - write as markdown file
    const dir = getCapabilityDir(type);
    await mkdir(dir, { recursive: true });

    const filename = `${name}.md`;
    const filePath = join(dir, filename);

    await writeFile(filePath, content, "utf-8");

    devLogger.info("Capability installed", { type, name, path: filePath });

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    devLogger.error("Failed to install capability", { type, name, error: message });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Install an MCP configuration to project settings.local.json
 */
async function installMcpConfig(name: string, configJson: string): Promise<InstallResult> {
  const settingsPath = join(config.botDirectory, ".claude", "settings.local.json");

  try {
    // Ensure .claude directory exists
    await mkdir(join(config.botDirectory, ".claude"), { recursive: true });

    // Read existing settings
    let settings: Record<string, unknown> = {};
    try {
      const existing = await readFile(settingsPath, "utf-8");
      settings = JSON.parse(existing);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    // Parse the new MCP config
    const newConfig = JSON.parse(configJson);

    // Ensure mcpServers exists
    if (!settings.mcpServers || typeof settings.mcpServers !== "object") {
      settings.mcpServers = {};
    }

    // Add the new MCP server
    (settings.mcpServers as Record<string, unknown>)[name] = newConfig;

    // Write back
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

    devLogger.info("MCP config installed", { name, path: settingsPath });

    return {
      success: true,
      path: settingsPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Uninstall a capability
 */
export async function uninstallCapability(
  type: CapabilityType,
  name: string
): Promise<InstallResult> {
  devLogger.info("Uninstalling capability", { type, name });

  try {
    if (type === "mcp") {
      return uninstallMcpConfig(name);
    }

    const dir = getCapabilityDir(type);
    const filePath = join(dir, `${name}.md`);

    await unlink(filePath);

    devLogger.info("Capability uninstalled", { type, name });

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    devLogger.error("Failed to uninstall capability", { type, name, error: message });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Uninstall an MCP configuration from project settings.local.json
 */
async function uninstallMcpConfig(name: string): Promise<InstallResult> {
  const settingsPath = join(config.botDirectory, ".claude", "settings.local.json");

  try {
    const existing = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(existing);

    if (settings.mcpServers && typeof settings.mcpServers === "object") {
      delete (settings.mcpServers as Record<string, unknown>)[name];
    }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

    devLogger.info("MCP config uninstalled", { name });

    return {
      success: true,
      path: settingsPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * List installed capabilities by type
 */
export async function listInstalledCapabilities(): Promise<Record<CapabilityType, string[]>> {
  const { readdir } = await import("fs/promises");

  const result: Record<CapabilityType, string[]> = {
    command: [],
    agent: [],
    hook: [],
    mcp: [],
  };

  // List commands
  try {
    const commandsDir = getCapabilityDir("command");
    const files = await readdir(commandsDir);
    result.command = files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""));
  } catch {
    // Directory doesn't exist
  }

  // List agents
  try {
    const agentsDir = getCapabilityDir("agent");
    const files = await readdir(agentsDir);
    result.agent = files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""));
  } catch {
    // Directory doesn't exist
  }

  // List hooks
  try {
    const hooksDir = getCapabilityDir("hook");
    const files = await readdir(hooksDir);
    result.hook = files
      .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
      .map((f) => f.replace(/\.(md|json)$/, ""));
  } catch {
    // Directory doesn't exist
  }

  // List MCP servers from project settings.local.json
  try {
    const settingsPath = join(config.botDirectory, ".claude", "settings.local.json");
    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    if (settings.mcpServers && typeof settings.mcpServers === "object") {
      result.mcp = Object.keys(settings.mcpServers);
    }
  } catch {
    // Settings file doesn't exist or is invalid
  }

  return result;
}

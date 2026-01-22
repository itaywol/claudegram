/**
 * Configuration module for Claudegram
 * Loads and validates environment variables
 */

import type { LogLevelName } from "./logger";

export interface Config {
  telegramBotToken: string;
  anthropicApiKey: string | undefined;
  obsidianVaultPath: string;
  allowedUserIds: number[];
  botDirectory: string;
  logLevel: LogLevelName;
  // GitHub integration for self-development
  githubToken: string | undefined;
  githubRepo: string | undefined;
  prPollInterval: number;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedUserIds(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => {
      const parsed = parseInt(id, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid user ID: ${id}`);
      }
      return parsed;
    });
}

function parseLogLevel(value: string | undefined): LogLevelName {
  const validLevels: LogLevelName[] = ["debug", "info", "warn", "error", "none"];
  const level = value?.toLowerCase() as LogLevelName;
  if (level && validLevels.includes(level)) {
    return level;
  }
  return "info";
}

export function loadConfig(): Config {
  return {
    telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Optional if using OAuth
    obsidianVaultPath: getRequiredEnv("OBSIDIAN_VAULT_PATH"),
    allowedUserIds: parseAllowedUserIds(process.env.ALLOWED_USER_IDS),
    botDirectory: process.env.BOT_DIRECTORY || process.cwd(),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    // GitHub integration for self-development
    githubToken: process.env.GITHUB_TOKEN,
    githubRepo: process.env.GITHUB_REPO, // Format: owner/repo
    prPollInterval: parseInt(process.env.PR_POLL_INTERVAL || "300000", 10),
  };
}

export const config = loadConfig();

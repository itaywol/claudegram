/**
 * Claudegram - Telegram interface for Claude Code
 * Entry point
 */

import { createBot } from "./telegram/bot";
import { config } from "./config";
import { checkHealth } from "./claude/cli";
import { logger } from "./logger";
import { createReloadWatcher } from "./development/reload";

async function main() {
  logger.info("Starting Claudegram", {
    logLevel: config.logLevel,
    vaultPath: config.obsidianVaultPath,
    botDirectory: config.botDirectory,
  });

  // Check Claude CLI health
  const health = await checkHealth();
  if (!health.ok) {
    logger.error("Claude CLI health check failed", { message: health.message });
    logger.error("Make sure the Claude CLI is installed and configured");
    process.exit(1);
  }
  logger.info("Claude CLI ready", { version: health.message });

  // Create and start the bot
  const bot = createBot();

  // Initialize reload watcher if GitHub is configured
  const reloadWatcher = createReloadWatcher();
  if (reloadWatcher) {
    logger.info("PR auto-reload enabled", {
      repo: config.githubRepo,
      pollInterval: config.prPollInterval,
    });
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info("Shutdown signal received, stopping bot...");
    if (reloadWatcher) {
      reloadWatcher.stop();
    }
    await bot.stop();
    logger.info("Bot stopped, exiting");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the bot
  logger.info("Starting Telegram bot...");
  await bot.start({
    onStart: (botInfo) => {
      logger.info("Bot is running", {
        username: botInfo.username,
        id: botInfo.id,
      });
      if (config.allowedUserIds.length > 0) {
        logger.info("User access restricted", {
          allowedUserIds: config.allowedUserIds,
        });
      } else {
        logger.warn("No user restrictions configured - bot is open to all users");
      }
    },
  });
}

main().catch((error) => {
  logger.error("Fatal error", error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});

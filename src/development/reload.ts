/**
 * Reload and auto-update utilities
 * Watches for merged PRs and triggers bot restart
 */

import { config } from "../config";
import { createLogger } from "../logger";
import { checkForMergedPRs, pullLatest, type PRInfo } from "./git";

const devLogger = createLogger("development");

// Default poll interval: 5 minutes
const DEFAULT_POLL_INTERVAL = 300000;

/**
 * Watcher for merged PRs that triggers auto-reload
 */
export class ReloadWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastCheckedMergedPRs: Set<number> = new Set();
  private onMergeCallback: ((pr: PRInfo) => void) | null = null;

  /**
   * Start watching for merged PRs
   */
  start(): void {
    if (this.intervalId) {
      devLogger.warn("ReloadWatcher already running");
      return;
    }

    const interval = config.prPollInterval || DEFAULT_POLL_INTERVAL;
    devLogger.info("Starting ReloadWatcher", { interval });

    // Do initial check
    this.checkForUpdates();

    // Set up polling
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, interval);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      devLogger.info("ReloadWatcher stopped");
    }
  }

  /**
   * Register callback for when a merge is detected
   */
  onMergeDetected(callback: (pr: PRInfo) => void): void {
    this.onMergeCallback = callback;
  }

  /**
   * Check for newly merged PRs
   */
  private async checkForUpdates(): Promise<void> {
    try {
      const mergedPRs = await checkForMergedPRs();

      for (const pr of mergedPRs) {
        if (!this.lastCheckedMergedPRs.has(pr.number)) {
          devLogger.info("New merged PR detected", {
            number: pr.number,
            title: pr.title,
          });

          this.lastCheckedMergedPRs.add(pr.number);

          if (this.onMergeCallback) {
            this.onMergeCallback(pr);
          }
        }
      }

      // Keep track of recent merged PRs (limit to last 20)
      if (this.lastCheckedMergedPRs.size > 20) {
        const sorted = Array.from(this.lastCheckedMergedPRs).sort((a, b) => b - a);
        this.lastCheckedMergedPRs = new Set(sorted.slice(0, 20));
      }
    } catch (error) {
      devLogger.debug("Failed to check for merged PRs", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Check if there are updates available
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const mergedPRs = await checkForMergedPRs();
    return mergedPRs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Perform a reload by pulling latest and exiting
 * The runner script will restart the process
 */
export async function performReload(): Promise<never> {
  devLogger.info("Performing reload...");

  const pulled = await pullLatest();
  if (!pulled) {
    devLogger.error("Failed to pull latest changes");
  }

  devLogger.info("Exiting for restart...");
  process.exit(0);
}

/**
 * Create and start a reload watcher with default behavior
 */
export function createReloadWatcher(): ReloadWatcher | null {
  if (!config.githubToken || !config.githubRepo) {
    devLogger.debug("GitHub not configured, ReloadWatcher disabled");
    return null;
  }

  const watcher = new ReloadWatcher();

  watcher.onMergeDetected(async (pr) => {
    devLogger.info("Auto-reloading after PR merge", {
      number: pr.number,
      title: pr.title,
    });
    await performReload();
  });

  watcher.start();
  return watcher;
}

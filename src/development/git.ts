/**
 * Git and GitHub operations for self-development
 * Branch management, PR creation, and merge detection
 */

import { spawn } from "bun";
import { config } from "../config";
import { createLogger } from "../logger";

const devLogger = createLogger("development");

export interface BranchInfo {
  name: string;
  isFeatureBranch: boolean;
}

export interface PRInfo {
  number: number;
  title: string;
  branch: string;
  url: string;
  state: string;
}

/**
 * Execute a git command and return stdout
 */
async function execGit(args: string[]): Promise<string> {
  const proc = spawn({
    cmd: ["git", ...args],
    cwd: config.botDirectory,
    stdout: "pipe",
    stderr: "pipe",
  });

  const decoder = new TextDecoder();
  const reader = proc.stdout.getReader();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  reader.releaseLock();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderrReader = proc.stderr.getReader();
    let stderr = "";
    while (true) {
      const { done, value } = await stderrReader.read();
      if (done) break;
      stderr += decoder.decode(value, { stream: true });
    }
    stderrReader.releaseLock();
    throw new Error(`Git command failed: ${stderr || output}`);
  }

  return output.trim();
}

/**
 * Get the current git branch
 */
export async function getCurrentBranch(): Promise<string> {
  return execGit(["branch", "--show-current"]);
}

/**
 * Create a new feature branch
 */
export async function createFeatureBranch(name: string): Promise<BranchInfo> {
  const branchName = `feature/${name.toLowerCase().replace(/\s+/g, "-")}`;

  // Ensure we're on main first
  await execGit(["checkout", "main"]);
  await execGit(["pull", "origin", "main"]);

  // Create and checkout new branch
  await execGit(["checkout", "-b", branchName]);

  devLogger.info("Created feature branch", { branchName });

  return {
    name: branchName,
    isFeatureBranch: true,
  };
}

/**
 * Commit changes with a message
 */
export async function commitChanges(message: string): Promise<string> {
  await execGit(["add", "-A"]);
  await execGit(["commit", "-m", message]);
  const hash = await execGit(["rev-parse", "HEAD"]);
  devLogger.info("Committed changes", { message, hash: hash.slice(0, 8) });
  return hash;
}

/**
 * Push current branch to remote
 */
export async function pushBranch(): Promise<void> {
  const branch = await getCurrentBranch();
  await execGit(["push", "-u", "origin", branch]);
  devLogger.info("Pushed branch to remote", { branch });
}

/**
 * List open pull requests from GitHub
 */
export async function listOpenPRs(): Promise<PRInfo[]> {
  if (!config.githubToken || !config.githubRepo) {
    throw new Error("GitHub configuration not set");
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.githubRepo}/pulls?state=open`,
    {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const prs = (await response.json()) as Array<{
    number: number;
    title: string;
    head: { ref: string };
    html_url: string;
    state: string;
  }>;

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    branch: pr.head.ref,
    url: pr.html_url,
    state: pr.state,
  }));
}

/**
 * Create a pull request on GitHub
 */
export async function createPR(title: string, body: string): Promise<PRInfo> {
  if (!config.githubToken || !config.githubRepo) {
    throw new Error("GitHub configuration not set");
  }

  const branch = await getCurrentBranch();

  const response = await fetch(
    `https://api.github.com/repos/${config.githubRepo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: "main",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${error}`);
  }

  const pr = (await response.json()) as {
    number: number;
    title: string;
    head: { ref: string };
    html_url: string;
    state: string;
  };

  devLogger.info("Created pull request", {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
  });

  return {
    number: pr.number,
    title: pr.title,
    branch: pr.head.ref,
    url: pr.html_url,
    state: pr.state,
  };
}

/**
 * Check for recently merged PRs
 */
export async function checkForMergedPRs(): Promise<PRInfo[]> {
  if (!config.githubToken || !config.githubRepo) {
    return [];
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.githubRepo}/pulls?state=closed&sort=updated&direction=desc&per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const prs = (await response.json()) as Array<{
    number: number;
    title: string;
    head: { ref: string };
    html_url: string;
    state: string;
    merged_at: string | null;
  }>;

  return prs
    .filter((pr) => pr.merged_at)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      url: pr.html_url,
      state: "merged",
    }));
}

/**
 * Pull latest changes from remote
 */
export async function pullLatest(): Promise<boolean> {
  try {
    await execGit(["checkout", "main"]);
    await execGit(["pull", "origin", "main"]);
    devLogger.info("Pulled latest changes");
    return true;
  } catch (error) {
    devLogger.error("Failed to pull latest", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await execGit(["status", "--porcelain"]);
  return status.length > 0;
}

/**
 * MCP Server management for Claudegram
 * Handles discovery, status checking, and configuration of MCP servers
 */

import { spawn } from "bun";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { mcpLogger as log } from "./logger";

export interface McpServer {
  name: string;
  type: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  scope: "global" | "project";
  status?: "unknown" | "running" | "stopped" | "error";
  tools?: McpTool[];
  requiresAuth?: boolean;
  authType?: "oauth" | "api_key" | "bearer";
}

export interface McpTool {
  name: string;
  description?: string;
}

export interface McpListOutput {
  servers: Array<{
    name: string;
    type: string;
    scope: string;
    command?: string;
    args?: string[];
    url?: string;
  }>;
}

const SECRETS_DIR = join(homedir(), ".claude", "secrets");

/**
 * List all configured MCP servers using Claude CLI
 */
export async function listMcpServers(): Promise<McpServer[]> {
  try {
    const proc = spawn({
      cmd: ["claude", "mcp", "list"],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      // If no servers, Claude CLI returns error
      if (stderr.includes("No MCP servers configured") || output.includes("No MCP servers")) {
        return [];
      }
      log.error("Failed to list MCP servers", { stderr });
      return [];
    }

    // Parse JSON output if available
    try {
      const data = JSON.parse(output);
      if (Array.isArray(data)) {
        return data.map((server: any) => ({
          name: server.name,
          type: server.type || "stdio",
          command: server.command,
          args: server.args,
          url: server.url,
          scope: server.scope || "global",
          status: "unknown" as const,
        }));
      }
    } catch {
      // Fall back to text parsing
    }

    // Parse text output (fallback)
    const servers: McpServer[] = [];
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)/);
      if (match) {
        servers.push({
          name: match[1]!,
          type: (match[2] as "stdio" | "http" | "sse") || "stdio",
          scope: (match[3] as "global" | "project") || "global",
          status: "unknown",
        });
      }
    }

    return servers;
  } catch (error) {
    log.error("Error listing MCP servers", error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Get details about a specific MCP server
 */
export async function getMcpServerDetails(name: string): Promise<McpServer | null> {
  try {
    const proc = spawn({
      cmd: ["claude", "mcp", "get", name],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return null;
    }

    // Parse the output - Claude CLI returns formatted text
    const server: McpServer = {
      name,
      type: "stdio",
      scope: "global",
      status: "unknown",
    };

    // Try to extract details from output
    if (output.includes("type: http") || output.includes("url:")) {
      server.type = "http";
    } else if (output.includes("type: sse")) {
      server.type = "sse";
    }

    const urlMatch = output.match(/url:\s*(\S+)/);
    if (urlMatch) {
      server.url = urlMatch[1];
    }

    const commandMatch = output.match(/command:\s*(.+)/);
    if (commandMatch) {
      server.command = commandMatch[1]?.trim();
    }

    return server;
  } catch (error) {
    log.error("Error getting MCP server details", error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Add a new MCP server using Claude CLI
 */
export async function addMcpServer(config: {
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  scope?: "global" | "project";
}): Promise<{ success: boolean; message: string }> {
  try {
    const args = ["mcp", "add"];

    // Add scope flag
    if (config.scope === "project") {
      args.push("--scope", "project");
    }

    // Add transport type
    if (config.type === "http") {
      args.push("--transport", "http");
    }

    // Add environment variables
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // Add headers for HTTP servers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        args.push("--header", `${key}: ${value}`);
      }
    }

    // Add name
    args.push(config.name);

    // Add command/URL
    if (config.type === "http" && config.url) {
      args.push(config.url);
    } else if (config.command) {
      args.push("--", config.command);
      if (config.args) {
        args.push(...config.args);
      }
    }

    const proc = spawn({
      cmd: ["claude", ...args],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return { success: false, message: stderr || "Failed to add MCP server" };
    }

    return { success: true, message: output || "MCP server added successfully" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove an MCP server
 */
export async function removeMcpServer(name: string, scope?: "global" | "project"): Promise<{ success: boolean; message: string }> {
  try {
    const args = ["mcp", "remove"];
    if (scope === "project") {
      args.push("--scope", "project");
    }
    args.push(name);

    const proc = spawn({
      cmd: ["claude", ...args],
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return { success: false, message: stderr || "Failed to remove MCP server" };
    }

    return { success: true, message: "MCP server removed successfully" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Store a secret securely for MCP servers
 * Secrets are stored in ~/.claude/secrets/ with restricted permissions
 */
export async function storeSecret(name: string, value: string): Promise<{ success: boolean; message: string }> {
  try {
    // Ensure secrets directory exists
    if (!existsSync(SECRETS_DIR)) {
      await mkdir(SECRETS_DIR, { recursive: true, mode: 0o700 });
    }

    const secretPath = join(SECRETS_DIR, `${name}.secret`);

    // Write secret with restricted permissions (owner read/write only)
    await writeFile(secretPath, value, { mode: 0o600 });

    return { success: true, message: `Secret stored at ${secretPath}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Retrieve a stored secret
 */
export async function getSecret(name: string): Promise<string | null> {
  try {
    const secretPath = join(SECRETS_DIR, `${name}.secret`);
    if (!existsSync(secretPath)) {
      return null;
    }
    return await readFile(secretPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * List stored secrets (names only, not values)
 */
export async function listSecrets(): Promise<string[]> {
  try {
    if (!existsSync(SECRETS_DIR)) {
      return [];
    }
    const { readdir } = await import("fs/promises");
    const files = await readdir(SECRETS_DIR);
    return files
      .filter((f) => f.endsWith(".secret"))
      .map((f) => f.replace(".secret", ""));
  } catch {
    return [];
  }
}

/**
 * Delete a stored secret
 */
export async function deleteSecret(name: string): Promise<{ success: boolean; message: string }> {
  try {
    const secretPath = join(SECRETS_DIR, `${name}.secret`);
    if (!existsSync(secretPath)) {
      return { success: false, message: "Secret not found" };
    }
    const { unlink } = await import("fs/promises");
    await unlink(secretPath);
    return { success: true, message: "Secret deleted" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format MCP servers for Telegram display
 */
export function formatMcpServersForDisplay(servers: McpServer[]): string {
  if (servers.length === 0) {
    return "*No MCP servers configured*\n\nUse the mcp-manager agent to add servers.";
  }

  const lines: string[] = ["*MCP Servers*\n"];

  for (const server of servers) {
    const typeIcon = server.type === "http" ? "🌐" : server.type === "sse" ? "📡" : "⚙️";
    const scopeIcon = server.scope === "project" ? "📁" : "🌍";

    lines.push(`${typeIcon} *${server.name}*`);
    lines.push(`   Type: \`${server.type}\` ${scopeIcon} ${server.scope}`);

    if (server.url) {
      lines.push(`   URL: \`${server.url}\``);
    }
    if (server.command) {
      lines.push(`   Command: \`${server.command}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate OAuth URL for browser authentication
 * Returns a URL that can be opened in a browser for OAuth flow
 */
export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  redirectUri?: string;
}

export async function generateOAuthUrl(config: OAuthConfig, state: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  if (config.redirectUri) {
    params.set("redirect_uri", config.redirectUri);
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for tokens
 */
export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set("client_secret", config.clientSecret);
    }
    if (config.redirectUri) {
      body.set("redirect_uri", config.redirectUri);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = (await response.json()) as { access_token?: string; refresh_token?: string };
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

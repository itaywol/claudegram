/**
 * Claude Code CLI wrapper
 * Uses the claude CLI in print mode with streaming JSON output
 */

import { spawn } from "bun";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { config } from "../config";
import { sessionManager } from "./session";
import { claudeLogger } from "../logger";

/**
 * Load system prompt from file with variable substitution
 */
async function loadSystemPrompt(): Promise<string> {
  const promptPath = join(config.botDirectory, ".claude", "system-prompt.md");

  try {
    if (existsSync(promptPath)) {
      let prompt = await readFile(promptPath, "utf-8");
      // Substitute variables
      prompt = prompt.replace(/\$OBSIDIAN_VAULT_PATH/g, config.obsidianVaultPath);
      prompt = prompt.replace(/\$BOT_DIRECTORY/g, config.botDirectory);
      claudeLogger.debug("Loaded system prompt from file", { path: promptPath });
      return prompt;
    }
  } catch (error) {
    claudeLogger.warn("Failed to load system prompt file, using fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback inline prompt
  return `You are Claudegram, a self-developing Telegram bot.

Format responses for Telegram: *bold*, _italic_, \`code\`, \`\`\`blocks\`\`\`
Keep responses concise - 4096 char limit per message.

Workspaces:
- Obsidian vault: ${config.obsidianVaultPath}
- Bot source: ${config.botDirectory}

For code changes, always use branches and PRs. Tell user to /restart after changes.`;
}

export interface ClaudeResponse {
  type: string;
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_result?: string;
  error?: string;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolUse?: (toolName: string, input: unknown) => void;
  onToolResult?: (result: string) => void;
  onError: (error: string) => void;
  onComplete: () => void;
}

/**
 * Send a message to Claude and stream the response
 */
export async function sendMessage(
  userId: number,
  message: string,
  callbacks: StreamCallbacks
): Promise<string | undefined> {
  const session = sessionManager.getSession(userId);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  claudeLogger.info("Sending message to Claude", {
    requestId,
    userId,
    messageLength: message.length,
    messagePreview: message.slice(0, 100),
    hasExistingSession: !!session.conversationId,
    conversationId: session.conversationId?.slice(0, 8),
  });

  const systemPrompt = await loadSystemPrompt();

  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
    "--append-system-prompt",
    systemPrompt,
    "--add-dir",
    config.botDirectory,
  ];

  // Resume session if we have a conversation ID
  if (session.conversationId) {
    args.push("--resume", session.conversationId);
  }

  const env = { ...process.env };
  if (config.anthropicApiKey) {
    env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  }

  claudeLogger.debug("Spawning Claude CLI process", {
    requestId,
    cwd: config.obsidianVaultPath,
    resuming: !!session.conversationId,
  });

  const startTime = performance.now();

  const proc = spawn({
    cmd: ["claude", ...args],
    cwd: config.obsidianVaultPath,
    env,
    stdin: new Blob([message]),
    stdout: "pipe",
    stderr: "pipe",
  });

  let fullResponse = "";
  let newConversationId: string | undefined;
  const streamState = { hasStreamedText: false };

  const decoder = new TextDecoder();
  let buffer = "";

  // Read stdout stream
  const reader = proc.stdout.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          claudeLogger.debug("Received stream event", {
            requestId,
            eventType: event.type,
          });
          const result = processStreamEvent(event, callbacks, streamState, requestId);
          if (result.text) {
            fullResponse += result.text;
          }
          if (result.conversationId) {
            newConversationId = result.conversationId;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer) as Record<string, unknown>;
        claudeLogger.debug("Processing final buffer event", {
          requestId,
          eventType: event.type,
        });
        const result = processStreamEvent(event, callbacks, streamState, requestId);
        if (result.text) {
          fullResponse += result.text;
        }
        if (result.conversationId) {
          newConversationId = result.conversationId;
        }
      } catch {
        // Skip non-JSON data
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Read stderr for errors
  const stderrReader = proc.stderr.getReader();
  let stderrOutput = "";
  try {
    while (true) {
      const { done, value } = await stderrReader.read();
      if (done) break;
      stderrOutput += decoder.decode(value, { stream: true });
    }
  } finally {
    stderrReader.releaseLock();
  }

  const exitCode = await proc.exited;
  const duration = Math.round(performance.now() - startTime);

  if (exitCode !== 0 && stderrOutput) {
    claudeLogger.error("Claude CLI process failed", {
      requestId,
      exitCode,
      stderr: stderrOutput.slice(0, 500),
      duration,
    });
    callbacks.onError(stderrOutput);
  } else if (exitCode !== 0) {
    claudeLogger.warn("Claude CLI exited with non-zero code", {
      requestId,
      exitCode,
      duration,
    });
  }

  // Update session with new conversation ID
  if (newConversationId) {
    sessionManager.updateConversationId(userId, newConversationId);
  }

  claudeLogger.info("Claude request completed", {
    requestId,
    userId,
    exitCode,
    duration,
    responseLength: fullResponse.length,
    newConversationId: newConversationId?.slice(0, 8),
  });

  callbacks.onComplete();

  return newConversationId;
}

interface ProcessResult {
  text?: string;
  conversationId?: string;
}

function processStreamEvent(
  event: Record<string, unknown>,
  callbacks: StreamCallbacks,
  state: { hasStreamedText: boolean },
  requestId: string
): ProcessResult {
  const result: ProcessResult = {};

  // Handle different event types from claude CLI stream-json output
  switch (event.type) {
    case "assistant":
      // Skip - we use content_block_delta for streaming text instead
      break;

    case "content_block_delta":
      // Streaming text delta
      if (event.delta && typeof event.delta === "object") {
        const delta = event.delta as Record<string, unknown>;
        if (delta.type === "text_delta" && typeof delta.text === "string") {
          result.text = delta.text;
          callbacks.onText(delta.text);
          state.hasStreamedText = true;
        }
      }
      break;

    case "result":
      // Final result with session info
      if (typeof event.session_id === "string") {
        result.conversationId = event.session_id;
      }
      // Only use result text if we didn't get streaming deltas
      if (!state.hasStreamedText && typeof event.result === "string") {
        result.text = event.result;
        callbacks.onText(event.result);
      }
      break;

    case "error":
      if (typeof event.error === "string") {
        claudeLogger.error("Claude stream error", { requestId, error: event.error });
        callbacks.onError(event.error);
      } else if (
        event.error &&
        typeof event.error === "object" &&
        "message" in event.error
      ) {
        const errorMessage = (event.error as { message: string }).message;
        claudeLogger.error("Claude stream error", { requestId, error: errorMessage });
        callbacks.onError(errorMessage);
      }
      break;

    case "tool_use":
      if (callbacks.onToolUse && typeof event.name === "string") {
        claudeLogger.debug("Tool use", {
          requestId,
          toolName: event.name,
          inputPreview: JSON.stringify(event.input)?.slice(0, 100),
        });
        callbacks.onToolUse(event.name, event.input);
      }
      break;

    case "tool_result":
      if (callbacks.onToolResult && typeof event.content === "string") {
        claudeLogger.debug("Tool result", {
          requestId,
          resultLength: event.content.length,
          resultPreview: event.content.slice(0, 100),
        });
        callbacks.onToolResult(event.content);
      }
      break;
  }

  return result;
}

/**
 * Check if Claude CLI is available and working
 */
export async function checkHealth(): Promise<{
  ok: boolean;
  message: string;
}> {
  claudeLogger.debug("Performing health check");

  try {
    const proc = spawn({
      cmd: ["claude", "--version"],
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

    if (exitCode === 0) {
      claudeLogger.info("Health check passed", { version: output.trim() });
      return { ok: true, message: `Claude CLI v${output.trim()}` };
    } else {
      claudeLogger.warn("Health check failed", { exitCode });
      return { ok: false, message: "Claude CLI not responding" };
    }
  } catch (error) {
    claudeLogger.error("Health check error", error instanceof Error ? error : new Error(String(error)));
    return {
      ok: false,
      message: `Claude CLI error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

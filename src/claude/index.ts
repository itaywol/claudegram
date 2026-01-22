/**
 * Claude Code abstraction layer
 * Re-exports all Claude-related functionality
 */

export { sendMessage, checkHealth, type ClaudeResponse, type StreamCallbacks } from "./cli";
export { sessionManager, type Session } from "./session";
export {
  parseToolUseEvent,
  parseToolResultEvent,
  formatToolInput,
  type ToolUseEvent,
  type ToolResultEvent,
} from "./tools";

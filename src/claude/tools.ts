/**
 * Tool result parsing utilities
 * Handles parsing and formatting of Claude tool events
 */

export interface ToolUseEvent {
  type: "tool_use";
  name: string;
  input: unknown;
}

export interface ToolResultEvent {
  type: "tool_result";
  content: string;
}

/**
 * Parse a tool use event from stream JSON
 */
export function parseToolUseEvent(event: Record<string, unknown>): ToolUseEvent | null {
  if (event.type !== "tool_use" || typeof event.name !== "string") {
    return null;
  }

  return {
    type: "tool_use",
    name: event.name,
    input: event.input,
  };
}

/**
 * Parse a tool result event from stream JSON
 */
export function parseToolResultEvent(event: Record<string, unknown>): ToolResultEvent | null {
  if (event.type !== "tool_result" || typeof event.content !== "string") {
    return null;
  }

  return {
    type: "tool_result",
    content: event.content,
  };
}

/**
 * Format tool input for logging (truncated)
 */
export function formatToolInput(input: unknown, maxLength = 100): string {
  try {
    const str = JSON.stringify(input);
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 3) + "...";
  } catch {
    return "[Unserializable]";
  }
}

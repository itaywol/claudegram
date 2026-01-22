/**
 * Logger module for Claudegram
 * Provides structured logging with configurable levels and formatted output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export type LogLevelName = "debug" | "info" | "warn" | "error" | "none";

const LOG_LEVEL_MAP: Record<LogLevelName, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  none: LogLevel.NONE,
};

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.NONE]: "NONE",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "\x1b[36m", // Cyan
  [LogLevel.INFO]: "\x1b[32m",  // Green
  [LogLevel.WARN]: "\x1b[33m",  // Yellow
  [LogLevel.ERROR]: "\x1b[31m", // Red
  [LogLevel.NONE]: "",
};

const RESET_COLOR = "\x1b[0m";
const DIM_COLOR = "\x1b[2m";

interface LoggerOptions {
  level?: LogLevel | LogLevelName;
  component?: string;
  useColors?: boolean;
  includeTimestamp?: boolean;
}

/**
 * Format a timestamp for log output
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Safely stringify a value for logging
 */
function safeStringify(value: unknown, maxLength = 500): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return truncate(value, maxLength);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  try {
    const str = JSON.stringify(value, null, 2);
    return truncate(str, maxLength);
  } catch {
    return "[Unserializable]";
  }
}

class Logger {
  private level: LogLevel;
  private component: string;
  private useColors: boolean;
  private includeTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = this.parseLevel(options.level ?? LogLevel.INFO);
    this.component = options.component ?? "app";
    this.useColors = options.useColors ?? process.stdout.isTTY ?? true;
    this.includeTimestamp = options.includeTimestamp ?? true;
  }

  private parseLevel(level: LogLevel | LogLevelName): LogLevel {
    if (typeof level === "number") return level;
    return LOG_LEVEL_MAP[level] ?? LogLevel.INFO;
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel | LogLevelName): void {
    this.level = this.parseLevel(level);
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Create a child logger with a specific component name
   */
  child(component: string): Logger {
    return new Logger({
      level: this.level,
      component,
      useColors: this.useColors,
      includeTimestamp: this.includeTimestamp,
    });
  }

  /**
   * Format a log message
   */
  private format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const parts: string[] = [];

    // Timestamp
    if (this.includeTimestamp) {
      if (this.useColors) {
        parts.push(`${DIM_COLOR}${formatTimestamp()}${RESET_COLOR}`);
      } else {
        parts.push(formatTimestamp());
      }
    }

    // Level
    const levelName = LEVEL_NAMES[level] ?? "UNKNOWN";
    if (this.useColors) {
      const color = LEVEL_COLORS[level] ?? "";
      parts.push(`${color}[${levelName.padEnd(5)}]${RESET_COLOR}`);
    } else {
      parts.push(`[${levelName.padEnd(5)}]`);
    }

    // Component
    if (this.useColors) {
      parts.push(`${DIM_COLOR}[${this.component}]${RESET_COLOR}`);
    } else {
      parts.push(`[${this.component}]`);
    }

    // Message
    parts.push(message);

    // Data (if provided)
    if (data && Object.keys(data).length > 0) {
      const dataEntries = Object.entries(data)
        .map(([key, value]) => `${key}=${safeStringify(value, 200)}`)
        .join(" ");
      if (this.useColors) {
        parts.push(`${DIM_COLOR}${dataEntries}${RESET_COLOR}`);
      } else {
        parts.push(dataEntries);
      }
    }

    return parts.join(" ");
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.format(LogLevel.DEBUG, message, data));
    }
  }

  /**
   * Log at INFO level
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.format(LogLevel.INFO, message, data));
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.format(LogLevel.WARN, message, data));
    }
  }

  /**
   * Log at ERROR level
   */
  error(message: string, data?: Record<string, unknown>): void;
  error(message: string, error: Error, data?: Record<string, unknown>): void;
  error(message: string, errorOrData?: Error | Record<string, unknown>, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      let logData = data ?? {};

      if (errorOrData instanceof Error) {
        logData = {
          ...logData,
          error: errorOrData.message,
          stack: errorOrData.stack,
        };
      } else if (errorOrData) {
        logData = errorOrData;
      }

      console.error(this.format(LogLevel.ERROR, message, logData));
    }
  }
}

/**
 * Parse log level from environment variable
 */
export function parseLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_MAP) {
    return LOG_LEVEL_MAP[envLevel as LogLevelName];
  }
  return LogLevel.INFO;
}

// Create the root logger instance
const rootLevel = parseLogLevelFromEnv();
const rootLogger = new Logger({ level: rootLevel, component: "claudegram" });

// Export child loggers for different components
export const logger = rootLogger;
export const botLogger = rootLogger.child("bot");
export const claudeLogger = rootLogger.child("claude");
export const sessionLogger = rootLogger.child("session");
export const notesLogger = rootLogger.child("notes");
export const skillsLogger = rootLogger.child("skills");
export const configLogger = rootLogger.child("config");
export const mcpLogger = rootLogger.child("mcp");
export const oauthLogger = rootLogger.child("oauth");
export const telegramLogger = rootLogger.child("telegram");
export const developmentLogger = rootLogger.child("development");

/**
 * Create a custom child logger
 */
export function createLogger(component: string): Logger {
  return rootLogger.child(component);
}

export default logger;

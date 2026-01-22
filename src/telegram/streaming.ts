/**
 * Streaming message management for Telegram
 * Handles "thinking" indicator and progressive message updates during streaming responses
 */

import type { Context } from "grammy";
import { botLogger } from "../logger";
import { sendLongMessage } from "./utils";

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const STREAMING_UPDATE_INTERVAL_MS = 1500;
const MIN_TEXT_CHANGE_FOR_UPDATE = 50;

/**
 * Manages streaming message updates - sends initial "thinking" message,
 * then edits it as content streams in
 */
export class StreamingMessageManager {
  private ctx: Context;
  private messageId: number | null = null;
  private chatId: number | null = null;
  private currentText = "";
  private lastSentText = "";
  private lastUpdateTime = 0;
  private updatePending = false;
  private thinkingPhase = true;
  private thinkingDots = 1;
  private thinkingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  /**
   * Start the streaming session by sending initial "thinking" message
   */
  async start(): Promise<void> {
    try {
      const message = await this.ctx.reply("🤔 _Thinking..._", { parse_mode: "Markdown" });
      this.messageId = message.message_id;
      this.chatId = message.chat.id;

      // Animate thinking dots while waiting for first content
      this.thinkingInterval = setInterval(async () => {
        if (this.thinkingPhase && this.messageId && this.chatId) {
          this.thinkingDots = (this.thinkingDots % 3) + 1;
          const dots = ".".repeat(this.thinkingDots);
          try {
            await this.ctx.api.editMessageText(
              this.chatId,
              this.messageId,
              `🤔 _Thinking${dots}_`,
              { parse_mode: "Markdown" }
            );
          } catch {
            // Ignore edit errors during thinking animation
          }
        }
      }, 800);
    } catch (error) {
      botLogger.error("Failed to send initial thinking message", error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Add text to the buffer and potentially update the message
   */
  async appendText(text: string): Promise<void> {
    // Stop thinking animation on first real content
    if (this.thinkingPhase && text.trim()) {
      this.thinkingPhase = false;
      if (this.thinkingInterval) {
        clearInterval(this.thinkingInterval);
        this.thinkingInterval = null;
      }
    }

    this.currentText += text;

    // Rate limit updates
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    const textChanged = this.currentText.length - this.lastSentText.length;

    if (
      !this.updatePending &&
      timeSinceLastUpdate >= STREAMING_UPDATE_INTERVAL_MS &&
      textChanged >= MIN_TEXT_CHANGE_FOR_UPDATE
    ) {
      this.updatePending = true;
      await this.sendUpdate();
    }
  }

  /**
   * Send an update to the message
   */
  private async sendUpdate(): Promise<void> {
    if (!this.messageId || !this.chatId || this.currentText === this.lastSentText) {
      this.updatePending = false;
      return;
    }

    // Truncate if too long for a single message (show latest content)
    let displayText = this.currentText;
    if (displayText.length > TELEGRAM_MAX_MESSAGE_LENGTH - 20) {
      displayText = "..." + displayText.slice(-(TELEGRAM_MAX_MESSAGE_LENGTH - 23));
    }

    // Add streaming indicator
    displayText = displayText + "\n\n⏳ _streaming..._";

    try {
      await this.ctx.api.editMessageText(this.chatId, this.messageId, displayText, {
        parse_mode: "Markdown",
      });
      this.lastSentText = this.currentText;
      this.lastUpdateTime = Date.now();
    } catch (error) {
      // If Markdown fails, try plain text
      try {
        const plainText = displayText.replace(/_/g, "").replace(/\*/g, "");
        await this.ctx.api.editMessageText(this.chatId, this.messageId, plainText);
        this.lastSentText = this.currentText;
        this.lastUpdateTime = Date.now();
      } catch {
        // Ignore errors - message might not have changed or other API issue
      }
    }
    this.updatePending = false;
  }

  /**
   * Finalize the message with the complete response
   */
  async finalize(): Promise<void> {
    // Stop thinking animation if still running
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
      this.thinkingInterval = null;
    }

    if (!this.messageId || !this.chatId) {
      // Fallback to regular message if we don't have the initial message
      if (this.currentText) {
        await sendLongMessage(this.ctx, this.currentText);
      }
      return;
    }

    if (!this.currentText.trim()) {
      // Empty response
      try {
        await this.ctx.api.editMessageText(
          this.chatId,
          this.messageId,
          "I received your message but had no response."
        );
      } catch {
        await this.ctx.reply("I received your message but had no response.");
      }
      return;
    }

    // If response fits in one message, edit the existing one
    if (this.currentText.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      try {
        await this.ctx.api.editMessageText(this.chatId, this.messageId, this.currentText, {
          parse_mode: "Markdown",
        });
      } catch {
        // Try without markdown
        try {
          await this.ctx.api.editMessageText(this.chatId, this.messageId, this.currentText);
        } catch {
          // Last resort: send as new message
          await this.ctx.reply(this.currentText);
        }
      }
    } else {
      // Response is too long - delete thinking message and send chunked
      try {
        await this.ctx.api.deleteMessage(this.chatId, this.messageId);
      } catch {
        // Ignore delete errors
      }
      await sendLongMessage(this.ctx, this.currentText);
    }
  }

  /**
   * Handle an error during streaming
   */
  async error(errorMessage: string): Promise<void> {
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
      this.thinkingInterval = null;
    }

    if (this.messageId && this.chatId) {
      try {
        await this.ctx.api.editMessageText(
          this.chatId,
          this.messageId,
          `❌ Error: ${errorMessage}`
        );
        return;
      } catch {
        // Fall through to reply
      }
    }
    await this.ctx.reply(`Error: ${errorMessage}`);
  }
}

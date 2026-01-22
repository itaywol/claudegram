/**
 * Session management for conversation persistence
 * In-memory storage for conversation IDs per user
 */

import { sessionLogger } from "../logger";

export interface Session {
  conversationId: string | undefined;
  createdAt: Date;
  lastMessageAt: Date;
}

class SessionManager {
  private sessions: Map<number, Session> = new Map();

  getSession(userId: number): Session {
    let session = this.sessions.get(userId);
    if (!session) {
      sessionLogger.debug("Creating new session", { userId });
      session = {
        conversationId: undefined,
        createdAt: new Date(),
        lastMessageAt: new Date(),
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  updateConversationId(userId: number, conversationId: string): void {
    const session = this.getSession(userId);
    const isNew = !session.conversationId;
    session.conversationId = conversationId;
    session.lastMessageAt = new Date();

    sessionLogger.debug("Session conversation ID updated", {
      userId,
      conversationId: conversationId.slice(0, 8),
      isNew,
    });
  }

  resetSession(userId: number): void {
    const hadSession = this.sessions.has(userId);
    this.sessions.delete(userId);
    sessionLogger.info("Session reset", { userId, hadSession });
  }

  hasSession(userId: number): boolean {
    return this.sessions.has(userId);
  }

  getStats(): { totalSessions: number } {
    return {
      totalSessions: this.sessions.size,
    };
  }
}

export const sessionManager = new SessionManager();

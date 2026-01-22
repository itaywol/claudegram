/**
 * Note-taking agent for capturing quick notes to Obsidian inbox
 */

import { config } from "./config";
import { join } from "path";
import { notesLogger } from "./logger";

const INBOX_PATH = join(config.obsidianVaultPath, "01-Inbox");

/**
 * Generate a filename from note content
 * Takes first few words or a summary
 */
function generateFilename(content: string): string {
  // Clean the content and take first ~5 words
  const cleaned = content
    .replace(/[^\w\s]/g, " ") // Remove special chars
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  const words = cleaned.split(" ").slice(0, 5);
  let filename = words.join(" ");

  // Truncate if too long
  if (filename.length > 50) {
    filename = filename.slice(0, 50).trim();
  }

  // Fallback if empty
  if (!filename) {
    filename = "Untitled Note";
  }

  return filename;
}

/**
 * Create a new inbox note with the given content
 * Returns the created filename
 */
export async function createInboxNote(content: string): Promise<string> {
  notesLogger.debug("Creating inbox note", { contentLength: content.length });

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = now.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss

  const filename = generateFilename(content);
  const fullFilename = `${filename}.md`;
  const filePath = join(INBOX_PATH, fullFilename);

  // Check if file exists and add number suffix if needed
  let finalPath = filePath;
  let finalFilename = fullFilename;
  let counter = 1;

  while (await Bun.file(finalPath).exists()) {
    notesLogger.debug("Filename exists, incrementing counter", { filename: finalFilename, counter });
    finalFilename = `${filename} ${counter}.md`;
    finalPath = join(INBOX_PATH, finalFilename);
    counter++;
  }

  const noteContent = `---
tags:
created_at: ${dateStr}
created_at_time: ${timeStr}
---
# What is it

${content}
`;

  await Bun.write(finalPath, noteContent);

  notesLogger.info("Inbox note created", { filename: finalFilename, path: finalPath });

  return finalFilename;
}

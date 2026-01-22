---
description: Quick capture a note to Obsidian inbox
argument-hint: <note content>
---

# Note Capture Skill

Capture a quick note to the Obsidian inbox.

## Usage

```
/note Buy groceries tomorrow
/note Meeting notes: discussed Q1 roadmap
```

## Behavior

1. Take the provided text content
2. Create a new markdown file in the Obsidian inbox folder
3. Filename format: `inbox-YYYYMMDD-HHMMSS.md`
4. Confirm creation to user

## Implementation

This skill is handled natively by Claudegram's `/note` command handler.
When invoked through Claude, delegate to the bot's note creation system.

The inbox path is configured via `OBSIDIAN_VAULT_PATH` environment variable,
notes go to the `inbox/` subdirectory.

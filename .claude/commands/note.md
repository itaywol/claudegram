---
description: Quick capture a note to Obsidian inbox
argument-hint: <note content>
---

# Note Capture Skill

Capture a quick note to the Obsidian inbox with proper frontmatter for Bases filtering.

## Usage

```
/note Buy groceries tomorrow
/note Meeting notes: discussed Q1 roadmap
```

## Behavior

1. Take the provided text content
2. Create a new markdown file in `01-Inbox/`
3. Filename format: `inbox-YYYYMMDD-HHMMSS.md`
4. Include frontmatter:
   ```yaml
   ---
   tags: [inbox]
   type: task
   created_at: YYYY-MM-DD
   processed: false
   ---
   ```
5. Confirm creation to user

## Implementation

This skill is handled natively by Claudegram's `/note` command handler.
When invoked through Claude, delegate to the bot's note creation system.

The inbox path is `01-Inbox/` under the vault configured via `OBSIDIAN_VAULT_PATH`.

## Frontmatter Properties

| Property | Type | Purpose |
|----------|------|---------|
| tags | list | Always `[inbox]` for filtering |
| type | text | Default `task`, can be: task, idea, reference, question |
| created_at | date | YYYY-MM-DD format |
| processed | checkbox | `false` by default, set `true` when processed |

The `processed: false` property allows Obsidian Bases to filter unprocessed items.

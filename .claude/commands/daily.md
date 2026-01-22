---
description: View or create today's daily note
argument-hint: [section to focus on]
---

# Daily Note Skill

Access and interact with today's Obsidian daily note.

## Usage

```
/daily              - Show today's daily note
/daily tasks        - Show just the tasks section
/daily add task     - Add a task to today's note
```

## Behavior

1. Locate today's daily note in Obsidian vault
2. If no argument: display full note content
3. If section specified: extract and show that section
4. For "add" commands: append to appropriate section

## Daily Note Location

Daily notes are in: `{OBSIDIAN_VAULT_PATH}/daily/YYYY-MM-DD.md`

## Sections

Common sections to query:
- `tasks` - Task list / todos
- `notes` - General notes
- `journal` - Journal entries
- `schedule` - Day's schedule

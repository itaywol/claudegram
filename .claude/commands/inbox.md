---
description: View and process inbox items
argument-hint: [all|process]
---

# Inbox Skill

View unprocessed inbox items and optionally process them interactively.

## Usage

```
/inbox              - Show count + 5 most recent unprocessed items
/inbox all          - List all unprocessed items
/inbox process      - Start interactive processing session
```

## Behavior

### Default (`/inbox`)
1. Read all files in `01-Inbox/`
2. Filter for notes with `processed: false` in frontmatter
3. Display count and 5 most recent items
4. Format: `[count] unprocessed items:\n- item1\n- item2...`

### All (`/inbox all`)
1. Same as default but show all items
2. Sorted by created_at descending

### Process (`/inbox process`)
1. Get oldest unprocessed item
2. Show its content
3. Ask user: "What is this? (Task/Idea/Reference/Question/Delete)"
4. Based on response:
   - **Task**: Ask which project or create standalone in daily note
   - **Idea**: Move to `03-Knowledge/Notes/` with `type: idea`
   - **Reference**: Move to `03-Knowledge/Resources/`
   - **Question**: Move to `03-Knowledge/Notes/` with `type: question`
   - **Delete**: Delete the file
5. Mark original as `processed: true` (or delete)
6. Ask "Process another?" and continue or stop

## Inbox Location

`{OBSIDIAN_VAULT_PATH}/01-Inbox/`

## Frontmatter Filter

Only show items where:
```yaml
processed: false
```

## Response Format (Telegram)

```
*Inbox: 7 unprocessed items*

Recent:
- Buy groceries (Jan 23)
- Meeting notes from call (Jan 22)
- Research: Drizzle ORM (Jan 21)
- Idea: Automation tool (Jan 20)
- Schedule dentist (Jan 19)

Use `/inbox process` to work through them.
```

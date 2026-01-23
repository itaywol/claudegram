---
description: View or interact with today's daily note
argument-hint: [section|add <task>]
---

# Daily Note Skill

Access today's daily note in the Obsidian vault.

## Usage

```
/daily              - Show today's full daily note
/daily focus        - Show Today's Focus section
/daily log          - Show Log section
/daily add <task>   - Add task to Today's Focus
```

## Daily Note Location

Daily notes are in: `{OBSIDIAN_VAULT_PATH}/05-Daily/YYYY/YYYY-MM-DD.md`

Example: `05-Daily/2026/2026-01-23.md`

## Sections

| Section | Purpose |
|---------|---------|
| `focus` | Today's Focus - the #1 priority task(s) |
| `log` | Log section for notes throughout the day |

## Behavior

1. Calculate today's date in YYYY-MM-DD format
2. Construct path: `05-Daily/{YYYY}/{YYYY-MM-DD}.md`
3. If no argument: display full note content
4. If section specified: extract and show that section
5. For `add <task>`: append `- [ ] <task>` to Today's Focus section

## Template Structure

```markdown
---
tags: [daily]
date: YYYY-MM-DD
energy:
---
# YYYY-MM-DD, Day

## Today's Focus
- [ ] #1 priority

## Log


---
<< [[YYYY-MM-DD]] | [[YYYY-MM-DD]] >>
```

## Properties

| Property | Type | Purpose |
|----------|------|---------|
| tags | list | Always `[daily]` |
| date | date | The note's date |
| energy | text | Optional: high, medium, low |

---
description: List and view active projects
argument-hint: [all|<project name>]
---

# Projects Skill

View active projects and their status.

## Usage

```
/projects           - List active projects with status
/projects all       - Include on-hold projects
/projects <name>    - Show specific project details + tasks
```

## Behavior

### Default (`/projects`)
1. Read all files in `02-Active/Projects/`
2. Filter for notes with `status: active` in frontmatter
3. Display project name, due date, and first unchecked task
4. Sorted by due date (soonest first)

### All (`/projects all`)
1. Include both `status: active` and `status: hold`
2. Group by status

### Specific (`/projects <name>`)
1. Find project matching name (fuzzy match)
2. Show full project details:
   - Outcome
   - Why This Matters
   - All tasks (checked and unchecked)
   - Due date and energy level

## Projects Location

`{OBSIDIAN_VAULT_PATH}/02-Active/Projects/`

## Frontmatter Properties

```yaml
---
tags: [project]
status: active | hold | done
goal: "[[Goal Name]]"
due: YYYY-MM-DD
energy: high | medium | low
started: YYYY-MM-DD
---
```

## Response Format (Telegram)

### List View
```
*Active Projects (3)*

1. *Side Hustle MVP*
   Due: Feb 15 | Energy: high
   Next: Validate idea with 5 users

2. *Fitness Plan*
   Due: - | Energy: medium
   Next: Schedule gym sessions

3. *Home Office Setup*
   Due: Jan 31 | Energy: low
   Next: Order standing desk
```

### Detail View
```
*Side Hustle MVP*
Status: active | Due: Feb 15

*Outcome:*
Launch MVP and get 5 paying customers

*Why:*
Financial independence by 40

*Tasks:*
- [x] Define problem statement
- [x] Identify target users
- [ ] Validate with 5 users
- [ ] Build landing page
- [ ] Run ads test
```

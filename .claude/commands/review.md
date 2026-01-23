---
description: Start daily review workflow
argument-hint:
---

# Review Skill

Guide through a quick daily review workflow.

## Usage

```
/review             - Start daily review
```

## Behavior

The review is an interactive workflow that takes ~5 minutes:

### Step 1: Inbox Check
1. Count unprocessed inbox items
2. Display: "You have X items in your inbox"
3. If > 10 items, flag for attention

### Step 2: Today's Focus
1. Read today's daily note
2. Show current focus task(s)
3. Ask: "Is this still your #1 priority?" or "Set your focus for today?"

### Step 3: Active Projects
1. List active projects with next actions
2. Highlight any with due dates this week
3. Ask if any need attention

### Step 4: Quick Actions
Offer options:
- Process inbox items (`/inbox process`)
- Update daily note (`/daily`)
- View specific project (`/projects <name>`)
- Done for now

## Flow Example

```
*Daily Review*

*1. Inbox*
You have 7 unprocessed items.
(3 from today, 4 older)

*2. Today's Focus*
Current: "Finish API documentation"
Is this still your #1 priority?

*3. Projects*
3 active projects:
- Side Hustle MVP (due Feb 15) - next: Validate with users
- Fitness Plan - next: Schedule gym
- Home Office (due Jan 31) - next: Order desk

*What would you like to do?*
1. Process inbox
2. Update today's focus
3. Work on a project
4. Done
```

## Paths

| Data | Location |
|------|----------|
| Inbox | `01-Inbox/` |
| Daily | `05-Daily/YYYY/YYYY-MM-DD.md` |
| Projects | `02-Active/Projects/` |

## Response Format (Telegram)

Keep responses concise. Use numbered options for quick replies.
Break into multiple messages if needed to stay under 4096 char limit.

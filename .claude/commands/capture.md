---
description: Smart capture with auto-type detection
argument-hint: <content>
---

# Capture Skill

Enhanced quick capture that auto-detects content type.

## Usage

```
/capture Buy groceries           - Creates inbox task
/capture idea: App for tracking  - Creates inbox idea
/capture ref: https://...        - Creates inbox reference
/capture ? Why do goals fail     - Creates inbox question
```

## Type Detection

| Pattern | Detected Type | Example |
|---------|---------------|---------|
| Contains URL | reference | `/capture https://example.com` |
| Starts with `idea:` | idea | `/capture idea: New feature concept` |
| Starts with `ref:` | reference | `/capture ref: Article about X` |
| Starts with `?` | question | `/capture ? How does X work` |
| Default | task | `/capture Call the dentist` |

## Behavior

1. Parse input for type indicators
2. Strip type prefix if present
3. Create note in `01-Inbox/` with detected type
4. Frontmatter:
   ```yaml
   ---
   tags: [inbox]
   type: <detected-type>
   created_at: YYYY-MM-DD
   processed: false
   ---
   ```
5. Confirm with type shown

## Examples

### Task (default)
```
/capture Schedule dentist appointment
```
Creates:
```markdown
---
tags: [inbox]
type: task
created_at: 2026-01-23
processed: false
---
# Schedule dentist appointment
```

### Idea
```
/capture idea: Build a habit tracker with streaks
```
Creates:
```markdown
---
tags: [inbox]
type: idea
created_at: 2026-01-23
processed: false
---
# Build a habit tracker with streaks
```

### Reference
```
/capture https://drizzle.team/docs/overview
```
Creates:
```markdown
---
tags: [inbox]
type: reference
created_at: 2026-01-23
processed: false
---
# https://drizzle.team/docs/overview
```

### Question
```
/capture ? What's the best way to structure a monorepo
```
Creates:
```markdown
---
tags: [inbox]
type: question
created_at: 2026-01-23
processed: false
---
# What's the best way to structure a monorepo
```

## Response Format (Telegram)

```
Captured as *task*:
"Schedule dentist appointment"
```

```
Captured as *idea*:
"Build a habit tracker with streaks"
```

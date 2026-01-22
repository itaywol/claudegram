---
description: Schedule an event from notes or natural language
argument-hint: <event description or note reference>
---

# Schedule Skill

Create calendar events from natural language or Obsidian note references.

## Usage

```
/schedule Meeting with John tomorrow at 2pm
/schedule from today's daily note
/schedule dentist appointment next Tuesday 10am for 1 hour
```

## Behavior

1. Parse the event description or find referenced note
2. Extract: title, date/time, duration, location (if any)
3. Use Google Calendar MCP to create the event
4. Confirm creation with event details

## Requirements

- Google Calendar MCP must be configured and authenticated
- For note references, Obsidian vault must be accessible

## Natural Language Parsing

Supports:
- Relative dates: "tomorrow", "next Tuesday", "in 2 days"
- Times: "2pm", "14:00", "morning", "afternoon"
- Durations: "for 1 hour", "30 minutes"
- Locations: "at Starbucks", "in conference room"

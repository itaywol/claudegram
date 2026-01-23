---
description: View life areas and their status
argument-hint: [<area name>]
---

# Areas Skill

View ongoing life areas (Work, Health, Home, Relationship).

## Usage

```
/areas              - List all areas with current focus
/areas <name>       - Show specific area details
/areas work         - Show Work area
/areas health       - Show Health area
```

## Behavior

### Default (`/areas`)
1. Read all files in `02-Active/Areas/`
2. Display each area with its current focus
3. Show any ongoing tasks

### Specific (`/areas <name>`)
1. Find area matching name
2. Show full area details:
   - Purpose
   - Current Focus
   - Ongoing Tasks
   - Recent notes

## Areas Location

`{OBSIDIAN_VAULT_PATH}/02-Active/Areas/`

## Standard Areas

| Area | Purpose |
|------|---------|
| Work | Professional career and growth |
| Health | Physical fitness and wellbeing |
| Home | Living space and household |
| Relationship | Yuval, family, friends |

## Frontmatter Properties

```yaml
---
tags: [area]
type: work | health | home | relationship
review: weekly | monthly
created_at: YYYY-MM-DD
---
```

## Response Format (Telegram)

### List View
```
*Life Areas*

*Work*
Focus: Q1 roadmap planning
Tasks: 2 ongoing

*Health*
Focus: Marathon training
Tasks: 3 ongoing

*Home*
Focus: Office organization
Tasks: 1 ongoing

*Relationship*
Focus: Plan anniversary trip
Tasks: 0 ongoing
```

### Detail View
```
*Health*
Review: weekly

*Purpose:*
Physical fitness, mental wellbeing, and longevity.

*Current Focus:*
Marathon training - building base mileage

*Ongoing Tasks:*
- [ ] Run 3x this week
- [ ] Strength training 2x
- [ ] Book physio appointment
```

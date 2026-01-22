---
description: Search across Obsidian vault and codebase
argument-hint: <search query>
---

# Search Skill

Search for content across the Obsidian vault and Claudegram codebase.

## Usage

```
/search meeting notes from last week
/search how does the session manager work
/search TODO items in my notes
```

## Behavior

1. Parse the search query
2. Determine search scope (notes, code, or both)
3. Use grep/glob to find matches
4. Return summarized results with file locations

## Search Scopes

- **Notes**: Searches `OBSIDIAN_VAULT_PATH` for markdown files
- **Code**: Searches Claudegram source in `src/`
- **Both**: Default behavior, searches all accessible paths

## Result Format

Returns:
- File path
- Matching line/context
- Brief summary of relevance

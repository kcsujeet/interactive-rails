---
description: Load full project context (docs, spec, architecture, recent sessions) and start a new session log
---

# Load Project Context

Build a complete understanding of the project by reading documentation and recent session history, then start a new session log.

## Steps

### 1. Read project documentation

Read these files in `docs/` to understand the project's design, architecture, and content structure:

- `docs/spec.md` - Game specification, level designs, learning objectives
- `docs/architecture.md` - System architecture and technical design
- `docs/content-structure.md` - How level content is organized
- `docs/game-mechanics.md` - Gameplay mechanics and interaction patterns
- `docs/database-schema.md` - Data model
- `docs/development-setup.md` - Dev environment setup
- `docs/api-reference.md` - API endpoints

Read these in parallel to save time. Skim long files for key sections rather than reading every line.

### 2. Read recent session logs

- List all files in `docs/sessions/`
- Read the most recent 5 session logs (or all if fewer than 5)
- Note what was changed recently, ongoing work, and open issues

### 3. Prune old session logs

- Keep only the 5 most recent session log files
- Delete any older ones (they are stale and the codebase has moved on)

### 4. Create a new session log

- Check if any sessions exist for today's date (format: `YYYY-MM-DD`)
- If yes, increment the session number
- If no, start at session 1
- Create `docs/sessions/{date}-session-{n}.md` with this template:

```markdown
# Session: {date} - Session {n}

## Summary

(Fill in as work progresses)

## Changes

(Document each change as it happens)

## Architecture Notes

(Record any structural decisions or discoveries)
```

### 5. Present context summary

Give a brief oriented summary covering:
- What the project is and its current state
- What was done in recent sessions
- Any in-progress or upcoming work

### 6. Ongoing

As the session progresses, update the session log with changes made, decisions taken, and learnings.

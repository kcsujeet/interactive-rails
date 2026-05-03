---
paths:
  - "**/SKILL.md"
  - ".agents/skills/**/*.md"
  - ".claude/skills/**/*.md"
---

# Skill Organization

This rule auto-loads when you touch any skill markdown file. It encodes the canonical Claude Code skills layout so SKILL.md stays scannable and the supporting files do the heavy lifting.

Source: <https://code.claude.com/docs/en/skills>

## The 500-line rule (non-negotiable)

> "Keep `SKILL.md` under 500 lines. Move detailed reference material to separate files."
> — Claude Code skills docs

Run `wc -l SKILL.md` after every edit. If it's at 500 or above, extract before committing.

Why: skill descriptions load at session start; full skill content loads when invoked and stays in conversation context for the rest of the session. A 1,500-line SKILL.md eats context every time the skill is used. Supporting files load only when the SKILL.md links to them and Claude actually opens them.

## The canonical layout

```
my-skill/
├── SKILL.md            # required, < 500 lines, navigation + non-negotiables
├── reference.md        # detailed reference material, loaded when needed
├── examples.md         # usage examples, loaded when needed
└── scripts/
    └── helper.py       # executed, not loaded
```

SKILL.md is an **index plus the rules that absolutely must be hot in every invocation**. Detail goes into siblings. Scripts go in `scripts/` and run via `${CLAUDE_SKILL_DIR}/scripts/...`.

## What stays in SKILL.md

- Frontmatter (`description`, `when_to_use`, `allowed-tools`, etc.)
- Top-of-file orientation: when to use this skill, when not to.
- The non-negotiable steps and rules. Anything the user must see EVERY time the skill runs.
- Cross-references to siblings: short pointer paragraphs ("for X, see [reference.md]").
- A high-level checklist or step list — but with bullets, not full prose. Full prose belongs in the supporting file.

## What gets extracted

| Content shape | Where it goes |
|---------------|---------------|
| Long checklists (40+ items, multiple sub-headings) | `<topic>-checklist.md` |
| Detailed walkthroughs of one phase / step / pattern | `<phase-or-step>-guide.md` |
| Case studies with code snippets | `<topic>-examples.md` or `case-studies.md` |
| Big tables / decision matrices | dedicated `<topic>.md` |
| Helper scripts | `scripts/<name>.{sh,py,ts}` |
| Templates Claude fills in | `template.md` or `templates/<name>.md` |

If the topic is referenced from multiple skills, put it in the most-relevant skill and link from the others via relative path (`[…](../audit-level/narrative-state-coherence.md)`).

## The extraction recipe

When SKILL.md gets near 500 lines:

1. **Find the largest H2 sections** with `awk '/^## / { ... }'` to get section sizes. The biggest one is your candidate.
2. **Check for an existing supporting file** that already covers the topic. If so, append to it instead of creating a new file.
3. **Move the section** verbatim into the supporting file. Promote `## ` to `# ` for the new file's title.
4. **Replace the section in SKILL.md** with a short summary (5–15 lines) plus a link: `see [supporting-file.md](supporting-file.md)`. The summary lists what's in the supporting file so a reader knows whether to open it.
5. **Re-run `wc -l SKILL.md`** to confirm it's under 500.
6. **Verify the link works** by opening the new file from SKILL.md's relative path.

## Hardlink note (this project specifically)

`.agents/skills/<skill>/` and `.claude/skills/<skill>/` are hardlinked at the directory level (same inode). New files created in one path appear in the other automatically. Edits to `SKILL.md` in either path propagate. No manual copy / `ln` needed.

## Existing supporting files in this project (don't duplicate)

- `audit-level/`: `audit-checklist.md`, `cross-phase-consistency.md`, `cumulative-patterns.md`, `implementation-rules.md`, `pipelineflow-guide.md`, `terminal-layout-guide.md`, `narrative-state-coherence.md`
- `design-level/`: `build-phase-guide.md`, `design-checklist.md`, `observe-phase-guide.md`, `reference-implementations.md`, `reward-phase-guide.md`, `step-3-visualization-design.md`, `visualization-examples.md`

If a topic fits one of these, route it there.

## Anti-patterns

- **Don't inline a long checklist "for convenience"**: it's never just one. Three of them and SKILL.md is 600 lines.
- **Don't duplicate content** between SKILL.md and a supporting file. Pick one home and link.
- **Don't extract if the section is the SKILL.md's reason for existing.** A `commit` skill that runs `git commit` should keep its instructions in SKILL.md, not punt to `commit-instructions.md`.
- **Don't drop links when extracting.** SKILL.md must point at every supporting file it relies on, or readers won't find them.

# Commit Discipline

**Always ask for permission before committing changes. Always. Every time.** Never run `git commit` (or `git commit --amend`, `git push`, `git tag`, `git reset --hard`, or any other git operation that mutates history or shared state) without explicit user approval for that specific commit.

## The protocol

When work is at a natural stopping point and you think a commit makes sense:

1. **Stop. Do not draft the commit command yet.**
2. Run `git status --short` and `git diff --stat` to summarize what's in the working tree.
3. **Tell the user**:
   - What changed (one-line per file or per-topic summary).
   - The proposed commit message subject (don't write the body yet).
   - Whether you'd recommend one commit or multiple.
4. **Ask explicitly: "May I commit this?"** End your message with a question.
5. **Wait for an explicit yes**. "ok", "go ahead", "commit", "yes", "do it", or similar in the next user turn. A previous commit's "yes" does not carry forward.
6. After approval, run the commit. Only then.

## What "ask" actually looks like

```
Working tree:
- file-a.ts (+12 / -3): added X helper
- file-b.test.ts (new, 40 lines): unit tests for X
- file-c.md (+5): session log entry

All checks pass. May I commit as `feat(thing): add X helper + tests`?
```

vs. what NOT to do:

```
[Bash tool call: git add ... && git commit -m "..."]
```

The second form is the failure mode. It assumes approval. It moves the work into the user's "interrupt and undo" path instead of their "ack and proceed" path.

## Why this matters

Commits are visible. They land in `git log`, propagate when pushed, and shape the user's understanding of what got done. Skipping the ask:

- Forces the user into a reactive role (interrupt to stop) instead of a proactive one (approve to proceed).
- Bundles topics that should be separate commits, because there's no review checkpoint.
- Buries the commit message in a tool call where the user can't easily edit before it lands.

A 30-second pause to summarize and ask costs almost nothing. Skipping it costs trust and creates messy history.

## Common rationalizations to ignore

| Thought | Reality |
|---------|---------|
| "The user just approved a commit, so this next one is fine." | They approved THAT commit. Each one needs its own ask. |
| "I'm just continuing the same task." | Tasks span commits; commits are the human's checkpoint, not yours. |
| "It's a tiny change, ask is overkill." | Tiny changes still belong on the user's screen before they land. |
| "I already showed them the diff." | Showing isn't asking. End with a question. |
| "Tests pass, so it's safe." | Safe to commit ≠ approved to commit. |
| "I'll commit and they can revert." | Reverts are public. Asking is private. Always cheaper to ask. |

## Adjacent destructive operations (same rule applies)

The "always ask" rule extends to anything that mutates shared / hard-to-reverse state:

- `git commit`, `git commit --amend`
- `git push`, `git push --force`, `git push --force-with-lease`
- `git tag`, `git tag -d`
- `git reset --hard`, `git checkout --` (when it discards work), `git restore .`
- `git rebase`, `git merge`, `git cherry-pick`
- `git branch -D`, `git remote add/remove`
- Anything that touches the user's `~/.zshrc`, global config, or system-level state outside `project/`

For each, summarize the intent, ask, and wait.

## When the user has pre-authorized

The user can grant durable authorization in `CLAUDE.md`, `AGENTS.md`, or a session-start instruction ("commit freely on this branch"). In that case the rule relaxes for that specific scope. Without explicit durable authorization, default to ask.

The harness also enforces a layer here: `.claude/settings.json` includes `"permissions": { "ask": ["Bash(git commit:*)"] }`, which surfaces a permission dialog. **Don't rely on the dialog as your "ask".** That's a backstop. The user-visible "may I commit?" message in chat is the real protocol — the dialog is just the safety net.

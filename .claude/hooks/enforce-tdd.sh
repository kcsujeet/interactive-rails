#!/usr/bin/env bash
#
# UserPromptSubmit hook: injects a non-negotiable TDD reminder.
#
# Wired in: .claude/settings.json under hooks.UserPromptSubmit
# Path resolution: invoked via "$CLAUDE_PROJECT_DIR"/.claude/hooks/...
# (per https://code.claude.com/docs/en/hooks — UserPromptSubmit fires
# before Claude processes the prompt; `additionalContext` is appended to
# the conversation context for the turn.)
#
# Why: project rule `.agents/rules/testing.md` says "write tests WHILE
# building, not after." Tests written after the code rationalize the
# implementation; tests written first design the API and catch the bug
# class. This hook keeps the reminder hot in every turn so it never
# slips through.

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"NON-NEGOTIABLE RULE (project): practice TDD. Before writing or modifying production code (functions, classes, methods, services, validators, helpers, scripts), write or update the test FIRST. Run the test, see it fail, then implement. Run the test, see it pass. The order matters: tests after code rationalize the implementation; tests before code design the API and catch the bug class. For bug fixes: write a failing test that reproduces the bug, then fix. Never commit untested logic. Exceptions: docs, config files (.json, .yml, .toml), pure data/content definitions, snapshot updates that match real source, level component composition (rendering JSX without logic). For everything else, test first."}}
JSON

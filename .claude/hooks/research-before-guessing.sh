#!/usr/bin/env bash
#
# UserPromptSubmit hook: injects a non-negotiable reminder to fetch canonical
# docs (via WebFetch) before authoring or modifying code that touches any
# external API. Past sessions in this codebase shipped fabricated method
# names, fake config syntax (Kamal hooks, Active Record encryption), and
# invented gem APIs because this rule was skipped.
#
# Wired in: .claude/settings.json under hooks.UserPromptSubmit
# Path resolution: invoked via "$CLAUDE_PROJECT_DIR"/.claude/hooks/...
# (per https://code.claude.com/docs/en/hooks)
#
# Output is a single JSON object whose `additionalContext` field is injected
# into the model's context for this turn.

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"NON-NEGOTIABLE RULE (project): before authoring or modifying code that touches any external API (Rails feature, gem, JS library, framework, language API, CLI tool, or anything with public documentation), WebFetch the canonical docs FIRST. Do not rely on cached knowledge. When stating facts about external APIs in code previews, build steps, scenario stories, or explanations, cite the source inline. Cached knowledge drifts; canonical docs are authoritative. This codebase has shipped fabricated Rails 8 methods, fake Kamal config syntax, and invented Active Record encryption APIs because this rule was skipped. Verify before authoring."}}
JSON

# Codebase validator (design)

## Why

Each level's hand-authored `registerLevelCode(...)` callback returns a `CodeFile[]` shown in the codebase viewer (the "what would my project look like at the end of this level" panel). Today these strings are written by hand and can drift away from real Rails 8 reality (fabricated methods, fake config, stale gem versions, missing files).

The Act 1 ground-truth pass already proved this: every L1–L8 snapshot needed at least one factual fix. We don't want to repeat that audit by hand for L9–L58, and we don't want it to silently drift again next quarter.

The validator is a Bun script that compares each level's `registerLevelCode` output against the real `project/myapp/` source at the corresponding `level-N` git tag, and reports drift. Levels stay hand-authored and pedagogically tuned; the validator enforces "every visible identifier exists in real myapp."

## Scope (v1)

- Validates ONLY `registerLevelCode`'s output (the registry the codebase viewer reads).
- Per-step `getCodeFiles(furthestStep)` content during gameplay is OUT of scope. The reward-state is a superset of every step's content, so validating the reward state catches most drift.
- 58 levels. Some have empty registrations (`L1`) or only pseudo-files (`L5` returns "CRUD reference"); those are SKIPPED with a clear message.
- Run on demand: `bun run validate:codebase`. Not blocking on `bun run build`.

## Mapping levels to git tags

- Convention: level ID `act{X}-level{N}-{slug}` → git tag `level-{N}` in `project/myapp/`.
- Examples: `act1-level3-model` → `level-3`. `act3-level19-query-objects` → `level-19`.
- Tags are created in `project/myapp/` by the human who executes that level (e.g., during the Act 2 ground-truth pass we'll create `level-9`, `level-10`, …, `level-14`).
- If a tag is missing, the level's validation is SKIPPED with a "no tag yet" note, not a failure. (Until we've executed all 58 levels, most tags won't exist.)

## CodeFile classification (per item in the array)

For each `CodeFile` returned by `registerLevelCode()`:

| Classification | Filename signal | Action |
|----------------|-----------------|--------|
| **REAL** | starts with `app/` / `config/` / `db/` / `bin/` / `test/`; or basename `Gemfile`, `Rakefile`, `Dockerfile`, `config.ru`, `.ruby-version` | Validate against myapp |
| **PLACEHOLDER** | contains `<timestamp>` or `<sha>` | Resolve via glob at the tag, then validate |
| **PSEUDO** | filename contains a space, OR is a known label (`Stack`, `Generator Command`, `Test Results`, `Verify`, `Directory Layout`, `Rails Console`, `CRUD reference`, `Test`) | SKIP (informational only) |
| **GLOBAL** | starts with `~/` or `.` (dotfile at home), e.g. `~/.zshrc`, `.mise.toml` | SKIP for v1 (not in myapp) |

The classification is a heuristic. We can override via a per-level config if a heuristic gets it wrong, but starting with the heuristic and tweaking is faster than making every level declare its kind upfront.

## Comparison strategy (per REAL CodeFile)

1. Read real file content at the level's tag: `git -C project/myapp show <tag>:<resolved-path>`.
2. If the file doesn't exist at the tag → ❌ "claimed file does not exist in myapp at <tag>".
3. **Normalize** both the level's `code` and the real file:
   - Strip trailing whitespace per line.
   - Collapse multiple blank lines into one.
   - **Do not** drop comments — comments are content (e.g., `enable_extension "pg_catalog.plpgsql"` looks like a comment to a regex but is a real schema directive). Comment-stripping is opt-in per level if needed.
4. **Resolve placeholders** in the level's code:
   - `<timestamp>` → `\d{14}` (Rails migration timestamp).
   - `<sha>` → `[a-f0-9]{7,40}`.
5. **Comparison rule**: every NON-BLANK line of the level's normalized `code` must appear (as a regex match, after placeholder substitution) somewhere in the real file. Order does NOT matter (the level may show a subset; the real file may have additional context the level omits).
6. If every line matches → ✅. If any line is missing → ❌ with a unified-diff snippet showing the missing line and 3 lines of real-file context.

## Placeholder rules

- The validator runs against placeholders in BOTH `filename` and `code`.
- Filename example: `db/migrate/<timestamp>_create_products.rb` → glob `db/migrate/*_create_products.rb` at tag, take exact match.
- Code example: `class CreateProducts < ActiveRecord::Migration[8.1]` matches the real file regardless of the actual migration timestamp.

## Report format

```
$ bun run validate:codebase

Validating 58 levels against project/myapp/ at level-* tags...

  act1-level1-environment    ⏭   skipped (registerLevelCode returns [])
  act1-level2-first-boot     ✅  3/3 files match (Gemfile, config/database.yml, config/application.rb)
  act1-level3-model          ✅  3/3 files match
  act1-level4-associations   ✅  4/4 files match
  act1-level5-crud           ⏭   skipped (only pseudo-files: "CRUD reference")
  act1-level6-routes         ✅  1/1 files match
  act1-level7-controller     ✅  1/1 files match
  act1-level8-serializers    ✅  3/3 files match
  act2-level9-authentication ⚠   skipped (no level-9 tag in myapp yet)
  ...

Summary: 7 ok / 0 fail / 49 skip (1 empty, 1 pseudo, 47 untagged)
```

Exit code: 0 if no failures, 1 otherwise. Skips are not failures.

## Implementation outline

- Script: `scripts/validate-codebase.ts` (Bun).
- Refactor `src/lib/levels-registry.ts` to also export a parallel `LEVEL_LOADERS: Record<string, () => Promise<unknown>>` (the same dynamic-import functions, without React.lazy) so the script can `await loader()` to register code without rendering.
- Validator flow:
  1. Import `LEVEL_LOADERS` and `getLevelCode` (from codebase-registry).
  2. For each slug, `await loader()` to trigger `registerLevelCode` side effect.
  3. Call `getLevelCode(slug)`.
  4. Derive tag from slug (`act{X}-level{N}-...` → `level-{N}`).
  5. For each `CodeFile`: classify, fetch real content (or skip), compare, emit a row.
  6. At the end: summary + exit code.
- npm script: `bun run validate:codebase` (calls the Bun file directly).

## Tests

`scripts/__tests__/validate-codebase.test.ts` covers the comparison logic in isolation, fed fixtures rather than real myapp:

- **Classification**: `app/models/product.rb` → REAL; `<timestamp>_create.rb` → PLACEHOLDER; `Generator Command` → PSEUDO; `~/.zshrc` → GLOBAL.
- **Placeholder substitution**: `class X < ActiveRecord::Migration[8.1]` matches real file with that exact line.
- **Normalized comparison**: trailing whitespace and double-blank-lines don't trigger false positives.
- **Substring match**: level shows a 4-line snippet of a 60-line real file → ✅ when all 4 lines are in the real file.
- **Drift detection**: level claims `t.decimal :price, precision: 10, scale: 2` but real file has `t.decimal :price` → ❌ with the missing line in the diff.
- **Missing-tag handling**: level requests `level-99` which doesn't exist → SKIP with a clear note, not a failure.
- **Missing-file handling**: level claims `app/models/ghost.rb` which doesn't exist at the tag → ❌.

Run with `bun test scripts/__tests__/validate-codebase.test.ts`.

## Out of scope (v1)

- `--fix` mode (auto-rewrite the level's CodeFile to match real). Drift fixes need human judgment about stylization, simplification, comments — auto-rewrite would lose that. Re-evaluate after v1 lands.
- Per-step granularity validation. Reward state is a superset; this is the highest-value surface.
- Trigger / problem.goal / learningContent text validation. Different problem (not file content), defer.
- CI gating (`bun run build` doesn't fail on validator drift). Manual run for v1.

## Open decisions for confirmation

1. **Comparison strategy**: every non-blank line of the level's snippet must appear in the real file (order-independent, regex-matched after placeholder substitution). Anything stricter (full-file equality, byte-exact) creates too many false positives because levels intentionally simplify. OK to start here?

2. **Pseudo-file classification**: heuristic = "filename contains a space or is in a known label list." The known list is small (~7 labels seen in Act 1). Future levels can add more. OK to start with the heuristic and add overrides as needed?

3. **`--fix` mode**: skip for v1 (manual fixes preserve human stylization). Add later if the manual cost gets painful. OK?

4. **CI integration**: do NOT block `bun run build` on validator drift for v1; manual runs only. Drift becomes a "fix it next" backlog item, not a release blocker. OK?

---
name: audit-act
description: Audit an entire act for narrative flow, complexity progression, concept overlap, and schema consistency across all its levels. Use when reviewing act-level structure or reordering levels.
---

# Audit Act Narrative Flow

Audit all levels within an act (and their transitions) to verify the act tells a coherent story. This skill checks how levels relate to each other and whether the act works as a progression. Use `/audit-level` to audit each individual level's three-phase implementation.

## Inputs

The argument should be an act name or number (e.g., "Act 2", "Guards & Gates", "2").

## File Locations

- **Act content definitions:** `frontend/src/features/act{N}-{slug}/content.ts`
- **Level components:** `frontend/src/features/act{N}-{slug}/components/Level{NN}{Name}.tsx`
- **Acts registry:** `frontend/src/features/acts-registry.ts` (provides `getAct()`, `getLevel()`, `getAllLevels()`, `getActForLevel()`)
- **Levels registry:** `frontend/src/features/levels-registry.ts` (maps level IDs to components)
- **Spec:** `docs/spec.md`

Act directory slugs:
- Act 1: `act1-foundation` (L1-L8)
- Act 2: `act2-users-security` (L9-L15)
- Act 3: `act3-clean-architecture` (L16-L22)
- Act 4: `act4-performance` (L23-L31)
- Act 5: `act5-production` (L32-L39)
- Act 6: `act6-reliability` (L40-L46)
- Act 7: `act7-scale` (L47-L52)
- Act 8: `act8-mastery` (L53-L55)

## Procedure

### 1. Read the Act's Content Definition

Read the act's `content.ts` file. Extract:
- Act id, name, tagline, description
- Every level in order: id, levelNumber, name, trigger, problem, learningContent

### 2. Read the Spec

Read `docs/spec.md` and verify the act's table matches the code (same level names, same order, same numbering).

### 3. Check Act Calibration

Verify the act's levels match the expected complexity band from CLAUDE.md:

- **Acts 1-2:** Pure fundamentals. No anti-patterns, no debugging. Happy path only.
- **Acts 3-4:** First refactoring and performance problems appear.
- **Acts 5-8:** Production, reliability, scale, architecture.

Flag any level whose concept violates these boundaries. Example: rate limiting in Act 2 is too advanced (production concern). Strong params in Act 2 is correct (immediate security need).

### 4. Trace the App State

For each level in the act (and the last level of the previous act), trace what exists in the app AFTER that level completes. Track:

- **Models**: Which models exist? Which columns?
- **Gems**: Which gems have been installed?
- **Concepts taught**: What Rails concepts has the player learned?
- **Architecture**: What components are in place (routes, controllers, serializers, auth, policies, etc.)?

Write this out explicitly as a table:

```
| After Level | Models | Gems | Concepts | Architecture |
|-------------|--------|------|----------|--------------|
| L8 (prev act) | Post (title, body), Comment (body, post_id) | jsonapi-serializer | MVC, CRUD, associations | Routes, Controller, Serializer |
| L9 Auth | + User (email, password_digest) | + bcrypt | + auth, sessions, tokens | + Authentication middleware |
| L10 Validations | (same) | (same) | + model validations | + Validation layer |
| ... | ... | ... | ... | ... |
```

### 5. Check Each Transition (L[n] to L[n+1])

For every consecutive pair of levels, verify:

- [ ] **The next level's problem emerges from the current app state.** After L9 adds authentication, L10's "users submit garbage data" makes sense because authenticated users are now creating records. If the transition feels like a non sequitur, flag it.
- [ ] **The trigger acknowledges prior progress.** Good: "Users can authenticate, data is validated, and emails are normalized. But User A can still edit User B's posts." Bad: trigger ignores everything that came before.
- [ ] **Complexity does not regress.** Each level should feel at least as complex as the previous one. A model-layer DSL lesson (enums, scopes) after authorization, testing, and strong params is a regression. If needed, reframe the simpler concept to build on prior complexity.
- [ ] **Each level explicitly connects to the previous.** From CLAUDE.md: levels must form a coherent learning path with cumulative mastery. Check that each level references mechanics or concepts from earlier levels, not just introduces something disconnected.

### 6. Check Concept Ownership (No Overlap)

Each concept belongs to exactly one level. This applies both within the act AND across acts.

**Step 6a: Extract the Rails API surface per level.**

For every level in the act (and levels in adjacent acts that share topics), list the specific Rails APIs, methods, gems, and DSL keywords the level teaches. Be concrete:

```
| Level | Rails APIs / Keywords Taught |
|-------|------------------------------|
| L6    | params.expect(), render json:, before_action, controller generators |
| L14   | params.expect(), mass assignment, whitelist auditing |
```

If the same Rails API appears in two levels, that is a concept overlap, even if the levels frame it differently. "Teaching params.expect() for the first time" and "auditing params.expect() for security" both teach params.expect(). The player learns the API once; revisiting it in a later level is redundant.

**Step 6b: Check for overlap.**

- [ ] **No Rails API or keyword is the primary concept of two levels.** Scan the table from 6a. If `params.expect` appears as the core teaching of both L6 and L14, one level must be redesigned to teach a different concept or the two must be merged. A new framing ("security audit") does not justify re-teaching the same API.
- [ ] **No concept overlaps with levels in other acts.** Read content.ts of adjacent acts to verify. Examples from CLAUDE.md:
  - Level 2 (First Boot) should NOT add routing steps (Level 5 handles that)
  - Level 3 (Model) should NOT teach associations (Level 8 handles that)
  - Level 6 (Controller) should NOT teach testing (Level 13 handles that)
- [ ] **Check `learningContent.conceptExplanation` for overlap.** If two levels explain the same Rails feature, one of them is redundant.
- [ ] **Check the spec's "Rails 8 Features Integration" table.** If a feature appears at two level numbers (e.g., `params.expect()` at L6 and L14), flag it as a concept ownership conflict that needs resolution. Either one level introduces the API and the other only uses it as a prerequisite, or the levels need restructuring.

**The "same API, different framing" trap:** Repackaging the same Rails method under a new theme (e.g., "Controller" vs "Strong Params") feels like two distinct levels but teaches the same thing. The test: if you removed one level, would the player still learn the API from the other? If yes, the levels overlap.

### 7. Check Schema Consistency

For each level, verify every model, column, and association it references actually exists at that point:

- [ ] **No phantom columns.** If L15 references `Post.status`, a prior level must add that column via migration. If not, L15 must include the migration as its first step.
- [ ] **No phantom models.** If a level references a User model, verify it was created in a prior level.
- [ ] **No phantom gems.** If a level's codeExample uses `policy_scope(Post)`, verify Pundit was installed in a prior level.

**CRITICAL: Check both content.ts AND component .tsx files.** Content definitions and interactive components are separate files that can drift. A level's `content.ts` may be fixed but the component's data arrays, code preview generators, left panel text, or step options may still reference phantom models or columns. Grep the component for any flagged terms.

### 8. Check Content Quality

Every level has content fields that appear on the briefing page (LevelInfoApp) and during gameplay. Verify these are well-written and accurate:

- [ ] **`trigger.description`**: 1-2 sentences describing what the player will do. Must match the actual gameplay.
- [ ] **`problem.observation`**: What's wrong or missing. Must reflect the app state at this point.
- [ ] **`problem.codeExample`**: Teaches concepts and context. Must NOT show exact answers the player will choose in the build phase.
- [ ] **`problem.goal`**: Describes ALL steps the player will complete, not just the first one.
- [ ] **`learningContent.goal`**: Markdown bullet list of learning outcomes. These are surfaced on the briefing page as "What You'll Learn." Each bullet should be a concrete, actionable outcome (not vague).
- [ ] **`learningContent.title`**: Shown as a badge on the briefing page. Should be concise and descriptive.
- [ ] **Content and component are in sync.** If the component uses terminal interactions, the trigger should not say "Drag the node." Always check both halves.

### 9. Check Act-Level Coherence

- [ ] **Act description matches its levels.** If the description says "add authentication, validations, authorization, testing, parameter filtering, and query scopes," verify all of those appear as levels.
- [ ] **Act has a narrative arc.** The first level should introduce the act's theme. The last level should feel like a capstone or transition to the next act.
- [ ] **Level grouping makes sense.** Related concepts should be adjacent. Model-layer features grouped together, security features grouped together. Interleaving unrelated concepts breaks the learning flow.

### 10. Check Spec Alignment

- [ ] **Level names in spec.md match code.** If spec says "Seeds & Sample Data" but code has "Associations" at that position, flag the mismatch.
- [ ] **Level numbers in spec.md match code.** If code has L1=Environment but spec starts at L1=First Boot, flag it.
- [ ] **Rails 8 Features table references correct level numbers.** If spec says `enum` is at L16 but code puts it at L15, flag it.

## Output Format

Present findings as:

### Act Summary
- Act name, number of levels, theme, calibration band
- One-line summary of each level's role in the arc

### App State Trace
The table from step 4.

### Transition Analysis
For each L[n] to L[n+1] transition:
- **Pass/Fail** with explanation
- Specific text that needs updating if failed

### Content Quality
For each level, note any content fields that are missing, vague, or out of sync with the component.

### Issues Found
Numbered list of all issues, categorized as:
- **Schema ghost**: References to models/columns/gems that don't exist yet
- **Concept overlap**: Same concept taught in multiple levels
- **Complexity regression**: Level is simpler than what came before
- **Calibration violation**: Level concept doesn't match the act's complexity band
- **Narrative gap**: Trigger ignores prior levels or transition feels abrupt
- **Content drift**: content.ts and component .tsx are out of sync
- **Spec mismatch**: spec.md disagrees with code

### Suggested Fixes
For each issue, provide:
- The specific file and line to change
- The current text
- The suggested replacement text

## Follow-Up: Audit Individual Levels

After the act-level audit is complete, use the `/audit-level` skill to audit each individual level's three-phase implementation (observe/build/reward flow, step quality, documentation verification). The act audit checks how levels relate to each other; the level audit checks each level's internal correctness.

Run `/audit-level <levelId>` for any level flagged with issues above, or for all levels in the act if a thorough audit is requested.

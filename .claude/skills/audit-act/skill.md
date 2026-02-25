---
name: audit-act
description: Audit an entire act for narrative flow, complexity progression, concept overlap, and schema consistency across all its levels. Use when reviewing act-level structure or reordering levels.
---

# Audit Act Narrative Flow

Audit all levels within an act (and their transitions) to verify the act tells a coherent story. While `/audit-level` checks a single level's implementation, `/audit-act` checks how levels relate to each other and whether the act works as a progression.

## Inputs

The argument should be an act name or number (e.g., "Act 2", "Guards & Gates", "2").

## Procedure

### 1. Read the Act's Content Definition

Read the act's `content.ts` file (e.g., `frontend/src/features/act2-users-security/content.ts`). Extract:
- Act description and tagline
- Every level in order: id, levelNumber, name, trigger, problem, learningContent

### 2. Read the Spec

Read `docs/spec.md` and verify the act's table matches the code (same level names, same order, same numbering).

### 3. Trace the App State

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

### 4. Check Each Transition (L[n] to L[n+1])

For every consecutive pair of levels, verify:

- [ ] **The next level's problem emerges from the current app state.** After L9 adds authentication, L10's "users submit garbage data" makes sense because authenticated users are now creating records. If the transition feels like a non sequitur, flag it.
- [ ] **The trigger acknowledges prior progress.** Good: "Users can authenticate, data is validated, and emails are normalized. But User A can still edit User B's posts." Bad: trigger ignores everything that came before.
- [ ] **Complexity does not regress.** Each level should feel at least as complex as the previous one. A model-layer DSL lesson (enums, scopes) after authorization, testing, and strong params is a regression. If needed, reframe the simpler concept to build on prior complexity (e.g., "scopes complement authorization by controlling visibility").
- [ ] **No concept is taught twice.** If L6 teaches `params.expect`, L14 cannot introduce it as new. L14 can deepen it (audit the whitelist, handle nested params) but must acknowledge L6's teaching. Check `learningContent.conceptExplanation` for overlap.

### 5. Check Schema Consistency

For each level, verify every model, column, and association it references actually exists at that point:

- [ ] **No phantom columns.** If L15 references `Post.status`, a prior level must add that column via migration. If not, L15 must include the migration as its first step.
- [ ] **No phantom models.** If L7 says "password_digest is leaking," verify a User model with `has_secure_password` exists. At L7 in Act 1, only Post and Comment exist.
- [ ] **No phantom gems.** If a level's codeExample uses `policy_scope(Post)`, verify Pundit was installed in a prior level.

**CRITICAL: Check both content.ts AND component .tsx files.** Content definitions and interactive components are separate files that can drift. A level's `content.ts` may be fixed but the component's ATTRIBUTES array, "Before/After" comparison, left panel instruction text, or code preview generator may still reference phantom models or columns. Grep the component for any flagged terms.

### 6. Check Act-Level Coherence

- [ ] **Act description matches its levels.** If the description says "add authentication, validations, authorization, testing, parameter filtering, and query scopes," verify all of those appear as levels.
- [ ] **Act has a narrative arc.** The first level should introduce the act's theme (e.g., "users are signing up"). The last level should feel like a capstone or transition to the next act (e.g., CORS connects the frontend).
- [ ] **Level grouping makes sense.** Related concepts should be adjacent. Model-layer features (validations, callbacks, enums) grouped together, security features (auth, authorization, strong params) grouped together. Interleaving unrelated concepts breaks the learning flow.

### 7. Check Spec Alignment

- [ ] **Level names in spec.md match code.** If spec says "Seeds & Sample Data" but code has "Associations" at that position, flag the mismatch.
- [ ] **Level numbers in spec.md match code.** If code has L1=Environment but spec starts at L1=First Boot, flag it.
- [ ] **Rails 8 Features table references correct level numbers.** If spec says `enum` is at L16 but code puts it at L15, flag it.

## Output Format

Present findings as:

### Act Summary
- Act name, number of levels, theme
- One-line summary of each level's role in the arc

### App State Trace
The table from step 3.

### Transition Analysis
For each L[n] to L[n+1] transition:
- **Pass/Fail** with explanation
- Specific text that needs updating if failed

### Issues Found
Numbered list of all issues, categorized as:
- **Schema ghost**: References to models/columns/gems that don't exist yet
- **Concept overlap**: Same concept taught in multiple levels
- **Complexity regression**: Level is simpler than what came before
- **Narrative gap**: Trigger ignores prior levels or transition feels abrupt
- **Spec mismatch**: spec.md disagrees with code

### Suggested Fixes
For each issue, provide:
- The specific file and line to change
- The current text
- The suggested replacement text

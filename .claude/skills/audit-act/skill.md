---
name: audit-act
description: Audit an entire act for narrative flow, complexity progression, concept overlap, and schema consistency across all its levels. Use when reviewing act-level structure or reordering levels.
---

# Audit Act Narrative Flow

Audit all levels within an act (and their transitions) to verify the act tells a coherent story. This skill checks how levels relate to each other and whether the act works as a progression. Use `/audit-level` to audit each individual level's three-phase implementation.

## Inputs

The argument should be an act name or number (e.g., "Act 2", "Guards & Gates", "2").

## File Locations

- **Act content definitions:** `src/features/act{N}-{slug}/content.ts`
- **Level components:** `src/features/act{N}-{slug}/components/Level{NN}{Name}.tsx`
- **Acts registry:** `src/features/acts-registry.ts` (provides `getAct()`, `getLevel()`, `getAllLevels()`, `getActForLevel()`)
- **Levels registry:** `src/features/levels-registry.ts` (maps level IDs to components)
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
| L8 (prev act) | Product (name, description, price), Review (body, rating, product_id) | jsonapi-serializer | MVC, CRUD, associations | Routes, Controller, Serializer |
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

**Step 6c: Resolve overlap by finding the right home.**

When overlap is found, don't just flag it. Determine which level should own the concept. Consider:

1. **Which act does the concept belong to?** Each act has a theme and complexity band. A concept should live in the act where it naturally fits, not where it was first convenient to introduce. Example: `params.expect()` is about filtering parameters for security. Act 1 (Foundation) is about getting a working API from nothing. The player shouldn't worry about parameter security in a foundation act. Act 2 (Guards & Gates) is explicitly about security, so `params.expect()` belongs there.

2. **Can the earlier level work without this concept?** If L6 (Controller) can function without teaching `params.expect()` (just generate the controller, add actions, test with curl), then `params.expect()` is not essential to L6's core lesson. It was added to L6 for convenience, not because it belongs there. Remove it from L6 and let the dedicated level (L14) own it fully.

3. **Which level's identity IS this concept?** If a level is named after the concept (L14 "Strong Params"), that level should own it. If another level happens to use the concept as a sub-step (L6 "Controller" has a params step), that's the one to trim.

4. **Don't just remove the overlap; relocate the teaching.** If L6 has a `params.expect()` build step that gets removed, the player still needs to learn it somewhere. Verify the owning level (L14) covers the full API, including anything the removed step was teaching.

**Case study: L6 Controller vs L14 Strong Params.**

Both taught `params.expect()`. L6 had it as Step 2 ("Build strong params with params.expect"). L14's entire identity was parameter filtering. Resolution:
- Act 1 (Foundation) should not teach security concepts. A controller can work without `params.expect()` (use raw params or skip write actions in the test).
- Act 2 (Guards & Gates) is the security act. `params.expect()` is a security mechanism. It belongs here.
- L14 "Strong Params" is literally named after this concept. It should own it.
- Fix: Remove the `params.expect()` step from L6. L14 introduces `params.expect()` from scratch and also teaches the mass assignment audit.

### 7. Check Cumulative Narrative Consistency (Code Must Reflect Prior Levels)

**This is the most commonly missed check.** Later levels' code examples must reflect the patterns established by earlier levels in the same act. If L[n] teaches a pattern (service objects, concerns, query objects, etc.), then L[n+1] through the end of the act must use that pattern in their code where appropriate. The app is cumulative: the player has already made these changes.

**How to check:**

1. Build the cumulative pattern table from Step 4 (app state trace).
2. For each level L[n+1] onward, read its `content.ts` fields (`codeExample`, `railsCodeExample`) AND its component's code preview strings, stage inspector code blocks, option labels, and left panel text.
3. For every code snippet, ask: "Does this code reflect what the app looks like AFTER all prior levels?" If L16 extracted registration into a service object, L18's code should not show a fat RegistrationController with all logic inline.

**What to check in each file:**
- `content.ts` → `problem.codeExample` (the "before" code on the briefing page)
- `content.ts` → `learningContent.railsCodeExample` (the "after" code in the learning panel)
- Component `.tsx` → `STAGE_INSPECTOR_MAP` code blocks (shown during observe)
- Component `.tsx` → `getCodeFiles()` / code preview strings (shown in the right panel)
- Component `.tsx` → `OPTION_STEP_CONFIG` option labels (shown during build)
- Component `.tsx` → left panel text, probe response text

**The key rule:** A level's "before" (problem) code must show the problem IN THE CONTEXT OF what already exists. If service objects exist, the "before" code should show the problem happening inside or alongside the service, not as if the service was never created.

**Case study: L18 Validation Contracts ignoring L16 Service Objects.**

L16 extracts the registration workflow into `UserRegistration` service. L18's problem is scattered inline validations. But L18's `codeExample` showed:

```ruby
# BAD: L18 codeExample ignores L16's service objects
class RegistrationController < ApplicationController
  def create
    if params[:email].blank?
      return render json: { error: "..." }, status: 422
    end
    # ... 20 more lines of inline validation + creation
    user = User.create!(...)
    Profile.create!(user: user, ...)
  end
end
# This controller should not exist! L16 already extracted registration into a service.
```

The player completed L16 and saw the registration move to a service object. Now L18 shows the registration back in a fat controller. This breaks the narrative: it feels like L16 never happened.

The fix: show the validation problem WHERE IT ACTUALLY LIVES post-L16, which is inside the service:

```ruby
# GOOD: L18 codeExample builds on L16's service objects
class RegistrationService < ApplicationService
  def call
    # Validations scattered inside the service!
    if @params[:email].blank?
      return Result.new(success?: false, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, errors: ["Password too short"])
    end
    # ... more inline checks scattered throughout
    user = User.create!(email: @params[:email], password: @params[:password])
    Profile.create!(user: user, display_name: @params[:display_name])
  end
end
# The service exists (from L16), but validations are scattered inline.
# L18 teaches: extract them into a Dry::Validation::Contract.
```

**Case study: L20 Error Handling with simple CRUD.**

L16 teaches service objects for multi-step workflows (80+ lines). L20 shows `ProductsController` with `Product.find(params[:id])` directly in the controller. Is this a narrative inconsistency?

No. L16's own guidelines say "Extract when a controller exceeds ~15 lines." A `show` action with `Product.find + render` is 2 lines. Simple CRUD stays in controllers. Service objects are for multi-step workflows, not one-liners.

However, the "after" code in `railsCodeExample` should briefly acknowledge the pattern exists:

```ruby
# GOOD: L20 railsCodeExample acknowledges service objects exist
class Api::V1::PostsController < ApplicationController
  # Simple CRUD stays in the controller.
  # Multi-step workflows (like registration) use service objects.
  def show
    product = Product.find(params[:id])
    render json: PostSerializer.new(post).serializable_hash.to_json
  end
end
```

**Checklist:**
- [ ] **Every code example in L[n+K]+ uses patterns from L[n].** If L16 creates services, L17+ code examples that touch controllers should show services (or explicitly note why a service is not needed).
- [ ] **"Before" code shows the problem in the post-prior-level context.** Never show code that regresses to a state before a prior level's fix.
- [ ] **"After" code in `railsCodeExample` reflects cumulative patterns.** The learning panel code should show the full picture, including prior patterns.
- [ ] **Component code previews match content.ts.** Both files must tell the same cumulative story.
- [ ] **Terminology is consistent across content.ts and components.** If content.ts says "newsletter API" but the component says "external profile sync," that is a terminology drift issue.

#### 7a. Check Naming Consistency Across All Levels

**The codebase is cumulative across the entire game, not just within one act.** When a level introduces a class, file, gem, or concept with a specific name, every subsequent level that references it must use the exact same name. This applies across act boundaries.

**How to check:**

1. From the app state trace (Step 4), extract every named entity: class names, file paths, gem names, method names.
2. For every level in the current act, grep its `content.ts` fields AND its component `.tsx` for references to entities from prior levels.
3. Flag any mismatch: different class name, different file path, different method signature.

**What counts as a naming inconsistency:**
- Class name: L16 creates `UserRegistration`, L18 calls it `RegistrationService`
- File path: L16 creates `app/services/user_registration.rb`, L22 references `app/services/registration_service.rb`
- Result type: L16 uses `Result = Data.define(:success?, :user, :errors)`, L18 uses `Result.new(success?: false, errors: [...])`
- Call pattern: L16 uses `UserRegistration.call(params)`, L22 uses `RegistrationService.new(params).call`

**The scope is the entire game, not just one act.** If Act 1 L3 creates a `Product` model, Act 3 L19 cannot call it `Article`. If Act 2 L9 adds `User` with `has_secure_password`, Act 3 L21 cannot reference `User.authenticate` (a method that does not exist in `has_secure_password`). Trace entities from their origin level forward.

**Case study: L16 `UserRegistration` vs L18/L22 `RegistrationService`.**

L16 extracts the registration workflow into a class named `UserRegistration` in `app/services/user_registration.rb`. L18 and L22 both reference the same service but call it `RegistrationService` in `app/services/registration_service.rb`. The player completed L16 and built `UserRegistration`. Two levels later, the code says `RegistrationService` as if they built something different. This breaks continuity.

Fix: L18 and L22 must use `UserRegistration` (the name L16 established). The class name, file path, Result type, and call pattern must all match what L16 produced.

#### 7b. Check Code Continuity (What L[n] Produces Must Ground L[n+k])

**If a later level claims certain code exists, a prior level must actually produce that code.** The player builds the codebase level by level. If L18 shows `UserRegistration` with scattered inline validation checks, then L16 (which created `UserRegistration`) must include those checks in its "after" code.

**How to check:**

1. For each level in the act, read its "before" code (the problem it shows).
2. Trace that code back to the level that produced it. Read that level's "after" code (its final reward/code preview state).
3. The "before" code of the later level must be a plausible evolution of the "after" code of the earlier level. Code can grow between levels (new features added), but it cannot contain things the earlier level never established.

**What counts as a code continuity violation:**
- L18 shows `UserRegistration#call` with 5 inline validation checks (`if @params[:email].blank?` etc.), but L16's final `UserRegistration#call` has zero inline checks (it only uses `user.save` for model validations). The checks appeared from nowhere.
- L22 shows `UserRegistration#call` with `deliver_now` for emails, but no prior level added email sending to the service. The mailer call appeared from nowhere.

**The key principle: the app grows between levels, but each addition must be grounded.** It is fine for code to grow between levels (the player is building an app, new features get added). But when a level shows code, the additions since the last level that touched that file should be explainable as natural growth, not contradictions.

**Case study: L18 claiming inline checks that L16 never produced.**

L16's final `UserRegistration#call` uses `user.save` (model-level validation) and has side effects (logging, preferences, token). There are no inline `if @params[:email].blank?` checks.

L18 then shows `UserRegistration#call` with 5 scattered inline validation checks as its "before" problem. But the player never added those checks. They appeared between L16 and L18 without explanation.

Fix: L16's fat controller (the "before" code) should already include inline validation checks as part of its 80-line blob. L16 focuses on extracting the service (side effects are the highlighted problem), not on fixing the checks. The checks naturally move into `UserRegistration#call` along with everything else. Then L18 can truthfully say "the service has scattered inline checks" because L16's service includes them.

```ruby
# GOOD: L16's fat controller includes inline checks (not highlighted as L16's focus)
class Api::V1::RegistrationsController < ApplicationController
  def create
    # These inline checks exist but are NOT L16's focus
    if params[:email].blank?
      return render json: { error: "Email required" }, status: 422
    end
    if params[:password].length < 8
      return render json: { error: "Too short" }, status: 422
    end

    @user = User.new(registration_params)
    if @user.save
      # L16's focus: these side effects are the problem
      Rails.logger.info("New registration: #{@user.email}")
      @user.update!(locale: "en", timezone: "UTC")
      token = @user.generate_token_for(:session)
      render json: { user: @user, token: token }, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end
end
```

```ruby
# GOOD: L16's UserRegistration "after" code carries the checks over
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def call
    # Inline checks moved from controller (not L16's focus, just came along)
    if @params[:email].blank?
      return Result.new(success?: false, user: nil, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, user: nil, errors: ["Password too short"])
    end

    user = User.new(@params)
    unless user.save
      return Result.new(success?: false, user: nil, errors: user.errors.full_messages)
    end

    # Side effects (L16's actual focus)
    Rails.logger.info("New registration: #{user.email}")
    user.update!(locale: "en", timezone: "UTC")
    token = user.generate_token_for(:session)

    Result.new(success?: true, user: user, errors: [])
  end
end
# Now L18 can truthfully show this service with scattered checks as its problem.
```

### 8. Check Schema Consistency

For each level, verify every model, column, and association it references actually exists at that point:

- [ ] **No phantom columns.** If L15 references `Product.status`, a prior level must add that column via migration. If not, L15 must include the migration as its first step.
- [ ] **No phantom models.** If a level references a User model, verify it was created in a prior level.
- [ ] **No phantom gems.** If a level's codeExample uses `policy_scope(Product)`, verify Pundit was installed in a prior level.

**CRITICAL: Check both content.ts AND component .tsx files.** Content definitions and interactive components are separate files that can drift. A level's `content.ts` may be fixed but the component's data arrays, code preview generators, left panel text, or step options may still reference phantom models or columns. Grep the component for any flagged terms.

### 9. Check Content Quality

Every level has content fields that appear on the briefing page (LevelInfoApp) and during gameplay. Verify these are well-written and accurate:

- [ ] **`trigger.description`**: 1-2 sentences describing what the player will do. Must match the actual gameplay.
- [ ] **`problem.observation`**: What's wrong or missing. Must reflect the app state at this point.
- [ ] **`problem.codeExample`**: Teaches concepts and context. Must NOT show exact answers the player will choose in the build phase.
- [ ] **`problem.goal`**: Describes ALL steps the player will complete, not just the first one.
- [ ] **`learningContent.goal`**: Markdown bullet list of learning outcomes. These are surfaced on the briefing page as "What You'll Learn." Each bullet should be a concrete, actionable outcome (not vague).
- [ ] **`learningContent.title`**: Shown as a badge on the briefing page. Should be concise and descriptive.
- [ ] **Content and component are in sync.** If the component uses terminal interactions, the trigger should not say "Drag the node." Always check both halves.

### 10. Check Act-Level Coherence

- [ ] **Act description matches its levels.** If the description says "add authentication, validations, authorization, testing, parameter filtering, and query scopes," verify all of those appear as levels.
- [ ] **Act has a narrative arc.** The first level should introduce the act's theme. The last level should feel like a capstone or transition to the next act.
- [ ] **Level grouping makes sense.** Related concepts should be adjacent. Model-layer features grouped together, security features grouped together. Interleaving unrelated concepts breaks the learning flow.

### 11. Check Spec Alignment

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
- **Narrative regression**: Code example ignores a pattern established by a prior level (Step 7)
- **Terminology drift**: content.ts and component use different names for the same thing
- **Naming inconsistency**: A class, file, or entity has different names across levels (Step 7a)
- **Code continuity violation**: A level's "before" code contains things no prior level produced (Step 7b)
- **Spec mismatch**: spec.md disagrees with code

### Suggested Fixes
For each issue, provide:
- The specific file and line to change
- The current text
- The suggested replacement text

## Follow-Up: Audit Individual Levels

After the act-level audit is complete, use the `/audit-level` skill to audit each individual level's three-phase implementation (observe/build/reward flow, step quality, documentation verification). The act audit checks how levels relate to each other; the level audit checks each level's internal correctness.

Run `/audit-level <levelId>` for any level flagged with issues above, or for all levels in the act if a thorough audit is requested.

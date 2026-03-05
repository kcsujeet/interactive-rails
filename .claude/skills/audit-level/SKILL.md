---
name: audit-level
description: Audit a level component against the three-phase sequential flow standard and narrative consistency checks. Use when reviewing, creating, or redesigning any level component.
---

# Audit Level Against Three-Phase Flow

Audit a level component to verify it follows the mandatory three-phase sequential flow pattern established in CLAUDE.md. The golden standard is: Problem Visualization -> Problem Solving -> Solution Visualization.

## Reference Implementations

**PipelineFlow-based (request lifecycle concepts):**
Read Level 12 (Authorization) as the canonical example:
`frontend/src/features/act2-users-security/components/Level12Authorization.tsx`

**Custom visualization (non-pipeline concepts):**
Each custom visualization level is a reference for how to tailor the visualization to the concept being taught. No two should look the same.

- Level 10 (Validations): "Data Gate" with vertical zones (Input -> Model Gate -> Database), because validations are about filtering data at the model layer before it reaches storage.
  `frontend/src/features/act2-users-security/components/Level10Validations.tsx`
- Level 15 (CORS): "Browser-Server Handshake" with side-by-side towers (Browser -> Origin Boundary -> Server), because CORS is about cross-origin communication between a browser and a server separated by a security boundary.
  `frontend/src/features/act2-users-security/components/Level15CORS.tsx`

The visualization shape, direction, and structure should emerge from the concept itself. L10 flows top-to-bottom because data moves through layers. L15 flows left-to-right because two actors communicate across a boundary. Don't copy one level's layout onto another. Design the visualization that best helps the player understand the specific problem.

## Step 0: Read the Official Documentation (MANDATORY)

Before auditing or building any level that involves a gem, library, or Rails feature:

1. **Identify every gem/library the level teaches** (e.g., Pundit, Devise, RSpec, FactoryBot)
2. **Fetch the full README.md** from the official GitHub repo using `WebFetch`. Read the ENTIRE README, not a summary. Pay special attention to:
   - "Installation" / "Getting Started" sections (every step listed here must appear in the level)
   - Class/module names and inheritance patterns
   - Configuration requirements (initializers, includes, migrations)
3. **Fetch generator template files** if the level includes a generator step. Check `lib/generators/` in the gem's repo to see what files are actually created and what their contents look like
4. **Cross-reference every code snippet in the level** against the README. Flag any discrepancies: wrong class names, wrong method signatures, outdated inheritance patterns, missing setup steps
5. **Never trust cached knowledge.** Gems rename modules, change inheritance hierarchies, and add/remove setup steps between versions. The README is the single source of truth

This step is non-negotiable. Skipping it has caused bugs in the past (wrong Scope inheritance, missing `include` steps, fake generator output).

## Checklist

### Phase 0: Concept Fit (Does This Level Belong Here?)

Before checking the implementation, verify the level's concept fits its position in the curriculum:

- [ ] **The concept matches the act's narrative stage.** Each act represents a stage of app development. A concept that requires a production app with many users (rate limiting, caching, horizontal scaling) does not belong in an early act where the player is still building the basics. Ask: "Would a real developer need this right now, at this stage of the app?"
- [ ] **The concept builds on what came before.** The player should have the prerequisite knowledge from earlier levels. If a level assumes knowledge that hasn't been taught yet, it's placed too early.
- [ ] **The concept is proportional to the act's complexity.** Acts 1-2 cover fundamentals (models, controllers, views, basic security). Acts 3-4 introduce refactoring and first performance concerns. Acts 5-8 tackle production, reliability, scale, and architecture. A level that feels "too advanced" for its act probably is.
- [ ] **The scenario feels natural, not forced.** If you have to invent a contrived justification for why the player needs this feature now, the level doesn't fit. The scenario should flow naturally from the app's current state.
- [ ] **Complexity is monotonically increasing.** The level should feel at least as complex as the previous one. A model-layer DSL lesson after authorization and testing is a regression. If the concept is simpler than what came before, either reframe it to build on prior concepts (e.g., "scopes complement authorization by controlling visibility") or move it earlier.

Example: Rate limiting in Act 2 fails this check. The app has barely any users at that point, there's no realistic threat of abuse, and the concept (throttling, sliding windows, IP tracking) is a production-scale concern that belongs in a later act. Strong params, by contrast, fits Act 2 perfectly because mass assignment is a real risk the moment you accept user input.

### Phase 0b: Narrative Consistency (Does the Content Match the App State?)

Read the content definition in `content.ts` alongside the component. Check for these common narrative bugs:

- [ ] **No references to models/columns that do not exist yet.** Trace the app's schema from L1 to this level. If the level references `Post.status`, verify a prior level added that column. If the level says "password_digest is leaking," verify a User model with `has_secure_password` exists at this point.
- [ ] **No concept overlap with other levels.** Check if this level teaches something already covered elsewhere. If L6 teaches `params.expect`, L14 cannot say "the controller has no parameter filtering." Instead, L14 should build on L6 (e.g., "the whitelist is too broad"). Read the content of adjacent levels to verify.
- [ ] **Trigger acknowledges prior levels.** The trigger description should connect to the app's state after the previous level. A good trigger says "Users can authenticate, data is validated, and emails are normalized. But User A can still edit User B's posts." A bad trigger ignores everything before it.
- [ ] **codeExample does not show exact answers.** The problem code block should teach context and concepts, not provide the code the player will select in the build phase. If the codeExample contains the exact snippet from a correct OptionCard, the player can read ahead.
- [ ] **content.ts and component are in sync.** If the component uses a terminal interaction, the trigger should not say "Drag the node to the slot." If the component teaches scopes, the trigger should not describe CORS. Always update both halves when changing a level.

**CRITICAL: Check both content.ts AND the component .tsx file.** Content definitions (`content.ts`) and interactive components (`LevelNN*.tsx`) are separate files that can drift apart. A fix to content.ts is incomplete if the component still has the old text, options, or references. Common drift points:
- Attribute lists in drag/select interactions (e.g., ATTRIBUTES array in the component)
- Code snippets in "Before/After" comparisons in the reward phase
- Left panel instruction text (hardcoded in the component, not from content.ts)
- Step descriptions and feedback messages
- Code preview strings generated by functions like `generateModelCode()`

When auditing, always read the full component file and grep for any flagged terms (e.g., `password_digest`, `Post.status`) across both files.

### Phase 1: Problem Visualization (WHY) - Interactive Observe

The level must have a dedicated "observe" phase that is **interactive, not passive**. The player actively explores to discover the problem.

#### Visualization approach: custom first, PipelineFlow when it fits

**Every level needs its own unique visualization concept.** Do NOT default to PipelineFlow for every level. The visualization must teach the specific concept. Pick the approach that best explains *this* problem:

- **Custom zone layouts**: Validations (vertical Data Gate: Input -> Model Gate -> Database), Callbacks (vertical Transform Lane: Raw Data -> Normalizes -> Model -> Callbacks), CORS (horizontal Browser-Server Handshake: Browser Tower -> Origin Boundary -> Server Tower)
- **PipelineFlow**: Request lifecycle concepts (auth, authorization, middleware, controller flow) where the player needs to see where a stage is missing or broken in the pipeline
- **Interactive diagrams**: Schema/migration levels (tables with columns), association levels (entity relationships)
- **Before/after comparisons**: Refactoring levels (messy code vs clean code), performance (N+1 query log vs optimized)

**If a level already has a custom visualization that teaches the concept well, keep it.** Add interactivity (clickable elements, probe-like actions, discovery gating) to the existing visualization rather than replacing it with a generic PipelineFlow.

#### Required interactivity (regardless of visualization type)

- [ ] **The visualization is interactive, not passive.** The player must click, probe, or explore to discover the problem. Static animations that play automatically are not acceptable.
- [ ] **Discovery gating controls progression.** Use `useDiscoveryGating(defs, { minRequired })` to track what the player has found. The "Build the Fix" button appears only when `discoveryGating.isUnlocked`.
- [ ] **"Build the Fix" button** appears with `animate-in fade-in duration-500`, gated behind discoveries (NOT on a timer).
- [ ] No build steps or OptionCards are visible during this phase.

#### Discovery mechanisms (mix and match per level)

Levels should use whichever discovery mechanisms fit their visualization:

- **Clickable regions** (for any visualization): clicking on parts of the visualization reveals information and triggers discoveries. For PipelineFlow, use `onNodeClick` + `StageInspector`. For custom zone layouts, use `onClick` handlers on zone `<button>` elements with pulsing `?` indicators for uninspected zones.
- **ProbeTerminal**: terminal-style component where player fires test requests. Best for security/API levels where "try this request and see what happens" is the natural exploration. Not required for every level. Must have `disabled={flowPhase !== -1}` to block probes during flow animations.
- **Interactive controls**: buttons, toggles, or inputs that let the player manipulate the visualization and discover problems. E.g., toggling browser origins in a CORS level, firing different query patterns in a performance level.

#### Flow animation pattern (for custom zone layouts)

When a level uses custom zone layouts (not PipelineFlow), use the flow animation pattern to show data moving through zones:

- **`flowPhase` state**: integer tracking current animation step. `-1` = idle, even numbers = zone highlights, odd numbers = edge animations.
- **`flowMessages` array**: messages shown at each zone during animation. Messages are monotonically inclusive (once shown, they stay visible with `opacity-70`).
- **`runFlow(messages)` callback**: advances phases sequentially with delays (650-1200ms per phase depending on zone count).
- **`clearFlow()` callback**: cancels pending timeouts. Called on unmount via `useEffect(() => clearFlow, [clearFlow])`.
- **`flowTimeoutsRef`**: ref holding pending `setTimeout` IDs for cleanup.

**Data maps for flow animations:**
- `OBSERVE_FLOW`: maps probe IDs to zone message arrays (e.g., `'empty-post': ['POST from client', 'No validations', 'Saved! 201']`)
- `REWARD_FLOW`: maps stress scenario IDs to zone message arrays

**Zone highlighting during flow:**
- Active zone: `ring-2 ring-primary/60 shadow-lg shadow-primary/10`
- Flow message appears with `animate-in fade-in duration-300` when zone activates
- Post-activation: message stays visible with `opacity-70`
- Color-coded: `text-primary` (neutral), `text-destructive` (failures), `text-success` (passes)

**FlowConnector between zones:**
- Use `FlowConnector` component (`@/components/levels/FlowConnector`) instead of `ArrowDown` icons or dashed borders.
- `active={flowPhase === N}` where N is the odd-numbered phase between two zones.
- `dotColor` changes based on context: `bg-destructive` for failures, `bg-success` for passes, `bg-primary` for neutral.
- **Direction must match the visualization's data flow.** Use `direction="vertical"` when data flows top-to-bottom (e.g., L10's data gate), `direction="horizontal"` when data flows left-to-right (e.g., L15's browser-server handshake). The dot travel direction follows from how the concept is visualized, not from a fixed rule.
- For custom-sized connectors, pass `className` with absolute positioning tailored to the visualization's layout.

**Auto-inspect after probe:**
After `handleProbe` fires, call `setInspectedStages(new Set([...allStageIds]))` to remove `?` indicators from all zones, since the flow animation reveals all zones.

#### Left panel (observe)

- [ ] Scenario text (always visible)
- [ ] `DiscoveryChecklist` component showing discovery progress

#### Right panel (observe)

- [ ] Shows the broken/vulnerable/unoptimized code via `CodePreviewPanel`

#### When PipelineFlow IS used

If the level uses PipelineFlow specifically, these additional checks apply:

- [ ] `onNodeClick` callback for interactive stages
- [ ] `inspectable: true` on clickable stages (pulsing `?` indicator)
- [ ] `StageInspector` overlay on click
- [ ] Node variants react to probes/interactions via `useMemo`
- [ ] Define data maps: `STAGE_INSPECTOR_MAP`, `DISCOVERY_DEFS`, etc.

### Phase 2: Problem Solving (HOW)

The build phase must cover the **complete workflow**:

- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves with `stepper.furthestStep`
- [ ] `ErrorFeedback` component is used for wrong-answer feedback (not inline error divs)
- [ ] Correct answer is never the first option
- [ ] All options use the same color
- [ ] Feedback never reveals the correct answer

**Documentation verification (non-negotiable):**
- [ ] Before writing ANY step content, **fetch and read the full README** of the gem/library from its official GitHub repo (not a summary, not from memory)
- [ ] Use `WebFetch` to read the actual README.md, not just the repo landing page
- [ ] Verify the exact installation steps from the README. Gems often have steps beyond `bundle add` and `rails generate` (e.g., including a module in ApplicationController, running migrations, adding initializer config)
- [ ] Verify generated file contents match the actual template files in the gem's source code (check `lib/generators/` in the repo)
- [ ] Verify class names, module names, method signatures, and inheritance patterns against the README
- [ ] Do NOT rely on AI knowledge of gem APIs. Gems change between versions. The README is the source of truth
- [ ] If the README shows N installation steps, the level must have at least N steps covering them all

**Typical step progression for a gem-based feature (verify against README):**
1. Install the gem (`bundle add ...`) - TerminalChoiceStep
2. Include module / configure controller (if README requires it) - OptionCard step
3. Run the generator (`rails generate ...`) - TerminalChoiceStep
4. Configure/customize the generated code - OptionCard steps
5. Wire it into the application - OptionCard steps

**Common missing steps to flag (cross-reference with README):**
- Missing `bundle add <gem>` step
- Missing `include <Gem>::<Module>` in ApplicationController (many gems require this, e.g., Pundit, Devise)
- Missing `rails generate <gem>:install` step
- Missing database migration step (`rails db:migrate`) when generators create migrations
- Missing configuration steps (initializers, environment config)
- Any step listed in the gem's README "Getting Started" / "Installation" section that is not represented in the level

### Phase 3: Solution Visualization (ADVANTAGE) - Interactive Reward

The level must have a dedicated reward phase where the player **interactively verifies** their solution works.

#### Sub-phase a (activate)

- [ ] Star rating display + "Visualize ___" button (centered, no animation)
- [ ] No visualization running yet

#### Sub-phase b (reward) - visualization returns

- [ ] The same visualization from Phase 1 returns, now showing the solution working
- [ ] The contrast between Phase 1 (broken) and Phase 3b (fixed) is the reward
- [ ] **The player interacts** to verify the fix works. This is NOT passive.

#### Interactivity requirement (non-negotiable)

The reward phase MUST be interactive. Passive auto-incrementing counters (`setInterval`) are never acceptable. The player must take actions and see results. Options:

- **StressTestPanel + useStressTest**: Player fires request scenarios and watches results. Best for security/API levels (auth, authorization, CORS, strong params). Provides `fireRequest()`, `toggleAutoFire()`, dual counters. Must have `disabled={flowPhase !== -1}` to block during flow animations.
- **Custom interactive controls**: Player clicks buttons, toggles, or inputs on the custom visualization. E.g., clicking different browser origins in a CORS visualization and watching them get allowed/blocked. Clicking different query patterns in a performance visualization and seeing response times.
- **Replay/comparison controls**: Player toggles between before/after states, or replays scenarios at different scales.

The key rule: **every click from the player must produce a visible reaction in the visualization.**

#### Flow animation in reward phase

When the reward visualization uses zone layouts (same as observe but with the fix applied):

- Reuse the same `runFlow`/`clearFlow`/`flowPhase` state from observe phase
- Define `REWARD_FLOW` messages showing the fix working (e.g., `'valid-post': ['Valid post', 'validates pass', 'Saved! 201']`)
- Zones change color based on stress test result: `border-success bg-success/10` for allowed, `border-destructive bg-destructive/5` for blocked
- FlowConnectors change `dotColor` based on result: `bg-success` for allowed, `bg-destructive` for blocked
- Flow messages color-code: `text-success` for passes, `text-destructive` for rejections

#### When StressTestPanel IS used

If the level uses StressTestPanel specifically:

- [ ] `useStressTest(scenarios)` hook manages state
- [ ] Define `STRESS_SCENARIOS` array
- [ ] Terminal-style appearance matching ProbeTerminal
- [ ] Scenario buttons with full detail, color-coded by expected result
- [ ] Auto-fire toggle gated behind 3+ manual fires
- [ ] `disabled={flowPhase !== -1}` blocks during flow animations

#### When custom visualization IS used

If the level uses a custom visualization for the reward:

- [ ] Player has clickable controls that trigger visual reactions
- [ ] Visual elements update dynamically (color changes, animations, state transitions) in response to player actions
- [ ] Some form of counter or progress tracker shows cumulative results
- [ ] The visualization clearly shows the fix working (green/success states) vs what would have failed before (red/blocked states)

#### Left panel (reward)

- [ ] Legend or explanation of what visual states mean
- [ ] Counters showing cumulative results (e.g., Allowed/Blocked, Saved/Rejected, Fast/Slow)

#### Right panel (reward)

- [ ] Shows the final complete code (all files) via `CodePreviewPanel`

### Step Quality (Is the Build Phase Satisfying?)

Beyond structural correctness, check that each step is meaningful and the level feels like a progression:

- [ ] **Every step requires a real decision.** If a step's correct answer is "do nothing" or "let it happen automatically," it's not a real step. The player should actively build something at every step.
- [ ] **Steps don't reveal each other's answers.** If Step 0's correct option contains the exact code Step 1 will ask about, the player can read ahead. Use placeholders (`[...]`, `...`) in earlier steps when later steps will fill in the details.
- [ ] **Code preview evolves progressively.** Each completed step should visibly change the right panel code. If two steps produce the same code preview, one of them feels invisible.
- [ ] **Wrong options have distinct, teaching feedback.** Each wrong option should fail for a different reason that teaches something specific. Don't have two wrong options that are wrong for essentially the same reason.
- [ ] **The reward phase is interactive.** Passive auto-incrementing counters are not allowed. The player must take actions and see visual reactions.

### State Machine

Check the phase transitions:

- [ ] State uses `phase: 'observe' | 'build' | 'activate' | 'reward'` (not boolean flags)
- [ ] `observe -> build`: triggered by "Build the Fix" button click, **gated behind `discoveryGating.isUnlocked`** (NOT a timer)
- [ ] `build -> activate`: triggered by `useEffect` watching `stepper.isComplete`
- [ ] `activate -> reward`: triggered by "Visualize ___" button click
- [ ] Visualizations are declarative (no manual animation intervals or mutable request state to manage)
- [ ] Observe visualization state built with `useMemo` reacting to player interactions
- [ ] Reward visualization state built with `useMemo` reacting to player actions

### CSS and Animation Checks

Verify that any custom animations follow Tailwind v4 / Lightning CSS constraints:

- [ ] **No `var()` inside `@keyframes`.** Lightning CSS silently strips keyframes containing CSS variable references. Use fixed values or percentage-based positioning instead.
- [ ] **New `@theme` entries registered.** If the level introduces custom animation keyframes, they must be registered in `@theme inline {}` in `global.css` (e.g., `--animate-flow-dot-down: flow-dot-down 1.2s ease-in-out infinite;`). Note: this requires a dev server restart to take effect.
- [ ] **No inline `style` attributes for animations.** Use Tailwind `animate-*` classes instead of inline `animation:` styles, so the build system includes the referenced keyframes.
- [ ] **`FlowConnector` used instead of `ArrowDown` icons.** Between zones in custom layouts, use the `FlowConnector` component (not Lucide ArrowDown icons or dashed borders).
- [ ] **`FlowConnector` direction matches the visualization's data flow.** Dots must travel in the same direction data flows in the visualization. A mismatch (e.g., vertical dots in a left-to-right layout) breaks the visual metaphor.

## Output Format

Present findings as:

1. **Concept fit**: Does this level belong at this position in the curriculum?
2. **Narrative consistency**: Any schema ghosts, concept overlaps, or trigger gaps?
3. **Visualization assessment**: Is the current visualization unique and concept-appropriate, or is it a generic pipeline that should be replaced with something custom? **If a level already has a custom visualization, recommend keeping it and adding interactivity rather than replacing it.**
4. **Pass/Fail** for each of the 3 phases
5. **Flow animation assessment**: If using custom zone layouts, does the flow animation pattern follow the standard? (flowPhase, FlowConnector, disabled props, auto-inspect, message persistence)
6. **Step quality**: Are steps meaningful, progressive, and satisfying?
7. **Missing steps** in the build phase (especially gem install, generators, setup)
8. **CSS/animation compliance**: Any `var()` in keyframes, missing `@theme` entries, inline animation styles, or ArrowDown icons that should be FlowConnectors?
9. **Specific code locations** that need changes (file:line)
10. **Suggested fix** for each issue found

If the level passes all checks, confirm it follows the golden standard.

# Audit Checklist

Detailed audit checks organized by phase. Use after the narrative-reasoning gate (Step -1) and the observe-phase gate (Gate Check) in `SKILL.md` have passed. Structural compliance, animation quality, and visualization design are downstream of narrative coherence — fix the story first.

## Phase 0: Concept Fit (Does This Level Belong Here?)

- [ ] **The concept matches the act's narrative stage.** Ask: "Would a real developer need this right now, at this stage of the app?"
- [ ] **The concept builds on what came before.** The player should have the prerequisite knowledge from earlier levels.
- [ ] **The concept is proportional to the act's complexity.** Acts 1-2: fundamentals. Acts 3-4: refactoring and performance. Acts 5-8: production, reliability, scale.
- [ ] **The scenario feels natural, not forced.** If you have to invent a contrived justification, the level doesn't fit.
- [ ] **Complexity is monotonically increasing.** The level should feel at least as complex as the previous one.

Example: Rate limiting in Act 2 fails this check. Strong params fits Act 2 perfectly.

## Phase 0b: Narrative Consistency (Does the Content Match the App State?)

Read the content definition in `content.ts` alongside the component. Check for these common narrative bugs:

- [ ] **No references to models/columns that do not exist yet.** Trace the app's schema from L1 to this level.
- [ ] **No concept overlap with other levels.** Check if this level teaches something already covered elsewhere.
- [ ] **Trigger acknowledges prior levels.** The trigger should connect to the app's state after the previous level.
- [ ] **codeExample does not show exact answers.** The problem code block should teach context, not provide the code the player will select.
- [ ] **content.ts and component are in sync.** If the component uses a terminal interaction, the trigger should not say "Drag the node to the slot."

**CRITICAL: Check both content.ts AND the component .tsx file.** Common drift points: attribute lists, code snippets in Before/After comparisons, left panel instruction text, step descriptions, code preview strings.

- [ ] **Everything the player sees follows cumulative patterns (non-negotiable).** Read [cumulative-patterns.md](cumulative-patterns.md) before writing or reviewing ANY content. Every string, every code snippet, every data structure, every response, every label that appears on screen must be consistent with every pattern established in earlier levels. No exceptions. No "this is just a visual element." No "this is just placeholder data." If the player can see it, it must follow the patterns. Common violations:
  - **L16+ (Service Objects):** Controllers must delegate to `ServiceName.call(args)`, never do business logic directly. Service inherits from `ApplicationService`, returns `Result = Data.define(...)`. The observe phase "before" code must also use services (the problem is in the service logic, not controller structure).
  - **L18+ (Dry-Validation):** Services must validate input via `MyContract.new.call(params)` with `validation.failure?` check, never inline `if param.blank?`. Contract file (`app/contracts/`) must appear in code previews.
  - **L19+ (Query Objects):** Complex queries should use query objects, not be inlined in services.
  - **L20+ (Error Handling):** Error responses follow the `{ error: { code, message, details } }` shape.
  - **L7+ (Serializers):** Controllers render via serializers (`OrderSerializer.new(result.order).serializable_hash`), never inline `render json: { id: ..., total: ... }`. If a level is about changing response formats (like API versioning), the serializer IS the thing being changed. Showing inline JSON in the controller skips the very layer the level should be teaching about.
  - **L7+ (JSON:API format):** API responses use JSON:API format (`{ "data": { "type": "...", "id": "...", "attributes": { ... } } }`), never vanilla JSON (`{ "user": { ... } }`). Case study: L36 reward phase showed vanilla JSON, breaking 35 levels of consistent API format.

**Cumulative pattern violations are BLOCKING, not medium severity.** A pattern established 30+ levels ago is as fundamental as the phase state machine. If the player has used serializers since L7, showing inline `render json:` at L40 teaches the wrong thing. It's not a style nit. It contradicts what the player learned and undermines the level's own concept. Case study: L40's observe code originally used `render json: { total: order.total_cents }` inline. The level was about changing response formats, but the "before" code didn't use the layer where formats are defined (serializers). The fix: show `OrderSerializer` in the observe code so the problem is "changing THIS serializer breaks partners" and the solution is "create versioned serializers."

## Project Structure (bulletproof-react, non-negotiable)

- [ ] **Feature code follows bulletproof-react layout.** Any new feature directory under `src/features/` must use `components/`, `hooks/`, `utils/`, `types/` subdirectories (include only what's needed). Do NOT place components or utilities at the feature root.
- [ ] **No cross-feature imports.** Features cannot import from other features. Shared code lives in `src/components/`, `src/lib/`, `src/utils/`, `src/hooks/`.
- [ ] **No code duplication.** If code strings exist in `getCodeFiles()`, do not duplicate them in static arrays. Use lazy evaluation (`() => getCodeFiles(...)`) to reference the single source of truth.

## Component Structure (check first, non-negotiable)

- [ ] **`LevelHeader` is present inside `CenterPanel`.** Custom level components are rendered by `LevelPlayApp` without any wrapper. The level itself MUST include `<LevelHeader>` as the first child of `<CenterPanel>`. Without it, the level has no title bar, no Submit button, and no Reset button. Pattern: `<CenterPanel><LevelHeader actNumber={N} levelName="..." levelNumber={NN} onComplete={handleComplete} onReset={handleReset} onValidate={handleValidate} />{renderCenterPanel()}</CenterPanel>`.
- [ ] `onValidate` gates submission: returns `{ valid: false }` unless the player is in the reward phase with 3+ stress test fires (Types 3/4) or has completed all steps (Type 2).
- [ ] `onComplete` calls `onComplete?.({ stars: stepper.starRating })`.
- [ ] `onReset` resets phase to observe, clears animation timers, resets stressTest, and resets viz state.

## Phase 1: Problem Visualization (WHY)

### Step 0: Pick the observe phase type

There are exactly **four types** of observe phase. Every level falls into one.

| Type | When to use | Phase name | Discovery gating | Example levels |
|------|------------|------------|-----------------|----------------|
| **1. No observe** | Pure setup/installation. No problem exists yet. | (skipped) | None | L1 (Rails install), L4 (scaffold generator) |
| **2. Static intro** | Code-structure problem visible by reading the code. No runtime behavior to simulate. | `'intro'` | None (button always visible) | L16 (Service Objects) |
| **3. Custom visualization** | Concept has a unique spatial/flow metaphor that needs a bespoke layout with animated state machine. | `'observe'` | Yes (`useDiscoveryGating`) | L10 (Validations), L15 (CORS) |
| **4. PipelineFlow** | Request lifecycle concept where a stage is missing or broken in the MVC pipeline. | `'observe'` | Yes (`useDiscoveryGating`) | L5 (Routes), L6 (Controller), L7 (Serializer), L8 (Associations) |

**Decision flowchart:**
1. Is there a problem to discover? **No** -> Type 1
2. Is it purely a code-structure issue (not runtime/performance)? **Yes** -> Type 2
3. Does the concept have a unique spatial metaphor (not MVC)? **Yes** -> Type 3
4. Is it about something missing/broken in the request lifecycle? **Yes** -> Type 4

**Mandatory type justification (non-negotiable):** Write a one-sentence answer to: **"What runtime behavior does this level need to animate?"** If the answer is "none," it is Type 2.

**Type 2 vs Type 3:** If the problem is visible by reading code side by side (structure, duplication, missing abstractions), it's Type 2. If it requires showing numbers (memory, latency, query count) or runtime flow, it's Type 3. Don't choose Type 3 just because adjacent levels use it.

**Types 3 and 4 have discovery gating. Types 1 and 2 do not.** Do not add `useDiscoveryGating`, `ProbeTerminal`, or `DiscoveryChecklist` to Type 1 or Type 2 levels.

For detailed type selection guidance, litmus tests, and case studies (L32 Polymorphic), see the `design-level` skill's observe-phase-guide.md.

### Type 1: No observe phase

The level skips observe and goes straight to build. **When:** building from scratch, no problem to visualize.

### Type 2: Static intro (code-structure / refactoring levels ONLY)

Static annotated code display. No animation, no interactive discovery.

**When:** Refactoring levels where the code structure IS the problem. **When NOT:** Performance, security, or data-flow levels where the problem is a runtime behavior.

**What it looks like:** Colored left borders, Badge labels, callout, "Build the Fix" button always visible (no gating), phase type `'intro'`.

**Reference implementation:** Level 16 (Service Objects). For detailed code examples, see the `design-level` skill's observe-phase-guide.md.

### Type 3: Custom visualization (bespoke layout with state machine)

Each custom visualization is different; the layout shape emerges from the concept itself.

**When:** Security concepts, data flow concepts, any level with a specific spatial relationship. **Required:** Discovery gating, interactive elements, flow animation state machine.

For detailed examples and flow animation patterns, see the `design-level` skill's observe-phase-guide.md.

### Type 4: PipelineFlow (hub-and-spoke MVC architecture)

**Always hub-and-spoke layout, never linear.** Controller is the hub. Required: discovery gating, clickable nodes with `StageInspector`, probes. If a level already has a working Type 3 custom visualization, keep it.

For layout coordinates, edges, and state rules, see [pipelineflow-guide.md](pipelineflow-guide.md).

### Visualization accuracy checklist

- [ ] **Each zone/box represents a real architectural component**, not an abstract concept or a type of request.
- [ ] **The order of zones matches the real processing order.**
- [ ] **Connectors exist between every adjacent zone.**
- [ ] **Connectors accurately represent the data path for each animation.** If a scenario's data flow bypasses a zone (e.g., "direct upload" bypasses the App Server), the animation must NOT use the connector that goes through that zone. Add a separate bypass connector if needed. Case study: L35's direct upload animation originally used `connB` (App Server <-> S3), which visually showed data flowing through the App Server to S3. The fix was adding `connC` (Client <-> S3 direct) rendered below the zone row. Apply the same principle to any scenario where data skips a zone: CDN redirects (client fetches from CDN, not through app), webhook callbacks (external service -> app directly), background job results (worker -> storage directly).
- [ ] **Bypass/skip scenarios are visually distinct** (dashed border, muted label, "(bypassed)").
- [ ] **The "not reached" state is shown** (dimmed/muted with "not reached" label).
- [ ] **The idle state shows the same structural elements as the active state.** Table headers, zone outlines, node shapes, and lane labels must be visible before any probe fires. Use placeholder rows inside the existing structure, not a different render path.
- [ ] **Internal node indicators agree with the node's overall state.** When a probe sets a danger state on a node (red border, red flash), every internal indicator (memory gauges, progress bars, bandwidth labels, status badges) must also reflect danger. A green gauge inside a red-bordered node is a visual contradiction. For each danger-state frame, verify that `memoryMB`, badge colors, and label text all match the intended severity.
- [ ] **Edge labels are not clipped behind nodes.** Check the x-position gap between every pair of connected nodes. The gap must be at least 300px for horizontal layouts (node widths are typically 160-208px, so 300px gap leaves ~100-140px visible for labels). Write out the longest edge label for each edge and verify it fits. Case study: L43 had nodes at x=0, x=220, x=440 (220px gaps). Edge labels "destroy(42)" and "DELETE WHERE id=42" were hidden behind nodes. Users had to drag nodes apart to read them.

For visualization accuracy case studies (L15 CORS, L27 idle state), see the `design-level` skill's observe-phase-guide.md.

### Mechanism vs metric checklist

- [ ] **Is the center panel MORE than just a ProbeTerminal?** If only ProbeTerminal with no visual component above, there is no visualization. Stop and redesign.
- [ ] **Can the player see WHAT the system is doing, not just the result?** If the visualization only shows a number, status badge, or SQL text in a terminal, it's a metric.
- [ ] **Does the visualization show visual objects that animate?** Text in a terminal is not a visual object.
- [ ] **Does the visualization look structurally different between problem and solution?** The solution should introduce a new visual element absent in the problem.
- [ ] **Could a player explain the mechanism after watching?** If they can only cite a number, the visualization taught a metric.
- [ ] **Are progress bars, gauges, or terminal logs the primary element?** Replace with visual representations of the actual objects.

For mechanism vs metric case studies (L26 indexing, L27 counter caches), see the `design-level` skill's observe-phase-guide.md.

### Visualization uniqueness checklist (non-negotiable)

- [ ] **Check adjacent levels (N-2 to N+2) for visual similarity.** Open the component files for nearby levels and compare the visualization shape, layout direction, and primary visual elements.
- [ ] **No two adjacent levels share the same visual shape.** Two levels using block grids, two using stacked bars, or two using left-to-right pipelines side by side is a failure. Redesign one.
- [ ] **The visual metaphor emerges from the concept.** Ask: "Why does this concept use THIS shape?" If the answer is "because the previous level used it" or "because it was easy to build," the metaphor is wrong.
- [ ] **A player could identify the level from the visualization alone.** If screenshots of levels N-1, N, and N+1 look interchangeable (same shape, same animation pattern, same color semantics), redesign.

### Required interactivity (Types 3 and 4 only)

- [ ] **The visualization is interactive, not passive.** Player must click, probe, or explore.
- [ ] **Discovery gating controls progression.** `minRequired` equals total discoveries. "Build the Fix" appears only when `discoveryGating.isUnlocked`.
- [ ] **"Build the Fix" button** appears with `animate-in fade-in duration-500`, gated behind discoveries (NOT a timer).
- [ ] No build steps or OptionCards visible during this phase.

### Discovery mechanisms (mix and match per level)

- **Clickable regions**: For PipelineFlow, use `onNodeClick` + `StageInspector`. For custom zones, use `onClick` handlers with pulsing `?` indicators.
- **ProbeTerminal**: Terminal-style probe firing. **Always use this shared component, never build a custom terminal.** Must be disabled during flow animations.
- **Interactive controls**: Buttons, toggles, inputs that manipulate the visualization.

For progressive hint patterns and shared terminal component details, see the `design-level` skill's observe-phase-guide.md.

### Shared terminal components and layout checklist

For detailed layout patterns, code examples, and common mistakes, see [terminal-layout-guide.md](terminal-layout-guide.md).

- [ ] Level does not build a custom terminal div with traffic-light dots, scrollable log, and buttons
- [ ] Observe phase uses `ProbeTerminal` for any terminal-like interaction
- [ ] Reward phase uses `StressTestPanel` for any terminal-like stress testing
- [ ] Build phase uses `SimulatedTerminal` (via `TerminalChoiceStep`) for command selection
- [ ] **Terminal never hides the visualization.** Verify by firing 6+ requests; the diagram must remain visible.
- [ ] **Custom viz levels (Pattern A):** terminal wrapper has `flex-1 min-h-0 flex flex-col`, terminal gets `className="flex-1 flex flex-col"`
- [ ] **PipelineFlow levels (Pattern B):** terminal wrapper is a plain div, terminal gets NO `className` prop
- [ ] **Short custom viz levels (Pattern C):** terminal wrapper has `mt-auto` to anchor at bottom, terminal gets NO `className` prop. Use when the visualization has a short natural height (small table, compact diagram) and would otherwise bunch up against the terminal at the top of the panel.

### Animation locking (non-negotiable, all phases)

- [ ] ProbeTerminal and StressTestPanel have `disabled` prop set during animation
- [ ] No custom fire buttons clickable during animation
- [ ] Uses `ANIMATION_DURATION_MS` from `@/lib/animation` for timing
- [ ] Total lockout = `elementCount * ANIMATION_DURATION_MS`

For code examples and flow animation patterns, see the `design-level` skill's observe-phase-guide.md.

### Left panel (observe)

- [ ] **"Scenario" heading is present** (non-negotiable): `<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>` appears before the scenario text paragraphs. Every three-phase level must have this heading for visual consistency.
- [ ] Scenario text paragraphs (always visible, `text-sm text-muted-foreground`)
- [ ] `DiscoveryChecklist` component showing discovery progress
- [ ] Progressive `<Alert variant="info">` hint for non-obvious discovery actions

### Right panel (observe)

- [ ] Shows the broken/vulnerable/unoptimized code via `CodePreviewPanel`

### PipelineFlow-specific checks

- [ ] `onNodeClick` callback for interactive stages
- [ ] `inspectable: true` on clickable stages (pulsing `?` indicator)
- [ ] `StageInspector` overlay on click
- [ ] Node variants react to probes via `useMemo`
- [ ] Node colors match their state (broken = `'danger'`, downstream = `'inactive'`, working = `'active'`)
- [ ] **Every `<PipelineFlow>` JSX render passes `activeConnections=` (NEVER omit).** Default value when no probe / scenario has fired is `[]` (dormant), not `undefined` (which causes continuous idle animation). Grep the source for `<PipelineFlow` and verify every match has `activeConnections=` in the props. The CI test `KNOWN_AUTO_ANIMATING_EDGES` baselines existing offenders; any level you newly create or substantially modify must pass without being added to that baseline.
- [ ] **Per-probe and per-scenario activation maps cover every probe / scenario id.** Compute `activeConnections` as `lastProbeId ? PROBE_ACTIVE_CONNECTIONS[lastProbeId] ?? [] : []` (and equivalent for scenarios). The fallback `?? []` is required so a missing map entry doesn't fall through to `undefined`.

For hub-and-spoke layout, satellite state rules, and sequential edge animation, see [pipelineflow-guide.md](pipelineflow-guide.md).

## Phase 2: Problem Solving (HOW)

For detailed guidance on code preview accuracy, option quality, feedback consistency, documentation verification, and step progression, see the `design-level` skill's build-phase-guide.md.

The build phase must cover the **complete workflow**:

### Structure
- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] **Every migration generation must be followed by `rails db:migrate`** (non-negotiable).
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves progressively as steps are completed

### Code preview (if redesign needed, use `design-level` skill for case studies and transition table technique)
- [ ] **Code preview has no empty states.**
- [ ] **Code preview reflects what the step actually changed.** If a step doesn't modify code files, the preview stays unchanged.
- [ ] **Code preview does not reveal the answer for the current step.** Use `isCurrentStepCompleted ? currentStep : currentStep - 1`.
- [ ] **Code preview transition table verified.** Build the table, check every row for answer leaks, filename leaks, and fabricated changes.

### Option quality (if redesign needed, use `design-level` skill for detailed rules)
- [ ] `ErrorFeedback` component is used for wrong-answer feedback (not inline error divs)
- [ ] **ErrorFeedback is positioned above the options**, not below or between them. It stays visible until the player picks another option or gets it right (no auto-dismiss). Cleared on step advance.
- [ ] **Options are shuffled with `shuffleOptions(options, stepIndex)` from `@/lib/shuffleOptions`.** This ensures the correct answer position varies per session. Hand-positioned answers create predictable patterns. Check that both OptionCard and terminal command arrays pass through `shuffleOptions` in a `useMemo`.
- [ ] **Every OptionCard step has exactly 3 options.**
- [ ] All options use the same color
- [ ] **Feedback does not contradict earlier steps.** If a technique was correct in step M, step N's feedback must frame it as a context-dependent tradeoff, not as universally bad.
- [ ] **Inline comments within option labels do not reveal answers.** Describe the mechanism, not why it's right or wrong for this step.
- [ ] **Step labels do not reveal answers.** Use generic task descriptions, not specific gem/method names.
- [ ] **Scenario text and descriptions do not reveal answers.**
- [ ] **Wrong options are contextually plausible.**

### Feedback answer leak scan (MANDATORY, SEPARATE STEP - do not skip)

**This check has its own section because it was repeatedly missed when buried in the option quality checklist.** Structural checks (shuffleOptions, phase types, code preview indices) are satisfying to verify and consume audit attention. Feedback text review is tedious but critical. Do it as a dedicated pass AFTER all structural checks are done.

**Why this matters:** A feedback string that says "Paranoia overrides destroy globally. Discard is explicit and non-invasive" directly names the correct answer ("Discard"). The player reads the wrong-answer feedback, sees the correct gem name, and picks it without learning anything. This defeats the entire purpose of the level.

**How to check (non-negotiable procedure):**

1. **For each build step**, identify the correct answer's distinctive keywords. These are the gem name, class name, method name, or configuration value that makes the correct answer unique. Write them down.

2. **Read every `feedback` string on every wrong option in that step.** Search for the distinctive keywords from step 1. If ANY keyword appears in ANY feedback string, the feedback reveals the answer.

3. **Check terminal command feedback too.** Terminal steps have wrong commands with feedback strings. The same rule applies: feedback must not name the correct command, gem, or tool.

4. **Check by contrast/implication too.** Feedback that says "X is bad because it does not do Y" reveals Y as the answer. Feedback that says "X overrides destroy. [CorrectGem] is explicit" reveals the correct gem by naming it in contrast. The fix: describe only why X is wrong, not what the alternative does.

**Examples of violations:**

```
// BAD: Names the correct answer directly
feedback: "Paranoia overrides destroy. Discard is explicit and non-invasive."
// The player now knows the answer is "discard"

// BAD: Names the correct gem by contrast
feedback: "CanCan is outdated. Pundit is the modern standard."
// The player now knows the answer is "Pundit"

// BAD: Names the correct method
feedback: "find_each is for iteration. Use find_in_batches for batch processing."
// The player now knows the answer is "find_in_batches"

// GOOD: Explains why the wrong choice is wrong, nothing more
feedback: "This gem overrides destroy globally, which breaks existing code that expects destroy to actually remove records."

// GOOD: Describes the requirement without naming the solution
feedback: "This library is outdated and no longer maintained. You need a policy-based authorization framework."

// GOOD: Points at the flaw without revealing the fix
feedback: "This method processes one record at a time. You need batch processing to avoid loading everything into memory."
```

- [ ] **Every feedback string checked against correct answer keywords.** No feedback string in the entire level contains the correct answer's gem name, class name, method name, or distinctive configuration value.
- [ ] **No feedback reveals by contrast.** Feedback does not say "X is bad, [correct answer] is better."
- [ ] **Terminal command feedback checked too.** Same rules apply to TerminalChoiceStep wrong command feedback.

Case study: L43 (Soft Deletes) had two violations: `bundle add paranoia` feedback said "Discard is explicit and non-invasive" (naming the correct gem), and `acts_as_paranoid` feedback said "Discard is explicit: you call discard instead of destroy" (naming both the gem and the method). Both directly told the player the answer instead of just explaining why the wrong choice was wrong.

### Documentation verification (non-negotiable)
- [ ] Before writing ANY step content, **fetch and read the full README** of the gem/library from its official GitHub repo
- [ ] Verify installation steps, class names, method signatures against the README
- [ ] If the README shows N installation steps, the level must have at least N steps

## Phase 3: Solution Visualization (ADVANTAGE) - Reward

The level must have a dedicated reward phase. **The reward style depends on the observe phase type.** For detailed guidance on StressTestPanel, response lines, button labels, custom reward visualizations, and reward animation accuracy, see the `design-level` skill's reward-phase-guide.md.

### Type 2 levels: Static before/after reward

- [ ] "Before" section (compact, dimmed with `opacity-60`) + "After" section (highlighted improvements in green)
- [ ] No StressTestPanel, no useStressTest, no STRESS_SCENARIOS
- [ ] Left panel shows explanatory text about the improvement, not counters

### Types 3 and 4 levels: Interactive reward

- [ ] **No activate phase.** No star rating, no "Visualize ___" button. The last build step's "Next Step" button goes directly to reward.
- [ ] Same visualization from Phase 1 returns, now showing the solution working
- [ ] **The player interacts** to verify the fix works. This is NOT passive. Every click must produce a visible reaction.

### StressTestPanel checklist (if redesign needed, use `design-level` skill for details)

- [ ] `useStressTest(scenarios)` hook manages state, `STRESS_SCENARIOS` array defined
- [ ] `disabled={flowPhase !== -1}` blocks fire during flow animations
- [ ] Auto-fire toggle gated behind 3+ manual fires
- [ ] Response lines present on all scenarios
- [ ] **Button label format is consistent with ProbeTerminal.**

### Reward animation vs built code (non-negotiable)

- [ ] **Cross-reference every reward animation against the final code preview.**
- [ ] **Show cached case for cached/lazy behavior.** Stress tests represent repeated usage.
- [ ] **Validation labels trace to the correct class and method.**
- [ ] **No animation shows behavior the built code doesn't implement.**

### Left panel (reward)

- [ ] Legend or explanation of what visual states mean
- [ ] Counters showing cumulative results (e.g., Allowed/Blocked)

### Right panel (reward)

- [ ] Shows the final complete code (all files) via `CodePreviewPanel`

## Step Quality (Is the Build Phase Satisfying?)

If redesign is needed, use the `design-level` skill.

- [ ] **Every step requires a real decision.**
- [ ] **Steps don't reveal each other's answers.**
- [ ] **Code preview evolves progressively.** If two steps produce the same preview, one feels invisible.
- [ ] **Wrong options have distinct, teaching feedback.**
- [ ] **"Next Step" button is consistent across step types.** Default variant, `size="sm"`, `className="gap-2"`.
- [ ] **The reward phase matches the level type.** Types 3/4: interactive. Type 2: static before/after.

## Tests (non-negotiable, strict only)

**Lax tests are not tolerated.** A test that checks `array.length > 0` or `expect(PROBES).toBeDefined()` catches nothing. Every assertion must verify something the player would see and feel: exact feedback text, exact label matches, exact absence of answer leaks.

- [ ] **Test file exists** at `src/features/actN-*/__tests__/LevelNNName.test.ts`. If a level was created or modified, it must have a test file. Missing test file = audit FAIL.
- [ ] **Tests are strict, not lax.** Every test asserts on exact values (strings, IDs, counts), not just existence. Tests must fail when the data is wrong, not just when the data is missing.
- [ ] **Tests cover what the player sees:**
  - Build step quality: correct answer never first (check index), every wrong option has feedback that does NOT contain the correct answer's distinctive strings, exactly 3 options, exactly 1 correct
  - Probe-to-scenario: every probe ID appears in scenarios, label patterns match ("X (problem)" -> "X (with fix)")
  - Data consistency: all IDs unique, all labels unique, all scenarios have non-empty responseLines, mix of allowed/blocked
  - Code preview answer leaks: for each OptionCard step, the code preview at completedStep N-1 does NOT contain step N's correct answer strings
  - Discovery reachability: every discovery ID is reachable by firing all probes through PROBE_DISCOVERY_MAP
- [ ] **Tests use mirrored data (not imported).** Data structures are copied into the test file as a snapshot.
- [ ] **Tests pass.** Run `bun test path/to/test.ts` and verify.

## Cross-Phase Consistency (Non-Negotiable)

- [ ] **Visual language is consistent across phases.** Observe/intro and reward use the same visual components and the same visual style. If the intro shows static annotated tables, the reward shows static annotated tables. If the intro shows an animated pipeline, the reward shows the same animated pipeline. Mixing styles (e.g., static tables in intro, terminal-based stress test in reward) is a cross-phase inconsistency.
- [ ] **Same component, different visual state.** Observe = red/alarming, reward = green/calm. A screenshot of each phase must look visibly different.
- [ ] **Build steps address all problems shown in the intro.** Every highlighted problem gets a player decision.
- [ ] **Reward closes the loop on intro's stated problems.** Each stated problem gets a concrete resolution.
- [ ] **Every observe probe has a matching reward scenario (non-negotiable).** Build a two-column table mapping each observe probe to the reward scenario that demonstrates its fix. If any probe has no matching scenario, the player discovers a problem but never sees it resolved. The reward scenario must demonstrate the fix at the same scale as the probe (if the probe showed 25 users, the scenario should show 25 users with the fix, not just 1). See [cross-phase-consistency.md](cross-phase-consistency.md) "Every Observe Probe Must Have a Corresponding Reward Scenario" for case study.
- [ ] **Reward-only scenarios are justified.** If a reward scenario tests something not shown in observe (e.g., file validation), verify the build phase explicitly taught it. If neither observe nor build introduced the concept, the scenario is orphaned.
- [ ] **Reward scenario data does not contradict shared visualization components.** If a scenario reuses a lane/zone, check SQL, labels, and banners for consistency.
- [ ] **Probe and stress test button labels use the same format.** Compare the `label` fields in `PROBES` and `STRESS_SCENARIOS`. They must use the same naming convention (e.g., both short like `GET trending`, not probes short and scenarios with full paths like `GET /api/v1/posts/trending`). Mismatched label styles make the observe and reward phases look like different UIs.
- [ ] **Reward phase type matches observe type.** Type 3/4 -> StressTestPanel (interactive). Type 2 -> static before/after (no StressTestPanel, no useStressTest). Type 1 -> may not need reward. If a Type 2 level has StressTestPanel, that is a bug.

For detailed guidance with case studies (L16, L25, L26), see [cross-phase-consistency.md](cross-phase-consistency.md).

## State Machine

Three valid patterns exist (matching the four observe types). **There is no activate phase.** The build phase's last step transitions directly to reward.

**Type 1: No observe (setup levels):**
- [ ] State uses `phase: 'build' | 'reward'` or `phase: 'build' | 'complete'`
- [ ] Level starts directly in `'build'` phase

**Type 2: Static intro (refactoring / code-structure levels):**
- [ ] State uses `phase: 'intro' | 'build' | 'reward'`
- [ ] `intro -> build`: triggered by "Build the Fix" button click, **no gating** (always visible)
- [ ] `build -> reward`: triggered by "Next Step" button on the last completed step

**Types 3 and 4: Full interactive observe (custom visualization or PipelineFlow):**
- [ ] State uses `phase: 'observe' | 'build' | 'reward'`
- [ ] `observe -> build`: triggered by "Build the Fix" button click, **gated behind `discoveryGating.isUnlocked`** (NOT a timer)
- [ ] `build -> reward`: triggered by "Next Step" button on the last completed step

**No activate phase (non-negotiable).** Do not add a star rating screen or "Visualize ___" interstitial between build and reward. The last build step uses the same "Next Step" button as every other step, and clicking it goes straight to reward. No `useEffect` auto-advance. If an existing level has an activate phase, remove it during the audit.

**Common to all:**
- [ ] Phase state uses a union type (not boolean flags)
- [ ] **No `'activate'` in the phase union type.** Flag it if found.
- [ ] Visualizations are declarative (no manual animation intervals or mutable request state to manage)
- [ ] Observe/intro visualization state built with `useMemo` reacting to player interactions
- [ ] Reward visualization state built with `useMemo` reacting to player actions

## CSS and Animation Checks

Verify that any custom animations follow Tailwind v4 / Lightning CSS constraints:

- [ ] **No `var()` inside `@keyframes`.** Lightning CSS silently strips keyframes containing CSS variable references. Use fixed values or percentage-based positioning instead.
- [ ] **New `@theme` entries registered** in `@theme inline {}` in `global.css` for custom keyframes (e.g., `--animate-flow-dot-down: flow-dot-down 1.2s ease-in-out infinite;`). Note: this requires a dev server restart to take effect.
- [ ] **No inline `style` attributes for animations.** Use Tailwind `animate-*` classes instead of inline `animation:` styles, so the build system includes the referenced keyframes.
- [ ] **`FlowConnector` used instead of `ArrowDown` icons.**
- [ ] **`FlowConnector` direction matches the visualization's data flow.** Dots must travel in the same direction data flows in the visualization. A mismatch (e.g., vertical dots in a left-to-right layout) breaks the visual metaphor.
- [ ] **React Flow containers use `flex-1 relative`, never fixed heights.** The React Flow `<div>` wrapper must use `flex-1 relative` so it fills available space, matching how PipelineFlow levels (L12 canonical) render. Never use fixed heights like `h-56`, `h-72`, etc. Fixed heights waste space or clip the canvas depending on panel size.
- [ ] **React Flow nodes are draggable by default.** Do not pass `nodesDraggable={false}` to `FlowDiagram`. The default (`true`) lets players rearrange nodes to better read edge labels and understand the layout. Only disable dragging if the level has a specific reason (none currently do).

## Color Contrast Checks (Light + Dark Mode)

- [ ] **No hardcoded dark-only colors.** Do not use fixed `text-zinc-200`, `text-zinc-400`, `bg-zinc-800`, `bg-emerald-900/40`, `bg-red-900/40` etc. without `dark:` counterparts. These are invisible or washed out in light mode. Use semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`) where possible, and add explicit `dark:` variants for any fixed Tailwind colors.
- [ ] **Badge/pill text contrast.** Use `text-emerald-700 dark:text-emerald-400`, not just `text-emerald-400`.
- [ ] **Zone/node backgrounds adapt to theme.** `bg-emerald-100 dark:bg-emerald-900/40`.
- [ ] **Semi-transparent backgrounds do not leak.** If a node/zone uses a semi-transparent background (e.g., `bg-red-900/40`), verify the underlying canvas color does not bleed through and create unreadable contrast. Prefer opaque backgrounds for states like panic/danger.
- [ ] **Scrollbar artifacts.** If a node/zone has scrollable content (`overflow-y-auto`, `max-h-*`), check that the scrollbar track does not create visible contrast artifacts against the node background. Prefer expanding height over scrolling when content is short.
- [ ] **Terminal components use adaptive colors.** See [terminal-layout-guide.md](terminal-layout-guide.md) for the full color reference table. Custom terminal-like UI must follow the same adaptive light/dark pattern.

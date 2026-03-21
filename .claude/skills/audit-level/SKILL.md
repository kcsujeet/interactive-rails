---
name: audit-level
description: Audit a level component against the three-phase sequential flow standard and narrative consistency checks. Use when reviewing, creating, or redesigning any level component.
---

# Audit Level Against Three-Phase Flow

Audit a level component to verify it follows the mandatory three-phase sequential flow pattern established in CLAUDE.md. The golden standard is: Problem Visualization -> Problem Solving -> Solution Visualization.

## Supporting Files

This skill is split across multiple files. SKILL.md contains the core audit flow and all checklists. Supporting files contain detailed guidance, case studies, and implementation patterns:

- [implementation-rules.md](implementation-rules.md): **Non-negotiable. Read before building any level.** Pre-flight checklist, bug table of past mistakes, and core principles for writing animation frames, code previews, and connectors. These rules apply during implementation, not just audits.
- [cumulative-patterns.md](cumulative-patterns.md): **Non-negotiable.** Complete reference of every architectural pattern, gem, and code convention established in each level. Every audit must check code previews against patterns from earlier levels. Violations (e.g., inline validation instead of dry-validation contracts, direct model calls instead of service objects) are Critical severity. **You must update this file whenever you create, redesign, or modify a level that changes what patterns are taught.** This file must always reflect the current state of the curriculum.
- [observe-phase-guide.md](observe-phase-guide.md): Type 2/3/4 deep dives, visualization accuracy case studies (L15, L25, L26, L27), mechanism vs metric principles, shared terminal components, flow animation patterns, discovery hint patterns
- [pipelineflow-guide.md](pipelineflow-guide.md): Hub-and-spoke layout coordinates, bidirectional edge rendering, satellite state rules, node color rules, sequential edge animation API
- [build-phase-guide.md](build-phase-guide.md): Code preview accuracy (transition table technique, no fabricated changes), option card quality (3 options, no answer-revealing comments), feedback consistency (no cross-step contradictions), documentation verification, step progression, UI consistency
- [reward-phase-guide.md](reward-phase-guide.md): StressTestPanel response lines, button labels, custom reward visualization rules, reward flow animation
- [cross-phase-consistency.md](cross-phase-consistency.md): Visual language consistency, same component different state, build-intro alignment, reward loop closure, scenario data consistency (all with case studies)
- [terminal-layout-guide.md](terminal-layout-guide.md): Terminal panel sizing patterns (Pattern A for custom viz, Pattern B for PipelineFlow), shared component usage rules, flex layout common mistakes
- [visualization-examples.md](visualization-examples.md): **Read before designing any visualization.** Real examples of failed visualizations and how they were fixed. Covers the zero-knowledge principle: every visualization must be understandable by someone who has never encountered the concept. Includes L34 Locking case study (invisible same-value conflicts, abstract labels, implausible scenarios) and a checklist for new visualizations.

## Reference Implementations

See [reference-implementations.md](reference-implementations.md) for canonical examples (L12 PipelineFlow, L10/L15/L26/L27/L28/L29 custom) and visualization design principles.

## CRITICAL: These Rules Apply During Implementation, Not Just Audits

**Read [implementation-rules.md](implementation-rules.md) before building or modifying any level.** It contains the pre-flight checklist, bug table of past mistakes, and core principles for writing animation frames, code previews, and connectors. Every check in this audit skill applies when BUILDING a level, not just when reviewing one.

## Step -1: Narrative Reasoning (DO THIS BEFORE ANYTHING ELSE)

**Before any structural check, before any visualization review, before reading the code: answer these questions about the level's story.** This is the foundation everything else is built on. If the story is wrong, no amount of correct animation or structural compliance matters.

### 1. What is the problem this level presents?

State it in one sentence. Not the Rails concept ("Active Storage"), but the concrete problem the player is experiencing in their app. Example: "Product photos are being uploaded through the Rails server, spiking memory and blocking workers."

### 2. How did the player get into this situation?

Think about the act context and what came before. By Act 5, the player has built a full e-commerce app with models, controllers, services, validations, associations, testing, and performance optimizations across 34 levels. Ask:

- **What would the app realistically look like right now?** What features exist? What tech is already in place?
- **How would the player have implemented the "before" state?** Would they have used the naive approach, a partially-correct approach, or no implementation at all?
- **Does the "before" code make sense for someone at this skill level and stage of the app?**

Example of getting this WRONG: L35 showed `user.avatar.attach(@file)` (Active Storage API) in the observe phase, then asked the player to "Install Active Storage" in the build phase. If Active Storage is already being used, why are we installing it? The "before" state contradicted the build steps.

Example of getting this RIGHT: The player has been saving files manually to disk (naive approach). The problem is memory spikes, no CDN, no variants. The build phase introduces Active Storage as the upgrade.

### 3. Does the visualization match the "before" state?

The zones, nodes, and flow in the observe phase must reflect what actually exists in the "before" code. If the code saves files to the app server's local disk, the visualization should NOT show an S3 zone. If Active Storage isn't installed, there's no blob tracking. The visualization must be honest about what the player's app looks like right now.

**Check observe probe animation frames.** For each probe, verify that the animation frame data only references zones/connectors that exist in the "before" state. If a zone (e.g., S3 Storage) is introduced by the build phase, no observe probe frame should set state on that zone. Case study: L35's observe probes originally set `s3` and `connB` state, but S3 doesn't exist until Active Storage is configured in the build phase.

**Check zone rendering is conditional.** If the observe and reward phases show different numbers of zones (e.g., 2 zones in observe, 3 in reward), verify that `renderUploadPipeline` (or equivalent) conditionally renders zones based on phase. Don't render zones that don't exist in the current narrative state.

### 4. Does the build phase bridge from "before" to "after"?

The build steps should transform the "before" state into the "after" state. Every step should make sense in sequence. If step 1 is "Install Active Storage" but the observe code already uses Active Storage APIs, the bridge is broken.

**If any of these questions reveal an inconsistency, stop and fix the narrative before proceeding with the rest of the audit.** Structural compliance, animation quality, and visualization design are all downstream of narrative coherence.

---



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

## Gate Check: Does the Observe Phase Teach the Concept? (EVALUATE FIRST)

**This is the single most important check in the entire audit. Evaluate it BEFORE any structural compliance checks. If this fails, nothing else matters.**

**Before designing or evaluating any visualization, read [visualization-examples.md](visualization-examples.md).** It contains real case studies of visualizations that failed the zero-knowledge test and how they were fixed. The core principle: every visualization must be understandable by a player who has never encountered the concept.

### Step 1: Identify the observe phase type

| Type | Observe phase | What "teaches the concept" means |
|------|--------------|----------------------------------|
| **1. No observe** | Skipped entirely | N/A. Pure setup, no problem to teach. Gate check passes automatically. |
| **2. Static intro** | Annotated code display | The code structure IS the lesson. Colored borders, badges, and a callout make the structural problem visible. No animation or interactivity needed. |
| **3. Custom visualization** | Bespoke animated layout | Visual objects (blocks, arrows, zones, grids) animate to show the runtime mechanism. ProbeTerminal drives the animation but is NOT the visualization itself. |
| **4. PipelineFlow** | Interactive node graph | Pipeline nodes react to probes with variant/sublabel changes, edges animate sequentially, StageInspector overlays reveal code. |

**If you cannot immediately identify the type, that is already a problem.**

### Step 2: Apply the design check for that type

**Type 1 (no observe):** No check needed. Move on to the build phase audit.

**Type 2 (static intro):** Ask: "Does the annotated code display make the structural problem self-evident?" If it needs extensive text explanation, either the annotations are insufficient or it should be Type 3.

**Type 3 (custom visualization):** Ask: **"If I were a player who had never heard of [concept], would I understand what it IS and DOES by watching this visualization?"** Then check:
1. **Is there a visual component above/alongside the ProbeTerminal?** If the center panel is ONLY a ProbeTerminal with no visual component, the level has no visualization. Stop and redesign.
2. **Does that visual component show objects (blocks, arrows, cards, zones, grids) that animate and change state?** If it only shows text, numbers, or static labels, it's a metric display, not a mechanism. Stop and redesign.
3. **Does the visual component react to probe fires with visible state changes?** If probe fires only add text to a log, there is no visual feedback loop. Stop and redesign.

**Type 4 (PipelineFlow):** Ask: "Do the pipeline nodes visually react to probes?" Then check:
1. **Do node variants change on probe fire?** Broken -> `'danger'`, downstream -> `'inactive'`, working -> `'active'`.
2. **Do edges animate sequentially?** `activeConnections` should light up edges in order.
3. **Does StageInspector reveal meaningful code on click?**

**If any sub-check fails, do not proceed with the rest of the audit.** Flag the observe phase as fundamentally broken and redesign it before checking anything else.

### Step 3: Probe-by-probe playthrough (MANDATORY for Types 3 and 4)

**Structural compliance is not a real audit.** Verifying that hooks exist, props are passed, and components are imported tells you nothing about whether the visualization teaches the concept. You MUST mentally (or actually) play through each probe and write down what the player sees.

**For each probe, answer these questions in writing:**
1. What animation plays when this probe fires? (Describe the specific zone/node states, text labels, colors, and timing.)
2. How is this animation DIFFERENT from every other probe's animation?
3. Does the animation content match what the probe label claims to test? (e.g., a "Download avatar" probe should not show "Sending file..." and "Stored")
4. After watching this probe's animation, could a newcomer explain what went wrong?

**If any two probes produce the same animation, the visualization fails.** Each probe exists to teach a different aspect of the problem. Identical animations mean the visualization is generic instead of specific.

**If the animation content contradicts the probe label, the visualization fails.** A download probe that shows upload animation, or a listing probe that shows single-file flow, teaches the wrong concept.

**If visual signals within a node contradict each other, the visualization fails.** Every visual indicator inside a node (gauges, progress bars, badges, labels, border color) must agree on whether the state is healthy or dangerous. A node with a red danger border but a green memory gauge, or a "BLOCKED" label with a healthy progress bar, sends mixed signals. When a probe frame sets `flash: 'red'` on a zone, check that ALL internal indicators (memoryMB, bandwidthLabel, badges) also reflect the danger state. Case study: L35's list probe set `flash: 'red'` on the App Server (red border, red label text) but never set `memoryMB`, so the memory gauge stayed at 45MB (green). The node screamed danger at the border but showed "everything is fine" inside.

**Do not skip this step.** Case study: L35 Active Storage passed all structural checks (ProbeTerminal present, FlowConnector present, discoveries defined, animation locking correct) but all three probes played the exact same animation. See [visualization-examples.md](visualization-examples.md) "Audit Trap" section.

For detailed case studies (L27 terminal-only failure, ProbeTerminal-is-not-a-visualization architecture), see [observe-phase-guide.md](observe-phase-guide.md).

## Checklist

### Phase 0: Concept Fit (Does This Level Belong Here?)

- [ ] **The concept matches the act's narrative stage.** Ask: "Would a real developer need this right now, at this stage of the app?"
- [ ] **The concept builds on what came before.** The player should have the prerequisite knowledge from earlier levels.
- [ ] **The concept is proportional to the act's complexity.** Acts 1-2: fundamentals. Acts 3-4: refactoring and performance. Acts 5-8: production, reliability, scale.
- [ ] **The scenario feels natural, not forced.** If you have to invent a contrived justification, the level doesn't fit.
- [ ] **Complexity is monotonically increasing.** The level should feel at least as complex as the previous one.

Example: Rate limiting in Act 2 fails this check. Strong params fits Act 2 perfectly.

### Phase 0b: Narrative Consistency (Does the Content Match the App State?)

Read the content definition in `content.ts` alongside the component. Check for these common narrative bugs:

- [ ] **No references to models/columns that do not exist yet.** Trace the app's schema from L1 to this level.
- [ ] **No concept overlap with other levels.** Check if this level teaches something already covered elsewhere.
- [ ] **Trigger acknowledges prior levels.** The trigger should connect to the app's state after the previous level.
- [ ] **codeExample does not show exact answers.** The problem code block should teach context, not provide the code the player will select.
- [ ] **content.ts and component are in sync.** If the component uses a terminal interaction, the trigger should not say "Drag the node to the slot."

**CRITICAL: Check both content.ts AND the component .tsx file.** Common drift points: attribute lists, code snippets in Before/After comparisons, left panel instruction text, step descriptions, code preview strings.

- [ ] **Code previews use ALL patterns established in earlier levels (non-negotiable).** Read [cumulative-patterns.md](cumulative-patterns.md) and verify every code preview (observe "before" code, build step previews, reward "after" code) is consistent with patterns from earlier levels. Common violations:
  - **L16+ (Service Objects):** Controllers must delegate to `ServiceName.call(args)`, never do business logic directly. Service inherits from `ApplicationService`, returns `Result = Data.define(...)`. The observe phase "before" code must also use services (the problem is in the service logic, not controller structure).
  - **L18+ (Dry-Validation):** Services must validate input via `MyContract.new.call(params)` with `validation.failure?` check, never inline `if param.blank?`. Contract file (`app/contracts/`) must appear in code previews.
  - **L19+ (Query Objects):** Complex queries should use query objects, not be inlined in services.
  - **L20+ (Error Handling):** Error responses follow the `{ error: { code, message, details } }` shape.
  This applies to ALL code shown to the player: observe phase, build step options, code preview evolution, and reward phase final code.

### Phase 1: Problem Visualization (WHY)

#### Step 0: Pick the observe phase type

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

For detailed type selection guidance, litmus tests, and case studies (L32 Polymorphic), see [observe-phase-guide.md](observe-phase-guide.md).

#### Type 1: No observe phase

The level skips observe and goes straight to build. **When:** building from scratch, no problem to visualize.

#### Type 2: Static intro (code-structure / refactoring levels ONLY)

Static annotated code display. No animation, no interactive discovery.

**When:** Refactoring levels where the code structure IS the problem. **When NOT:** Performance, security, or data-flow levels where the problem is a runtime behavior.

**What it looks like:** Colored left borders, Badge labels, callout, "Build the Fix" button always visible (no gating), phase type `'intro'`.

**Reference implementation:** Level 16 (Service Objects). For detailed code examples, see [observe-phase-guide.md](observe-phase-guide.md).

#### Type 3: Custom visualization (bespoke layout with state machine)

Each custom visualization is different; the layout shape emerges from the concept itself.

**When:** Security concepts, data flow concepts, any level with a specific spatial relationship. **Required:** Discovery gating, interactive elements, flow animation state machine.

For detailed examples and flow animation patterns, see [observe-phase-guide.md](observe-phase-guide.md).

#### Type 4: PipelineFlow (hub-and-spoke MVC architecture)

**Always hub-and-spoke layout, never linear.** Controller is the hub. Required: discovery gating, clickable nodes with `StageInspector`, probes. If a level already has a working Type 3 custom visualization, keep it.

For layout coordinates, edges, and state rules, see [pipelineflow-guide.md](pipelineflow-guide.md).

#### Visualization accuracy checklist

- [ ] **Each zone/box represents a real architectural component**, not an abstract concept or a type of request.
- [ ] **The order of zones matches the real processing order.**
- [ ] **Connectors exist between every adjacent zone.**
- [ ] **Connectors accurately represent the data path for each animation.** If a scenario's data flow bypasses a zone (e.g., "direct upload" bypasses the App Server), the animation must NOT use the connector that goes through that zone. Add a separate bypass connector if needed. Case study: L35's direct upload animation originally used `connB` (App Server <-> S3), which visually showed data flowing through the App Server to S3. The fix was adding `connC` (Client <-> S3 direct) rendered below the zone row. Apply the same principle to any scenario where data skips a zone: CDN redirects (client fetches from CDN, not through app), webhook callbacks (external service -> app directly), background job results (worker -> storage directly).
- [ ] **Bypass/skip scenarios are visually distinct** (dashed border, muted label, "(bypassed)").
- [ ] **The "not reached" state is shown** (dimmed/muted with "not reached" label).
- [ ] **The idle state shows the same structural elements as the active state.** Table headers, zone outlines, node shapes, and lane labels must be visible before any probe fires. Use placeholder rows inside the existing structure, not a different render path.
- [ ] **Internal node indicators agree with the node's overall state.** When a probe sets a danger state on a node (red border, red flash), every internal indicator (memory gauges, progress bars, bandwidth labels, status badges) must also reflect danger. A green gauge inside a red-bordered node is a visual contradiction. For each danger-state frame, verify that `memoryMB`, badge colors, and label text all match the intended severity.

For visualization accuracy case studies (L15 CORS, L27 idle state), see [observe-phase-guide.md](observe-phase-guide.md).

#### Mechanism vs metric checklist

- [ ] **Is the center panel MORE than just a ProbeTerminal?** If only ProbeTerminal with no visual component above, there is no visualization. Stop and redesign.
- [ ] **Can the player see WHAT the system is doing, not just the result?** If the visualization only shows a number, status badge, or SQL text in a terminal, it's a metric.
- [ ] **Does the visualization show visual objects that animate?** Text in a terminal is not a visual object.
- [ ] **Does the visualization look structurally different between problem and solution?** The solution should introduce a new visual element absent in the problem.
- [ ] **Could a player explain the mechanism after watching?** If they can only cite a number, the visualization taught a metric.
- [ ] **Are progress bars, gauges, or terminal logs the primary element?** Replace with visual representations of the actual objects.

For mechanism vs metric case studies (L26 indexing, L27 counter caches), see [observe-phase-guide.md](observe-phase-guide.md).

#### Visualization uniqueness checklist (non-negotiable)

- [ ] **Check adjacent levels (N-2 to N+2) for visual similarity.** Open the component files for nearby levels and compare the visualization shape, layout direction, and primary visual elements.
- [ ] **No two adjacent levels share the same visual shape.** Two levels using block grids, two using stacked bars, or two using left-to-right pipelines side by side is a failure. Redesign one.
- [ ] **The visual metaphor emerges from the concept.** Ask: "Why does this concept use THIS shape?" If the answer is "because the previous level used it" or "because it was easy to build," the metaphor is wrong.
- [ ] **A player could identify the level from the visualization alone.** If screenshots of levels N-1, N, and N+1 look interchangeable (same shape, same animation pattern, same color semantics), redesign.

#### Required interactivity (Types 3 and 4 only)

- [ ] **The visualization is interactive, not passive.** Player must click, probe, or explore.
- [ ] **Discovery gating controls progression.** `minRequired` equals total discoveries. "Build the Fix" appears only when `discoveryGating.isUnlocked`.
- [ ] **"Build the Fix" button** appears with `animate-in fade-in duration-500`, gated behind discoveries (NOT a timer).
- [ ] No build steps or OptionCards visible during this phase.

#### Discovery mechanisms (mix and match per level)

- **Clickable regions**: For PipelineFlow, use `onNodeClick` + `StageInspector`. For custom zones, use `onClick` handlers with pulsing `?` indicators.
- **ProbeTerminal**: Terminal-style probe firing. **Always use this shared component, never build a custom terminal.** Must be disabled during flow animations.
- **Interactive controls**: Buttons, toggles, inputs that manipulate the visualization.

For progressive hint patterns and shared terminal component details, see [observe-phase-guide.md](observe-phase-guide.md).

#### Shared terminal components and layout checklist

For detailed layout patterns, code examples, and common mistakes, see [terminal-layout-guide.md](terminal-layout-guide.md).

- [ ] Level does not build a custom terminal div with traffic-light dots, scrollable log, and buttons
- [ ] Observe phase uses `ProbeTerminal` for any terminal-like interaction
- [ ] Reward phase uses `StressTestPanel` for any terminal-like stress testing
- [ ] Build phase uses `SimulatedTerminal` (via `TerminalChoiceStep`) for command selection
- [ ] **Terminal never hides the visualization.** Verify by firing 6+ requests; the diagram must remain visible.
- [ ] **Custom viz levels (Pattern A):** terminal wrapper has `flex-1 min-h-0 flex flex-col`, terminal gets `className="flex-1 flex flex-col"`
- [ ] **PipelineFlow levels (Pattern B):** terminal wrapper is a plain div, terminal gets NO `className` prop
- [ ] **Short custom viz levels (Pattern C):** terminal wrapper has `mt-auto` to anchor at bottom, terminal gets NO `className` prop. Use when the visualization has a short natural height (small table, compact diagram) and would otherwise bunch up against the terminal at the top of the panel.

#### Animation locking (non-negotiable, all phases)

- [ ] ProbeTerminal and StressTestPanel have `disabled` prop set during animation
- [ ] No custom fire buttons clickable during animation
- [ ] Uses `ANIMATION_DURATION_MS` from `@/lib/animation` for timing
- [ ] Total lockout = `elementCount * ANIMATION_DURATION_MS`

For code examples and flow animation patterns, see [observe-phase-guide.md](observe-phase-guide.md).

#### Left panel (observe)

- [ ] Scenario text (always visible)
- [ ] `DiscoveryChecklist` component showing discovery progress
- [ ] Progressive `<Alert variant="info">` hint for non-obvious discovery actions

#### Right panel (observe)

- [ ] Shows the broken/vulnerable/unoptimized code via `CodePreviewPanel`

#### PipelineFlow-specific checks

- [ ] `onNodeClick` callback for interactive stages
- [ ] `inspectable: true` on clickable stages (pulsing `?` indicator)
- [ ] `StageInspector` overlay on click
- [ ] Node variants react to probes via `useMemo`
- [ ] Node colors match their state (broken = `'danger'`, downstream = `'inactive'`, working = `'active'`)

For hub-and-spoke layout, satellite state rules, and sequential edge animation, see [pipelineflow-guide.md](pipelineflow-guide.md).

### Phase 2: Problem Solving (HOW)

For detailed guidance on code preview accuracy, option quality, feedback consistency, documentation verification, and step progression, see [build-phase-guide.md](build-phase-guide.md).

The build phase must cover the **complete workflow**:

#### Structure
- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] **Every migration generation must be followed by `rails db:migrate`** (non-negotiable).
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves progressively as steps are completed

#### Code preview (see [build-phase-guide.md](build-phase-guide.md) for case studies and transition table technique)
- [ ] **Code preview has no empty states.**
- [ ] **Code preview reflects what the step actually changed.** If a step doesn't modify code files, the preview stays unchanged.
- [ ] **Code preview does not reveal the answer for the current step.** Use `isCurrentStepCompleted ? currentStep : currentStep - 1`.
- [ ] **Code preview transition table verified.** Build the table, check every row for answer leaks, filename leaks, and fabricated changes.

#### Option quality (see [build-phase-guide.md](build-phase-guide.md) for detailed rules)
- [ ] `ErrorFeedback` component is used for wrong-answer feedback (not inline error divs)
- [ ] **ErrorFeedback is positioned above the options**, not below or between them. It stays visible until the player picks another option or gets it right (no auto-dismiss). Cleared on step advance.
- [ ] Correct answer is never the first option
- [ ] **Every OptionCard step has exactly 3 options.**
- [ ] All options use the same color
- [ ] Feedback never reveals the correct answer
- [ ] **Feedback does not contradict earlier steps.** If a technique was correct in step M, step N's feedback must frame it as a context-dependent tradeoff, not as universally bad.
- [ ] **Inline comments within option labels do not reveal answers.** Describe the mechanism, not why it's right or wrong for this step.
- [ ] **Step labels do not reveal answers.** Use generic task descriptions, not specific gem/method names.
- [ ] **Scenario text and descriptions do not reveal answers.**
- [ ] **Wrong options are contextually plausible.**

#### Documentation verification (non-negotiable)
- [ ] Before writing ANY step content, **fetch and read the full README** of the gem/library from its official GitHub repo
- [ ] Verify installation steps, class names, method signatures against the README
- [ ] If the README shows N installation steps, the level must have at least N steps

### Phase 3: Solution Visualization (ADVANTAGE) - Reward

The level must have a dedicated reward phase. **The reward style depends on the observe phase type.** For detailed guidance on StressTestPanel, response lines, button labels, custom reward visualizations, and reward animation accuracy, see [reward-phase-guide.md](reward-phase-guide.md).

#### Type 2 levels: Static before/after reward

- [ ] "Before" section (compact, dimmed with `opacity-60`) + "After" section (highlighted improvements in green)
- [ ] No StressTestPanel, no useStressTest, no STRESS_SCENARIOS
- [ ] Left panel shows explanatory text about the improvement, not counters

#### Types 3 and 4 levels: Interactive reward

- [ ] Star rating + "Visualize ___" button in activate sub-phase (centered, no animation)
- [ ] Same visualization from Phase 1 returns, now showing the solution working
- [ ] **The player interacts** to verify the fix works. This is NOT passive. Every click must produce a visible reaction.

#### StressTestPanel checklist (see [reward-phase-guide.md](reward-phase-guide.md) for details)

- [ ] `useStressTest(scenarios)` hook manages state, `STRESS_SCENARIOS` array defined
- [ ] `disabled={flowPhase !== -1}` blocks fire during flow animations
- [ ] Auto-fire toggle gated behind 3+ manual fires
- [ ] Response lines present on all scenarios
- [ ] **Button label format is consistent with ProbeTerminal.**

#### Reward animation vs built code (non-negotiable)

- [ ] **Cross-reference every reward animation against the final code preview.**
- [ ] **Show cached case for cached/lazy behavior.** Stress tests represent repeated usage.
- [ ] **Validation labels trace to the correct class and method.**
- [ ] **No animation shows behavior the built code doesn't implement.**

#### Left panel (reward)

- [ ] Legend or explanation of what visual states mean
- [ ] Counters showing cumulative results (e.g., Allowed/Blocked)

#### Right panel (reward)

- [ ] Shows the final complete code (all files) via `CodePreviewPanel`

### Step Quality (Is the Build Phase Satisfying?)

See [build-phase-guide.md](build-phase-guide.md) for detailed rules and case studies.

- [ ] **Every step requires a real decision.**
- [ ] **Steps don't reveal each other's answers.**
- [ ] **Code preview evolves progressively.** If two steps produce the same preview, one feels invisible.
- [ ] **Wrong options have distinct, teaching feedback.**
- [ ] **"Next Step" button is consistent across step types.** Default variant, `size="sm"`, `className="gap-2"`.
- [ ] **The reward phase matches the level type.** Types 3/4: interactive. Type 2: static before/after.

### Cross-Phase Consistency (Non-Negotiable)

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

### State Machine

Three valid patterns exist (matching the four observe types):

**Type 1: No observe (setup levels):**
- [ ] State uses `phase: 'build' | 'activate' | 'reward'` or `phase: 'build' | 'complete'`
- [ ] Level starts directly in `'build'` phase

**Type 2: Static intro (refactoring / code-structure levels):**
- [ ] State uses `phase: 'intro' | 'build' | 'activate' | 'reward'`
- [ ] `intro -> build`: triggered by "Build the Fix" button click, **no gating** (always visible)
- [ ] `build -> activate`: triggered by `useEffect` watching `stepper.isComplete`
- [ ] `activate -> reward`: triggered by "Visualize ___" button click

**Types 3 and 4: Full interactive observe (custom visualization or PipelineFlow):**
- [ ] State uses `phase: 'observe' | 'build' | 'activate' | 'reward'`
- [ ] `observe -> build`: triggered by "Build the Fix" button click, **gated behind `discoveryGating.isUnlocked`** (NOT a timer)
- [ ] `build -> activate`: triggered by `useEffect` watching `stepper.isComplete`
- [ ] `activate -> reward`: triggered by "Visualize ___" button click

**Common to all:**
- [ ] Phase state uses a union type (not boolean flags)
- [ ] Visualizations are declarative (no manual animation intervals or mutable request state to manage)
- [ ] Observe/intro visualization state built with `useMemo` reacting to player interactions
- [ ] Reward visualization state built with `useMemo` reacting to player actions

### CSS and Animation Checks

Verify that any custom animations follow Tailwind v4 / Lightning CSS constraints:

- [ ] **No `var()` inside `@keyframes`.** Lightning CSS silently strips keyframes containing CSS variable references. Use fixed values or percentage-based positioning instead.
- [ ] **New `@theme` entries registered** in `@theme inline {}` in `global.css` for custom keyframes (e.g., `--animate-flow-dot-down: flow-dot-down 1.2s ease-in-out infinite;`). Note: this requires a dev server restart to take effect.
- [ ] **No inline `style` attributes for animations.** Use Tailwind `animate-*` classes instead of inline `animation:` styles, so the build system includes the referenced keyframes.
- [ ] **`FlowConnector` used instead of `ArrowDown` icons.**
- [ ] **`FlowConnector` direction matches the visualization's data flow.** Dots must travel in the same direction data flows in the visualization. A mismatch (e.g., vertical dots in a left-to-right layout) breaks the visual metaphor.
- [ ] **React Flow containers use `flex-1 relative`, never fixed heights.** The React Flow `<div>` wrapper must use `flex-1 relative` so it fills available space, matching how PipelineFlow levels (L12 canonical) render. Never use fixed heights like `h-56`, `h-72`, etc. Fixed heights waste space or clip the canvas depending on panel size.

### Color Contrast Checks (Light + Dark Mode)

- [ ] **No hardcoded dark-only colors.** Do not use fixed `text-zinc-200`, `text-zinc-400`, `bg-zinc-800`, `bg-emerald-900/40`, `bg-red-900/40` etc. without `dark:` counterparts. These are invisible or washed out in light mode. Use semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`) where possible, and add explicit `dark:` variants for any fixed Tailwind colors.
- [ ] **Badge/pill text contrast.** Use `text-emerald-700 dark:text-emerald-400`, not just `text-emerald-400`.
- [ ] **Zone/node backgrounds adapt to theme.** `bg-emerald-100 dark:bg-emerald-900/40`.
- [ ] **Semi-transparent backgrounds do not leak.** If a node/zone uses a semi-transparent background (e.g., `bg-red-900/40`), verify the underlying canvas color does not bleed through and create unreadable contrast. Prefer opaque backgrounds for states like panic/danger.
- [ ] **Scrollbar artifacts.** If a node/zone has scrollable content (`overflow-y-auto`, `max-h-*`), check that the scrollbar track does not create visible contrast artifacts against the node background. Prefer expanding height over scrolling when content is short.
- [ ] **Terminal components use adaptive colors.** See [terminal-layout-guide.md](terminal-layout-guide.md) for the full color reference table. Custom terminal-like UI must follow the same adaptive light/dark pattern.

## Output Format

Present findings as:

1. **Concept fit**: Does this level belong at this position in the curriculum?
2. **Narrative consistency**: Any schema ghosts, concept overlaps, or trigger gaps?
3. **Visualization assessment**: Is the current visualization unique and concept-appropriate, or is it a generic pipeline that should be replaced with something custom? **If a level already has a custom visualization, recommend keeping it and adding interactivity rather than replacing it.**
4. **Pass/Fail** for each of the 3 phases
5. **Flow animation assessment**: If using custom zone layouts, does the flow animation pattern follow the standard? (flowPhase, FlowConnector, disabled props, auto-inspect, message persistence, zone content gated behind flowPhase)
6. **Step quality**: Are steps meaningful, progressive, and satisfying?
7. **Missing steps** in the build phase (especially gem install, generators, setup)
8. **CSS/animation compliance**: Any `var()` in keyframes, missing `@theme` entries, inline animation styles, or ArrowDown icons that should be FlowConnectors?
9. **Specific code locations** that need changes (file:line)
10. **Suggested fix** for each issue found

If the level passes all checks, confirm it follows the golden standard.

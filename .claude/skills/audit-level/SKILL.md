---
name: audit-level
description: Audit a level component against the three-phase sequential flow standard and narrative consistency checks. Use when reviewing, creating, or redesigning any level component.
---

# Audit Level Against Three-Phase Flow

Audit a level component to verify it follows the mandatory three-phase sequential flow pattern established in CLAUDE.md. The golden standard is: Problem Visualization -> Problem Solving -> Solution Visualization.

## Supporting Files

This skill is split across multiple files. SKILL.md contains the core audit flow and all checklists. Supporting files contain detailed guidance, case studies, and implementation patterns:

- [cumulative-patterns.md](cumulative-patterns.md): **Non-negotiable.** Complete reference of every architectural pattern, gem, and code convention established in each level. Every audit must check code previews against patterns from earlier levels. Violations (e.g., inline validation instead of dry-validation contracts, direct model calls instead of service objects) are Critical severity. **You must update this file whenever you create, redesign, or modify a level that changes what patterns are taught.** This file must always reflect the current state of the curriculum.
- [observe-phase-guide.md](observe-phase-guide.md): Type 2/3/4 deep dives, visualization accuracy case studies (L15, L25, L26, L27), mechanism vs metric principles, shared terminal components, flow animation patterns, discovery hint patterns
- [pipelineflow-guide.md](pipelineflow-guide.md): Hub-and-spoke layout coordinates, bidirectional edge rendering, satellite state rules, node color rules, sequential edge animation API
- [reward-phase-guide.md](reward-phase-guide.md): StressTestPanel response lines, button labels, custom reward visualization rules, reward flow animation
- [cross-phase-consistency.md](cross-phase-consistency.md): Visual language consistency, same component different state, build-intro alignment, reward loop closure, scenario data consistency (all with case studies)
- [terminal-layout-guide.md](terminal-layout-guide.md): Terminal panel sizing patterns (Pattern A for custom viz, Pattern B for PipelineFlow), shared component usage rules, flex layout common mistakes
- [visualization-examples.md](visualization-examples.md): **Read before designing any visualization.** Real examples of failed visualizations and how they were fixed. Covers the zero-knowledge principle: every visualization must be understandable by someone who has never encountered the concept. Includes L34 Locking case study (invisible same-value conflicts, abstract labels, implausible scenarios) and a checklist for new visualizations.

## Reference Implementations

**PipelineFlow-based (request lifecycle concepts):**
Read Level 12 (Authorization) as the canonical example:
`frontend/src/features/act2-users-security/components/Level12Authorization.tsx`

**Custom visualization (non-pipeline concepts):**
Each custom visualization level is a reference for how to tailor the visualization to the concept being taught. No two should look the same.

- Level 10 (Validations): "Data Gate" with vertical zones (Input -> Model Gate -> Database), because validations are about filtering data at the model layer before it reaches storage.
  `frontend/src/features/act2-users-security/components/Level10Validations.tsx`
- Level 15 (CORS): 3-zone horizontal flow (Client -> CORS Middleware Gate -> Rails API) with 2 FlowConnectors, because CORS is about a request crossing the network, hitting a middleware gate first, and only reaching the API if allowed. The client zone switches between browser chrome and terminal style depending on the probe (curl vs fetch).
  `frontend/src/features/act2-users-security/components/Level15CORS.tsx`
- Level 26 (Database Indexing): "Table Row Grid" with 100 blocks per table + IndexLookupCard, because indexing is about how the database searches rows. Seq Scan = red wave sweeps through all blocks. Index Scan = B-tree index card points directly to the match (green block). The visualization shows the mechanism (scanning vs looking up), not just the metric (820ms vs 0.05ms).
  `frontend/src/features/act4-performance/components/Level26Indexing.tsx`
- Level 27 (Counter Caches): "Database Table View" showing the actual posts schema (id, title, user_id) where the ABSENCE of the `comments_count` column is the teaching moment. Firing the probe triggers a cascade animation: each post row turns red sequentially as it fires a separate COUNT(*) query to the comments table. The reward phase adds the `comments_count` column to the table, and cached loads show all rows green instantly (no cross-table queries). Single probe design: one probe teaches the N+1 COUNT mechanism; multiple probes with different row counts would be metric repetition.
  `frontend/src/features/act4-performance/components/Level27CounterCaches.tsx`
- Level 28 (Pagination): "Page Stack" with 20 horizontal bars stacked vertically (each bar = 2,500 records out of 50K). Problem: all 20 bars cascade red top-to-bottom (loading everything). Solution: only 1 bar glows green (the page chunk requested), rest stay dim. Visually distinct from L26's block grid and L29's document grid because bars are wide horizontal slices that communicate "cutting data into pages."
  `frontend/src/features/act4-performance/components/Level28Pagination.tsx`
- Level 29 (Search): "Document Search Grid" with a 100-block grid (20x5). Problem: red wave sweeps ALL blocks (sequential scan with LIKE). Solution: GIN Index Card appears showing stemmed terms -> row IDs, matching blocks go green instantly. Visually distinct from L28's page stack because the grid represents database rows being scanned, not pages being sliced.
  `frontend/src/features/act4-performance/components/Level29Search.tsx`

The visualization shape, direction, and structure should emerge from the concept itself. L10 flows top-to-bottom because data moves through layers. L15 flows left-to-right because a request travels from client through a gate to the API. L26 shows a grid of row blocks because indexing is about how many rows the database touches. L27 shows a database table with schema columns because counter caches are about adding a column to avoid cross-table queries. Don't copy one level's layout onto another. Design the visualization that best helps the player understand the specific problem.

**Visualization uniqueness is non-negotiable.** Before designing or approving a visualization, check adjacent levels (N-2 to N+2) for visual similarity. If two levels use the same shape (e.g., both use block grids, both use stacked bars, both use left-to-right pipelines), redesign one of them. Each level's visualization must be visually distinct at a glance. Ask: "If I showed a player screenshots of levels N-1, N, and N+1 side by side, could they tell which is which without reading the title?" If not, the visualizations are too similar and at least one needs a redesign. Always think about what visual metaphor best represents the specific concept, not what is easiest to build.

## CRITICAL: These Rules Apply During Implementation, Not Just Audits

**Every check in this skill applies when BUILDING a level, not just when reviewing one.** The audit skill is not a post-hoc review tool. It is the standard for how levels are built. If you are writing animation frame arrays, code preview boundaries, connector definitions, or zone layouts, you must verify them against these checks AS YOU WRITE THEM.

The following bugs were all caused by skipping implementation-time verification and treating this skill as audit-only:

| Bug | What went wrong | What should have happened |
|-----|----------------|--------------------------|
| Observe frames referenced S3 | Frames were copied mechanically without checking if S3 exists in the "before" state | Zone existence check (section 3 below) before writing any frame |
| Code preview revealed answers | Used `furthestStep` as code preview index without checking what the player sees | Code preview boundary check (Phase 2 checklist) before writing `getCodeFiles` |
| Direct upload used wrong connector | Reused connB (App<->S3) for Client->S3 flow without checking the data path | Connector accuracy check (visualization accuracy checklist) before writing each frame |
| Fabricated technical claim about `create_before_direct_upload!` | Assumed API behavior instead of verifying | Technical claims must be verified against docs/source before writing frames |
| Reward animation skipped steps in real flow | Concurrent upload animation stopped at "stored on S3" without the attach step. An orphaned blob on S3 is not a completed upload. | Write out the COMPLETE real-world flow before writing frames. Every step the real system performs must have a frame. |
| Reward scenarios split one user action into multiple buttons | "Direct upload" and "Attach blob" were separate buttons, but a user just clicks "Upload photo" | Each stress test button = one user action. The animation plays the full technical flow triggered by that action. |
| React Flow container used fixed height | Used `h-72` instead of `flex-1 relative`, unlike every other PipelineFlow level | Always use `flex-1 relative` for React Flow containers so they fill available space. Check how the canonical reference (L12) renders its PipelineFlow before building a custom React Flow visualization. |

**Do not treat frame arrays as mechanical data to wire up.** Each frame is a claim about how the real system works. Verify the claim before writing the frame.

**Every animation must show the COMPLETE flow for its user action.** Before writing frames, write out every step the real system performs for that action. If the flow has 5 steps and you only animate 3, the player learns an incomplete concept. An upload that stops at "stored on S3" without attaching the blob teaches the player that direct upload ends at S3, which is wrong.

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

**Mandatory type justification (non-negotiable):** Before proceeding with any type, write a one-sentence justification answering: **"What runtime behavior does this level need to animate?"** If the answer is "none, the problem is visible in the code structure," it is Type 2. If you cannot name a specific runtime mechanism (request flow, query execution, data race, network call), do not use Type 3 or Type 4.

**The "pattern matching" trap:** Do not choose Type 3 just because adjacent levels in the same act use Type 3. Each level's type is determined by its concept, not by what its neighbors do. A schema duplication problem (Type 2) surrounded by runtime behavior levels (Type 3) is still Type 2.

**Type 2 litmus test (apply before choosing Type 3):** Ask these questions in order. If ANY answer is "yes," the level is Type 2, not Type 3:
1. Can the player fully understand the problem by reading two code snippets side by side? (e.g., duplicate schemas, fat controller, scattered validations)
2. Is the problem about code organization, duplication, or missing abstractions rather than what happens at runtime?
3. Would adding probes and animations feel forced, like inventing fake runtime behavior to justify interactivity?

**Case study: L32 Polymorphic Associations.** Polymorphic associations solve schema duplication (3 identical comment tables). This is a code-structure problem visible by reading the schema. There is no runtime behavior to animate: no requests to fire, no race conditions, no performance degradation to measure. Adding probes ("fire a query at post_comments!") and discovery gating would be inventing fake interactivity. Type 2 static intro with annotated schema tables is the correct choice.

**Critical distinction between Type 2 and Type 3:** If explaining the problem requires showing numbers (memory, latency, query count) rather than code structure (responsibilities, abstractions, duplication), it needs Type 3, not Type 2.

**Critical: Types 3 and 4 are both interactive with discovery gating. Types 1 and 2 have no discovery gating.** Do not add `useDiscoveryGating`, `DiscoveryChecklist`, `ProbeTerminal`, or `ScenarioCards` to Type 1 or Type 2 levels.

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

**Critical: PipelineFlow always uses hub-and-spoke layout, never linear.** The Controller is the hub that orchestrates satellites (Model, Database, Serializer) on vertical branches.

```
                 Serializer (L7+)
                    ^  |
                    |  v
Request -> Router -> Controller -> Response
                    ^  |
                    |  v
                   Model (L5+)
                    ^  |
                    |  v
                  Database (L5+)
```

**Required:** Discovery gating, clickable nodes with `StageInspector`, probes, flow animation. **Reference implementations:** L5, L6, L7, L8.

**If a level already has a custom visualization (Type 3) that teaches the concept well, keep it.** Do not replace it with PipelineFlow.

For hub-and-spoke coordinates, bidirectional edges, satellite state rules, and sequential edge animation, see [pipelineflow-guide.md](pipelineflow-guide.md).

#### Visualization accuracy checklist

- [ ] **Each zone/box represents a real architectural component**, not an abstract concept or a type of request.
- [ ] **The order of zones matches the real processing order.**
- [ ] **Connectors exist between every adjacent zone.**
- [ ] **Connectors accurately represent the data path for each animation.** If a scenario's data flow bypasses a zone (e.g., "direct upload" bypasses the App Server), the animation must NOT use the connector that goes through that zone. Add a separate bypass connector if needed. Case study: L35's direct upload animation originally used `connB` (App Server <-> S3), which visually showed data flowing through the App Server to S3. The fix was adding `connC` (Client <-> S3 direct) rendered below the zone row. Apply the same principle to any scenario where data skips a zone: CDN redirects (client fetches from CDN, not through app), webhook callbacks (external service -> app directly), background job results (worker -> storage directly).
- [ ] **Bypass/skip scenarios are visually distinct** (dashed border, muted label, "(bypassed)").
- [ ] **The "not reached" state is shown** (dimmed/muted with "not reached" label).
- [ ] **The idle state shows the same structural elements as the active state.** Table headers, zone outlines, node shapes, and lane labels must be visible before any probe fires. Use placeholder rows inside the existing structure, not a different render path.

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

#### Animation locking (non-negotiable, all phases)

**When a flow animation is running, all probe/fire buttons MUST be disabled.**

```tsx
// GOOD: probes disabled during animation
<ProbeTerminal disabled={flowPhase !== -1} onProbe={handleProbe} probes={PROBES} />
<StressTestPanel disabled={flowPhase !== -1} onFire={handleFireScenario} ... />

// BAD: no disabled prop, player can fire overlapping probes
<ProbeTerminal onProbe={handleProbe} probes={PROBES} />
```

- [ ] ProbeTerminal has `disabled={flowPhase !== -1}` (or equivalent)
- [ ] StressTestPanel has `disabled={flowPhase !== -1}` (or equivalent)
- [ ] No custom fire buttons are clickable during animation
- [ ] Auto-fire timing accounts for animation duration

#### Animation timing constant

```tsx
import { ANIMATION_DURATION_MS } from '@/lib/animation'; // 1500ms per element
```

- [ ] Level imports `ANIMATION_DURATION_MS` from `@/lib/animation`
- [ ] Per-element stagger uses `ANIMATION_DURATION_MS` directly (not divided)
- [ ] Total lockout = `elementCount * ANIMATION_DURATION_MS`

For flow animation patterns (flowPhase, FlowConnector, zone gating), see [observe-phase-guide.md](observe-phase-guide.md).

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

The build phase must cover the **complete workflow**:

- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves progressively as steps are completed
- [ ] **Code preview has no empty states.** Check the `getCodeFiles` function: every step state must produce non-empty code. A common bug is a ternary chain where the fallback is an empty string, leaving the code panel blank after completing a step. Every step completion should show a meaningful code snapshot (skeleton with placeholder comments for what comes next).
- [ ] **Code preview does not reveal the answer for the current step (non-negotiable).** While the player is WORKING ON step N (not yet completed), the right panel must show the result of step N-1 (context), NOT the result of step N (the answer). Common bug: using `stepper.furthestStep` or `stepper.currentStep` directly as the code preview index, which shows the current step's result code before the player has selected it. Fix: pass `isCurrentStepCompleted ? currentStep : currentStep - 1` as the "completedStep" to `getCodeFiles`. Case study: L35 showed the correct `has_one_attached` model code in the right panel while the player was still choosing between model attachment options.
- [ ] **Verify by mental walkthrough.** For each OptionCard step, compare: (a) the correct answer's code snippet, and (b) the code preview shown while working on that step. If any distinctive string from (a) appears in (b), the answer is revealed.
- [ ] `ErrorFeedback` component is used for wrong-answer feedback (not inline error divs)
- [ ] Correct answer is never the first option
- [ ] All options use the same color
- [ ] Feedback never reveals the correct answer
- [ ] **Step labels do not reveal answers.** StepProgress pill titles (shown in the left panel) must describe the task generically, not name the specific gem, module, or method the player will choose. E.g., "Install Pagination Gem" not "Add the Pagy Gem"; "Include Controller Module" not "Include Pagy::Method".
- [ ] **Scenario text and descriptions do not reveal answers.** The left panel scenario text, step descriptions, and hint text must never name the correct gem, class, method, or command that the player will select. Describe the requirements and constraints instead. E.g., "Choose the right pagination gem" not "Pagy is the fastest pagination gem. Add it to your project."
- [ ] **Wrong options are contextually plausible.** After the player has already chosen a gem/library in an earlier step, wrong options in later steps must be from that same gem (e.g., old API names, wrong modules), not from a completely different gem they did not install.

**Documentation verification (non-negotiable):**
- [ ] Before writing ANY step content, **fetch and read the full README** of the gem/library from its official GitHub repo using `WebFetch` (not just the repo landing page, not a summary)
- [ ] Verify exact installation steps from the README
- [ ] Verify generated file contents match actual template files in the gem's source code (check `lib/generators/` in the repo)
- [ ] Verify class names, module names, method signatures against the README
- [ ] Do NOT rely on AI knowledge of gem APIs. The README is the source of truth
- [ ] If the README shows N installation steps, the level must have at least N steps
- [ ] Any step listed in the gem's README "Getting Started" / "Installation" section that is not represented in the level must be flagged

**Typical step progression for a gem-based feature:**
1. Install the gem (`bundle add ...`) - TerminalChoiceStep
2. Include module / configure controller (if README requires it) - OptionCard step
3. Run the generator (`rails generate ...`) - TerminalChoiceStep
4. Configure/customize the generated code - OptionCard steps
5. Wire it into the application - OptionCard steps

**Common missing steps to flag:**
- Missing `bundle add <gem>` step
- Missing `include <Gem>::<Module>` in ApplicationController (many gems require this, e.g., Pundit, Devise)
- Missing `rails generate <gem>:install` step
- Missing `rails db:migrate` step after any generator that creates migrations (non-negotiable)
- Missing configuration steps (initializers, environment config)

**Every migration generation must be followed by `rails db:migrate` (non-negotiable):**
If any build step generates a migration file, the very next step MUST be running `rails db:migrate`. Without it, the column/table does not exist in the database. Case study: L27 Counter Caches originally had "Generate the counter cache migration" immediately followed by "Enable counter_cache on the association," skipping the migration run.

### Phase 3: Solution Visualization (ADVANTAGE) - Reward

The level must have a dedicated reward phase. **The reward style depends on the observe phase type.**

#### Type 2 levels: Static before/after reward

Type 2 levels (static intro) use a **static before/after comparison**, not StressTestPanel. The reward shows the problem state and solution state side by side or stacked, so the player sees the structural improvement at a glance.

- [ ] "Before" section shows the problem (compact, dimmed with `opacity-60`)
- [ ] Arrow or separator between before and after
- [ ] "After" section shows the solution (full detail, highlighted improvements in green)
- [ ] No StressTestPanel, no useStressTest, no STRESS_SCENARIOS
- [ ] Left panel shows explanatory text about the improvement, not counters

**Case study: L32 Polymorphic Associations.** Before: 3 separate comment tables (compact, dimmed). After: 1 unified comments table with polymorphic columns (`commentable_type`, `commentable_id`) highlighted in green, plus an extensibility row (Article) showing the pattern works for new types without new tables.

**Do not add StressTestPanel to Type 2 levels.** There is no runtime behavior to stress-test. Firing fake "requests" at a schema change is contrived and teaches nothing. The static comparison IS the reward: the player sees their structural improvement directly.

#### Types 3 and 4 levels: Interactive reward

For levels with interactive observe phases (Types 3 and 4), the player **interactively verifies** their solution works.

#### Sub-phase a (activate)

- [ ] Star rating display + "Visualize ___" button (centered, no animation)
- [ ] No visualization running yet

#### Sub-phase b (reward) - visualization returns

- [ ] The same visualization from Phase 1 returns, now showing the solution working
- [ ] The contrast between Phase 1 (broken) and Phase 3b (fixed) is the reward
- [ ] **The player interacts** to verify the fix works. This is NOT passive.

#### Interactivity requirement (Types 3 and 4 only)

The reward phase MUST be interactive for Types 3 and 4. Passive auto-incrementing counters (`setInterval`) are never acceptable. Options:
- **StressTestPanel + useStressTest**: Player fires scenarios. Provides `fireRequest()`, `toggleAutoFire(onFire)`, dual counters. `toggleAutoFire` accepts the same `onFire` handler used for manual fires, so animations trigger during auto-fire. Auto-fire cycles through all scenarios once, then stops. Must be disabled during flow animations.
- **Custom interactive controls**: Buttons, toggles, inputs on the custom visualization. E.g., clicking different browser origins in a CORS visualization and watching them get allowed/blocked. Clicking different query patterns in a performance visualization and seeing response times.
- **Replay/comparison controls**: Toggle between before/after states, or replay scenarios at different scales.

The key rule: **every click from the player must produce a visible reaction in the visualization.**

#### StressTestPanel checklist

- [ ] `useStressTest(scenarios)` hook manages state
- [ ] `STRESS_SCENARIOS` array defined
- [ ] Scenario buttons use `label` field, color-coded by expected result
- [ ] Auto-fire toggle gated behind 3+ manual fires
- [ ] `disabled={flowPhase !== -1}` blocks fire during flow animations
- [ ] Response lines present on all scenarios when observe probes have them
- [ ] Labels are self-descriptive and match observe-phase probe labels
- [ ] **Button label format is consistent between ProbeTerminal and StressTestPanel.** If probe buttons use short labels without URL paths (e.g., `GET trending`), stress scenario buttons must use the same style (e.g., `GET trending (cached)`), not path-style labels (e.g., `GET /trending (cached)`). The two terminals appear in the same center panel across phases and must look like they belong to the same UI.

For StressTestPanel response lines rules, button label conventions, and custom reward visualization details, see [reward-phase-guide.md](reward-phase-guide.md).

#### Left panel (reward)

- [ ] Legend or explanation of what visual states mean
- [ ] Counters showing cumulative results (e.g., Allowed/Blocked, Saved/Rejected, Fast/Slow)

#### Right panel (reward)

- [ ] Shows the final complete code (all files) via `CodePreviewPanel`

### Step Quality (Is the Build Phase Satisfying?)

- [ ] **Every step requires a real decision.** If a step's correct answer is "do nothing" or "let it happen automatically," it's not a real step. The player should actively build something at every step.
- [ ] **Steps don't reveal each other's answers.** If Step 0's correct option contains the exact code Step 1 will ask about, the player can read ahead. Use placeholders (`[...]`, `...`) in earlier steps when later steps will fill in the details.
- [ ] **Code preview evolves progressively.** Each completed step should visibly change the right panel code. If two steps produce the same code preview, one of them feels invisible.
- [ ] **Code preview never reveals the current step's answer.** The right panel must show the result of the PREVIOUS step while the player works on the current step. Only after completion should it update to show what was just built. See the Phase 2 checklist for implementation details.
- [ ] **Wrong options have distinct, teaching feedback.** Each wrong option should fail for a different reason that teaches something specific. Don't have two wrong options that are wrong for essentially the same reason.
- [ ] **The reward phase matches the level type.** Types 3/4: interactive (StressTestPanel or custom controls). Type 2: static before/after. Passive auto-incrementing counters are never allowed for any type.

### Cross-Phase Consistency (Non-Negotiable)

- [ ] **Visual language is consistent across phases.** Observe/intro and reward use the same visual components and the same visual style. If the intro shows static annotated tables, the reward shows static annotated tables. If the intro shows an animated pipeline, the reward shows the same animated pipeline. Mixing styles (e.g., static tables in intro, terminal-based stress test in reward) is a cross-phase inconsistency.
- [ ] **Same component, different visual state.** Observe = red/alarming, reward = green/calm. A screenshot of each phase must look visibly different.
- [ ] **Build steps address all problems shown in the intro.** Every highlighted problem gets a player decision.
- [ ] **Reward closes the loop on intro's stated problems.** Each stated problem gets a concrete resolution.
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
- [ ] **Terminal components use adaptive colors.** The shared terminal components (ProbeTerminal, StressTestPanel, SimulatedTerminal) use adaptive light/dark styling. They are light in light mode (`bg-zinc-50`) and dark in dark mode (`dark:bg-zinc-900`). If a level builds custom terminal-like UI, it must follow the same pattern. Never use always-dark terminal colors like `bg-zinc-900` without a `bg-zinc-50` light-mode counterpart.

**Terminal adaptive color reference (built into shared components):**

| Element | Light mode | Dark mode |
|---------|-----------|-----------|
| Container | `bg-zinc-50` | `dark:bg-zinc-900` |
| Border | `border-border` | (semantic, auto) |
| Header | `bg-muted` | (semantic, auto) |
| Header text | `text-muted-foreground` | (semantic, auto) |
| Body text | `text-foreground` | (semantic, auto) |
| Footer | `bg-muted/50` | (semantic, auto) |
| Green text | `text-emerald-600` | `dark:text-emerald-400` |
| Amber text | `text-amber-600` | `dark:text-amber-400` |
| Red text | `text-red-600` | `dark:text-red-400` |
| Cyan text | `text-cyan-600` | `dark:text-cyan-400` |
| Cursor | `bg-foreground/50` | (semantic, auto) |
| Probe buttons | `bg-amber-100 text-amber-700 border-amber-300` | `dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50` |
| Allowed buttons | `bg-emerald-100 text-emerald-700 border-emerald-300` | `dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50` |
| Blocked buttons | `bg-red-100 text-red-700 border-red-300` | `dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50` |

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

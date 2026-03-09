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
- Level 15 (CORS): 3-zone horizontal flow (Client -> CORS Middleware Gate -> Rails API) with 2 FlowConnectors, because CORS is about a request crossing the network, hitting a middleware gate first, and only reaching the API if allowed. The client zone switches between browser chrome and terminal style depending on the probe (curl vs fetch).
  `frontend/src/features/act2-users-security/components/Level15CORS.tsx`

The visualization shape, direction, and structure should emerge from the concept itself. L10 flows top-to-bottom because data moves through layers. L15 flows left-to-right because a request travels from client through a gate to the API. Don't copy one level's layout onto another. Design the visualization that best helps the player understand the specific problem.

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

### Phase 1: Problem Visualization (WHY)

#### Step 0: Pick the observe phase type

There are exactly **four types** of observe phase. Every level falls into one. Pick the right one first, then follow the rules for that type.

| Type | When to use | Phase name | Discovery gating | Example levels |
|------|------------|------------|-----------------|----------------|
| **1. No observe** | Pure setup/installation. No problem exists yet. | (skipped) | None | L1 (Rails install), L4 (scaffold generator) |
| **2. Static intro** | Code-structure problem visible by reading the code. No runtime behavior to simulate. | `'intro'` | None (button always visible) | L16 (Service Objects) |
| **3. Custom visualization** | Concept has a unique spatial/flow metaphor that needs a bespoke layout with animated state machine. | `'observe'` | Yes (`useDiscoveryGating`) | L10 (Validations: vertical data gate), L15 (CORS: horizontal 3-zone flow) |
| **4. PipelineFlow** | Request lifecycle concept where a stage is missing or broken in the MVC pipeline. | `'observe'` | Yes (`useDiscoveryGating`) | L5 (Routes), L6 (Controller), L7 (Serializer), L8 (Associations) |

**Decision flowchart:**
1. Is there a problem to discover? **No** -> Type 1 (no observe, go straight to build)
2. Is the problem visible just by reading the code? **Yes** -> Type 2 (static intro)
3. Does the concept have a unique spatial metaphor (not the MVC request chain)? **Yes** -> Type 3 (custom visualization)
4. Is the concept about something missing/broken in the request lifecycle? **Yes** -> Type 4 (PipelineFlow)

**Critical: Types 3 and 4 are both interactive with discovery gating. Types 1 and 2 have no discovery gating.** Do not add `useDiscoveryGating`, `DiscoveryChecklist`, `ProbeTerminal`, or `ScenarioCards` to Type 1 or Type 2 levels.

#### Type 1: No observe phase

The level skips the observe phase entirely and goes straight to build. The three-phase flow becomes: `build -> activate -> reward` (or just `build -> complete` for pure setup levels).

**When:** The player is building something from scratch, not fixing or discovering a flaw. There is no "problem" to visualize.

#### Type 2: Static intro (code-structure / refactoring levels)

The problem is self-evident from reading the code. A static annotated code display is enough. No animation, no interactive discovery.

**When:** Refactoring levels (fat controllers, missing abstractions, duplicated logic) where the problem is a code structure issue visible by reading the code. The briefing screen already explains the problem in text. Interactive discovery (probes, inspectors, scenario cards) would feel like busywork.

**What it looks like:**
- Static annotated code display with visual markers (colored left borders, Badge labels)
- A brief callout (1-2 sentences) stating the structural problem
- "Build the Fix" button always visible (no gating)
- No `useDiscoveryGating`, no `DiscoveryChecklist`, no `ProbeTerminal`, no `ScenarioCards`
- Phase type: `'intro'` (not `'observe'`)

**Reference implementation:** Level 16 (Service Objects)
`frontend/src/features/act3-clean-architecture/components/Level16ServiceObjects.tsx`

L16 shows a fat controller method with color-coded left-border annotations marking each responsibility section. Side-effect sections (logging, preferences, token) get an amber left border + Badge label. The core logic gets a muted zinc border. Below: a callout stating "4 responsibilities in one method." The player reads the annotated code, sees the problem, and clicks "Build the Fix" immediately.

```tsx
// GOOD: Static intro for a refactoring level
// The code tells the story. No interactive overhead.
const ANNOTATED_SECTIONS: AnnotatedSection[] = [
  { id: 'core', label: 'Core Logic', variant: 'core', code: `@user = User.new(...)` },
  { id: 'logging', label: 'Side Effect: Logging', variant: 'side-effect', code: `Rails.logger.info(...)` },
  // ...
];

// Render: colored left borders + Badge labels + callout + always-visible button
<div className="border-l-2 border-l-amber-500 bg-amber-500/5 ...">
  <Badge className="border-amber-500/50 text-amber-600 ...">Side Effect: Logging</Badge>
  <pre>{section.code}</pre>
</div>
// ...
<Button onClick={handleStartBuild}>Build the Fix</Button>  // No gating
```

```tsx
// BAD: Over-engineering the observe phase for a refactoring level
const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, { minRequired: 3 });
// Player clicks 4 abstract buttons, reads inspector overlays, clicks 3 scenario cards...
// ...all to learn that one method has too many responsibilities (which the code already shows)
{discoveryGating.isUnlocked && <Button>Build the Fix</Button>}
```

#### Type 3: Custom visualization (bespoke layout with state machine)

The concept has a unique spatial or flow metaphor that a generic pipeline cannot capture. Each custom visualization is different; the layout shape emerges from the concept itself.

**When:** Security concepts (CORS, validations), data flow concepts, or any level where the architecture has a specific spatial relationship (vertical gates, horizontal handshakes, entity diagrams).

**Examples:**
- L10 Validations: vertical "Data Gate" (Input -> Model Gate -> Database), because validations filter data at the model layer before storage
- L15 CORS: horizontal 3-zone flow (Client -> CORS Middleware Gate -> Rails API), because CORS is about a request crossing the network through a middleware gate

The visualization shape, direction, and structure should emerge from the concept itself. L10 flows top-to-bottom because data moves through layers. L15 flows left-to-right because a request travels from client through a gate to the API. No two custom visualizations should look the same.

**Required:** Discovery gating, interactive elements, flow animation state machine (see sections below).

#### Type 4: PipelineFlow (hub-and-spoke MVC architecture)

The concept is about a missing or broken stage in the request lifecycle. PipelineFlow renders the MVC architecture as an interactive node graph.

**When:** MVC architecture levels where the player needs to see where a stage fits (or is missing) in the request chain.

**Critical: PipelineFlow always uses hub-and-spoke layout, never linear.** The MVC architecture is not a simple left-to-right chain. The Controller is the hub that orchestrates satellites (Model, Database, Serializer) on vertical branches. All PipelineFlow levels must use this layout consistently.

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

- Main horizontal chain: Request, Router, Controller, Response (auto-positioned, no `position` prop)
- Satellites branch off the Controller vertically with explicit `position` props
- Each level only shows nodes introduced up to that point (progressive disclosure)
- All levels that use PipelineFlow share this same hub-and-spoke topology

**Required:** Discovery gating, clickable nodes with `StageInspector`, probes, flow animation (see sections below).

**Reference implementations:** L5 (Routes), L6 (Controller), L7 (Serializer), L8 (Associations)

**If a level already has a custom visualization (Type 3) that teaches the concept well, keep it.** Do not replace it with PipelineFlow. Add interactivity to the existing visualization instead.

#### Visualization accuracy (the visualization must not lie)

**The visualization's structure must accurately represent how the concept works.** A pretty animation that teaches the wrong mental model is worse than no animation at all. When auditing, ask: "If a player memorized this diagram, would they have an accurate understanding of the architecture?"

**Case study: L15 CORS redesign (bad -> good)**

The original L15 visualization had structural inaccuracies:

```
BAD layout (original):
  [Browser] | Origin Boundary (w-20 divider) | [Preflight OPTIONS]
                                               [CORS Middleware]
                                               [Rails API]
```

Problems:
- **Preflight was a server-side box.** Preflight (OPTIONS) is a type of request the *browser* sends, not a server component. Showing it as a server box teaches the wrong mental model.
- **CORS Middleware sat between Preflight and Rails API** as if it were a middle layer. In reality, it is Rack middleware that wraps the entire app and is the *first* thing requests hit.
- **No flow between the 3 server boxes.** They were stacked vertically with no connectors, looking disconnected. There was no visual representation of how a request moves through them.
- **Single FlowConnector** only spanned the narrow origin boundary divider, not the full request path.

The redesigned version accurately represents the CORS flow:

```
GOOD layout (redesigned):
  [Browser/Client] --FC1--> [CORS Middleware Gate] --FC2--> [Rails API]
```

Fixes:
- **Preflight removed as a zone.** It is communicated through flow messages at the Client zone (e.g., "OPTIONS preflight from localhost:3001"), which accurately represents it as browser behavior.
- **CORS Middleware is the center gate.** Requests hit it first. If allowed, they pass through to the API. If blocked, the API shows "not reached." This matches the real Rack middleware stack.
- **curl bypass is visually distinct.** The Client zone switches from browser chrome (traffic light dots, address bar) to terminal style (dark header, `$` prompt) for the curl probe. The CORS gate shows "(bypassed, no browser enforcement)" because CORS is purely browser-enforced.
- **2 FlowConnectors** show the full request path: client -> gate -> API.

**Checklist for visualization accuracy:**
- [ ] **Each zone/box represents a real architectural component**, not an abstract concept or a type of request. If something is a request type (e.g., preflight OPTIONS), communicate it through flow messages or labels, not as a separate processing stage.
- [ ] **The order of zones matches the real processing order.** If middleware X runs before component Y, X must appear before Y in the flow direction.
- [ ] **Connectors exist between every adjacent zone.** Stacking boxes without connectors looks disconnected and hides the flow relationship.
- [ ] **Bypass/skip scenarios are visually distinct.** If a probe or scenario bypasses a zone (e.g., curl bypassing CORS), the zone should visually indicate it was bypassed (dashed border, muted label, "(bypassed)") rather than showing it as processing the request.
- [ ] **The "not reached" state is shown.** When a request is blocked at zone N, zones after N should be dimmed/muted with a "not reached" label, not hidden entirely.

#### Required interactivity (Types 3 and 4 only)

When a level uses a full interactive observe phase (Type 3 custom visualization or Type 4 PipelineFlow), these rules apply:

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

**Zone content must be gated behind flowPhase (critical):**
When a probe fires, state like `lastProbeId` updates instantly, but the flow animation takes time to reach each zone. If zone content (sublabels, badges, border colors) reacts to `lastProbeId` directly, zones show their result before the animation reaches them, breaking the illusion.

Fix: derive gated flags that check both the probe state AND the flow phase:

```tsx
// Zone N shows result only after flow reaches it OR animation is done
const gateRevealed = probeState && (flowPhase >= 2 || flowPhase === -1);
const apiRevealed = probeState && (flowPhase >= 4 || flowPhase === -1);
```

Then use `gateRevealed`/`apiRevealed` instead of raw `probeState` for zone styling, sublabels, and badges. The pattern: zone at phase N gates behind `flowPhase >= N || flowPhase === -1`.

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

**Node colors must match their state (non-negotiable):**

Every node in the pipeline must visually reflect its actual state during the observe phase. A node that is unreachable, errored, or broken must never stay `default` (black/zinc). Check every node in the `observeStages` array:

- **Broken/errored node** (the focus of the level): `variant: 'danger'` on probe (red background, red border)
- **Nodes downstream of the broken stage** (unreachable): `variant: 'inactive'` + `sublabel: 'unreachable'` on probe (dashed, dimmed)
- **Nodes that show error responses** (e.g., Response showing "500" or "404"): `variant: 'danger'` on probe
- **Working nodes upstream of the problem**: `variant: 'active'` (green) or keep their existing state
- **Idle state** (no probe fired): nodes can be `default`, `active`, or `inactive` depending on their role

The rule: if a node's sublabel changes on probe (e.g., showing "404", "unreachable", "500 Error"), its variant MUST also change. A sublabel without a matching variant creates a black node with error text, which is visually wrong.

**Case study:** L6 Controller had Model node with no variant on probe (stayed black) even though the controller was broken and Model was unreachable. L8 Associations had Response node showing "404" sublabel but no variant change (stayed black instead of danger red). Both were fixed by adding the appropriate variant.

#### Hub-and-spoke implementation details (Type 4 PipelineFlow)

Implementation specifics for the hub-and-spoke layout described in Type 4 above.

- Model: below Controller with `position: { x: 500, y: 180 }`, connection uses `sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true`
- Database: below Model with `position: { x: 500, y: 360 }`, same handle config
- Serializer: above Controller with `position: { x: 500, y: -180 }`, connection uses `sourceHandle: 'top', targetHandle: 'bottom', bidirectional: true`
- Focus node uses `variant: 'inactive'` or `'danger'`, others use `'active'` or `'default'`
- Stages with explicit `position` do not consume an auto-layout slot (auto-positioned stages stay on the horizontal chain)

**Bidirectional edge rendering:**
- Bidirectional connections produce two parallel edges: forward (solid line, shifted left) and return (dashed line, shifted right), symmetric about the center
- Both edges use the same dot size (r=8). The offset is controlled by `LANE_OFFSET` (14px) in PipelineFlow
- Forward edges of bidirectional pairs get `isBidirectional: true` in edge data so they are also offset
- Non-bidirectional edges (horizontal chain) stay centered with no offset

**Satellite node state rules (every satellite must have a variant):**
- A satellite node must NEVER use the bare `default` variant (zinc) in the observe phase. It looks identical to Request and implies no relationship to the pipeline state
- When the broken stage is upstream of the satellite (e.g., Router broken in L5, Controller missing in L6), set satellites to `variant: 'inactive'` with `sublabel: 'unreachable'` on probe
- When the satellite is working (problem is elsewhere, e.g., Serializer missing in L7), set it to `variant: 'active'`
- In reward phases, satellites should always be `variant: 'active'` since the fix is applied

| Level | Observe (idle) | Observe (probe fired) | Reward |
|-------|---------------|----------------------|--------|
| L5 | `default` | `inactive` + "unreachable" | `active` |
| L6 | `default` | `inactive` + "unreachable" | `active` |
| L7 | `active` | `active` | `active` |
| L8 | `active` | `active` | `active` |

**Checklist for hub layout:**
- [ ] Main chain stages have NO `position` prop (auto-positioned horizontally)
- [ ] Satellite stages (Model, Database, Serializer) have explicit `position` props
- [ ] Connections to satellites use `sourceHandle`/`targetHandle` for vertical edges
- [ ] Bidirectional connections (`bidirectional: true`) create return edges automatically
- [ ] Every satellite node has an explicit `variant` (never bare `default` in observe)
- [ ] Satellites downstream of the broken stage show `inactive` + "unreachable" on probe
- [ ] All satellites show `active` in the reward phase

#### Sequential edge animation

**The core rule: use `activeConnections` prop to control which edges animate.** The `activeConnections` prop on PipelineFlow controls edge animation:
- `undefined` (default): all edges show idle animation (backward compat)
- `[]`: fully dormant, no dots on any edge
- `['request-router', 'controller-model']`: only listed edges animate (single-pass)

Connection IDs use `from-to` format (e.g., `"request-router"`, `"controller-model"`). For bidirectional edges, the return direction uses `"model-controller"`.

**How levels use it:**
1. Define a `FLOW_SEQUENCE: string[]` listing edge IDs in animation order
2. On probe/stress-test fire, advance through the sequence with ~600ms per edge
3. Pass `activeConnections={currentEdgeIds}` to PipelineFlow

**Idle state:** When no probe is active, `activeConnections` is `undefined` (not `[]`). An empty array means fully dormant.

**Checklist for sequential animation:**
- [ ] `FLOW_SEQUENCE` defined with correct order matching real data flow
- [ ] Bidirectional edges have TWO entries (forward + return), never simultaneous
- [ ] `activeConnections` prop passed to PipelineFlow
- [ ] Probes/stress-tests disabled during animation (`disabled={flowPhase !== -1}`)
- [ ] Node variants update in sync with the sequence

### Phase 2: Problem Solving (HOW)

The build phase must cover the **complete workflow**:

- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves with `stepper.furthestStep`
- [ ] **Code preview has no empty states.** Check the `getCodeFiles` function: every value of `furthestStep` (0, 1, 2, ... N) must produce non-empty code. A common bug is a ternary chain (`furthestStep >= 3 ? ... : furthestStep >= 2 ? ... : ''`) where the fallback is an empty string, leaving the code panel blank after completing a step. Every step completion should show a meaningful code snapshot (skeleton with placeholder comments for what comes next).
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

### Cross-Phase Consistency (Non-Negotiable)

These checks cut across all phases. Every level redesign or modification must pass all of them.

#### Visual language must be consistent across phases

The intro/observe visualization and the reward visualization must use the **same visual language**. If the intro shows annotated code with colored left borders, the reward must show annotated code with colored left borders (now green instead of amber). If the intro shows a pipeline with nodes, the reward must show the same pipeline with nodes (now fixed).

```
BAD: Intro uses annotated code blocks -> Reward uses a two-zone architecture diagram
     (completely different visual language, player can't compare before/after)

GOOD: Intro uses annotated code blocks (amber borders, "Side Effect" badges)
   -> Reward uses annotated code blocks (green borders, "Isolated" badges)
      (same visual language, player sees the transformation)
```

**Case study:** L16 originally showed annotated code in the intro but switched to a Controller box + FlowConnector + Service box layout in the reward. The player couldn't visually compare before and after because they looked nothing alike.

#### Build steps must address all problems shown in the intro

Every problem highlighted in the intro/observe phase must have a corresponding build step where the player solves it. If the intro shows N distinct problems, the build phase must have steps that address all N of them (possibly grouped, but none silently skipped).

```
BAD: Intro highlights 4 responsibilities (core + 3 side effects)
     Build has 3 steps: choose pattern, define Result, wire controller
     (The 3 side effects magically appear in the final code without the player deciding anything)

GOOD: Intro highlights 4 responsibilities (core + 3 side effects)
      Build has 4 steps: choose pattern, define Result, move side effects, wire controller
      (Every responsibility gets addressed by a player decision)
```

**Case study:** L16 originally had 3 build steps but the intro showed 4 responsibilities. The side effects (logging, preferences, token) appeared in the generated code without the player making any decision about where they should go.

#### Reward must close the loop on intro's stated problems

If the intro states specific problems (e.g., "can't be reused by a rake task, tested without HTTP, or understood at a glance"), the reward must explicitly show that each problem is now solved. A generic "it's fixed now" message is not enough.

```
BAD: Intro says "can't be reused, can't be tested, can't be read"
     Reward says "Each responsibility is isolated."
     (Generic, doesn't prove the specific claims)

GOOD: Intro says "can't be reused, can't be tested, can't be read"
      Reward shows a "Problems Solved" checklist:
      ✓ Reusable: UserRegistration.call(params) works from controllers, rake tasks, console
      ✓ Testable: Unit test calls .call directly, no request context needed
      ✓ Readable: Controller is 8 lines, service has one clear public method
      (Each original problem gets a concrete resolution)
```

**Case study:** L16's intro callout stated three specific problems but the reward had a one-line generic message. Now it has a checklist mapping each problem to its solution.

#### Reward phase type must match the level's observe type

Not every level needs an interactive stress test in the reward phase. The reward mechanism should match the level type:

| Observe type | Reward mechanism | Example |
|---|---|---|
| Type 3/4 (interactive observe with probes) | StressTestPanel: player fires requests, sees fix working | L12 Authorization, L15 CORS |
| Type 2 (static intro, code-structure level) | Static before/after contrast + problems-solved checklist | L16 Service Objects |
| Type 1 (no observe) | May not need a reward visualization at all | L1 Setup |

A stress test ("fire requests and check allowed/blocked") makes no sense for a refactoring level where the fix doesn't change what requests get through. The reward for a refactoring level is seeing the clean code structure and confirming the original problems are resolved.

### State Machine

Check the phase transitions. Three valid patterns exist (matching the four observe types):

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
- [ ] **New `@theme` entries registered.** If the level introduces custom animation keyframes, they must be registered in `@theme inline {}` in `global.css` (e.g., `--animate-flow-dot-down: flow-dot-down 1.2s ease-in-out infinite;`). Note: this requires a dev server restart to take effect.
- [ ] **No inline `style` attributes for animations.** Use Tailwind `animate-*` classes instead of inline `animation:` styles, so the build system includes the referenced keyframes.
- [ ] **`FlowConnector` used instead of `ArrowDown` icons.** Between zones in custom layouts, use the `FlowConnector` component (not Lucide ArrowDown icons or dashed borders).
- [ ] **`FlowConnector` direction matches the visualization's data flow.** Dots must travel in the same direction data flows in the visualization. A mismatch (e.g., vertical dots in a left-to-right layout) breaks the visual metaphor.

### Color Contrast Checks (Light + Dark Mode)

Every color choice must be visible and readable on both white and dark backgrounds. Custom visualization nodes (React Flow nodes, zone cards, etc.) are especially prone to contrast issues because they use explicit color classes rather than semantic tokens.

- [ ] **No hardcoded dark-only colors.** Do not use fixed `text-zinc-200`, `text-zinc-400`, `bg-zinc-800`, `bg-emerald-900/40`, `bg-red-900/40` etc. without `dark:` counterparts. These are invisible or washed out in light mode. Use semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`) where possible, and add explicit `dark:` variants for any fixed Tailwind colors.
- [ ] **Badge/pill text contrast.** Badge text like `text-emerald-400` or `text-red-400` is unreadable on light backgrounds. Use darker shades for light mode: `text-emerald-700 dark:text-emerald-400`, `text-red-700 dark:text-red-400`.
- [ ] **Zone/node backgrounds adapt to theme.** Active zone backgrounds should use light tints in light mode and dark tints in dark mode: `bg-emerald-100 dark:bg-emerald-900/40`, `bg-red-100 dark:bg-red-900/40`.
- [ ] **Semi-transparent backgrounds do not leak.** If a node/zone uses a semi-transparent background (e.g., `bg-red-900/40`), verify the underlying canvas color does not bleed through and create unreadable contrast. Prefer opaque backgrounds for states like panic/danger.
- [ ] **Scrollbar artifacts.** If a node/zone has scrollable content (`overflow-y-auto`, `max-h-*`), check that the scrollbar track does not create visible contrast artifacts against the node background. Prefer expanding height over scrolling when content is short.

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

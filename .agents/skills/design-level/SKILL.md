---
name: design-level
description: Design a new level's visualization, interactions, and build steps. Use when creating a new level component from scratch or redesigning an existing level's observe/build/reward phases. For reviewing/checking an existing level against standards, use audit-level instead.
---

# Design a Level Component

Design the three-phase gameplay for a level: what the player sees, what they interact with, and what they build. This skill focuses on the **creative design** work. For **verification and compliance checking**, use the `audit-level` skill.

## When to Use This Skill vs audit-level

| Task | Skill |
|------|-------|
| Designing a new level from scratch | **design-level** |
| Redesigning a broken visualization | **design-level** |
| Choosing a visual metaphor for a concept | **design-level** |
| Designing probe scenarios and build steps | **design-level** |
| Reviewing an existing level against standards | audit-level |
| Checking cumulative pattern compliance | audit-level |
| Verifying CSS, color contrast, state machine | audit-level |
| Flagging issues with specific code locations | audit-level |

## Shared Reference Files (in audit-level/)

These files are shared between both skills. They live in `audit-level/` and are referenced here:

- [cumulative-patterns.md](../audit-level/cumulative-patterns.md): **Read before writing ANY content.** If the player can see it, it must follow every pattern established in earlier levels.
- [implementation-rules.md](../audit-level/implementation-rules.md): Pre-flight checklist and bug table. Read before writing any animation frames, code previews, or connectors.
- [visualization-examples.md](visualization-examples.md): **Read before designing any visualization.** Case studies of failed visualizations (L34 Locking, L35 Active Storage, L36 Encryption, L37 Real-Time) and how they were fixed.
- [reference-implementations.md](reference-implementations.md): Canonical examples of good level design (L12 PipelineFlow, L10/L15/L26-L29 custom).
- [observe-phase-guide.md](observe-phase-guide.md): Type 2/3/4 deep dives, mechanism vs metric principles, flow animation patterns.
- [build-phase-guide.md](build-phase-guide.md): Code preview transition table, option quality, feedback consistency.
- [reward-phase-guide.md](reward-phase-guide.md): StressTestPanel, reward animation rules, interactivity requirements.
- [pipelineflow-guide.md](../audit-level/pipelineflow-guide.md): Hub-and-spoke layout, node state rules, edge animation.
- [terminal-layout-guide.md](../audit-level/terminal-layout-guide.md): Terminal sizing patterns (A/B/C).
- [cross-phase-consistency.md](../audit-level/cross-phase-consistency.md): Visual language consistency rules.

---

## Step 0: Read Before You Write (Non-Negotiable)

Before designing anything:

1. **Open [design-checklist.md](design-checklist.md) and fill it out as you go.** This is a fill-in worksheet, not a reference. Every section requires written output. Do not proceed to the next section until the current one is complete. Do not do any section "in your head." The checklist is the primary defense against every mistake documented in this skill.
2. **Read [cumulative-patterns.md](../audit-level/cumulative-patterns.md).** If the player can see it, it must follow every pattern established in earlier levels. No exceptions. This applies to everything: code previews, option card snippets, visualization data, JSON responses, animation labels, banners, probe response lines. Not just code preview panels.
3. **Read [visualization-examples.md](visualization-examples.md).** Learn from past failures before repeating them.
4. **Read [implementation-rules.md](../audit-level/implementation-rules.md).** The bug table lists mistakes that have already been made. Don't add to it.
5. **Read the spec for this level** in `docs/spec.md`. Understand the concept, scenario, and what the player should learn.
6. **Read adjacent levels (N-2 to N+2).** Your visualization must be visually distinct from neighbors.
7. **Follow bulletproof-react project structure.** Any new feature goes in `src/features/<name>/` with `components/`, `utils/`, `hooks/`, `types/` subdirectories. No files at the feature root (except non-barrel re-exports). No cross-feature imports. No code duplication (use lazy evaluation to reference existing functions instead of copying strings).

## Step 0.4: Anchor to the myapp project (NON-NEGOTIABLE)

The curriculum is anchored to a real Rails app at `project/myapp/` (gitignored). Each level corresponds to a tagged commit (`level-N`) representing the actual on-disk state after that level's commands and edits run against Rails 8 + PostgreSQL. Before designing any code preview, generator command, response line, or build-step diff:

1. Check out (or `git show`) the **previous level's tag** in myapp to see the actual "before" state your level builds on:
   ```bash
   cd project/myapp && git show level-12:app/controllers/api/products_controller.rb
   ```
2. If the level introduces a new gem, generator, or migration, **run the real command in myapp** at the prior level's tag and capture the actual stdout / file diffs. Mirror those into the level definition — never invent the output from memory.
3. The level's "after" state must match what `git show level-N:<path>` produces (or will produce, once you commit the new myapp tag) for every file the level touches.
4. If myapp's level-N tag does not yet exist (e.g., you are designing a brand-new level), the order is: real Rails commands in myapp → tag the new commit → mirror the actual output into the level. Never the reverse.

The source of truth flows: official docs (Step 0.5) → real command in myapp (Step 0.4) → level data. Treat the level as a faithful simulation of the real project, never as a substitute for it.

**Case study (L13 Strong Params, 2026-05-09):** The L13 redesign in `src/` was committed before myapp's commit chain was rewritten. For about a day, src/ taught `params.expect(product: [:name, :description, :price])` while myapp's `level-13` tag still had the older `params.require(:product).permit(...)` pattern. Anchoring to the myapp tag during design would have surfaced the mismatch immediately and forced the myapp re-tag (the form-axis precursor `to_unsafe_h` at L7-L12, plus the new featured migration + params.expect at L13) to land at the same time as the curriculum changes.

## Step 0.5: Lock the Canonical Purpose (form-axis levels only)

For form-axis levels (those replacing an existing pattern's form — see `.agents/rules/pedagogy.md` § Cumulative patterns for the existence-vs-form category check), execute these steps BEFORE any visualization, probe, or build-step design:

1. **WebFetch the canonical docs** for the pattern this level teaches. Cached knowledge is not allowed; the canonical docs are authoritative.
2. **Quote the sentence(s)** that explain what bug class the pattern exists to fix.
3. **Confirm the planned before-state exhibits that bug class.** If it does not, redesign the before-state OR redesign the level's purpose — do not proceed with a sterile lesson.
4. **Probes derive from the bug class**, not from the pattern's API surface.

If you cannot articulate (1)–(3) in writing with a docs citation, do not proceed to visualization design. The level's pedagogical purpose must be locked before its mechanics.

**Existence-axis levels skip Step 0.5.** A level introducing a feature that did not exist (e.g., L9 authentication, L14 testing) has no before-state form to evaluate; design proceeds to Step 1 directly.

**Case study (L13 Strong Params, 2026-05-06):** Three iterations of L13 visualization, probe set, and build steps were designed before anyone WebFetched the [Rails Action Controller guide](https://guides.rubyonrails.org/action_controller_overview.html). Iteration 1 taught "ergonomics" (DRY centralization). Iteration 2 taught "shape attacks" (400 vs 422). Both missed the canonical purpose (mass-assignment protection) because Step 0.5 never ran. After the WebFetch surfaced the canonical framing, the design corrected to: before-state uses `to_unsafe_h` per [ActionController::Parameters docs](https://api.rubyonrails.org/classes/ActionController/Parameters.html); probes fire mass-assignment payloads (`role=admin`); build introduces `params.expect` to whitelist.

## Step 1: Narrative Reasoning (Story First)

Before any visual design, answer these five questions. **Write the answers down explicitly in your response, not just in your head.** Do not proceed to Step 2 until all five are answered in writing. This is the single most effective defense against narrative and visualization bugs.

**Mandatory output for Question 1:** Write the actor table (see below). This table is referenced in Step 3 to verify every actor has a node. If you skip it, you will forget actors and the visualization will collapse distinct entities into one node.

### 1. What is the problem? Who are the actors?

State the problem in one sentence. Not the Rails concept, but the concrete problem in the player's app.

- Good: "50,000 users polling every 2 seconds creates 25K wasted requests/sec and 95% CPU."
- Bad: "The app needs Action Cable."

**Then write the actor table.** List every entity that initiates, processes, or receives something in this level's story. This is mandatory output, not optional reasoning. The table is cross-referenced in Step 3 to verify every actor has a node.

```
| Actor | Role | Appears in which probes? |
|-------|------|--------------------------|
| Customer | Initiates payment | All |
| Rails App | Processes webhook | All |
| Stripe | Sends legitimate callbacks | Probes 2, 3 |
| Attacker | Sends forged callbacks | Probe 1 |
| Database | Stores credits/events | All |
```

**If two actors use the same communication channel but have different identities or motivations, they are separate actors and need separate nodes.** Stripe sending a legitimate callback and an attacker sending a forged POST are different actors even though both hit the same endpoint. Collapsing them into one node makes it impossible for the player to see where the forged event comes from.

Case study (collapsed actors): L39 originally had 4 nodes with Stripe doubling as the Attacker (same node, different label). When the forged-webhook probe fired, the "Stripe" node changed its icon to a shield and label to "Attacker." This was confusing: Is Stripe the attacker? Where is Stripe during the attack? The fix: add a dedicated Attacker node, separate from Stripe.

Case study (missing actor): L39 also omitted the Customer node entirely. The "duplicate event" probe showed Stripe sending a webhook, but never showed WHY Stripe was sending it (customer paid for something). The animation started mid-flow, leaving the player to imagine the triggering action. If the actor is invisible, the causal chain is broken. The fix: add a Customer node showing "Pays $50 for order" with dots flowing Customer -> App -> Stripe before the webhook callback flows back. Every causal chain in the animation must start from its origin, not from the middle.

### 2. Would the player even know what this concept is?

**This is the most commonly missed question.** Before designing anything, ask: has the player been introduced to this concept? Would they understand the level's premise?

Trace the concept back through earlier levels. If L38 taught outbound Stripe API calls, L39 cannot assume the player understands inbound Stripe webhooks. Those are fundamentally different concepts. The level must bridge the gap.

**Check for these foundation gaps:**
- **Concept never introduced.** If the level says "webhook fires twice" but no earlier level explained what a webhook is, the player is confused before the first probe.
- **"How did this get here?" gap.** If the observe code shows a webhook controller, when did the player build it? If the answer is "it was assumed to exist," the level has a gap.
- **New external system without context.** If a level introduces a new direction of communication (outbound -> inbound), a new service (S3, Redis, CDN), or a new pattern (pub/sub, event sourcing), the level must explain what it is and why the app needs it before showing what goes wrong with it.

**How to bridge gaps:** The observe phase scenario text, probe stories, and initial animation sequence must establish the concept's purpose before revealing vulnerabilities. Show the happy path first ("this is how webhooks work and why we need them"), then show what breaks ("but here's what happens when the same event arrives twice").

### 3. How did the player get here?

Think about what the app looks like after N levels of building. What features exist? What would the "before" code realistically look like? Would the player have used the naive approach, a partial approach, or no implementation at all?

**Narrative-state coherence (the "no time travel" rule).** The trigger description, scenario text, and probe stories must be coherent with where the curriculum is at this level. Never narrate from a future state — if the trigger or story uses a trope that requires the app to be in production with users / payments / monitoring / audit relationships, and we haven't built that yet, the level is time-traveling. Fix the framing, not the lesson.

For the forbidden-tropes table (pre-deploy, no users, no payments, no production data, no API versioning) and the L10 case study (`"GDPR audit flagged"` -> `"Pre-launch security review"`), see [../audit-level/narrative-state-coherence.md](../audit-level/narrative-state-coherence.md). Apply this check to every player-visible string at design time so the bad framing never lands.

### 4. What does the "before" state look like?

The observe phase visualization must only show components that exist in the "before" state. If WebSocket isn't configured yet, don't show a WebSocket lane. If S3 isn't installed, don't show an S3 zone.

### 5. What does the "after" state look like?

The reward phase shows the same visualization with the solution working. The contrast between "before" and "after" IS the reward.

---

## Step 2: Choose the Visualization Type

There are exactly four types. Every level falls into one.

| Type | When | Discovery gating? |
|------|------|-------------------|
| **1. No observe** | Pure setup, no problem to show | No |
| **2. Static intro** | Code-structure problem visible by reading code | No |
| **3. Custom visualization** | Concept has a unique spatial/flow metaphor | Yes |
| **4. PipelineFlow** | Something missing/broken in the MVC pipeline | Yes |

**Decision flowchart:**
1. Is there a problem to discover? No -> Type 1
2. Is it purely a code-structure issue? Yes -> Type 2
3. Does it have a unique spatial metaphor? Yes -> Type 3
4. Is it about the request lifecycle? Yes -> Type 4

**Write one sentence:** "What runtime behavior does this level need to animate?" If the answer is "none," it's Type 2.

See [observe-phase-guide.md](observe-phase-guide.md) for detailed type selection guidance.

---

## Step 3: Design the Visualization (Types 3 and 4)

Step 3 is the densest part of design — actor-to-node mapping, the zero-knowledge test, 15 numbered design principles (mechanism not metric, every actor gets a node, show duality, no blank nodes, animations match the story, edge labels not behind nodes, animation speed scales with complexity, etc.), the literal screen test, every-probe-tells-a-story rule, info-story field, probe ordering, designing probes and reward scenarios as pairs (non-negotiable), probe differentiation.

It lives in [step-3-visualization-design.md](step-3-visualization-design.md) — open that file when designing or reviewing a Type 3 / Type 4 visualization. Most of the case studies (L37 polling, L38 timeout middleware) are there too.

**Critical reminders that should ride with every visualization design:**

- Every actor identified in Step 1 gets its own node (no collapsing).
- Show the mechanism, not just the metric (numbers need context).
- Every probe tells a user story (who, what, why, what goes wrong).
- Design probes and reward scenarios as PAIRS, not in separate passes — separating them is how reward scenarios become feature demos instead of story continuations.

---

## Step 4: Design the Build Steps

### Pre-Flight

Read [build-phase-guide.md](build-phase-guide.md) for detailed rules.

### Step Progression

For gem-based features, follow this order:
1. Install gem (`bundle add`) - TerminalChoiceStep
2. Run installer/generator - TerminalChoiceStep
3. Configure - OptionCard (3 options)
4. Customize generated code - OptionCard (3 options)
5. Wire into application - OptionCard (3 options)

### Code Preview Transition Table (Non-Negotiable)

Before writing `getCodeFiles`, build this table:

| completedStep | Player just did | Preview shows | Leaks next step? |
|---|---|---|---|
| -1 | Nothing | "Before" code | No |
| 0 | Step 0 | Result of step 0 | Check |
| 1 | Step 1 | Result of steps 0-1 | Check |

For each row:
1. Does the preview contain the NEXT step's correct answer?
2. Does the filename reveal the answer?
3. If the step didn't modify code files, does the preview stay unchanged?

### Option Quality Rules

- **Exactly 3 options per OptionCard step.** Two is a coin flip.
- **Shuffle all option arrays with `shuffleOptions(options, stepIndex)` from `@/lib/shuffleOptions`.** This randomizes answer positions per session while ensuring the correct answer is never first. Do NOT hand-position correct answers at index 2 or 3: hand-positioned answers create predictable patterns across steps. Always use `shuffleOptions` in a `useMemo` keyed to the step index. This applies to both OptionCard arrays and terminal command arrays.
- **Comments describe mechanism, not consequences.** "Same plaintext produces same ciphertext" not "Allows: find_by, uniqueness."
- **Feedback never contradicts earlier steps.** If deterministic was correct in step 2, step 3 can't say "deterministic is less secure." Frame as tradeoff.
- **Feedback never reveals the answer.**

### ErrorFeedback Rules

- Positioned ABOVE the options, not below
- No auto-dismiss (stays until player picks another option or gets it right)
- Cleared on step advance

### "Next Step" Button

Same across all step types: `<Button className="gap-2" size="sm">Next Step <ArrowRight /></Button>`. Default variant. Last step's button goes to reward phase.

---

## Step 5: Design the Reward Phase

### No Activate Phase

Build transitions directly to reward. The last build step's "Next Step" button goes to reward. No star rating, no "Visualize ___" interstitial.

### Reward Type Matches Observe Type

- Type 2 (static intro) -> Static before/after comparison. No StressTestPanel.
- Types 3/4 (interactive observe) -> Interactive reward with StressTestPanel.

### Reward Scenarios Replay Observe Probes with the Fix Applied (Non-Negotiable)

**This is one of the biggest requirements in level design.** The reward phase is NOT a feature demo. It replays the SAME story the player saw in the observe phase, but with the solution working. Same flow, same actors, same sequence of events, different ending.

For each observe probe, the matching reward scenario must:
1. **Start the same way.** If the observe probe began with "Client sends POST /payments to Server," the reward scenario begins with the same request.
2. **Follow the same path.** If the observe flow went Client -> Server -> Stripe -> Server, the reward flow goes through the same nodes.
3. **Diverge only where the fix changes the outcome.** The moment where the observe probe showed the problem (notification stuck, 2s delay, CPU spike) is the moment where the reward shows the fix (instant push, 0 polling, CPU 3%).

**Why this matters:** The player discovered specific problems by watching specific flows. If the reward shows a completely different flow, the player never sees their discovered problems resolved. They learned "polling wastes 99% of requests" but the reward shows "here's a push notification arriving" -- that's a different story, not a resolution.

**How to design:** For each observe probe, copy its frame sequence and annotate where the fix changes the outcome:

```
Observe probe: POST create payment
  Frame 1: Client -> Server: POST /payments          (SAME in reward)
  Frame 2: Server -> Stripe: Charge $99.99            (SAME in reward)
  Frame 3: Server -> Client: 202 Accepted             (SAME in reward)
  Frame 4: Client: Waiting for confirmation...         (SAME in reward)
  Frame 5: Stripe -> Server: Payment succeeded         (SAME in reward)
  Frame 6: Notification STUCK, clock starts            (DIFFERENT: Server PUSHES instantly)
  Frame 7-10: Clock ticks 0s -> 2s                     (DIFFERENT: Client receives in <15ms)
  Frame 11: Poll finally picks it up                   (DIFFERENT: No poll needed)
```

The reward scenario has the same first 5 frames and changes only frames 6+. The player sees: "Oh, the flow is the same up until the fix -- and THAT's where WebSocket makes the difference."

Case study: L37's original reward had scenarios like "New message (push)" and "Activity update (push)" that showed Action Cable features but never replayed the observe flows. The player discovered "payment stuck for 2s" but the reward showed a generic push notification. The fix: replay the exact payment flow (Client -> Server -> Stripe -> Server -> PUSH to Client) with only the ending changed.

**Wrong approach:** List what the feature can do and create a scenario for each capability.
**Right approach:** Copy each observe probe's flow and change only the frames where the fix applies.

Additional reward-only scenarios (for concepts taught in the build phase but not shown in observe) are allowed, but they come AFTER the probe-resolving scenarios.

### StressTestPanel

See [reward-phase-guide.md](reward-phase-guide.md) for detailed rules.

- Every observe probe must have a matching reward scenario that replays its flow
- Reward-only scenarios must be justified by build steps
- Button labels should mirror observe probe labels (e.g., "POST create payment" -> "POST create payment (with push)")
- All scenarios must have `responseLines`

### Reward Animations Must Match Built Code

Read the final code preview and cross-reference every animation. If the code defines cached behavior, show the cached case. Validation labels must trace to the correct class and method.

---

## Step 6: Verify with audit-level

After designing and implementing, run `audit-level` to verify compliance with all structural checks, cumulative patterns, CSS/color contrast, state machine, and cross-phase consistency.

---

## Design Checklist (Quick Reference)

### Before writing any code
- [ ] Read cumulative-patterns.md
- [ ] Read visualization-examples.md
- [ ] Read the spec for this level
- [ ] Read adjacent levels (N-2 to N+2) for visual uniqueness
- [ ] Answer the 5 narrative reasoning questions in writing
- [ ] **Question 2 (concept foundation) explicitly verified**: Would the player know what this concept is? Has it been introduced in a prior level? If not, the observe phase must introduce it before showing problems.
- [ ] Choose the visualization type with one-sentence justification

### Left panel consistency
- [ ] **"Scenario" heading is present** in the observe phase left panel: `<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>` before scenario text paragraphs. Non-negotiable for all three-phase levels.

### Observe phase design (probes and reward scenarios designed together as pairs)
- [ ] **Each probe is designed alongside its matching reward scenario as a pair before moving to the next probe**
- [ ] Zero-knowledge test passes
- [ ] Literal screen test passes (describe what the player SEES, not what the code does)
- [ ] Every probe tells a user story (who, what, why, what goes wrong) -- not abstract API calls
- [ ] Every probe and scenario has a `story: string[]` field with 3-6 bullet points for the info modal
- [ ] Probe labels, edge labels, and node text reflect the story ("Check order status" not "GET notifications")
- [ ] Probes and scenarios ordered logically (first probe introduces key visual elements and sets context for the rest)
- [ ] Each probe produces a different visual result (written out per probe)
- [ ] Visualization shows mechanism, not metric
- [ ] Duality shown simultaneously if the concept is about contrast
- [ ] "Why should I care?" is visually obvious for every element (show cost alongside outcome, not just outcome)
- [ ] Request-response animations have distinct phases with different labels and dot directions
- [ ] Every animation frame has `reverse` set correctly for its data flow direction (request = Client→Server = false, response = Server→Client = true)
- [ ] `runAnimation` automatically stops all edge dots after the last frame (safety net). Do this in the implementation: after scheduling all frames, schedule a cleanup that sets `active: false` on every edge. This prevents dots from looping even if individual frame arrays forget. Individual frames should still set `active: false` where narratively appropriate (e.g., "connection dropped"), but the automatic cleanup catches anything missed.
- [ ] Every metric (CPU, latency, queue) traces back to its visible cause
- [ ] Visual scale matches claimed scale (if it says "50K users," explain the single connection)
- [ ] No node is ever blank during an animation (every node shows its current state in every frame)
- [ ] Animation frames match the story bullet-for-bullet (read story and frames side by side, every story beat has a frame, every frame has a story beat)
- [ ] Time gaps in the story are visible in the animation (if an order takes time to ship, show "Warehouse processing..." frames, don't skip from order placed to customer refreshing)
- [ ] All nodes at the same visual level are the same kind of thing (all pipeline stages, or all systems, or all actors). If a node is a different category from its peers (e.g., middleware among systems), show it as a sub-element inside its parent node instead.
- [ ] Every actor identified in narrative reasoning (Step 1) has its own node. If the story involves a customer, a server, and an external API, that's 3 nodes.
- [ ] Edge labels never hidden behind nodes. Write out every edge label, find the longest, verify the gap between connected nodes is wider than that label. For 4+ node layouts, shorten labels (abbreviations, move details into nodes) rather than shrinking nodes.
- [ ] Animation speed scaled to visual complexity: 1x for 2 nodes/1 edge, 1.5x for 3 nodes/2 edges, 2x for 4+ nodes. Playtest: fire each probe and try to read every label before the next frame.

### Build phase design
- [ ] Code preview transition table built and verified
- [ ] 3 options per OptionCard step
- [ ] Comments describe mechanism, not consequences
- [ ] Feedback doesn't contradict earlier steps
- [ ] ErrorFeedback above options, no auto-dismiss

### Component structure (non-negotiable)
- [ ] **`LevelHeader` inside `CenterPanel`.** Every level MUST include `<LevelHeader>` as the first child of `<CenterPanel>`. Custom level components are rendered without any wrapper, so the header is the level's responsibility. Without it, the level has no title bar, no Submit button, and no Reset button. Use: `<CenterPanel><LevelHeader actNumber={N} levelName="..." levelNumber={NN} onComplete={handleComplete} onReset={handleReset} onValidate={handleValidate} />{renderCenterPanel()}</CenterPanel>`.
- [ ] `onValidate` returns `{ valid: true, message }` only when the player is in the reward phase and has fired 3+ stress test scenarios
- [ ] `onComplete` calls `onComplete?.({ stars: stepper.starRating })`
- [ ] `onReset` resets phase to observe, clears animation state, resets stressTest

### Reward phase design (already designed as pairs above, verify here)
- [ ] No activate phase
- [ ] Same visualization, different state (red -> green)
- [ ] Every probe has a matching reward scenario (designed as a pair in observe phase, not separately)
- [ ] Each reward scenario's story starts with "Same [person] doing [same thing]..." (if it doesn't, it's a feature demo, not a story continuation)
- [ ] Reward scenario labels mirror observe probe labels (e.g., "POST create payment" -> "POST create payment (with timeout)")
- [ ] Each pair has a "Diverges at" annotation showing exactly which frame changes
- [ ] Each scenario produces a different visual result
- [ ] Animations match the built code

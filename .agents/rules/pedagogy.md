---
paths:
  - "**/Level*.tsx"
  - "**/content.ts"
  - "**/data/*.ts"
---

# Three-Phase Pedagogy

This rule auto-loads when you touch any level file. It is the in-context reminder for the most-violated rules from the `design-level` and `audit-level` skills, plus the lessons earned by shipping bugs in past levels. The skills are the deep reference; this file is what you must cross-check against during implementation.

The skills:
- `.agents/skills/audit-level/SKILL.md` (and supporting files in the same directory)
- `.agents/skills/design-level/SKILL.md` (and supporting files in the same directory)

The audit-level skill in particular has a "Gate Check: Does the Observe Phase Teach the Concept?" section that you should re-read whenever you touch an observe phase.

---

## Before you design (pre-flight)

Three non-negotiable foundations. If you skip any of them, every downstream rule in this file is ungrounded.

### 1. Narrative reasoning, written down

Before designing any visualization, answer these in writing -- in your response or in a scratch comment, not in your head:

- **What is the problem this level presents?** One concrete sentence about the player's app, not the Rails concept. ("50K users polling every 2s creates a flood that breaks the server" -- not "the app needs Action Cable.")
- **Would the player even know what this concept is?** (concept foundation check). Trace back through earlier levels. If L39 says "Stripe webhook fires twice" but no earlier level explained webhooks, the level has a foundation gap and must introduce the concept before showing problems with it.
- **How did the player get into this situation?** (act context). What features exist after the previous N levels? What would the "before" code realistically look like?
- **What does the "before" state look like?** This is the observe topology.
- **What does the "after" state look like?** This is the reward topology.

Then produce the **actor table** -- mandatory output, not optional reasoning:

```
| Actor    | Role                       | Appears in which probes? |
|----------|----------------------------|--------------------------|
| Customer | Initiates payment          | All                      |
| Stripe   | Sends legitimate callbacks | Probes 2, 3              |
| Attacker | Sends forged callbacks     | Probe 1                  |
| Database | Stores credits/events      | All                      |
```

Two actors with different identities or motivations are different actors, even if they share a channel. Stripe sending a real webhook and an Attacker sending a forged one are separate actors and need separate nodes. Collapsing them into one node destroys the player's ability to see where actions originate.

### 2. Visualization type

Pick one of four. The decision drives the rest of the design:

- **Type 1: no observe phase** (pure setup like `rails new`).
- **Type 2: static intro** (code-structure problem visible by reading code, no runtime behaviour to simulate). No discovery gating.
- **Type 3: custom visualization** (concept has a unique spatial/flow metaphor that needs a bespoke layout). Discovery gating required.
- **Type 4: PipelineFlow** (request lifecycle: a stage is missing/broken in the MVC pipeline). Discovery gating required.

If the answer to "what runtime behaviour does this level need to animate?" is "none," it is Type 2.

Discovery gating belongs ONLY to Types 3 and 4. Do not add `useDiscoveryGating` / `ProbeTerminal` / `DiscoveryChecklist` to Type 1 or Type 2 levels.

### 3. Cumulative patterns: existence vs form

Read `.agents/skills/audit-level/cumulative-patterns.md` before writing any player-visible text. Cumulative-patterns operates on TWO orthogonal axes; collapsing them produces sterile or contradictory levels.

- **Existence (monotonically additive).** Features only exist after the level that introduces them. Pre-L9 has no auth machinery (no `Current.user`, no session, no `before_action`). Pre-L14 has no test files. No pre-emptive existence; earlier levels do not reference a feature that has not been built.
- **Form (per-feature, replaceable).** Features that DO exist by level N may take a naive/inferior shape until a later level reveals it as wrong and replaces it. The naive shape IS the cumulative-pattern carried forward — and it must satisfy two constraints: (a) it must NOT pre-bake the new shape's API (earned-abstraction), and (b) it must EXHIBIT whatever problem the new shape fixes (lesson-survival). Either fails and the introducing level has nothing to teach.

**Category check before designing or auditing any level:** is this level introducing a feature that did not exist (existence-axis), or replacing the form of an existing feature (form-axis)?

| Category | Pre-state | Earlier-level requirement |
|----------|-----------|---------------------------|
| **Introducing** | Feature absent. | Earlier levels do not reference the feature. |
| **Replacing** | Feature exists in inferior form. | Earlier levels carry the inferior form. It must exhibit the problem the new form fixes AND must not expose the new form's API. |

Examples — Introducing-axis: L1–L6 (Rails install, model, migration, routing, controller), L9 (auth), L14 (testing). Replacing-axis: L7 (serializers replaces inline `render json:`), L11 (authorization replaces unscoped finds), L13 (strong params replaces `to_unsafe_h` mass assignment), L16+ (services), L18+ (Dry::Validation), L19+ (query objects), L48 (API versioning replaces unversioned `/api/`).

**The carry-forward rule (form-axis).** Once a replacing-axis level lands, the new form carries forward. Showing inline `render json:` at L40 contradicts what the player learned at L7. The grep recipe in `cumulative-patterns.md` scans for these regressions.

**The earned-abstraction rule (form-axis).** Earlier levels use the inferior form, not the new form. Pre-L13 controllers use `to_unsafe_h`, not `permit`/`expect`. Pre-L48 paths use `/api/products`, not `/v1/`. Five surfaces to check (structural infrastructure, architectural patterns, concrete API references, test echo, reuse-context examples) — see `cumulative-patterns.md` § "Common shapes of this bug" with 5 worked case studies.

**The lesson-survival rule (form-axis).** Before designing, write down the canonical bug class the new form fixes (cite docs). Then verify the inferior form exhibits that bug. If the inferior form is safe-by-construction, the lesson dies. Strong params is the worked case: explicit-field extraction is mass-assignment-safe by construction; `to_unsafe_h` is the actually-vulnerable form per the [Rails ActionController::Parameters docs](https://api.rubyonrails.org/classes/ActionController/Parameters.html). The earlier-level form must be `to_unsafe_h`-style for L13's security lesson to survive.

Together: at level N, every existing feature is in its naive form; no future API is pre-baked; nothing absent is referenced.

**Case study (this conversation, 2026-05-06):** L13 redesign cycled through three failure modes:
1. Pre-baked `params.require/permit` at L7 — earned-abstraction violation (form-axis: pre-baked future API).
2. Stripped to explicit-field extraction at L7–L12 — earned-abstraction satisfied but lesson-survival failed (form is mass-assignment-safe by construction; the bug L13 fixes does not exist in the before-state).
3. Initial fix proposal scoped `to_unsafe_h` to L13's before-state only — would have created a localized regression from L7–L12's safe pattern. The inferior form must live THROUGHOUT the earlier levels, not be parachuted in at the introducing level. A separate fourth misstep overgeneralized "every concept has a naive precursor" — false. Authentication (L9) is existence-axis with no precursor. The right framing is per-level category check; only form-axis levels have precursors.

The corrected landing: pre-L13 controllers use `to_unsafe_h`-style mass assignment per [ActionController::Parameters docs](https://api.rubyonrails.org/classes/ActionController/Parameters.html); L13 reveals it and replaces with `params.expect`. Both axes satisfied; lesson survives.

---

## Observe phase rules

### Terminals dock at the bottom of the center panel (NON-NEGOTIABLE)

In every level, every terminal component (`ProbeTerminal`, `StressTestPanel`, `SimulatedTerminal` / `TerminalChoiceStep`) renders **at the bottom of the center panel**, below the visualization. Never above. Never beside. Never floating in the middle.

The canonical center-panel column layout: `LevelHeader` → visualization (`flex-1 min-h-0 overflow-hidden`) → terminal (docked at the bottom, fixed natural height with `pb-4` breathing room). Three sub-rules:

1. **Terminal docked at the bottom**, never above or beside.
2. **Bottom gap** — `pb-4` is canonical; `pb-2` reads as "bumping the edge."
3. **Visualization fills the full available height** between the level header and the terminal. `flex-1 min-h-0` on the outer wrapper is necessary but not sufficient — the inner content (grid, list, card stack) must also `flex-1 min-h-0`, and individual items inside must `h-full` (grid cell) or `flex-1` (flex item) so they grow to fill. Otherwise a void appears above the terminal. `PipelineFlow` and `QueryZoneFlow` get this for free; custom Type 3 visualizations have to wire it up explicitly.

The visualization is the knob to turn when the page envelope is too tight — compact the visualization, don't move the terminal. See `.agents/skills/audit-level/terminal-layout-guide.md` for the full rule, the canonical stretch recipe, and the L14 case study.

### Show the damage, then introduce the fix

Every level's observe phase must answer one question: **what bad thing happens to the player's app or to its customers if this level's concept is missing?** The answer is shown concretely, in customer-visible terms, before the build phase introduces the mechanism that prevents it.

Abstract status icons (`?` / `✓` / `✗`), tool nodes ("Editor", "Test Runner", "CI"), and artifact previews (a spec file, a config file, a migration) do NOT pass this rule on their own — none of them stake the player. The player must SEE the damage:

- a wrong price on the homepage (a customer ordered 1,000 units of a $0.01 product)
- a victim's product showing up under an attacker's account
- plaintext credentials in a database dump leaked via a backup
- a customer logged out at 2am because a column rename took the auth flow down
- a spam product pinned `FEATURED` on the homepage above legit listings
- a 500 error in an order flow, repeated for hours before anyone notices

**Worked examples already in the curriculum.**
- L11 (Authorization): User A's `DELETE /api/products/:id` removes User B's product. The visualization shows the deletion. The player wants to stop it.
- L13 (Strong Params): an authenticated user includes `featured: true` in a POST body; their product appears on the homepage `FEATURED` above legit listings. The player wants to stop it.
- L10 (Encryption): an attacker dumps the DB and reads every email / phone / address in plaintext. The player wants to stop it.

None of these levels lead with the mechanism (Pundit, `params.expect`, `encrypts`). They lead with the damage. The build phase introduces the mechanism that stops it.

**The smell test.** When sketching a level's observe phase, ask: *would a player who sees this be motivated to do the build phase?* If the player's reaction would be "neat artifact, I guess?" — redesign. If the reaction is "this is bad, I have to fix this" — proceed. The probe-by-probe playthrough is downstream of this question; if the headline visualization shows a tool, an artifact, or a status grid, no amount of probe polish will rescue it.

**Case study (L14 Testing redesigns, 2026-05-09).** Three sequential failures all answered the wrong question: a CI/CD pipeline (pre-baked deployment), Editor + Test Runner nodes (taught dev tools), and Behavior Coverage cards with `?` / `✓` / `✗` icons (abstract). A fourth attempt — a spec file artifact + rspec terminal — was on the artifact path again. Each iteration polished the wrong answer. The right design shows a customer-facing dashboard (homepage / account / login) and renders the real damage when a probe fires (spam product `FEATURED`, a stranger's `DELETE` taking out the player's listing, a 500 error on every login). With automated checks (post-L14), the same regression never reaches the dashboard — the rspec terminal catches it locally in 0.3s and the dashboard stays clean. The contrast is the lesson; the spec file is just the mechanism that produces the contrast.

### Probes are problems

Every probe represents a distinct failure mode in the before-state that the build phase resolves. No happy paths. No "here's how it works correctly already." No hypotheticals.

Three probe failure modes that invalidate a probe set:

- **Happy-path probe**: shows the system working correctly in the before-state. There is no contrast probe — the reward phase IS the contrast.
- **Hypothetical probe**: a label that asks the player to imagine a change rather than fire a concrete action ("Inspect the controller", "Imagine adding user_id to the list"). Probes are verb-led actions, not inspections.
- **Convergent probes**: two or more probes exhibiting the same failure mode and resolving identically. Each probe must teach a distinct aspect of the problem.

**Case study (L13 Strong Params probe iterations, 2026-05-06):**
- Iteration 1 (`duplicate-field-list`, `inject-user-id-via-edit`, `malformed-shape`): `inject-user-id` was hypothetical ("imagine adding user_id"). Fail.
- Iteration 2 (`extra keys → 201`, `malformed shape → 422`, `valid body → 201`): probes 1 and 3 showed the system working correctly. Fail (happy paths).
- Iteration 3 (three distinct mass-assignment exploits, all causing privilege escalation in the before-state, all resolved by `params.expect`): correct.

The wrong instinct each time: include a "happy path" probe to "show the contrast." There is no contrast probe inside the observe phase; the reward phase IS the contrast.

### Show only what currently exists

The audit-level skill states this explicitly: **"the observe phase visualization must only show components that exist in the 'before' state."** It is the most-violated rule in level pedagogy because pre-showing the missing thing as a placeholder feels helpful. It is not. It is misleading.

The three-phase loop is:
1. **Observe**: show the system as it currently exists, with the pain points that result from the absence of [the thing the level teaches]. The thing is NOT shown anywhere in the visualization.
2. **Build**: the player builds the thing.
3. **Reward**: the system now has the thing; show how the previously-painful actions are now easy.

How to communicate the absence: probes simulate actions that WOULD work if the thing existed. The probe's response and the existing nodes' state show the pain point that results from its absence. (See "Every probe needs an animated dimension" below.)

The reward phase introduces the new nodes/edges that the build phase produced. Observe and reward can have different topologies -- in fact, they should, because the build added something. Shared nodes keep stable positions; new nodes appear in new positions.

### The hard gate (do this before declaring done)

For every probe, write down -- in actual words -- what the player **literally sees** in the **center panel** at the moment the probe fires. If your honest answer is any of:

- "the probe terminal shows response lines"
- "the discovery checklist updates in the left panel"
- "stage badges and sublabels change but the rest of the visual is static"
- "nothing visible changes; the player reads the response and infers"

…the level is broken. Stop. Redesign before shipping.

A passing answer looks like:

- "the AppServer pulses red (`variant: 'critical'`), gains a `NO KILL SWITCH` badge, and the edges client → app-server → new-processor animate with red dots in a single-pass burst. The NewPaymentProcessor's sublabel changes to `vendor 5xx, all customer charges failing`, its variant escalates to `critical`, and a `TIMEOUT` badge appears."

Audit-level formalises this as the "Probe-by-probe playthrough." That step is **mandatory during implementation**, not a post-hoc audit step.

### Visual richness requirements

A probe's visible change is not just text. The visualization needs **multiple animated layers**, not one:

- **Whole-card animation** on the most-affected node. PipelineFlow's `variant: 'critical'` triggers `animate-pulse` on the entire card with a red-tinted background, plus an `animate-ping` ripple in the header dot. Use this for the headline broken thing, not just `'danger'` (which only changes border colour).
- **Edge dot animation.** Connections accept `dots: 'mixed' | 'clean' | 'danger'` or a custom `PipelineDot[]` array. **An edge with no `dots:` prop never animates, regardless of `activeConnections`.** Set `dots:` on every connection that should ever show motion.
- **Pulsing badges.** PipelineFlow already pulses badge text by default. Use short, urgent badges (`FAIL`, `TIMEOUT`, `MISSING`, `KILL`) -- not full sentences.
- **Per-probe single-pass bursts.** `activeConnections=['edge-id', ...]` puts those edges into single-pass mode (`repeatCount: '1'`), producing a sharp burst.

Stage variants you actually have available:

| variant | border | bg | header dot | full-card animation |
|---------|--------|-----|------------|---------------------|
| `default` | `border-border` | none | none | none |
| `active` | `border-success` | none | green, `animate-pulse` | none |
| `danger` | `border-destructive` | none | red, `animate-pulse` | none |
| `critical` | `border-destructive` | `bg-destructive/10` | red, `animate-ping` | `animate-pulse` on the whole card |
| `inactive` | `border-border` | none | none | `opacity-60` (faded) |

If the level's broken state is the headline of the act, use `'critical'` from the *base* state -- not just on probe fire.

### Mechanism not metric

The visualization must show WHAT the system is doing, not just a number. A CPU gauge at 95% is a metric. Requests flooding a server and queuing up is a mechanism. If your honest description is "a number changes" or "a status badge updates," redesign. Numbers need context: a "95% CPU" gauge with a label "25K req/sec from 50K users" beneath it traces back to the cause. The metric alone teaches nothing.

### No node is ever blank during animation

Every node must always show its current state in every frame. If the server is processing, label "Processing...". If it is waiting, "Awaiting response...". If the client is idle, "Waiting for shipment...". When a frame updates only one node, the others keep their previous labels via partial merge -- as long as those previous labels still make sense for the current moment.

### Animations match the story (frame-for-frame)

Every story bullet (the `story?: string[]` field on probes and scenarios) must have a corresponding animation frame, and every frame must have a corresponding story bullet. Read the story and the frame sequence side by side: gaps in either direction are bugs.

Time gaps in the story must be visible in the animation. If the story says "customer places an order, waits for it to ship, then keeps refreshing," the animation must show the time-pass beat (e.g., "Warehouse processing..."). Skipping from "order placed" to "customer refreshes" makes it look instant and misleads about why polling is needed.

### Show duality simultaneously

When the concept is a contrast (encrypted vs plaintext, polling vs push, cached vs uncached, on-deploy vs on-flag), show BOTH sides at once. Side-by-side comparison makes the contrast self-evident. A single view that toggles forces the player to remember.

### Nodes at the same visual level must be the same kind of thing

A `Controller` node and a `Serializer` node work as peers (both are pipeline stages). A `Client` and a `Server` node work as peers (both are systems). But an `App Server` and a `Timeout` node do NOT work as peers: one is a system, the other is configuration inside that system. Render middleware concepts (timeout, retry, circuit breaker) as sub-elements inside their parent node, not as separate peer nodes.

Quick test: write what each node IS in one sentence. If two sentences belong to different categories, the nodes should not look the same.

### Every probe drives a distinct visible state

The `design-level` skill's "Probe Differentiation" rule: each probe must produce a DIFFERENT visual result. If you fire three probes and the visualization looks identical for two of them, redesign. The `expectEveryProbeDrivesDistinctChange` test helper enforces this at CI time.

### Every probe needs an animated dimension

Even probes that aren't about a request flowing need to drive motion. If you find yourself writing `activeConnections: []` for a probe with the justification "this probe is about a process gap, not a request" -- stop. Ask: what action IS the player simulating? Marketing trying to flip a launch toggle is still a request that reaches the system; it just doesn't continue past the gate. Activate the *upstream* edges and stop where the missing thing actually breaks the chain.

If a probe genuinely has no activated edges, it must drive visible animation through other means: a different node escalating to `'critical'`, a badge appearing, a variant change.

### Probe action must match the request flow shown in the visualization

If the probe label describes one kind of action ("Marketing flips a toggle") but the visualization shows a different flow (the customer payment pipeline), the player gets confused. They expect the request to follow the action, and when it stops at an unexpected node or doesn't go anywhere meaningful, they assume the visualization is broken.

Two ways to make probe action and visualization agree:

1. **Reframe the probe as an action that uses the existing flow.** If the topology is the customer payment pipeline, the probe should be a customer action -- ideally an action whose CONSEQUENCE (success or failure) reveals the pain.
2. **Show the alternate flow explicitly.** If the probe genuinely simulates a different request type (e.g. an admin POST to a non-existent endpoint), make it visually obvious where that request stops and why -- not a quiet dead-end at AppServer with no explanation.

Pain does NOT have to mean a failed request. A request that **succeeds at the wrong time** is also pain: the customer pays, the charge goes through to the new processor, but Marketing has not announced the launch yet. The success itself is the pain. The visualization communicates this through node state (`LIVE EARLY` badge, "serving customers before announcement" sublabel) rather than a 500.

Worked example (L49 marketing-pin-time): the original probe was "Flip launch toggle at Tuesday 9:00am" with badge `DEPLOY != LAUNCH`. The action was an admin toggle attempt; the visualization showed the customer payment pipeline. The request stopped at AppServer with cryptic jargon. Confusing. The fix: reframe the probe as "Customer pays Monday 4pm (after deploy, before launch)." Same pain (timing mismatch), but the request now flows naturally through to NewProcessor with concrete `LIVE EARLY` framing. The visualization matches the action.

### Plain-English badges and sublabels

Audience-first (`.agents/rules/level-content.md`) requires that all player-visible text be readable by a first-time developer. Badges have very limited screen space, so the temptation is to compress to jargon (`DEPLOY != LAUNCH`, `MTTR 30m`, `429 RL`). Resist:

- Use short, urgent words: `FAIL`, `TIMEOUT`, `MISSING`, `KILL`, `LIVE EARLY`, `NO TOGGLE`.
- Avoid acronyms unless the level itself teaches them: `MTTR`, `SLA`, `MTBF`.
- Avoid mathematical/operator notation: `DEPLOY != LAUNCH` requires the player to parse `!=` and figure out what either side means.
- Sublabels can be longer (a short phrase) but must still be plain English: "feature live the moment code deploys" beats "deploy = release coupling."

If a badge is the wrong kind of token (jargon, acronym, operator notation), it does not communicate, no matter how short.

### Visual labels and terminal narrative tell the same story

Badges and sublabels are not decoration. They must spell out the SAME concrete consequence the terminal response and probe story describe. Vague intermediate-state words (`FAIL`, `BAD`, `BROKEN`) communicate that something is wrong but not WHAT or for HOW LONG. The visualization is the player's primary teaching surface; if the badge is vaguer than the terminal text, the visualization is underperforming.

Two checks:

1. **Read the terminal narrative aloud, then read the badges and sublabels.** They should agree on the specific harm: how many users affected, how long the pain lasts, what the operator can or cannot do, what the customer experiences.
2. **Replace any vague badge with the concrete consequence.** `FAIL` -> `3% FAIL`. `BROKEN` -> `STUCK 30 MIN`. `DOWN` -> `NO KILL SWITCH`.

```
BAD:  badge "FAIL" + sublabel "edge case"            (vague; what kind of fail? for whom?)
BAD:  badge "DEPLOY 30 MIN" + sublabel "..."         (timer-style, no consequence)
GOOD: badge "3% FAIL"
      + sublabel "edge case under peak load. customer charge returned 500."
GOOD: badge "STUCK 30 MIN"
      + sublabel "no kill switch; only fix is a full redeploy"
```

The two-node split for one probe is a useful pattern: one node carries the operator pain (e.g. AppServer = `STUCK 30 MIN` / "only fix is a full redeploy"), the other carries the customer pain (e.g. NewProcessor = `3% FAIL` / "customer charge returned 500"). Spreading the pain across nodes lets each one tell a fuller piece of the story without overloading any single label.

### Probe labels are verb-led actions, not statements

```
BAD:  "Vendor integration starts misbehaving at peak hours"   (statement)
BAD:  "Marketing wants the launch on Tuesday at 9am sharp"     (statement)
GOOD: "Hit kill switch during a vendor outage"                 (action)
GOOD: "Flip launch toggle at Tuesday 9:00am sharp"             (action)
GOOD: "Roll out new payment processor to all customers"        (action)
```

Statement-shaped labels make probes look passive. Verb-led labels match the actor table: who is doing this, why, and what goes wrong when they try.

### Every probe and scenario has a `story` field

Each probe (observe phase) and each stress scenario (reward phase) must include a `story?: string[]` field with 3-6 short bullets. The Dialog opens when the player clicks the info icon next to the button, providing context without cluttering the label.

Observe stories explain: who, what, why, what goes wrong because of the current system.
Reward stories explain: same situation, but how the solution changes the outcome ("Same customer doing same thing, but ...").

### PROBE_DISCOVERY_MAP must be 1:1, minRequired = all

`useDiscoveryGating(DISCOVERY_DEFS, { minRequired: DISCOVERY_DEFS.length })` -- always require all of them. The "Build the Fix" button appears only when `discoveryGating.isUnlocked` is true. Not a timer, not a button-click counter. The player must surface every discovery.

`PROBE_DISCOVERY_MAP` must be 1:1: each probe unlocks exactly one distinct discovery, and each discovery is unlocked by exactly one probe. Stage-click discoveries (via `STAGE_DISCOVERY_MAP`) are allowed but should not duplicate what a probe already covers.

### The dormant-edges default

`PipelineFlow`'s edge `mode` is computed as:

```
activeConnections === undefined  ->  'idle'    (continuous animation if dots set)
activeConnections === []         ->  'dormant' (no dots regardless of dots prop)
activeConnections === ['x', 'y'] ->  'active'  (single-pass on listed edges)
```

**`undefined` is a trap.** It puts edges into continuous idle mode before any probe fires, implying data is flowing before the player has done anything. Default rule: **pass `[]` (empty array) when no probe / scenario has fired yet.** Only pass `undefined` if the level genuinely has continuous background traffic that should always be visible.

### No floating nodes

Every visible node must be structurally connected to the rest of the graph by at least one edge. A node sitting alone with no edges looks like a UI bug.

If a node IS unreachable in the current state, render the architectural edge anyway but omit the `dots:` prop. The line is then static (no dot motion), which still communicates "no traffic flows here," but the node is anchored to the graph.

Inverse trap: if a node only exists in the reward phase (the build introduces new infrastructure), do NOT show it in observe just to keep the layouts symmetric. The build adds capability, not nodes -- and that asymmetry is honest.

### Re-firing the same probe must restart the animation

SVG `<animateMotion>` with `repeatCount="1"` plays once and freezes. The SMIL spec defines the canonical restart: call `beginElement()` on the animation element via the SVG DOM API. **This is the only approach that works reliably** -- React Flow's edge memoization keeps the inner SVG subtree alive across data updates, so neither key changes nor unmount-remount via prop changes are guaranteed to restart.

Sources:
- [MDN: SVGAnimationElement.beginElement()](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement)
- [SMIL Animations spec, beginElement](https://svgwg.org/specs/animations/#__svg__SVGAnimationElement__beginElement)
- [React Flow performance docs](https://reactflow.dev/learn/advanced-use/performance)

Required setup:
1. Set `begin="indefinite"` on the `<animateMotion>` element.
2. Hold a ref via callback ref + `instanceof SVGAnimationElement` (no unsafe cast).
3. In a `useEffect` keyed on the fire tick, call `el.beginElement()` on each ref, with the original `begin` offset converted to a `setTimeout` delay for the staggered cascade.

Implemented in `AnimatedDots` via the `restartTick?: number` prop.

What does NOT work on its own (all empirically tested):
- **Bumping a tick counter into dot ids.** React Flow's edge memoization defeats it.
- **Toggling `activeConnections` through `[]` and back.** Same memoization, same failure.
- **Changing a React `key` on the wrapping div.** Works but causes a canvas flash and loses React Flow's internal state.

---

## Build phase rules

The deeper guidance lives in the `design-level` skill's `build-phase-guide.md`. The most-violated rules:

- **3 options per OptionCard step.** Two is a coin flip.
- **Use `shuffleOptions(options, stepIndex)` from `@/lib/shuffleOptions`.** Hand-positioning the correct answer at index 2 or 3 produces predictable patterns.
- **Code preview transition table.** For every `completedStep`, write down what the player sees. Verify the preview does NOT contain the next step's correct answer's distinctive strings.
- **Feedback never reveals the answer** (and never contradicts an earlier step).
- **Gem install + generator + db:migrate are real steps.** If the feature requires a gem, the install / generator / migration commands appear as actual steps the player completes.

---

## Reward phase rules

### Reward replays observe with the fix

Non-negotiable from the design-level skill. The reward phase is NOT a feature demo. It replays the SAME story the player saw in observe, with the solution applied:

1. **Start the same way.** Same actor, same first frames.
2. **Follow the same path.** Same nodes touched, same sequence.
3. **Diverge ONLY at the moment where the fix changes the outcome.**

If the reward scenario's story does not begin with "Same [person] doing [same thing] ...", it is a feature demo, not a story continuation.

### Design probes and reward scenarios as PAIRS

Non-negotiable. Every observe probe is designed alongside its matching reward scenario, as a pair, before moving to the next probe. Format:

```
PAIR 1:
  Observe: "<verb-led action label>"
    Story: ...
    Frames: ... [request] -> [thing breaks] -> ...
  Reward:  "<same action with the fix>"
    Story: same person doing same thing, but ...
    Frames: ... [request] -> [thing handled] -> ...
    Diverges at: frame N
```

Designing observe probes and reward scenarios in separate passes is the most common cause of reward scenarios drifting into "feature demo" instead of "story continuation."

After all pairs are written, you may add reward-only scenarios for capabilities the build introduces but no probe surfaced. Those come AFTER the paired scenarios.

### Same layout across phases (with caveat)

Observe and reward stage positions should be identical for the **shared** nodes. The phase transition is about visualization state changing (variants, badges, dot flow, sublabels), not about nodes moving around the screen. Repositioning shared nodes between phases costs the player a re-orientation tax for no pedagogical gain.

If the build phase introduces new nodes (the FlagGate appearing in reward when it didn't exist in observe), those new nodes appear in new positions. The shared nodes keep theirs.

---

## Engineering quality

### State machine: observe / build / reward, no activate

Three valid phase patterns, matching the four observe types:

- **Type 1**: `'build' | 'reward'` (no observe).
- **Type 2**: `'intro' | 'build' | 'reward'` (static intro, no discovery gating).
- **Types 3/4**: `'observe' | 'build' | 'reward'` (discovery gating).

**No activate phase.** No star-rating screen between build and reward. No "Visualize ___" interstitial. The last build step's "Next Step" button goes directly to reward.

### Test enforcement (CI-level catch)

Every level test file with probes must call the helpers from
`@/lib/testing/probe-pedagogy` and `@/lib/testing/level-pedagogy`. Each
helper here mechanically enforces a rule from this file or
`.agents/rules/level-content.md` so authors do not have to remember
the rule across 58 levels.

**Visualization helpers** (`@/lib/testing/probe-pedagogy`):

- `expectEveryProbeDrivesVisualChange({ probes, probeStateMap, validate })` -- fails if any probe lacks an entry, or has an entry the validator rejects as "no visible delta" (no badge, no sublabel change, no variant change).
- `expectEveryProbeDrivesDistinctChange({ probes, probeStateMap, serialize })` -- fails if two probes produce identical visual state.

**Per-level pedagogy helpers** (`@/lib/testing/level-pedagogy`):

| Helper | Rule it enforces |
|---|---|
| `expectAllDiscoveriesRequired` | "PROBE_DISCOVERY_MAP must be 1:1, minRequired = all" — `useDiscoveryGating(DEFS, { minRequired: DEFS.length })`. |
| `expectProbeDiscoveryMapOneToOne` | Each probe unlocks exactly one distinct discovery, each discovery is unlocked by exactly one probe. |
| `expectStoriesPresent` | "Every probe and scenario has a `story` field" — 3-6 substantive bullets per item. |
| `expectProbesMatchScenarios` | Probe-to-scenario coverage with same id and label (testing.md). Skip if your level uses a separate `PROBE_TO_SCENARIO` mapping; write a level-specific test instead. |
| `expectBuildStepQuality` | "Wrong-Answer Feedback: Never Reveal Answers" + "correct answer is never first option" + exactly one correct answer + unique ids/labels + substantive feedback. |
| `expectScenarioBasics` | Scenarios have unique ids and labels and a mix of `'allowed'` / `'blocked'` results. |

**Curriculum-wide helper** (`scripts/validate-levels.ts`, runs in CI):

- Catches level slugs that disagree with `actId` / `levelNumber`. Catches gaps in the contiguous L1..L58 numbering. Catches missing required content fields.

Plus the strict-tests rule from `.agents/rules/testing.md`: every assertion checks an exact value the player would see (string, ID, count). `array.length > 0` and `expect(X).toBeDefined()` catch nothing.

Reference implementation: `Level49Deployment.test.ts` -- shared lints in one `describe` block, level-specific assertions (counts, exact ids, theme-word matching) in another.

### Data structure requirement

If the level's observe phase has a `PROBES` array, the level's `data/pipeline-stages.ts` (or equivalent) must export a probe-keyed state map that drives those visible deltas. The exact name varies by level -- `PROBE_PIPELINE_MAP` (L11), `PROBE_OBSERVE_OVERRIDES`, `PROBE_FRAMES` -- but the shape is always: `Record<probeId, { stages, activeConnections }>`. The orchestrator merges those overrides into the base stages on probe fire.

If you cannot point at the data structure that drives per-probe visualisation deltas, the level fails the gate.

---

## Engineering process

### Research before guessing

The general rule lives in `.agents/rules/etiquette.md` and applies project-wide. Level-pedagogy-specific signals:

- "The dot animation works the first time but not on re-fire." → SVG SMIL `repeatCount` / `beginElement()` semantics. Read [MDN beginElement](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement) and the [SMIL spec](https://svgwg.org/specs/animations/) before changing code.
- "The probe state changes in React DevTools but the screen doesn't update." → React Flow's edge memoization. Check the [React Flow performance docs](https://reactflow.dev/learn/advanced-use/performance).
- "The CSS class is set but the element doesn't pulse." → check that the parent variant maps to the right `status` in FlowNode (variant table above).

The L49 "silent re-fire" debugging burned three rounds because the first two attempts were plausible-sounding hypotheses dressed up as fixes. The MDN docs would have answered the question in two minutes. Always check the docs first when the cause is non-obvious.

---

## How this rule was earned

L49 (Feature Flags) was the worked failure example for nearly every section of this rule. Each shipped iteration surfaced a distinct lesson:

1. **Round 1 -- no per-probe state.** First implementation had a `PROBES` array and zero probe-keyed state map. Probes only updated the left-panel discovery checklist; the PipelineFlow visualization was static across all three probes. → introduced the data-structure requirement and the `expectEveryProbeDrivesVisualChange` helper.

2. **Round 2 -- text-only changes.** Per-probe stage overrides existed but `variant: 'danger'` only changed border colour, badges pulsed but the rest of the node was static, and edges had no dot animation because connections were never given a `dots:` prop. → introduced the `'critical'` variant for whole-card pulse, the `'danger'` dot preset, and the `dots:` requirement on connections.

3. **Round 3 -- idle-edge trap.** Default `activeConnections=undefined` put edges into continuous idle mode before any probe fired, implying data was flowing before the player did anything. → introduced the dormant-edges-default rule.

4. **Round 4 -- silent probe.** One probe had `activeConnections=[]` deliberately ("no request fires for this probe"). Text changed but no motion. → introduced the every-probe-needs-an-animated-dimension rule.

5. **Round 5 -- statement-shaped labels.** Two of three probe labels were descriptions, not actions. → reinforced the design-level "Probe Must Tell a User Story" rule.

6. **Round 6 -- floating node.** Legacy Payment Processor had no edges in observe, looking like a UI bug. → introduced the no-floating-nodes rule and the same-layout-across-phases rule (with the new-node caveat in round 8).

7. **Round 7 -- silent re-fire.** First fire animated, second fire of the same probe was silent. Two failed fixes preceded the right one: tick-into-id and dormant-toggle (both defeated by React Flow's edge memoization). The correct fix, found only after reading the [MDN beginElement docs](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement) and the [SMIL spec](https://svgwg.org/specs/animations/), is the SVG DOM's native restart API: `begin="indefinite"` + `el.beginElement()`. → introduced the re-fire restart rule and the **research-before-guessing** rule (now in `.agents/rules/etiquette.md` as a project-wide rule).

8. **Round 7b -- only the first dot of four was visible.** Active-mode override changed `dur` to `0.8s` but kept the indefinite-loop's negative `begin` values. With `begin=-2.7s, dur=0.8s, repeatCount=1` the animation ended 1.9s before the element mounted. → introduced the active-mode positive-cascade rule.

9. **Round 8 -- the FlagGate placeholder in observe.** Observe topology showed the FlagGate as a "missing" placeholder (`variant: 'critical'`, `badge: MISSING`). The reasoning was "the player can see where the fix WILL go." User correction: that violates the audit-level rule and the three-phase pedagogy entirely. The observe phase shows the system as it currently exists -- the FlagGate does not exist yet, so it does not appear. Probes communicate the absence by simulating actions that WOULD work if the FlagGate existed. → introduced the "Observe must only show what currently exists" rule and the worked example.

10. **Round 9 -- pedagogy rule was incomplete.** A pedagogy rule that was meant to prevent skill-level failures was itself missing major rules from the design-level and audit-level skills (narrative reasoning, actor table, concept foundation check, visualization type selection, pair-design probes+scenarios, reward replays observe, mechanism-not-metric, no-node-blank, animations-match-story, show-duality, nodes-same-kind-of-thing, 1:1 PROBE_DISCOVERY_MAP, no-activate-phase). → restructured the rule into Pre-flight / Observe / Build / Reward / Engineering quality / Engineering process sections and audited every section of both skills.

11. **Round 10 -- probe action did not match the visualization, and badges were jargon.** The marketing-pin-time probe was labelled "Flip launch toggle at Tuesday 9:00am" -- an admin toggle attempt -- but the visualization showed the customer payment pipeline. The request stopped at AppServer for unclear reasons, and the badge said `DEPLOY != LAUNCH`, which required the player to parse the `!=` operator and figure out what either side meant. User complaint: "what is deploy != launch mean? why isn't my request going to the last node?" → introduced the "Probe action must match the request flow" rule (with the reframe-or-show-the-alternate-flow choice and the "pain via success at the wrong time" pattern) and the "Plain-English badges and sublabels" rule (refer to audience-first in `level-content.md`; avoid acronyms / operators / jargon in badges). The fix: reframe the probe as "Customer pays Monday 4pm (after deploy, before launch)" with badges `NO TIMING CONTROL` and `LIVE EARLY`. Same pain, request flows naturally through to NewProcessor.

12. **Round 11 -- visualization labels did not match the terminal narrative.** The rollout-everyone probe terminal said "3% of charges fail at peak traffic (NewPaymentProcessor edge case)" with a story about engineers stuck in a 30-minute revert window, but the node badges said `DEPLOY 30 MIN` and `FAIL` -- vague tokens that communicated something was wrong without saying WHAT, for WHOM, or for HOW LONG. User complaint: "the nodes say 'deploy: 30 in' and 'fail' but the terminal says '3% of charges fail at peak traffic'... 'fail' doesn't convey what went wrong. the visualization is very weak altogether." → introduced the "Visual labels and terminal narrative tell the same story" rule and the two-node split pattern (one node carries operator pain, the other customer pain). Fix: AppServer = `STUCK 30 MIN` / "no kill switch; only fix is a full redeploy"; NewProcessor = `3% FAIL` / "edge case under peak load. customer charge returned 500." Same probe, but the visualization now teaches the same specific harm the terminal describes.

The reflexive lesson: **the pedagogy rule itself must be audited against the skills regularly, and against new failure modes the user surfaces.** A rule that is incomplete is worse than a rule that is missing entirely, because the rule's existence creates the impression that the contained rules are sufficient.

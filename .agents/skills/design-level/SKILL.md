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

### Actor-to-Node Cross-Reference (Do This First)

**Before designing any layout, cross-reference the actor table from Step 1 against your planned nodes.** Write this out explicitly:

```
| Actor (from Step 1) | Node in visualization? | If no, why not? |
|---------------------|----------------------|-----------------|
| Stripe              | Yes: "Stripe" node   |                 |
| Attacker            | Yes: "Attacker" node |                 |
| Rails App           | Yes: "App Server"    |                 |
| Database            | Yes: "Database"      |                 |
```

**If any actor from the table does not have a corresponding node, you must justify why.** Valid reasons: "This actor is a sub-element inside another node (e.g., middleware inside App)" per principle 13. Invalid reasons: "I combined them to keep it simple" or "they use the same endpoint."

**If the node count is less than the actor count and you cannot justify each missing actor, stop and add nodes until they match.** This check exists because the most common visualization mistake is collapsing two distinct actors into one node for convenience, which destroys the player's ability to see where actions originate.

### The Zero-Knowledge Test

**Could someone who has never heard of this concept understand what is going wrong by watching the visualization?** If they need to already understand the problem to interpret what they're seeing, the visualization has failed.

### Core Design Principles

Read [visualization-examples.md](visualization-examples.md) for case studies. Key principles:

1. **Show the mechanism, not the metric.** The player must see WHAT the system is doing, not just a number. A progress bar filling up is a metric. Requests flooding a server and getting queued is a mechanism.

2. **Show origin and intent. Every actor in the story gets a node.** Every action must show WHERE it comes from and WHAT it's trying to do. If the story says "a customer clicks Pay Now," the customer is an actor and needs a node. If the server forwards the request to Stripe, that's a second actor. Don't collapse two actors into one node for simplicity. Each node should represent exactly one actor's perspective.

    **How to identify actors:** During narrative reasoning (Step 1), list every entity that initiates, processes, or receives something in the story. A customer clicking a button is an actor. A server processing a request is an actor. An external API charging a card is an actor. If the entity has its own perspective on what's happening (the customer is waiting, the server is processing, Stripe is slow), it's an actor and needs a node.

    **Case study:** L38 originally had 2 nodes (App, Stripe). The App node showed "Processing checkout..." and then "Customer left wondering." But the customer and the server are different actors with different perspectives: the customer is waiting with a spinner, the server has a blocked thread. Collapsing them made it look like the Rails app was the one wondering about the payment. The fix: 3 nodes (Client, App, Stripe).

3. **Use different values to make conflicts visible.** If two operations produce the same result, the conflict is invisible. Use different inputs so the problem shows in the data itself.

4. **Show timing and causality.** If the problem involves ordering, show WHY things happen in sequence. "Still computing..." makes the gap explicit.

5. **Let data speak, not labels.** The visualization should make the problem self-evident. Red labels saying "LOST!" substitute for showing it. Good: a cell changing from 5 to 7.

6. **Show duality simultaneously.** When the concept is about a contrast (encrypted vs plaintext, polling vs push, cached vs uncached), show BOTH sides at the same time. Side-by-side comparison makes the contrast self-evident. A single view that toggles forces the player to remember.

7. **Make the "why should I care?" obvious.** Every visual element must answer not just "what happened" but "why is this bad?" Show the cost alongside the outcome, not just the outcome. If you have to explain why something is a problem in a separate label, the visualization hasn't shown it yet. Example: L37's polling visualization shows the server doing full work (authenticate -> query -> serialize -> respond) for each request, then returning "No new notifications." The player sees the effort wasted, not just an abstract "empty" label.

8. **Animations must tell a two-phase story.** When a visualization shows a request-response cycle, the animation must have distinct phases: the request going out (with a label like "Any notifications?") and the response coming back (with a label like "No new notifications"). If dots continuously flow in one direction with a static label, the player cannot tell whether they're seeing requests, responses, or just decorative motion. Each phase needs its own label, its own dot direction, and enough time to read before the next phase starts. Case study: L37's original polling animation showed dots flowing with a fixed "No new notifications" label for the entire sequence. The player couldn't tell that the client was asking and the server was answering -- it looked like a continuous stream of responses.

9. **Numbers need context, not just values.** A CPU gauge showing "95%" is a metric. A CPU gauge showing "95%" with a label "25K req/sec from 50K users" underneath is a mechanism -- the player knows WHY it's at 95%. Every metric in the visualization should trace back to its cause. If a server shows high CPU, show the request count. If a queue is full, show what's filling it. If latency is high, show what's blocking. Case study: L37's server node shows a request counter that escalates ("1 of 25K req/sec" -> "10K of 25K req/sec" -> "25K req/sec (99% wasted)") so the player sees the CPU rising because of the polling flood, not as an abstract number.

10. **Visual elements must match the scale they claim.** If a node says "50K users" but has one connection line, the player reasonably asks "are 50K users sharing one connection?" Make the visual honest about what it represents. Either label it clearly ("50K users polling" explains they're all hitting the same endpoint repeatedly) or show multiple connections. Don't let a static label contradict the visual structure.

11. **No node should ever be blank during an animation.** Every node must always show its current state in every frame. If the server is processing, it says "Processing...". If it's waiting, it says "Awaiting response...". If the client is idle, it says "Waiting for shipment...". Blank nodes make the player lose track of what's happening. This applies to ALL nodes (Client, Server, Payment Processor, etc.) in ALL phases (observe and reward). If a frame only updates one node, the other nodes keep their previous labels via partial merge -- which is fine, as long as the previous label still makes sense for the current moment.

12. **Animations must match the story, not just describe it (Non-Negotiable).** This is the master rule that ties everything together. The story (info modal) and the animation (what plays on screen) must tell the SAME narrative. If the story says "customer places an order, waits for it to ship, then keeps refreshing," the animation must show: (a) customer placing the order, (b) server confirming, (c) TIME PASSING while the warehouse processes, (d) customer starting to refresh, (e) server doing wasted work, (f) finally getting the update. Every beat in the story must have a corresponding frame in the animation.

    **What this means in practice:**
    - If the story has a time gap (order placed -> time passes -> customer starts refreshing), the animation must show that gap. Skipping from "order confirmed" straight to "refreshing" makes it look instant and misleads the player about why polling is needed.
    - If the story involves an external service (Stripe, S3), that service needs its own node so the player can see the data traveling there and back.
    - If the story says the server is doing work, the server node must say what work (not blank).
    - If the story says a response comes back, the dots must flow in the response direction with a response-appropriate label.
    - The reward animation tells the SAME story with the fix applied. Same beginning, same characters, different ending at the point where the solution changes things.

    **How to verify:** Read the story (info modal bullet points) and the frame sequence side by side. For each story bullet, there must be at least one corresponding frame. For each frame, there must be a corresponding story bullet. If a frame exists that the story doesn't mention, either the frame is wrong or the story is incomplete.

13. **Nodes at the same visual level must be the same kind of thing.** When the player sees two nodes rendered identically, they assume those nodes are peers: the same category of thing. A Controller node and a Serializer node work as peers because they're both "stages in the request pipeline." A Client node and a Server node work as peers because they're both "systems that communicate." But an "App Server" node and a "Timeout" node do NOT work as peers because they're fundamentally different categories: one is a system that processes requests, the other is a behavior configured inside that system. Rendering them as identical-looking nodes implies the timeout is a separate service sitting between the app and Stripe, like a proxy. That's misleading.

    **The rule:** Before adding a node, ask: "Is this the same kind of thing as the other nodes in the diagram?" If all other nodes are systems (App, Database, Stripe), a middleware concept (timeout, retry, circuit breaker) doesn't belong as a peer node. If all other nodes are pipeline stages (Controller, Model, Serializer), a new stage (Policy, Validator) fits naturally.

    **How to show concepts that don't fit as peer nodes:** Make the parent node expand or change its internal content to reveal the concept. For example, Faraday middleware (timeout, retry, circuit breaker) should appear as sub-elements inside the App Server node, not as separate nodes between App and Stripe. In the observe phase, the App Server node is simple (no protection). In the reward phase, the same node expands to show its internal middleware stack. The player sees the app got smarter, not that new infrastructure appeared.

    **Case study:** L38's original design had 5 nodes: App -> Timeout -> Retry -> Circuit Breaker -> Stripe. The App and Stripe nodes represent systems. The Timeout, Retry, and Circuit Breaker nodes represent code running inside the App. Rendering all five as identical peer nodes implied the middleware was separate infrastructure. The fix: keep 2 system nodes (App, Stripe) and show the middleware as labeled sub-elements inside the App Server node.

    **Quick test:** Write out what each node IS in one sentence. If the sentences use different categories ("App Server is a system that runs Rails" vs "Timeout is a configuration that limits request duration"), they shouldn't look the same. Either change the visual treatment (sub-element, badge, internal panel) or reconsider whether they belong at the same level.

14. **Edge labels must never be hidden behind nodes.** The gap between two connected nodes must be wide enough for the longest edge label that will appear during any animation. If a label is hidden behind a node, the player misses critical information.

    **How to size the gap:** Before setting node positions, write out every edge label that will appear across all probes and reward scenarios. Find the longest one. The gap between the right edge of the source node and the left edge of the target node must be at least as wide as that label (plus padding).

    **The tradeoff with many nodes:** When a visualization has 2-3 nodes, you have plenty of horizontal space, so use it for generous gaps. When it has 4+ nodes, space is tight. Do NOT shrink nodes to make room for long labels. Instead, shorten the labels themselves:
    - Move details to node content: show the payload (`{ amount: 5000 }`) inside the sending node, keep the edge label to just the route (`POST /v1/charges`)
    - Use two-line labels: shorter width, same information
    - Use shorthand for status text: `503 Unavailable` instead of `503 Service Unavailable`
    - Never drop the API version prefix. `/api/v1/charges` must stay `/api/v1/charges`, not `/charges`. Dropping it breaks cumulative API versioning patterns and confuses the player about which API version they're hitting.

    The goal is balance: nodes must stay large enough to show their content (thread pools, gauges, status), and edges must stay long enough to show their labels. Neither should sacrifice for the other. Adjust labels first, node positions second, node sizes last.

    **Case study:** L38's original layout had the App node (w-56 = 224px) and Stripe node (w-40 = 160px) with only 96px gap between them. Edge labels were hidden behind the nodes. The fix: moved the payload (`{ amount: 5000 }`) into the App node's status text, shortened edge labels to just the route (`POST /v1/charges`), reduced nodes to w-48/w-36, and moved Stripe to x=480 (creating ~290px gap).

15. **Animation speed must scale with visual complexity.** The player needs to read every label on every node and edge before the next frame replaces them. The more nodes and edges in the visualization, the slower each frame must be. Do not use a fixed frame delay across all levels.

    **Guideline:** Count the total number of elements (nodes + edges) that change per frame. Multiply `ANIMATION_DURATION_MS` by a factor based on complexity:
    - 2 nodes, 1 edge: `1x` (base speed)
    - 3 nodes, 2 edges: `1.5x` (50% slower)
    - 4+ nodes, 3+ edges: `2x` (double the time)
    - Probes with extra narrative weight (cascade failures, multi-step flows): add another `0.5x` on top

    This is a starting point. Playtest each probe: fire it and try to read every label before the next frame. If you cannot, slow it down.

    **Case study:** L38 has 3 nodes (Client, App, Stripe) and 2 edges. At `1x` speed (1500ms/frame), labels were unreadable because the player had to scan 5 elements before the next frame. At `1.5x` (2250ms/frame), each frame is readable. The outage probe uses `2x` (3000ms/frame) because it has the most dramatic changes per frame (thread pool draining, queue filling).

### The Literal Screen Test

After designing, describe what the player LITERALLY SEES on screen. Not what the code does. Not what the concept is.

- Bad: "8 PollArrow objects appear in the polling lane"
- Good: "8 lines of monospace text saying `GET /notifications -> [ ]` appear inside a dark box"

If your honest description sounds like "text appears in a box" or "numbers update in a stat card," the visualization is a log or a metric display, not a visualization. Redesign.

Case study: L37's visualization described as "two-lane comparison with arrows" was actually monospace text lines inside dark rectangles with static CPU/Latency number boxes. The description made it sound visual, but the screen showed text in boxes.

### Every Probe Must Tell a User Story (Non-Negotiable)

**This is a top-level requirement.** Every probe and every stress test scenario must be grounded in a real user action with a human motivation. Not an abstract API call, but a person doing something for a reason.

**Wrong:** "GET notifications (poll)" -- Why is the client polling? Who is this person? What are they trying to accomplish? The probe is an abstract HTTP verb with no story.

**Right:** "Customer checks order status" -- A customer ordered a product and keeps refreshing the page to see if it shipped. Thousands of customers do the same thing. Each refresh is a poll. 99% return "No updates yet." The player understands who is doing what, why, and why it's a problem.

For each probe, answer before writing any animation frames:
1. **Who** is the user? (Customer, admin, attacker, new visitor)
2. **What** are they trying to do? (Check if order shipped, browse products, pay for something)
3. **Why** are they doing it? (Anxious about delivery, shopping on Black Friday, buying a product)
4. **What goes wrong** because of the current system? (They have to keep refreshing, the server crashes, they wait 2 seconds)

The probe label, the edge labels during animation, and the client node text should all reflect this story. "Check order status" and "No updates yet" tell a story. "Any notifications?" and "No new notifications" are abstract.

### Every Probe and Scenario Must Have an Info Story (Non-Negotiable)

Every probe (observe phase) and every stress test scenario (reward phase) must include a `story` field: an array of short bullet points that explain the user story behind the action. The `ProbeConfig` and `StressScenario` types both support `story?: string[]`.

When the player clicks the info icon next to a probe/scenario button, a Dialog opens showing these bullet points. This gives the player full context without cluttering the button label.

**Observe probe stories** explain: who the user is, what they're doing, and what goes wrong because of the current system.

**Reward scenario stories** explain: the same situation, but how the solution changes the outcome.

Example (L37):
```typescript
// Observe probe
{
  id: 'check-polling',
  label: 'Customer checks order status',
  story: [
    'A customer placed an order and keeps refreshing to check if it shipped.',
    'Thousands of customers do the same thing every 2 seconds.',
    'Each refresh triggers a GET /notifications poll to the server.',
    '99% of the time, nothing has changed.',
    'But the server still runs the full pipeline for each one.',
  ],
}

// Matching reward scenario
{
  id: 'zero-polling',
  label: 'Customer checks order status (with push)',
  story: [
    'Same customer waiting for their order to ship.',
    'But now they do not need to keep refreshing.',
    'The server pushes the shipping update instantly via WebSocket.',
    'Zero polling requests, zero wasted server work.',
  ],
}
```

Each bullet should be one short sentence. Aim for 3-6 bullets per story.

Case study: L37's probes evolved from abstract API calls to user stories:
- "GET notifications (poll)" -> "Customer checks order status" (customer refreshing order page)
- "GET server health" -> "Black Friday traffic spike" (50K customers crash the site)
- "POST create payment" was already a story (user buying something through Stripe)

The reward scenarios mirror these stories with the fix applied:
- "Customer checks order status (with push)" -- same customer, but server pushes updates instead of waiting for refresh
- "Black Friday traffic (with WebSocket)" -- same 50K customers, but site stays up at 3% CPU

### Probe and Scenario Ordering

Arrange probes and stress test scenarios in a logical order that builds understanding. The first probe should introduce the most important visual elements and set context for the ones that follow.

Example: L37 has three nodes (Client, Server, Payment Processor). The Payment Processor is always visible but dimmed when unused. The probes are ordered:
1. **POST create payment** (first) -- uses all three nodes, immediately shows the player why the Payment Processor node exists
2. **GET notifications (poll)** -- shows polling waste (Processor node dimmed, player already knows what it is)
3. **GET server health** -- shows overload (Processor node dimmed)

If the polling probe were first, the player would see a dimmed "Stripe" node for two probes and wonder what it's for. Putting the payment probe first answers that question immediately.

The same principle applies to stress test scenarios in the reward phase: lead with the scenario that best demonstrates the solution, not the simplest one.

### Design Probes and Reward Scenarios Together as Pairs (Non-Negotiable)

**This is a process rule, not a content rule.** The most common design mistake is designing observe probes in Step 3 and reward scenarios in Step 5 as separate exercises. When you design them separately, you unconsciously shift from "replaying the story" to "demoing the feature." Every time this has happened, the reward scenarios ended up showcasing feature capabilities instead of resolving the stories the player discovered.

**The fix: design each probe and its matching reward scenario at the same time, as a pair.** Do not move on to the next probe until the current probe's reward scenario is written. Use this format:

```
PAIR 1:
  Observe: "POST create payment (slow response)"
    Story: Customer pays, Stripe is slow, thread blocked 30s
    Frames: [request] -> [waiting 15s] -> [30s timeout] -> [504]
  Reward:  "POST create payment (with timeout)"
    Story: Same customer, same slow Stripe, but timeout kills it at 10s
    Frames: [request] -> [waiting] -> [TIMEOUT at 10s] -> [thread freed]
    Diverges at: frame 3 (timeout kicks in instead of waiting 30s)

PAIR 2:
  Observe: "GET check payment status (Stripe 503)"
    ...
  Reward:  "GET check payment status (with retry)"
    ...
    Diverges at: ...
```

**Why pairs prevent the mistake:** When you write the reward scenario right next to the observe probe, you naturally copy the flow and change only the ending. When you write all reward scenarios in a separate section, you naturally think "what should the reward phase demonstrate?" and design around feature capabilities instead.

**After all pairs are written,** you may add reward-only scenarios for concepts taught in the build phase but not shown in observe. These come AFTER the paired scenarios.

**Verification:** After designing all pairs, build the cross-phase consistency table. If any observe probe has no matching reward scenario with the same label pattern, the design is broken. If any reward scenario's story doesn't start with "Same [person] doing [same thing]...", it's a feature demo, not a story continuation.

Case study: L38's design had probes "POST create payment (slow response)", "POST create payment (Stripe 503)", and "Black Friday traffic (Stripe outage)." The reward scenarios were "POST charge (fast response)", "POST charge (slow, timeout)", "GET balance (503, retried)", "POST charge (circuit open)." The labels didn't match, the stories didn't continue, and "GET balance" was a completely different request from the probe's "POST create payment." This happened because probes and scenarios were designed in separate passes. If they had been designed as pairs, "POST create payment (Stripe 503)" would have immediately been paired with "POST create payment (with retry)" using the same request.

### Probe Differentiation

Each probe must produce a DIFFERENT visual result. If you fire three probes and write down what changes on screen, and two descriptions are identical, redesign.

For each probe, write:
1. What visually changes when this probe fires? (Literal screen description)
2. How is this different from every other probe?
3. Could a newcomer explain what went wrong after watching?

### Per-Scenario Reward Differentiation

Each stress test scenario must produce a different visual result in the reward phase. If every scenario plays the same animation (rows flash, same color, same duration), the stress test is visual noise.

Case study: L36's original reward had all scenarios flash table rows green identically. The redesign shows different table perspectives per scenario (app vs database, highlighted columns vary, success vs failure banners).

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

# Step 3: Design the Visualization (Types 3 and 4)

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


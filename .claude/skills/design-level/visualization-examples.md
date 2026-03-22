# Visualization Design Examples

Real examples of visualization designs that failed and how they were fixed. Use these as reference when designing or auditing any level's observe phase.

## Core Principle: Design for Zero Prior Knowledge

**Every visualization must be understandable by a player who has never heard of the concept being taught.** If the player needs to already understand the problem to interpret the visualization, the visualization has failed. The observe phase exists to BUILD that understanding from scratch.

Before approving any visualization, ask: "If I showed this to someone who has never written a line of Rails code, would they understand what is going wrong?" If the answer is no, redesign.

## Example 1: Level 34 (Locking / Concurrency Control)

### The Problem

Two users modify the same database row simultaneously. Without locking, one user's write silently overwrites the other's.

### Initial Design (FAILED)

A 3-column grid with abstract labels:

```
Customer A    |  Stock  |  Customer B
─────────────────────────────────────
READ -> 15    |   15    |  READ -> 15
-= 10 -> 5   |   15    |  -= 10 -> 5
SAVE 5        |    5    |
              | 5(LOST) |  SAVE 5 (overwrites)
```

**Why it failed (multiple compounding problems):**

1. **Pervasive ambiguity.** A newcomer looking at this grid has immediate questions with no answers: Why are there two customers? Why are they acting at the same time? Why does Customer B save after Customer A? Is B slower? Is there a network delay? What is "Stock"? Is this a database column, a variable, a cache? The visualization assumes the player already understands concurrent database access to interpret what they're seeing. But that's the concept they're here to learn.

2. **No origin or intent.** The grid shows what happened but not where it came from or why. There are no HTTP requests, no endpoints, no payloads. The player cannot see that these are two separate API calls hitting the same database row. Without that context, "Customer A" and "Customer B" are just abstract labels with no story behind them.

3. **Abstract shorthand instead of narrative.** Labels like "READ -> 15", "-= 10 -> 5", "SAVE 5" are compressed notation that only makes sense if you already understand concurrent read-write races. A newcomer sees cryptic column entries, not a step-by-step process they can follow. There is no progression, no "first this happened, then this happened." It's a finished diagram, not an unfolding story.

4. **The numbers were identical.** Both customers bought 10 from 15, both computed 5, both saved 5. The "overwrite" was invisible because the final value (5) was the same either way. A newcomer cannot see what went wrong when both sides produce the same number. The grid has to TELL them with a "(LOST!)" label because the data doesn't SHOW it.

5. **No timing or causality.** Both sides move in lockstep, row by row. There is no indication of why Customer B writes after Customer A, no "still computing..." or waiting state. The timing gap that causes the race condition is invisible. A newcomer might think B saves after A because B is simply slower, not because both operations overlap.

6. **No persistent database context.** There was no visible database table. The player couldn't see what a "products" row actually looks like, what columns exist, or what values are changing. The "Stock" column header was the only hint, floating between two abstract threads without any database framing.

7. **Label-driven instead of data-driven.** "5 (LOST!)" is a label asserting something was lost, but the player can't verify it. Both sides saved 5, so what exactly was lost? The visualization tells the player the conclusion instead of letting them arrive at it by watching the data change. A good visualization makes the problem self-evident; a bad one has to explain it with red text.

### Redesigned Version (PASSED)

Split-screen with a persistent database table, two request cards, and a mismatch counter. The redesign addresses every failure above by showing the player the full picture: where requests come from, what they're trying to do, what the database looks like, and what happens when they overlap.

**1. Persistent database table (always visible):**
```
products
id | name       | price  | stock_count | lock_version
1  | Laptop Pro | $50.00 | 15          | (none)
```
Cells flash amber (reading), green (saved), red (overwritten). The player sees a real database row with real columns, not an abstract label. This is the anchor that stays on screen throughout the animation, giving the player a reference point to track changes against. (Fixes: no persistent context, no database framing.)

**2. Request cards show origin and intent:**
Each card has a header showing the HTTP method, endpoint, and payload:
```
Request A (blue)                    Request B (purple)
POST /api/v1/orders                 POST /api/v1/orders
{ product_id: 1, qty: 10 }         { product_id: 1, qty: 8 }
```
The player can immediately see: these are two separate API calls, hitting the same product, trying to buy different quantities. No ambiguity about who is doing what or why there are two requests. (Fixes: no origin or intent, pervasive ambiguity.)

**3. Step-by-step log entries tell the story as it unfolds:**
```
[db] Reading stock_count...         [db] Reading stock_count...
[db] Read: stock_count = 15        [db] Read: stock_count = 15
[cpu] Computing: 15 - 10 = 5       [cpu] Computing: 15 - 8 = 7
[save] Saved! stock_count = 5      [clock] Still computing...
                                    [alert] OVERWRITES! stock_count = 7
```
Each entry appears one at a time with an icon indicating the operation type (database read, CPU computation, save, alert). The player watches the process unfold step by step, not a finished diagram. (Fixes: abstract shorthand, no narrative.)

**4. "Still computing..." shows the timing gap:**
When Request A saves, Request B shows "[clock] Still computing..." instead of moving in lockstep. This explicitly communicates the timing: B is still working with its stale data while A has already written. The player understands WHY B overwrites A, not just that it does. (Fixes: no timing or causality.)

**5. Different quantities make the conflict visible in the data:**
- Request A buys 10 (computes 15 - 10 = 5, saves 5)
- Request B buys 8 (computes 15 - 8 = 7, saves 7)
- Final stock_count: 7 (not 5)

The values 5 and 7 are DIFFERENT. When the table cell flashes red and changes from 5 to 7, the player can see the overwrite happen in the data itself. No label needed to explain it. (Fixes: identical numbers, label-driven instead of data-driven.)

**6. Mismatch counter states the consequence in plain language:**
"18 units sold, only 8 deducted" in red. The player sees the real-world impact without needing to do mental math. This is a concrete business consequence, not a technical label like "(LOST!)". (Fixes: no concrete consequence.)

**7. Warning provides the full explanation:**
"Request B saved stock_count = 7 using the 15 it read before Request A saved. Request A's deduction to 5 was silently overwritten." This comes AFTER the player has already seen the problem in the animation, reinforcing what they observed rather than replacing the visualization.

### Key Takeaways

| Principle | Bad (old grid) | Good (new split-screen) |
|-----------|-----|------|
| **Show origin** | "Customer A" / "Customer B" (who?) | HTTP request cards with method, endpoint, payload |
| **Show intent** | No indication of what each side is trying to do | `{ product_id: 1, qty: 10 }` spells it out |
| **Use different values** | Both save 5 (conflict invisible) | A saves 5, B saves 7 (conflict obvious in the data) |
| **Show the database** | Abstract "Stock" column label | Full `products` table with all columns |
| **Tell a story** | Cryptic shorthand in a finished grid | Step-by-step log entries appearing one at a time |
| **Show timing** | Both sides move in lockstep | "Still computing..." shows the gap that causes the race |
| **State the consequence** | "LOST!" label | "18 units sold, only 8 deducted" |
| **Let data speak** | Red label tells the player what to think | Red flash on the cell lets the player see it happen |

### Second Probe: Making the Scenario Convincing

The level has two probes. The first teaches stock count races, the second teaches price races. The price probe went through multiple iterations:

**Attempt 1 (FAILED):** Admin A sets price to $29.99, Admin B sets price to $39.99. **Problem:** Either price could be valid on its own. A newcomer asks "Why is $39.99 wrong? Maybe that's the correct newer price." There is no visible conflict.

**Attempt 2 (FAILED):** Admin A fixes a pricing error ($2.99 -> $29.99), Admin B edits the product name. Admin B's save carries their stale price ($2.99), reverting A's fix. **Problem:** If Admin B is only updating the name, a well-designed API sends only `{ name: "..." }` in the payload, not the price. The scenario assumes a broken API, which undermines the teaching.

**Attempt 3 (PASSED):** Admin A raises price by $10 (reads $50, saves $60). Admin B raises price by $5 (reads $50, saves $55). Expected: $65. Actual: $55. **Why it works:** Both admins modify the SAME field based on the SAME stale read. The payload is `{ price: 60 }` and `{ price: 55 }`, both absolute values. The mismatch counter says "$15 in adjustments, only $5 applied." This mirrors the stock probe pattern exactly: two operations that both compute from stale data.

**Rule:** When designing probe scenarios, the wrong outcome must be wrong in a way that is SELF-EVIDENT without domain knowledge. "18 units sold, 8 deducted" is self-evidently wrong. "$39.99 instead of $29.99" is not. Ask: "Would a non-technical person understand why this result is bad?"

### Audit Trap 1: TS Errors Distract from Visualization Evaluation

**When a level has many mechanical issues (wrong props, TS errors, missing imports), the temptation is to fix those first and evaluate the visualization later. This is backwards.**

Case study: L37 (Real-Time) had 11 critical TS errors (wrong props on every shared component). The audit spent its entire attention on those mechanical fixes and gave the visualization a "conditional pass" because the concept description ("two-lane polling vs WebSocket comparison") sounded good. But the actual screen showed monospace text lines inside dark rectangles with static number boxes (CPU 95%, Latency ~2s). The player saw text in boxes, not a visualization of polling waste. The probe-by-probe description said "8 arrows appear" but the literal screen showed `GET /notifications -> [ ]` repeated as text. The word "arrows" in the audit made it sound more visual than it was.

**Rule:** Evaluate the visualization FIRST. Describe what the player LITERALLY SEES on screen (not what the code does, not what the concept is). If the description sounds like "text appears in a box" or "numbers update," it's a metric display, not a mechanism visualization. Flag it as FAIL and redesign before fixing any TS errors.

### Audit Trap 2: Structural Compliance is Not a Real Audit

**This is the most common audit failure mode. Do not skip this section.**

An audit can mark an observe phase as "PASS" because all the structural pieces are present (ProbeTerminal exists, FlowConnector present, discoveries are defined, animation locking works) while completely missing that the visualization teaches nothing.

**Case study: L35 Active Storage.** The level had three probes: "Upload 5MB photo", "Download user avatar", "List users with avatars." All three played the exact same animation: Client zone lights up ("Sending file..."), App Server zone lights up ("Memory spike!"), S3 zone lights up ("Stored"). The audit checked that ProbeTerminal was disabled during animation, that discoveries mapped to probes, that FlowConnector direction was correct, and marked the observe phase as "PASS."

But a player firing "Download user avatar" sees "Sending file..." and "Stored." That makes no sense for a download. The animation doesn't show what downloading does differently from uploading, doesn't show the data flowing in the opposite direction, doesn't show the worker blocking. All three probes are visually identical. The visualization is structurally present but semantically empty.

**The fix:** Before marking any observe phase as "PASS", write out what the player sees for EACH probe:
1. Fire probe X. What animation plays? What text appears on each zone?
2. Fire probe Y. Is the animation DIFFERENT from probe X?
3. If all probes play the same animation, the visualization is broken regardless of how many correct hooks and components it uses.

**Rule:** Structural compliance (correct imports, correct hooks, correct props) is necessary but not sufficient. The audit must evaluate what the player actually sees, probe by probe. A generic animation that plays the same way for every probe is equivalent to having no visualization at all.

### Build Phase: Narrative Consistency Failures

**5. Code snippets must use the level's domain, not a different domain (FAILED then FIXED).**
The build step for handling StaleObjectError showed `UpdateProfile.call(user_id:)`, `UserSerializer`, `User.lock.find`, and `profile_params` in the code options. The entire level is about products and orders in an e-commerce app. "Profiles" and "users" are from a different domain entirely. The player just spent the observe phase watching product stock and price races, and now they're suddenly looking at user profile code.

The step description also said "For low-contention resources like profiles" which is vague and disconnected from the scenario. It was rewritten to: "When two admins edit the same product, the second save should fail instead of silently overwriting. Handle the version conflict in the controller."

**Rule:** Every code snippet, description, and label in the build phase must use the same domain as the observe phase. If the level teaches locking on products, the code must show `Product`, `ProductSerializer`, `product_params`, not `User`, `UserSerializer`, `profile_params`. The player should never encounter a domain switch mid-level.

**6. The center panel must scroll when build step content is tall (FAILED then FIXED).**
The OptionCard step for "Build Order Service" showed two large Ruby code blocks. The content overflowed the center panel but the player could not scroll to see the second option or the "Next Step" button. The panel's parent div had `flex-1 flex flex-col` but was missing `min-h-0`. In a flex column layout, children with `flex-1` won't shrink below their content height unless `min-h-0` is set, which prevents `overflow-y-auto` on the child from activating.

**Rule:** Any flex column container that has a scrollable child must include `min-h-0`. This is a CSS layout requirement, not optional. Without it, `overflow-y-auto` on the child is silently ignored and content clips or overflows. Always test the build phase with the tallest OptionCard step to verify scrolling works.

### Reward Phase: Cross-Phase Consistency Failures

The reward phase reuses the same visualization components as the observe phase but shows the solution working. Several consistency issues were caught during review:

**1. Card params must match across phases (FAILED then FIXED).**
The observe phase showed JSON payloads under card headers (`{ product_id: 1, qty: 10 }`), but the reward phase showed descriptions ("Two customers order simultaneously with FOR UPDATE lock") or actor names ("as Customer A"). The two phases use the same `RequestCard` component in the same center panel. Mismatched content styles make them look like different UIs.

**Rule:** Whatever format the observe phase cards use (JSON payloads, SQL queries, etc.), the reward phase cards must use the same format.

**2. Single-request scenarios should not show an empty second card (FAILED then FIXED).**
The observe phase always shows two cards because both probes involve concurrent requests. But reward scenarios like "buy 100 (insufficient)" or "invalid quantity" are single-request operations. Showing an empty Request B card with just a header and no log entries is confusing: the player wonders why it's there and what it's waiting for.

**Rule:** Only show Request B when the scenario actually involves a second concurrent request. Track this with a state flag (`showRequestB`) that's set per scenario.

**3. Blocked scenarios must show specific failure reasons, not generic messages (FAILED then FIXED).**
All three blocked scenarios (insufficient stock, stale version, invalid amount) originally shared the same generic animation frames: "Validation check..." then "CHECK FAILED. ROLLBACK." The player fires "buy 100, insufficient" but sees a generic failure with no connection to the actual problem. Meanwhile, the StressTestPanel below correctly shows "INSUFFICIENT_STOCK", creating a disconnect between the visualization and the terminal.

Each blocked scenario must have its own frames that explain the specific failure:
- **Insufficient stock:** "Checking: stock_count (15) >= quantity (100)?" then "InsufficientStockError! 15 < 100. ROLLBACK."
- **Stale version:** "Admin loaded edit form earlier: GET /products/1 returned lock_version: 0" then "Rails checks: WHERE lock_version = 0... but DB has lock_version = 2" then "StaleObjectError! 0 rows updated."
- **Invalid amount:** "OrderContract validating: { quantity: -5 }" then "Contract failed: quantity must be greater than 0"

**Rule:** Every scenario must produce visualization output that matches what the StressTestPanel shows. If the terminal says "INSUFFICIENT_STOCK", the request card should show why the stock was insufficient, not a generic "CHECK FAILED."

**4. Optimistic locking must show how the version travels (FAILED then FIXED).**
The stale version scenario originally showed "Loading product (lock_version = 0 from stale form)" without explaining how the admin got version 0 in the first place. The player has just learned about `lock_version` in the build phase but doesn't yet understand the full lifecycle: form loads it via GET, form sends it back via PATCH, Rails uses it in the WHERE clause.

The fixed version shows the complete flow:
1. "Admin loaded edit form earlier: GET /products/1 returned lock_version: 0"
2. "PATCH /products/1 with lock_version: 0 from form"
3. "Rails checks: WHERE lock_version = 0... but DB has lock_version = 2"
4. "StaleObjectError! 0 rows updated. Version mismatch."

**Rule:** When a concept has a lifecycle (data travels between client and server), the visualization must show the full round trip. Don't skip steps that the player needs to understand.

## Example 2: Level 36 (Encrypted Attributes) - Reward Phase

### The Problem

The reward phase needed to show that encryption protects PII at rest: the app sees plaintext, the database stores ciphertext, and attackers see gibberish.

### Initial Design (FAILED)

A single database table (identical to the observe phase) with green border instead of red. When a scenario fires, rows flash with a faint green highlight, then return to normal.

**Why it failed:**

1. **No visible change per scenario.** All scenarios produced the same animation: rows flash green briefly. "Find by email" looked identical to "SQL injection attack" looked identical to "backup audit." The player clicks different buttons and sees the same thing every time.

2. **Faint highlights were invisible.** The row highlight used `bg-emerald-100 dark:bg-emerald-900/30` which was barely distinguishable from the base table background. The player couldn't tell when an animation was playing.

3. **No teaching of the core concept.** Encryption's key insight is the CONTRAST between what the app sees (plaintext) and what the database stores (ciphertext). A single table can only show one perspective at a time. The player never sees both perspectives simultaneously, so they never internalize the duality.

4. **Blocked scenarios flashed green.** When "find by phone" (blocked, non-deterministic can't be queried) fired, the row flashed green just like successful scenarios. There was no visual distinction between "this worked" and "this failed."

### Redesigned Version (PASSED)

A **dual-perspective split view** with per-scenario behavior:

**1. Two tables side by side: "What the App Sees" vs "What the Database Stores"**
- Left table (emerald border): always shows plaintext values. This is what application code sees after automatic decryption.
- Right table (amber border): always shows ciphertext blobs with lock icons. This is what's actually stored on disk.
- The player sees both perspectives simultaneously. The contrast IS the lesson.

**2. Per-scenario perspective selection:**
Not every scenario needs both tables. The visualization config controls which perspectives appear:
- "Find by email" (deterministic query): BOTH tables, email column highlighted. Player sees the same email produces the same ciphertext, enabling the match.
- "Find by phone" (non-deterministic failure): DB table ONLY, phone column highlighted, red banner. Player sees each encryption is unique, no match possible.
- "SQL injection attack": DB table ONLY, all PII columns highlighted. Player sees the attacker's view: nothing but ciphertext.
- "Transparent read": BOTH tables, all PII columns. Player sees the app reads plaintext while the DB stores ciphertext.

**3. Scenario result banner with strong colors:**
A colored banner above the tables explains what happened:
- Green: "Deterministic: query encrypted, matched in DB. User found."
- Red: "Non-deterministic: same phone encrypts differently each time. No match possible."
- Green: "Attacker dumped the table but sees only ciphertext. No PII exposed."

The banner uses solid background colors (`bg-emerald-100`, `bg-red-100`) that are clearly visible, not faint semi-transparent overlays.

**4. Idle state guidance:**
Before any scenario is fired, a neutral prompt says "Fire a scenario below to see how encryption protects data at each layer." The player knows what to do.

### Key Takeaways

| Principle | Bad (single table with flash) | Good (dual-perspective split) |
|-----------|------|------|
| **Show the core duality** | One table can only show one perspective | Two tables show both perspectives simultaneously |
| **Differentiate scenarios** | All scenarios flash the same way | Each scenario shows different perspectives and highlights different columns |
| **Strong visual feedback** | Faint highlight barely visible | Solid banner colors, bold highlighted text, clear column focus |
| **Distinguish success/failure** | Both flash green | Success = emerald banner, failure = red banner |
| **Teach without labels** | Player sees green flash, learns nothing | Player sees plaintext next to ciphertext, understands the contrast |

**Rule:** When a concept is about a duality or contrast (encrypted vs plaintext, cached vs uncached, authorized vs unauthorized), the visualization must show BOTH sides simultaneously so the player can compare. A single view that toggles between states forces the player to remember the previous state. Side-by-side comparison makes the contrast self-evident.

**Rule:** Reward phase visualizations must be visually distinct PER SCENARIO. If every scenario produces the same animation (rows flash, same color, same duration), the stress test is visual noise. Each scenario exists to teach a different aspect of the solution. The visualization must reflect that difference.

## Example 3: Level 37 (Real-Time / WebSocket) - Observe + Reward Phase

### The Problem

HTTP polling wastes 25K req/sec (99% empty). When a payment completes asynchronously, the user waits up to 2 seconds for their next poll cycle to discover it. The server has the answer but can't push it.

### Initial Design (FAILED - Multiple Rounds of Fixes)

**Attempt 1: Two-lane text comparison.** Two side-by-side boxes: "HTTP Polling" (left) and "WebSocket (not configured)" (right). Probes added monospace text lines like `GET /notifications -> [ ]` inside the left box. Static CPU/Latency number cards below.

**Why it failed:**
1. **Text in boxes, not a visualization.** The "arrows" were `← No new notifications` text lines inside dark rectangles. The player saw text, not a visual representation of requests flooding a server.
2. **Static numbers with no explanation.** CPU showed "95%" but the player didn't know why. No connection between the polling flood and the CPU spike.
3. **One connection for "50K users."** The Client box said "50K users" but had one connection line. Misleading about what the polling traffic looks like.
4. **All probes looked the same.** All three probes added similar text lines to the left box. No visual differentiation between "polling waste," "server overload," and "stuck notification."

**Attempt 2: React Flow nodes (Client + Server) with animated dots.** Two custom nodes connected by an animated edge. Probes triggered dot animations and updated the server's CPU gauge.

**Why it still needed fixes (6 rounds of iteration):**

1. **Edge label never changed.** All polling frames showed "No new notifications" as a static label, even during the request phase. The player couldn't tell when the client was asking vs when the server was responding. **Fix:** Two frames per round-trip. Request frame: dots go Client->Server, label "Any notifications?" Response frame: dots go Server->Client, label "No new notifications."

2. **Animation too fast.** Each frame played at the default `ANIMATION_DURATION_MS` (~400ms). With 8 frames, the whole polling sequence finished in 3 seconds. The player couldn't follow the round-trips. **Fix:** 1.5x frame delay for the polling probe.

3. **Dots never stopped.** The last frame set `edge.active: true` but no cleanup frame set it to `false`. Dots looped indefinitely after the animation "ended." **Fix:** Every animation must end with a frame that sets `edge.active: false`.

4. **Overload probe: dots only flowed one direction.** All frames had `reverse: false` (Client->Server). When the server responded with 503, dots should have flowed Server->Client. **Fix:** Set `reverse` correctly per frame based on data flow direction. Request = `false`, response = `true`.

5. **Payment probe: no server response after POST.** Client sent POST, server processed, but no 201/202 response came back. The client jumped straight to "notification stuck" without the server ever acknowledging the payment. **Fix:** Added a response frame (Server->Client, "202 Accepted").

6. **Payment probe: narrative contradiction (the most instructive failure).** The original flow was: Client sends POST -> Server returns "201 Created" -> Server creates notification -> notification is "stuck" -> client has to poll. But the user pointed out: if the client already received "201 Created," they already KNOW the payment is done. Why would they need a notification about it? The probe's entire premise collapsed because the narrative contradicted itself.

   **First fix (insufficient):** Changed 201 to "202 Accepted (processing...)" to make it async. But Stripe's confirmation still happened invisibly inside the Server node -- the player saw "Stripe confirms payment!" as a label on the server, but couldn't see WHERE that confirmation came from. It looked like the server magically knew.

   **Second fix (correct):** Added a third node: **Payment Processor (Stripe)**. Now the player sees the complete async flow: Client -> Server -> Stripe (via a second edge), then Stripe -> Server (confirmation comes BACK along that edge), then Server has the notification but no path to push it to Client. The three-node layout makes the async handoff visible. The player can SEE that the information travels Server -> Stripe -> Server -> (stuck, no push to Client). This is the core teaching moment: the server knows, but can't tell the client without polling.

   **Lesson:** When designing a probe's narrative, read the entire frame sequence as a story from the player's perspective. At each frame, ask: "Given what the player has already seen, does this next frame make sense?" If the server already told the client the answer in frame 3, the client shouldn't be polling for it in frame 7. And when an async process involves external actors, those actors need their own nodes so the player can see the data traveling between them.

### Final Design (PASSED)

**Three-probe observe phase using React Flow:**

**Probe 1 (Polling waste):** Client and Server nodes connected by a dashed edge. 10 frames (5 round-trips), each with two phases:
- Request: dots flow Client->Server, label "Any notifications?", server shows "auth -> query -> serialize"
- Response: dots flow Server->Client, label "No new notifications" (4 times) then "1 notification (finally!)"
- Server's request counter escalates: "1 of 25K req/sec" -> "10K of 25K" -> "25K req/sec (99% wasted)"
- CPU gauge rises visibly from 40% to 95%
- Client label: "50K users polling" (explains the single-line-for-many-users)

**Probe 2 (Server overload):** Same two nodes. Frames alternate direction:
- Client->Server: "Requests flooding in..."
- Server->Client: "All 850 DB connections used"
- Client->Server: "More requests queuing..."
- Server->Client: "Queue full! Cannot process."
- Server->Client: "DROPPED: 503" (red dots)
- Client receives "503 Service Unavailable," dots stop
- Server shows request counter: "25K req/sec from 50K users"

**Probe 3 (Stuck notification):** Three nodes appear: Client, Server, Payment Processor (Stripe).
- Client->Server: "POST /payments"
- Server->Stripe: "Charge $99.99" (via second edge)
- Server->Client: "202 Accepted (processing...)"
- Client: "Waiting for confirmation..." Stripe: "Processing..."
- Stripe->Server: "Payment succeeded" (green dots)
- Server: notification stuck, "Notification ready, but no push!"
- Clock ticks: 0s -> 0.5s -> 1.0s -> 1.5s -> 2.0s
- Client->Server: "GET /notifications (2s later)" (red dots)
- Server->Client: "Payment confirmed! (2s late)"
- Final: "2s delay because no server push"

### Key Takeaways

| Principle | Bad | Good |
|-----------|-----|------|
| **Text is not a visualization** | Monospace text lines in a dark box | React Flow nodes with animated dots traveling along edges |
| **Labels must change per phase** | Static "No new notifications" for entire animation | "Any notifications?" (request) then "No new notifications" (response) |
| **Dot direction = data direction** | All dots flow one way regardless of request vs response | `reverse: false` for requests, `reverse: true` for responses |
| **Animations must end** | Last frame has `active: true`, dots loop forever | Cleanup frame sets `active: false` |
| **Metrics need visible causes** | CPU gauge shows "95%" with no explanation | Request counter "25K req/sec from 50K users" explains the spike |
| **Scale claims must be honest** | "50K users" with one connection line | "50K users polling" explains they all hit the same endpoint |
| **Async flows need all actors** | Payment confirmed invisibly inside server node | Third node (Stripe) makes async handoff visible |
| **Narrative must be coherent** | Server returns 201 then asks "how does user know?" (they already know!) | Server returns 202 (async), Stripe confirms later, user has to poll |
| **Speed must allow reading** | Default frame delay, 3-second total animation | 1.5x delay for complex probes, each phase readable |

**Rules extracted from L37:**

1. **Every animation frame must have `reverse` set correctly.** Before writing each frame, ask: "Is data flowing Client->Server (request, `reverse: false`) or Server->Client (response, `reverse: true`)?" Write it down per frame.

2. **Every animation sequence must end with `active: false`.** Without this, animated dots loop indefinitely after the animation "finishes."

3. **Each round-trip needs two frames minimum.** One for the request phase (with request-appropriate label) and one for the response phase (with response-appropriate label). A single frame with a static label is ambiguous.

4. **When a flow involves async external services, add a node for each actor.** If Stripe processes a payment, show a Stripe node. If S3 stores a file, show an S3 node. Invisible processing inside a single node hides the mechanism the player needs to learn.

5. **Extra nodes must always be present in the layout, dimmed when not in use.** Do not add or remove nodes dynamically during animations. React Flow recomputes `fitView` when nodes appear/disappear, which causes the viewport to shift or nodes to overflow outside the visible area. Instead, include all nodes in every phase and dim the unused ones (idle flash, no label, muted border). They sit there quietly, and the player can see they exist. When a probe activates them, they light up with labels and color. Case study: L37's Payment Processor node was originally hidden and only appeared during the payment probe. It overflowed the viewport when it appeared mid-animation. The fix: always render it, dim it during polling/overload probes, activate it during the payment probe.

6. **Verify the narrative makes sense as a story.** Read through the frames like a screenplay: "Client sends payment. Server returns 201." Stop. If the server already told the client the payment is done, why would the client need a notification? The narrative is broken. Fix the story before fixing the animation.

## Checklist for New Visualizations

When designing any observe phase visualization, verify:

- [ ] **Zero-knowledge test.** Could someone who has never seen this concept understand what is going wrong? If the visualization requires the player to already understand the problem to interpret it, it has failed.
- [ ] **Origin and intent.** Can the player see WHERE the operations come from (HTTP requests, user actions, background jobs) and WHAT they are trying to do (buy 10 units, update a price)? If the visualization shows effects without causes, the player cannot build a mental model.
- [ ] **Persistent context.** Is there a visible anchor (database table, schema, request flow) that stays on screen throughout the animation? The player needs a reference point to track changes against. Abstract floating labels are not context.
- [ ] **Step-by-step narrative.** Does the animation tell a story with clear progression, or does it show a finished diagram? Each step should appear one at a time so the player can follow "first this happened, then this happened." A grid of pre-rendered rows is not a narrative.
- [ ] **Timing and causality.** If the problem involves concurrency or ordering, does the animation show WHY things happen in a certain order? A "Still computing..." or "Waiting..." state makes the timing gap explicit. Without it, the player sees an outcome but not the cause.
- [ ] **Different values test.** If the visualization shows two competing operations, are the resulting values visually distinct? Same-value conflicts (both save 5) are invisible. Use different inputs so the overwrite produces a different number.
- [ ] **Data-driven, not label-driven.** Does the visualization let the player SEE the problem in the data itself (a cell changing from 5 to 7), or does it TELL them with a red label ("LOST!")? Good visualizations make the problem self-evident; bad ones explain it with annotations. Labels should reinforce what the player already saw, not substitute for showing it.
- [ ] **Concrete consequence.** Does the visualization state the real-world impact in plain language? "18 units sold, only 8 deducted" makes the business impact clear. A technical label like "(LOST!)" or "OVERWRITE" does not.
- [ ] **Scenario plausibility.** Would a real developer encounter this exact scenario? If the scenario requires a broken API, a contrived setup, or unusual user behavior to work, rethink it. The probe should model realistic conditions where the problem naturally occurs.
- [ ] **Self-evident wrongness.** Would a non-technical person understand why the outcome is bad? "18 units sold, 8 deducted" is self-evident. "$39.99 instead of $29.99" requires domain context to judge. The wrongness should be obvious from the numbers alone.
- [ ] **Duality shown simultaneously.** If the concept is about a contrast (encrypted vs plaintext, cached vs uncached, before vs after), does the visualization show BOTH sides at the same time? A single view that toggles between states forces the player to remember. Side-by-side comparison makes the contrast self-evident.
- [ ] **Reward scenarios visually distinct.** Does each reward scenario produce a different visual result? If every scenario plays the same animation (same rows flash, same color, same duration), the stress test is visual noise. Check by firing each scenario and writing down what changes on screen. If two descriptions are identical, redesign.
- [ ] **Edge direction matches data flow per frame.** For every animation frame with `active: true`, verify `reverse` is correct. Request (Client->Server) = `false`. Response (Server->Client) = `true`. Write it down per frame.
- [ ] **Every animation ends with `active: false`.** The last frame (or a cleanup frame) must stop dots. Without this, animated dots loop forever.
- [ ] **Round-trips have two frames.** Each request-response cycle needs at least two frames: one for the request (with a request label) and one for the response (with a response label). A single frame with a static label is ambiguous.
- [ ] **Edge labels change between request and response.** "Any notifications?" on the request phase, "No new notifications" on the response phase. Not the same label for both.
- [ ] **Async external services have their own nodes.** If Stripe processes a payment or S3 stores a file, show a separate node for that actor. Don't hide the async handoff inside a single node.
- [ ] **All nodes always present, dimmed when unused.** Never add/remove nodes dynamically during animations. Include all nodes in every phase, dim unused ones (idle flash, no label). This prevents React Flow viewport shifts and overflow.
- [ ] **Narrative coherence.** Read the frame sequence like a screenplay. Does the story make sense? If the server already told the client the answer, the client shouldn't need to poll for it. Fix the story before fixing the animation.

### Build phase checks

- [ ] **Same domain throughout.** Every code snippet, service name, serializer, and param name in the build phase must use the level's domain. If the observe phase shows products, the build phase must show `Product`, `ProductSerializer`, `product_params`, not `User`, `UserSerializer`, `profile_params`.
- [ ] **Descriptions are specific, not vague.** Step descriptions should say what the player is doing and why, not use generic phrases like "for low-contention resources." Connect the description to the scenario the player just observed.
- [ ] **Center panel scrolls with tall content.** Test the build phase with the tallest OptionCard step. If content overflows without a scrollbar, the parent flex container is missing `min-h-0`. This is required on any `flex flex-col` container that has a scrollable `overflow-y-auto` child.

### Reward phase consistency checks

- [ ] **Same card format across phases.** If observe phase cards show JSON payloads, reward phase cards must show JSON payloads. Not descriptions, not actor names, not scenario labels.
- [ ] **Only show cards that participate.** If a reward scenario involves a single request, show one card. Don't render an empty second card. Track with a per-scenario flag.
- [ ] **Per-scenario failure details.** Each blocked/rejected scenario must have its own specific animation frames explaining why it failed. A generic "CHECK FAILED" shared across all failures teaches nothing.
- [ ] **Visualization matches terminal output.** If the StressTestPanel shows "INSUFFICIENT_STOCK", the request card must show why stock was insufficient (e.g., "15 < 100"). The two components are in the same panel and must tell the same story.
- [ ] **Show full concept lifecycle.** If a concept involves data traveling between client and server (like lock_version in a form), show the complete round trip: how the data was loaded, how it was sent back, and where the check happens.

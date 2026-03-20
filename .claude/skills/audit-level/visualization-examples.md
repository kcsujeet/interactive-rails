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

### Audit Trap: Structural Compliance is Not a Real Audit

**This is the most common audit failure mode. Do not skip this section.**

An audit can mark an observe phase as "PASS" because all the structural pieces are present (ProbeTerminal exists, FlowConnector exists, discoveries are defined, animation locking works) while completely missing that the visualization teaches nothing.

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

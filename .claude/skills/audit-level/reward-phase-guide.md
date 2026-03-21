# Reward Phase Design Guide

Detailed guidance for the reward (Phase 3) visualization: StressTestPanel response lines, button labels, custom reward visualization, and reward flow animation.

## Flow Animation in Reward Phase

When the reward visualization uses zone layouts (same as observe but with the fix applied):

- Reuse the same `runFlow`/`clearFlow`/`flowPhase` state from observe phase
- Define `REWARD_FLOW` messages showing the fix working (e.g., `'valid-post': ['Valid post', 'validates pass', 'Saved! 201']`)
- Zones change color based on stress test result: `border-success bg-success/10` for allowed, `border-destructive bg-destructive/5` for blocked
- FlowConnectors change `dotColor` based on result: `bg-success` for allowed, `bg-destructive` for blocked
- Flow messages color-code: `text-success` for passes, `text-destructive` for rejections

## When StressTestPanel IS Used

If the level uses StressTestPanel specifically:

- [ ] `useStressTest(scenarios)` hook manages state
- [ ] Define `STRESS_SCENARIOS` array
- [ ] Terminal-style appearance matching ProbeTerminal
- [ ] Scenario buttons use `label` field as button text, color-coded by expected result
- [ ] Auto-fire toggle gated behind 3+ manual fires
- [ ] `disabled={flowPhase !== -1}` blocks fire buttons during flow animations (see "Animation locking" section in SKILL.md)

## StressTestPanel Response Lines (Non-Negotiable)

The ProbeTerminal in the observe phase shows multi-line colored `responseLines` per probe (SQL queries, memory stats, warnings). The StressTestPanel in the reward phase must provide the same level of detail. Without response lines, the stress test feels like a dumb button clicker with no feedback beyond "200" or "403".

**Rule:** If the observe phase ProbeTerminal has `responseLines` per probe, the reward phase StressTestPanel MUST also have `responseLines` per scenario. The `StressScenario` type supports an optional `responseLines` field for this purpose.

**Observe (problem) response lines** explain what went wrong:
```
responseLines: [
  { text: 'SELECT * FROM users;', color: 'yellow' },
  { text: '-- 30 columns loaded, only 2 needed', color: 'red' },
  { text: 'Memory: 681 MB for 10K rows', color: 'red' },
]
```

**Reward (solution) response lines** show the fix working. Allowed scenarios use green, blocked scenarios use red:
```
// Allowed scenario
responseLines: [
  { text: 'User.pluck(:id, :email)', color: 'yellow' },
  { text: '-- 2 columns, plain arrays (no AR objects)', color: 'green' },
  { text: 'Memory: 2.35 MB for 10K rows', color: 'green' },
]

// Blocked scenario
responseLines: [
  { text: 'User.all', color: 'yellow' },
  { text: '-- SELECT * FROM users (30 columns, 50K rows)', color: 'red' },
  { text: 'Memory: 3.4 GB, server OOM killed', color: 'red' },
]
```

**Cross-phase parity:** The observe probe for "CSV Export" shows the problem (red lines about waste). The reward scenario for "CSV Export" shows the fix (green lines about efficiency). Same endpoint, opposite story.

**When to skip:** If the level concept is purely about access control (auth, CORS) where the response is just "allowed" or "forbidden" with no numerical detail, response lines are optional. But for any level involving data, performance, or behavior differences, response lines are required.

**Checklist:**
- [ ] Every stress scenario has `responseLines` when the observe probes have them
- [ ] Allowed scenarios use green lines, blocked scenarios use red lines
- [ ] First line is the SQL/command (yellow), subsequent lines are the result/impact
- [ ] Response lines tell the opposite story from observe (fix working vs problem occurring)

## StressTestPanel Button Labels (Non-Negotiable)

StressTestPanel buttons display `scenario.label` as the button text. The `label` must be self-descriptive: the player should understand what the button does without needing `method`, `path`, or `actor` fields (those are used in the results log for technical detail).

**When the actor/context matters to the concept (security, CORS, auth):** include it in the label. The actor IS the point of the test.

```
// GOOD: CORS level -- origin is the differentiator
{ label: 'GET /posts (from localhost)', actor: 'localhost:3001', expectedResult: 'allowed' }
{ label: 'GET /posts (from evil.com)', actor: 'evil.example.com', expectedResult: 'blocked' }

// GOOD: Authorization level -- actor role is the point
{ label: 'Owner edits own post', actor: 'owner (user_3)', expectedResult: 'allowed' }
{ label: 'Stranger deletes post', actor: 'stranger (user_7)', expectedResult: 'blocked' }
```

**When the actor/context is irrelevant (performance, refactoring):** omit it from the label. The fetching strategy or pattern IS the point, not who calls it.

```
// GOOD: Performance level -- strategy is the differentiator
{ label: 'CSV Export', actor: 'admin', expectedResult: 'allowed' }
{ label: 'Nightly Sync', actor: 'scheduler', expectedResult: 'allowed' }
{ label: 'Wide Fetch', actor: 'legacy_client', expectedResult: 'blocked' }
```

**Cross-phase consistency:** If the observe phase ProbeTerminal has a button labeled "CSV Export", the reward phase StressTestPanel should also say "CSV Export" (not `GET /api/v1/users/export.csv as admin`). The player must recognize the same endpoint across phases.

**Checklist:**
- [ ] Each `label` is unique within the scenario array (no duplicate button text)
- [ ] Labels include actor context only when the actor is relevant to the concept being taught
- [ ] Labels match the corresponding observe-phase probe labels for overlapping endpoints
- [ ] Labels are concise enough to fit in a button without truncation

## Reward Animations Must Match the Built Code (Non-Negotiable)

Every reward animation is a visual claim about how the player's code works. Before writing or auditing any reward animation, read the final code the player built (the last `getCodeFiles` output) and verify the animation against it.

**Common mistakes:**

1. **Showing cold-start behavior when the code defines cached behavior.** If the build phase defines named variants (`attachable.variant :thumb, resize_to_limit: [100, 100]`), the reward animation must show the cached case (instant redirect), not "Variant not cached, generating..." every time. Named variants are generated on first access and cached. The stress test represents repeated usage, not first-time setup.

2. **Attributing validation to the wrong component.** If `validate_content_type!` lives in the `UploadAvatar` service but the animation says "rejected at presigned URL stage," that's wrong. Trace each validation to the exact class and method in the built code. The animation label must name the correct component (e.g., "UploadAvatar: validate_content_type!").

3. **Showing behavior the code doesn't implement.** If `DirectUploadsController#create` only calls `create_before_direct_upload!` with no validation, the animation cannot show content type rejection at that endpoint. The rejection happens later, in a different class.

**Checklist:**
- [ ] Read the final code preview for the reward/activate phase
- [ ] For each reward scenario, identify which class and method handles the request
- [ ] Verify animation labels name the correct class/method
- [ ] If the built code defines cached/lazy behavior, show the cached case
- [ ] No animation shows behavior that the built code doesn't implement

**Case study: L35 Active Storage**
- "Download avatar" showed variant generation on every stress test fire, but the player defined `:thumb` as a named variant (cached after first access). Fixed to show instant 302 redirect.
- "Upload .exe" said "rejected at presigned URL stage" but `validate_content_type!` is in `UploadAvatar` service, not `DirectUploadsController`. Fixed to reference the correct service.

## When Custom Visualization IS Used

If the level uses a custom visualization for the reward:

- [ ] Player has clickable controls that trigger visual reactions
- [ ] Visual elements update dynamically (color changes, animations, state transitions) in response to player actions
- [ ] Some form of counter or progress tracker shows cumulative results
- [ ] The visualization clearly shows the fix working (green/success states) vs what would have failed before (red/blocked states)
- [ ] Allowed/success scenarios look visibly different from the observe phase (see cross-phase-consistency.md)

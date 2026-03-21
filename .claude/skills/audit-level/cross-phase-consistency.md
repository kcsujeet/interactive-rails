# Cross-Phase Consistency Guide

Detailed guidance and case studies for ensuring visual language consistency, same-component-different-state rendering, build-intro alignment, reward loop closure, and reward scenario data consistency.

## Visual Language Must Be Consistent Across Phases

The intro/observe visualization and the reward visualization must use the **same visual language**. If the intro shows annotated code with colored left borders, the reward must show annotated code with colored left borders (now green instead of amber). If the intro shows a pipeline with nodes, the reward must show the same pipeline with nodes (now fixed).

```
BAD: Intro uses annotated code blocks -> Reward uses a two-zone architecture diagram
     (completely different visual language, player can't compare before/after)

GOOD: Intro uses annotated code blocks (amber borders, "Side Effect" badges)
   -> Reward uses annotated code blocks (green borders, "Isolated" badges)
      (same visual language, player sees the transformation)
```

**Case study:** L16 originally showed annotated code in the intro but switched to a Controller box + FlowConnector + Service box layout in the reward. The player couldn't visually compare before and after because they looked nothing alike.

## Same Component, Different Visual State (Non-Negotiable)

"Same visual language" does NOT mean "identical appearance." The observe and reward phases reuse the same visualization component, but they must show **visibly different states** so the player can immediately tell the fix is working. If a player screenshots both phases and they look the same, the reward has failed.

The distinction comes from what the visualization emphasizes:
- **Observe phase** shows the PROBLEM: alarming colors (red), everything activated/wasteful, big numbers
- **Reward phase** shows the SOLUTION: calm colors (green for success, neutral/dim for unused), only the relevant parts activated, small numbers

When building a shared visualization component for both phases, add a `mode` prop (or equivalent state) that controls the color logic, not just the data. The component must render differently depending on whether it's showing broken state vs fixed state.

```
BAD: Same component, same visual logic, different data
     Observe: 2 green columns, 28 red columns, red memory bar, green memory bar
     Reward:  2 green columns, 28 red columns, red memory bar, green memory bar
     (Player can't tell which phase they're in. The "fix" looks identical to the problem.)

GOOD: Same component, mode-aware visual logic
     Observe: ALL columns red (SELECT * waste) -> 2 flash green (contrast teaches the ratio)
     Reward:  Only 2 columns glow green, 28 stay neutral/dim (clean, efficient, no red)
     (Observe feels alarming. Reward feels calm. The visual shift IS the lesson.)
```

The rule: **observe shows what's wrong (red dominates), reward shows what's right (green dominates, red only appears for blocked/failed scenarios).** If the reward still shows red for successful scenarios, it's not showing the fix working.

**Checklist:**
- [ ] Observe and reward use the same visualization component
- [ ] The component has a mode/state that changes its color logic between phases
- [ ] Observe: problem state dominates (red, alarming, wasteful)
- [ ] Reward (allowed): solution state dominates (green, calm, efficient). No red for successful outcomes.
- [ ] Reward (blocked): problem state returns (red) to show what the fix prevents
- [ ] A screenshot of each phase would look visibly different even without reading text

**Case study: L25 Narrow Fetching (identical observe and reward was wrong)**

L25 uses a "Data Table Heatmap" showing 30 database columns. The original implementation used the same color logic for both phases: fire a probe/scenario, all 30 columns turn red, then the 2 needed columns flash green, memory gauge shows red bar + green bar. The observe and reward phases were visually indistinguishable.

This failed because:
- The reward for "CSV Export (pluck)" showed 28 red columns + 2 green. But pluck SOLVED the problem. Why is there still red? The player sees the same alarming visual as the observe phase and doesn't feel like the fix worked.
- The memory gauge showed both a red "681 MB wasted" bar and a green "2.35 MB" bar in the reward. But with pluck, there IS no 681 MB load. The red bar represents a hypothetical waste that doesn't happen anymore.
- The player cannot visually distinguish "before fix" from "after fix" because both phases render identically.

The fix: the component needs a `mode` prop. In observe mode (showing the problem): all columns go red, needed ones flash green for contrast, memory gauge shows red vs green comparison. In reward mode (showing the solution): for allowed scenarios, only the needed columns glow green against neutral/dim backgrounds, no red anywhere, memory gauge shows just the green bar. For blocked scenarios (User.all), everything goes red as before, showing what the fix prevents. The visual shift from "red everywhere" (observe) to "green on neutral" (reward) is the payoff for building the fix.

## Build Steps Must Address All Problems Shown in the Intro

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

## Reward Must Close the Loop on Intro's Stated Problems

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

## Every Observe Probe Must Have a Corresponding Reward Scenario (Non-Negotiable)

**For every observe probe that demonstrates a problem, the reward phase must have a stress scenario that demonstrates the fix for that same problem.** The player discovers problems by firing probes, then verifies those problems are solved by firing stress scenarios. If a probe has no matching reward scenario, the player discovers a problem but never sees it resolved. The loop is broken.

**How to check:** Build a two-column table mapping each observe probe to its reward counterpart:

```
Observe probe              ->  Reward scenario that shows the fix
─────────────────────────────────────────────────────────────────
Upload 5MB profile photo   ->  Upload 5MB photo (direct S3 upload)
Download user avatar       ->  View profile photo (CDN redirect)
List users with avatars    ->  ??? (NO MATCHING SCENARIO)
```

If any probe has no matching reward scenario, that is a bug. The player discovered "25 users x 5MB = 125MB, no variants" but never gets to see "25 users x 15KB = 375KB, with variants." The reward feels incomplete.

**The reverse also matters:** reward scenarios that test something never shown in the observe phase confuse the player. If a reward scenario tests file validation (upload .exe, upload 50MB), but the observe phase never demonstrated the vulnerability, the player is testing a fix for a problem they never saw. This is acceptable only when the build phase explicitly taught the concept (e.g., adding content type validation as a build step). In that case, the reward scenario validates what was built, even though it was not an observe-phase problem.

**Case study: L35 Active Storage (broken probe-to-scenario mapping)**

L35's observe phase had 3 probes discovering 3 distinct problems:
1. `upload-photo`: Memory spike from buffering files through Rails (no presigned URL)
2. `request-avatar`: Downloads block Rails workers (no CDN/redirect)
3. `list-avatars`: No thumbnail variants, 25 x 5MB = 125MB bandwidth waste

L35's reward phase had 5 stress scenarios:
1. `upload-photo`: Direct S3 upload (fixes probe 1) ✓
2. `upload-10-photos`: 10 concurrent uploads (extends probe 1 at scale) ✓
3. `view-profile`: CDN redirect with thumbnail (partially fixes probe 2 + 3, but only for a single user) ~
4. `upload-exe`: Content type validation (new, not in observe) -
5. `upload-50mb`: File size validation (new, not in observe) -

Problems:
- The `list-avatars` probe showed 25 users x 5MB = 125MB bandwidth waste. No reward scenario showed "25 users x 15KB = 375KB with variants." The `view-profile` scenario only showed a single thumbnail, not the list page improvement. The player discovered a page-level bandwidth problem but only saw a single-image fix.
- `upload-exe` and `upload-50mb` tested validations the player never saw as problems. These are acceptable because the build phase taught content type and size validation, but the mapping gap for `list-avatars` is not.

**Checklist:**
- [ ] **Build a probe-to-scenario mapping table.** For each observe probe, identify the reward scenario that demonstrates its fix.
- [ ] **Every observe probe has at least one matching reward scenario.** No probe should be left without a reward counterpart.
- [ ] **The reward scenario demonstrates the fix at the same scale as the probe.** If the probe showed 25 users, the reward scenario should show 25 users (now with variants), not just 1 user with a variant.
- [ ] **Reward scenarios without observe probes are justified.** If a reward scenario tests something not shown in observe, verify the build phase explicitly taught it. If neither observe nor build introduced the concept, the scenario is orphaned.

## Reward Scenario Data Must Not Contradict Shared Visualization Components (Non-Negotiable)

When the reward phase reuses a shared visualization component (lanes, zones, nodes) across multiple scenarios, each scenario's data must be consistent with what the component displays. A common bug: a scenario maps to a lane/zone whose header shows static data (SQL query, label, table name) that contradicts the scenario's actual behavior.

**Case study: L26 "Admin: list all users" contradiction**

L26 has 3 query lanes (Email Lookup, FK Lookup, Composite Query). The `admin-all-users` stress scenario mapped to the `email` lane (since it queries the `users` table). But the Email Lookup lane's header always showed `SELECT * FROM users WHERE email = 'alice@example.com'`. When the admin scenario fired, the player saw:

```
BAD:
  Header:  "Email Lookup (users)"
  SQL:     SELECT * FROM users WHERE email = 'alice@example.com'
  Banner:  "Full table scan (no WHERE clause)"
  ← The SQL HAS a WHERE clause, but the banner says there is none!
```

The fix: add `sqlOverride` and `labelOverride` fields to scenario data so the component can display scenario-specific text instead of the lane's default.

```
GOOD:
  Header:  "Admin: All Users (users)"    ← labelOverride
  SQL:     SELECT * FROM users            ← sqlOverride (no WHERE clause)
  Banner:  "Full table scan (no WHERE clause)"
  ← Now the SQL and banner are consistent
```

**Checklist:**
- [ ] **Every reward scenario's data is consistent with its lane/zone header.** If a scenario has a WHERE clause but the lane header says "no WHERE clause" (or vice versa), add an override.
- [ ] **Scenario labels make sense in the lane context.** If "Admin: list all users" renders inside an "Email Lookup" lane, the label should override to something that makes sense.
- [ ] **Banners, badges, and status text reference the correct SQL.** If a banner says "no WHERE clause" or "no index applicable," verify the displayed SQL actually has no WHERE clause.
- [ ] **Write tests that cross-check scenario data against lane/zone definitions.** These contradictions are invisible in code review but obvious in the UI. Automated tests catch them before the player does.

## Reward Phase Type Must Match the Level's Observe Type

Not every level needs an interactive stress test in the reward phase. The reward mechanism should match the level type:

| Observe type | Reward mechanism | Example |
|---|---|---|
| Type 3/4 (interactive observe with probes) | StressTestPanel: player fires requests, sees fix working | L12 Authorization, L15 CORS |
| Type 2 (static intro, code-structure level) | Static before/after contrast + problems-solved checklist | L16 Service Objects |
| Type 1 (no observe) | May not need a reward visualization at all | L1 Setup |

A stress test ("fire requests and check allowed/blocked") makes no sense for a refactoring level where the fix doesn't change what requests get through. The reward for a refactoring level is seeing the clean code structure and confirming the original problems are resolved.

**Case study: L32 Polymorphic Associations (mismatched intro and reward)**

L32 was converted from Type 3 to Type 2 (static intro with annotated schema tables). The intro phase was correctly rebuilt as a static display showing 3 duplicate comment tables. However, the reward phase was not updated to match: it still had a StressTestPanel with terminal-style scenario firing from the old Type 3 implementation.

The result: the intro showed static database table grids (no terminal, no interactivity), but the reward showed a dark terminal with fire buttons. The two phases looked like they belonged to different levels. The player's experience was disjointed: they studied a schema diagram, built a fix, then were asked to "fire requests" at a schema change that has nothing to do with requests.

The fix: replace the StressTestPanel reward with a static before/after comparison using the same visual language as the intro. Before: 3 separate tables (compact, dimmed). After: 1 unified table with polymorphic columns highlighted in green. Same table grid components, same styling conventions, different state (problem vs solution).

**The rule: when you change the intro phase type, you must also change the reward phase to match.** Converting the intro from Type 3 to Type 2 is only half the job. The reward must follow. Check both phases together, not independently.

**Checklist for type conversions:**
- [ ] If the intro is static (Type 2), the reward is static (before/after, no terminal)
- [ ] If the intro is interactive (Type 3/4), the reward is interactive (StressTestPanel or custom controls)
- [ ] The visual components used in the intro appear in the reward (same tables, same grids, same pipeline)
- [ ] No leftover imports or hooks from the previous type (useStressTest, StressTestPanel, STRESS_SCENARIOS, useDiscoveryGating, ProbeTerminal, DiscoveryChecklist)

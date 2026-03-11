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

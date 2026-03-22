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

1. **Read [cumulative-patterns.md](../audit-level/cumulative-patterns.md).** If the player can see it, it must follow every pattern established in earlier levels. No exceptions. This applies to everything: code previews, option card snippets, visualization data, JSON responses, animation labels, banners, probe response lines. Not just code preview panels.
2. **Read [visualization-examples.md](visualization-examples.md).** Learn from past failures before repeating them.
3. **Read [implementation-rules.md](../audit-level/implementation-rules.md).** The bug table lists mistakes that have already been made. Don't add to it.
4. **Read the spec for this level** in `docs/spec.md`. Understand the concept, scenario, and what the player should learn.
5. **Read adjacent levels (N-2 to N+2).** Your visualization must be visually distinct from neighbors.

## Step 1: Narrative Reasoning (Story First)

Before any visual design, answer these four questions. Write the answers down.

### 1. What is the problem?

State it in one sentence. Not the Rails concept, but the concrete problem in the player's app.

- Good: "50,000 users polling every 2 seconds creates 25K wasted requests/sec and 95% CPU."
- Bad: "The app needs Action Cable."

### 2. How did the player get here?

Think about what the app looks like after 36 levels of building. What features exist? What would the "before" code realistically look like? Would the player have used the naive approach, a partial approach, or no implementation at all?

### 3. What does the "before" state look like?

The observe phase visualization must only show components that exist in the "before" state. If WebSocket isn't configured yet, don't show a WebSocket lane. If S3 isn't installed, don't show an S3 zone.

### 4. What does the "after" state look like?

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

### The Zero-Knowledge Test

**Could someone who has never heard of this concept understand what is going wrong by watching the visualization?** If they need to already understand the problem to interpret what they're seeing, the visualization has failed.

### Core Design Principles

Read [visualization-examples.md](visualization-examples.md) for case studies. Key principles:

1. **Show the mechanism, not the metric.** The player must see WHAT the system is doing, not just a number. A progress bar filling up is a metric. Requests flooding a server and getting queued is a mechanism.

2. **Show origin and intent.** Every action must show WHERE it comes from and WHAT it's trying to do. HTTP request cards with method, endpoint, and payload. Not abstract labels.

3. **Use different values to make conflicts visible.** If two operations produce the same result, the conflict is invisible. Use different inputs so the problem shows in the data itself.

4. **Show timing and causality.** If the problem involves ordering, show WHY things happen in sequence. "Still computing..." makes the gap explicit.

5. **Let data speak, not labels.** The visualization should make the problem self-evident. Red labels saying "LOST!" substitute for showing it. Good: a cell changing from 5 to 7.

6. **Show duality simultaneously.** When the concept is about a contrast (encrypted vs plaintext, polling vs push, cached vs uncached), show BOTH sides at the same time. Side-by-side comparison makes the contrast self-evident. A single view that toggles forces the player to remember.

7. **Make the "why should I care?" obvious.** Every visual element must answer not just "what happened" but "why is this bad?" Show the cost alongside the outcome, not just the outcome. If you have to explain why something is a problem in a separate label, the visualization hasn't shown it yet. Example: L37's polling visualization shows the server doing full work (authenticate -> query -> serialize -> respond) for each request, then returning "No new notifications." The player sees the effort wasted, not just an abstract "empty" label.

### The Literal Screen Test

After designing, describe what the player LITERALLY SEES on screen. Not what the code does. Not what the concept is.

- Bad: "8 PollArrow objects appear in the polling lane"
- Good: "8 lines of monospace text saying `GET /notifications -> [ ]` appear inside a dark box"

If your honest description sounds like "text appears in a box" or "numbers update in a stat card," the visualization is a log or a metric display, not a visualization. Redesign.

Case study: L37's visualization described as "two-lane comparison with arrows" was actually monospace text lines inside dark rectangles with static CPU/Latency number boxes. The description made it sound visual, but the screen showed text in boxes.

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
- **Correct answer never first.**
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

### Same Visualization, Different State

The reward phase reuses the same visualization component from the observe phase but shows the solution working. Observe = red/alarming. Reward = green/calm.

### StressTestPanel

See [reward-phase-guide.md](reward-phase-guide.md) for detailed rules.

- Every observe probe must have a matching reward scenario
- Reward-only scenarios must be justified by build steps
- Button labels must match probe labels in format
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
- [ ] Answer the 4 narrative reasoning questions in writing
- [ ] Choose the visualization type with one-sentence justification

### Observe phase design
- [ ] Zero-knowledge test passes
- [ ] Literal screen test passes (describe what the player SEES, not what the code does)
- [ ] Each probe produces a different visual result (written out per probe)
- [ ] Visualization shows mechanism, not metric
- [ ] Duality shown simultaneously if the concept is about contrast
- [ ] "Why should I care?" is visually obvious for every element (show cost alongside outcome, not just outcome)

### Build phase design
- [ ] Code preview transition table built and verified
- [ ] 3 options per OptionCard step
- [ ] Comments describe mechanism, not consequences
- [ ] Feedback doesn't contradict earlier steps
- [ ] ErrorFeedback above options, no auto-dismiss

### Reward phase design
- [ ] No activate phase
- [ ] Same visualization, different state (red -> green)
- [ ] Every probe has a matching reward scenario
- [ ] Each scenario produces a different visual result
- [ ] Animations match the built code

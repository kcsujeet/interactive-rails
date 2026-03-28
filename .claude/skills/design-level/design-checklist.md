# Level Design Checklist (Fill-in Worksheet)

**This is not a reference document. This is a worksheet you fill out while designing a level.** Every section requires written output. Do not proceed to the next section until the current one is complete. Do not do any section "in your head." Write it down.

The design-level skill (SKILL.md) has detailed guidance for each topic. This checklist ensures you actually execute every check by requiring concrete, written answers that make mistakes visible as data inconsistencies.

**When to use:** Every time you design a new level or redesign an existing level's visualization. Fill out each section in order. Reference the completed worksheet when implementing.

---

## Section 1: Narrative Foundation

Complete these before any visual design. Write the answers, not just "yes/no."

### 1A. Problem statement
> Write one sentence. What concrete problem is the player experiencing?
>
> _[fill in]_

### 1B. Concept foundation
> Has the player been introduced to this concept before? Trace it through earlier levels.
>
> - What the player knows from earlier levels: _[fill in]_
> - What the player does NOT know yet: _[fill in]_
> - Foundation gap? _[yes/no]_
> - If yes, how will the observe phase introduce the concept before showing problems? _[fill in]_

### 1C. Actor table
> List every entity that initiates, processes, or receives something in this level's story.
>
> | Actor | Role | Appears in which probes? |
> |-------|------|--------------------------|
> | _[fill in]_ | _[fill in]_ | _[fill in]_ |
> | _[fill in]_ | _[fill in]_ | _[fill in]_ |
> | ... | ... | ... |
>
> **Two actors that use the same channel but have different identities are separate actors.** (Stripe sending legitimate callbacks vs. an attacker sending forged POSTs = 2 actors, not 1.)

### 1D. Before state
> What does the app look like right now? What code exists?
>
> - Existing code/features: _[fill in]_
> - Does the "before" code follow cumulative patterns (L16+ services, L18+ contracts)? _[yes/no, explain]_
> - When was this code "built"? (Which earlier level established it?) _[fill in]_

### 1E. After state
> What will the app look like after the build phase?
>
> _[fill in]_

---

## Section 2: Visualization Design

### 2A. Type selection
> What runtime behavior does this level need to animate? (One sentence.)
>
> _[fill in]_
>
> Type: _[1: No observe / 2: Static intro / 3: Custom / 4: PipelineFlow]_

### 2B. Actor-to-node cross-reference
> Map every actor from Section 1C to a visualization node.
>
> | Actor (from 1C) | Node name | If no node, justification |
> |-----------------|-----------|--------------------------|
> | _[fill in]_ | _[fill in]_ | |
> | _[fill in]_ | _[fill in]_ | |
> | ... | ... | |
>
> **Gate: If any actor has no node and no valid justification, stop and add the node.**
> Valid justification: "Sub-element inside [parent node] per principle 13" (e.g., middleware inside App).
> Invalid justification: "Combined for simplicity" or "they use the same endpoint."

### 2C. Node layout
> Draw the layout (text diagram). Label every node and edge.
>
> ```
> _[fill in]_
> ```

### 2D. Visual uniqueness
> What do adjacent levels (N-2 to N+2) look like?
>
> - Level N-2: _[shape/layout]_
> - Level N-1: _[shape/layout]_
> - Level N+1: _[shape/layout]_
> - Level N+2: _[shape/layout]_
> - Is this level visually distinct? _[yes/no]_

---

## Section 3: Probe Design (fill out per probe, design reward scenario at the same time)

### Probe 1: _[name]_

**Observe:**
> - Who is the user? _[fill in]_
> - What are they doing? _[fill in]_
> - What goes wrong? _[fill in]_
> - Literal screen description (what the player SEES, not what the code does): _[fill in]_
> - Which nodes change state? _[fill in]_
> - Which edges activate? _[fill in]_
> - How is this DIFFERENT from every other probe? _[fill in]_

**Matching reward scenario:**
> - Label: _[mirrors observe label + "(with fix)"]_
> - Same start? _[yes, describe shared frames]_
> - Diverges at which frame? _[fill in]_
> - What changes at the divergence point? _[fill in]_

_(Copy this section for each additional probe.)_

---

## Section 4: Build Steps

### 4A. Step progression
> | Step | Type | What the player does |
> |------|------|---------------------|
> | 0 | _[Terminal/OptionCard]_ | _[fill in]_ |
> | 1 | _[Terminal/OptionCard]_ | _[fill in]_ |
> | ... | ... | ... |

### 4B. Code preview transition table
> | completedStep | Player just did | Preview shows | Leaks next step? |
> |---|---|---|---|
> | -1 | Nothing | _[fill in]_ | _[check]_ |
> | 0 | Step 0 | _[fill in]_ | _[check]_ |
> | ... | ... | ... | ... |

### 4C. Option shuffling (non-negotiable)
> All option arrays (OptionCard and terminal commands) MUST be wrapped with `shuffleOptions(options, stepIndex)` from `@/lib/shuffleOptions`. This randomizes answer positions per session while ensuring the correct answer is never first. Do NOT rely on hand-positioned correct answers.
>
> ```tsx
> import { shuffleOptions } from '@/lib/shuffleOptions';
> const shuffled = useMemo(() => shuffleOptions(MY_OPTIONS, stepIndex), [stepIndex]);
> ```
>
> - [ ] Every OptionCard step uses `shuffleOptions`
> - [ ] Every terminal command step uses `shuffleOptions`

### 4D. Option quality (per OptionCard step)
> | Step | # options | Feedback reveals answer? |
> |------|-----------|-------------------------|
> | _[N]_ | 3 | _[no]_ |
> | ... | ... | ... |

---

## Section 5: Cross-Phase Consistency

### 5A. Probe-to-scenario mapping
> | Observe Probe | Reward Scenario | Labels mirror? |
> |---|---|---|
> | _[fill in]_ | _[fill in]_ | _[yes/no]_ |
> | ... | ... | ... |
>
> **Gate: Every observe probe MUST have a matching reward scenario.**

### 5B. Reward-only scenarios
> | Scenario | Justified by which build step? |
> |---|---|
> | _[fill in]_ | _[fill in]_ |

### 5C. Cumulative pattern check
> - L16+ service pattern in all code previews? _[yes/no]_
> - L18+ contract pattern where applicable? _[yes/no]_
> - L7+ JSON:API format in any API responses? _[yes/no]_
> - L20+ error shape in any error responses? _[yes/no]_

---

## Section 6: Component Structure

- [ ] `LevelHeader` inside `CenterPanel` with `onValidate`, `onComplete`, `onReset`
- [ ] Phase state machine: `'observe' | 'build' | 'reward'` (no `'activate'`)
- [ ] Discovery gating with `minRequired` = total discoveries
- [ ] "Build the Fix" gated behind `discoveryGating.isUnlocked`
- [ ] ProbeTerminal and StressTestPanel `disabled` during animation
- [ ] Edge dot cleanup after last frame
- [ ] Timer cleanup on unmount
- [ ] FlowDiagram nodes are draggable (do NOT pass `nodesDraggable={false}`)
- [ ] Code preview index: `isCurrentStepCompleted ? currentStep : currentStep - 1`
- [ ] ErrorFeedback above options
- [ ] "Next Step" button: `className="gap-2" size="sm"`
- [ ] Last build step transitions directly to reward (no activate phase)
- [ ] All colors use light+dark variants (no hardcoded dark-only)

---

## Section 7: Final Verification

After implementation, before reporting done:

- [ ] `bunx tsc --noEmit` (zero errors in changed files)
- [ ] `bunx biome check --write` (zero errors)
- [ ] `bun run build` (succeeds)
- [ ] `bun test` (all pass)
- [ ] Session log updated

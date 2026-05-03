---
name: audit-level
description: Audit a level component against the three-phase sequential flow standard and narrative consistency checks. Use when reviewing, creating, or redesigning any level component.
---

# Audit Level Against Three-Phase Flow

Audit a level component to verify it follows the mandatory three-phase sequential flow pattern established in CLAUDE.md. The golden standard is: Problem Visualization -> Problem Solving -> Solution Visualization.

## Supporting Files

**Supporting files in this directory:**
- [implementation-rules.md](implementation-rules.md): Pre-flight checklist, bug table of past mistakes, core implementation principles.
- [cumulative-patterns.md](cumulative-patterns.md): **Non-negotiable.** Every architectural pattern, gem, and convention established per level. Read before every audit.
- [pipelineflow-guide.md](pipelineflow-guide.md): Hub-and-spoke layout, node state rules, edge animation specs.
- [cross-phase-consistency.md](cross-phase-consistency.md): Visual language consistency, probe-to-scenario mapping, reward loop closure.
- [terminal-layout-guide.md](terminal-layout-guide.md): Terminal sizing patterns (A/B/C), flex layout rules.

## Related Skill: design-level

For **designing** a new level or **redesigning** a broken visualization, use the `design-level` skill. It provides the creative design workflow (visualization concept, probe design, build step design, reward design). This skill (`audit-level`) focuses on **reviewing and verifying** an existing level against the standards.

## CRITICAL: These Rules Apply During Implementation, Not Just Audits

**Read [implementation-rules.md](implementation-rules.md) before building or modifying any level.** It contains the pre-flight checklist, bug table of past mistakes, and core principles for writing animation frames, code previews, and connectors. Every check in this audit skill applies when BUILDING a level, not just when reviewing one.

## Step -1: Narrative Reasoning (DO THIS BEFORE ANYTHING ELSE)

**Before any structural check, before any visualization review, before reading the code: answer these questions about the level's story.** This is the foundation everything else is built on. If the story is wrong, no amount of correct animation or structural compliance matters.

### 1. What is the problem this level presents?

State it in one sentence. Not the Rails concept ("Active Storage"), but the concrete problem the player is experiencing in their app. Example: "Product photos are being uploaded through the Rails server, spiking memory and blocking workers."

### 2. Would the player even know what this concept is?

**This is the most commonly missed check.** Before asking whether the visualization is good or the build steps are correct, ask: **"Has the player been introduced to this concept before? Would they understand the level's premise?"**

Trace the concept back through earlier levels. If Level N assumes the player knows X, there must be a level before N that taught X, or Level N itself must introduce X before showing its problems.

**What to check:**
- **Does the level assume familiarity with a concept never taught?** If the level says "Stripe webhook fires twice," but no earlier level explained what a webhook is, why Stripe sends them, or how the player's app receives them, the player is lost before the first probe fires.
- **Is there a "how did this get here?" gap?** If the observe phase shows code that already exists (a webhook controller, a payment processor, an S3 bucket), ask: "When did the player build this?" If the answer is "they didn't, it was assumed to exist," the level has a foundation gap.
- **Does the level introduce a new external system without context?** If L38 taught outbound Stripe calls, L39 cannot assume the player understands inbound Stripe callbacks. Outbound and inbound are fundamentally different concepts. The level must bridge from "we call Stripe" to "Stripe calls us" before showing what goes wrong.

**How to fix foundation gaps:** The observe phase must include introductory context. Before showing problems, establish: What is this thing? Why does the app need it? How was it set up? This can be done through scenario text, the first probe's story, or an introductory animation sequence that shows the happy path before revealing the vulnerability.

Case study: L39 originally jumped straight to "Stripe webhook fires twice, customer charged twice." But the player had never learned what a webhook is, why Stripe needs to call back, or when the webhook handler was set up. The level taught how to secure a webhook handler without first teaching what a webhook handler is. The fix: restructure the observe phase to first show the async payment flow (customer pays -> Stripe processes -> Stripe calls back with result), establishing why webhooks exist, before revealing the three vulnerabilities.

**Check ALL player-facing text for solution leakage (non-negotiable).** The solution name (e.g., "v2", "webhook", "circuit breaker") must not appear as assumed knowledge in any of these locations. The trigger and problem describe what's WRONG using concepts the player already knows. The SOLUTION is what they discover by playing.

Scan each of these in content.ts AND the component:
- `trigger.description`
- `problem.observation`
- `problem.goal` -- **Must NOT name specific gems, tools, methods, or classes that the player will choose in build steps.** Describe the outcome ("implement soft deletes with an audit trail"), not the implementation ("install discard gem and PaperTrail"). If the goal says "Install Pagy" and step 0 asks "which pagination gem?", the step is a trivial lookup. The goal describes WHAT the player will achieve, never HOW (which specific tool).
- `learningContent.goal` -- Same rule. Describe learning outcomes, not tool names. "Learn to paginate API responses with Link headers" is fine. "Install Pagy and configure Pagy::OPTIONS" is a spoiler.
- Left panel scenario text
- Probe labels and story fields
- `hint.text` (acceptable with delay, but check)
- **Wrong-option feedback strings** -- See "Feedback answer leak scan" section below. Feedback must never name the correct answer.

**This check covers TWO distinct failure modes:**
1. **Content.ts fields** (goal, trigger, observation, hint) that name the solution before the player discovers it.
2. **Component feedback strings** that name the correct answer when explaining why a wrong choice is wrong.

Both are equally damaging: the player reads the answer before making the choice.

Case study (content.ts): L43's `problem.goal` said "Implement soft deletes with the discard gem and audit trails with PaperTrail." The build step asked "which gem to install?" but the goal already named both gems. The player reads the goal on the briefing screen before gameplay starts, making the gem selection steps trivial.

Case study (feedback): L43's wrong-option feedback said "Paranoia overrides destroy. Discard is explicit and non-invasive." The feedback directly named the correct gem. The player picks the wrong answer, reads the feedback, and now knows exactly what to pick.

Case study (content.ts): L40 had "v2" as assumed knowledge in three separate places: trigger ("Product wants breaking changes for v2"), problem.observation ("Product wants v2 to return..."), and scenario text. Each was caught and fixed separately because the check was only applied to the trigger the first time. Check all locations in one pass.

### 3. How did the player get into this situation?

Think about the act context and what came before. By Act 5, the player has built a full e-commerce app with models, controllers, services, validations, associations, testing, and performance optimizations across 34 levels. Ask:

- **What would the app realistically look like right now?** What features exist? What tech is already in place?
- **How would the player have implemented the "before" state?** Would they have used the naive approach, a partially-correct approach, or no implementation at all?
- **Does the "before" code make sense for someone at this skill level and stage of the app?**

Example of getting this WRONG: L35 showed `user.avatar.attach(@file)` (Active Storage API) in the observe phase, then asked the player to "Install Active Storage" in the build phase. If Active Storage is already being used, why are we installing it? The "before" state contradicted the build steps.

Example of getting this RIGHT: The player has been saving files manually to disk (naive approach). The problem is memory spikes, no CDN, no variants. The build phase introduces Active Storage as the upgrade.

### 4. Does the visualization match the "before" state?

The zones, nodes, and flow in the observe phase must reflect what actually exists in the "before" code. If the code saves files to the app server's local disk, the visualization should NOT show an S3 zone. If Active Storage isn't installed, there's no blob tracking. The visualization must be honest about what the player's app looks like right now.

**Check observe probe animation frames.** For each probe, verify that the animation frame data only references zones/connectors that exist in the "before" state. If a zone (e.g., S3 Storage) is introduced by the build phase, no observe probe frame should set state on that zone. Case study: L35's observe probes originally set `s3` and `connB` state, but S3 doesn't exist until Active Storage is configured in the build phase.

**Check zone rendering is conditional.** If the observe and reward phases show different numbers of zones (e.g., 2 zones in observe, 3 in reward), verify that `renderUploadPipeline` (or equivalent) conditionally renders zones based on phase. Don't render zones that don't exist in the current narrative state.

### 5. Does the build phase bridge from "before" to "after"?

The build steps should transform the "before" state into the "after" state. Every step should make sense in sequence. If step 1 is "Install Active Storage" but the observe code already uses Active Storage APIs, the bridge is broken.

### 6. Does the narrative state match the curriculum's actual state at this level?

The trigger description, scenario text, and probe stories must be coherent with where the curriculum actually is at this level. **No time-travel narration.** A level that says "an audit flagged…" but is positioned before the app has shipped, has users, or has audit relationships, is time-traveling — fix the framing, not the lesson.

For the forbidden-tropes table (pre-deploy, no users yet, no payments yet, no production data, no API versioning), the L10 case study, and the full list of player-visible strings to scan, see [narrative-state-coherence.md](narrative-state-coherence.md).

**If any of these questions (1–6) reveal an inconsistency, stop and fix the narrative before proceeding with the rest of the audit.** Structural compliance, animation quality, and visualization design are all downstream of narrative coherence.

---



Before auditing or building any level that involves a gem, library, or Rails feature:

1. **Identify every gem/library the level teaches** (e.g., Pundit, Devise, RSpec, FactoryBot)
2. **Fetch the full README.md** from the official GitHub repo using `WebFetch`. Read the ENTIRE README, not a summary. Pay special attention to:
   - "Installation" / "Getting Started" sections (every step listed here must appear in the level)
   - Class/module names and inheritance patterns
   - Configuration requirements (initializers, includes, migrations)
3. **Fetch generator template files** if the level includes a generator step. Check `lib/generators/` in the gem's repo to see what files are actually created and what their contents look like
4. **Cross-reference every code snippet in the level** against the README. Flag any discrepancies: wrong class names, wrong method signatures, outdated inheritance patterns, missing setup steps
5. **Never trust cached knowledge.** Gems rename modules, change inheritance hierarchies, and add/remove setup steps between versions. The README is the single source of truth

This step is non-negotiable. Skipping it has caused bugs in the past (wrong Scope inheritance, missing `include` steps, fake generator output).

## Gate Check: Does the Observe Phase Teach the Concept? (EVALUATE FIRST)

**This is the single most important check in the entire audit. Evaluate it BEFORE any structural compliance checks. If this fails, nothing else matters.**

**Do NOT skip this to fix TS errors or prop mismatches first.** Mechanical issues (wrong props, missing imports, type errors) are tempting to fix immediately because they have clear, satisfying solutions. But fixing 11 type errors on a visualization that doesn't teach anything produces a level that compiles but still fails. Evaluate the visualization FIRST. If it's broken, flag it as FAIL and redesign before touching any code. Case study: L37 had 11 critical TS errors that consumed the entire audit's attention. The visualization (text lines in boxes with static numbers) got a "conditional pass" because the concept description sounded good. But the player saw nothing that taught them what polling waste looks like.

The core principle: every visualization must be understandable by a player who has never encountered the concept. If the visualization needs redesign, use the `design-level` skill.

### Step 1: Identify the observe phase type

| Type | Observe phase | What "teaches the concept" means |
|------|--------------|----------------------------------|
| **1. No observe** | Skipped entirely | N/A. Pure setup, no problem to teach. Gate check passes automatically. |
| **2. Static intro** | Annotated code display | The code structure IS the lesson. Colored borders, badges, and a callout make the structural problem visible. No animation or interactivity needed. |
| **3. Custom visualization** | Bespoke animated layout | Visual objects (blocks, arrows, zones, grids) animate to show the runtime mechanism. ProbeTerminal drives the animation but is NOT the visualization itself. |
| **4. PipelineFlow** | Interactive node graph | Pipeline nodes react to probes with variant/sublabel changes, edges animate sequentially, StageInspector overlays reveal code. |

**If you cannot immediately identify the type, that is already a problem.**

### Step 2: Apply the design check for that type

**Type 1 (no observe):** No check needed. Move on to the build phase audit.

**Type 2 (static intro):** Ask: "Does the annotated code display make the structural problem self-evident?" If it needs extensive text explanation, either the annotations are insufficient or it should be Type 3.

**Type 3 (custom visualization):** Ask: **"If I were a player who had never heard of [concept], would I understand what it IS and DOES by watching this visualization?"** Then check:
1. **Is there a visual component above/alongside the ProbeTerminal?** If the center panel is ONLY a ProbeTerminal with no visual component, the level has no visualization. Stop and redesign.
2. **Does that visual component show objects (blocks, arrows, cards, zones, grids) that animate and change state?** If it only shows text, numbers, or static labels, it's a metric display, not a mechanism. Stop and redesign.
3. **Does the visual component react to probe fires with visible state changes?** If probe fires only add text to a log, there is no visual feedback loop. Stop and redesign.

**Type 4 (PipelineFlow):** Ask: "Do the pipeline nodes visually react to probes?" Then check:
1. **Do node variants change on probe fire?** Broken -> `'danger'`, downstream -> `'inactive'`, working -> `'active'`.
2. **Do edges animate sequentially?** `activeConnections` should light up edges in order.
3. **Does StageInspector reveal meaningful code on click?**

**If any sub-check fails, do not proceed with the rest of the audit.** Flag the observe phase as fundamentally broken and redesign it before checking anything else.

### Step 3: Probe-by-probe playthrough (MANDATORY for Types 3 and 4)

**Structural compliance is not a real audit.** Verifying that hooks exist, props are passed, and components are imported tells you nothing about whether the visualization teaches the concept. You MUST mentally (or actually) play through each probe and write down what the player sees.

**For each probe, answer these questions in writing:**
1. What animation plays when this probe fires? (Describe the specific zone/node states, text labels, colors, and timing.)
2. How is this animation DIFFERENT from every other probe's animation?
3. Does the animation content match what the probe label claims to test? (e.g., a "Download avatar" probe should not show "Sending file..." and "Stored")
4. After watching this probe's animation, could a newcomer explain what went wrong?

**Honesty test for question 1:** Describe what the player LITERALLY SEES on screen, not what the code does. "8 PollArrow objects appear in the polling lane" is a code description. "8 lines of monospace text saying `GET /notifications -> [ ]` appear inside a dark box" is what the player sees. If your honest description sounds like "text appears in a box," the visualization is a log, not a visualization. Case study: L37's probe-by-probe description said "8 arrows appear in polling lane, 7 empty" which sounded visual, but the actual screen showed monospace text lines inside a dark rectangle. The word "arrows" made it sound more visual than it was.

**If any two probes produce the same animation, the visualization fails.** Each probe exists to teach a different aspect of the problem. Identical animations mean the visualization is generic instead of specific.

**If the animation content contradicts the probe label, the visualization fails.** A download probe that shows upload animation, or a listing probe that shows single-file flow, teaches the wrong concept.

**If visual signals within a node contradict each other, the visualization fails.** Every visual indicator inside a node (gauges, progress bars, badges, labels, border color) must agree on whether the state is healthy or dangerous. A node with a red danger border but a green memory gauge, or a "BLOCKED" label with a healthy progress bar, sends mixed signals. When a probe frame sets `flash: 'red'` on a zone, check that ALL internal indicators (memoryMB, bandwidthLabel, badges) also reflect the danger state. Case study: L35's list probe set `flash: 'red'` on the App Server (red border, red label text) but never set `memoryMB`, so the memory gauge stayed at 45MB (green). The node screamed danger at the border but showed "everything is fine" inside.

**Do not skip this step.** Case study: L35 Active Storage passed all structural checks (ProbeTerminal present, FlowConnector present, discoveries defined, animation locking correct) but all three probes played the exact same animation. See the `design-level` skill's visualization-examples.md "Audit Trap" section.

For detailed case studies (L27 terminal-only failure, ProbeTerminal-is-not-a-visualization architecture), see the `design-level` skill's observe-phase-guide.md.

## Checklist

The detailed audit checklist (Phase 0 concept fit, Phase 0b narrative consistency, project/component structure, Phase 1 problem visualization, Phase 2 problem solving, Phase 3 reward, step quality, tests, cross-phase consistency, state machine, CSS/animation, color contrast) lives in [audit-checklist.md](audit-checklist.md). Open that file when running an actual audit — it walks every check phase by phase.

Quick orientation:

- **Phase 0 / 0b** — concept fit (does this level belong here?), narrative consistency (does the content match the app state?), cumulative-pattern compliance (every player-visible string follows patterns established in earlier levels).
- **Project + Component structure** — bulletproof-react layout, no cross-feature imports, `<LevelHeader>` inside `<CenterPanel>`, `onValidate` / `onComplete` / `onReset` wired correctly.
- **Phase 1 (problem visualization)** — pick the observe phase type (1/2/3/4), accuracy of zones + connectors, mechanism vs metric, uniqueness across adjacent levels, required interactivity, animation locking, terminal-component layout, panel structure.
- **Phase 2 (problem solving)** — gem install + generator + migration steps included, code preview honesty, option quality (3 options shuffled, same color, no answer leaks in feedback), the dedicated **feedback answer leak scan** (separate pass — easy to skip when burying it inside option quality).
- **Phase 3 (reward)** — type-matched (Type 2 static before/after, Types 3/4 interactive), reward animation cross-checks against the built code, panel structure, every observe probe has a matching reward scenario.
- **Tests, state machine, CSS, color contrast** — strict tests only (no `array.length > 0`), no activate phase, Tailwind v4 / Lightning CSS rules, semantic tokens with `dark:` variants.

Supporting deep-dives: [cross-phase-consistency.md](cross-phase-consistency.md), [cumulative-patterns.md](cumulative-patterns.md), [pipelineflow-guide.md](pipelineflow-guide.md), [terminal-layout-guide.md](terminal-layout-guide.md), [implementation-rules.md](implementation-rules.md), [narrative-state-coherence.md](narrative-state-coherence.md).

## Output Format

Present findings as:

1. **Concept fit**: Does this level belong at this position in the curriculum?
2. **Narrative consistency**: Any schema ghosts, concept overlaps, or trigger gaps?
3. **Visualization assessment**: Is the current visualization unique and concept-appropriate, or is it a generic pipeline that should be replaced with something custom? **If a level already has a custom visualization, recommend keeping it and adding interactivity rather than replacing it.**
4. **Pass/Fail** for each of the 3 phases
5. **Flow animation assessment**: If using custom zone layouts, does the flow animation pattern follow the standard? (flowPhase, FlowConnector, disabled props, auto-inspect, message persistence, zone content gated behind flowPhase)
6. **Step quality**: Are steps meaningful, progressive, and satisfying?
7. **Missing steps** in the build phase (especially gem install, generators, setup)
8. **CSS/animation compliance**: Any `var()` in keyframes, missing `@theme` entries, inline animation styles, or ArrowDown icons that should be FlowConnectors?
9. **Specific code locations** that need changes (file:line)
10. **Suggested fix** for each issue found

If the level passes all checks, confirm it follows the golden standard.

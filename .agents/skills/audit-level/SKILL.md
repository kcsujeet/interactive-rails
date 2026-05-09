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

**Project-wide design lens:**
- [`.agents/rules/rails-principles.md`](../../../.agents/rules/rails-principles.md) § "The Shopify lens (design for billion-dollar scale, on Rails 8)": when stuck on a Rails design choice, ask "what would Shopify do, **on Rails 8**?" Rails 8 modern API surface (params.expect, Solid Queue/Cache/Cable, Kamal 2, Thruster, Propshaft, `bin/rails generate authentication`, `User.authenticate_by`) takes priority over legacy patterns. Reject weak defenses ("what if X is forgotten") that lint / specs / CI already catch. Single source of truth beats redundancy. **Apply this lens whenever the audit surfaces a "should the level use pattern A or pattern B?" decision.**

## Related Skill: design-level

For **designing** a new level or **redesigning** a broken visualization, use the `design-level` skill. It provides the creative design workflow (visualization concept, probe design, build step design, reward design). This skill (`audit-level`) focuses on **reviewing and verifying** an existing level against the standards.

## CRITICAL: These Rules Apply During Implementation, Not Just Audits

**Read [implementation-rules.md](implementation-rules.md) before building or modifying any level.** It contains the pre-flight checklist, bug table of past mistakes, and core principles for writing animation frames, code previews, and connectors. Every check in this audit skill applies when BUILDING a level, not just when reviewing one.

## Audit discipline: finding issues does NOT end the audit

**The most common failure mode of this skill is stopping after the first batch of issues turns up.** Each section catches a DIFFERENT class of bug. Skipping later sections because earlier ones already produced a fix list means that bug class never gets caught.

| Section | Catches |
|---------|---------|
| Step -1 (narrative reasoning) | Trigger / observation / probe stories that contradict the curriculum's actual state at this level |
| Step 0 (WebFetch external APIs) | Fabricated method names, wrong gem inheritance, stale class hierarchies |
| Gate Check Step 1 (type-fit) | Levels using Type 4 (PipelineFlow + probes) when their lesson is code-structure (Type 2), or vice versa |
| Gate Check Step 2 (design) | Visualizations that show metrics instead of mechanisms; ProbeTerminal-only with no visual component |
| Gate Check Step 3 (probe-by-probe playthrough) | Visual contradictions inside a single node (red border + green "OK" badge), identical animations across probes, animations that don't match probe labels |
| Phase 1 / 2 / 3 checklists | Structural compliance, accessibility, rendering issues |

**The discipline:** run every check, log every issue, THEN start fixing. Fixing mid-audit is the trap — once you have a list of obvious narrative issues to fix, momentum pulls you out of the audit. Resist. Finish the audit first.

**Case study (2026-05-06):** L13 audit. Step -1 caught 6 narrative issues immediately (admin column fabricated against schema, `current_user` vs `Current.user`, stage inspector mismatch, `problem.goal` answer leak, conceptExplanation "Replaces" overstatement, probe foundation gaps). Auditor declared the audit complete and started fixing. **Never ran Step 1 (type-fit) or Step 3 (probe-by-probe playthrough).** Shipped a level with:
- A `duplicate-field-list` probe whose label is an inspection, not an action ("Inspect the controller") — would have been caught by "Probes are problems" (`pedagogy.md` § Observe phase rules: probes are verb-led actions, not inspections).
- A `Product Model` node with a red border and a green `OK` badge inside — would have been caught by Step 3 (probe-by-probe playthrough): "every visual indicator inside a node must agree."
- Probes that didn't represent fireable problems (one was hypothetical: "imagine adding user_id"; iteration 2 expected a happy-path response) — would have been caught by "Probes are problems" (`pedagogy.md` § Observe phase rules).
- A separate Type-fit failure: an auditor recommended Type 2 for L13 because "the lesson is code-structure refactoring" — wrong, L13 has runtime behavior (shape attacks, mass-assignment exploits). Type 4 is correct. Would have been caught by the Type 2 disqualification gate (Step 2 below).

The rules existed. The auditor didn't run them. **The audit is a checklist, not a fix list.**

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

**Visualization vocabulary must match curriculum state (NON-NEGOTIABLE).** "Components" in this rule means *every concept rendered in the visualization*, not just file-level entities (models, controllers, gems). It includes:
- Pipeline stage labels (`Build`, `Test Gate`, `Production`, `CI`, `Deploy`).
- Node sublabels and badges (`PROMOTED`, `STAGING`, `BLOCKED at gate`).
- Probe labels (`Deploy: drop params.expect filter`).
- Stress scenario labels (`Promote build to staging`).
- Stage-inspector titles and descriptions.
- Edge labels.

For each player-visible string in the visualization, identify the concept it names and the level that introduces that concept. Anything pointing at a level > the current level is a future-concept pre-bake and FAILS this check. Pre-L14 the player has built models, routes, controllers, auth, encryption, Pundit, validations, strong params — they have NOT built CI, build pipelines, deployment, staging, or production environments (those arrive at L40s+). Showing `Build` / `Test Gate` / `Production` nodes at L14 is the same class of bug as L4's original router/controller/serializer pipeline.

**The `inactive` variant does NOT redeem a pre-baked future concept.** Rendering an unfamiliar future-concept node as dimmed/dashed makes it baffling to a first-time developer ("what is this thing? am I supposed to know?") rather than honest. The fix is to remove the node entirely, not soften its variant. Case study: L4 originally showed Router/Controller/Serializer/Response (L6/L7/L8 territory) and tried to make them "less wrong" by setting variants — fix was full visualization redesign with only the two model nodes that actually exist at L4. L14's first cut made the same mistake with a CI/CD pipeline framing (Code/Build/Test Gate/Production) — fix was to drop the pipeline framing entirely, since none of those concepts exist pre-L14.

**Probe + scenario labels must be actions the player can recognize and identify with at this level.** A first-time developer at L14 edits code in their editor, saves, and runs `bin/rails server` or `bundle exec rspec`. They have never deployed, promoted a build, or pushed through a CI gate. A probe labeled `Deploy: ...` assumes vocabulary the curriculum hasn't introduced. Honest probe labels at L14 are things like "Drop params.expect from the controller" (an action the player takes in their editor) — not "Deploy a regression" (an action that requires deployment infrastructure).

Audit recipe: list every node label, sublabel, badge, probe label, scenario label, and stage-inspector title from the level. For each, write down the concept and the level that introduces it. If any item references a concept introduced after the current level, FAIL. If any item uses vocabulary a first-time developer wouldn't recognize at this stage (per `level-content.md` audience rule), FAIL.

**Damage-first check (NON-NEGOTIABLE).** See `pedagogy.md` § "Show the damage, then introduce the fix". The visualization's headline visual weight must rest on the customer-facing damage that occurs when this level's concept is missing — not on artifacts (a spec file, a config file), not on tools (an Editor node, a Test Runner node), not on abstract status grids (`?` / `✓` / `✗` cards). For each level under audit, list the visualization's primary visual elements and ask: "is this the damage, or is it just the artifact / tool / status?" If anything except the damage carries the headline visual weight, FAIL. The smell test from `pedagogy.md` applies: would a first-time developer seeing this observe phase feel motivated to do the build phase, or would they say "neat artifact, I guess?" L14 (Testing) is the worked-failure case study — three iterations polished the wrong answer (pipeline / tool nodes / status cards) before the redesign landed on a customer-impact dashboard that actually stakes the player.

### 5. Does the build phase bridge from "before" to "after"?

The build steps should transform the "before" state into the "after" state. Every step should make sense in sequence. If step 1 is "Install Active Storage" but the observe code already uses Active Storage APIs, the bridge is broken.

### 6. Does the narrative state match the curriculum's actual state at this level?

The trigger description, scenario text, and probe stories must be coherent with where the curriculum actually is at this level. **No time-travel narration.** A level that says "an audit flagged…" but is positioned before the app has shipped, has users, or has audit relationships, is time-traveling — fix the framing, not the lesson.

For the forbidden-tropes table (pre-deploy, no users yet, no payments yet, no production data, no API versioning), the L10 case study, and the full list of player-visible strings to scan, see [narrative-state-coherence.md](narrative-state-coherence.md).

### 7. (Form-axis levels only) What canonical bug class does this level fix, and does the before-state exhibit it?

Run this check ONLY for form-axis levels (those replacing an existing pattern's form — see `pedagogy.md` § Cumulative patterns for the category check). Existence-axis levels (e.g., L9 auth, L14 testing) skip Question 7.

1. WebFetch the canonical docs for the pattern this level teaches.
2. Quote the sentence(s) that name the problem the pattern was built to solve.
3. Re-read the before-state. Does it exhibit that problem?

If the before-state is already safe — if the bug the pattern fixes does not exist in earlier levels — the level cannot teach what it claims to teach. Either the before-state must be redesigned to exhibit the bug, or the level's claimed purpose must be revised.

**Case study (L13 Strong Params, 2026-05-06):** Per the [Rails Action Controller guide](https://guides.rubyonrails.org/action_controller_overview.html): *"With Action Controller Strong Parameters, parameters cannot be used in Active Model mass assignments until they have been explicitly permitted."* The canonical bug class is mass assignment. After a cumulative-patterns sweep, L7–L12 controllers used explicit-field extraction (mass-assignment-safe by construction). L13's claim to teach "Strong Params: the security feature" was hollow — the bug class did not exist in the before-state. Question 7 forces the WebFetch + before-state check; running it would have caught this. The fix per [ActionController::Parameters docs](https://api.rubyonrails.org/classes/ActionController/Parameters.html): pre-L13 controllers use `to_unsafe_h` (real mass-assignment vulnerability, no `permit`/`expect` API exposed).

**If any of these questions (1–7) reveal an inconsistency, log it as an audit issue — but DO NOT start fixing yet.** Structural compliance, animation quality, and visualization design are all downstream of narrative coherence, but they are also CHECKS YOU STILL NEED TO RUN. Continue to Step 0 (WebFetch) and Gate Check (type-fit + design + probe-by-probe playthrough). The "audit discipline" rule at the top of this file is the canonical reason: each section catches a different bug class, and stopping after Step -1 leaves type-fit and probe-by-probe checks un-run.

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

## Step 0.5: Cross-verify against the myapp project (NON-NEGOTIABLE)

The curriculum is anchored to a real Rails app at `project/myapp/` (gitignored). Each level corresponds to a tagged commit (`level-N`) representing the actual on-disk state after that level's commands and edits run against Rails 8 + PostgreSQL. The level definitions in `src/features/` simulate this state via `getCodeFiles`, stage inspector code, probe response lines, terminal output, and build-step file diffs.

**Rule:** the simulated content in a level MUST match what `git show level-N:<path>` produces in the myapp project. When the two disagree, the level is wrong (not myapp). If myapp itself is wrong, fix it first via real Rails commands, then mirror the actual output into the level — never the other way around.

What to cross-verify:

- **`getCodeFiles` reward snapshot** vs. actual files in `git show level-N:<file>` (myapp).
- **Stage inspector `code` field** vs. actual code at the same level tag.
- **Probe / scenario response lines** that simulate Rails behavior — verify against `bin/rails routes`, `bin/rails runner`, `curl`, or specs run at the relevant tag.
- **Terminal output for build-step commands** (`bin/rails generate ...`, `bundle add ...`, `bin/rails db:migrate`) vs. actual stdout when those commands run against the prior level's tag.
- **Code preview transitions** between build steps vs. the diff between `level-(N-1)` and `level-N` commits.

Concrete check:

```bash
cd project/myapp
git show level-13:app/controllers/api/products_controller.rb
# vs. the level's getCodeFiles('reward', LAST_STEP) for L13
# and vs. the STAGE_INSPECTOR_MAP['controller'].code field
```

If they differ, decide: did the level fabricate a method/file/output, or did myapp drift? Per the canonical-docs rule, the source of truth flows: official docs → real command in myapp → level data. Never the reverse.

This applies to BOTH form-axis levels (where the form must match across L7-L12, L13, etc.) and existence-axis levels (where the generator output, gem install commands, and migration files must match real Rails 8 / gem behavior).

**Case study (L13 Strong Params, 2026-05-09):** The L13 redesign in `src/` was committed before myapp's commit chain was rewritten. For ~24 hours, src/ taught `params.expect(product: [:name, :description, :price])` while myapp's `level-13` tag still had the older `params.require(:product).permit(...)` pattern. A player following the curriculum end-to-end with `git checkout level-13` in myapp would have seen a different controller than the game promised. Phase C re-tagged myapp commits `level-8` through `level-13` to match the redesigned curriculum. Running this Step 0.5 check would have flagged the misalignment immediately.

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

**Type 2 disqualification gate (NON-NEGOTIABLE).** Before settling on Type 2, verify the lesson has NO runtime behavioral differences to demonstrate. Specifically, answer NO to all three:

1. Does the level involve different inputs producing different outcomes (e.g., attack payloads succeed vs fail, valid vs invalid data, broken vs fixed behavior)?
2. Does the reward phase need to show the fix's effect on running code (not just the new code's text)?
3. Does the lesson have security or correctness implications (vulnerability vs protection)?

Any YES disqualifies Type 2. Choose Type 3 (custom visualization) or Type 4 (PipelineFlow) so the player can SEE the runtime difference, not just read about it.

**Case study (L13 Strong Params, 2026-05-06):** During L13 redesign, an auditor recommended Type 2 because "the lesson is code-structure refactoring — replace explicit fields with `params.expect`." Wrong. L13's lesson also includes mass-assignment vulnerability (runtime — `role=admin` succeeds in the before-state, fails in the after-state per [Rails Action Controller docs](https://guides.rubyonrails.org/action_controller_overview.html)). The reward phase needs to demonstrate `params.expect` rejecting attack payloads (runtime). Type 4 with PipelineFlow + probes is correct. The Type 2 misrecommendation came from collapsing "the lesson involves code" into "the lesson is ONLY code structure" — false. A lesson can involve code AND runtime behavior; Type 2 is reserved for the rare cases that involve ONLY code structure with no runtime aspect at all.

**Type 3 (custom visualization):** Ask: **"If I were a player who had never heard of [concept], would I understand what it IS and DOES by watching this visualization?"** Then check:
1. **Is there a visual component above/alongside the ProbeTerminal?** If the center panel is ONLY a ProbeTerminal with no visual component, the level has no visualization. Stop and redesign.
2. **Does that visual component show objects (blocks, arrows, cards, zones, grids) that animate and change state?** If it only shows text, numbers, or static labels, it's a metric display, not a mechanism. Stop and redesign.
3. **Does the visual component react to probe fires with visible state changes?** If probe fires only add text to a log, there is no visual feedback loop. Stop and redesign.

**Type 4 (PipelineFlow):** Ask: "Do the pipeline nodes visually react to probes?" Then check:
1. **Do node variants change on probe fire?** Broken -> `'danger'`, downstream -> `'inactive'`, working -> `'active'`.
2. **Do edges animate ONLY on probe fire?** `activeConnections` must default to `[]` (dormant) and become `['edge-id', ...]` only when a probe fires. **Passing `undefined` puts edges into continuous idle animation, which implies data is flowing before the player has done anything — a trap.** Grep for `<PipelineFlow` and verify every match has `activeConnections=` in the props (the CI test at `KNOWN_AUTO_ANIMATING_EDGES` enforces this).
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

Second case study: L13 (2026-05-06). The auditor ran Step -1 thoroughly, found 6 narrative issues, declared the audit complete, and skipped Step 3 entirely. Result: shipped a level where the `duplicate-field-list` probe sets `dbBadge: 'OK'` on the model AND the orchestrator's logic flips `variant: 'danger'` on every probe fire. Result on screen: red Product Model border with a green "OK" badge inside. The visual-signals-must-agree rule existed; the auditor just didn't run the check. The fix is not adding more rules — it's actually running the rules that exist.

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

---
paths:
  - "**/Level*.tsx"
  - "**/content.ts"
  - "**/data/*.ts"
---

# Three-Phase Pedagogy: The Visible-Change Gate

This rule auto-loads when you touch any level file. It exists to catch the **single most common pedagogy failure**: shipping an observe phase where probes update a left-panel checklist but do not visibly mutate the center-panel visualization. The probe terminal text alone does **not** satisfy the observe-phase pedagogy.

The deeper guidance lives in the `design-level` and `audit-level` skills (the latter has a Gate Check section explicitly named "Does the Observe Phase Teach the Concept?"). This rule is the in-context reminder so you cannot get to "done" without doing the playthrough.

## The hard gate (do this before declaring a level done)

For every probe in the level, write down -- in actual words, not in your head -- what the player **literally sees** in the **center panel** at the moment the probe fires. If your honest answer is any of:

- "the probe terminal shows response lines"
- "the discovery checklist updates in the left panel"
- "stage badges and sublabels change but the rest of the visual is static"
- "nothing visible changes; the player reads the response and infers"

…the level is broken. Stop. Redesign before shipping.

A passing answer looks like:

- "the FlagGate node's whole card pulses red (`variant: 'critical'`), gains a `MISSING` badge that pulses, and the edges from Client → AppServer → FlagGate animate with red dots in a single-pass burst. The NewPaymentProcessor's sublabel changes to `3% of charges 500ing`, its variant escalates to `critical`, and a `FAIL` badge appears."

The `audit-level` skill formalises this as the "Probe-by-probe playthrough" -- that step is **mandatory during implementation**, not a post-hoc audit step. The `design-level` skill's "Probe Differentiation" rule additionally requires that no two probes produce the same visual change.

## Visual richness requirements

A probe's visible change is not just text. The visualization needs **multiple animated layers**, not one. When you sit and watch a probe fire, you should see at least two of these happening:

- **Whole-card animation** on the most-affected node. PipelineFlow's `variant: 'critical'` triggers `animate-pulse` on the entire card with a red-tinted background, plus an `animate-ping` ripple in the header dot. Use this for the headline broken thing, not just `'danger'` (which only changes border colour).
- **Edge dot animation.** Connections accept `dots: 'mixed' | 'clean' | 'danger'` or a custom `PipelineDot[]` array. **An edge with no `dots:` prop never animates, regardless of `activeConnections`.** Set `dots:` on every connection that should ever show motion.
- **Pulsing badges.** PipelineFlow already pulses badge text by default. Use short, urgent badges (`FAIL`, `TIMEOUT`, `MISSING`, `KILL`) -- not full sentences.
- **Per-probe single-pass bursts.** `activeConnections=['edge-id', ...]` puts those edges into single-pass mode (`repeatCount: '1'`), producing a sharp burst in addition to whatever idle/dormant baseline they have.

Stage variants you actually have available (with what they look like):

| variant | border | bg | header dot | full-card animation |
|---------|--------|-----|------------|---------------------|
| `default` | `border-border` | none | none | none |
| `active` | `border-success` | none | green, `animate-pulse` | none |
| `danger` | `border-destructive` | none | red, `animate-pulse` | none |
| `critical` | `border-destructive` | `bg-destructive/10` | red, `animate-ping` | `animate-pulse` on the whole card |
| `inactive` | `border-border` | none | none | `opacity-60` (faded) |

If the level's broken state is the headline of the act (e.g., "missing kill switch is the entire problem"), use `'critical'` from the *base* state -- not just on probe fire. The player should see the broken thing pulsing the moment the level loads.

## The dormant-edges default

`PipelineFlow`'s edge `mode` is computed as:

```
activeConnections === undefined  →  'idle'    (continuous animation if dots set)
activeConnections === []         →  'dormant' (no dots regardless of dots prop)
activeConnections === ['x', 'y'] →  'active'  (single-pass on listed edges)
```

**The first one is a trap.** If the orchestrator passes `undefined` to PipelineFlow before any probe fires, the edges show continuous idle dot flow -- implying "data is flowing right now" before the player has done anything. That misleads the player about what's happening.

Default rule: **pass `[]` (empty array) when no probe / scenario has fired yet.** Only pass `undefined` if the level genuinely has continuous background traffic that should always be visible (rare -- most levels do not).

## Every probe needs an animated dimension

Even probes that aren't about a request flowing need to drive motion. If you find yourself writing `activeConnections: []` for a probe with the justification "this probe is about a process gap, not a request" -- stop. Ask: what action IS the player simulating? Marketing trying to flip a launch toggle is still a request that reaches the system; it just doesn't continue past the gate. Activate the *upstream* edges and stop where the missing thing actually breaks the chain.

If a probe genuinely has no activated edges, it must drive visible animation through other means: a different node escalating to `'critical'`, a badge appearing, a variant change. The "Probe Differentiation" test in `expectEveryProbeDrivesDistinctChange` will fail if two probes produce identical visual state.

## No floating nodes

Every node visible in the visualization must be structurally connected to the rest of the graph by at least one edge. A node sitting alone with no edges looks like a UI bug, not "this thing exists but is unreachable."

If a node IS unreachable in the current state, render the architectural edge anyway but omit the `dots:` prop. The line is then static (no dot motion), which still communicates "no traffic flows here," but the node is anchored to the graph.

Avoid the inverse trap too: if a node only exists in the reward phase (the player builds new infrastructure), do NOT show it in observe just to keep the layouts symmetric. The build adds capability, not nodes -- when capability and nodes both grow, that is a deliberate design choice that the level should justify.

## Re-firing the same probe must restart the animation

SVG `<animateMotion>` with `repeatCount="1"` plays once and then freezes. The SMIL spec defines the canonical way to restart a finite-duration animation: call `beginElement()` on the animation element via the SVG DOM API. **This is the only approach that works reliably** -- React Flow's edge memoization keeps the inner SVG subtree alive across data updates, so neither key changes nor unmount-remount via prop changes are guaranteed to restart the animation.

Sources (all confirmed before this rule was written):
- [MDN: SVGAnimationElement.beginElement()](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement)
- [SMIL Animations spec, beginElement](https://svgwg.org/specs/animations/#__svg__SVGAnimationElement__beginElement)
- [React Flow performance docs](https://reactflow.dev/learn/advanced-use/performance)

The required setup:

1. Set `begin="indefinite"` on the `<animateMotion>` element. Without this, `beginElement()` is a no-op (per the SMIL spec).
2. Hold a ref to each animation element (use a callback ref + `instanceof SVGAnimationElement` to narrow the type without an unsafe cast).
3. In a `useEffect` keyed on the fire tick, call `el.beginElement()` on each ref, with the original `begin` offset converted to a `setTimeout` delay for the staggered cascade.
4. The first fire, subsequent fires, and re-fires of the same probe all go through the same code path. No special-casing for "first time."

This is implemented in `AnimatedDots` via a `restartTick?: number` prop. Pass it whenever you want the dots to be re-firable; omit it for indefinite-loop dots (idle mode) where the SVG timeline handles things itself.

What does NOT work on its own (all empirically tested in L49):

- **Bumping a tick counter into dot ids.** React Flow's edge memoization caches the inner SVG subtree; even with new dot ids, the original `<circle>` elements stay mounted. The animation does not restart.
- **Toggling `activeConnections` through `[]` (dormant) and back.** The dormant tick is supposed to unmount AnimatedDots and the active tick is supposed to remount it. React Flow's edge wrapper memoizes the edge component and the SVG subtree never actually unmounts. The animation does not restart.
- **Changing the React `key` on the wrapping div.** Forces a full unmount-remount of the React Flow subtree, which DOES restart animations, but causes a visible canvas flash and loses any internal React Flow state. Acceptable as a last resort, not as the default.

The general rule for any finite-duration animation primitive: do not rely on React's reconciliation to restart it. Use the primitive's own restart API.

## Research before guessing on browser/library quirks

The previous section was rewritten three times because the first two attempts skipped the research step. The first attempt threaded a tick counter into dot ids; the second toggled state through dormant mode. Both were plausible-sounding hypotheses about why React Flow / SMIL might not be restarting animations. Both wasted a full debugging round before falling back to actually reading the docs.

The rule: when something doesn't work and the cause is not obvious from the code in front of you, **stop guessing and look it up**. Use WebSearch for the symptom, WebFetch the canonical docs (MDN for browser APIs, the library's own docs for library behaviour, the spec for ambiguous areas). Cite the sources in the fix's commit message or session log.

Concrete signals that you should be researching, not guessing:
- "It works the first time but not subsequent times." (animation lifecycle quirks)
- "The state changes but the visual doesn't update." (memoization or reconciliation behaviour)
- "The docs don't say either way, so I'll try X." (you are about to guess)
- You are about to write a comment that explains your hypothesis instead of citing a source.

Two failed fixes plus a third correct fix is one fix too many. The cost of a 5-minute search up front is far less than the cost of two iterations of debugging plus the user pointing out the fix still doesn't work.

## Same layout across phases

Observe and reward stage positions should be identical. The phase transition is about the visualization changing STATE (variants, badges, dot flow, sublabels), not about nodes moving around the screen. Repositioning nodes between phases costs the player a re-orientation tax for no pedagogical gain.

If observe and reward genuinely have different topologies (a node is added in build, an edge is added in build), keep the positions of the shared nodes consistent and only add new nodes/edges in the new positions.

## Probe labels are verb-led actions, not statements

Every probe label describes what the player (or an actor) IS DOING, not a description of a situation. The matching reward stress-scenario label uses the same action.

```
BAD:  "Vendor integration starts misbehaving at peak hours"   (statement)
BAD:  "Marketing wants the launch on Tuesday at 9am sharp"     (statement)
GOOD: "Hit kill switch during a vendor outage"                 (action)
GOOD: "Flip launch toggle at Tuesday 9:00am sharp"             (action)
GOOD: "Roll out new payment processor to all customers"        (action)
```

The `design-level` skill's "Every Probe Must Tell a User Story" section formalises this. Statement-shaped labels make probes look passive and disconnected from a user's intent. Verb-led labels match the actor table: Customer / Marketing / Oncall / Attacker is doing this thing, and here is what happens when they try.

## The data structure requirement

If the level's observe phase has a `PROBES` array, the level's `data/pipeline-stages.ts` (or equivalent) must export a probe-keyed state map that drives those visible deltas. The exact name varies by level -- `PROBE_PIPELINE_MAP` (L11), `PROBE_OBSERVE_OVERRIDES`, `PROBE_FRAMES` -- but the shape is always: `Record<probeId, { stages, activeConnections }>`. The orchestrator merges those overrides into the base stages on probe fire.

If you cannot point at the data structure that drives per-probe visualisation deltas, the level fails the gate.

## Test enforcement (CI-level catch)

Every level test file with probes must call both helpers from `@/lib/testing/probe-pedagogy`:

- `expectEveryProbeDrivesVisualChange({ probes, probeStateMap, validate })` -- fails if any probe lacks an entry, or has an entry the validator rejects as "no visible delta" (no badge, no sublabel change, no variant change).
- `expectEveryProbeDrivesDistinctChange({ probes, probeStateMap, serialize })` -- fails if two probes produce identical visual state, mirroring the design-level skill's "Probe Differentiation" rule.

This is belt-and-suspenders with the rule above: the rule catches the failure at design time, the tests catch the regression at commit time.

## How this rule was earned

L49 (Feature Flags) was the worked failure example for every section of this rule. The level shipped through three rounds of pedagogy bugs, each surfacing a distinct lesson:

1. **Round 1 -- no per-probe state.** The first implementation had a `PROBES` array and zero probe-keyed state map. Probes only updated the left-panel discovery checklist; the PipelineFlow visualization was static across all three probes. The structural tests passed because none of them checked "does anything happen on screen when a probe fires?" → introduced the data-structure requirement and the `expectEveryProbeDrivesVisualChange` helper.
2. **Round 2 -- text-only changes.** The second pass added per-probe stage overrides (badge, sublabel, variant), but the actual rendered result still felt static: variant changes only modified border colour, badges pulsed but the rest of the node was static, and edges had no dot animation at all because connections were never given a `dots:` prop. → introduced the `'critical'` variant for whole-card pulse, the `'danger'` dot preset for red flow, and the requirement that connections set `dots:` to be animatable.
3. **Round 3 -- idle-edge trap.** The third pass had everything wired correctly but defaulted to `activeConnections=undefined`, putting edges into continuous "idle" mode before any probe fired. The visualisation implied data was flowing before the player had done anything. → introduced the dormant-edges-default rule (`[]` not `undefined` for the initial state).
4. **Round 4 -- silent probe.** One probe (`marketing-pin-time`) had `activeConnections=[]` deliberately, on the reasoning "no request fires for this probe -- it's a scheduling gap." The probe produced text changes but no motion. → introduced the "every probe needs an animated dimension" rule. Even probes about process gaps simulate an action; activate the upstream edges and stop where the missing thing actually breaks the chain.
5. **Round 5 -- statement-shaped labels.** Two of the three probe labels were descriptive statements ("Marketing wants…", "Vendor integration starts…") rather than verb-led actions. → reinforced the existing design-level "Probe Must Tell a User Story" rule with a worked diff.
6. **Round 6 -- floating node.** The Legacy Payment Processor node was rendered in the observe phase but had no edges connecting it to the rest of the graph. A structural test deliberately asserted "no flag-gate -> legacy edge in observe" on the reasoning that legacy was unreachable. The visual cost was a node that looked like a UI bug. → introduced the no-floating-nodes rule and the same-layout-across-phases rule. The fix: keep the edge structurally present but omit `dots:` so the line is static, anchoring the node without implying traffic flow.
7. **Round 7 -- silent re-fire.** The first probe fire produced the expected single-pass dot burst. A second fire of the same probe was silent. Cause: `<animateMotion repeatCount="1">` had already finished, and React Flow's edge memoization kept the inner SVG subtree alive across data updates. Two failed fixes preceded the right one: (a) threading a tick counter into dot ids -- React Flow's memoization defeated it; (b) toggling `activeConnections` through `[]` (dormant) and back -- same memoization, same failure. The correct fix, found only after reading the [MDN beginElement docs](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement) and the [SMIL spec](https://svgwg.org/specs/animations/), is the SVG DOM's native restart API: set `begin="indefinite"` on each `<animateMotion>`, hold a ref to it, and call `el.beginElement()` on each fire. → introduced the re-fire restart rule and the **research-before-guessing** rule.
8. **Round 7b -- only the first dot of four was visible.** Even on the first fire, only one of the four staggered dots actually appeared on screen. Cause: the indefinite-loop dot presets use negative `begin` values (`-0.9s`, `-1.8s`, `-2.7s`) to stagger the visual cascade. When `mode === 'active'`, PipelineFlow overrode `dur` to `0.8s` but kept those negative begins. A `<animateMotion>` with `begin=-2.7s, dur=0.8s, repeatCount=1` ended at t=-1.9s -- 1.9 seconds *before* the element was mounted, so it never played. Only the dot with `begin=0s` actually fired. → introduced the active-mode positive-cascade rule: when overriding to single-pass, also override `begin` to positive staggered offsets (`0s`, `0.15s`, `0.3s`, ...) so every dot has a future window in which to play.

The reflexive lesson: structural compliance is necessary but not sufficient. The player's experience is the source of truth, and the only way to verify it is the playthrough -- written down, layer by animated layer, with the variant table and the dormant-edges-default and the verb-led labels and every probe driving distinct motion -- before declaring done.

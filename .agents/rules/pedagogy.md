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

For every probe in the level, write down — in actual words, not in your head — what the player **literally sees** in the **center panel** at the moment the probe fires. If your honest answer is any of:

- "the probe terminal shows response lines"
- "the discovery checklist updates in the left panel"
- "nothing visible changes; the player reads the response and infers"

…the level is broken. Stop. Redesign before shipping.

A passing answer looks like:

- "the FlagGate node's badge changes from `(missing)` to `MISSING — no kill switch` (red), the NewPaymentProcessor's sublabel changes to `vendor 5xx + no kill switch` and gains a `TIMEOUT` badge, and the edge from AppServer to NewProcessor animates with red dots for ~2.5s"

The `audit-level` skill formalises this as the "Probe-by-probe playthrough" — that step is **mandatory during implementation**, not a post-hoc audit step. The `design-level` skill's "Probe Differentiation" rule additionally requires that no two probes produce the same visual change.

## Concrete requirement: the data structure must exist

If the level's observe phase has a `PROBES` array, the level's `data/pipeline-stages.ts` (or equivalent) must export a probe-keyed state map that drives those visible deltas. The exact name varies by level — `PROBE_PIPELINE_MAP` (L11), `PROBE_OBSERVE_OVERRIDES`, `PROBE_FRAMES` — but the shape is always: `Record<probeId, ...visible deltas>`. The orchestrator wires it through to the visualization on probe fire.

If you cannot point at the data structure that drives per-probe visualisation deltas, the level fails the gate.

## Test enforcement (CI-level catch)

Every level test file must call `expectEveryProbeDrivesVisualChange` from `@/lib/testing/probe-pedagogy`. The helper takes `probes`, the probe-keyed state map, and a per-level validator that decides "is this state a visible delta?" CI fails if any probe lacks an entry or has an empty entry.

This is belt-and-suspenders with the rule above: the rule catches the failure at design time, the test catches the regression at commit time.

## How this rule was earned

L49 (Feature Flags) shipped an observe phase with three probes and zero per-probe pipeline state. PipelineFlow rendered the same static graph regardless of which probe fired; only the discovery checklist updated. The structural tests (probe-discovery 1:1, probe-scenario coverage, scenario uniqueness, code preview boundaries) all passed because none of them looked at the question "does anything happen on screen when the player fires a probe?". The level was committable, tested, and pedagogically broken.

The reflexive lesson: structural compliance is necessary but not sufficient. The player's experience is the source of truth, and the only way to verify it is the playthrough — written down, frame by frame, before declaring done.

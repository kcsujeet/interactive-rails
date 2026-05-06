# PipelineFlow Implementation Guide

Detailed implementation specifics for Type 4 PipelineFlow levels: hub-and-spoke layout, node state rules, bidirectional edges, and sequential edge animation.

## When PipelineFlow IS Used

If the level uses PipelineFlow specifically, these additional checks apply:

- [ ] `onNodeClick` callback for interactive stages
- [ ] `inspectable: true` on clickable stages (pulsing `?` indicator)
- [ ] `StageInspector` overlay on click
- [ ] Node variants react to probes/interactions via `useMemo`
- [ ] Define data maps: `STAGE_INSPECTOR_MAP`, `DISCOVERY_DEFS`, etc.

**Node colors must match their state (non-negotiable):**

Every node in the pipeline must visually reflect its actual state during the observe phase. A node that is unreachable, errored, or broken must never stay `default` (black/zinc). Check every node in the `observeStages` array:

- **Broken/errored node** (the focus of the level): `variant: 'danger'` on probe (red background, red border)
- **Nodes downstream of the broken stage** (unreachable): `variant: 'inactive'` + `sublabel: 'unreachable'` on probe (dashed, dimmed)
- **Nodes that show error responses** (e.g., Response showing "500" or "404"): `variant: 'danger'` on probe
- **Working nodes upstream of the problem**: `variant: 'active'` (green) or keep their existing state
- **Idle state** (no probe fired): nodes can be `default`, `active`, or `inactive` depending on their role

The rule: if a node's sublabel changes on probe (e.g., showing "404", "unreachable", "500 Error"), its variant MUST also change. A sublabel without a matching variant creates a black node with error text, which is visually wrong.

**Case study:** L6 Controller had Model node with no variant on probe (stayed black) even though the controller was broken and Model was unreachable. L8 Associations had Response node showing "404" sublabel but no variant change (stayed black instead of danger red). Both were fixed by adding the appropriate variant.

## Hub-and-Spoke Implementation Details

Implementation specifics for the hub-and-spoke layout described in Type 4 above.

- Model: below Controller with `position: { x: 500, y: 180 }`, connection uses `sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true`
- Database: below Model with `position: { x: 500, y: 360 }`, same handle config
- Serializer: above Controller with `position: { x: 500, y: -180 }`, connection uses `sourceHandle: 'top', targetHandle: 'bottom', bidirectional: true`
- Focus node uses `variant: 'inactive'` or `'danger'`, others use `'active'` or `'default'`
- Stages with explicit `position` do not consume an auto-layout slot (auto-positioned stages stay on the horizontal chain)

**Bidirectional edge rendering:**
- Bidirectional connections produce two parallel edges: forward (solid line, shifted left) and return (dashed line, shifted right), symmetric about the center
- Both edges use the same dot size (r=8). The offset is controlled by `LANE_OFFSET` (14px) in PipelineFlow
- Forward edges of bidirectional pairs get `isBidirectional: true` in edge data so they are also offset
- Non-bidirectional edges (horizontal chain) stay centered with no offset

**Satellite node state rules (every satellite must have a variant):**
- A satellite node must NEVER use the bare `default` variant (zinc) in the observe phase. It looks identical to Request and implies no relationship to the pipeline state
- When the broken stage is upstream of the satellite (e.g., Router broken in L5, Controller missing in L6), set satellites to `variant: 'inactive'` with `sublabel: 'unreachable'` on probe
- When the satellite is working (problem is elsewhere, e.g., Serializer missing in L7), set it to `variant: 'active'`
- In reward phases, satellites should always be `variant: 'active'` since the fix is applied

| Level | Observe (idle) | Observe (probe fired) | Reward |
|-------|---------------|----------------------|--------|
| L5 | `default` | `inactive` + "unreachable" | `active` |
| L6 | `default` | `inactive` + "unreachable" | `active` |
| L7 | `active` | `active` | `active` |
| L8 | `active` | `active` | `active` |

**Checklist for hub layout:**
- [ ] Main chain stages have NO `position` prop (auto-positioned horizontally)
- [ ] Satellite stages (Model, Database, Serializer) have explicit `position` props
- [ ] Connections to satellites use `sourceHandle`/`targetHandle` for vertical edges
- [ ] Bidirectional connections (`bidirectional: true`) create return edges automatically
- [ ] Every satellite node has an explicit `variant` (never bare `default` in observe)
- [ ] Satellites downstream of the broken stage show `inactive` + "unreachable" on probe
- [ ] All satellites show `active` in the reward phase

## Sequential Edge Animation

**The core rule: animations only run on probe/scenario fire.** The `activeConnections` prop on PipelineFlow controls edge animation. It has THREE distinct modes:
- `undefined`: **continuous idle animation** — edges run in an infinite loop. **This is a trap.** It implies data is flowing before the player has done anything.
- `[]`: **fully dormant** — no dots, no motion. **This is the default state every level should pass when no probe / scenario has fired.**
- `['request-router', 'controller-model']`: **single-pass bursts** — only listed edges animate, once.

Connection IDs use `from-to` format (e.g., `"request-router"`, `"controller-model"`). For bidirectional edges, the return direction uses `"model-controller"`.

**How levels use it:**
1. Define a per-probe `Record<probeId, string[]>` (or per-scenario for reward) mapping each probe/scenario to the connection keys it activates.
2. Track the most recent probe/scenario in component state (`lastProbeId`, `lastResult`).
3. Compute `activeConnections` as: `lastProbeId ? PROBE_ACTIVE_CONNECTIONS[lastProbeId] ?? [] : []`. **Default to `[]`, never `undefined`.**
4. Pass `activeConnections={computed}` to every `<PipelineFlow>` render.

**Default rule (NON-NEGOTIABLE):** Every `<PipelineFlow>` JSX render MUST pass `activeConnections=` explicitly. The default value when no probe / scenario has fired is `[]` (dormant), not `undefined` (continuous idle animation). Pass `undefined` ONLY if the level genuinely has continuous background traffic that should always be visible — and document why in a comment.

**Audit check (NON-NEGOTIABLE):** Before declaring a level done, grep its source for `<PipelineFlow` and verify every match passes `activeConnections=`. The CI test at `scripts/__tests__/level-reveal-consistency.test.ts` (`KNOWN_AUTO_ANIMATING_EDGES`) baselines existing offenders and forbids new ones; new levels must not be added to that baseline.

**Checklist for sequential animation:**
- [ ] `activeConnections` prop passed to PipelineFlow (NEVER omit; default to `[]`)
- [ ] Per-probe / per-scenario maps cover every probe and scenario id
- [ ] `FLOW_SEQUENCE` (when used for staggered timing) matches real data flow
- [ ] Bidirectional edges have TWO entries (forward + return), never simultaneous
- [ ] Probes/stress-tests disabled during animation (see "Animation locking" section in SKILL.md)
- [ ] Node variants update in sync with the sequence

# Observe Phase Design Guide

Detailed guidance for designing Type 2, 3, and 4 observe phases, including case studies, visualization accuracy rules, mechanism vs metric principles, shared terminal components, and flow animation patterns.

## Gate Check Case Studies

### L27 Counter Caches (terminal logs were not a visualization, now fixed)

L27's original observe phase was a ProbeTerminal showing SQL log lines. The player pressed "10 posts," "50 posts," "100 posts" and read `SELECT COUNT(*) FROM comments WHERE post_id = 1`, `...post_id = 2`, etc. The audit found 18 issues (wrong colors, custom terminal, missing animation locking, passive reward phase) and fixed them all. But it missed the fundamental problem: **the level had no visualization at all.** The entire observe phase was text in a terminal. This is a Type 3 level (runtime performance behavior) but it had no custom visualization, just a ProbeTerminal alone.

L27 was subsequently redesigned with a "Database Table View" visualization: the posts table shows real schema columns (id, title, user_id) and the comments table sits beside it with a FlowConnector. Firing the single probe triggers a cascade: each post row turns red sequentially as it fires COUNT(*) to the comments table. The key insight is the ABSENCE of a `comments_count` column in the posts schema. The player sees id, title, user_id and notices there is no column for counts, which is why every post must cross to the comments table. The reward phase adds the column, and cached loads show all rows green instantly. See the reference implementation in SKILL.md for the current approach.

Why was this missed? Three reasons:

1. **The audit was treated as a compliance checklist, not a design review.** Each item was checked independently: "Does it have discovery gating? Yes. Does it use shared components? Yes. Are colors correct? Fixed." The volume of surface-level fixes (18 issues!) created a false sense of completeness. But checking 18 boxes is worthless if the core design is wrong.

2. **Fixing the implementation anchored thinking to the existing frame.** The original L27 already used a terminal log approach. The audit improved it within that frame (shared ProbeTerminal, better colors, proper gating) instead of questioning the frame itself. Replacing a bad custom terminal with a good shared terminal is a code quality fix, not a design fix.

3. **"Correct component" was conflated with "correct visualization."** ProbeTerminal is a shared component, so using it felt like following the rules. But ProbeTerminal is a **discovery mechanism** (a way for the player to interact), not a **visualization**. It should sit BELOW a visualization and drive it, not BE the visualization. L26 has a TableRowGrid + IndexLookupCard with ProbeTerminal below it. The original L27 had just ProbeTerminal with nothing above it. The redesigned L27 now has a Database Table View above ProbeTerminal, following the correct architecture.

### ProbeTerminal is a discovery tool, not a visualization (Types 3 and 4 only)

This distinction is critical and was the root cause of the L27 failure. It applies to Types 3 and 4, which are the interactive observe types that use ProbeTerminal:

| Component | Role | What it does |
|-----------|------|-------------|
| **Visualization** (TableRowGrid, QueryCascade, DataGate, PipelineFlow, etc.) | Shows the mechanism | Visual objects animate to show what the system is doing |
| **ProbeTerminal** | Drives discovery | Player clicks buttons, terminal shows text, fires `onProbe` callback |

The correct architecture for a Type 3 level:

```
Center Panel:
  ┌─────────────────────────────────────┐
  │  VISUALIZATION (reacts to probes)   │  <- The actual teaching tool
  │  [blocks, arrows, zones, grids]     │
  │  [animates on probe fire]           │
  ├─────────────────────────────────────┤
  │  PROBE TERMINAL (drives probes)     │  <- The interaction tool
  │  [> Fire probe buttons]             │
  └─────────────────────────────────────┘
```

```
BAD (L27 before redesign):
  ┌─────────────────────────────────────┐
  │  (nothing)                          │
  ├─────────────────────────────────────┤
  │  PROBE TERMINAL (the only thing)    │  <- No visualization exists
  │  [SQL text scrolls by]             │
  └─────────────────────────────────────┘

GOOD (L27 after redesign):
  ┌─────────────────────────────────────┐
  │  DATABASE TABLE VIEW                │  <- The actual teaching tool
  │  [posts: id,title,user_id columns] │
  │  [rows cascade red on probe fire]  │
  │  [FlowConnector -> comments table] │
  ├─────────────────────────────────────┤
  │  PROBE TERMINAL (drives probes)     │  <- The interaction tool
  │  [> GET /api/posts]                │
  └─────────────────────────────────────┘
```

This distinction does NOT apply to Type 1 (no observe) or Type 2 (static intro), which do not use ProbeTerminal at all.

## Type 2: Static Intro (Detailed Guidance)

**Reference implementation:** Level 16 (Service Objects)
`frontend/src/features/act3-clean-architecture/components/Level16ServiceObjects.tsx`

L16 shows a fat controller method with color-coded left-border annotations marking each responsibility section. Side-effect sections (logging, preferences, token) get an amber left border + Badge label. The core logic gets a muted zinc border. Below: a callout stating "4 responsibilities in one method." The player reads the annotated code, sees the problem, and clicks "Build the Fix" immediately.

```tsx
// GOOD: Static intro for a refactoring level
// The code tells the story. No interactive overhead.
const ANNOTATED_SECTIONS: AnnotatedSection[] = [
  { id: 'core', label: 'Core Logic', variant: 'core', code: `@user = User.new(...)` },
  { id: 'logging', label: 'Side Effect: Logging', variant: 'side-effect', code: `Rails.logger.info(...)` },
  // ...
];

// Render: colored left borders + Badge labels + callout + always-visible button
<div className="border-l-2 border-l-amber-500 bg-amber-500/5 ...">
  <Badge className="border-amber-500/50 text-amber-600 ...">Side Effect: Logging</Badge>
  <pre>{section.code}</pre>
</div>
// ...
<Button onClick={handleStartBuild}>Build the Fix</Button>  // No gating
```

```tsx
// BAD: Over-engineering the observe phase for a refactoring level
const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, { minRequired: 3 });
// Player clicks 4 abstract buttons, reads inspector overlays, clicks 3 scenario cards...
// ...all to learn that one method has too many responsibilities (which the code already shows)
{discoveryGating.isUnlocked && <Button>Build the Fix</Button>}
```

### Type 2 vs Type 3 Decision

**Case study: L25 Narrow Fetching (Type 2 was wrong, Type 3 is correct)**

The original L25 used Type 2: static annotated code blocks showing `User.all` with text labels like "681 MB for 2 columns." This failed because:
- The player reads "681 MB" as an abstract number with no visceral understanding of why
- The code `User.all` looks harmless. You can't see the 30 columns, the 75KB TEXT field, or the memory explosion by reading a one-liner
- The *ratio* of waste (28 unused columns vs 2 needed) is the core insight, and ratios need visual representation, not text labels
- The problem is a RUNTIME behavior (memory allocation, query width), not a CODE STRUCTURE issue

The redesigned L25 uses Type 3: a "Data Table Heatmap" where firing probes makes ALL 30 columns light up red (SELECT *), then the 2 needed columns flash green. The overwhelming red-to-green ratio IS the lesson.

**Rule of thumb:** If explaining the problem requires showing numbers (memory, latency, query count, object count) rather than showing code structure (responsibilities, abstractions, duplication), it needs Type 3, not Type 2.

## Visualization Accuracy (the visualization must not lie)

**The visualization's structure must accurately represent how the concept works.** A pretty animation that teaches the wrong mental model is worse than no animation at all. When auditing, ask: "If a player memorized this diagram, would they have an accurate understanding of the architecture?"

**Case study: L15 CORS redesign (bad -> good)**

The original L15 visualization had structural inaccuracies:

```
BAD layout (original):
  [Browser] | Origin Boundary (w-20 divider) | [Preflight OPTIONS]
                                               [CORS Middleware]
                                               [Rails API]
```

Problems:
- **Preflight was a server-side box.** Preflight (OPTIONS) is a type of request the *browser* sends, not a server component. Showing it as a server box teaches the wrong mental model.
- **CORS Middleware sat between Preflight and Rails API** as if it were a middle layer. In reality, it is Rack middleware that wraps the entire app and is the *first* thing requests hit.
- **No flow between the 3 server boxes.** They were stacked vertically with no connectors, looking disconnected. There was no visual representation of how a request moves through them.
- **Single FlowConnector** only spanned the narrow origin boundary divider, not the full request path.

The redesigned version accurately represents the CORS flow:

```
GOOD layout (redesigned):
  [Browser/Client] --FC1--> [CORS Middleware Gate] --FC2--> [Rails API]
```

Fixes:
- **Preflight removed as a zone.** It is communicated through flow messages at the Client zone (e.g., "OPTIONS preflight from localhost:3001"), which accurately represents it as browser behavior.
- **CORS Middleware is the center gate.** Requests hit it first. If allowed, they pass through to the API. If blocked, the API shows "not reached." This matches the real Rack middleware stack.
- **curl bypass is visually distinct.** The Client zone switches from browser chrome (traffic light dots, address bar) to terminal style (dark header, `$` prompt) for the curl probe. The CORS gate shows "(bypassed, no browser enforcement)" because CORS is purely browser-enforced.
- **2 FlowConnectors** show the full request path: client -> gate -> API.

### Idle State Consistency

**Case study: L27's posts table** originally rendered a plain `<div>` with "Fire a probe to load posts..." when idle, hiding the column headers (id, title, user_id). Meanwhile the adjacent comments table always showed its headers (id, post_id, body). The fix: always render `<table><thead>` with column headers, and use a `<tbody>` with a placeholder `<td colSpan={N}>` row for the idle state. Both tables now show their schema structure from the start, which is critical because the schema visibility IS the teaching moment.

## Mechanism vs Metric (Non-Negotiable)

**The visualization must show WHAT the system is doing, not just HOW FAST it's doing it.** A progress bar labeled "10,000 rows scanned" is a metric. A grid of 100 blocks turning red one-by-one as the database reads each row is a mechanism. Numbers tell the player a fact. Mechanisms give the player a mental model.

This is the single most important principle for Type 3 visualizations. Before designing any visualization, ask: **"What is the system physically doing under the hood, and can the player SEE it?"** If your visualization shows text labels, progress bars, or timing numbers, you are showing metrics. If it shows objects moving, states changing, or structures being traversed, you are showing mechanism.

**Case study: L26 Database Indexing (metrics were wrong, mechanism is correct)**

The first redesign of L26 replaced PipelineFlow with a "Query Plan Lanes" layout: 3 horizontal lanes, each containing a `ScanBar` (a simple progress bar that fills red for Seq Scan or green for Index Scan) plus SQL text and timing labels. This looked reasonable on paper but failed in practice.

Problems:
- **The player sees `SELECT * FROM users WHERE email = 'alice@example.com'` and a red progress bar filling to 100%.** They know it's slow because the text says "820ms." But they don't understand WHY it's slow. They can't see the database reading row after row after row.
- **An "Index Scan" was shown as a green progress bar filling to 1%.** The player knows the index is faster because the number is smaller. But they have no idea what an index IS or what it does differently. Where is the B-tree? Where is the sorted lookup? The visualization teaches "index = small number" instead of "index = skip the scan."
- **The observe and reward phases looked nearly identical**: both showed a progress bar with different colors and numbers. There was no structural difference between "no index" and "has index." The visualization failed to show the fundamental change in how the database searches.

The redesigned version shows the mechanism:

```
OBSERVE (no index, Seq Scan):
  ┌─ ✕ No index on users ── Sequential Scan ─┐
  │                                            │
  │  users table (10,000 rows)                 │
  │  ████████████████████   ← red wave sweeps  │
  │  ████████████████████     through ALL       │
  │  ██████████░░░░░░░░░░     100 blocks       │
  │  ░░░░░░░░░░░░░░░░░░░░                      │
  │  ░░░░░░░░░░░░░░░░░░░░                      │
  │                                            │
  │  ■ Scanned (99)  ■ Matched (1)            │
  └────────────────────────────────────────────┘

REWARD (with index, Index Scan):
  ┌─ ⚡ index_users_on_email (unique, B-tree) ─┐
  │  aaa@corp.com        → row #231            │
  │  ➜ alice@example.com → row #4231           │
  │  bob@dev.io          → row #1892           │
  │  ...                   (9,996 more)        │
  ├────────────────────────────────────────────┤
  │  users table (10,000 rows)                 │
  │  ░░░░░░░░░░░░░░░░░░░░                      │
  │  ░░░░░░░░░░░░░░░░░░░░   ← only the match  │
  │  ░░░░░░░█░░░░░░░░░░░░     block is green   │
  │  ░░░░░░░░░░░░░░░░░░░░     rest untouched   │
  │  ░░░░░░░░░░░░░░░░░░░░                      │
  └────────────────────────────────────────────┘
```

Why this works:
- **The player watches the red wave sweep through every block.** They feel the waste. 100 blocks scanned to find 1 match. The animation takes 1.5 seconds, long enough to feel slow.
- **The IndexLookupCard shows the actual B-tree structure**: sorted entries with the highlighted lookup pointing to the matching row. The player sees what an index IS (a sorted lookup table) and what it DOES (maps a value directly to a row position).
- **The reward phase looks structurally different.** No red wave, no scanning. Just the index card pointing to a single green block on a field of neutral gray. The visual shift from "sea of red" (observe) to "one green on gray" (reward) IS the lesson.
- **The mechanism is visible.** Seq Scan = read every row (red wave). Index Scan = look up in sorted structure, jump to match (index card + green block). The player builds the correct mental model of what the database does differently.

**Case study: L27 Counter Caches (metric repetition was wrong, schema visibility is correct)**

The original L27 had three probes: "10 posts," "50 posts," "100 posts." Each showed the same N+1 COUNT(*) pattern with different numbers (11 queries, 51 queries, 101 queries). This is pure metric repetition: the player learns "more posts = more queries" (a number) instead of "each post individually hits the comments table" (a mechanism).

The redesigned L27 uses a single probe with a "Database Table View" showing the actual posts schema columns (id, title, user_id). The key visual: the player sees that there is NO `comments_count` column. When the probe fires, rows cascade red one-by-one as each post fires COUNT(*) to the adjacent comments table. The mechanism is visible: each row individually crossing to another table. After the build phase, the reward adds the `comments_count` column to the schema, and cached loads show all rows green instantly (no cross-table queries).

The structural difference between observe and reward: observe has 3 columns and red cascade. Reward has 4 columns (the new one IS the fix) and instant green. The new column appearing in the schema IS the lesson.

**Rule of thumb:** If your visualization could be replaced by a text label ("820ms", "10,000 rows scanned") without losing information, it's showing a metric, not a mechanism. Redesign it to show the mechanism.

## Shared Terminal Components (Non-Negotiable)

**Never build a custom terminal UI when a shared component exists.** Three shared terminal components cover all use cases:

| Component | Phase | Use case |
|-----------|-------|----------|
| `ProbeTerminal` | Observe | Player fires probes to discover problems |
| `StressTestPanel` | Reward | Player fires stress scenarios to verify the fix |
| `SimulatedTerminal` | Build | Player picks the right shell command |

**If a level needs a terminal-like display (query log, request log, database output), use `ProbeTerminal` with appropriate `responseLines` per probe.** Do not build a custom div with traffic-light dots, a scrollable log area, and custom buttons. That is exactly what ProbeTerminal already provides.

**Case study: L27 Counter Caches (custom terminal was wrong, then redesigned entirely)**

L27 went through three stages, each teaching a different lesson:

**Stage 1 (bad): custom terminal.** The original L27 built a custom "Query Waterfall" terminal with ~80 lines of custom state (`firedProbes`, `activeProbe`, `queryLog`, `visibleQueryIndex`, `isAnimating`). This duplicated ProbeTerminal's functionality with inconsistent styling and manual interval cleanup.

**Stage 2 (better but still wrong): ProbeTerminal alone.** Replacing the custom terminal with `<ProbeTerminal>` fixed the code quality issues (~80 fewer lines, consistent styling), but the observe phase was STILL just terminal text. There was no visualization above it. The player read SQL log lines instead of seeing the mechanism. (See the gate check case study above for why this was caught.)

**Stage 3 (correct): Database Table View + ProbeTerminal.** The final redesign added a proper visualization above ProbeTerminal: a database table showing posts schema columns (id, title, user_id) with cascade animation. Each row turns red sequentially as its COUNT(*) query fires. The absence of a `comments_count` column IS the visual problem. ProbeTerminal sits below and drives the visualization via `onProbe`. The reward phase adds the column.

The lessons: (1) Always use shared components instead of custom terminals. (2) Using the right component is necessary but not sufficient: ProbeTerminal drives discovery, it does not replace a visualization. (3) The visualization must show the mechanism (rows cascading, columns appearing), not just log text.

```tsx
// BAD: custom terminal UI duplicating ProbeTerminal
const [firedProbes, setFiredProbes] = useState<Set<string>>(new Set());
const [queryLog, setQueryLog] = useState<string[]>([]);
// ... 80+ lines of custom state, animation, and JSX

// BETTER but still wrong: ProbeTerminal alone (no visualization above it)
<ProbeTerminal onProbe={handleProbe} probes={PROBES} title="Database Log" />

// GOOD: visualization + ProbeTerminal
<DatabaseTableView posts={postBlocks} onCascade={...} />  {/* Shows the mechanism */}
<ProbeTerminal onProbe={handleProbe} probes={PROBES} />   {/* Drives interaction */}
```

**ProbeTerminal accepts `className` for layout control.** By default, the output area has `max-h-48`. When the terminal should fill its parent container (e.g., no other content above it), pass `className="flex-1 flex flex-col"` and wrap it in a flex container with `flex-1 min-h-0`:

```tsx
// Terminal fills available space
<div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
  <ProbeTerminal
    className="flex-1 flex flex-col"
    onProbe={handleProbe}
    probes={PROBES}
    title="Database Log"
  />
</div>
```

## Flow Animation Pattern (for custom zone layouts)

When a level uses custom zone layouts (not PipelineFlow), use the flow animation pattern to show data moving through zones:

- **`flowPhase` state**: integer tracking current animation step. `-1` = idle, even numbers = zone highlights, odd numbers = edge animations.
- **`flowMessages` array**: messages shown at each zone during animation. Messages are monotonically inclusive (once shown, they stay visible with `opacity-70`).
- **`runFlow(messages)` callback**: advances phases sequentially with delays derived from `ANIMATION_DURATION_MS`.
- **`clearFlow()` callback**: cancels pending timeouts. Called on unmount via `useEffect(() => clearFlow, [clearFlow])`.
- **`flowTimeoutsRef`**: ref holding pending `setTimeout` IDs for cleanup.

**Data maps for flow animations:**
- `OBSERVE_FLOW`: maps probe IDs to zone message arrays (e.g., `'empty-post': ['POST from client', 'No validations', 'Saved! 201']`)
- `REWARD_FLOW`: maps stress scenario IDs to zone message arrays

**Zone highlighting during flow:**
- Active zone: `ring-2 ring-primary/60 shadow-lg shadow-primary/10`
- Flow message appears with `animate-in fade-in duration-300` when zone activates
- Post-activation: message stays visible with `opacity-70`
- Color-coded: `text-primary` (neutral), `text-destructive` (failures), `text-success` (passes)

**FlowConnector between zones:**
- Use `FlowConnector` component (`@/components/levels/FlowConnector`) instead of `ArrowDown` icons or dashed borders.
- `active={flowPhase === N}` where N is the odd-numbered phase between two zones.
- `dotColor` changes based on context: `bg-destructive` for failures, `bg-success` for passes, `bg-primary` for neutral.
- **Direction must match the visualization's data flow.** Use `direction="vertical"` when data flows top-to-bottom (e.g., L10's data gate), `direction="horizontal"` when data flows left-to-right (e.g., L15's browser-server handshake). The dot travel direction follows from how the concept is visualized, not from a fixed rule.
- For custom-sized connectors, pass `className` with absolute positioning tailored to the visualization's layout.

**Auto-inspect after probe:**
After `handleProbe` fires, call `setInspectedStages(new Set([...allStageIds]))` to remove `?` indicators from all zones, since the flow animation reveals all zones.

**Zone content must be gated behind flowPhase (critical):**
When a probe fires, state like `lastProbeId` updates instantly, but the flow animation takes time to reach each zone. If zone content (sublabels, badges, border colors) reacts to `lastProbeId` directly, zones show their result before the animation reaches them, breaking the illusion.

Fix: derive gated flags that check both the probe state AND the flow phase:

```tsx
// Zone N shows result only after flow reaches it OR animation is done
const gateRevealed = probeState && (flowPhase >= 2 || flowPhase === -1);
const apiRevealed = probeState && (flowPhase >= 4 || flowPhase === -1);
```

Then use `gateRevealed`/`apiRevealed` instead of raw `probeState` for zone styling, sublabels, and badges. The pattern: zone at phase N gates behind `flowPhase >= N || flowPhase === -1`.

## Discovery Hint Pattern

When discoveries require clicking on visualization nodes (not just firing probes), the `?` indicator alone is not enough. Show a progressive `<Alert variant="info">` hint below the `DiscoveryChecklist` to guide the player:
- After the player has completed the obvious actions (e.g., fired 2+ probes), show a gentle hint: "Click the zones with **?** to inspect their code"
- After all obvious actions are exhausted but discoveries remain incomplete, show a specific hint naming the exact zone: "Now click the **Serializer** zone to see where the N+1 hides"
- Gate hints behind a `firedProbeCount` (or equivalent) state to avoid showing them too early

```tsx
{firedProbeCount >= 2 && !discoveryGating.isUnlocked && (
  <Alert className="mt-3 animate-in fade-in duration-500" variant="info">
    <Info className="w-4 h-4" />
    <AlertDescription className="text-xs">
      {firedProbeCount >= 3
        ? <>Now click the <span className="font-medium">Serializer</span> zone to see where the N+1 hides.</>
        : <>Click the zones with <span className="font-medium">?</span> to inspect their code</>
      }
    </AlertDescription>
  </Alert>
)}
```

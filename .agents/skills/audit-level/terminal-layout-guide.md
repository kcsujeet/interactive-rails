# Terminal Panel Layout Guide

Detailed guidance for sizing and layout of ProbeTerminal, StressTestPanel, and SimulatedTerminal within the center panel. The visualization must always remain visible; terminals must never grow to hide it.

## NON-NEGOTIABLE RULE: terminals dock at the bottom of the center panel

In every level, every terminal component (`ProbeTerminal`, `StressTestPanel`, `SimulatedTerminal` / `TerminalChoiceStep`) renders **at the bottom of the center panel**, below the visualization. Never above it. Never beside it. Never floating in the middle.

The center panel column layout is `flex flex-col`:
1. `LevelHeader` (always first, fixed).
2. Visualization area (`flex-1 min-h-0`, takes the remaining vertical space, never scrolls).
3. Terminal (docked at the bottom, fixed natural height).

Why: this is the player's mental model across the entire curriculum. The visualization shows what's happening; the terminal is the player's input affordance to make it happen. Putting the terminal anywhere else breaks that model and forces the player to hunt for the input. It also reliably blows out the page height: when the visualization grows or terminal output streams in, anything above them gets pushed off-screen. With the terminal docked at the bottom and the visualization given `flex-1 min-h-0 overflow-hidden`, the page envelope stays stable.

**Audit recipe (run every audit):** open the level component, find the JSX. Verify:

(a) the terminal component is rendered AFTER the visualization in document order;

(b) the terminal's parent provides bottom-docking (it's the last child of a `flex flex-col` and the visualization above it has `flex-1 min-h-0`);

(c) the terminal wrapper has bottom breathing room — `pb-4` (16px) is the canonical value. `pb-2` (8px) is too tight and reads as "the terminal is bumping into the bottom edge of the panel." `pb-6` is also acceptable but consistent `pb-4` across levels is the goal;

(d) **the visualization fills the full available height between the level header and the terminal**. Custom Type 3 visualizations don't get this for free — `flex-1 min-h-0` on the outer wrapper is necessary but not sufficient. The inner content also needs to stretch. If the visualization is a grid of cards (per L14) or a list of zones, the grid / list itself must also be `flex-1 min-h-0`, AND the cards / zones inside must `h-full` (in a grid cell) or `flex-1` (in a flex container) so they grow to fill. Otherwise the visualization renders at its natural height and a void appears between it and the terminal — the player perceives "broken layout, lots of empty space," not "compact visualization."

`PipelineFlow` and `QueryZoneFlow` handle (d) for free because they fill via React Flow's auto-fit. Custom Type 3 visualizations have to wire it up explicitly.

Any layout that puts the terminal above, beside, or floating; or hugs the bottom edge with `pb-0` / `pb-1` / `pb-2`; or leaves a void above the terminal because the visualization stops at its natural height — fails this rule.

**Custom Type 3 stretch recipe (canonical for non-PipelineFlow visualizations):**

```tsx
{/* Phase wrapper (already correct in most levels) */}
<div className="flex-1 flex flex-col relative">
  {/* Visualization — MUST stretch */}
  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
    <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
      {/* Each grid cell uses h-full */}
      <ColumnPanel className="h-full">...</ColumnPanel>
    </div>
  </div>
  {/* Terminal wrapper at bottom with breathing room */}
  <div className="px-6 pb-4">
    <ProbeTerminal ... />
  </div>
</div>
```

The chain is: phase wrapper `flex-1 flex flex-col` → visualization `flex-1 min-h-0` → inner content (grid/list) `flex-1 min-h-0` → individual items `h-full` (grid) or `flex-1` (flex). Break the chain anywhere and the void appears.

**Case study (L14, 2026-05-09):** the customer-impact dashboard initially overflowed the center panel — the terminal was below the dashboard but the dashboard was tall enough to push the terminal's button row off-screen. The fix was to compact the dashboard (3-column horizontal grid + slim incident log) so the visualization fits the available height and the terminal stays docked at the bottom with its buttons reachable. Compacting the visualization is the right knob to turn, never moving the terminal somewhere else.

## Shared Terminal Components

Three shared terminal components exist. Levels must use these instead of building custom terminal UIs:

| Component | Phase | Prompt style | Purpose |
|-----------|-------|-------------|---------|
| `ProbeTerminal` | Observe | Amber `>` | Fire test probes to discover vulnerabilities |
| `StressTestPanel` | Reward | Shield icon | Fire stress test scenarios to verify the fix |
| `SimulatedTerminal` (via `TerminalChoiceStep`) | Build | Green `$` | Pick the right shell command |

- Never build a custom terminal div with traffic-light dots, scrollable log, and buttons
- If the terminal should fill the panel, pass `className="flex-1 flex flex-col"`

## Terminal Panel Sizing

**ProbeTerminal and StressTestPanel must NEVER grow to hide the visualization above them.** The visualization must always remain visible. There are two layout patterns depending on the visualization type.

### Pattern A: Custom Visualization (natural height)

Use when the visualization has a fixed/natural height (e.g., L30 Cache Waterfall with stacked layers). The terminal fills remaining space and scrolls internally.

```tsx
// Pattern A: terminal fills remaining space (L30-style)
<div className="flex-1 flex flex-col">
  <CustomVisualization />                       {/* Natural height */}
  <div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
    <StressTestPanel className="flex-1 flex flex-col" ... />
  </div>
</div>
```

When `className` is passed to StressTestPanel/ProbeTerminal, their results log uses `flex-1 min-h-0` to fill available space and scroll internally. The wrapper div must have `flex-1 min-h-0 flex flex-col` so it participates in the flex layout and can shrink.

### Pattern B: PipelineFlow (flex height)

Use when the visualization uses `flex-1` to fill space (e.g., L31 PipelineFlow). The terminal has a bounded fixed size (`min-h-36 max-h-64`) and does NOT flex-fill. No `className` is passed.

```tsx
// Pattern B: terminal is bounded, pipeline takes priority (L31-style)
<div className="flex-1 flex flex-col">
  <div className="flex-1 relative">            {/* Pipeline takes priority */}
    <PipelineFlow ... />
  </div>
  <div className="px-6 pb-2">                  {/* Plain wrapper, no flex */}
    <StressTestPanel ... />                     {/* No className prop */}
  </div>
</div>
```

When no `className` is passed, the results log uses `min-h-36 max-h-64` for fixed bounds. The pipeline keeps `flex-1` priority and the terminal sits below at a fixed bounded size.

### How to Choose

If the visualization has a **natural/intrinsic height** (custom zones, grids, stacked layers, tables), use **Pattern A**.

If the visualization uses **`flex-1` to fill available space** (PipelineFlow, ReactFlow), use **Pattern B**.

### Pattern C: Short Custom Visualization (terminal anchored at bottom)

Use when the visualization has a short natural height (e.g., L36's database table with 3 rows) and the terminal should NOT fill remaining space (it would be huge) but instead sit at the bottom of the panel. The gap between the visualization and the terminal is intentional, matching how every other level positions its terminal.

```tsx
// Pattern C: terminal pinned to bottom, viz at top (L36-style)
<div className="flex-1 flex flex-col">
  <DatabaseTable />                               {/* Short natural height */}
  <div className="mt-auto px-6 pb-2">             {/* mt-auto pushes to bottom */}
    <StressTestPanel ... />                        {/* No className prop */}
  </div>
</div>
```

The `mt-auto` on the terminal wrapper consumes all remaining flex space as top margin, pushing the terminal to the bottom edge. The terminal uses Pattern B sizing (bounded, no `className` prop) so it does not grow.

### How to Choose

If the visualization has a **natural/intrinsic height and fills most of the panel** (custom zones, grids, stacked layers), use **Pattern A**.

If the visualization uses **`flex-1` to fill available space** (PipelineFlow, ReactFlow), use **Pattern B**.

If the visualization has a **short natural height** (small table, compact diagram) and the terminal should anchor at the bottom, use **Pattern C**.

### Common Mistakes

**Mistake: Using Pattern A with PipelineFlow.** The terminal gets `flex-1` and competes with the pipeline for space. With enough results, the terminal pushes the pipeline off screen.

**Mistake: Using Pattern B with a custom visualization.** The terminal is bounded at `max-h-64` (256px) and leaves large empty gaps below when the visualization is short.

**Mistake: Omitting `mt-auto` for short visualizations.** The visualization and terminal bunch together at the top of the panel with a huge empty gap below. Case study: L36's 3-row database table and ProbeTerminal sat adjacent with no spacing, wasting 60% of the panel. Fix: add `mt-auto` to the terminal wrapper (Pattern C).

**Mistake: Flex wrapper without `min-h-0`.** The wrapper div has `flex-1 flex flex-col` but no `min-h-0`. Without `min-h-0`, the flex child cannot shrink below its content height, so `overflow-y-auto` on the results log never activates.

**Mistake: Adding `className` but not updating the wrapper.** Passing `className="flex-1 flex flex-col"` to the terminal component but leaving the wrapper as a plain `<div className="px-6 pb-2">`. The terminal tries to flex-fill but the wrapper has no flex context, so it grows unbounded.

## Internal Implementation

Both ProbeTerminal and StressTestPanel use a conditional on the `className` prop to switch between the two modes:

```tsx
// Inside the component's results log div:
className={cn(
  'p-3 font-mono text-sm overflow-y-auto',
  className ? 'flex-1 min-h-0' : 'min-h-36 max-h-64',
  // With className: fill available space, scroll internally
  // Without className: bounded fixed size
)}
```

The header and footer sections have `shrink-0` so they never compress when the results area scrolls.

## Checklist

- [ ] **Pattern A (custom viz, fills panel):** terminal wrapper has `flex-1 min-h-0 flex flex-col`, terminal gets `className="flex-1 flex flex-col"`
- [ ] **Pattern B (PipelineFlow):** terminal wrapper is a plain div, terminal gets NO `className` prop
- [ ] **Pattern C (short custom viz):** terminal wrapper has `mt-auto`, terminal gets NO `className` prop
- [ ] Terminal results log scrolls instead of growing (verify by firing 6+ requests)
- [ ] Visualization remains visible at all times regardless of terminal content

## Adaptive Color Reference (built into shared components)

Terminal components use adaptive light/dark styling. If a level builds custom terminal-like UI, it must follow the same pattern. Never use always-dark terminal colors like `bg-zinc-900` without a `bg-zinc-50` light-mode counterpart.

| Element | Light mode | Dark mode |
|---------|-----------|-----------|
| Container | `bg-zinc-50` | `dark:bg-zinc-900` |
| Border | `border-border` | (semantic, auto) |
| Header | `bg-muted` | (semantic, auto) |
| Header text | `text-muted-foreground` | (semantic, auto) |
| Body text | `text-foreground` | (semantic, auto) |
| Footer | `bg-muted/50` | (semantic, auto) |
| Green text | `text-emerald-600` | `dark:text-emerald-400` |
| Amber text | `text-amber-600` | `dark:text-amber-400` |
| Red text | `text-red-600` | `dark:text-red-400` |
| Cyan text | `text-cyan-600` | `dark:text-cyan-400` |
| Cursor | `bg-foreground/50` | (semantic, auto) |
| Probe buttons | `bg-amber-100 text-amber-700 border-amber-300` | `dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50` |
| Allowed buttons | `bg-emerald-100 text-emerald-700 border-emerald-300` | `dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50` |
| Blocked buttons | `bg-red-100 text-red-700 border-red-300` | `dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50` |

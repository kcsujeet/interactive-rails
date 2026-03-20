# Terminal Panel Layout Guide

Detailed guidance for sizing and layout of ProbeTerminal, StressTestPanel, and SimulatedTerminal within the center panel. The visualization must always remain visible; terminals must never grow to hide it.

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

### Common Mistakes

**Mistake: Using Pattern A with PipelineFlow.** The terminal gets `flex-1` and competes with the pipeline for space. With enough results, the terminal pushes the pipeline off screen.

**Mistake: Using Pattern B with a custom visualization.** The terminal is bounded at `max-h-64` (256px) and leaves large empty gaps below when the visualization is short.

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

- [ ] **Pattern A (custom viz):** terminal wrapper has `flex-1 min-h-0 flex flex-col`, terminal gets `className="flex-1 flex flex-col"`
- [ ] **Pattern B (PipelineFlow):** terminal wrapper is a plain div, terminal gets NO `className` prop
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

# Architecture

## System Overview

Interactive Rails is a fully static, client-side web app. Astro prerenders every page to HTML/CSS/JS at build time, and React islands provide the interactive level gameplay. There is no server, no API, no database, and no authentication. Player progress is stored entirely in the browser's `localStorage`.

```text
User Browser
  |
  +-- Static Astro pages (prerendered HTML)
  |
  +-- React islands (level gameplay, sandbox)
  |
  +-- localStorage (progress, via src/lib/progress.ts)
```

The whole site can be served from any static host (GitHub Pages, Netlify, Cloudflare Pages, or `bunx serve dist`).

## Tech Stack

| Area | Technology |
|------|------------|
| Runtime and package manager | Bun |
| Site framework | Astro (static output, no adapter) |
| Interactive UI | React, TypeScript |
| Visualization | React Flow (@xyflow/react) |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| Progress storage | Browser `localStorage` |

## Project Structure

```text
interactive-rails/
  package.json
  astro.config.mjs          output: 'static', no adapter
  tsconfig.json
  biome.json
  src/
    pages/
      index.astro
      dashboard.astro
      sandbox.astro
      acts/
        index.astro
        [actId]/[levelId]/index.astro     briefing (getStaticPaths)
        [actId]/[levelId]/play.astro       gameplay
        [actId]/[levelId]/complete.astro   completion
    layouts/
    features/
      act1-foundation/
      act2-users-security/
      act3-clean-architecture/
      act4-performance/
      act5-advanced-features/
      act6-operations/
      act7-scale/
      sandbox/
    components/
      levels/               Shared level UI and visualization components
      pages/                Page-level React islands
      ui/                   shadcn/ui components
    hooks/
    lib/                    Registries, progress, shared utilities
    stores/                 Zustand stores
    utils/                  Code generation, node behavior, pipeline data
    game/
    types/
    styles/
  docs/
```

## Static Routing

Act and level pages use dynamic route files that are expanded at build time. Each `[actId]/[levelId]/*.astro` route implements `getStaticPaths()`, which calls `getActLevelStaticPaths()` in `src/lib/acts-registry.ts`. Every act/level combination becomes a prerendered HTML file in `dist/`. There are no server-rendered routes.

## Frontend Flow

### Page Shell

Astro renders route shells and mounts React islands where interaction is needed.

```astro
---
import LevelPlayApp from '@/components/pages/LevelPlayApp';
---

<LevelPlayApp client:load actId={actId} levelId={levelId} />
```

### Level Selection

`src/components/pages/ActsListApp.tsx` reads progress through `src/lib/progress.ts`, combines it with act content from the registry, and renders the act list.

### Level Playback

`src/components/pages/LevelPlayApp.tsx` looks up the active level in `src/lib/levels-registry.ts`.

Current levels render a custom component with this sequence:

```text
briefing -> observe -> build -> reward -> complete
```

Most custom levels use shared components from `src/components/levels/`, including:

- `LevelLayout`
- `DiscoveryChecklist`
- `ProbeTerminal`
- `StageInspector`
- `StepProgress`
- `TerminalChoiceStep`
- `OptionCard`
- `StressTestPanel`
- `PipelineFlow`
- `QueryZoneFlow`

## Registries

| Registry | Responsibility |
|----------|----------------|
| `src/lib/acts-registry.ts` | Assembles acts and their level lists, exposes `getAllLevels()` and `getActLevelStaticPaths()` for static routing |
| `src/lib/levels-registry.ts` | Maps level IDs to their React components |
| `src/lib/codebase-registry.ts` | Aggregates each level's generated Rails code files into a unified project view (last-writer-wins on filename) |

## State Management

Zustand stores are split by concern:

| Store | Responsibility |
|-------|----------------|
| `game.ts` | Player XP, unlocks, achievements, and progression state |
| `pipeline.ts` | Sandbox pipeline nodes, edges, selection, and history |
| `ui.ts` | Modals, panels, toasts, preferences, and responsive state |

The `game` store persists to `localStorage` via Zustand's `persist` middleware. Level-completion progress is also tracked through `src/lib/progress.ts`.

## Progress Data

All progress is stored in the browser's `localStorage` by `src/lib/progress.ts` under the key `interactive_rails_progress_v1`. There is no account, no login, and no server sync. Clearing browser storage resets progress; it is never uploaded anywhere.

## Simulation Engine

The sandbox playground (`src/features/sandbox/`) runs a client-side request simulation in `src/features/sandbox/utils/sandbox-simulation.ts`, with node behavior defined in `src/utils/nodeBehavior.ts`. This is a free-form experimentation mode, separate from the primary three-phase level loop. Levels drive their own visualizations directly through React Flow components rather than through the sandbox engine.

## Code Generation

Levels build up a virtual Rails codebase as the player progresses. Each level defines a `getCodeFiles()` function (in its `data/code-files.ts`) and registers it via `registerLevelCode(...)`. The codebase viewer reads these through `src/lib/codebase-registry.ts` to show the cumulative generated project. `src/utils/codeGeneration.ts` holds the shared `CodeFile` type and helpers.

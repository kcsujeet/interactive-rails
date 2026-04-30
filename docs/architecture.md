# Architecture

## System Overview

Interactive Rails uses a unified Astro + Cloudflare Workers architecture. A single deployment serves static pages, React islands, and the Hono API mounted at `/api/*`.

```text
User Browser
  |
  v
Cloudflare Worker
  |
  +-- Astro pages and React islands
  |
  +-- /api/* catch-all
        |
        v
      Hono API
        |
        v
      Cloudflare D1
```

## Tech Stack

| Area | Technology |
|------|------------|
| Runtime and package manager | Bun |
| Frontend | Astro, React, TypeScript |
| Visualization | React Flow (@xyflow/react) |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| API | Hono inside Astro's Cloudflare adapter |
| Auth | Better Auth |
| Database | Cloudflare D1 |
| Validation | Zod |

## Project Structure

```text
interactive-rails/
  package.json
  astro.config.mjs
  wrangler.jsonc
  tsconfig.json
  biome.json
  src/
    server/
      index.ts              Hono app mounted by Astro
      lib/auth.ts           Better Auth configuration
      middleware/           Request ID, auth, and rate limiting
      routes/               Pipeline and auth routes
      repositories/         D1 data access helpers
      db/schema.sql         Source schema
    pages/
      api/[...path].ts      API catch-all route
      acts/                 Act and level pages
      dashboard.astro
    features/
      act1-foundation/
      act2-users-security/
      act3-clean-architecture/
      act4-performance/
      act5-production/
      act6-operations/
      act7-scale/
    components/
      levels/               Shared level UI and visualization components
      pipeline/             Sandbox pipeline editor components
      pages/                Page-level React islands
      ui/                   shadcn/ui components
    hooks/
    lib/
    stores/
    styles/
  docs/
```

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

`src/components/pages/ActsListApp.tsx` loads progress through `src/lib/progress.ts`, combines it with act content, and renders the act list.

### Level Playback

`src/components/pages/LevelPlayApp.tsx` looks up the active level in `src/lib/levels-registry.ts`.

Current levels usually render a custom component with this sequence:

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

The sandbox and legacy fallback path still use the visual pipeline editor, but that is not the primary teaching loop for current levels.

## State Management

Zustand stores are split by concern:

| Store | Responsibility |
|-------|----------------|
| `game.ts` | Player XP, unlocks, achievements, and local progression state |
| `pipeline.ts` | Sandbox pipeline nodes, edges, selection, and history |
| `simulation.ts` | Sandbox request simulation metrics and runtime state |
| `ui.ts` | Modals, panels, toasts, preferences, and responsive state |

## API Flow

The active mounted API is created in `src/server/index.ts`.

```text
src/pages/api/[...path].ts
  -> src/server/index.ts
    -> /api/auth/** handled by Better Auth
    -> /api/pipeline/* handled by pipelineRoutes
```

The primary gameplay endpoints are:

- `GET /api/pipeline/progress`
- `POST /api/pipeline/levels/:levelId/complete`
- `POST /api/pipeline/progress/import`
- `GET /api/pipeline/leaderboard/:levelId`

## Progress Data

Guest progress is stored in `localStorage` by `src/lib/progress.ts`. Authenticated progress is stored in D1.

The database still contains legacy names such as `dungeon_completions`, `dungeon_id`, and `dungeons_completed`. In current gameplay those represent level completions, level IDs, and levels completed.

## Authentication

Authentication is handled by Better Auth in `src/server/lib/auth.ts` and mounted in `src/server/index.ts`:

```typescript
app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  const auth = createAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  return auth.handler(c.req.raw);
});
```

## Security Considerations

- Better Auth manages sessions and credential flows.
- CORS is restricted to configured origins.
- Rate limiting runs on `/api/*`.
- Request IDs are attached for traceability.
- D1 access uses parameterized `prepare().bind()` queries.
- Zod validates API request bodies.

## Compatibility Notes

Some older files and storage names still use the previous realm, dungeon, or simulation vocabulary. Treat those as compatibility layers unless the active level flow or mounted API still depends on them.

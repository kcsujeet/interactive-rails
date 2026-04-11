# Architecture

## System Overview

Interactive Rails uses a unified Astro 6 + Cloudflare Workers architecture. A single deployment serves both static pages and the API.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          Astro 6 (SSR + Static)                         │    │
│  │  ┌──────────────────┐    ┌──────────────────────────┐   │    │
│  │  │  Static Pages    │    │  /api/* catch-all         │   │    │
│  │  │  React Islands   │    │  Hono API (auth, pipeline)│   │    │
│  │  └──────────────────┘    └──────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                         │                       │
│                                         ▼                       │
│                              ┌─────────────────────┐            │
│                              │   Cloudflare D1     │            │
│                              │   (SQLite)          │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Runtime & Package Manager
- **Bun** - Fast JavaScript runtime, package manager, and test runner

### Frontend
- **Astro** (v6.x) - Static site generator with islands architecture
- **React** (v19.x) - Interactive components (game canvas, forms)
- **Zustand** - State management with Immer middleware
- **React Flow** (@xyflow/react) - Node-based pipeline visualization
- **Tailwind CSS** (v4.x) - Utility-first styling
- **Lucide React** - Icon library
- **TypeScript** - Type safety throughout

### Backend API (runs inside Astro via Cloudflare adapter)
- **Hono** (v4.x) - Lightweight web framework, mounted at `/api/*`
- **Zod** (v4.x) - Runtime validation

### Database
- **Cloudflare D1** - SQLite at the edge

### Authentication
- **Custom JWT** - JSON Web Tokens with 7-day expiration
- Password hashing via Web Crypto API (PBKDF2)

## Project Structure

```
interactive-rails/
├── package.json              # Project config (single package)
├── astro.config.mjs          # Astro + Cloudflare adapter
├── wrangler.jsonc            # Cloudflare Workers config (D1 bindings)
├── tsconfig.json             # TypeScript (extends astro/tsconfigs/strict)
├── biome.json                # Linter/formatter config
├── bun.lock                  # Bun lockfile
│
├── src/
│   ├── server/               # Hono API (mounted at /api/*)
│   │   ├── index.ts          # Main Hono app
│   │   ├── types.ts          # Env bindings, entity types
│   │   ├── constants/        # Game/auth/API constants
│   │   ├── errors/           # Error classes (AppError hierarchy)
│   │   ├── lib/auth.ts       # Better Auth configuration
│   │   ├── middleware/        # Auth, rate limiting, request ID
│   │   ├── routes/           # Pipeline, auth, game, progress
│   │   ├── repositories/     # D1 data access layer
│   │   ├── services/         # Game mechanics, content
│   │   ├── utils/            # Logger, response helpers
│   │   └── db/               # SQL schema and migrations
│   ├── features/             # Feature modules (bulletproof-react)
│   │   ├── acts-registry.ts  # All acts registry
│   │   ├── levels-registry.ts # Level component registry
│   │   ├── act1-foundation/  # Act content + components
│   │   │   ├── content.ts
│   │   │   └── components/
│   │   ├── act2-users-security/
│   │   ├── act3-clean-architecture/
│   │   ├── act4-performance/
│   │   ├── act5-production/
│   │   ├── act6-reliability/
│   │   ├── act7-scale/
│   │   └── act8-mastery/
│   ├── components/
│   │   ├── levels/           # Shared level components
│   │   ├── pipeline/         # Pipeline editor (React Flow)
│   │   ├── pages/            # Page-level app components
│   │   ├── ui/               # shadcn/ui components
│   │   └── auth/             # Auth components
│   ├── hooks/                # Shared hooks
│   ├── utils/                # Shared utilities
│   ├── lib/                  # Utilities (api, auth-client, progress)
│   ├── types/                # TypeScript definitions
│   ├── stores/               # Zustand state management
│   ├── layouts/              # Astro layouts
│   ├── pages/                # Astro routes
│   │   ├── index.astro
│   │   ├── api/[...path].ts  # Catch-all: delegates to Hono app
│   │   └── acts/[actId]/[levelId]/
│   └── styles/               # Global CSS
│
├── public/                   # Static assets
├── shared/                   # Shared types
└── docs/                     # Documentation
```

## Key Architectural Decisions

### 1. Astro Islands Architecture

Interactive components (game canvas, forms) are React "islands" in otherwise static pages.

```astro
---
import LevelPlayApp from '@/components/pages/LevelPlayApp';
---
<GameLayout>
  <LevelPlayApp client:load actId={actId} levelId={levelId} />
</GameLayout>
```

### 2. Zustand for State Management

Three separate stores for different concerns:

```typescript
// game.ts - Player progression
const useGameStore = create<GameState>()(
  persist(immer((set) => ({
    playerLevel: 1,
    completedLevels: [],
    achievements: [],
    // ...
  })), { name: 'game-storage' })
);

// pipeline.ts - Editor state
const usePipelineStore = create<PipelineState>()(
  immer((set) => ({
    nodes: [],
    connections: [],
    selectedNodeId: null,
    // ...
  }))
);

// simulation.ts - Runtime simulation
const useSimulationStore = create<SimulationState>()(
  immer((set) => ({
    isRunning: false,
    metrics: { latency: [], throughput: 0, ... },
    enemies: [],
    defenses: [],
    // ...
  }))
);
```

### 3. Tick-Based Simulation Engine

The simulation runs at ~30 FPS, calculating metrics in real-time:

```typescript
class SimulationEngine {
  private tickInterval: number | null = null;

  start() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000 / 30); // 30 FPS
  }

  tick() {
    // Process requests through pipeline nodes
    // Calculate metrics (latency, throughput, queries)
    // Spawn/update enemies
    // Activate defenses
    // Update stability score
  }
}
```

### 4. Two-Tier Level Component System

Levels use one of two patterns:

**Custom Interactive Components (43 levels):** Each has a concept-specific interaction (selection, drag-and-drop, simulation, visualization) registered in `levels-registry.ts`. These follow a 3-panel layout: `InstructionPanel (left) + concept interaction (center) + CodePreviewPanel (right)`.

```typescript
// features/act4-performance/components/Level24Indexing.tsx
export function Level24Indexing({ onComplete }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  // ... concept-specific state and interaction logic
  return (
    <LevelLayout>
      <LeftPanel><InstructionPanel steps={steps} /></LeftPanel>
      <CenterPanel>
        <LevelHeader title="Database Indexing" validate={validate} />
        {/* Custom interactive visualization */}
      </CenterPanel>
      <RightPanel><CodePreviewPanel code={migrationCode} /></RightPanel>
    </LevelLayout>
  );
}
```

**Generic Pipeline Builder (7 levels: L5, L6, L8, L9, L10, L19, L37):** Used when the pipeline architecture IS the concept being taught. Drag nodes from palette, connect on canvas.

## Data Flow

### Game Flow
```
1. User selects level from Acts page
2. LevelPlayApp loads level-specific component
3. Player builds pipeline using drag-drop
4. Simulation engine processes requests
5. Metrics update in real-time
6. Success conditions checked each tick
7. Completion screen shows stars/rewards
8. Progress saved to localStorage (and server if logged in)
```

### Authentication Flow
```
1. User submits login form
2. POST /api/auth/login with { email, password }
3. Worker verifies password hash (PBKDF2)
4. Worker generates JWT with userId
5. Frontend stores JWT in localStorage
6. Guest progress imported to account
7. Subsequent requests include Authorization header
```

## Environment Configuration

### Astro (astro.config.mjs)
```javascript
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
});
```

### Cloudflare (wrangler.jsonc)
```jsonc
{
  "name": "interactive-rails",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS", "directory": "./dist" },
  "d1_databases": [{ "binding": "DB", "database_name": "interactive-rails-db" }]
}
```

### API Bindings Access
```typescript
// In Astro catch-all route (src/pages/api/[...path].ts)
import { env } from 'cloudflare:workers';
import app from '@/server/index';
return app.fetch(request, env);

// Inside Hono route handlers, access via c.env
const db = c.env.DB; // D1Database
```

## Security Considerations

1. **Password Storage**: PBKDF2 with 100,000 iterations
2. **JWT**: Signed with HS256, 7-day expiry
3. **CORS**: Restricted to specific origins
4. **Input Validation**: Zod schemas on all endpoints
5. **SQL Injection**: Parameterized queries via D1 prepare/bind

## Planned Improvements

### React Flow Migration for Pipeline Canvas

**Status**: POC created

Migrate the custom pipeline canvas to React Flow (@xyflow/react) for improved visualization.

**POC files:**
- `src/components/pipeline/` - Production React Flow components
- Old custom canvas at `src/components/PipelineCanvas.tsx` and `src/components/PipelineNode.tsx`

**Challenges to resolve:**
- Sequential particle animation timing
- Edge routing for branching MVC layouts
- Handle positioning for vertical connections

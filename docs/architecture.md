# Architecture

## System Overview

Interactive Rails uses a modern JAMstack architecture optimized for Cloudflare's edge network.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN/Edge                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Cloudflare Pages  │    │     Cloudflare Workers          │ │
│  │   (Astro Frontend)  │───▶│     (Hono API)                  │ │
│  │   Static + Islands  │    │     /api/*                      │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
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
- **Astro** (v5.x) - Static site generator with islands architecture
- **React** (v19.x) - Interactive components (game canvas, forms)
- **Zustand** - State management with Immer middleware
- **React Flow** (@xyflow/react) - Node-based pipeline visualization
- **Tailwind CSS** (v4.x) - Utility-first styling
- **Lucide React** - Icon library
- **TypeScript** - Type safety throughout

### Backend API
- **Cloudflare Workers** - Serverless edge functions
- **Hono** (v4.x) - Lightweight web framework for Workers
- **Zod** - Runtime validation

### Database
- **Cloudflare D1** - SQLite at the edge

### Authentication
- **Custom JWT** - JSON Web Tokens with 7-day expiration
- Password hashing via Web Crypto API (PBKDF2)

## Project Structure

```
interactive-rails/
├── package.json              # Root workspace config
├── bun.lock                  # Bun lockfile
├── biome.json                # Linter/formatter config
│
├── frontend/                 # Astro application
│   ├── astro.config.mjs      # Astro + Cloudflare adapter
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── features/          # Feature modules (bulletproof-react)
│       │   ├── acts-registry.ts        # All acts registry
│       │   ├── levels-registry.ts      # Level component registry (43 custom)
│       │   ├── act1-foundation/        # Act content + components
│       │   │   ├── content.ts          # Level definitions
│       │   │   ├── index.ts            # Public exports
│       │   │   └── components/         # Level-specific React components
│       │   │       ├── Level1StackChoice.tsx
│       │   │       ├── Level2Model.tsx
│       │   │       └── ...
│       │   ├── act2-users-security/
│       │   ├── act3-clean-architecture/
│       │   ├── act4-performance/
│       │   ├── act5-production/
│       │   ├── act6-reliability/
│       │   ├── act7-scale/
│       │   └── act8-mastery/
│       ├── components/
│       │   ├── levels/       # Shared level components
│       │   │   ├── LevelLayout.tsx     # 3-panel layout
│       │   │   ├── InstructionPanel.tsx # Left panel
│       │   │   ├── CodePreviewPanel.tsx # Right panel
│       │   │   ├── LevelHeader.tsx     # Header with submit
│       │   │   ├── DraggableNode.tsx
│       │   │   └── useLevelCompletion.ts
│       │   ├── pipeline/     # Pipeline editor (React Flow)
│       │   ├── inspector/    # Metrics inspector
│       │   ├── pages/        # Page-level app components
│       │   │   ├── ActsListApp.tsx
│       │   │   ├── ActDetailApp.tsx
│       │   │   ├── LevelInfoApp.tsx
│       │   │   ├── LevelPlayApp.tsx
│       │   │   └── SandboxApp.tsx
│       │   ├── ui/           # Reusable UI components (shadcn/ui)
│       │   └── auth/         # Auth components
│       ├── hooks/             # Shared hooks
│       │   ├── usePipelineState.ts
│       │   ├── usePipelineSimulation.ts
│       │   └── usePipelineValidation.ts
│       ├── utils/             # Shared utilities
│       │   ├── SimulationEngine.ts
│       │   ├── nodeBehavior.ts
│       │   ├── metrics.ts
│       │   ├── gameData.ts
│       │   └── pipelineTemplates.ts  # Reusable pipeline layouts
│       ├── lib/              # Utilities (api, progress, utils)
│       ├── types/            # TypeScript definitions (game.ts, level.ts)
│       ├── stores/           # Zustand state management
│       ├── layouts/          # Astro layouts
│       ├── pages/            # Astro routes
│       │   ├── index.astro
│       │   └── acts/[actId]/[levelId]/
│       │       ├── index.astro     # Level info
│       │       ├── play.astro      # Gameplay
│       │       └── complete.astro
│       └── styles/           # Global CSS
│
├── worker/                   # Cloudflare Worker API
│   ├── wrangler.toml
│   ├── package.json
│   └── src/
│       ├── index.ts          # Main entry, Hono app
│       ├── types.ts
│       ├── routes/
│       │   ├── auth.ts       # /api/auth/*
│       │   ├── progress.ts   # /api/progress/*
│       │   └── game.ts       # /api/game/*
│       ├── middleware/
│       │   └── auth.ts       # JWT validation
│       ├── services/
│       │   ├── auth.ts
│       │   └── progress.ts
│       └── db/
│           └── schema.sql
│
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

### Frontend (astro.config.mjs)
```javascript
export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), tailwind()],
});
```

### Worker (wrangler.toml)
```toml
name = "interactive-rails-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "interactive-rails-db"
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

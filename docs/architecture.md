# Architecture

## System Overview

RailsExpert uses a modern JAMstack architecture optimized for Cloudflare's edge network.

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
railsexpert/
├── package.json              # Root workspace config
├── bun.lock                  # Bun lockfile
├── biome.json                # Linter/formatter config
│
├── frontend/                 # Astro application
│   ├── astro.config.mjs      # Astro + Cloudflare adapter
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── components/
│       │   ├── game/         # Game components
│       │   │   ├── BriefingScreen.tsx
│       │   │   ├── CompletionScreen.tsx
│       │   │   ├── GameTopBar.tsx
│       │   │   ├── PipelineCanvas.tsx
│       │   │   ├── NodePalette.tsx
│       │   │   ├── InspectorPanel.tsx
│       │   │   ├── levels/   # Level-specific components (50 levels)
│       │   │   │   ├── act1/ # The Foundation (7 levels)
│       │   │   │   ├── act2/ # Users & Security (7 levels)
│       │   │   │   ├── act3/ # Clean Architecture (7 levels)
│       │   │   │   ├── act4/ # Performance (7 levels)
│       │   │   │   ├── act5/ # Production Features (8 levels)
│       │   │   │   ├── act6/ # Reliability (6 levels)
│       │   │   │   ├── act7/ # Scale (5 levels)
│       │   │   │   └── act8/ # Mastery (3 levels)
│       │   │   └── reactflow/ # React Flow POC components
│       │   ├── pipeline/     # Pipeline editor components
│       │   │   ├── PipelineCanvas.tsx
│       │   │   ├── PipelineEditor.tsx
│       │   │   ├── NodePalette.tsx
│       │   │   └── DataFlowEdge.tsx
│       │   ├── inspector/    # Metrics inspector
│       │   │   ├── InspectorPanel.tsx
│       │   │   ├── MetricsDisplay.tsx
│       │   │   └── QueryTraceViewer.tsx
│       │   ├── pages/        # Page-level app components
│       │   │   ├── ActsListApp.tsx
│       │   │   ├── ActDetailApp.tsx
│       │   │   ├── LevelInfoApp.tsx
│       │   │   ├── LevelPlayApp.tsx
│       │   │   └── SandboxApp.tsx
│       │   ├── ui/           # Reusable UI components
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── CodeBlock.tsx
│       │   │   └── Header.astro
│       │   └── auth/         # Auth components
│       │       ├── LoginForm.tsx
│       │       └── SignupForm.tsx
│       ├── layouts/
│       │   ├── BaseLayout.astro
│       │   └── GameLayout.astro
│       ├── pages/
│       │   ├── index.astro           # Homepage
│       │   ├── login.astro
│       │   ├── signup.astro
│       │   ├── dashboard.astro
│       │   ├── sandbox.astro
│       │   └── acts/
│       │       ├── index.astro       # Acts list
│       │       └── [actId]/
│       │           ├── index.astro   # Act detail
│       │           └── [levelId]/
│       │               ├── index.astro   # Level info
│       │               ├── play.astro    # Gameplay
│       │               └── complete.astro
│       ├── stores/           # Zustand state management
│       │   ├── game.ts       # Player progression
│       │   ├── pipeline.ts   # Pipeline editor state
│       │   ├── simulation.ts # Simulation state
│       │   ├── authStore.ts  # Authentication
│       │   └── ui.ts         # UI state
│       ├── engine/           # Game engine
│       │   ├── SimulationEngine.ts
│       │   ├── nodeBehavior.ts
│       │   └── metrics.ts
│       ├── content/          # Acts and levels data
│       │   └── acts/         # Individual act files
│       │       ├── index.ts
│       │       ├── act1-foundation.ts
│       │       ├── act2-security.ts
│       │       ├── act3-architecture.ts
│       │       ├── act4-performance.ts
│       │       ├── act5-production.ts
│       │       ├── act6-reliability.ts
│       │       ├── act7-scale.ts
│       │       └── act8-mastery.ts
│       ├── lib/              # Utilities
│       │   ├── api.ts
│       │   ├── progress.ts
│       │   └── utils.ts
│       ├── types/            # TypeScript definitions
│       └── styles/           # Global CSS
│           └── global.css
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

### 4. Level-Specific Components

Each level has its own component defining:
- Initial pipeline configuration
- Available nodes
- Success conditions
- Learning content

```typescript
// levels/act1/Level1StackChoice.tsx
export function Level1StackChoice() {
  return (
    <LevelLayout
      levelId="1-1"
      title="Choose Your Stack"
      availableNodes={['request', 'router', 'controller']}
      successCondition={(metrics) => metrics.throughput > 100}
    >
      <InstructionPanel content={learningContent} />
      <PipelineCanvas initialNodes={startingPipeline} />
    </LevelLayout>
  );
}
```

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
name = "railsexpert-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "railsexpert-db"
```

## Security Considerations

1. **Password Storage**: PBKDF2 with 100,000 iterations
2. **JWT**: Signed with HS256, 7-day expiry
3. **CORS**: Restricted to specific origins
4. **Input Validation**: Zod schemas on all endpoints
5. **SQL Injection**: Parameterized queries via D1 prepare/bind

## Planned Improvements

### React Flow Migration for Pipeline Canvas

**Status**: Planned (POC created)

Migrate the custom pipeline canvas to React Flow (@xyflow/react) for improved visualization.

**POC files:**
- `src/components/game/reactflow/` - PipelineNode, AnimatedEdge, ReactFlowCanvas
- `src/pages/sandbox-rf.astro` - Test page

**Challenges to resolve:**
- Sequential particle animation timing
- Edge routing for branching MVC layouts
- Handle positioning for vertical connections

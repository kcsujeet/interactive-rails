# Interactive Rails Documentation

Welcome to the Interactive Rails documentation. This folder contains comprehensive documentation for the Interactive Rails project - a gamified web application that teaches Ruby on Rails development through interactive pipeline-building gameplay.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, tech stack, and project structure |
| [Game Mechanics](./game-mechanics.md) | Pipeline building, simulation, and progression systems |
| [Content Structure](./content-structure.md) | Acts, levels, and learning content |
| [Development Setup](./development-setup.md) | Local development environment setup |
| [Deployment Guide](./deployment-guide.md) | Production deployment to Cloudflare |
| [API Reference](./api-reference.md) | API endpoint documentation |
| [Database Schema](./database-schema.md) | D1 database tables and relationships |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Start

```bash
# Install dependencies
bun install

# Start development servers (frontend + worker)
bun run dev
```

- Frontend: http://localhost:4321
- Worker API: http://localhost:8787

## Project Overview

Interactive Rails is an educational game where players learn **Rails 8 API-only** development by building a production-grade SaaS while mastering Rails 8 concepts through interactive pipeline-building gameplay.

The narrative arc takes players from a simple Blog API through a social platform, into a SaaS with payments, and ultimately to enterprise scale. Rails 8 features like Solid Queue, Solid Cache, Solid Cable, built-in auth, `params.expect()`, and `rate_limit` appear naturally as players progress. Testing is integrated from Level 12 onward.

1. **Concept-specific interactions** - Each level teaches through a unique interactive mechanic (selection, drag-and-drop, simulation, visualization)
2. **Pipeline building** - 7 levels use a visual pipeline builder where architecture IS the lesson
3. **Progressing through acts** - 8 acts covering Rails fundamentals to system design mastery

### Current Status

**8 Acts with 56 Total Levels:**

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | 8 (Levels 1-8) | MVC, CRUD, Routes, Controllers, Serializers, Associations, Seeds |
| 2 | Guards & Gates | 8 (Levels 9-16) | Authentication, Validations, Callbacks, Authorization, Testing, Strong Params, CORS, Scopes & Enums |
| 3 | Clean Architecture | 7 (Levels 17-23) | Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs |
| 4 | Performance | 9 (Levels 24-32) | N+1 Queries, Eager Loading, Narrow Fetching, Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching |
| 5 | Production Features | 8 (Levels 33-40) | Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning |
| 6 | Reliability | 7 (Levels 41-47) | Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring |
| 7 | Scale | 6 (Levels 48-53) | Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events |
| 8 | Mastery | 3 (Levels 54-56) | API Gateway, Database Sharding, The Architect (Capstone) |

### Key Features

- **Pipeline Builder** - Visual drag-and-drop editor for building request flows
- **Real-time Simulation** - Tick-based engine with live metrics (latency, throughput, queries)
- **Progress Tracking** - Star ratings, achievements, XP, and level unlocks
- **Sandbox Mode** - Free-form experimentation without constraints
- **Learning Content** - Integrated explanations, code examples, and best practices

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | Astro 5.x + React 19 |
| State | Zustand |
| Visualization | React Flow (@xyflow/react) |
| Styling | Tailwind CSS 4.x |
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Auth | JWT (custom implementation) |

## Key Directories

```
interactive-rails/
├── frontend/              # Astro app with React components
│   └── src/
│       ├── pages/         # Astro routes (acts, levels, sandbox)
│       ├── features/      # Feature modules (bulletproof-react pattern)
│       │   ├── acts-registry.ts      # All acts registry
│       │   ├── levels-registry.ts    # Level component registry (56 custom)
│       │   ├── act1-foundation/      # Act 1 content + components
│       │   │   ├── content.ts        # Level definitions
│       │   │   └── components/       # Level-specific React components
│       │   ├── act2-users-security/
│       │   ├── act3-clean-architecture/
│       │   ├── act4-performance/
│       │   ├── act5-production/
│       │   ├── act6-reliability/
│       │   ├── act7-scale/
│       │   └── act8-mastery/
│       ├── components/    # Shared components
│       │   ├── levels/    # Shared level components (LevelLayout, InstructionPanel, etc.)
│       │   ├── pipeline/  # Pipeline editor components (React Flow)
│       │   ├── inspector/ # Metrics inspector panel
│       │   └── ui/        # Reusable UI components (shadcn/ui)
│       ├── hooks/         # Shared hooks
│       ├── utils/         # Utilities (SimulationEngine, gameData, pipelineTemplates)
│       ├── types/         # TypeScript definitions
│       ├── stores/        # Zustand state (game, pipeline, simulation)
│       └── styles/        # Global CSS
├── worker/                # Cloudflare Worker API
│   └── src/
│       ├── routes/        # API route handlers
│       ├── services/      # Business logic
│       └── db/            # Schema SQL
└── docs/                  # This documentation
```

## Important Notes

1. **Astro Islands**: Most pages are static. Interactive components (game canvas, forms) use `client:load` directive.

2. **State Management**: Zustand stores handle game state, pipeline editor state, and simulation state separately.

3. **Simulation Engine**: Tick-based (30+ FPS) simulation calculates metrics in real-time as requests flow through the pipeline.

4. **Progress Persistence**: Guest progress stored in localStorage, synced to server on login.

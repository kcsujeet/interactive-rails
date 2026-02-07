# RailsExpert Documentation

Welcome to the RailsExpert documentation. This folder contains comprehensive documentation for the RailsExpert project - a gamified web application that teaches Ruby on Rails development through interactive pipeline-building gameplay.

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

RailsExpert is an educational game where players learn **Rails 8 API-only** development by building a production-grade SaaS while mastering Rails 8 concepts through interactive pipeline-building gameplay.

The narrative arc takes players from a simple Blog API through a social platform, into a SaaS with payments, and ultimately to enterprise scale. Rails 8 features like Solid Queue, Solid Cache, Solid Cable, built-in auth, `params.expect()`, and `rate_limit` appear naturally as players progress. Testing is integrated from Level 12 onward.

1. **Building pipelines** - Drag-and-drop nodes to create request processing flows
2. **Running simulations** - Watch real-time metrics as requests flow through your pipeline
3. **Progressing through acts** - 8 acts covering Rails fundamentals to system design mastery

### Current Status

**8 Acts with 50 Total Levels:**

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | 7 (Levels 1-7) | MVC, CRUD, Controllers, Serializers, Routes, Associations |
| 2 | Users & Security | 7 (Levels 8-14) | Authentication, Validations, Callbacks, Authorization, Testing, Security, Scopes & Enums |
| 3 | Clean Architecture | 7 (Levels 15-21) | Service Objects, Concerns, Form Objects, Custom Validators, Error Handling, Action Mailer, Background Jobs |
| 4 | Performance | 7 (Levels 22-28) | N+1 Queries, Eager Loading, Indexing, Counter Caches, Pagination, Search, Caching |
| 5 | Production Features | 8 (Levels 29-36) | Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning |
| 6 | Reliability | 6 (Levels 37-42) | Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Error Monitoring |
| 7 | Scale | 5 (Levels 43-47) | Multi-Database, State Machines, Multi-Tenancy, Observability, Domain Events |
| 8 | Mastery | 3 (Levels 48-50) | API Gateway, Database Sharding, The Architect (Capstone) |

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
railsexpert/
├── frontend/              # Astro app with React components
│   └── src/
│       ├── pages/         # Astro routes (acts, levels, sandbox)
│       ├── components/    # React components
│       │   ├── game/      # Game UI (BriefingScreen, Canvas, etc.)
│       │   │   └── levels/
│       │   │       ├── act1/  # The Foundation (Levels 1-7)
│       │   │       ├── act2/  # Users & Security (Levels 8-14)
│       │   │       ├── act3/  # Clean Architecture (Levels 15-21)
│       │   │       ├── act4/  # Performance (Levels 22-28)
│       │   │       ├── act5/  # Production Features (Levels 29-36)
│       │   │       ├── act6/  # Reliability (Levels 37-42)
│       │   │       ├── act7/  # Scale (Levels 43-47)
│       │   │       └── act8/  # Mastery (Levels 48-50)
│       │   ├── pipeline/  # Pipeline editor components
│       │   ├── inspector/ # Metrics inspector panel
│       │   └── ui/        # Reusable UI components
│       ├── stores/        # Zustand state (game, pipeline, simulation)
│       ├── engine/        # Simulation engine
│       ├── content/       # Content definitions
│       │   └── acts/      # Act files (act1-foundation.ts ... act8-mastery.ts, index.ts)
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

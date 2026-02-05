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

RailsExpert is an educational game where players learn Rails optimization and scaling patterns by:

1. **Building pipelines** - Drag-and-drop nodes to create request processing flows
2. **Running simulations** - Watch real-time metrics as requests flow through your pipeline
3. **Defending against threats** - Deploy defenses against performance enemies (N+1 queries, memory leaks, etc.)
4. **Progressing through acts** - 6 acts covering Rails fundamentals to system design

### Current Status

**6 Acts with 35 Total Levels:**

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | Rails Fundamentals | 8 | MVC, CRUD, Controllers, Views, Associations |
| 2 | Clean Code | 10 | Security, Scopes, Service Objects, Authorization |
| 3 | Performance | 12 | N+1 Queries, Eager Loading, Caching, Background Jobs |
| 4 | Production | 12 | Feature Flags, Circuit Breakers, Health Checks |
| 5 | Infrastructure | 5 | Load Balancing, CDN, Rate Limiting, Deployments |
| 6 | System Design | 4 | Message Queues, Distributed Caching, API Gateway |

### Key Features

- **Pipeline Builder** - Visual drag-and-drop editor for building request flows
- **Real-time Simulation** - Tick-based engine with live metrics (latency, throughput, queries)
- **Enemy/Defense System** - Phaser-powered visualization of performance threats
- **Progress Tracking** - Star ratings, achievements, XP, and level unlocks
- **Sandbox Mode** - Free-form experimentation without constraints
- **Learning Content** - Integrated explanations, code examples, and best practices

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | Astro 5.x + React 19 |
| State | Zustand |
| Visualization | React Flow (@xyflow/react), Phaser 3 |
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
│       │   ├── pipeline/  # Pipeline editor components
│       │   ├── inspector/ # Metrics inspector panel
│       │   └── ui/        # Reusable UI components
│       ├── stores/        # Zustand state (game, pipeline, simulation)
│       ├── engine/        # Simulation engine
│       ├── content/       # Acts and levels definitions
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

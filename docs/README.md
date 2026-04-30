# Interactive Rails Documentation

Interactive Rails is an educational web app for learning Rails 8 API development through structured, interactive levels. The core lesson flow is briefing, observe, build, reward, and completion.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, tech stack, and project structure |
| [Game Mechanics](./game-mechanics.md) | Current briefing, observe, build, reward, and progression systems |
| [Content Structure](./content-structure.md) | Acts, levels, and learning content |
| [Development Setup](./development-setup.md) | Local development environment setup |
| [Deployment Guide](./deployment-guide.md) | Production deployment to Cloudflare |
| [API Reference](./api-reference.md) | Mounted API endpoint documentation |
| [Database Schema](./database-schema.md) | D1 database tables and relationships |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Start

```bash
bun install
bun run dev
```

- Frontend: http://localhost:4321
- API: mounted under the same Astro app at `/api/*`

## Project Overview

Players learn Rails 8 by moving through 58 levels across 8 acts. Most levels are custom React experiences with:

- a briefing screen that frames the scenario
- an observe phase where probes and inspections reveal the problem
- a build phase where the player chooses commands, code, or focused interactions
- a reward phase where the fixed system is stress-tested
- a completion flow that records stars and progress

Sandbox mode still exists as a free-form request-flow playground, but it is separate from the primary level loop.

## Current Curriculum

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | L1-L8 | Environment, app boot, models, CRUD, routes, controllers, serializers, associations |
| 2 | Guards & Gates | L9-L15 | Authentication, validations, callbacks, authorization, testing, strong params, CORS |
| 3 | Clean Architecture | L16-L22 | Service objects, concerns, contracts, query objects, error handling, mailers, background jobs |
| 4 | Performance | L23-L31 | N+1, eager loading, narrow fetching, indexing, counter caches, pagination, search, caching |
| 5 | Production Features | L32-L40 | Polymorphic associations, transactions, locking, storage, encryption, real-time, external APIs, webhooks, versioning |
| 6 | Operations | L41-L49 | Middleware, rate limiting, soft deletes, safe migrations, recurring jobs, data lifecycle, monitoring, deployment, feature flags |
| 7 | Scale | L50-L55 | Multi-database, state machines, multi-tenancy, observability, modular monolith, domain events |
| 8 | Mastery | L56-L58 | API gateway, sharding, capstone architecture |

## Key Features

- **Three-phase levels**: observe the failure, build the fix, then stress-test the solution.
- **Concept-specific visualizations**: levels use `PipelineFlow`, `QueryZoneFlow`, or custom visualizations based on the Rails concept.
- **Focused step mechanics**: terminal choices, option cards, probes, inspectors, and stress tests.
- **Progress tracking**: completed levels, star ratings, XP, titles, stack choices, and guest progress import.
- **Codebase viewer**: players can inspect generated Rails files as they move through the curriculum.

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime and package manager | Bun |
| Frontend | Astro + React |
| State | Zustand |
| Visualization | React Flow (@xyflow/react) |
| Styling | Tailwind CSS 4 |
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 |
| Auth | Better Auth |

## Key Directories

```text
interactive-rails/
  src/
    server/             Hono API, auth, repositories, D1 schema
    pages/              Astro routes and API catch-all
    features/           Act and level feature modules
    components/         Shared UI, level, pipeline, and page components
    hooks/              Shared React hooks
    lib/                Client utilities, registries, progress helpers
    stores/             Zustand stores
    styles/             Global CSS
  docs/                 Project documentation
```

## Important Notes

1. Use Bun for local commands.
2. The current level standard is the sequential three-phase flow: observe, build, reward.
3. There is no enemy/defense combat loop in the current gameplay.
4. Legacy storage names such as `dungeon_id` remain in the database for compatibility, but gameplay and docs should refer to levels.

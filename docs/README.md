# Interactive Rails Documentation

Interactive Rails is an educational web app for learning Rails 8 API development through structured, interactive levels. The core lesson flow is briefing, observe, build, reward, and completion.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Static site architecture, tech stack, and project structure |
| [Game Mechanics](./game-mechanics.md) | Current briefing, observe, build, reward, and progression systems |
| [Content Structure](./content-structure.md) | Acts, levels, and learning content |
| [Development Setup](./development-setup.md) | Local development environment setup |
| [Deployment Guide](./deployment-guide.md) | Building and hosting the static site |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Start

```bash
bun install
bun run dev
```

- App: http://localhost:4321

Interactive Rails is a fully static, client-side app. There is no server, API, database, or account. Progress is saved to the browser's `localStorage`.

## Project Overview

Players learn Rails 8 by moving through 58 levels across 7 acts. Most levels are custom React experiences with:

- a briefing screen that frames the scenario
- an observe phase where probes and inspections reveal the problem
- a build phase where the player chooses commands, code, or focused interactions
- a reward phase where the fixed system is stress-tested
- a completion flow that records stars and progress

Sandbox mode still exists as a free-form request-flow playground, but it is separate from the primary level loop.

## Current Curriculum

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | L1-L8 | Environment, app boot, models, associations, CRUD, routes, controllers, serializers |
| 2 | Users & Security | L9-L14 | Authentication, encryption, authorization, validations, strong params, testing |
| 3 | Clean Architecture | L15-L20 | Callbacks, service objects, concerns, contracts, query objects, error handling |
| 4 | Performance | L21-L29 | N+1, eager loading, narrow fetching, indexing, counter caches, pagination, search, caching |
| 5 | Advanced Features | L30-L39 | Polymorphic, soft deletes, transactions, locking, storage, mailers, background jobs, real-time, external APIs, webhooks |
| 6 | Operations | L40-L50 | Middleware, CORS, rate limiting, safe migrations, recurring jobs, data lifecycle, monitoring, observability, API versioning, deployment, feature flags |
| 7 | Scale | L51-L58 | Read replicas, sharding, multi-tenancy, state machines, modular monolith, domain events, API gateway, capstone |

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
| Site framework | Astro (static output, no adapter) |
| Interactive UI | React |
| State | Zustand |
| Visualization | React Flow (@xyflow/react) |
| Styling | Tailwind CSS 4 |
| Progress storage | Browser `localStorage` |

## Key Directories

```text
interactive-rails/
  src/
    pages/              Astro routes (static, dynamic level routes via getStaticPaths)
    layouts/            Page layouts
    features/           Act and level feature modules, plus the sandbox
    components/         Shared UI, level, and page components
    hooks/              Shared React hooks
    lib/                Registries, progress helpers, shared utilities
    stores/             Zustand stores
    utils/              Code generation, node behavior, pipeline data
    styles/             Global CSS
  docs/                 Project documentation
```

## Important Notes

1. Use Bun for local commands.
2. The site is fully static: no server, API, database, or account. Progress lives in `localStorage`.
3. The current level standard is the sequential three-phase flow: observe, build, reward.
4. There is no enemy/defense combat loop in the current gameplay.

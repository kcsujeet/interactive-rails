# RailsExpert Documentation

Welcome to the RailsExpert documentation. This folder contains comprehensive documentation for the RailsExpert.com project - a gamified web application that teaches Ruby on Rails development through RPG-style gameplay.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, tech stack, and project structure |
| [API Reference](./api-reference.md) | Complete API endpoint documentation |
| [Database Schema](./database-schema.md) | D1 database tables and relationships |
| [Game Mechanics](./game-mechanics.md) | XP, leveling, damage, and progression systems |
| [Content Structure](./content-structure.md) | Challenge format, realms, and dungeons |
| [Development Setup](./development-setup.md) | Local development environment setup |
| [Deployment Guide](./deployment-guide.md) | Production deployment to Cloudflare |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Start

```bash
# Install dependencies
bun install

# Run database migration (local)
cd worker && bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local

# Start development servers
bun run dev
```

- Frontend: http://localhost:4321
- Worker API: http://localhost:8787

## Project Overview

RailsExpert ("Rails Warrior") is an educational game where players learn Rails by:
1. Entering dungeons (Rails topic areas)
2. Battling monsters (code challenges)
3. Earning XP and leveling up
4. Unlocking new realms and content

### Current Status

- **Phase 1 MVP**: 3 realms implemented with 150 challenges
  - Realm 1: Foundation Fortress (MVC, Directory, Routing, Controllers, Views)
  - Realm 2: ActiveRecord Depths (Models, Associations, Validations, Callbacks, Queries)
  - Realm 3: Routing Labyrinth (RESTful, Nested, Custom, Constraints, URL Helpers)

- **Future Realms** (Phase 2+): 8 additional realms planned
  - Controller Citadel, View Valley, Database Dungeons
  - Performance Peaks, Email & Notifications
  - Database Mastery, DevOps & Deployment, Architecture Apex

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | Astro + React Islands |
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Auth | JWT (custom implementation) |
| Validation | Zod |

## Key Directories

```
railsexpert/
├── frontend/          # Astro app with React components
├── worker/            # Cloudflare Worker API
│   └── src/
│       ├── routes/    # API route handlers
│       ├── services/  # Business logic + content.ts (150 challenges)
│       ├── middleware/# Auth middleware
│       └── db/        # Schema SQL
└── docs/              # This documentation
```

## Important Notes

1. **Cloudflare Workers Limitation**: Workers cannot read filesystem at runtime. All challenge content is embedded directly in `worker/src/services/content.ts`.

2. **Authentication**: Uses JWT tokens stored in Authorization header. Tokens expire after 7 days.

3. **Local Development**: Uses Wrangler's local D1 emulation. Data persists in `.wrangler/` directory.

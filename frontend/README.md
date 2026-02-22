# Interactive Rails Frontend

The frontend application for Interactive Rails, a gamified web app that teaches Ruby on Rails 8 API development through interactive pipeline-building gameplay.

## Tech Stack

- **Astro** (v5.x) — Static site generator with islands architecture
- **React** (v19.x) — Interactive components (game canvas, forms)
- **Zustand** — State management with Immer middleware
- **Tailwind CSS** (v4.x) — Utility-first styling
- **Lucide React** — Icon library
- **TypeScript** — Type safety throughout

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev
```

Dev server runs at http://localhost:4321

## Project Structure

```
src/
├── pages/                  # Astro routes
│   ├── index.astro         # Homepage
│   ├── dashboard.astro     # Player dashboard
│   ├── sandbox.astro       # Sandbox mode
│   └── acts/               # Act & level pages
│       └── [actId]/[levelId]/
├── components/
│   ├── game/               # Game UI components
│   │   ├── levels/         # Level-specific components
│   │   │   ├── act1/       # The Foundation (7 levels)
│   │   │   ├── act2/       # Users & Security (7 levels)
│   │   │   ├── act3/       # Clean Architecture (7 levels)
│   │   │   ├── act4/       # Performance (7 levels)
│   │   │   ├── act5/       # Production Features (8 levels)
│   │   │   ├── act6/       # Reliability (6 levels)
│   │   │   ├── act7/       # Scale (5 levels)
│   │   │   └── act8/       # Mastery (3 levels)
│   │   ├── data.ts         # Node types and palette data
│   │   └── types.ts        # Game type definitions
│   ├── pages/              # Page-level app components
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   └── auth/               # Auth components
├── content/
│   └── acts/               # Act & level content definitions
│       ├── index.ts        # Content registry & helpers
│       ├── act1-foundation.ts
│       ├── act2-users-security.ts
│       ├── act3-clean-architecture.ts
│       ├── act4-performance.ts
│       ├── act5-production.ts
│       ├── act6-reliability.ts
│       ├── act7-scale.ts
│       └── act8-mastery.ts
├── stores/                 # Zustand state management
├── engine/                 # Simulation engine
├── lib/                    # Utilities
└── styles/                 # Global CSS
```

## Curriculum

50 levels across 8 acts, teaching Rails 8 API development:

1. **The Foundation** (L1-7) — MVC, CRUD, Controllers, Routes, Associations
2. **Users & Security** (L8-14) — Auth, Validations, Authorization, Testing
3. **Clean Architecture** (L15-21) — Services, Concerns, Forms, Background Jobs
4. **Performance** (L22-28) — N+1, Eager Loading, Indexing, Caching
5. **Production Features** (L29-36) — Polymorphic, Transactions, Real-Time, Webhooks
6. **Reliability** (L37-42) — Middleware, Rate Limiting, Safe Migrations
7. **Scale** (L43-47) — Multi-DB, State Machines, Multi-Tenancy, Observability
8. **Mastery** (L48-50) — API Gateway, Sharding, System Design Capstone

## Commands

| Command | Action |
|---------|--------|
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server at localhost:4321 |
| `bun run build` | Production build to `./dist/` |
| `bun run preview` | Preview production build |

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
- Why Bun: 3-5x faster than npm, native TypeScript support

### Frontend
- **Astro** (v5.x) - Static site generator with islands architecture
- **React** - Interactive components (Battle screen, forms)
- **TypeScript** - Type safety throughout
- Why Astro: Zero JS by default, perfect for content-heavy pages

### Backend API
- **Cloudflare Workers** - Serverless edge functions
- **Hono** (v4.x) - Lightweight web framework for Workers
- **Zod** - Runtime validation
- Why Hono: Built for Workers, tiny bundle, Express-like API

### Database
- **Cloudflare D1** - SQLite at the edge
- Why D1: Zero latency from Workers, SQL familiarity, no cold starts

### Authentication
- **Custom JWT** - JSON Web Tokens
- Password hashing via Web Crypto API (PBKDF2)
- 7-day token expiration

## Project Structure

```
railsexpert/
├── package.json              # Root workspace config
├── bun.lockb                 # Bun lockfile
│
├── frontend/                 # Astro application
│   ├── astro.config.mjs      # Astro + Cloudflare adapter config
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── components/       # React/Astro components
│       │   ├── game/         # BattleScreen, Monster, HealthBar, etc.
│       │   ├── ui/           # Button, Modal, Card
│       │   └── auth/         # LoginForm, SignupForm
│       ├── layouts/          # BaseLayout, GameLayout
│       ├── pages/            # Astro pages (file-based routing)
│       │   ├── index.astro
│       │   ├── login.astro
│       │   ├── dashboard.astro
│       │   ├── realms/
│       │   └── battle/
│       ├── stores/           # State management (nanostores)
│       └── styles/           # Global CSS
│
├── worker/                   # Cloudflare Worker API
│   ├── wrangler.toml         # Wrangler config (D1 bindings)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Main entry, Hono app
│       ├── types.ts          # TypeScript types
│       ├── routes/
│       │   ├── auth.ts       # /api/auth/* endpoints
│       │   ├── game.ts       # /api/game/* endpoints
│       │   └── progress.ts   # /api/progress/* endpoints
│       ├── middleware/
│       │   └── auth.ts       # JWT validation middleware
│       ├── services/
│       │   ├── auth.ts       # Password hashing, JWT
│       │   ├── game.ts       # XP calculation, damage
│       │   └── content.ts    # CRITICAL: All 150 challenges embedded here
│       ├── db/
│       │   └── schema.sql    # D1 table definitions
│       └── utils/
│           └── crypto.ts     # Password utilities
│
└── docs/                     # This documentation
```

## Key Architectural Decisions

### 1. Embedded Content in Worker

**Problem**: Cloudflare Workers cannot read filesystem at runtime.

**Solution**: All 150 challenges are embedded directly in `worker/src/services/content.ts` as a TypeScript array.

```typescript
// worker/src/services/content.ts
const allChallenges: Challenge[] = [
  {
    id: "foundation-mvc-001",
    type: "multiple_choice",
    // ... challenge data
  },
  // ... 149 more challenges
];

export function getDungeonChallenges(dungeonId: string): Challenge[] {
  const prefix = dungeonToPrefix[dungeonId];
  return allChallenges.filter(c => c.id.startsWith(prefix));
}
```

### 2. Monorepo with Bun Workspaces

**Why**: Shared development experience, single `bun install`, coordinated builds.

```json
// root package.json
{
  "workspaces": ["frontend", "worker"]
}
```

### 3. Astro Islands for Interactivity

**Why**: Most pages are static (realm map, landing). Only battle screen needs React.

```astro
---
// Battle page - static shell with React island
import BattleScreen from '../components/game/BattleScreen';
---
<Layout>
  <BattleScreen client:load challengeId={id} />
</Layout>
```

### 4. Hono Framework for API

**Why**: Purpose-built for Cloudflare Workers, tiny bundle (~14kb), familiar Express-like API.

```typescript
const app = new Hono<{ Bindings: Env }>();
app.use('*', cors({ origin: [...], credentials: true }));
app.route('/api/auth', authRoutes);
app.route('/api/game', gameRoutes);
```

### 5. D1 for Database

**Why**: Native Cloudflare integration, SQLite simplicity, zero network latency from Workers.

```typescript
const db = c.env.DB;
const result = await db
  .prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();
```

## Data Flow

### Authentication Flow
```
1. User submits login form
2. POST /api/auth/login with { email, password }
3. Worker verifies password hash
4. Worker generates JWT with userId
5. Frontend stores JWT in localStorage
6. Subsequent requests include Authorization: Bearer <jwt>
7. authMiddleware validates JWT, sets c.set('userId', ...)
```

### Game Flow
```
1. GET /api/game/realms → Returns all realms with unlock status
2. GET /api/game/realms/:realmId/dungeons → Returns dungeons for realm
3. GET /api/game/dungeons/:dungeonId/challenges → Returns 10 challenges
4. User answers challenge in BattleScreen
5. POST /api/game/challenges/:id/attempt → Validates answer
6. Worker calculates XP, damage, level ups
7. Updates user_progress and challenge_attempts in D1
8. Returns result with XP gained, new HP, explanation
```

## Environment Configuration

### Frontend (astro.config.mjs)
```javascript
export default defineConfig({
  output: 'static', // or 'server' for SSR
  adapter: cloudflare(),
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
database_id = "<your-database-id>"
```

### Environment Variables (Worker)
```typescript
interface Env {
  DB: D1Database;        // D1 binding
  JWT_SECRET: string;    // For token signing
}
```

## Security Considerations

1. **Password Storage**: PBKDF2 with 100,000 iterations
2. **JWT**: Signed with HS256, 7-day expiry
3. **CORS**: Restricted to specific origins
4. **Input Validation**: Zod schemas on all endpoints
5. **SQL Injection**: Parameterized queries via D1 prepare/bind

# Development Setup

This guide walks you through setting up the RailsExpert development environment.

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Bun | 1.0+ | [bun.sh](https://bun.sh) |
| Node.js | 18+ | For Wrangler compatibility |
| Git | 2.0+ | Version control |

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

### Optional Tools

| Tool | Purpose |
|------|---------|
| VS Code | Recommended IDE |
| SQLite Viewer | Inspect local D1 database |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> railsexpert
cd railsexpert

# 2. Install dependencies
bun install

# 3. Start development servers
bun run dev
```

**Access:**
- Frontend: http://localhost:4321
- Worker API: http://localhost:8787

---

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone <repo-url> railsexpert
cd railsexpert
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
bun install

# This installs:
# - Root devDependencies
# - frontend/ dependencies (Astro, React, Zustand, Phaser)
# - worker/ dependencies (Hono, Zod, Wrangler)
```

### 3. Database Setup (Optional)

The worker uses Cloudflare D1 (SQLite). For local development, Wrangler emulates D1.

```bash
cd worker

# Create tables in local D1 emulator
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local

# Database is stored in: worker/.wrangler/state/v3/d1/
```

**Note:** The `--local` flag is crucial. Without it, commands run against production D1.

### 4. Environment Configuration

#### Frontend Environment

Create `frontend/.env` if needed:
```bash
NODE_ENV=development
```

#### Worker Environment

For production, set secrets in Cloudflare:
```bash
bunx wrangler secret put JWT_SECRET
```

### 5. Start Development Servers

**Option A: Both servers (recommended)**
```bash
# From project root
bun run dev

# This runs in parallel:
# - Frontend: astro dev (port 4321)
# - Worker: wrangler dev (port 8787)
```

**Option B: Individual servers**
```bash
# Terminal 1 - Frontend
bun run dev:frontend

# Terminal 2 - Worker
bun run dev:worker
```

---

## Project Scripts

### Root Package.json

| Script | Description |
|--------|-------------|
| `dev` | Start both frontend and worker |
| `dev:frontend` | Start Astro dev server only |
| `dev:worker` | Start Wrangler dev server only |
| `build` | Build both for production |
| `lint` | Run Biome linter |
| `lint:fix` | Fix linting issues |
| `typecheck` | Type check both packages |

### Frontend Package.json

| Script | Description |
|--------|-------------|
| `dev` | Start dev server (port 4321) |
| `build` | Production build to `/dist/` |
| `preview` | Preview production build |

### Worker Package.json

| Script | Description |
|--------|-------------|
| `dev` | Start local worker (port 8787) |
| `deploy` | Deploy to Cloudflare |

---

## IDE Setup

### VS Code Extensions

Recommended extensions:

```json
{
  "recommendations": [
    "astro-build.astro-vscode",
    "biomejs.biome",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "[astro]": {
    "editor.defaultFormatter": "astro-build.astro-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Common Development Tasks

### Reset Local Database

```bash
# Delete local D1 data
rm -rf worker/.wrangler/state

# Re-run migration
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
```

### View Local Database

```bash
# Find the SQLite file
ls worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# Open with SQLite CLI
sqlite3 worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
```

### Add a New Level

1. Update `frontend/src/content/acts.ts` with level definition
2. Create component in `frontend/src/components/game/levels/actN/`
3. Register component in level registry
4. Test via acts page

### Test in Sandbox

1. Navigate to http://localhost:4321/sandbox
2. All nodes available for experimentation
3. No success conditions - free exploration

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :4321
lsof -i :8787

# Kill it
kill -9 <PID>
```

### Wrangler Not Found

```bash
# Use bunx instead
bunx wrangler dev

# Or install globally
bun add -g wrangler
```

### jsxDEV Error

If you see `jsxDEV is not a function`:

```bash
# Ensure NODE_ENV is set
echo "NODE_ENV=development" > frontend/.env

# Restart dev server
bun run dev
```

### CORS Errors

Check `worker/src/index.ts` CORS configuration:

```typescript
app.use('*', cors({
  origin: ['http://localhost:4321'],
  credentials: true,
}));
```

### Type Errors

```bash
# Run type check
bun run typecheck

# Fix issues in tsconfig.json or source files
```

### React Flow Issues

If React Flow canvas is blank:
- Ensure container has explicit height
- Check that NODE_ENV=development is set
- Verify @xyflow/react is installed

---

## Development Workflow

### Typical Cycle

1. **Start servers**: `bun run dev`
2. **Make changes** - Hot reload happens automatically
3. **Test in browser** - http://localhost:4321
4. **Check types**: `bun run typecheck`
5. **Lint code**: `bun run lint`
6. **Commit changes**

### Before Committing

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Build to ensure no errors
bun run build
```

### Working on Levels

1. Navigate to the level: `/acts/act-1/1-1/play`
2. Open browser DevTools console for metrics
3. Edit level component - changes hot reload
4. Test success conditions
5. Verify star thresholds

### Working on Pipeline Editor

1. Use Sandbox mode for unrestricted testing
2. Check Zustand stores in React DevTools
3. Monitor simulation store for metrics
4. Test node connections and validation

---

## Architecture Overview

```
User Browser
     │
     ▼
┌─────────────┐     ┌─────────────┐
│   Astro     │────▶│   Worker    │
│  Frontend   │     │    API      │
│  :4321      │     │   :8787     │
└─────────────┘     └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │     D1      │
                    │  (SQLite)   │
                    └─────────────┘
```

### Key Frontend Locations

| Feature | Location |
|---------|----------|
| Pages | `frontend/src/pages/` |
| Game components | `frontend/src/components/game/` |
| Level components | `frontend/src/components/game/levels/` |
| Stores | `frontend/src/stores/` |
| Simulation engine | `frontend/src/engine/` |
| Styles | `frontend/src/styles/` |

### Key Worker Locations

| Feature | Location |
|---------|----------|
| Routes | `worker/src/routes/` |
| Services | `worker/src/services/` |
| Middleware | `worker/src/middleware/` |
| Database schema | `worker/src/db/schema.sql` |

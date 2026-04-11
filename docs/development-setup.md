# Development Setup

This guide walks you through setting up the Interactive Rails development environment.

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
git clone <repo-url> interactive-rails
cd interactive-rails

# 2. Install dependencies
bun install

# 3. Start development servers
bun run dev
```

**Access:**
- App + API: http://localhost:4321

---

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone <repo-url> interactive-rails
cd interactive-rails
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
bun install

# This installs all dependencies (Astro, React, Hono, Zod, Tailwind, etc.)
```

### 3. Database Setup (Optional)

The app uses Cloudflare D1 (SQLite). For local development, the Astro Cloudflare adapter emulates D1 via `workerd`.

```bash

# Create tables in local D1 emulator
bunx wrangler d1 execute interactive-rails-db --file=src/server/db/schema.sql --local

# Database is stored in: .wrangler/state/v3/d1/
```

**Note:** The `--local` flag is crucial. Without it, commands run against production D1.

### 4. Environment Configuration

#### Frontend Environment

Create `.env` if needed:
```bash
NODE_ENV=development
```

#### Worker Environment

For production, set secrets in Cloudflare:
```bash
bunx wrangler secret put JWT_SECRET
```

### 5. Start Development Server

```bash
# From project root (single command, single server)
bun run dev

# Astro dev server with workerd runtime (port 4321)
# API runs inside the same server at /api/*
```

---

## Project Scripts

### Root Package.json

| Script | Description |
|--------|-------------|
| `dev` | Start Astro dev server (pages + API) |
| `build` | Build for production |
| `deploy` | Build and deploy to Cloudflare Workers |
| `db:migrate` | Run D1 migration locally |
| `lint` | Run Biome linter |
| `typecheck` | Type check the project |

### Frontend Package.json

| Script | Description |
|--------|-------------|
| `dev` | Start dev server (port 4321) |
| `build` | Production build to `/dist/` |
| `preview` | Preview production build |

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
rm -rf .wrangler/state

# Re-run migration
bunx wrangler d1 execute interactive-rails-db --file=src/server/db/schema.sql --local
```

### View Local Database

```bash
# Find the SQLite file
ls .wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# Open with SQLite CLI
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
```

### Add a New Level

1. Update the appropriate content file in `src/features/actN-*/content.ts`
2. Create component in `src/features/actN-*/components/LevelXXName.tsx`
3. Import and register in `src/features/levels-registry.ts`
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
echo "NODE_ENV=development" > .env

# Restart dev server
bun run dev
```

### CORS Errors

API runs same-origin inside Astro, so CORS is not needed for the frontend.
If external clients need access, check `src/server/index.ts` CORS configuration.

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

1. Navigate to the level: `/acts/1/act1-level1-stack-choice`
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
┌──────────────────────┐
│   Astro 6 + Hono     │
│   (single server)    │
│   :4321              │
│   ├── pages (SSR)    │
│   └── /api/* (Hono)  │
└──────────────────────┘
          │
          ▼
    ┌─────────────┐
    │     D1      │
    │  (SQLite)   │
    └─────────────┘
```

### Key Locations

| Feature | Location |
|---------|----------|
| Pages | `src/pages/` |
| API catch-all | `src/pages/api/[...path].ts` |
| Hono API app | `src/server/` |
| API routes | `src/server/routes/` |
| API middleware | `src/server/middleware/` |
| Database schema | `src/server/db/schema.sql` |
| Act content & level definitions | `src/features/act*-*/content.ts` |
| Level components | `src/features/act*-*/components/` |
| Level component registry | `src/features/levels-registry.ts` |
| Acts registry | `src/features/acts-registry.ts` |
| Shared level components | `src/components/levels/` |
| Pipeline editor | `src/components/pipeline/` |
| UI components (shadcn/ui) | `src/components/ui/` |
| Shared hooks | `src/hooks/` |
| Utilities & simulation | `src/utils/` |
| Stores | `src/stores/` |
| Styles | `src/styles/` |

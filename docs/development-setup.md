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
| Postman/Insomnia | API testing |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> railsexpert
cd railsexpert

# 2. Install dependencies
bun install

# 3. Set up local database
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
cd ..

# 4. Start development servers
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
# - Root devDependencies (TypeScript)
# - frontend/ dependencies (Astro, React)
# - worker/ dependencies (Hono, Zod, Wrangler)
```

### 3. Database Setup

The worker uses Cloudflare D1 (SQLite). For local development, Wrangler emulates D1.

```bash
cd worker

# Create tables in local D1 emulator
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local

# Verify (optional - view the SQLite file)
# Database is stored in: worker/.wrangler/state/v3/d1/
```

**Note:** The `--local` flag is crucial. Without it, commands run against production D1.

### 4. Environment Configuration

#### Worker Environment

The worker needs a JWT secret. For local development, Wrangler provides defaults.

For production, set secrets in Cloudflare dashboard or via CLI:
```bash
bunx wrangler secret put JWT_SECRET
```

#### Frontend Environment (if needed)

Create `frontend/.env` for API URL configuration:
```bash
PUBLIC_API_URL=http://localhost:8787
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

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run --parallel dev:frontend dev:worker` | Start both servers |
| `dev:frontend` | `cd frontend && bun run dev` | Start Astro dev server |
| `dev:worker` | `cd worker && bun run dev` | Start Wrangler dev server |
| `build` | `bun run build:frontend && bun run build:worker` | Build both |
| `typecheck` | `bun run --parallel typecheck:frontend typecheck:worker` | Type check both |
| `test` | `bun test` | Run all tests |
| `db:migrate` | `cd worker && wrangler d1 execute...` | Run local DB migration |
| `db:migrate:prod` | `cd worker && wrangler d1 execute...` | Run production migration |

### Worker Package.json

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `wrangler dev` | Start local worker |
| `build` | `wrangler deploy --dry-run` | Build without deploying |
| `deploy` | `wrangler deploy` | Deploy to Cloudflare |
| `test` | `bun test` | Run worker tests |

### Frontend Package.json

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `astro dev` | Start dev server |
| `build` | `astro build` | Production build |
| `preview` | `astro preview` | Preview build locally |

---

## Testing the Setup

### 1. Health Check

```bash
curl http://localhost:8787/
# Expected: {"status":"ok","name":"RailsExpert API"}
```

### 2. Create Test User

```bash
curl -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"test123","username":"devuser"}'
```

### 3. Get Realms

```bash
# Use token from signup response
TOKEN="your-jwt-token"
curl http://localhost:8787/api/game/realms \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Get Challenges

```bash
curl http://localhost:8787/api/game/dungeons/mvc/challenges \
  -H "Authorization: Bearer $TOKEN" | jq '.challenges | length'
# Expected: 10
```

---

## IDE Setup

### VS Code Extensions

Recommended extensions for this project:

```json
{
  "recommendations": [
    "astro-build.astro-vscode",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
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

# Or use a GUI tool like DB Browser for SQLite
```

### Add a New Challenge

1. Edit `worker/src/services/content.ts`
2. Add challenge to `allChallenges` array
3. Save - Wrangler hot-reloads automatically

### Test API Endpoints

```bash
# Full flow test
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@test.com","password":"test123","username":"test'$(date +%s)'"}' \
  | jq -r '.token')

curl -s http://localhost:8787/api/game/realms \
  -H "Authorization: Bearer $TOKEN" | jq '.realms[0].name'
# Expected: "Foundation Fortress"
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8787
lsof -i :8787
# Kill it
kill -9 <PID>

# Or use a different port
cd worker && wrangler dev --port 8788
```

### Wrangler Not Found

```bash
# Use bunx instead of direct wrangler command
bunx wrangler dev

# Or install globally
bun add -g wrangler
```

### Database Not Found

```bash
# Ensure you're in worker directory
cd worker

# Ensure --local flag is used
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
```

### CORS Errors

Check `worker/src/index.ts` CORS configuration:

```typescript
app.use('*', cors({
  origin: ['http://localhost:4321', 'http://localhost:4322'],
  credentials: true,
}));
```

Add your frontend port if different.

### Type Errors

```bash
# Run type check to see all errors
bun run typecheck

# Fix TypeScript configuration
# Check tsconfig.json in both frontend/ and worker/
```

---

## Development Workflow

### Typical Development Cycle

1. **Start servers**: `bun run dev`
2. **Make changes** to frontend or worker
3. **Hot reload** happens automatically
4. **Test API** with curl or browser
5. **Check types**: `bun run typecheck`
6. **Run tests**: `bun test`
7. **Commit** changes

### Before Committing

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Build to ensure no errors
bun run build
```

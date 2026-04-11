# Deployment Guide

This guide covers deploying Interactive Rails to Cloudflare's edge network.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Architecture                       │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Cloudflare Pages  │    │     Cloudflare Workers          │ │
│  │   interactiverails.com   │───▶│     api.interactiverails.com         │ │
│  │   (Static assets)   │    │     (API endpoints)             │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
│                                         │                       │
│                                         ▼                       │
│                              ┌─────────────────────┐            │
│                              │   Cloudflare D1     │            │
│                              │   (Production DB)   │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Cloudflare Account

- Sign up at [cloudflare.com](https://cloudflare.com)
- Free tier is sufficient for MVP

### 2. Wrangler Authentication

```bash
# Login to Cloudflare
bunx wrangler login

# Verify authentication
bunx wrangler whoami
```

### 3. Domain (Optional)

- Add domain to Cloudflare
- Or use `*.pages.dev` / `*.workers.dev` subdomains

---

## Initial Setup (One-Time)

### 1. Create D1 Database

```bash
cd worker

# Create production database
bunx wrangler d1 create interactive-rails-db

# Output will include database_id - save this!
# Example: Created database 'interactive-rails-db' with ID: xxxx-xxxx-xxxx
```

### 2. Update wrangler.toml

Add the database ID to `worker/wrangler.toml`:

```toml
name = "interactive-rails-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "interactive-rails-db"
database_id = "your-database-id-here"  # <-- Update this
```

### 3. Run Production Migration

```bash
cd worker

# Run schema on production D1
bunx wrangler d1 execute interactive-rails-db --file=src/db/schema.sql

# Verify tables created
bunx wrangler d1 execute interactive-rails-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. Set Production Secrets

```bash
cd worker

# Set JWT secret (use a strong random string)
bunx wrangler secret put JWT_SECRET
# Enter value when prompted

# Verify secrets
bunx wrangler secret list
```

---

## Deployment Steps

### Deploy Everything

```bash
# From project root
bun run deploy
```

This runs:
1. `bun run build` - Build frontend and worker
2. `bun run deploy:worker` - Deploy Worker to Cloudflare
3. `bun run deploy:frontend` - Deploy Pages to Cloudflare

### Deploy Worker Only

```bash
cd worker
bun run deploy

# Or from root
bun run deploy:worker
```

### Deploy Frontend Only

```bash
bun run build
bunx wrangler pages deploy dist

# Or from root
bun run deploy:frontend
```

---

## Configuration Files

### worker/wrangler.toml

```toml
name = "interactive-rails-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "interactive-rails-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Environment variables (non-secret)
[vars]
ENVIRONMENT = "production"

# Custom domain (optional)
# routes = [
#   { pattern = "api.interactiverails.com/*", zone_name = "interactiverails.com" }
# ]
```

### astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',  // or 'server' for SSR
  adapter: cloudflare(),
  integrations: [react()],
  site: 'https://interactiverails.com',
});
```

---

## Custom Domains

### Worker Domain

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to Settings → Triggers
4. Add Custom Domain: `api.interactiverails.com`

### Pages Domain

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Pages project
3. Go to Custom Domains
4. Add: `interactiverails.com` and `www.interactiverails.com`

---

## Environment Variables

### Production vs Development

| Variable | Development | Production |
|----------|-------------|------------|
| API_URL | `http://localhost:8787` | `https://api.interactiverails.com` |
| JWT_SECRET | (not needed locally) | Set via `wrangler secret` |
| ENVIRONMENT | `development` | `production` |

### Setting Secrets

```bash
# Set a secret
bunx wrangler secret put JWT_SECRET

# List secrets
bunx wrangler secret list

# Delete a secret
bunx wrangler secret delete JWT_SECRET
```

---

## Database Operations

### View Production Data

```bash
cd worker

# Run a query
bunx wrangler d1 execute interactive-rails-db --command="SELECT COUNT(*) FROM users;"

# Export data
bunx wrangler d1 execute interactive-rails-db --command="SELECT * FROM users;" --json > users.json
```

### Run Migrations

```bash
# Apply new schema changes
bunx wrangler d1 execute interactive-rails-db --file=src/db/migrations/001_add_column.sql
```

### Backup Database

```bash
# Export full database
bunx wrangler d1 export interactive-rails-db --output=backup.sql
```

---

## CI/CD with GitHub Actions

### .github/workflows/deploy.yml

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Run tests
        run: bun test

      - name: Deploy Worker
        run: cd worker && bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Build Frontend
        run: bun run build

      - name: Deploy Frontend
        run: bunx wrangler pages deploy dist --project-name=interactive-rails
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Setting Up GitHub Secrets

1. Create API Token in Cloudflare Dashboard
   - Account Settings → API Tokens
   - Create Token → Edit Cloudflare Workers

2. Add to GitHub Repository
   - Settings → Secrets and variables → Actions
   - New repository secret: `CLOUDFLARE_API_TOKEN`

---

## Monitoring

### Worker Analytics

- Cloudflare Dashboard → Workers & Pages → Your Worker → Analytics
- View: Requests, CPU time, Errors

### Error Tracking

Add error logging to worker:

```typescript
app.onError((err, c) => {
  // Log to console (visible in Wrangler logs)
  console.error({
    error: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
  });

  return c.json({ error: 'Internal server error' }, 500);
});
```

### View Logs

```bash
# Stream real-time logs
bunx wrangler tail

# With filters
bunx wrangler tail --status error
```

---

## Rollback

### Worker Rollback

```bash
# View deployment history
bunx wrangler deployments list

# Rollback to previous version
bunx wrangler rollback
```

### Database Rollback

D1 doesn't have built-in rollback. Options:
1. Restore from backup SQL file
2. Write reverse migration script

---

## Checklist

### Before First Deploy

- [ ] Cloudflare account created
- [ ] Wrangler authenticated (`wrangler login`)
- [ ] D1 database created
- [ ] `wrangler.toml` has correct database_id
- [ ] Production migration run
- [ ] JWT_SECRET set

### Before Each Deploy

- [ ] All tests pass (`bun test`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Build succeeds (`bun run build`)
- [ ] CORS origins include production domain

### After Deploy

- [ ] Health check passes (`curl https://api.interactiverails.com/`)
- [ ] Auth flow works (signup, login)
- [ ] Game flow works (get realms, challenges)
- [ ] Frontend loads correctly

---

## Troubleshooting

### Worker Not Deploying

```bash
# Check wrangler.toml syntax
bunx wrangler deploy --dry-run

# Check for TypeScript errors
cd worker && bun run build
```

### Database Connection Failed

```bash
# Verify database exists
bunx wrangler d1 list

# Check database_id in wrangler.toml matches
```

### CORS Errors in Production

Update `worker/src/index.ts`:

```typescript
app.use('*', cors({
  origin: [
    'http://localhost:4321',
    'https://interactiverails.com',
    'https://www.interactiverails.com'
  ],
  credentials: true,
}));
```

### 502/503 Errors

- Check Worker logs: `bunx wrangler tail`
- Verify all secrets are set
- Check for startup errors in code

# Troubleshooting

Common issues and their solutions for Interactive Rails development and deployment.

---

## Development Issues

### Wrangler Command Not Found

**Symptom:**
```
wrangler: command not found
```

**Solutions:**

1. Use `bunx` to run wrangler:
```bash
bunx wrangler dev
bunx wrangler d1 execute ...
```

2. Install wrangler globally:
```bash
bun add -g wrangler
```

3. Run from node_modules:
```bash
./node_modules/.bin/wrangler dev
```

---

### Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::8787
```

**Solution:**
```bash
# Find the process
lsof -i :8787

# Kill it
kill -9 <PID>

# Or use a different port
bunx wrangler dev --port 8788
```

For frontend (port 4321):
```bash
lsof -i :4321
kill -9 <PID>
```

---

### Database Not Found

**Symptom:**
```
Error: D1_ERROR: no such table: users
```

**Solution:**
```bash
# Ensure you're in worker directory
cd worker

# Run migration with --local flag
bunx wrangler d1 execute interactive-rails-db --file=src/db/schema.sql --local
```

---

### JWT Token Invalid

**Symptom:**
```json
{"error": "Invalid token"}
```

**Causes & Solutions:**

1. **Token expired** (7 days default)
   - Login again to get new token

2. **Wrong JWT_SECRET** in production
   ```bash
   bunx wrangler secret put JWT_SECRET
   # Enter the same secret used when tokens were created
   ```

3. **Token format wrong**
   - Ensure header is: `Authorization: Bearer <token>`
   - No extra spaces or quotes

---

### CORS Errors

**Symptom:**
```
Access to fetch has been blocked by CORS policy
```

**Solution:**

Update `worker/src/index.ts`:

```typescript
app.use('*', cors({
  origin: [
    'http://localhost:4321',
    'http://localhost:4322',  // Add if frontend uses different port
    'https://interactiverails.com',
    'https://www.interactiverails.com'
  ],
  credentials: true,
}));
```

---

### TypeScript Errors

**Symptom:**
```
error TS2307: Cannot find module 'hono' or its corresponding type declarations.
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Check tsconfig.json
# Ensure "moduleResolution": "bundler" or "node"
```

---

### Hot Reload Not Working

**Symptom:** Changes don't appear after saving files.

**Solutions:**

1. **Worker:** Restart wrangler dev
```bash
# Ctrl+C then
bunx wrangler dev
```

2. **Frontend:** Clear Astro cache
```bash
rm -rf .astro
bun run dev:frontend
```

---

### Astro Hydration Errors

**Symptom:** Console shows "Hydration failed" or "Text content does not match"

**Solution:**
```bash
# Clear Astro cache
rm -rf node_modules/.astro

# Restart dev server
bun run dev:frontend
```

---

## API Issues

### 401 Unauthorized

**Symptom:**
```json
{"error": "Unauthorized"}
```

**Solutions:**

1. Check token is included:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8787/api/...
```

2. Verify token format (should start with `eyJ`):
```bash
echo $TOKEN
```

3. Login again if token expired

---

### 404 Not Found - Level

**Symptom:**
```json
{"error": "Level not found"}
```

**Causes:**

1. **Invalid level ID** - Level IDs follow the pattern: `actN-levelN-slug`
   - Example valid IDs: `act1-level1-stack-choice`, `act2-level12-testing`, `act4-level22-n-plus-one`

2. **Level definition missing** - Check `src/features/act*-*/content.ts` for valid level definitions

---

### Level Not Found

**Symptom:** Navigating to a level URL returns a 404 page.

**Solutions:**

1. Verify the level ID exists in the act content files at `src/features/act{N}-*/content.ts`

2. Level IDs are defined in the act content files and follow the `actN-levelN-slug` format

3. Use the acts index page to find correct level URLs

---

### 500 Internal Server Error

**Symptom:**
```json
{"error": "Internal server error"}
```

**Debugging:**

1. Check wrangler logs:
```bash
bunx wrangler tail
```

2. Add console.log to isolate:
```typescript
try {
  // code
} catch (err) {
  console.error('Error:', err);
  throw err;
}
```

3. Common causes:
   - Database query failed
   - Missing environment variable
   - JSON parsing error

---

## Database Issues

### Migration Failed

**Symptom:**
```
D1_ERROR: SQLITE_ERROR: table users already exists
```

**Solution:**
```bash
# Reset local database
rm -rf worker/.wrangler/state

# Re-run migration
cd worker
bunx wrangler d1 execute interactive-rails-db --file=src/db/schema.sql --local
```

---

### Duplicate Key Error

**Symptom:**
```
D1_ERROR: UNIQUE constraint failed: users.email
```

**Solution:** Email already exists. Use different email for testing:
```bash
curl -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@test.com","password":"test123","username":"user'$(date +%s)'"}'
```

---

### Query Returns Empty

**Symptom:** API returns empty arrays when data should exist.

**Debugging:**

1. Check data exists:
```bash
bunx wrangler d1 execute interactive-rails-db --command="SELECT * FROM users;" --local
```

2. Verify user_id:
```bash
bunx wrangler d1 execute interactive-rails-db --command="SELECT * FROM user_progress WHERE user_id='<id>';" --local
```

---

## Build Issues

### Build Fails - Frontend

**Symptom:**
```
[build] Build failed
```

**Solutions:**

1. Check for TypeScript errors:
```bash
bun run astro check
```

2. Clear cache:
```bash
rm -rf .astro dist
```

3. Check imports are correct:
```typescript
// Wrong
import Button from 'components/Button';

// Right
import Button from '../components/Button';
```

---

### Build Fails - Worker

**Symptom:**
```
Build failed
```

**Solutions:**

1. Type check:
```bash
cd worker && bun run tsc --noEmit
```

2. Dry run deploy:
```bash
bunx wrangler deploy --dry-run
```

3. Check wrangler.toml syntax

---

## Deployment Issues

### Deploy Fails - Authentication

**Symptom:**
```
Error: You must be logged in to deploy
```

**Solution:**
```bash
bunx wrangler login
bunx wrangler whoami
```

---

### Deploy Fails - Database ID

**Symptom:**
```
Error: Database not found
```

**Solution:**

1. Check database exists:
```bash
bunx wrangler d1 list
```

2. Update `wrangler.toml` with correct ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "interactive-rails-db"
database_id = "correct-id-here"
```

---

### Production API Returns 500

**Debugging:**

1. Check logs:
```bash
bunx wrangler tail
```

2. Verify secrets:
```bash
bunx wrangler secret list
```

3. Test locally first:
```bash
bunx wrangler dev --remote  # Uses production D1
```

---

## Performance Issues

### Slow API Response

**Possible causes:**

1. **Cold start** - First request after idle period
   - Solution: Use Cloudflare's Smart Placement

2. **Large query** - Fetching too much data
   - Add LIMIT to queries
   - Use pagination

3. **N+1 queries** - Multiple DB calls in loop
   - Batch queries with JOIN or IN clause

---

### High Memory Usage

**Symptom:** Worker exceeds memory limit

**Solutions:**

1. Don't load all challenges at once:
```typescript
// Instead of filtering in memory
const challenges = allChallenges.filter(...);

// Use direct lookup
const dungeonChallenges = challengesByDungeon[dungeonId];
```

2. Stream large responses:
```typescript
return c.stream(async (stream) => {
  // Stream data in chunks
});
```

---

## Getting Help

### Useful Commands

```bash
# Check wrangler version
bunx wrangler --version

# View all D1 databases
bunx wrangler d1 list

# View worker deployments
bunx wrangler deployments list

# Stream logs
bunx wrangler tail

# Check authentication
bunx wrangler whoami
```

### Log Locations

| Environment | Log Location |
|-------------|--------------|
| Local Worker | Terminal output |
| Local Frontend | Terminal output |
| Production Worker | `bunx wrangler tail` |
| Production Pages | Cloudflare Dashboard |

### Reporting Issues

Include in bug reports:
1. Error message (full text)
2. Steps to reproduce
3. Wrangler version (`bunx wrangler --version`)
4. Bun version (`bun --version`)
5. OS and version

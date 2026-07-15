# Troubleshooting

Common issues and their solutions for Interactive Rails development. Interactive Rails is a fully static, client-side app: there is no server, API, database, or auth, so all issues are front-end, build, or browser-storage related.

---

## Development Issues

### Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::4321
```

**Solution:**
```bash
# Find the process
lsof -i :4321

# Kill it
kill -9 <PID>

# Or run on a different port
bun run dev -- --port 4322
```

---

### Hot Reload Not Working

**Symptom:** Changes don't appear after saving files.

**Solution:**
```bash
# Clear the Astro cache and restart
rm -rf .astro node_modules/.astro
bun run dev
```

---

### Astro Hydration Errors

**Symptom:** Console shows "Hydration failed" or "Text content does not match".

**Solution:**
```bash
# Clear Astro cache
rm -rf node_modules/.astro .astro

# Restart dev server
bun run dev
```

Also confirm the island is hydrated with the right directive (`client:load`, `client:visible`) and that server and client render the same markup.

---

### TypeScript Errors

**Symptom:**
```
error TS2307: Cannot find module '...' or its corresponding type declarations.
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules bun.lock
bun install

# Type check
bunx tsc --noEmit
# or the Astro-aware check
bun run check-types
```

---

### React Flow Canvas Is Blank

**Symptom:** A level or the sandbox shows an empty React Flow canvas.

**Solutions:**

- Ensure the canvas container has an explicit height (React Flow needs a sized parent).
- Verify `@xyflow/react` is installed.
- Check the browser console for errors thrown during node rendering.

---

## Progress / localStorage Issues

### Progress Not Saving

**Symptom:** Completing a level does not persist after a refresh.

**Causes and solutions:**

1. **Private/incognito window or blocked storage** - `localStorage` may be disabled. Progress persists only when the browser allows storage for the site.
2. **Different origin** - Progress is keyed to the site origin. `localhost:4321` and a deployed URL keep separate progress.
3. **Storage cleared** - Clearing site data removes the `interactive_rails_progress_v1` key.

### Reset Progress

Open DevTools > Application > Local Storage, and delete the `interactive_rails_progress_v1` key (and `interactive_rails_unlock_all` if set). Progress is client-side only; there is nothing server-side to reset.

---

## Level Issues

### Level Not Found

**Symptom:** Navigating to a level URL returns a 404 page.

**Solutions:**

1. Verify the level ID exists in the act content at `src/features/actN-*/content/act.ts`. Level IDs follow the `actN-levelN-slug` pattern (for example `act1-level1-stack-choice`).
2. Confirm the level is registered in `src/lib/levels-registry.ts`.
3. Rebuild. Level routes are generated at build time via `getStaticPaths()` / `getActLevelStaticPaths()`, so a newly added level only appears after a rebuild.
4. Use the acts index page (`/acts`) to find valid level URLs.

---

## Build Issues

### Build Fails

**Symptom:**
```
[build] Build failed
```

**Solutions:**

1. Check for type errors:
```bash
bun run check-types
```

2. Clear the cache and rebuild:
```bash
rm -rf .astro dist
bun run build
```

3. Check imports use the `@/` alias (or valid relative paths) and resolve correctly.

---

### Static Output Missing Routes

**Symptom:** Some act/level pages are missing from `dist/`.

**Solution:** Dynamic routes rely on `getStaticPaths()`. Confirm the level is present in the acts registry so `getActLevelStaticPaths()` emits its path, then rebuild.

---

## Getting Help

### Useful Commands

```bash
bun --version          # Bun version
bun run build          # Reproduce a build failure
bun test               # Run unit tests
bun run test:e2e       # Run end-to-end tests
bunx tsc --noEmit      # Type check
bunx biome check .     # Lint and format check
```

### Reporting Issues

Include in bug reports:
1. Error message (full text)
2. Steps to reproduce
3. Bun version (`bun --version`)
4. Browser and version (for gameplay/rendering issues)
5. OS and version

# Development Setup

This guide walks you through setting up the Interactive Rails development environment. Interactive Rails is a fully static site: there is no server, no database, and no auth to configure. Setup is just Bun plus the dependencies.

## Prerequisites

| Software | Version | Installation |
|----------|---------|--------------|
| Bun | 1.0+ | [bun.sh](https://bun.sh) |
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

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> interactive-rails
cd interactive-rails

# 2. Install dependencies
bun install

# 3. Start the dev server
bun run dev
```

**Access:** http://localhost:4321

Progress is saved automatically to the browser's `localStorage`. There is nothing else to provision: no `.env`, no database, no secrets.

---

## Project Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start the Astro dev server |
| `build` | Static production build to `dist/` |
| `preview` | Preview the production build |
| `test` | Run unit tests (`bun test src scripts`) |
| `test:e2e` | Run Playwright end-to-end tests |
| `check-types` | Astro/TypeScript type check (`astro check`) |
| `lint` | Run Biome linter |
| `check` | Biome lint + format check |
| `check:fix` | Biome lint + format with `--write` |
| `validate:levels` | Validate level content |
| `report:leaks` | Scan for answer leaks in feedback |
| `validate:codebase` | Validate generated codebase files |

---

## IDE Setup

### VS Code Extensions

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

### Reset Progress

Progress lives only in the browser. To reset it, clear the site's `localStorage` (DevTools > Application > Local Storage) or remove the `interactive_rails_progress_v1` key.

### Add a New Level

1. Add the level's content to the appropriate act file in `src/features/actN-*/content/act.ts` (or import the level's `data/content.ts`).
2. Create the level component directory under `src/features/actN-*/components/`.
3. Register the component in `src/lib/levels-registry.ts`.
4. Rebuild. The new act/level route is generated statically via `getStaticPaths()` / `getActLevelStaticPaths()`.

### Test in Sandbox

1. Navigate to http://localhost:4321/sandbox
2. All nodes are available for free experimentation.
3. No success conditions: free exploration only.

---

## Before Committing

Run the full check suite from the project root:

```bash
bunx tsc --noEmit        # TypeScript type checking
bunx biome check .       # Lint and format
bun run build            # Static build must succeed
bun test                 # Unit tests
bun run test:e2e         # Playwright end-to-end tests
```

Fix every error in any file you touched.

---

## Troubleshooting

### Port Already in Use

```bash
lsof -i :4321
kill -9 <PID>
```

### Type Errors

```bash
bunx tsc --noEmit
# or the Astro-aware check
bun run check-types
```

### React Flow Canvas Blank

- Ensure the container has an explicit height.
- Verify `@xyflow/react` is installed.

### Astro Hydration Errors

```bash
# Clear Astro cache and restart
rm -rf node_modules/.astro .astro
bun run dev
```

See [Troubleshooting](./troubleshooting.md) for more.

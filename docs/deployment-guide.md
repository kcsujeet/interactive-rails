# Deployment Guide

Interactive Rails is a fully static site. `bun run build` prerenders every page to HTML, CSS, and JavaScript in `dist/`. There is no server, no API, no database, and no secrets to provision. All player progress lives in the browser's `localStorage`, so nothing is stored server-side.

Because the output is plain static files, you can host it anywhere that serves static assets.

## Build

```bash
bun install
bun run build
```

The build writes to `dist/`. To preview the production build locally:

```bash
bun run preview
# or serve the folder directly
bunx serve dist
```

## Hosting Options

Deploy the `dist/` directory to any static host. A few common choices:

### GitHub Pages

1. Build the site: `bun run build`.
2. Publish `dist/` to the `gh-pages` branch (for example with the `peaceiris/actions-gh-pages` GitHub Action), or point Pages at a `docs/` output.
3. If the site is served from a subpath (for example `https://user.github.io/interactive-rails/`), set `base` in `astro.config.mjs` to match.

### Netlify

- Build command: `bun run build`
- Publish directory: `dist`

Netlify detects the static output automatically. No environment variables are required.

### Cloudflare Workers (configured in this repo)

The repo ships a `wrangler.jsonc` for an assets-only Cloudflare Worker: it serves the static `dist/` directory with no server code, no D1, and no bindings (`main` is intentionally omitted, which the Wrangler config reference allows for assets-only Workers).

One-time auth, then deploy:

```bash
bunx wrangler login          # or set CLOUDFLARE_API_TOKEN
bun run deploy               # runs astro build, then wrangler deploy
```

`bun run deploy:dry-run` builds and validates the upload without publishing (no auth needed), useful for a local check or CI.

The Worker uses Wrangler's defaults for a multi-page static site: `html_handling: "auto-trailing-slash"` (serves `/path/index.html` for `/path`, matching Astro's directory-per-route output) and `not_found_handling: "none"`. See https://developers.cloudflare.com/workers/static-assets/ for the full option set.

### Cloudflare Pages

Alternatively, use Cloudflare Pages purely as a static file host: build command `bun run build`, output directory `dist`. Pages needs no `wrangler.jsonc`.

### Any other static host

Upload the contents of `dist/` (S3 + CloudFront, Vercel static, Surge, a plain nginx server, etc.). Serve `index.html` for the root and let the host serve the prebuilt route files.

## Notes

- No environment variables, secrets, or database migrations are needed at deploy time.
- Progress is client-side only. Clearing browser storage resets a player's progress; it is never uploaded anywhere.
- Routing is fully prerendered. Dynamic act and level routes (`src/pages/acts/[actId]/[levelId]/{index,play,complete}.astro`) are expanded at build time via `getStaticPaths()`, which pulls from `getActLevelStaticPaths()` in `src/lib/acts-registry.ts`. Adding a level and rebuilding regenerates the corresponding static pages.

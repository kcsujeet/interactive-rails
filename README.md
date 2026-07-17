# Interactive Rails

**▶ Play it live: https://interactive-rails.sujeetkc45.workers.dev/**

Learn Rails 8 by building a real e-commerce marketplace, one concept at a time, through 58 interactive levels across 7 acts. Every level is a three-phase loop: **see the problem** (fire probes at a broken system and watch what goes wrong), **build the fix** (pick the right commands and code, with feedback that never just hands you the answer), and **see the payoff** (stress-test your solution and watch it hold).

It is **free, open source, and runs entirely in your browser**. There is no account, no sign-up, and no server: your progress is saved locally in your own browser via `localStorage`. Clone it, host it anywhere static, or just run it on your laptop.

## What it covers

Seven acts, from `rails new` to production architecture:

1. **Foundation** - environment, models, migrations, routing, controllers, serializers
2. **Users & Security** - authentication, encryption, authorization, validations, strong params, testing
3. **Clean Architecture** - callbacks, service objects, concerns, validation contracts, query objects, error handling
4. **Performance** - N+1 queries, eager loading, indexing, counter caches, pagination, search, caching
5. **Advanced** - polymorphism, soft deletes, transactions, locking, Active Storage, mailers, background jobs, real-time, external APIs, webhooks
6. **Operations** - middleware, CORS, rate limiting, safe migrations, recurring jobs, data lifecycle, error monitoring, observability, API versioning, deployment, feature flags
7. **Scale** - multi-database, multi-tenancy, sharding, state machines, modular monolith, domain events, API gateway, and a capstone service-extraction design exercise

Each level also ships **homework**: "now do it for real" exercises to run against your own companion Rails app, so the concept becomes muscle memory.

The Rails patterns taught are the modern, production-safe ones (Rails 8 defaults: `params.expect`, the built-in authentication generator, Solid Queue / Solid Cache / Solid Cable, Kamal 2, Propshaft), not legacy textbook examples.

## Running it locally

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/kcsujeet/interactive-rails.git
cd interactive-rails
bun install
bun run dev      # dev server at http://localhost:4321
```

To build the static site and preview it:

```bash
bun run build    # outputs a fully static site to ./dist
bun run preview
```

`dist/` is plain static HTML, CSS, and JS. Host it on GitHub Pages, Netlify, Cloudflare Pages, or any static file server. No backend, no environment variables, no database.

## Tech stack

- [Astro 7](https://astro.build) (static output) + [React 19](https://react.dev) islands
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [React Flow](https://reactflow.dev) for the pipeline visualizations
- [Bun](https://bun.sh) for install, scripts, and tests
- [Biome](https://biomejs.dev) for lint and format
- Deployed as a static [Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/) (assets only, no server code); hostable on any static host

## Project structure

- `src/features/actN-*/` - each act, with per-level components, content, data, and tests colocated
- `src/lib/` - shared logic (the level registry, local progress storage, the simulation helpers)
- `src/components/` - shared UI and the reusable level building blocks
- `src/pages/` - Astro routes (the acts list, level pages, sandbox, progress)
- `docs/` - architecture, content structure, and design notes

## Development

```bash
bun test              # unit tests (bun:test)
bun run test:e2e      # Playwright smoke tests
bunx tsc --noEmit     # type check
bunx biome check .    # lint + format check
```

Levels are heavily test-fenced: each has a test asserting the exact strings, probe/scenario pairings, and answer-leak boundaries a player would see. See `docs/content-structure.md` and `docs/game-mechanics.md` for how a level is built.

## Contributing

Contributions are welcome: new levels, content fixes, accessibility improvements, translations. Fork the [repo](https://github.com/kcsujeet/interactive-rails), and please run the full check suite (`bun test`, `bunx tsc --noEmit`, `bunx biome check .`, `bun run build`) before opening a pull request. Keep the three-phase level pattern intact; see `docs/` for the design conventions the curriculum follows.

## License

[MIT](LICENSE). Free to use, modify, and share.

The curriculum draws on ideas from the Ruby on Rails Guides and the wider Rails community; those are cited inline in each level's "further reading". Rails is a trademark of David Heinemeier Hansson.

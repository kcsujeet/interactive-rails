---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Critical Rules

**Always ask for permission before committing changes. This is non-negotiable.**
Do NOT run `git commit` without explicit user approval.

Default to using Bun instead of Node.js:

- `bun <file>` (not `node` / `ts-node`)
- `bun test` (not `jest` / `vitest`)
- `bun build <file>` (not `webpack` / `esbuild`)
- `bun install` (not `npm` / `yarn` / `pnpm install`)
- `bun run <script>` (not `npm` / `yarn` / `pnpm run`)
- `bunx <pkg>` (not `npx`)
- Bun automatically loads .env — don't use dotenv.

---

## Project Architecture

- Always follow bulletproof-react project structure. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md

### Import Alias

Use `@/` alias for imports from `src/`:

```tsx
// CORRECT
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// WRONG — no relative paths
import { Button } from "../../components/ui/Button";
```

Run `bun scripts/fix-imports.ts` to automatically convert relative imports to use the alias.

**Note:** Astro client-side `<script>` tags do NOT support the `@/` alias. Use relative imports there:

```astro
<script>
  // Must use relative imports in Astro scripts
  import { escapeHtml } from "../lib/utils";
</script>
```

### Level Design: Three-Phase Pedagogy

Every level component must teach through three phases: **WHY → HOW → ADVANTAGE**.

1. **WHY** — Show the problem first. The player must feel the pain before seeing the solution. Start with broken/ugly/slow code and make the player experience why the current approach fails (e.g., fat controller, N+1 queries, duplicated logic).

2. **HOW** — Teach the pattern through interaction. The player actively builds or transforms code using the Rails pattern (e.g., extracting a service object, adding eager loading, composing query methods). The interaction should involve meaningful choices, not just "click all items."

3. **ADVANTAGE** — Show the concrete improvement. Before/after comparison, line count reduction, query count drop, or side-by-side code clarity. The player should see measurable proof that the pattern is better than the alternative.

When creating or redesigning a level component, ensure all three phases are present in the gameplay. Reference `docs/spec.md` for each level's scenario and concept.

---

## Code Conventions

### Icons

**Use Lucide React icons instead of emojis throughout the codebase.**

```tsx
import { Database, Zap, Search, Settings } from "lucide-react";
<Database className="w-5 h-5 text-primary" />
```

### UI Components (shadcn/ui)

- Always use the shadcn CLI to add new components: `bunx shadcn@latest add <component>`
- Never manually create UI components.
- Use actual components (`Button`, `Card`, `Badge`), not variant functions (`buttonVariants`). Only use variant functions when generating dynamic `innerHTML`.
- No custom CSS utility classes (`.btn`, `.card`, `.cta-btn`, etc.) — use Tailwind or shadcn components.
- Keep `global.css` minimal: only design tokens (`@theme`), keyframes, base styles, and third-party library styles.

### Styling

- **Never use inline `style` attributes.** Use Tailwind utility classes. For animations, use `tw-animate-css` classes (`animate-in`, `fade-in`, `slide-in-from-bottom-3`, `zoom-in-95`, `duration-*`, `delay-*`). Use arbitrary value classes (e.g., `delay-[400ms]`) when no standard utility exists.
- Use semantic color tokens: `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`
- Use Tailwind classes directly, not custom CSS classes in `<style>` blocks.
- For Astro pages, import and use React components directly (they render statically without hydration for presentational use).

---

## Bun Reference

### Preferred APIs

- `Bun.serve()` for HTTP/WebSocket/routes (not `express`)
- `bun:sqlite` for SQLite (not `better-sqlite3`)
- `Bun.redis` for Redis (not `ioredis`)
- `Bun.sql` for Postgres (not `pg` / `postgres.js`)
- `WebSocket` built-in (not `ws`)
- `Bun.file` over `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` instead of `execa`

### Testing

Use `bun test` with imports from `"bun:test"` (`test`, `expect`, `describe`, etc.).

### Frontend

Use HTML imports with `Bun.serve()` — not Vite. HTML files can import `.tsx`/`.jsx`/`.js` directly; `<link>` tags bundle CSS automatically.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Import Alias

Use `@/` alias for imports from `src/`:

```tsx
// ✅ CORRECT
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ❌ WRONG
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

## UI Components (shadcn/ui Pattern)

This project uses a shadcn/ui-style design system. Follow these strict guidelines:

### Installing New Components

Always use the shadcn CLI to add new UI components:

```sh
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add badge
bunx shadcn@latest add input
```

Never manually create UI components - use the CLI to ensure consistency with the design system.

### Use Actual Components, Not Variant Functions

Always use the actual UI components (`Button`, `Card`, `Badge`, etc.) instead of just the variant functions:

```tsx
// ✅ CORRECT - Use actual components
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

<Button asChild size="xl">
  <a href="/dashboard">Start Learning</a>
</Button>

<Card className="p-6">
  <h3>Card content</h3>
</Card>

<Badge variant="success">Active</Badge>
```

```tsx
// ❌ WRONG - Don't use variant functions for static markup
import { buttonVariants } from "../components/ui/Button";

<a href="/dashboard" class={buttonVariants({ size: "xl" })}>Start Learning</a>
```

### When to Use Variant Functions

Only use `buttonVariants`, `cardVariants`, etc. when generating dynamic HTML via JavaScript (e.g., `innerHTML`):

```tsx
// ✅ CORRECT - Variant functions for dynamic innerHTML
const cardClass = cardVariants({});
container.innerHTML = `<div class="${cardClass}">Dynamic content</div>`;
```

### No Custom CSS Utility Classes

- Never create custom utility classes like `.btn`, `.card`, `.input`, `.auth-card`, `.cta-btn`
- Use Tailwind classes directly on elements or use the UI components
- Keep `global.css` minimal: only design tokens (`@theme`), keyframes, base styles, and third-party library styles

### Styling Guidelines

- Use semantic color tokens: `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`
- Use Tailwind classes directly, not custom CSS classes in `<style>` blocks
- For Astro pages, import and use React components directly (they render statically without hydration for presentational use)

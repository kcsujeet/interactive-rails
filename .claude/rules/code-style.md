---
paths:
  - "**/*.{ts,tsx,js,jsx}"
---

# Code Style

- **Reuse code.** Don't duplicate markup or logic. If two branches render nearly identical content, extract the shared parts and vary only what differs.
- **Create components.** Extract reusable pieces into their own components rather than inlining everything.
- **Components larger than 20 lines should live in their own file.** Small helpers (under ~20 lines) can stay in the same file. Anything bigger gets its own file.
- **Always use UI components.** Use `<Button>`, `<Card>`, `<Badge>`, etc. instead of raw HTML elements. For links that need button styling, wrap `<a>` inside `<Button>`. Never use `<button>`, `<div className="border rounded ...">`, or other raw elements when a design system component exists.
- **Use semantic colors.** Use CSS variable tokens (`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-destructive`, etc.) instead of hardcoded Tailwind colors like `text-gray-500` or `bg-zinc-800`. The semantic tokens are defined in `global.css` and adapt to light/dark mode automatically.
- **Minimize custom classes.** UI components like `Button`, `Alert`, `Badge`, etc. support `variant`, `size`, and `color` props. Use these built-in props to control appearance before reaching for Tailwind overrides. For example, use `<Button color="destructive">` instead of `<Button className="bg-red-500 text-white">`. Most of the time, the component's built-in props cover the need without custom styling.
- **Support both light and dark mode.** Every color choice must work on both backgrounds. Use semantic tokens (`text-foreground`, `bg-background`, `bg-card`, `border-border`, `text-muted-foreground`) because they adapt automatically. When you must use a fixed Tailwind color (e.g., `text-emerald-600`, `bg-zinc-100`), always add a `dark:` variant to ensure it looks right in both modes.
- **Use Tailwind utilities and design tokens, not arbitrary values.** Use `text-sm`, `text-lg`, `border`, `rounded-lg`, `gap-4`, etc. instead of arbitrary values like `text-[10px]`, `border-[1px]`, or `gap-[12px]`. If a Tailwind utility or a CSS variable from `global.css` exists for it, use that. Arbitrary values should be a last resort.
- **Never use non-null assertions (`!`).** Do not use TypeScript's `!` postfix operator (e.g., `value!.property`, `array.find(...)!`). Use optional chaining (`?.`), nullish coalescing (`??`), or proper null checks instead. Non-null assertions hide potential runtime errors.
- **Never use unsafe type casts as workarounds.** Do not use `as Record<string, unknown>`, `as any`, `as unknown as T`, or similar hacks to silence type errors. Instead, define a proper interface for the shape you need and use that. If a library's types are incomplete, extend them with a declared interface.
- **Format with Biome when done.** After making changes, run `bunx biome check --write` on the modified files to format them.
- **Run all checks after every code change.** Always run `bunx tsc --noEmit` (type check), `bun check-types` (astro check), and `bunx biome check` (lint) after making changes. Do not report done until both pass with zero errors in files you touched.

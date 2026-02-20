---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Critical Rules

**Always ask for permission before committing changes. This is non-negotiable.**
Do NOT run `git commit` without explicit user approval.

**Never use em dashes (—) anywhere in the codebase.** Use commas, periods, colons, or parentheses instead. This applies to all text: code comments, UI strings, content definitions, feedback messages, documentation.

**Consistency is non-negotiable.** Don't do one-off things. When a pattern exists in the codebase (button labels, step navigation, component structure), follow it exactly. If Level 1 uses "Next Step" with an ArrowRight icon, every level uses "Next Step" with an ArrowRight icon. No custom labels, no special cases.

Default to using Bun instead of Node.js:

- `bun <file>` (not `node` / `ts-node`)
- `bun test` (not `jest` / `vitest`)
- `bun build <file>` (not `webpack` / `esbuild`)
- `bun install` (not `npm` / `yarn` / `pnpm install`)
- `bun run <script>` (not `npm` / `yarn` / `pnpm run`)
- `bunx <pkg>` (not `npx`)
- Bun automatically loads .env, so don't use dotenv.

---

## Project Architecture

- Always follow bulletproof-react project structure. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md

### Import Alias

Use `@/` alias for imports from `src/`:

```tsx
// CORRECT
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// WRONG (no relative paths)
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

Every level teaches through three phases: **WHY → HOW → ADVANTAGE**.

1. **WHY**: Context for why this concept matters. Delivered as **readable notes** (in InstructionPanel or a pre-level briefing), not as quiz questions. The player can read it, but it doesn't block gameplay.

2. **HOW**: The core gameplay. **Players learn by doing, not by answering trivia.** The player runs commands, drags pieces, builds code, and configures files. Wrong choices get immediate feedback that teaches Rails conventions (e.g., "Rails models are singular PascalCase, not plural"). Never ask "what's wrong with this?". Instead, let the player try and learn from mistakes.

   **Interaction types (pick per step):**
   - **SimulatedTerminal**: click the right command from options
   - **Drag-and-drop**: drag pieces into the correct positions
   - **Click-to-select**: pick the correct option from 2-4 choices

3. **ADVANTAGE**: Show the concrete improvement after completing the level. Delivered as **post-completion notes** or a summary card (before/after comparison, line count reduction, etc.). Not a quiz.

**Act calibration:**
- Acts 1-2: Pure fundamentals. No anti-patterns, no debugging. Happy path.
- Acts 3-4: First refactoring and performance problems appear.
- Acts 5-8: Production, reliability, scale, architecture.

When creating or redesigning a level component, ensure all three phases are present in the gameplay. Reference `docs/spec.md` for each level's scenario and concept.

**Performance-level ADVANTAGE phase convention (Acts 4-8):**
Every performance-related level must have a full ADVANTAGE phase in its `learningContent` with:
- **Before/after benchmarks** showing time, memory, and object allocations where available
- A **"Further reading"** section linking to relevant gems, guides, and the "Rails Scales!" book chapter

### Wrong-Answer Feedback: Never Reveal Answers

**Error feedback must NEVER contain the correct answer.** This is non-negotiable. Feedback should explain *why the chosen option is wrong*, not what the right one is. The player must figure out the answer themselves.

**The correct answer must NEVER be the first option.** Vary its position across steps so there is no predictable pattern.

**Option colors must NEVER hint at the answer.** All options in a set must use the same color (or omit color entirely to use the default). Don't use `green` for the correct answer or `red`/`rose` for wrong ones. That's a visual giveaway.

```tsx
// BAD (gives away the answer)
feedback: 'Rails is a Ruby gem. Use `gem install rails`.'
feedback: 'Add --api and --database=postgresql.'
feedback: "Database doesn't exist yet. Run db:create first."

// GOOD (explains why wrong, doesn't reveal answer)
feedback: "Rails isn't a system package. It's distributed through Ruby's own ecosystem."
feedback: 'Missing flags. You need API-only mode and a database adapter.'
feedback: "Database doesn't exist yet. Migrations need an existing database."

// BAD (correct answer is always first)
const commands = [
  { label: 'brew install asdf', correct: true },   // always first = dead giveaway
  { label: 'apt-get install asdf', correct: false },
];

// GOOD (correct answer in varied position)
const commands = [
  { label: 'apt-get install asdf', correct: false },
  { label: 'brew install asdf', correct: true },    // not first
];

// BAD (color reveals the answer)
{ label: 'ruby 3.3.6', color: 'green', correct: true },   // green = obvious
{ label: 'Ruby 3.3.6', color: 'rose', correct: false },    // rose = obviously wrong

// GOOD (all options use the same color, or omit color for default)
{ label: 'ruby 3.3.6', correct: true },
{ label: 'Ruby 3.3.6', correct: false },
```

### Level Checklist: What to Update

When creating or modifying a level, update **both** the component AND its content definition. A level has two halves:

1. **Component** (`features/actN-*/components/LevelXXName.tsx`): the interactive gameplay
2. **Content** (`features/actN-*/content.ts`): the briefing screen text shown before gameplay

The content definition has these player-facing fields that **must match the gameplay**:

| Field | Where it appears | What to write |
|-------|-----------------|---------------|
| `trigger.description` | Top of briefing screen | 1-2 sentences: what the player will do in this level |
| `problem.observation` | Below trigger | What's wrong / what's missing right now |
| `problem.codeExample` | "THE PROBLEM" code block | Teach concepts and context. **Never show exact answers** the player must choose |
| `problem.goal` | "YOUR GOAL" section | Describe all steps, not just the first one |
| `hint.text` | Hint popup (after delay) | Actionable tip for the current interaction |
| `learningContent.*` | Learning panel | Concept explanation and Rails code examples |

**Common mistake:** Updating the component but leaving old descriptions like "Drag the node to the slot" when the level now uses SimulatedTerminal steps. Always update content.ts in the same pass.

### Level Design: Linear Progression

Levels within an act must form a coherent learning path. Each level should build on skills and concepts from earlier levels so the player feels cumulative mastery, not disconnected lessons. When designing a level, explicitly connect it to what came before:

- Reference mechanics the player already knows (e.g., "You extracted a concern in L16. Now extract validations the same way")
- Reuse interaction patterns from earlier levels so new concepts feel familiar (e.g., L17 reuses L16's step-unlock gating and L18's before/after grid)
- Introduce only one new core concept per level. Anchor it to prior knowledge

### Level Design: No Concept Overlap

**Each concept belongs to exactly one level.** Before adding a step to a level, check if that concept is already taught in another level. If it is, don't duplicate it. The player will learn it there.

Examples:
- Level 2 (First Boot) should NOT add routing steps. Level 5 (Routes) handles that
- Level 3 (Model) should NOT teach associations. Level 8 (Associations) handles that
- Level 6 (Controller) should NOT teach testing. Level 13 (Testing) handles that

When a level's name suggests a concept that's taught elsewhere, keep the level focused on its own scope. Don't pull in concepts from later levels to make the name feel more literal.

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
- No custom CSS utility classes (`.btn`, `.card`, `.cta-btn`, etc.). Use Tailwind or shadcn components.
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

Use HTML imports with `Bun.serve()`, not Vite. HTML files can import `.tsx`/`.jsx`/`.js` directly; `<link>` tags bundle CSS automatically.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

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

**Always check the latest docs of any library before implementing.** Never assume the API from memory. Libraries rename components, change prop names, and introduce breaking changes between versions. Fetch the official docs (GitHub README, npm page, or docs site) and verify the current API before writing any code.

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

### Level Design: Three-Phase Sequential Flow (Non-Negotiable)

**Every level MUST follow this exact three-phase sequential flow. This is the golden standard. No exceptions.**

Each phase occupies the **full center panel**. The player focuses on one thing at a time. No split layouts showing multiple phases simultaneously.

#### Phase 1: Problem Visualization (WHY)

Show the problem visually before the player does anything. The player watches and understands what is broken.

- Center panel: full-screen visualization of the problem (SVG animation, broken pipeline, error state)
- After a brief observation period (~3s), a **"Build the Fix"** button fades in (with ArrowRight icon)
- Clicking transitions to Phase 2
- Left panel: scenario text + any legends needed to understand the visualization
- Right panel: the broken/vulnerable/unoptimized code

#### Phase 2: Problem Solving (HOW)

The player builds the solution step by step. **This phase must cover the COMPLETE workflow, including gem installation, generators, and setup commands.** Never skip setup steps. If a feature requires `bundle add gem_name` and `rails generate something:install`, those are real steps the player completes.

**Players learn by doing, not by answering trivia.** Wrong choices get immediate feedback that teaches Rails conventions. Never ask "what's wrong with this?". Let the player try and learn from mistakes.

**Step types (pick per step):**
- **TerminalChoiceStep**: pick the right shell/console command (use for gem install, generators, rails commands)
- **OptionCard**: pick the correct code snippet from 2-4 choices (use for Ruby DSL decisions, config choices)
- **Drag-and-drop**: drag pieces into the correct positions

**Typical step progression for a gem-based feature:**
1. Install the gem (`bundle add ...`) - TerminalChoiceStep
2. Run the generator (`rails generate ...`) - TerminalChoiceStep
3. Configure/customize the generated code - OptionCard steps
4. Wire it into the application - OptionCard steps

- Center panel: step UI fills the space (no animation visible)
- Left panel: scenario text + StepProgress pills
- Right panel: code preview evolves with `stepper.furthestStep`

#### Phase 3: Solution Visualization (ADVANTAGE)

Show the concrete improvement. The player sees the fix in action.

- Sub-phase a (activate): star rating display + "Activate" button (centered, no animation)
- Sub-phase b (reward): full-screen visualization returns, now showing the solution working (blocked attacks, faster queries, cleaner output)
- Left panel: StepProgress (all complete) + any counters/metrics
- Right panel: final complete code
- Player clicks Submit when satisfied

#### Phase state machine

```
phase: 'observe' | 'build' | 'activate' | 'reward'

observe  -> (click "Build the Fix")    -> build
build    -> (all steps complete)        -> activate
activate -> (click "Visualize ___")      -> reward
reward   -> (click Submit)              -> level complete
```

**Act calibration:**
- Acts 1-2: Pure fundamentals. No anti-patterns, no debugging. Happy path.
- Acts 3-4: First refactoring and performance problems appear.
- Acts 5-8: Production, reliability, scale, architecture.

**One terminal style per level.** If a level uses a custom terminal UI (e.g., Rails Console with `irb>` prompt), every step in that level must use the same terminal. Never mix a custom terminal with `SimulatedTerminal` (which renders a separate `$ ` shell prompt). Add entries to the existing terminal history instead of spawning a second terminal component.

```tsx
// BAD -- two different terminals in one level
<div className="bg-zinc-900 ...">  {/* Custom irb> terminal */}
  {consoleHistory.map(...)}
</div>
<SimulatedTerminal              {/* Second terminal with $ prompt */}
  commands={verifyCommands}
  onCorrect={() => stepper.completeStep()}
/>

// GOOD -- verify step reuses the same terminal
const handleVerify = () => {
  addConsoleEntry('Post.count', '=> 0');  // Adds to existing irb> history
  stepper.completeStep();
};
<Button onClick={handleVerify} variant="outline">Post.count</Button>
```

When creating or redesigning a level component, ensure all three phases are present in the gameplay. Reference `docs/spec.md` for each level's scenario and concept.

**Reference implementation:** Level 12 (Authorization) in `frontend/src/features/act2-users-security/components/Level12Authorization.tsx` is the canonical example of this pattern.

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

### Level Design: TerminalChoiceStep Component

For any level that has "pick the right terminal command" steps, use `TerminalChoiceStep` to render the step content. The level owns its own layout (3-panel, header, step progress, code preview); `TerminalChoiceStep` only renders the center panel block (title, description, SimulatedTerminal, Next Step button).

**When to use it:** Any step where the player picks from terminal command options. Works in both pure-terminal levels (L1, L4) and mixed-interaction levels (L2, L3).

**How to use it:**

```tsx
import {
  buildTerminalHistory,
  TerminalChoiceStep,
  type TerminalStep,
  type TerminalStepData,
} from '@/components/levels';

// For pure-terminal levels, define all steps as TerminalStep[]
const STEPS: TerminalStep[] = [
  {
    id: 'step-1',
    title: 'Do the thing',
    description: <p className="text-sm text-muted-foreground">Pick the right command.</p>,
    commands: [
      { id: 'wrong', label: 'bad cmd', command: 'bad cmd', correct: false, feedback: 'Why wrong.' },
      { id: 'correct', label: 'good cmd', command: 'good cmd', correct: true },
    ],
    outputLines: [{ text: 'Success!', color: 'green' }],
  },
];

// Inside the level's center panel content area:
<TerminalChoiceStep
  title={currentConfig.title}
  description={currentConfig.description}
  commands={currentConfig.commands}
  outputLines={currentConfig.outputLines}
  initialHistory={buildTerminalHistory(STEPS, stepper.currentStep)}
  completed={stepper.isCurrentStepCompleted}
  hasNext={stepper.currentStep < STEPS.length - 1}
  onCorrect={() => stepper.completeStep()}
  onWrong={(fb) => stepper.recordWrongAttempt(fb)}
  onNext={stepper.nextStep}
  stepKey={stepper.currentStep}
  prompt="irb>"              // Default: '$'
  terminalTitle="Rails Console" // Default: 'Terminal'
/>

// For mixed-interaction levels, pass null for non-terminal steps:
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
  null, // step 0: OptionCard
  { commands: step1Commands, outputLines: step1Output },
  { commands: step2Commands, outputLines: step2Output },
];
const history = buildTerminalHistory(TERMINAL_STEP_MAP, stepper.currentStep);
```

### Level Design: No Concept Overlap

**Each concept belongs to exactly one level.** Before adding a step to a level, check if that concept is already taught in another level. If it is, don't duplicate it. The player will learn it there.

Examples:
- Level 2 (First Boot) should NOT add routing steps. Level 5 (Routes) handles that
- Level 3 (Model) should NOT teach associations. Level 8 (Associations) handles that
- Level 6 (Controller) should NOT teach testing. Level 13 (Testing) handles that

When a level's name suggests a concept that's taught elsewhere, keep the level focused on its own scope. Don't pull in concepts from later levels to make the name feel more literal.

---

## Rails 8 Reference

This game teaches Rails 8. When referring to features, use "Rails 8" as the version context. Here's what's actually new in Rails 8 (vs backported from earlier versions):

**New defaults in Rails 8:**
- Kamal 2 for deployment (replaces Capistrano)
- Thruster as the default HTTP proxy (Puma + asset serving + X-Sendfile)
- Solid Cable (DB-backed Action Cable adapter, replaces Redis for WebSockets)
- Solid Cache (DB-backed cache store, replaces Redis/Memcached for caching)
- Solid Queue (DB-backed job backend, replaces Sidekiq/Resque)
- Propshaft (asset pipeline, replaces Sprockets)
- SQLite as a viable default with WAL mode + IMMEDIATE transactions

**New features in Rails 8:**
- `bin/rails generate authentication` (built-in auth scaffolding with `has_secure_password`, session model, password resets)
- `params.expect()` (stricter alternative to `params.require().permit()`)
- `Script` tag helper for ESM import maps
- Default `Regexp.timeout` for ReDoS protection
- `allow_browser` for minimum browser version enforcement

**Features available in Rails 8 but NOT new (introduced earlier):**
- `normalizes` (Rails 7.1)
- `encrypts` (Rails 7.0)
- `generates_token_for` (Rails 7.1)
- Hash-based enum syntax `enum :status, { draft: 0 }` (Rails 7.0)
- `with_lock` (Rails 3.2)
- `query_constraints` for composite primary keys (Rails 7.1)

When writing content, say "Rails 8" as the context (since that's what we teach). Don't say "Rails 7.1+" just because a feature was introduced earlier. The player is learning Rails 8.

**Reference:** https://guides.rubyonrails.org/8_0_release_notes.html

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
- **Never use raw HTML elements when a design system component exists.** Use `<Button>` instead of `<button>`, `<Card>` instead of `<div className="border rounded ...">`, etc. For links that look like buttons, use `<Button asChild><a href="...">...</a></Button>`, never a raw `<a>` with manual styling. The design system is the source of truth for all interactive UI.

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

---

## Session Logging

**Document every session.** After making changes, record them in a session log at `docs/sessions/{YYYY-MM-DD}-session-{N}.md`. Each entry should include: what was changed, why, and what was learned. Use `/load-context` at the start of a new conversation to load full project context (docs, spec, architecture, recent sessions) and create a new log file.

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Critical Rules

**Always ask for permission before committing changes. This is non-negotiable.**
Do NOT run `git commit` without explicit user approval.

**Always update session logs after every change. This is non-negotiable.**
After completing any work (code changes, fixes, refactors), immediately update the session log at `docs/sessions/{YYYY-MM-DD}.md` before reporting done. Do not wait to be asked. Do it proactively every time.

**Never use em dashes (—) anywhere in the codebase.** Use commas, periods, colons, or parentheses instead. This applies to all text: code comments, UI strings, content definitions, feedback messages, documentation.

**Consistency is non-negotiable.** Don't do one-off things. When a pattern exists in the codebase (button labels, step navigation, component structure), follow it exactly. If Level 1 uses "Next Step" with an ArrowRight icon, every level uses "Next Step" with an ArrowRight icon. No custom labels, no special cases.

**Always check the latest docs of any library before implementing.** Never assume the API from memory. Libraries rename components, change prop names, and introduce breaking changes between versions. Fetch the official docs (GitHub README, npm page, or docs site) and verify the current API before writing any code.

**Run all checks after every change. This is non-negotiable.**
After making any code changes, run ALL of the following from the project root before reporting done:
1. `bunx tsc --noEmit` (TypeScript type checking, must have zero errors in changed files)
2. `bunx biome check --write <changed files>` (lint and format, must have zero errors/warnings)
3. `bun run build` (must succeed)
4. `bun test` (all tests must pass)

Do not skip any of these. Do not dismiss errors as "pre-existing" without verifying. If an error is in a file you touched, fix it.

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

### No Barrel Files

**Never add exports to `index.ts` barrel files.** Import directly from the source module path instead.

```tsx
// CORRECT
import { PipelineFlow } from '@/components/levels/PipelineFlow';

// WRONG (re-exporting through index.ts)
export { PipelineFlow } from './PipelineFlow'; // in index.ts
import { PipelineFlow } from '@/components/levels'; // consumer
```

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

The player **actively explores** the problem through an interactive observe phase. They click on pipeline stages to inspect code, fire test probes to discover vulnerabilities, and find the problem through exploration (not passive watching).

- Center panel: interactive visualization of the problem. Pick the right visualization component for the concept (see below). Below the visualization, add a `ProbeTerminal` where the player fires test requests that reveal vulnerabilities.
- When a zone/stage is clicked, a `StageInspector` card overlay shows the stage's description and code. Nodes react to probes with visual feedback (color changes, badges, content updates).
- Left panel: **"Scenario" heading** (`<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>`) followed by scenario text paragraphs (`text-sm text-muted-foreground`), then `DiscoveryChecklist` showing explore progress (pills with Search/Check icons, progress bar with "X of Y required"). The heading is non-negotiable for visual consistency across all three-phase levels.
- Right panel: the broken/vulnerable/unoptimized code
- "Build the Fix" button appears **only when `discoveryGating.isUnlocked`** (player has found enough problems), not on a timer. Uses `animate-in fade-in duration-500`.

**Observe phase visualization: choose the right component.**

Two reusable React Flow components exist. Use one of these before building a custom visualization:

1. **`PipelineFlow`** — for levels where a **stage is missing or broken** in the request lifecycle (auth, validation, error handling). Nodes are minimal (label + sublabel + badge), styled by `variant` ('active'/'danger'/'inactive'/'default'). Supports multi-directional handles, bidirectional edges with lane offsets, and `activeConnections` for selective edge animation. Use when the concept is "something is wrong/missing at this point in the MVC pipeline."
   - `PipelineFlow` with `onNodeClick`: stages get `inspectable: true` (shows pulsing `?` indicator until inspected) and `inspected: boolean` (hides `?` after click). `cursor-pointer` + hover ring on clickable nodes.
   - Pipeline node `variant` is `'danger'` (red bg, red border, red sublabel) when showing a breach, `'active'` (green) when showing success, `'inactive'` (dashed, dimmed) for missing stages, `'default'` (zinc) otherwise.
   - Canonical example: L12 (Authorization)

2. **`QueryZoneFlow`** — for levels where **all stages work but data volume/flow is the problem** (N+1 queries, query flooding, caching, counter caches). Nodes are content-rich with structured slots (`codeLine`, `badge`, `statusText`, `statusBadge`, `loopCounter`, `queryLog`, `waitingText`). Supports `highlighted`/`highlightColor`/`panic` for visual state, and `danger` flag on edges to turn them red. Horizontal left-to-right layout, 350px spacing.
   - `QueryZoneFlow` with `onZoneClick`: zones get `inspectable: true` and `inspected: boolean`, same pulsing `?` indicator pattern.
   - Dot presets: `QUERY_DOTS_NORMAL` (1 green), `QUERY_DOTS_FLOOD` (12 red), `QUERY_DOTS_CLEAN` (2 green), `QUERY_DOTS_DANGER` (6 red).
   - Canonical example: L23 (N+1 Problem)

**When neither fits**, build a custom visualization. But always check these two first.

**Observe phase components:**
- `useDiscoveryGating(defs, { minRequired })` hook: tracks what the player has discovered. API: `discover(id)`, `isDiscovered(id)`, `isUnlocked`. No wrong attempts, pure exploration gating.
- `DiscoveryChecklist`: left panel component showing discovery progress
- `ProbeTerminal`: terminal-style component (amber-themed `>` prompt, distinct from SimulatedTerminal's green `$`). Each probe fires once, response reveals vulnerability. NOT a quiz. `onProbe(id)` callback triggers discoveries.
- `StageInspector`: card overlay on stage click. Shows title, description, optional code block. Closes on X, click outside, or Escape.

**Define data maps for each level:**
- `DISCOVERY_DEFS`: array of `{ id, label }` for all discoverable items
- `PROBES`: array of `ProbeConfig` with `{ id, label, command, responseLines }`
- `PROBE_DISCOVERY_MAP`: maps probe IDs to discovery IDs they trigger
- `STAGE_INSPECTOR_MAP`: maps stage IDs to `StageInspectorData` (title, description, optional code)
- `STAGE_DISCOVERY_MAP`: maps stage IDs to discovery IDs they trigger
- `PROBE_PIPELINE_MAP`: (PipelineFlow levels) maps probe IDs to `{ policySublabel, modelBadge }` for node display during probes

**Implementation-time verification (non-negotiable):**

These checks must happen WHILE WRITING the code, not as a post-hoc audit. Every animation frame array, every code preview boundary, every connector definition must be verified against reality before it is committed.

1. **Frame-by-frame playthrough.** Before writing any animation frame array (`PROBE_FRAMES`, `REWARD_FRAMES`), write down in comments what the player sees at each frame: which zones are active, which connectors have dots, what labels say, what direction data flows. Then ask: "Does this match how the real system works?" If a frame shows data flowing through a connector between two components that don't communicate in this scenario, the frame is wrong.

2. **Connector accuracy.** For each connector in each frame, ask: "Does data actually flow between these two components in this specific scenario?" A direct upload bypasses the app server, so no connector between app and S3 should activate. A CDN redirect means the client fetches from the CDN directly, not through the app. Do not reuse connectors from one scenario in another without verifying the data path is the same.

3. **Zone existence.** Observe phase frames must only reference zones that exist in the "before" state. If the build phase introduces a new component (S3, Redis, a cache layer), no observe frame should set state on that zone.

4. **Code preview boundaries.** For each OptionCard step, verify that the code preview shown while the player is working on that step does NOT contain distinctive strings from the correct answer. The code preview for "working on step N" = result of step N-1.

5. **Technical claims.** If you write a frame that shows a specific technical behavior (e.g., "App Server talks to S3 to generate presigned URL"), verify the claim against the actual Rails/gem source or documentation before writing the frame. Do not guess. `create_before_direct_upload!` writes a local DB record and computes the URL from stored credentials. It does not make a network call to S3.

6. **Complete flows.** Every animation must show the COMPLETE real-world flow for its user action. Before writing frames, write out every step the real system performs. If the flow has 5 steps and you only animate 3, the player learns an incomplete concept. A direct upload that stops at "stored on S3" without the attach step teaches the player that blobs magically attach themselves. Each stress test button represents one user action (e.g., "Upload photo"), and the animation plays the full technical flow that action triggers (presigned URL, direct upload, attach).

**Every level needs its own unique visualization concept.** Do NOT reuse the same "dots flowing through a pipeline" pattern everywhere. The visualization must teach the specific concept of that level. Examples:
- MVC/architecture levels: `PipelineFlow` showing where this piece fits in the request cycle
- Security levels: `PipelineFlow` with animated requests/actors showing what gets through
- Performance levels: `QueryZoneFlow` showing data flow, query multiplication, caching zones
- Testing level: deploy pipeline where broken commits pass an empty test gate
- Data levels: entity-relationship or schema diagrams showing structural problems
- Routing level: request dispatcher showing URLs hitting dead ends

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
- Right panel: code preview evolves as steps are completed. Use `isCurrentStepCompleted ? currentStep : currentStep - 1` as the completed step index for `getCodeFiles`. This ensures the player sees the result of previous steps (context) while working, and only sees the current step's result after completing it. Never use `furthestStep` or `currentStep` directly as the code preview index.

#### Phase 3: Solution Visualization (ADVANTAGE)

The player **stress-tests** their solution by firing different request scenarios and watching the fix handle each one. This is interactive, not passive.

- The last build step's "Next Step" button transitions directly to the reward phase. No intermediate screen, no star rating, no "Visualize ___" button.
- Full-screen visualization returns in center panel, now showing the solution working. Below the visualization, a `StressTestPanel` (terminal-style, dark bg, traffic-light header) lets the player fire request scenarios.
- Visualization nodes react dynamically to each fired scenario. For `PipelineFlow`: the key node flips between `'active'` (green, sublabel "authorize!") and `'danger'` (red, sublabel "403 Forbidden", badge "BLOCKED"). For `QueryZoneFlow`: zones update `highlighted`/`highlightColor`, `statusText`, `statusBadge`, and edges toggle `danger` flag. Both give immediate visual feedback per request.
- Left panel: legend + dual counters (Allowed/Blocked in green/red grid)
- Right panel: final complete code
- Player clicks Submit when satisfied

**Reward phase components:**
- `useStressTest(scenarios)` hook: manages stress-test mechanics. API: `fireRequest(scenarioId)`, `toggleAutoFire()`, `reset()`. Returns `results`, `allowedCount`, `blockedCount`, `isAutoFiring`, `canAutoFire` (gates behind 3+ manual fires).
- `StressTestPanel`: terminal-style center panel component (matching ProbeTerminal styling). Shows scenario buttons with full detail (`METHOD /path as actor`), color-coded by expected result (green border for allowed, red for blocked). Results log with status codes. Auto-fire toggle with escalating speed.
- `STRESS_SCENARIOS`: array of `StressScenario` with `{ id, label, description, method, path, actor, expectedResult }`.
- Reward pipeline stages are built with `useMemo` reacting to `stressTest.results[last]` so nodes update on every fire.

#### Phase state machine

```
phase: 'observe' | 'build' | 'reward'

observe  -> (discoveryGating.isUnlocked && click "Build the Fix") -> build
build    -> (last step completed && click "Next Step")             -> reward
reward   -> (click Submit)                                         -> level complete
```

**No activate phase.** The build phase's last step has the same "Next Step" button as every other step. Clicking it transitions directly to the reward phase. No star rating screen, no "Visualize ___" interstitial. Existing levels that still have an activate phase should be updated to remove it during their next audit.

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
  addConsoleEntry('Product.count', '=> 0');  // Adds to existing irb> history
  stepper.completeStep();
};
<Button onClick={handleVerify} variant="outline">Product.count</Button>
```

When creating or redesigning a level component, ensure all three phases are present in the gameplay. Reference `docs/spec.md` for each level's scenario and concept.

**Reference implementation:** Level 12 (Authorization) in `src/features/act2-users-security/components/Level12Authorization.tsx` is the canonical example of this pattern.

**Performance-level ADVANTAGE phase convention (Acts 4-8):**
Every performance-related level must have a full ADVANTAGE phase in its `learningContent` with:
- **Before/after benchmarks** showing time, memory, and object allocations where available
- A **"Further reading"** section linking to relevant gems, guides, and the "Rails Scales!" book chapter

### Wrong-Answer Feedback: Never Reveal Answers

**Error feedback must NEVER contain the correct answer.** This is non-negotiable. Feedback should explain *why the chosen option is wrong*, not what the right one is. The player must figure out the answer themselves.

**The correct answer must NEVER be the first option.** Use `shuffleOptions(options, stepIndex)` from `@/lib/shuffleOptions` to randomize positions per session. Do NOT hand-position correct answers: hand-positioned patterns (e.g., 2nd, 3rd, 3rd, 3rd, 2nd) are predictable across steps.

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
| `problem.goal` | "YOUR GOAL" section | Describe the outcome, not the tools. **Never name specific gems, methods, or classes** the player will choose in build steps. "Implement soft deletes with an audit trail" is fine. "Install discard gem and PaperTrail" is a spoiler. |
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
- **Never use raw HTML elements when a design system component exists.** Use `<Button>` instead of `<button>`, `<Card>` instead of `<div className="border rounded ...">`, etc. For links that look like buttons, wrap `<a>` inside `<Button>`: `<Button><a href="...">...</a></Button>`. The design system is the source of truth for all interactive UI.
- **Never use `asChild` or Radix Slot with Astro.** Radix's `Slot` component (both `@radix-ui/react-slot` and `radix-ui`) does not merge className onto children during Astro's React SSR. The child renders with only its own classes, losing all parent styling. The `asChild` prop has been removed from the Button component.

### Theme Color Changes

**When updating the theme primary color, update ALL of these:**
1. `global.css` `.dark` block: `--primary`, `--primary-foreground`, `--ring`, `--shadow-glow`, `--chart-1`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-ring`, `::selection` background, `.react-flow__selection` background
2. Hardcoded `oklch()` values in pages/components (search for the old oklch value across the codebase)
3. `favicon.svg`: update the accent color to match the new primary
4. Hero gradient text: update `via-*` color to match the primary hue family
5. `body` dot pattern in global.css if it references the primary

### Styling

- **Never use inline `style` attributes.** Use Tailwind utility classes. For animations, use `tw-animate-css` classes (`animate-in`, `fade-in`, `slide-in-from-bottom-3`, `zoom-in-95`, `duration-*`, `delay-*`). Use arbitrary value classes (e.g., `delay-[400ms]`) when no standard utility exists.
- Use semantic color tokens: `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`
- **Always consider both light and dark modes.** Every color choice must be visible and readable on both white and dark backgrounds. Use semantic tokens (which adapt automatically) where possible. When using fixed Tailwind colors (e.g., `text-emerald-600`, `border-zinc-300`), add `dark:` variants to ensure contrast in both modes. Never use hardcoded `white/[0.08]` or `oklch` values that only work on one background.
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

**Document every session.** After making changes, record them in a session log at `docs/sessions/{YYYY-MM-DD}.md` (one file per day). If multiple sessions happen on the same day, append to the existing day's log under a new heading. Each entry should include: what was changed, why, and what was learned. Keep max 10 session logs; prune older ones when creating a new one. Use `/load-context` at the start of a new conversation to load full project context (docs, spec, architecture, recent sessions) and create/update the log file.

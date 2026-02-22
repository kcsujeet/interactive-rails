---
name: audit-level
description: Audit a level component against the three-phase sequential flow standard (Problem Visualization, Problem Solving, Solution Visualization). Use when reviewing, creating, or redesigning any level component.
---

# Audit Level Against Three-Phase Flow

Audit a level component to verify it follows the mandatory three-phase sequential flow pattern established in CLAUDE.md. The golden standard is: Problem Visualization -> Problem Solving -> Solution Visualization.

## Reference Implementation

Read Level 12 (Authorization) as the canonical example:
`frontend/src/features/act2-users-security/components/Level12Authorization.tsx`

## Step 0: Read the Official Documentation (MANDATORY)

Before auditing or building any level that involves a gem, library, or Rails feature:

1. **Identify every gem/library the level teaches** (e.g., Pundit, Devise, RSpec, FactoryBot)
2. **Fetch the full README.md** from the official GitHub repo using `WebFetch`. Read the ENTIRE README, not a summary. Pay special attention to:
   - "Installation" / "Getting Started" sections (every step listed here must appear in the level)
   - Class/module names and inheritance patterns
   - Configuration requirements (initializers, includes, migrations)
3. **Fetch generator template files** if the level includes a generator step. Check `lib/generators/` in the gem's repo to see what files are actually created and what their contents look like
4. **Cross-reference every code snippet in the level** against the README. Flag any discrepancies: wrong class names, wrong method signatures, outdated inheritance patterns, missing setup steps
5. **Never trust cached knowledge.** Gems rename modules, change inheritance hierarchies, and add/remove setup steps between versions. The README is the single source of truth

This step is non-negotiable. Skipping it has caused bugs in the past (wrong Scope inheritance, missing `include` steps, fake generator output).

## Checklist

### Phase 1: Problem Visualization (WHY)

The level must have a dedicated "observe" phase where:

- [ ] Center panel shows a **full-screen visualization** of the problem (SVG animation, broken state, error condition)
- [ ] No build steps or OptionCards are visible during this phase
- [ ] A **"Build the Fix"** button fades in after ~3 seconds (using `animate-in fade-in duration-500`)
- [ ] Left panel shows scenario text + any legends needed to understand the visualization
- [ ] Right panel shows the broken/vulnerable/unoptimized code
- [ ] Clicking the button transitions to Phase 2 and clears the visualization

If the level has no visual problem to animate (e.g., pure code structure levels), it must still have a dedicated observe phase showing the problematic code state before the player starts building.

### Phase 2: Problem Solving (HOW)

The build phase must cover the **complete workflow**:

- [ ] **Gem/dependency installation is included** if the feature requires a gem (`bundle add <gem>`). Non-negotiable.
- [ ] **Generator/setup commands are included** if the gem has one (`rails generate <gem>:install`). Non-negotiable.
- [ ] Center panel shows ONLY the step UI (no animation running in background)
- [ ] Terminal steps use `TerminalChoiceStep` with `buildTerminalHistory` for cumulative shell history
- [ ] Code selection steps use `OptionCard`
- [ ] Left panel shows scenario text + `StepProgress` pills
- [ ] Right panel code preview evolves with `stepper.furthestStep`
- [ ] `ErrorFeedback` component is used for wrong-answer feedback (not inline error divs)
- [ ] Correct answer is never the first option
- [ ] All options use the same color
- [ ] Feedback never reveals the correct answer

**Documentation verification (non-negotiable):**
- [ ] Before writing ANY step content, **fetch and read the full README** of the gem/library from its official GitHub repo (not a summary, not from memory)
- [ ] Use `WebFetch` to read the actual README.md, not just the repo landing page
- [ ] Verify the exact installation steps from the README. Gems often have steps beyond `bundle add` and `rails generate` (e.g., including a module in ApplicationController, running migrations, adding initializer config)
- [ ] Verify generated file contents match the actual template files in the gem's source code (check `lib/generators/` in the repo)
- [ ] Verify class names, module names, method signatures, and inheritance patterns against the README
- [ ] Do NOT rely on AI knowledge of gem APIs. Gems change between versions. The README is the source of truth
- [ ] If the README shows N installation steps, the level must have at least N steps covering them all

**Typical step progression for a gem-based feature (verify against README):**
1. Install the gem (`bundle add ...`) - TerminalChoiceStep
2. Include module / configure controller (if README requires it) - OptionCard step
3. Run the generator (`rails generate ...`) - TerminalChoiceStep
4. Configure/customize the generated code - OptionCard steps
5. Wire it into the application - OptionCard steps

**Common missing steps to flag (cross-reference with README):**
- Missing `bundle add <gem>` step
- Missing `include <Gem>::<Module>` in ApplicationController (many gems require this, e.g., Pundit, Devise)
- Missing `rails generate <gem>:install` step
- Missing database migration step (`rails db:migrate`) when generators create migrations
- Missing configuration steps (initializers, environment config)
- Any step listed in the gem's README "Getting Started" / "Installation" section that is not represented in the level

### Phase 3: Solution Visualization (ADVANTAGE)

The level must have a dedicated reward phase:

- [ ] Sub-phase a (activate): Star rating + "Activate ___" button (centered, no animation)
- [ ] Sub-phase b (reward): Full-screen visualization returns, now showing the solution working
- [ ] The contrast between Phase 1 (broken) and Phase 3b (fixed) is the reward
- [ ] Left panel shows StepProgress (all complete) + counters/metrics if applicable
- [ ] Right panel shows the final complete code (all files)

### State Machine

Check the phase transitions:

- [ ] State uses `phase: 'observe' | 'build' | 'activate' | 'reward'` (not boolean flags)
- [ ] `observe -> build`: triggered by "Build the Fix" button click
- [ ] `build -> activate`: triggered by `useEffect` watching `stepper.isComplete`
- [ ] `activate -> reward`: triggered by "Activate ___" button click
- [ ] Animation intervals only run during `observe` and `reward` phases
- [ ] Requests/state are cleared on phase transitions

## Output Format

Present findings as:

1. **Pass/Fail** for each of the 3 phases
2. **Missing steps** in the build phase (especially gem install, generators, setup)
3. **Specific code locations** that need changes (file:line)
4. **Suggested fix** for each issue found

If the level passes all checks, confirm it follows the golden standard.

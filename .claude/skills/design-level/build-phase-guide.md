# Build Phase Guide

Detailed guidance for the Problem Solving (HOW) phase: step design, code preview accuracy, option quality, feedback consistency, and documentation verification.

## Pre-Flight: Read cumulative-patterns.md (Non-Negotiable)

**Before writing ANY content for a level, read [cumulative-patterns.md](cumulative-patterns.md).** If the player can see it, it must follow every pattern established in earlier levels. No exceptions.

## Code Preview Accuracy

### No empty states

Check the `getCodeFiles` function: every step state must produce non-empty code. A common bug is a ternary chain where the fallback is an empty string, leaving the code panel blank after completing a step. Every step completion should show a meaningful code snapshot (skeleton with placeholder comments for what comes next).

### Code preview does not reveal the current step's answer

While the player is WORKING ON step N (not yet completed), the right panel must show the result of step N-1 (context), NOT the result of step N (the answer).

Common bug: using `stepper.furthestStep` or `stepper.currentStep` directly as the code preview index, which shows the current step's result code before the player has selected it.

Fix: pass `isCurrentStepCompleted ? currentStep : currentStep - 1` as the "completedStep" to `getCodeFiles`.

Case study: L35 showed the correct `has_one_attached` model code in the right panel while the player was still choosing between model attachment options.

### Code preview must reflect what the step actually changed

The right panel header says "Generated Rails Code," so it must show code that was generated or modified by the completed step. If a step does not modify any code file (e.g., `db:encryption:init` prints to stdout, `credentials:edit` modifies an encrypted binary), the code preview must keep showing the previous state unchanged.

Rules:
- Do not fabricate file changes
- Do not show a file with the step's output pasted in as comments
- Do not show the answer file (e.g., `credentials.yml.enc`) before the player has chosen it
- When consecutive steps don't modify code files, they share the same code preview

Case study: L36 steps 0-1 (generate keys, store in credentials) don't modify any `.rb` files, so the code preview stays on the unchanged `user.rb` until step 2 adds `encrypts` declarations.

### Code preview transition table (non-negotiable)

Before writing or approving `getCodeFiles`, build this table and write it down:

| completedStep | Player just did | Preview shows | Leaks next step? |
|---|---|---|---|
| -1 (working on 0) | Nothing yet | "Before" code (unchanged) | No |
| 0 (working on 1) | Step 0's action | Result of step 0 only | Check |
| 1 (working on 2) | Step 1's action | Result of steps 0-1 | Check |
| ... | ... | ... | ... |

For each row, ask three questions:
1. Does the preview contain any distinctive string from the NEXT step's correct answer?
2. Does the filename reveal the next step's answer?
3. If the step didn't modify any code file, does the preview stay unchanged from the previous row?

If any answer is wrong, fix it.

Case study: L36 had three code preview bugs caught by this table:
- Step 0 showed fabricated comments in `user.rb` (keygen doesn't modify files)
- Step 1 showed `credentials.yml.enc` as the filename (reveals the storage answer)
- Step 2 showed `encrypts :phone`/`encrypts :address` (reveals step 3's answer)

## Option Card Quality

### Exactly 3 options per step

Two options make it a coin flip. Three options require genuine reasoning. If you can only think of two plausible choices, add a third that represents a common misconception (e.g., using a related but incorrect API, manually doing what the framework handles automatically, or over-applying the concept).

### Inline comments must not reveal answers

Code comments inside OptionCard snippets must describe *what the code does*, not *why it is right or wrong for this step*.

**Bad:** If the step description says "email needs find_by and uniqueness," comments like `# Allows: find_by(email:), validates uniqueness` on one option and `# Cannot use find_by` on another let the player pattern-match the step description to the comments.

**Good:** Comments describe the mechanism: `# Same plaintext always produces the same ciphertext`. The player connects the dots themselves.

Case study: L36 email encryption options had comments that restated the step requirements verbatim on each option, turning a reasoning exercise into a matching exercise.

### Correct answer positioning

The correct answer must never be the first option. Vary its position across steps so there is no predictable pattern.

### Option color consistency

All options in a set must use the same color (or omit color entirely to use the default). Do not use green for the correct answer or red for wrong ones.

## Feedback Quality

### Feedback must never reveal the correct answer

Error feedback explains *why the chosen option is wrong*, not what the right one is. The player must figure out the answer themselves.

### Feedback must not contradict earlier steps (non-negotiable)

When a wrong option in step N uses the same technique the player correctly chose in step M, the feedback must frame it as a **tradeoff that was right in step M's context but wrong here**, not as universally bad.

**Bad:** Step 2 teaches `deterministic: true` for email (correct). Step 3 feedback says "Deterministic encryption is less secure." The player thinks: "You just told me deterministic was right!"

**Good:** Step 3 feedback says "Deterministic mode is a tradeoff: it enables querying but identical values produce identical ciphertext. Email needed that tradeoff for login lookups. Phone and address are never queried, so there is no reason to accept weaker encryption for them."

The principle: every feedback message must be consistent with the decisions the player has already made in earlier steps. If a technique was correct before, explain why the *context changed*, not why the technique is bad.

Case study: L36's step 3 originally called deterministic encryption "less secure" as a blanket statement, contradicting step 2 where the player chose deterministic and was told it was correct. The fix reframed it as a context-dependent tradeoff.

### Feedback teaches distinct lessons

Each wrong option should fail for a different reason that teaches something specific. Don't have two wrong options that are wrong for essentially the same reason.

## Step Labels and Descriptions

### Step labels must not reveal answers

StepProgress pill titles (shown in the left panel) must describe the task generically, not name the specific gem, module, or method the player will choose.

**Bad:** "Add the Pagy Gem", "Store Keys in Credentials"
**Good:** "Install Pagination Gem", "Secure Key Storage"

### Scenario text must not reveal answers

The left panel scenario text, step descriptions, and hint text must never name the correct gem, class, method, or command. Describe requirements and constraints instead.

### Wrong options must be contextually plausible

After the player has already chosen a gem/library in an earlier step, wrong options in later steps must be from that same gem (e.g., old API names, wrong modules), not from a completely different gem they did not install.

## Documentation Verification (non-negotiable)

Before writing ANY step content:
- **Fetch and read the full README** of the gem/library from its official GitHub repo using `WebFetch`
- Verify exact installation steps from the README
- Verify generated file contents match actual template files in the gem's source code (check `lib/generators/` in the repo)
- Verify class names, module names, method signatures against the README
- Do NOT rely on AI knowledge of gem APIs. The README is the source of truth
- If the README shows N installation steps, the level must have at least N steps
- Any step listed in the gem's README "Getting Started" / "Installation" section that is not represented in the level must be flagged

## Step Progression

### Typical gem-based feature

1. Install the gem (`bundle add ...`) - TerminalChoiceStep
2. Include module / configure controller (if README requires it) - OptionCard step
3. Run the generator (`rails generate ...`) - TerminalChoiceStep
4. Configure/customize the generated code - OptionCard steps
5. Wire it into the application - OptionCard steps

### Common missing steps

- Missing `bundle add <gem>` step
- Missing `include <Gem>::<Module>` in ApplicationController
- Missing `rails generate <gem>:install` step
- Missing `rails db:migrate` step after any generator that creates migrations (non-negotiable)
- Missing configuration steps (initializers, environment config)

### Migration rule

If any build step generates a migration file, the very next step MUST be running `rails db:migrate`. Without it, the column/table does not exist in the database. Case study: L27 Counter Caches originally had "Generate the counter cache migration" immediately followed by "Enable counter_cache on the association," skipping the migration run.

## UI Consistency

### "Next Step" button

The canonical pattern is `<Button className="gap-2" onClick={onNext} size="sm">Next Step <ArrowRight /></Button>` (default variant, `size="sm"`, `className="gap-2"`). This matches `TerminalChoiceStep` and the L12 reference. OptionCard steps in the same level must use the same button style. Do not use `variant="outline"` or omit `size="sm"`.

### Error feedback positioning and behavior

The `ErrorFeedback` component must behave consistently across all levels:

1. **Position: always above the options.** Place `ErrorFeedback` between the step title/description and the option cards. Never below the options, between options, or at the bottom of the panel.

2. **No auto-dismiss.** Error feedback stays visible until the player selects another wrong option (feedback updates) or selects the correct answer (feedback clears). The player needs time to read and understand the feedback. A 3-second timeout forces speed-reading and punishes slow readers.

3. **Clear on step advance.** When the player clicks "Next Step" to move to the next step, clear any lingering feedback from the previous step. Otherwise the old error message carries over to the new step's UI.

```tsx
// Correct: feedback above options, no timeout, clears on next step
<div className="mb-4">
  <ErrorFeedback message={wrongFeedback} onDismiss={() => setWrongFeedback(null)} />
</div>
<div className="space-y-3">
  {options.map(opt => <OptionCard ... />)}
</div>
<Button onClick={() => { setWrongFeedback(null); stepper.nextStep(); }}>
  Next Step
</Button>
```

The `ErrorFeedback` component slides in from the top (`slide-in-from-top-3`) and fades out when cleared. It never auto-dismisses.

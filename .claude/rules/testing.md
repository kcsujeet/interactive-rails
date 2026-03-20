---
paths:
  - "**/*.{ts,tsx}"
---

# Testing

- **Every level must have tests.** When creating or modifying a level component, write or update its test file. Tests catch data consistency bugs (contradictory SQL, wrong labels, missing response lines) that are invisible in code review but obvious in the UI.
- **Write tests WHILE building, not after.** Tests are not a post-hoc validation step. Write the test data (mirrored frame arrays, code preview signatures, connector expectations) alongside the component data. If you cannot write a passing test for a frame array, the frame array is wrong. This is the primary defense against narrative and data flow bugs that are easy to introduce during implementation and hard to spot in review.
- **Test file location:** `src/features/actN-*/` `__tests__/LevelNNName.test.ts` (next to the component, inside a `__tests__` directory).
- **Use `bun:test`.** Import `describe`, `expect`, `test` from `'bun:test'`. Run with `bun test`. No Jest, Vitest, or other frameworks.
- **Test pure logic, not React rendering.** No `@testing-library/react`, no DOM rendering. Mirror the data structures and validation logic from the component into the test file, then test them directly.
- **What to test for every level:**
  - **Validation logic**: invalid when incomplete, valid when all steps done, correct error messages
  - **Build step quality**: correct answer is never the first option, every wrong option has feedback, feedback never reveals the correct answer, each step has exactly one correct answer
  - **Data consistency**: every stress scenario has a reward data entry, reward data maps to valid lanes/zones, response lines are present on all scenarios
  - **Cross-phase consistency**: observe and reward cover the same lanes/zones, scenario labels match probe labels for overlapping endpoints
  - **Scenario uniqueness**: all IDs unique, all labels unique, mix of allowed/blocked results
  - **Observe probe narrative consistency**: if the build phase introduces a new component (e.g., S3, Redis, a gem), observe probe animation frames must NOT reference that component's zone/connector state. Mirror the frame data arrays and verify no frame sets state on zones that don't exist in the "before" state.
  - **Code preview does not reveal answers**: for each OptionCard step, the code preview shown while WORKING ON that step (completedStep = currentStep - 1) must not contain distinctive strings from the correct answer. Mirror the correct answer signatures and the code preview content per completed step, then cross-check that no answer signature appears in the preview for the preceding step.
  - **Animation connector accuracy**: if a reward scenario's data flow bypasses a zone (e.g., direct upload skips the App Server), verify the animation frames use the correct bypass connector (e.g., `connC` for Client <-> S3 direct), not the connector that goes through the bypassed zone (e.g., `connB` for App <-> S3). Mirror the reward frame arrays and check that bypass scenarios never set state on the wrong connector.
- **What to test for levels with shared visualization components (lanes, zones, nodes):**
  - **No data contradictions**: if a reward scenario reuses a shared lane/zone, verify the displayed SQL, labels, and banners are consistent. If a plan says "no WHERE clause," the displayed SQL must not contain WHERE. If a lane has a WHERE clause but the scenario does not, an `sqlOverride`/`labelOverride` must be present.
  - **Grid/animation data**: match positions are within bounds, match counts are reasonable for the concept
- **Mirror data, do not import from components.** Copy the data structures (scenarios, lanes, options, grid matches) into the test file. This makes tests independent and also serves as a snapshot: if the component data drifts, the test still documents the expected shape.
- **Run tests before reporting done.** After writing or modifying tests, run `bun test path/to/test.ts` to verify they pass.

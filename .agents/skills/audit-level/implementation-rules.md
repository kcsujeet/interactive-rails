# Implementation-Time Verification Rules

**Every check in the audit skill applies when BUILDING a level, not just when reviewing one.** The audit skill is not a post-hoc review tool. It is the standard for how levels are built. If you are writing animation frame arrays, code preview boundaries, connector definitions, or zone layouts, you must verify them against these checks AS YOU WRITE THEM.

## Bug Table: Past Mistakes and How to Prevent Them

All of these bugs were caused by skipping implementation-time verification and treating the audit skill as audit-only.

| Bug | What went wrong | What should have happened |
|-----|----------------|--------------------------|
| Observe frames referenced S3 | Frames were copied mechanically without checking if S3 exists in the "before" state | Zone existence check (narrative reasoning section 3) before writing any frame |
| Code preview revealed answers | Used `furthestStep` as code preview index without checking what the player sees | Code preview boundary check (Phase 2 checklist) before writing `getCodeFiles` |
| Direct upload used wrong connector | Reused connB (App<->S3) for Client->S3 flow without checking the data path | Connector accuracy check (visualization accuracy checklist) before writing each frame |
| Fabricated technical claim about `create_before_direct_upload!` | Assumed API behavior instead of verifying | Technical claims must be verified against docs/source before writing frames |
| Reward animation skipped steps in real flow | Concurrent upload animation stopped at "stored on S3" without the attach step. An orphaned blob on S3 is not a completed upload. | Write out the COMPLETE real-world flow before writing frames. Every step the real system performs must have a frame. |
| Reward scenarios split one user action into multiple buttons | "Direct upload" and "Attach blob" were separate buttons, but a user just clicks "Upload photo" | Each stress test button = one user action. The animation plays the full technical flow triggered by that action. |
| React Flow container used fixed height | Used `h-72` instead of `flex-1 relative`, unlike every other PipelineFlow level | Always use `flex-1 relative` for React Flow containers so they fill available space. Check how the canonical reference (L12) renders its PipelineFlow before building a custom React Flow visualization. |
| Reward animation contradicted built code | L35 "Download avatar" showed "Variant not cached, generating..." every time, but the player defined named variants (`:thumb`, `:medium`) which are cached after first access. Also showed connB (App->S3) for variant generation, but real flow is bidirectional. | Cross-reference every reward animation against the code the player built. If the build phase defines named variants, the reward must show the cached case, not cold-start generation. |
| Validation attributed to wrong component | L35 blocked scenarios said "rejected at presigned URL stage" but `validate_content_type!` and `validate_file_size!` live in the `UploadAvatar` service, not in `DirectUploadsController`. | Trace each validation shown in reward animations back to the exact method and class in the built code. The animation label must name the correct component. |
| Reward showed behavior the code doesn't implement | L35 claimed content type validation happens before upload, but the built `DirectUploadsController` has no validation, only `create_before_direct_upload!`. | Read the final code preview (`getCodeFiles` for the last step) and verify every reward claim is supported by that code. |
| Wrong-answer feedback revealed correct answer | L43 `bundle add paranoia` feedback said "Discard is explicit and non-invasive", directly naming the correct gem. L43 `acts_as_paranoid` feedback said "Discard is explicit: you call discard instead of destroy", naming both the gem and method. | Read every feedback string and check if it contains the correct answer's gem name, class name, or method name. Feedback must only explain why the wrong choice is wrong, never name the right one. |
| problem.goal named specific gems/tools | L43 goal said "Implement soft deletes with the discard gem and audit trails with PaperTrail." Build step 0 asks "which gem?" but the goal already answers it. Widespread: 30+ goals across all acts named specific gems. | Goals describe WHAT to achieve ("implement soft deletes with an audit trail"), never HOW ("install discard gem"). Same rule applies to learningContent.goal. |

## Core Principles

**Do not treat frame arrays as mechanical data to wire up.** Each frame is a claim about how the real system works. Verify the claim before writing the frame.

**Every animation must show the COMPLETE flow for its user action.** Before writing frames, write out every step the real system performs for that action. If the flow has 5 steps and you only animate 3, the player learns an incomplete concept. An upload that stops at "stored on S3" without attaching the blob teaches the player that direct upload ends at S3, which is wrong.

## Pre-Flight Checklist (Before Writing Any Frame Data)

1. **Write out the real-world flow first.** For each stress test scenario, list every step the real system performs when the user takes that action. Number them. Then write one animation frame per step.

2. **One button = one user action.** Each stress test button should represent something a real user does ("Upload photo", "View profile", "Upload 10 photos"). The animation behind the button plays the full technical flow. Never split internal implementation steps into separate buttons.

3. **Connector audit.** For each connector in each frame, ask: "Does data actually flow between these two components in this specific scenario?" If not, don't activate it. If a connector should not exist at all in a scenario (e.g., App<->S3 during direct upload), don't render the edge.

4. **Zone existence.** Observe phase frames must only reference zones that exist in the "before" state. If the build phase introduces a new component, no observe frame should touch it.

5. **Code preview boundaries.** For each OptionCard step, verify the code preview shown while working does NOT contain the correct answer. The preview for "working on step N" = result of step N-1.

6. **Technical accuracy.** If a frame claims a specific technical behavior, verify it against docs or source. Do not guess how an API works.

7. **Layout consistency.** Check how the canonical reference implementation (L12 for PipelineFlow) renders its visualization container before building a custom one. Match the same flex/relative pattern. Never use fixed heights for React Flow containers.

8. **Cross-reference reward animations against built code (non-negotiable).** Read the final code preview (`getCodeFiles` for the last completed step) and verify every reward animation claim is supported by that code. For each scenario, ask:
   - Which class/method handles this request? Does the animation label name the correct one?
   - Does the built code define cached behavior (named variants, memoized results)? If so, the animation must show the cached case, not the cold-start case.
   - Where does validation happen? Trace each rejection to the exact method (`validate_content_type!`, `validate_file_size!`) and class (`UploadAvatar`). The animation must attribute it correctly.
   - Does the animation show behavior the built code doesn't implement? If the controller has no validation logic, the animation cannot claim rejection happens there.

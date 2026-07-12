# Boss Levels: Design Document

Status: DESIGN (2026-07-12). No boss level is implemented yet. This document
defines what a boss level is, why the curriculum needs them, and the full
spec for the first one (Act 1), so implementation can start without
re-litigating the concept.

## Why boss levels

Every regular level teaches ONE concept through the three-phase loop
(observe, build, reward) with heavy scaffolding: options to pick from, code
previews evolving beside you, feedback on wrong choices. That scaffolding is
what makes concepts learnable, and it is also what makes them forgettable:
the player never has to RETRIEVE a command or pattern cold, only recognize
it among three options.

The project's goal is expert-level Rails recall, not level completion. A
boss level is the retrieval test at the end of each act: one realistic task
that composes every concept the act taught, with the scaffolding removed.

## What a boss level is

- **One scenario, no steps.** The boss presents a single realistic job
  ("stand up the catalog API for the seller beta") and a checklist of
  outcomes, not a step sequence. The player decides the order.
- **Free input only.** No OptionCards, no TerminalChoiceStep. The existing
  free-input terminal (built 2026-07-05: typed commands, two misses reveal
  options) runs in strict mode: misses reveal a HINT (what kind of tool),
  never the command.
- **Composition, not repetition.** Every task in the boss requires 2+
  concepts from the act combined. Act 1 example: "expose reviews under each
  product" needs routing (L6) + associations (L5) + controller (L7) +
  serializer (L8) at once.
- **Validation by outcome.** The boss checks the simulated world's state
  (routes exist, response shape correct, timestamps absent), not which
  commands were typed. Multiple command orders can pass.
- **No new concepts.** A boss teaches nothing new. Anything not taught by
  the act cannot appear, even as flavor.
- **Failure is cheap, retry is full.** Any outcome can be retried; the boss
  tracks attempts (the star rating maps to how few hints were consumed, not
  how few attempts).

## Placement and naming

One boss after the final level of each act, numbered like `B1`..`B7` in the
registry but rendered as "Act 1 Boss: First Contract" (bosses do not consume
L-numbers; the spec-consistency test and contiguous L1..L58 validator stay
untouched). Registry gains `isBoss: true`; the act map renders a distinct
node.

## The recall ladder (per outcome)

1. First attempt: the outcome text only ("Reviews are listed under their
   product"), a bare terminal, and the current world state.
2. First miss: a CONCEPT hint ("this is routing work; think about nesting").
3. Second miss: a SHAPE hint ("resources can nest inside resources"), never
   the literal answer.
4. Third miss: the level reference ("Level 6 taught this"), linking back for
   re-study. Consuming this drops the outcome's star.

## Act 1 Boss spec: "First Contract" (implement first)

**Scenario.** A local pottery collective wants a catalog API for their
seller beta by Friday. You have a laptop with mise installed and nothing
else. Deliver the API.

**World state at start:** empty directory. **Target state:** a Rails 8
API-only app with products + nested reviews, serialized responses.

**Outcomes checklist (validated against the simulated world):**

1. Ruby pinned and a Rails 8 API app exists (L1 mise, L2 rails new --api).
2. A Product model with name/description/price exists and is migrated,
   with seed rows visible in the console (L3, L4).
3. Reviews belong to products; deleting a product removes its reviews
   (L5).
4. `/api/products` and nested `/api/products/:id/reviews` routes resolve
   (L6).
5. Controllers return the data with correct status codes, including 404
   handling (L7).
6. Responses are serialized: no timestamps leak anywhere, including on
   POST (L8).

**Simulation model.** Reuse the existing simulated-terminal world from L1-L8
(command recognizers + world-state flags). The boss composes the recognizers
those levels already ship; the new work is the outcome-validator layer
(world-state predicates per outcome) and the boss orchestrator component
(checklist left panel, bare terminal center, world inspector right panel).

**Tests.** Outcome predicates are pure functions over world state: unit-test
each predicate against passing and failing world fixtures; test that every
hint ladder entry exists and that no hint contains the literal command
(answer-leak rule applies to hints).

## Acts 2-7 boss sketches (one line each, to be spec'd when implemented)

- **Act 2 "The Audit":** lock down the open API: auth, ownership, encrypted
  PII, validations, strong params, all verified by firing the act's attack
  probes against the player's build.
- **Act 3 "The Refactor":** a 300-line god controller must become services +
  contracts + query objects with the test suite staying green throughout.
- **Act 4 "Black Friday":** a slow storefront must hit latency targets;
  the boss fires load scenarios and the player picks what to fix from
  evidence (N+1, indexes, caching, pagination) with a query budget.
- **Act 5 "Going Live":** wire uploads, mailers, jobs, payments, and
  webhooks into one purchase flow that survives the act's failure probes
  (duplicate webhook, vendor timeout).
- **Act 6 "On Call":** a week of incidents replayed; the player must
  diagnose from logs/traces and apply the right operational fix under a
  budget (deploys cost time, rollbacks are cheap).
- **Act 7 "The Architecture Review":** defend scaling decisions against a
  hostile review: every choice (shard vs cache vs extract) must cite the
  evidence probes revealed.

## Non-goals

- No time pressure mechanics (recall under stress is not the goal; recall is).
- No boss-only APIs or fictional infrastructure.
- No grading prose answers with heuristics; every outcome is a world-state
  predicate.

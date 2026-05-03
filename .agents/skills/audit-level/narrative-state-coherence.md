# Narrative-state coherence

A level's trigger / scenario / probe stories must not narrate from a future state of the app. If a level says "an audit flagged…" but at that level the app hasn't shipped, has no users, has no auditors — the framing is **time-traveling**. Fix the framing, not the lesson.

The lesson can stay the same; only the framing changes. If a level needs a "production fire drill" framing for the lesson to land, the lesson belongs in a later act after the curriculum has actually established production.

This rule is referenced from both `audit-level/SKILL.md` (Phase 0b narrative consistency, Question 6) and `design-level/SKILL.md` (Step 1 narrative reasoning, Question 3).

## The forbidden-tropes table

Use this table to check whether the framing is internally consistent with where the curriculum is at level N.

| Curriculum state at level N | Allowed framings | Forbidden framings |
|------------------------------|-----------------|--------------------|
| Pre-deploy (anything before L49 Kamal) | "Before launch", "pre-launch security review", "during code review", "demo to the team", "we're about to ship" | "Production incident", "customer complaint", "support ticket", "an audit flagged", "users are reporting", "PagerDuty fired" — there are no users yet |
| No users yet (anything before signups exist in the curriculum) | "Pre-launch", "we're about to ship and noticed", "imagine when users sign up" | "100K users", "a customer says", "our power users", "our enterprise tier" |
| No payments yet (before L38 Stripe) | "We plan to charge soon", "before we wire payments" | "Refund failed", "chargeback came in", "payment processor outage" |
| No real production data (before L52 Sharding / L51 read replicas) | "Imagine this at scale", "if we had 10× traffic", "local benchmark shows" | "Our prod DB is at 95% CPU", "the read replica is lagging", "our DBA paged us" |
| No API versioning yet (before L48 API Versioning) | "/products" or the routing as established in L6 | "v2 endpoint", "deprecate v1", "version skew" — versioning isn't a concept yet |

## Case studies

### L10 Encryption (fixed 2026-05-03)

```
BAD  (trigger pre-fix):   "GDPR audit flagged: user PII (emails, phone
                            numbers, addresses) is stored in plaintext."
                            ↑ At L10 we haven't shipped (Kamal is L49),
                              have no users (auth was just added in L9),
                              and have no audit relationships. The audit
                              cannot exist.

GOOD (trigger post-fix):  "Pre-launch security review: every PII column
                            on `users` (email_address, phone, address)
                            is stored as plaintext. Encrypt at rest
                            before the first signup."
                            ↑ Same lesson, framed as a pre-launch
                              review. Internally consistent with
                              curriculum state.
```

## Where to apply this check (every player-visible string)

When auditing a level, scan every one of these surfaces for forbidden tropes:

- `trigger.description`
- `problem.observation` and `problem.rootCause`
- `problem.codeExample` comments (and any string literals inside)
- Scenario `description` and `story` fields (one per stress scenario)
- Probe `responseLines` (especially banner-style text)
- `hint.text`
- `learningContent.goal`
- Code-block comments inside `learningContent.*` sections

A single forbidden trope in any of these breaks the narrative. Fix in place — the lesson does not need to change, only the framing.

## When designing a new level

Apply this check during design (`design-level/SKILL.md` Step 1, Question 3 "How did the player get here?") so the bad framing never lands in the first place. Auditing exists as the safety net, not the primary defense.

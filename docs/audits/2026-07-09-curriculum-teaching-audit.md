# Curriculum Teaching-Quality Audit (all 58 levels)

Date: 2026-07-09. Method: 19 parallel read-only audit agents, 2-4 levels each, grading against a learner-perception rubric distilled from the audit-level skill (smell test, damage-first, foundation gaps, jargon, probe quality, answer leaks, step lessons, reward honesty, concept depth). Every agent read the full component + content source. Grades: A = teaches memorably, learner could re-explain; B = solid with friction; C = completable but shallow; D = confusing or misleading; F = does not teach.

## Grade summary

| Act | Grades |
|-----|--------|
| 1 Foundation | L1 B, L2 B-, L3 B-, L4 B, L5 B, L6 B, L7 B, L8 **C** |
| 2 Security | L9 B, L10 B, L11 B, L12 B, L13 B, L14 **A** |
| 3 Architecture | L15 B, L16 **C**, L17 **C**, L18 B, L19 **C**, L20 B |
| 4 Performance | L21 B, L22 **C**, L23 B, L24 B, L25 **C**, L26 **C**, L27 B, L28 B, L29 **D** |
| 5 Advanced | L30 B, L31 B, L32 B, L33 B, L34 B, L35 **C**, L36 **A**, L37 B, L38 **A**, L39 **A** |
| 6 Operations | L40 **C**, L41 **C**, L42 B, L43 B, L44 **C**, L45 **C**, L46 B, L47 **C**, L48 **D**, L49 **A**, L50 B |
| 7 Scale | L51 B, L52 B, L53 **C**, L54 B, L55 **D**, L56 B, L57 **C**, L58 **C** |

Distribution: 5 A, 34 B, 16 C, 3 D, 0 F. The correlation is unmistakable: every A (L14, L36, L38, L39, L49) is a level that went through the modern design/audit pipeline; every D (L29, L48, L55) is an untouched legacy level.

## P0: broken teaching (fix before anything else)

1. **L48 API Versioning is uncompletable.** `handleOptionSelect` maps options to steps 2-5 while the render maps 3-6 (Level48APIVersioning.tsx:1648-1653 vs 1776-1781): step 6 clicks do nothing, steps 3-5 wrong answers give no feedback. Also step descriptions off-by-one. The render smoke test cannot catch this class; only a full playthrough would.
2. **L29 HTTP Caching teaches an invalid header.** `s-max-age` (correct: `s-maxage`) is the CORRECT answer in 5+ places; reward shows "CDN Edge: HIT" though no step builds a CDN; observe pre-shows placeholder CDN/HTTP-Cache nodes.
3. **L25 Counter Caches contradicts itself on its core API.** learningContent: "`product.reviews.count` reads the column. Zero queries!" vs the level's own step 4 and blocked scenario: ".count ALWAYS runs SQL". One of these is what the learner remembers.
4. **L22 Eager Loading answers its central question three contradictory ways.** Observe lane + inspector + whenToUse say `eager_load` is for filtering; build step 2 marks `eager_load` wrong and `includes` correct. Plus player-visible typo `eager_load(c: :user)`.
5. **L33 Locking ships broken Ruby as the correct answer.** `@quantity = amount` (undefined variable) in the correct option and all previews; contract requires `:amount` but service passes `quantity:`; reward animation ("COMMIT! 5-3=2") contradicts its own terminal ("5-8 = insufficient!").
6. **L41 CORS visuals teach the #1 CORS misconception.** API zone shows "not reached" and reward shows rack-cors "rejecting" evil.com; in reality the request reaches Rails and the BROWSER discards the response, which the level's own curl probe correctly explains. Visual contradicts text on the core mechanism.
7. **L55 Modular Monolith shows Packwerk as a runtime firewall.** Reward animates requests "BLOCKED" mid-flight; Packwerk is CI-time static analysis (its own learningContent says so). Observe also runs `bin/packwerk check` before the gem is installed.
8. **L57 API Gateway contradicts the capstone's world.** Observe presumes billing/analytics running as separate services on ports 3001-3003; L55 ends at a modular monolith and L58's entire premise is that billing has NEVER been extracted. One premise must change.
9. **L35 Action Mailer:** answer chips (`generates_token_for`, `deliver_later`) rendered on-screen during the build; async delivery asserted one level before workers exist (L36's whole lesson).
10. **L8 Serializers reward is untrue.** Final controller keeps `render json: product` in create/update yet reward claims timestamps no longer leak on POST/PATCH.

**Borderline P0 (single-probe factual errors, each contradicting the curriculum's own teaching):** L43 (`add_column default` shown rewriting 5M rows; instant on PG 11+, admitted by its own content), L45 (primary-key lookup shown as a 4.1s seq scan), L51 ("SELECTs hold shared locks blocking the write"; MVCC says otherwise, per its own content), L54 (AASM shown blocking `update_all`/direct column writes; it doesn't, per its own commonMistakes).

## Systemic failure classes (fix by class, not by level)

1. **Answer leaks (the epidemic, ~2/3 of levels).** Vectors, most to least common: (a) wrong-option FEEDBACK naming the correct answer's token (L12 URI::MailTo, L21, L30, L45, L51, L53, L56, L57...); (b) left-panel scenario text during build naming the gem/pattern ("Extract into a service object with a Result type" while step 0 asks exactly that: L11, L16, L17, L19, L31, L37, L55); (c) persistent right-panel "Key Concepts"/API cheatsheets listing every correct answer during the build (L23, L25, L26, L28, L29 — Act 4's signature failure); (d) content `problem.goal`/`codeExample` naming step answers (L20, L27, L42, L44, L48); (e) observe code-preview comments naming the answer API (L10, L35, L43); (f) StageInspector showing the literal solution code pre-build (L13's params.expect). NOTE: agent flags on `homework`/`furtherReading` are false positives; those render only on the post-completion screen.
2. **Reward dishonesty (~10 levels).** Rewards claiming outcomes the built code does not produce: L8 (timestamps), L21 ("eager loaded" badge when only detection was built), L27 (blocked scenarios the before-state also handled), L34 (validation at presign time that actually happens at attach), L46 ("clean 404" from monitoring), L52 (NoTenantSet without require_tenant), L54 (AASM), L55 (runtime blocking), L58 (tenant isolation never built).
3. **Factual errors taught as correct (~10 levels).** All in legacy levels predating the doc-verification rule: see P0 list plus L28 ("Rails defaults to :null_store"; Rails 8 ships Solid Cache), L40 (builds X-Request-Id that `ActionDispatch::RequestId` already provides), L47 ("/up returns 404. No health endpoint exists"; Rails 8 ships /up).
4. **Dead duplicate scenario buttons (L37, L38, L50, L51, L57).** Stress scenarios duplicated (likely to satisfy the probes-are-subset-of-scenarios test) with no reward-frame entries, so firing them animates nothing.
5. **Identical probe animations (L6, L7, L13, L26, L28, L36 pairs).** Multiple probes producing the same visual state; each probe should teach a distinct facet.
6. **Placeholder future-concept nodes in observe (L5, L20, L28, L29, L41, L47).** "CORS Middleware (not installed)", "Error Handler (missing!)", dashed cache nodes: violates show-only-what-exists and telegraphs the fix.
7. **E-commerce reframe residue (L30, L32, L33).** Photo/Video vs ProductImage/ProductVideo, `BoostPost`/`postId` inside `boost_product.rb`, a leftover bank-transfer scenario.
8. **Two-option coin-flip steps (L2, L3, L4, L30, L34)** and hand-positioned answers without shuffleOptions in Act 1.
9. **Cross-level contradictions.** L6 reward claims the controller exists and returns 200; L7's premise is that it doesn't. L40 builds a bot blocker its own learning panel calls a trap and L42 supersedes, unreconciled. L50 claims 30-minute rollback one level after L49 demonstrated 2.1s `kamal rollback` (needs one explaining sentence). L44/L45 re-teach the same crontab-vs-recurring.yml lesson.

## Per-level findings

The full per-level agent findings (learner verdict, what teaches well, issues with file:line, priority) are preserved in the session transcript of 2026-07-07/09. Highest-value per-level notes not covered above:

- L1: activate-mise step demands shell arcana (PATH/eval/source) beyond a beginner; .mise.toml step is TOML trivia.
- L3: right panel prints the exact generator command while the player works the generator step (code-preview boundary violation); level ends with no payoff row in the DB.
- L5: probe 3 mis-teaches FK placement (inspects products for product_id; the FK lives on reviews); reward scenarios render console commands as HTTP verbs with status codes.
- L7: content references "namespace :api / :v1 from L6" but L6 built only :api (phantom v1).
- L9: scenario paragraph pre-names generator outputs; POST probe returns a record with user_id while claiming no User model exists.
- L10: find_by on a non-deterministic attribute shown returning nil; Rails raises (its own content says so). Deterministic advice contradicts step 3's answer; ENV-vs-credentials advice contradicts step 1.
- L14 (A): only leaks: goal names "request spec"; FactoryBot feedback pinpoints Syntax namespace; steps 0/2 duplicate the --group lesson.
- L16: taught service DROPS the auth token the fat controller used to return (real regression in the "fixed" code); reward is a static poster claiming untested benefits.
- L17: step 1 is a longest-option giveaway; duplication pain asserted, never dramatized as drift.
- L18/L19/L20 share a getCodeFiles off-by-one: right panel empty during step 0 and one step stale after; L19/L20 never show final code in reward (dead >= 3 branches).
- L24 (B, strongest Act 4 level): composite-index column order leaked by schema comments; EXPLAIN cost/width noise undecoded.
- L36/L38/L39 (A's): minor issues only; L39's migration step description demands a unique index its correct command doesn't create.
- L47: observe is artifact boxes ("Structured Logs / Not configured"); "Redis: ok" in a Solid-stack app; Kubernetes/microservices vocabulary in a monolith.
- L49 (A): Docker/registry/container vocabulary un-introduced (first Docker contact in the curriculum).
- L53: probes 2-4 are unexplained DBA artifacts (dead tuples, TX wraparound) with no customer damage; wrong-shard scenario impossible with the deterministic resolver the player built.
- L58: before-state erases the player's own L54/L56 work; steps are recap trivia with pattern names in the feedback; probe/scenario ids don't pair, breaking the replay loop. The finale deserves a full design-level redesign into genuine trade-off decisions.

## Recommended fix order

1. **L48 mapping bug** (uncompletable level; mechanical fix + a regression test; consider a full-playthrough e2e per level long-term).
2. **Factual-error batch** with WebFetch verification per claim: L29 s-maxage, L25 count/size, L33 Ruby, L22 contradiction, L41 mechanism, L55 mechanism, L43/L45/L51/L54 single probes, L28/L40/L47 Rails-8-defaults claims.
3. **L57/L58 world reconciliation** (design decision: gateway fronts the modular monolith's packages, not phantom services).
4. **Answer-leak sweep** by vector: right-panel cheatsheets (Act 4) > build-time left-panel scenario texts > feedback strings (use `bun run report:leaks` plus the quotes above) > content goals > observe comments.
5. **Dead-scenario sweep** (L37/L38/L50/L51/L57) + a per-level test helper asserting every scenario id has a reward-frame entry.
6. **Per-level deep passes** on the C levels through audit-level/design-level, worst first: L58 (finale), L16, L17, L47, L53, L44, L45, L26, L35, L8.

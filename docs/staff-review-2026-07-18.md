# Staff-Level Curriculum Review (2026-07-18)

A full playthrough review of all 58 levels from the perspective of a staff-level Rails engineer, looking for wrong teachings, inconsistencies, and pedagogy failures. Produced by eight parallel review passes (one per act, plus one cross-cutting curriculum pass). Risky API claims were verified against canonical sources before being flagged: Rails source and guides, dry-validation 1.11.1 (executed live), Solid Queue / Solid Cable / Stoplight / Prosopite / Pagy / rack-attack / Kamal / Flipper / acts_as_tenant / AASM / Wisper / Packwerk docs and READMEs.

Severity: **CRITICAL** = teaches something false. **BAD** = misleading or inconsistent. **NIT** = polish.

---

## Verdict

The curriculum's architecture of teaching is genuinely exceptional: modern Rails 8 surface throughout (params.expect, built-in auth, Solid trifecta, Kamal 2), earned abstraction (the inferior form really lives in the codebase for levels at a time), security as reflex, measurement-first performance culture, and a capstone (L58) that teaches exactly the right extraction instincts. Several levels are verified current against gem sources in ways almost no teaching content achieves (L26 Pagy v43, L47 observability, L49 Kamal command surface).

But roughly twenty findings are verified-false teachings, and they cluster in one repeatable failure mode: **whenever a level leaves Rails core for a third-party gem or a database internals claim, the API was written from memory and not checked.** The fix list below is ordered by blast radius.

---

## Systemic themes (fix the pattern, not just the instance)

1. **Third-party APIs written from memory.** Solid Queue gets a uniqueness macro it does not have (L36), Solid Cable gets replay semantics it does not have (L37), Stoplight is taught with a builder API removed two major versions ago (L38), dry-validation's marked-correct composition raises NoMethodError (L18), Flipper's admin mount uses a Devise-only routing helper in a no-Devise app (L50), multi-tenancy ships a Rails API removed in 7.0 (L52), RSpec gets Minitest's `parallelize` (L14).
2. **The built fix would not actually work.** Prosopite never scans (L21), pg_search never touches the GIN index the player spent three steps building (L27), the sharding middleware raises ConnectionNotEstablished in the level's own architecture (L53), Packwerk passes the exact violation the reward shows failing (L55), acts_as_tenant leaks everything on a tenant-less request because `require_tenant` is never configured (L52), the `update_all` exploit survives the AASM fix (L54), L11's final step and 403 machinery are unreachable dead code.
3. **Cumulative-infrastructure amnesia.** L42 ignores L40's bot blocker; L47 rewrites L40's JSON logger into prose to stay motivated; L49 pretends Rails 8 does not ship Kamal from `rails new`; L50's 30-minute-rollback motivation is contradicted by the 2-second `kamal rollback` the player just ran in L49; L25 and L28 run flagrant N+1s past the Prosopite the player deployed in L21; L12 visually un-builds L10's encryption; L22 shows L21's strict_loading commented out.
4. **content.ts and component halves drift.** Both are player-visible and repeatedly contradict each other: L4 (bang vs non-bang), L9 (email vs email_address), L31 (discard default-scope), L38 (ENV vs credentials), L39 (payload vs re-fetch), L48 (`Deprecation: true` is both the documented mistake and the graded-correct answer), L56 (the async answer is opposite between halves).
5. **Benchmark theater (Act 4).** Per-query timings that do not sum to their own totals (30ms of logged queries labeled 850ms; 82ms and 820ms for the same query), book benchmarks transplanted without rescaling. For a performance act, numbers that do not add up are the one unforgivable sin.
6. **Code-preview off-by-one family.** L5, L6, L7, L11, L19, L20: empty right panels on the first build step, previews contradicting the step just completed, and final code gated behind unreachable `furthestStep` values so the player never sees what they built.
7. **Ignoring Rails 8's own defaults.** Observe phases assert absences a stock Rails 8 app does not have: Solid Cache pre-installed (L28), Rack::ETag in the stack (L29), far-future public-file headers (L29), `t.references` indexing FKs by default (L24), Kamal scaffolded by `rails new` (L49).
8. **Answer leaks persist** despite the rule: L3 (type list in preview), L9 (`before_action` named in feedback), L13 (step 0's correct option is step 1's full answer), L42 (both the problem block and feedback), L51, L52.

---

## Priority fix list

**P0: verified-false APIs a player will copy and hit NoMethodError / boot failure**
- L18 dry-validation: `params(A & B & C)` raises; correct is `params(A, B, C)`. Also `super(params)` crashes against L16's ApplicationService.
- L36 Solid Queue: `unique :until_executed` does not exist (that is activejob-uniqueness). Real dedup: `limits_concurrency ... on_conflict: :discard`. Install command is `bin/rails solid_queue:install`, configures production.rb not application.rb.
- L38 Stoplight: builder API (`with_threshold`, `with_cool_off_time`) removed; current is constructor kwargs. Appears across six surfaces including homework.
- L50 Flipper mount: `authenticate :user, ->(u) { u.admin? }` is Devise's routing DSL; raises in this app. Use route constraints with the Rails 8 session.
- L52 multi-tenancy: `connected_to(database:)` removed in Rails 7.0; modern DB-per-tenant is shards. RLS section claims protection that owner-bypass negates without FORCE ROW LEVEL SECURITY; pooled `SET` leaks tenant across requests (needs SET LOCAL).
- L53 sharding: correct answer `ActiveRecord::Base.connected_to(shard:)` switches ALL classes and raises for global models; should be `ShardRecord.connected_to(shard:)` or Rails' native ShardSelector (`config.active_record.shard_selector`). Content's ShardRecord also declares replica configs database.yml never defines (crashes at boot).
- L14 testing: `parallelize(workers:)` does not exist in rspec-rails; also `spring rspec` is stale for Rails 8.
- L49 Kamal: accessory-worker "always at the same SHA" claim is the opposite of documented behavior (accessories are not updated on deploy); the correct pattern is a `job` role under `servers:`.

**P1: false Rails/HTTP/Postgres facts**
- L6: `namespace 'api'` (string) marked wrong; it is valid (`name.to_s` in Mapper).
- L7: missing controller shown as 500; Rails maps it to 404 (RoutingError -> :not_found). Also bare `curl` shown printing headers (needs `-i`); "201 OK"/"204 OK" status lines.
- L10: `find_by` on a non-deterministic encrypted column returns nil, does not raise Errors::Configuration; `save!` on unchanged records is a no-op backfill (correct form: `find_each(&:encrypt)`).
- L24: observe schema shows `t.references ... foreign_key: true` above "No index on user_id!"; t.references indexes by default, so the level's premise is false as displayed. Also bare `algorithm: :concurrently` without `disable_ddl_transaction!` raises.
- L29: ETag taught as body hash AND as skipping serialization (mutually exclusive); stock Rails already ships Rack::ETag + ConditionalGet so the "no ETag" premise is false. The honest lesson is `stale?` short-circuits before serialization.
- L40: ordering-step feedback inverts Rack stack semantics (claims append order runs BotDetector last and logs rejected requests; both false).
- L45: PK lookup and indexed-FK query both animated as 50M-row seq scans; false at any table size and contradicts Act 4's own indexing lessons.
- L46: "RecordNotFound => 500" premise; stock Rails returns 404 via rescue_responses. Step 5's insert_before-0 middleware "catches everything" claim is wrong (ShowExceptions rescues mid-stack) and contradicts step 0's Rails.error.subscribe.
- L43: `add-column-default` probe frames show constant `DEFAULT 0` locking for 30s; instant on PG 11+ per the level's own content (the probe command is correctly about a volatile default; the frames are not).
- L37: Action Cable has no replay/backlog under any adapter; `message_retention` is only a trim cutoff.
- L39: stripe-ruby `construct_event` applies a 300s default tolerance; "verifies forever without it" is fabricated. `skip_before_action :verify_authenticity_token` raises in an API-only controller without `raise: false` (and is moot).
- L17: "the constant lands on Product and Review separately" is false (lexical scoping; verified empirically).
- L21: memory claims transplanted from the book at wrong scale; log lines that sum to ~30ms labeled 850ms (same disease: L25 1,551ms, L24 82ms vs 820ms, L23 several).
- L51: probe frames show SELECTs holding locks that block INSERTs; contradicts the level's own MVCC text.

**P2: the level's own reward/animation contradicts what was built**
- L21 reward shows Prosopite raising; as configured it never scans (needs around_action or middleware per README).
- L27 reward shows Bitmap Heap Scan on the GIN index; without `tsvector_column:` pg_search computes to_tsvector on the fly (seq scan), and the trigger cannot produce the weighted vectors the ranking step claims.
- L28: versioned cache key executes `MAX(updated_at)` on every request ("DB not touched" is false); `race_condition_ttl` provides no stampede protection under key-rotation invalidation.
- L33: shared reward frames mutate the DB to values contradicting each scenario's own terminal output.
- L34: blocked-upload animations validate at presign time; the built code validates at attach time, after the file is on S3.
- L36: the job the player builds is dead code (service uses deliver_later; worker log shows the never-enqueued job performing).
- L52: reward shows NoTenantSet raised; default acts_as_tenant is unscoped without `require_tenant = true`, which no step sets.
- L54: reward swaps the `update_all` exploit (which still works, bypassing AASM) for a method-call exploit that fails.
- L55: reward shows Packwerk failing billing -> ReceiptFormatter; with dependencies declared and no privacy checker installed, `bin/packwerk check` passes it.
- L11: `furthestStep >= 7` branches (policy_scope, rescue_from, full policy) unreachable; reward claims 403s the built code cannot produce (would be 500 without rescue_from).
- L14: the destroy-regression scenario is "caught" by a spec suite containing no destroy example.
- L48: `Deprecation: true` graded correct while the same level documents it as the common mistake (RFC 9745 date string).

**P3: continuity, drift, leaks (sweepable)**
- Cross-level state: L12 un-builds L10/L9 model state; L22 comments out L21's strict_loading; L53 drops L52's acts_as_tenant from Order; L42/L47/L49/L50 amnesia items above.
- Blog/social-era fossils: L27 "Running Tests in RSpec" products, L28 "blog_cache", L32 BoostPost/"post was never boosted", L35 socialplatform.com, L19 by_author/by_tag.
- Answer leaks: L3, L9, L13, L42 (x2), L51, L52.
- Preview off-by-ones: L5, L6, L7, L19, L20 (+ L11 dead branches).
- Missing/fossil tests: L35 and L36 have no real test file; `Level36Encryption.test.ts` mirrors a removed level and passes while testing nothing.
- L58 cross-references swap L52/L53; leans on out-of-process events L56 never built (Wisper is in-process; one honest sentence fixes it).
- L54: Statesman marked wrong although its preview text satisfies the level's stated requirements (audit trail); the modal punishes correct reasoning.
- L45: "Redis with AOF" as an archive tier contradicts the no-Redis Solid stack and is bad advice besides.
- L56: content recommends wisper-sidekiq while the component (correctly) grades listener-to-ActiveJob as the answer; feedback also mischaracterizes wisper-sidekiq as bare threads.

---

## Curriculum-level findings (cross-cutting pass)

- **Recognition vs recall.** Every build step is choose-from-3. The graduate has never typed a migration, spec, or policy cold. docs/boss-levels.md diagnoses this precisely; zero boss levels are implemented. This is the curriculum's biggest known weakness and its fix is already designed.
- **Debugging is never taught.** No level starts from a raw stack trace; probes pre-diagnose everything. No `binding.irb`, no log-reading-when-stuck workflow. The single highest-leverage new level.
- **Ruby-the-language is never taught.** By L16 the player reads `Data.define`; L17 needs module semantics; no rung teaches classes/modules/blocks/symbols. Biggest missing rung for the stated first-timer audience. Git is likewise absent while assumed (L49, L55).
- **The commerce core is never built.** Credits appear at L32, checkout/stock at L33, payments at L37-38, a 50M-row orders table at L45, but no level creates Order/checkout. Act 5 silently resets the domain; needs a checkout level or an explicit time-skip briefing.
- **L2 homework breaks the companion-app chain.** `rails new store_api --api` without `--database=postgresql` lands on SQLite; L21/L24/L27/L51/L53 homework then fails. One flag fixes it.
- **`.claude/skills/audit-level/cumulative-patterns.md` is systematically stale** (old level numbering, pre-reframe examples) while billing itself as the audit ground truth; it will corrupt future audits. docs/content-structure.md and game-mechanics.md still describe the retired 8-act structure.
- **Act 8 is an empty directory.** L58 is the de facto finale (and is strong enough to be).
- **Trigger voice regression in Act 4** (L22/L23/L24 written in game-mechanic voice, not incident voice); L57's spec.md table has drifted from the shipped BFF framing.
- **Graduate overconfidence risks** to keep in mind when prioritizing: cannot debug, greenfield-only reflexes, scale topics look cheap (sharding as a YAML exercise), "tested" means one green request-spec suite, and the React client is a ghost (contract thinking stays theoretical).

---

## Per-act one-line verdicts

- **Act 1:** Workflow-accurate and faithful to real Rails 8.1 output; two false facts at the request-path core (L6 namespace string, L7 404-vs-500) and a broken L6-to-L7 seam.
- **Act 2:** Coherent cumulative security story; the content panels carry three CRITICAL false teachings the components get right, and cross-level state discipline slips (L12 un-builds L10).
- **Act 3:** L15-L17 would pass staff review; L18 needs a wholesale redesign (its correct answer crashes, verified live), L19/L20 need preview and drift fixes.
- **Act 4:** Best interaction design in the game, worst numbers: benchmark theater everywhere, and three levels whose built fix does not work (L21, L27) or whose mechanism is self-contradictory (L29).
- **Act 5:** Strongest Rails-core writing in the game (L32-L34, L39); every third-party gem API in it was written from memory and three are fabricated (L36, L37, L38).
- **Act 6:** Redesigned levels (L41, L47) are excellent; the act's disease is cumulative-infrastructure amnesia plus self-contradicting animations (L43, L46, L48); L49/L50 each carry one copy-pasteable-into-production falsehood.
- **Act 7:** The arc composes (tenancy -> shard key -> packages -> gateway -> extraction) and L55/L57/L58 mostly survive review; accuracy degrades with database depth (L52, L53), and three rewards overclaim what the built system blocks.

---
paths:
  - "**/Level*.tsx"
  - "**/content.ts"
  - "**/data/*.ts"
---

# Rails Principles + Anti-Patterns

The philosophy behind the patterns in `rails-conventions.md`. Adapted from the Rails community / DHH school / staff-engineer-at-scale practice. These principles inform *what to teach* in a level and *what to recognize as a smell* when auditing level content.

When a level proposes a pattern, ask: does it follow these principles? When a level shows a "before" state, does it cleanly demonstrate one of the anti-patterns?

## The Shopify lens (design for billion-dollar scale, on Rails 8)

When stuck on a Rails design choice — which pattern, which gem, which API surface — ask: **"What would Shopify do, on Rails 8?"** (or Stripe, Airbnb, GitHub — any staff-engineer-at-scale Rails shop, running the modern stack). This is the project's primary design lens. The audience is first-time developers, but the patterns the curriculum teaches must be the ones billion-dollar shops actually run in production *today*, not the textbook examples and not the Rails 6 / Rails 7 patterns those shops have since migrated off.

**Rails 8 priority is part of the lens.** Whenever Rails 8 ships a modern alternative to an older pattern, the modern alternative wins. Examples:

- **Strong params**: `params.expect(product: [:name, ...])` over `params.require(:product).permit(:name, ...)` (Rails 8+ shape-aware filtering).
- **Authentication**: `bin/rails generate authentication` (Rails 8 built-in) over Devise. `User.authenticate_by` over manual `find_by + authenticate` (timing-safe, Rails 8+).
- **Background jobs / cache / cable**: Solid Queue, Solid Cache, Solid Cable (Rails 8 defaults) over Sidekiq + Redis / Memcached.
- **Deploy**: Kamal 2 + Thruster (Rails 8 defaults) over Capistrano + nginx.
- **Asset pipeline**: Propshaft (Rails 8 default) over Sprockets.
- **DB**: SQLite with WAL + IMMEDIATE transactions is a viable production default on Rails 8 (per the 8.0 release notes); previously it was a dev-only shortcut.

If a peer billion-dollar Rails shop is still on the older pattern because they're on an older Rails, that's irrelevant — the curriculum teaches Rails 8, so the right reference is "what would they do *if they were starting fresh on Rails 8*?" Whenever a Rails Guides example shows the legacy pattern (the Guides often do, for backward-compat reasons), default to the Rails 8 production-safe variant. See `rails-conventions.md` for the concrete pattern list and `Rails 8 Reference` in `CLAUDE.md` for what's actually new in 8 vs backported from earlier versions.

**Reject weak defenses for design choices.** Arguments of the shape "what if [obvious safeguard] is forgotten?" or "what if [trivial bug] ships?" do not justify design at this scale. Billion-dollar codebases have:
- Test suites that fail when invariants break.
- Lints / static analysis (e.g. Pundit's `after_action :verify_authorized`, RuboCop, Brakeman).
- CI that gates merges.
- Code review by experienced engineers.

Designing for "what if `authorize` is forgotten" is defense against a non-bug — the lint catches it before it ships. Designing for "what if the cache key is wrong" is also a non-bug — that's what test coverage exists for. Use these "what ifs" as a smell test: if your only argument for a pattern is a hypothetical that real engineering practices already catch, your reasoning is too weak. Find a stronger reason or pick the canonical pattern.

**Single source of truth beats redundancy.** A billion-dollar codebase prefers one place for each rule — the policy class for authorization, the validator for data, the migration for schema, the serializer for JSON shape — over distributing the rule across multiple layers "just in case." Distribution makes the rule harder to evolve (admin overrides, support agents, shared resources, multi-tenancy) and harder to test in isolation.

**Case study (2026-05-09, L11 / L13 design):** During the L1-L13 audit fix batch, the simulated L13 `update` finder was changed from `Product.find(params[:id])` (Pundit canonical, single source of truth in the policy class) to `Current.user.products.find(params[:id])` (scoped find that duplicates ownership into the SQL). The justification was "defense-in-depth: 404 even if `authorize` is forgotten." That justification is the smell described above: a billion-dollar Rails shop wouldn't forget `authorize` — Pundit's `verify_authorized` lint plus policy specs catch missing calls before they ship. The "forgotten authorize" hypothetical is a non-bug. Designing the find around it duplicates the rule across find AND policy, weakening single-source-of-truth. The reasoning was reverted: the canonical post-L11 pattern is `Product.find + authorize` (find loads the record; the policy class is the only place ownership rules live).

**The lens at a glance.** When in doubt, ask:
1. What does Shopify (or a peer billion-dollar Rails shop) do here, **on Rails 8**?
2. Where does the rule LIVE — one place, or scattered across layers?
3. Is my justification a real engineering concern, or a hypothetical that lints / specs / CI already catch?
4. Is this the Rails 8 modern API, or am I about to teach a Rails 6 / Rails 7 pattern that a Rails 8 shop has already migrated off?

If (1), (3), and (4) all push toward the same pattern, that's the answer. If they conflict, weight (3) and (4) heavily — design for non-bugs is wasted complexity, and teaching legacy Rails surface contradicts the curriculum's stated audience.

## Principles (what to do)

- **KISS — Keep it boring.** Prefer standard CRUD, conventional routing, fat models with simple predicates. No abstractions until complexity demands them. If a junior developer can't understand the level's correct answer in 30 seconds, the level is teaching the wrong thing.

- **DRY is about knowledge, not code.** Every piece of *knowledge* (a business rule, a calculation, a policy) has one authoritative representation. But three similar lines of code are better than a premature abstraction. Duplicate code is cheaper than the wrong abstraction.

- **YAGNI — Implement only what's currently required.** Don't add configuration options, feature flags, or patterns for hypothetical future needs. A level should teach the simplest pattern that solves *this* level's problem. Save advanced variants for later levels where they're earned.

- **SRP — Each class has one reason to change.** Models persist data and enforce invariants. Services orchestrate business logic. Controllers handle HTTP. Views render markup. Mailers compose emails. When one class spans multiple reasons-to-change, it's about to become unmaintainable.

- **Skinny Everything.**
  - **Controllers** orchestrate: parse params, delegate to services or models, render responses. No business logic.
  - **Models** persist: validations, associations, scopes, simple predicates (`def listed?; status == "listed"; end`). No side effects.
  - **Services** contain business logic that touches multiple records or external systems.
  - **Views** display markup with minimal logic — no loops over complex domain objects, no DB queries, no service calls.

- **Composition over inheritance.** Favor modules, concerns, and delegation over deep class hierarchies. STI is a trap for "inherited entities that share 80% of columns" — when subtype-specific columns dominate, polymorphic associations or `delegated_type` are the right answer.

- **Dependency injection for testability.** Pass collaborators in via constructors / method args. High-level business logic should not new-up its low-level collaborators (HTTP clients, mailers, external APIs). The point is testability without monkey-patching.

- **Callbacks: normalization only.**
  - **OK in callbacks**: `before_validation :strip_whitespace`, `before_save :downcase_email`, `after_initialize :set_default_status`.
  - **NEVER in callbacks**: emails, API calls, job enqueues, creating related records. These are *contextual* side effects — they depend on *why* the record is being saved, not the fact that it's being saved.
  - Side effects in callbacks make the model untestable, make seed data send real emails, and make every code path that creates the record share the same baggage.

- **No premature abstraction.** Don't create `BaseService`, `ApplicationQuery`, or shared concerns until you have 5+ concrete implementations with identical structure. Abstraction is cheaper than wrong abstraction; wrong abstraction is among the most expensive mistakes in code.

- **Explicit over implicit.** Clear code wins over magic. Explicit service calls beat hidden callbacks. Named methods beat metaprogramming. `current_user.products.create!(...)` is better than `Product.create!(...)` with a `before_validation :set_user`. The implicit version saves three keystrokes and costs an hour the next time someone debugs why a product has the wrong owner.

## Anti-patterns (what to avoid)

- **God Model.** A model with >200 lines of methods is a service object in disguise, suffocating inside an `ActiveRecord::Base` subclass. Extract business logic to services (`app/services/`), complex queries to query objects (`app/queries/`). The model keeps persistence, validations, associations, and simple scopes.

- **Service Graveyard.** The opposite mistake. Wrapping `user.update!(name: params[:name])` in `UpdateUserService.call(user, params)` is ceremony for nothing. The bar for extraction is *real* complexity — multi-record orchestration, external API calls, transactional invariants. Trivial CRUD doesn't need a service.

- **Callback Spaghetti.** Chains of `after_create :send_welcome` → `after_save :sync_external_profile` → `after_commit :enqueue_setup`. Each one is a side effect masquerading as a lifecycle hook. Together they make the model impossible to test, impossible to debug, and impossible to disable for seeds. Replace with explicit service calls in the controller or the calling context.

- **STI Abuse.** Single-Table Inheritance works when subtypes share 90% of columns (`Vehicle` → `Car`, `Truck`, both share `model`, `year`, `vin`). It breaks when more than 20% of columns are subtype-specific (lots of `NULL`s in the table). At that threshold, polymorphic associations or `delegated_type` is the right tool.

- **N+1 Ignorance.** Lazy-loading associations in serializers and view loops is the most common Rails performance bug. Always eager-load associations you know you'll access (`includes(:user)`, `includes(reviews: :user)`). In test environments, `strict_loading_by_default = true` catches lazy loads at test time before they ship.

- **Kitchen Sink Concern.** A concern (`SoftDeletable`, `Sluggable`) should be narrow and focused. If it exceeds ~30 lines or has multiple responsibilities, it's a service object hiding behind a `ActiveSupport::Concern` `extend`. Extract or split.

- **Service Object Returning Booleans.** `def call; ...; true; end` loses every signal. Wrap in a `Result = Data.define(:success?, :user, :errors)` so the caller can branch on success, surface error details to the frontend, and write the same error-handling code regardless of which service it called. Booleans throw away too much information at the seam.

- **Validation in the Controller.** `if params[:email].blank? then render json: { error: "..." }; return; end`. The controller is now duplicating what the model already does (or should do). Validations live on the model. The controller catches the validation failure (`ActiveRecord::RecordInvalid`) and renders the error.

- **Magic environment-aware code.** `if Rails.env.production? then ... end` scattered through business logic. Configuration belongs in `config/environments/*.rb` or `Rails.application.config.x.feature_flag`. Reading `Rails.env` outside of bootstrapping is almost always a smell.

- **Not running the worker in production.** Calling `perform_later` puts a row in a database table. Without a `bin/jobs` worker process running (Procfile entry, systemd unit, Kamal accessory), the job sits there forever and nothing happens. Symptom: registration succeeds, welcome email never arrives. The most common Rails 8 background-jobs bug.

- **Static cache keys.** `Rails.cache.fetch("trending_products", expires_in: 5.minutes)` paired with `belongs_to :product, touch: true` is theater. The static key never changes, so `touch` does nothing. The cache only refreshes on the timer. See `rails-conventions.md` for the versioned-key fix.

## How to use this file

When auditing a level component:
- Does the level's "before" state cleanly show one of the anti-patterns above? Anti-patterns are great teaching surfaces — they motivate the correct solution.
- Does the level's "after" state honor the principles? If the correct OptionCard answer is a service object wrapping `user.update!(...)`, the level is teaching the Service Graveyard anti-pattern as if it were the answer.
- Is there callback spaghetti in the code preview? If yes, fix it before shipping the level.

When proposing a new pattern in a level:
- Run the proposal against the principles. Is this the simplest thing that teaches the concept? Are we extracting prematurely? Is the side effect in the right layer (service, not callback)?
- Cross-check with `rails-conventions.md` for the syntax-level production-safe default.

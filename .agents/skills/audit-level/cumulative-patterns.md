# Cumulative Patterns Reference (Non-Negotiable)

**Every level's code previews, build steps, and generated code must be consistent with patterns established in earlier levels.** This file is the single source of truth for what has been taught and when. If a pattern was introduced in Level N, every level from N+1 onward must use it in any code that touches that domain.

Before auditing or building any level, read this file and check: "Does the code I'm writing use every applicable pattern from earlier levels?"

**Keep this file up to date.** Whenever you create, redesign, or modify a level that introduces a new pattern, gem, or architectural convention, update this file immediately. If a level's patterns change (e.g., a step is rewritten, a gem is swapped), update the corresponding entry here. This file must always reflect the current state of what has been taught.

---

## Act 1: Foundation (L1-L8)

### L2: Rails 8 API-Only App
- **Pattern**: `rails new app_name --api --database=postgresql`
- **Applies to**: All code assumes API-only mode (no views, no Turbo)

### L6: RESTful Routes with API Namespace
- **Pattern**: `namespace :api do; resources :products; end` → `/api/products`
- **Applies to**: All controller paths use `Api::` prefix from this point on. **Versioning is NOT introduced here** — that's L48's lesson. Pre-baking `namespace :v1` would steal from L48.

### L6: Controller JSON Rendering
- **Pattern**: `render json: @posts` for responses, `params.require(:post).permit(:title, :body)` for input
- **Applies to**: All controllers render JSON

### L7: Serializers (jsonapi-serializer gem)
- **Pattern**: `ProductSerializer`, `has_many :reviews`, `attributes :title, :body`
- **Applies to**: All JSON responses should reference serializers where applicable

### L8: Associations
- **Pattern**: `has_many :reviews, dependent: :destroy`, `belongs_to :post`
- **Applies to**: All model code should reflect established associations

---

## Act 2: Guards & Gates (L9-L15)

### L9: Authentication (Rails 8 built-in)
- **Pattern**: `has_secure_password`, `authenticate_by(email:)`, `Current.user` for request context
- **Applies to**: Any code showing authentication or current user access

### L10: Model Validations
- **Pattern**: `validates :email, presence: true, uniqueness: true`
- **Applies to**: All models should have appropriate validations

### L11: Normalization
- **Pattern**: `normalizes :email, with: ->(e) { e.strip.downcase }`
- **Applies to**: Any model with user-input string fields

### L12: Authorization (Pundit gem)
- **Pattern**: `include Pundit`, `authorize @post`, policy objects in `app/policies/`
- **Applies to**: Any controller action that needs access control

### L13: Testing (RSpec + FactoryBot)
- **Pattern**: `bundle add rspec-rails factory_bot_rails`, request specs
- **Applies to**: Test files should use RSpec from this point on

### L14: Strong Params (Rails 8)
- **Pattern**: `params.expect(post: [:title, :body])` (Rails 8 strict params)
- **Applies to**: All controller params filtering

### L15: CORS (rack-cors gem)
- **Pattern**: `config/initializers/cors.rb` with allowed origins
- **Applies to**: API configuration

---

## Act 3: Clean Architecture (L16-L22) -- CRITICAL PATTERNS

### L16: Service Objects (Non-Negotiable from L17+)
- **Base class**: `ApplicationService` with `self.call(...)` delegating to `new(...).call`
- **Result pattern**: `Result = Data.define(:success?, :resource, :errors)` for immutable return values
- **Controller delegation**: Controllers call `ServiceName.call(args)`, never do business logic directly
- **Applies to**: **Every level from L17 onward.** Any code preview showing a controller must show it delegating to a service object. Any "wire the controller" build step must test the service object pattern. The observe phase "before" code must also use services (showing the problem is in the service, not in controller structure).

```ruby
# The pattern (L16+)
class PostSearch < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def initialize(query:)
    @query = query
  end

  def call
    # validation, business logic, return Result
  end
end

# Controller (thin, delegates to service)
# Pre-L48: `Api::PostsController`. Post-L48: `Api::V1::PostsController`.
class Api::PostsController < ApplicationController
  def index
    result = PostSearch.call(query: params[:q])
    if result.success?
      render json: result.posts
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end
end
```

### L17: Concerns & Modules (ActiveSupport::Concern)
- **Pattern**: `module Taggable; extend ActiveSupport::Concern; included do; has_many :tags; end; end`
- **Applies to**: Shared model behavior should use concerns

### L18: Validation Contracts (dry-validation gem) (Non-Negotiable from L19+)
- **Schema definition**: `Dry::Schema.Params { required(:field).filled(:string) }`
- **Schema composition**: `UserSchema & ProfileSchema` (composable via `&`)
- **Contract class**: `class MyContract < Dry::Validation::Contract; params(Schema); rule(:field) { ... }; end`
- **Usage in services**: `validation = MyContract.new.call(params); return failure if validation.failure?`
- **Error extraction**: `validation.errors.to_h` for structured field errors
- **Applies to**: **Every level from L19 onward.** Any service that validates input must use a `Dry::Validation::Contract`, not inline `if param.blank?` checks. The contract file lives in `app/contracts/`. Services call the contract at the top of `#call` and return early on failure.

```ruby
# The pattern (L18+)
class SearchContract < Dry::Validation::Contract
  params do
    required(:query).filled(:string)
  end
end

# Used in service
def call
  validation = SearchContract.new.call(query: @query)
  if validation.failure?
    return Result.new(success?: false, posts: [], errors: validation.errors.to_h)
  end
  # ... business logic
end
```

### L19: Query Objects
- **Pattern**: `class ProductQuery; def initialize(relation = Product.all); end; def published; @relation.where(...); self; end; end`
- **Chainable**: Methods return `self` for composability
- **Applies to**: Complex query logic should be extracted to query objects, not inlined in services/controllers

### L20: Error Handling (rescue_from)
- **Pattern**: `rescue_from ActiveRecord::RecordNotFound` in `ApplicationController`
- **Error shape**: `{ error: { code: "NOT_FOUND", message: "...", details: {} } }`
- **Applies to**: All controller error responses should follow this consistent shape

### L21: Action Mailer
- **Pattern**: `generates_token_for(:password_reset)` for secure tokens
- **Applies to**: Token generation for any secure flow

### L22: Background Jobs (Solid Queue)
- **Pattern**: `class MyJob < ApplicationJob; queue_as :default; end`, Solid Queue adapter
- **Applies to**: Any async work should use ActiveJob with Solid Queue

---

## Act 4: Performance (L23-L31)

### L23: N+1 Detection (Prosopite gem)
- **Pattern**: `include Prosopite::Detectors`, `strict_loading_by_default = true`

### L24: Eager Loading
- **Pattern**: `Product.includes(:reviews)`, `preload(:categories)`, `eager_load(:user)`
- **Applies to**: All queries with associations should eager load

### L26: Database Indexing
- **Pattern**: `add_index :posts, :author_id`, composite indexes, EXPLAIN plans
- **Applies to**: Migrations should include appropriate indexes

### L27: Counter Caches
- **Pattern**: `belongs_to :post, counter_cache: true`, migration adding `comments_count` column
- **Applies to**: Frequently-counted relationships should use counter caches

### L28: Pagination (Pagy gem)
- **Pattern**: `include Pagy::Backend`, `pagy(Product.all, items: 20)`, RFC 5988 Link headers
- **Applies to**: Any endpoint returning collections should be paginated

### L29: Full-Text Search (pg_search gem)
- **Pattern**: `include PgSearch::Model`, `pg_search_scope :search, against: { title: 'A', body: 'B' }`
- **GIN index**: `add_index :posts, :searchable, using: :gin`

### L30: Caching (Solid Cache)
- **Pattern**: `Rails.cache.fetch("key", expires_in: 1.hour) { ... }`, Solid Cache adapter

---

## Act 5: Production (L32-L39)

### L32: Polymorphic Associations
- **Pattern**: `has_many :reviews, as: :commentable`, `polymorphic: true`

### L33: Transactions (Atomicity)
- **Pattern**: `ActiveRecord::Base.transaction { ... }`, `raise ActiveRecord::Rollback`
- **Domain**: Boost a post (User credits, Boost, CreditLog). Three-step operation wrapped in a transaction for atomicity.
- **Applies to**: Any multi-step database operation that must be all-or-nothing

### L34: Locking (Concurrency Control)
- **Pattern**: `Account.lock.find(id)` (pessimistic, SELECT ... FOR UPDATE), `lock_version:integer` column (optimistic), `ActiveRecord::StaleObjectError` handling
- **Applies to**: Any concurrent access to shared mutable data (financial balances, inventory counts, profile edits)

### L35: Active Storage
- **Pattern**: `has_one_attached :avatar`, `has_many_attached :images`, direct upload to S3

### L36: Real-Time (Solid Cable)
- **Pattern**: Action Cable channels, `broadcast_to(@post, action: :updated)`

---

## Cumulative Infrastructure (Not Just Code Patterns)

Patterns above track code conventions (service objects, contracts, serializers). But players also BUILD infrastructure that persists across all future levels. If a level's "before state" ignores infrastructure the player already built, it contradicts their experience.

**Infrastructure is cumulative the same way patterns are.** Once the player builds structured logging in L41, every future level's "before state" includes structured logging. A level cannot say "errors go to stdout with no logging" if L41 already added a RequestLogger middleware.

### L22+: Background Jobs (Solid Queue)
- **Infrastructure**: `ApplicationJob`, `perform_later`, Solid Queue processing
- **Applies to**: Any level mentioning async work must acknowledge Solid Queue exists

### L37+: Real-Time (Action Cable)
- **Infrastructure**: WebSocket channels, `broadcast_to`, Solid Cable
- **Applies to**: Any level mentioning push notifications must acknowledge Action Cable exists

### L38+: Resilient HTTP Clients (Faraday + Stoplight)
- **Infrastructure**: Timeouts, retries, circuit breakers on outbound API calls
- **Applies to**: Any level calling external APIs must show resilient clients, not raw HTTP

### L39+: Webhook Handler (Signature + Dedup + Async)
- **Infrastructure**: WebhookEvent table, HMAC verification, idempotency
- **Applies to**: Any level receiving webhooks must show the secure handler

### L48+: API Versioning (v1 + v2 Namespaces)
- **Pre-L48**: routes are `namespace :api do; resources :products; end` → `/api/products`. Controllers are `Api::ProductsController`. **No version segment.**
- **Post-L48**: routes wrap in `namespace :v1 do ... end` and add `namespace :v2 do ... end`. Controllers become `Api::V1::ProductsController` / `Api::V2::ProductsController`. Deprecation/Sunset headers ship with v1.
- **Applies to**: Any level showing routes or controllers must use the form for the level it's at: pre-L48 → un-versioned, L48+ → versioned.

### L41+: Middleware Stack (Request ID, Logger, Bot Detection)
- **Infrastructure**: RequestIdTracker, RequestLogger (structured JSON), BotDetector middleware
- **Applies to**: Any level mentioning logging, request tracing, or bot traffic must acknowledge these exist

### L42+: Rate Limiting (Rails 8 rate_limit + Rack::Attack)
- **Infrastructure**: Per-IP throttling, login rate limit, safelist, 429 responses
- **Applies to**: Any level mentioning API abuse or brute force must acknowledge rate limiting exists

### L43+: Soft Deletes + Audit Trails (Discard + PaperTrail)
- **Infrastructure**: `discarded_at` column, `has_paper_trail`, version history
- **Applies to**: Any level mentioning deletions must use `discard` not `destroy`

### L44+: Safe Migrations (strong_migrations)
- **Infrastructure**: strong_migrations gem blocking unsafe patterns
- **Applies to**: Any level with migrations must follow safe migration patterns

### L45+: Recurring Jobs (Solid Queue recurring.yml)
- **Infrastructure**: Scheduled cleanup jobs, config/recurring.yml
- **Applies to**: Any level mentioning scheduled tasks must reference Solid Queue recurring

---

## How to Use This File During Audits

When auditing Level N:

1. **Find all patterns from levels < N** that are relevant to the code being shown
2. **Find all infrastructure from levels < N** that the "before state" should reference
3. **Check every code preview** (observe phase "before" code, build step previews, reward phase "after" code) against these patterns
4. **Check every probe story and scenario text** against infrastructure - if the level claims something does not exist but an earlier level built it, that is a contradiction
5. **Flag any violation** where code uses an older/simpler approach when a newer pattern has been established

**Common violations to watch for:**
- Controller doing business logic directly (should use service object, L16+)
- Inline `if param.blank?` validation in a service (should use Dry::Validation contract, L18+)
- Raw `Product.where(...)` in a controller (should be in a service or query object, L16+/L19+)
- Manual SQL in service when a gem scope exists (use the scope through the service)
- Missing `ApplicationService` inheritance
- Missing `Result = Data.define(...)` return type
- Controller not using `ServiceName.call(...)` pattern
- No contract file shown when service validates input
- "Before state" claims infrastructure does not exist when an earlier level built it (e.g., "no logging" after L41 added RequestLogger)
- "Before state" ignores gems/tools from earlier levels in the same act

---

## The earned-abstraction rule (don't pre-bake what a later level teaches)

The mirror image of the cumulative-patterns rule: **a level cannot use a structure that a LATER level is supposed to introduce.** Pre-baking the abstraction steals the lesson from the level that owns it.

The shape of the bug:
1. Level X is supposed to *introduce* a concept (versioning, soft deletes, query objects, the `Result` pattern, …).
2. An earlier level Y already uses that concept "for completeness" or "to match best practice."
3. By the time the player reaches level X, they've been working with the concept for N levels. The "before" state at X already has it. The "introduction" lesson is empty.

The rule: **for every architectural concept, the level that introduces it owns its appearance. No earlier level uses it. No earlier level mentions it as established convention.**

This rule is the *forward* version of the cumulative-patterns rule:
- Cumulative-patterns (looking backward): "level N must use everything earlier levels established."
- Earned-abstraction (looking forward): "level N must NOT use anything later levels are supposed to establish."

Both rules together define the curriculum's accumulated state at level N: exactly what was earned by level N-1, no more, no less.

### Common shapes of this bug

The earned-abstraction violation manifests on different surfaces. Each case study below illustrates a different shape; auditing requires checking all of them.

| Shape | Where it hides | Symptom |
|-------|----------------|---------|
| **Structural infrastructure** | Routes, URL paths, namespaces, controller class names | The curriculum's URL/file shape pre-bakes a later concept (versioning, multi-tenancy) |
| **Architectural patterns** | Build-step correct answers, code previews | A level's "correct" code uses a service object, contract, or query object before that pattern is introduced |
| **Concrete API references** | Code examples in observe/build/reward, build-step labels, scenario stories | Code shown to the player calls a Mailer, Job, Channel, or other framework class from a later level |
| **Test echo** | `learningContent` testing sections | A testing level teaches matchers (`have_enqueued_job`) for features that haven't been introduced yet |
| **Reuse-context examples** | "Reuse in X" sections of conceptExplanation | A code example shows the new pattern reused inside a class type the player doesn't have yet |

### Case studies

#### L6 / L48: structural infrastructure (fixed 2026-05-03)

```
BAD  (pre-fix):  L6 (Routes) introduced
                   namespace :api do
                     namespace :v1 do
                       resources :products
                     end
                   end
                 → /api/v1/products from day one.
                 L7-L47 used /api/v1/products everywhere.
                 ↑ L48 (API Versioning) is supposed to TEACH versioning,
                   but the player has been on /api/v1/* paths for 41 levels.
                   The "before" state in L48 was a contradiction:
                   problem code showed Api::OrdersController (no version),
                   but the rest of the curriculum showed Api::V1::*. L48's
                   step 1 (`wrong-single-namespace` foil) presented the
                   player's own state as the wrong answer.

GOOD (post-fix): L6 introduces just `namespace :api do; resources :products`
                 → /api/products. No versioning.
                 L7-L47 use /api/products.
                 L48's "before" state IS /api/products. Build phase wraps
                 in `namespace :v1 do` (refactor) and adds `namespace :v2`
                 (evolution). Versioning is earned at L48.
```

#### L10: architectural patterns (fixed 2026-05-03)

```
BAD  (pre-fix):  L10 (Encryption) Step 4 "Update Lookup Service" taught
                   class FindUser < ApplicationService
                     Result = Data.define(:success?, :user, :errors)
                     def call
                       v = FindUserContract.new.call(email: @email)
                       ...
                       user = User.find_by(email: @email)
                       Result.new(success?: true, user:, errors: [])
                     end
                   end
                 ↑ ApplicationService + Result are L16 (Service Objects).
                   Dry::Validation::Contract is L18 (Validation Contracts).
                   At L10 the player has none of these. L16 and L18's
                   own teaching surface is empty by the time the player
                   gets there.

GOOD (post-fix): Step 4 dropped entirely. L10's lesson (encrypts +
                 deterministic) doesn't need a service step. The
                 "queries still work" insight is folded into Step 2:
                 deterministic mode means User.find_by(email:) just
                 works. No service-layer change.
```

#### L15: concrete API references (fixed 2026-05-03)

```
BAD  (pre-fix):  L15 (Callbacks) taught "side effects belong in the
                 controller, not the callback" using these examples:
                   UserMailer.welcome(@user).deliver_later        # L35
                   AccountingSyncJob.perform_later(@product.id)   # L36
                 References across 6 files: code-files, content,
                 build-steps, stress-scenarios, pipeline-stages, probes.
                 Player has zero context for `UserMailer`, `.deliver_later`,
                 `ApplicationJob`, or `.perform_later` at L15.

GOOD (post-fix): Replaced with method-call abstractions:
                   send_welcome_email(@user)
                   sync_to_accounting(@product.id)
                 Lesson stays intact: side effects belong in the
                 controller. Whether the side effect is a mailer (L35)
                 or a job (L36) is implementation detail the player
                 will wire up later. The level's content explicitly
                 says so: "you'll wire up [the implementation] in
                 later levels."
```

#### L14: test echo (fixed 2026-05-03)

```
BAD  (pre-fix):  L14 (Testing) had a full "Background jobs
                 (`perform_enqueued_jobs`, `have_enqueued_job`)" section
                 in learningContent.conceptExplanation, plus a
                 commonMistakes bullet about deliver_now/perform_now.
                 Background jobs are L36; mailers L35. L14 was teaching
                 how to test patterns the player wouldn't see for 22 more
                 levels.

GOOD (post-fix): Section dropped. Common-mistake bullet removed. The
                 sleep-in-spec mistake generalized from "missing
                 have_enqueued_job" to "missing async-wait helper."
                 L36 will own the job-testing patterns when it teaches jobs.
```

#### L19: reuse-context examples (fixed 2026-05-03)

```
BAD  (pre-fix):  L19 (Query Objects) had a section showing reuse:
                   # Reuse in background job:
                   class CsvExportJob < ApplicationJob
                     def perform(filters)
                       products = ProductQuery.new...
                     end
                   end
                 ApplicationJob is L36. The "reuse" lesson was real,
                 but the reuse SITE chosen (a job) was unearned.

GOOD (post-fix): Replaced with a plain Ruby class:
                   class CsvProductExport
                     def initialize(filters); @filters = filters; end
                     def call
                       products = ProductQuery.new...
                     end
                   end
                 Lesson preserved (query objects compose anywhere). The
                 reuse context is a class the player can write today.
                 Comment notes "later you'll see this called from a
                 background job too" — forward-tease without pre-baking.
```

### How to detect this during design and audit

When designing or auditing level N:
1. Identify the concept(s) the level teaches (the build phase's headline lesson).
2. Grep the curriculum for that concept appearing in levels < N. Check **all five surfaces** from the common-shapes table above, not just code blocks.
3. If it appears, you have one of three problems:
   - **The concept's introduction level is wrong.** Decide which level should own it.
   - **The earlier level is wrong.** Strip the concept; it shouldn't be there.
   - **The concept is taught implicitly twice.** Remove the duplicate; rely on the explicit teaching.

When designing level N's "before" state:
- Walk through the cumulative-patterns table for levels < N and apply each pattern. **STOP.**
- Do NOT add structure for patterns introduced at level ≥ N. The player hasn't earned them.

### Quick scan recipe (for periodic audits)

The following grep patterns catch the most common violations across the curriculum. Run them periodically to catch regressions:

```bash
# Service objects (L16+) — should NOT appear in Act 1+2
grep -rln "ApplicationService\|app/services/" src/features/act1-foundation/ src/features/act2-users-security/

# Dry::Validation contracts (L18+)
grep -rln "Dry::Validation\|Dry::Schema\|Contract\.new\.call" src/features/act1-foundation/ src/features/act2-users-security/ src/features/act3-clean-architecture/components/level-15-callbacks/ src/features/act3-clean-architecture/components/level-16-service-objects/ src/features/act3-clean-architecture/components/level-17*

# Active Storage (L34+)
grep -rln "has_one_attached\|has_many_attached" src/features/act1-foundation/ src/features/act2-users-security/ src/features/act3-clean-architecture/ src/features/act4-performance/ src/features/act5-production/components/level-30* src/features/act5-production/components/level-31* src/features/act5-production/components/level-32* src/features/act5-production/components/level-33*

# Action Mailer (L35+)
grep -rln "ApplicationMailer\|generates_token_for\|deliver_now\|deliver_later" <pre-L35 dirs>

# Background jobs (L36+)
grep -rln "ApplicationJob\|perform_later\|SolidQueue\|queue_as :default" <pre-L36 dirs>

# Action Cable (L37+)
grep -rln "ActionCable\|ApplicationCable\|broadcast_to\|SolidCable" <pre-L37 dirs>

# API versioning (L48+)
grep -rln "Api::V1\|api/v1/\|namespace :v1" <pre-L48 dirs>

# Pundit (L11/L12+)
grep -rln "include Pundit\|policy_scope\|authorize @\|app/policies/" <pre-L12 dirs>
```

Adjust the `<pre-LX dirs>` placeholder to the directory glob for levels before each pattern's introduction. False positives appear when pattern strings show up in COMMENTS that explicitly say "X is L34, not shown here." Filter those manually.

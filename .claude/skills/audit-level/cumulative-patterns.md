# Cumulative Patterns Reference (Non-Negotiable)

**Every level's code previews, build steps, and generated code must be consistent with patterns established in earlier levels.** This file is the single source of truth for what has been taught and when. If a pattern was introduced in Level N, every level from N+1 onward must use it in any code that touches that domain.

Before auditing or building any level, read this file and check: "Does the code I'm writing use every applicable pattern from earlier levels?"

**Keep this file up to date.** Whenever you create, redesign, or modify a level that introduces a new pattern, gem, or architectural convention, update this file immediately. If a level's patterns change (e.g., a step is rewritten, a gem is swapped), update the corresponding entry here. This file must always reflect the current state of what has been taught.

---

## Act 1: Foundation (L1-L8)

### L2: Rails 8 API-Only App
- **Pattern**: `rails new app_name --api --database=postgresql`
- **Applies to**: All code assumes API-only mode (no views, no Turbo)

### L5: RESTful Routes with API Namespace
- **Pattern**: `namespace :api do; namespace :v1 do; resources :posts; end; end`
- **Applies to**: All controller paths use `Api::V1::` prefix from this point on

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
class Api::V1::PostsController < ApplicationController
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

### L40+: API Versioning (v1 + v2 Namespaces)
- **Infrastructure**: `/api/v1/` and `/api/v2/` routes, versioned controllers and serializers, deprecation headers
- **Applies to**: Any level showing routes or controllers must show versioned namespaces

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

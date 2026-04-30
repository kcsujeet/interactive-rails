# Interactive Rails: Game Design Document

This is the definitive design document for Interactive Rails. It outlines the 55-level progression from `rails new` to High-Scale Architecture.

## Core Philosophy: App-Driven Learning

Every level exists because the app **needs** it at that stage, not because Rails has a feature to showcase. Players build a production-grade, billion-dollar SaaS app while learning major Rails 8 concepts along the way.

**Rails 8 API-only** with a React frontend. Rails 8 features (Solid Trifecta, built-in auth, `rate_limit`, `params.expect()`, etc.) appear naturally when they solve a real problem.

**Narrative Arc:** Product Catalog API -> E-commerce Platform -> SaaS with Payments -> Enterprise Scale

---

## ACT 1: The Foundation (Levels 1-8)

*Build a working API from nothing. App: Product Catalog API.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 1 | Environment | mise, Ruby, Rails install | Day 0. Set up your development environment: version manager, Ruby, Rails. |
| 2 | First Boot | `rails new --api`, PostgreSQL vs SQLite | Day 1. Choose your database. Rails 8 makes SQLite production-ready, PostgreSQL for scale. |
| 3 | The Model | ActiveRecord, migrations, schema | Need a product catalog. Define what a Product looks like: name, description, price. |
| 4 | CRUD Operations | ActiveRecord CRUD, Rails console | Model exists but DB is empty. Create, read, update, destroy records. |
| 5 | Routes & Request Lifecycle | `resources`, namespaces, request flow | Routes defined, requests traced. Map HTTP verbs + URLs to controller actions under /api/v1/. |
| 6 | The Controller | API controllers, `render json:`, RESTful actions | Routes exist but nothing responds. Build a controller that handles those routes and returns JSON. |
| 7 | Serializers | JSON shaping, jsonapi-serializer (JSON:API standard) | API dumps raw `to_json` with internal columns. Control exactly what the client sees. |
| 8 | Associations | `has_many`, `belongs_to`, nested JSON | Products need reviews. Model relationships, cascade deletion, and nested responses. |

---

## ACT 2: Guards & Gates (Levels 9-15)

*Users are signing up. Time to lock it down. App: Product Catalog with users.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 9 | Authentication | Rails 8 auth generator, `has_secure_password`, Bearer tokens | Anyone can hit any endpoint. Generate auth scaffolding, adapt for API mode. |
| 10 | Validations | `validates`, presence/uniqueness/format, custom messages | Users submit products with missing names, zero prices, garbage data. Reject it. |
| 11 | Callbacks & Normalizations | `before_save`, `after_create`, `normalizes` | Emails stored as " JOE@GMAIL.COM " break lookups. Normalize on save. |
| 12 | Authorization | Pundit policies, `Current.user` | Anyone can edit anyone's products. Restrict actions based on who's asking. |
| 13 | Testing | RSpec, FactoryBot, request specs | Zero tests. Ship breaks silently. Set up RSpec, write your first spec. |
| 14 | Strong Params | `params.expect`, strict parameter filtering | Params whitelist is too broad. Audit and tighten to prevent mass assignment. |
| 15 | CORS | rack-cors, cross-origin configuration | API is ready. Connect a React frontend with rack-cors. |

---

## ACT 3: Clean Architecture (Levels 16-22)

*Features are piling up. The codebase is getting messy. App: E-commerce API.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 16 | Service Objects | PORO services, Result pattern | Registration does too much in one controller action. | Yes |
| 17 | Concerns & Modules | `ActiveSupport::Concern`, shared behavior | Tagging logic duplicated across Product and Review. | Yes |
| 18 | Validation Contracts | `Dry::Validation`, `Dry::Schema`, multi-model validation | Registration creates User + Profile + NotificationPrefs. Extract scattered validations into composable Dry::Schema + Contract with cross-field rules. | Yes |
| 19 | Query Objects | PORO queries, composable filters | Admin dashboard has 60-line controller. Extract into ProductQuery with chainable methods. | Yes |
| 20 | Error Handling | `rescue_from`, structured JSON errors | API returns raw 500s with stack traces. Build consistent error responses. | Yes |
| 21 | Action Mailer | Mailers, `generates_token_for`, password resets | Users forget passwords. Build a password reset flow. | Yes |
| 22 | Background Jobs | Solid Queue, ActiveJob, queues, retries | Email sending blocks the response. Move it to a background job. | Yes |

---

## ACT 4: Performance (Levels 23-31)

*Traffic is growing. The API is slowing down. App: Growing e-commerce platform.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 23 | The N+1 Problem | N+1 queries, Prosopite detection, strict_loading | `/api/products` runs 101 queries for 100 products. | |
| 24 | Eager Loading | `includes`, `preload`, `eager_load` | Fix the N+1. Batch those queries. | Yes |
| 25 | Narrow Fetching | `pluck`, `select`, `find_in_batches` | API loads full AR objects just to read one column. Fetch only what you need. | Yes |
| 26 | Database Indexing | `add_index`, composite indexes, EXPLAIN | `GET /api/users?email=...` does a full table scan. | |
| 27 | Counter Caches | `counter_cache`, denormalization | `product.reviews.count` runs COUNT for every product. | Yes |
| 28 | Pagination | Pagy, cursor-based pagination, `Link` headers | `GET /api/products` returns all 50K products at once. | Yes |
| 29 | Search | PostgreSQL full-text / SQLite FTS5, `pg_search` | `LIKE '%query%'` is impossibly slow on 500K rows. | Yes |
| 30 | Caching | Solid Cache, low-level cache, cache invalidation | Same expensive computation on every request. | Yes |
| 31 | HTTP Caching & CDNs | Cache-Control, ETags, CDN config | Every request hits the origin server. Use HTTP caching and CDNs to serve responses at the edge. | Yes |

---

## ACT 5: Advanced Features (Levels 32-40)

*Beyond CRUD: the Rails features every real app reaches for.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 32 | Polymorphic Associations | `polymorphic: true` | Reviews on Products, ProductImages, AND ProductVideos. One table. | Yes |
| 33 | Transactions | `transaction`, atomicity, rollback | Placing an order: charge payment, create order, log transaction. All or nothing. | Yes |
| 34 | Locking | Optimistic/pessimistic locking, `lock_version`, `FOR UPDATE` | Two users buy the last item simultaneously. Inventory goes negative. | Yes |
| 35 | Active Storage | File uploads, presigned URLs, variants | Sellers want product photos. Direct upload. | Yes |
| 36 | Encrypted Attributes | `encrypts`, deterministic vs non-deterministic | GDPR audit: customer PII must be encrypted at rest. | Yes |
| 37 | Real-Time | Action Cable, Solid Cable, WebSocket auth | Customers want live order status updates. HTTP polling kills the server. | Yes |
| 38 | External APIs | HTTP clients, timeouts, retries, circuit breakers | Stripe payment timeout crashes checkout. | Yes |
| 39 | Webhooks & Idempotency | Webhook receivers, signature verification, idempotency keys | Stripe webhook fires twice. Customer charged twice. | Yes |
| 40 | API Versioning | Version namespaces, deprecation, breaking changes | Partners on v1. Need v2 without breaking them. | Yes |

---

## ACT 6: Operations (Levels 41-50)

*Ship it, run it, keep it alive.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 41 | Middleware & Rack | Rack middleware stack, custom middleware | Need request logging, bot detection, request ID tracking. | |
| 42 | Rate Limiting | Rails 8 `rate_limit`, per-user/per-IP throttling | Bots hammer the API. 10K req/sec from one IP. | Yes |
| 43 | Soft Deletes & Audit Trails | `discard` gem, PaperTrail | Admin deletes a customer. No undo. No record of changes. | Yes |
| 44 | Safe Migrations | `strong_migrations`, zero-downtime patterns | Deploy locks the table for 30 seconds. API returns 500s. | |
| 45 | Recurring Jobs & Scheduling | Solid Queue recurring tasks, data maintenance | Expired tokens pile up. Need automated maintenance. | Yes |
| 46 | Data Lifecycle | Hot/warm/cold data, archiving, destruction | Old records bloat the DB. Implement data archiving and scheduled destruction policies. | Yes |
| 47 | Structured Error Monitoring | Exception tracking, error context, error budgets | 500 errors nobody notices until customers complain. | |
| 48 | Observability | Structured logging, APM, distributed tracing | PagerDuty fires but nobody knows what's wrong. | |
| 49 | Deployment (Kamal) | Kamal 2, Dockerized zero-downtime deploy, rollback, health checks | Manual `scp` + restart drops traffic for 8s every release. No rollback. | |
| 50 | Feature Flags | Rollout strategies, kill switches, gradual exposure | New checkout breaks for 2% of users. Need a kill switch and progressive rollout. | |

---

## ACT 7: Scale (Levels 51-58)

*Past one of everything.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 51 | Multi-Database (Read Replicas) | `connects_to`, read replicas, `connected_to` | Reads competing with writes. Split databases. | |
| 52 | Database Sharding | Horizontal sharding, tenant isolation | 10M users. Single DB at capacity. Shard by tenant. | |
| 53 | Multi-Tenancy | ActsAsTenant, schema-based isolation | B2B SaaS: each company must only see their data. | Yes |
| 54 | State Machines | AASM, transition guards, audit trail | Invalid order state transitions happening. Guard them. | Yes |
| 55 | Modular Monolith | Packwerk, CODEOWNERS, enforced boundaries | Monolith is a tangle. Enforce module boundaries without extracting services. | Yes |
| 56 | Domain Events & Decoupling | Pub/Sub, domain events, event-driven architecture | Payment failure cascades everywhere. Decouple with events. | Yes |
| 57 | API Gateway | Gateway pattern, request routing, auth at edge | Multiple services, each handling auth differently. | |
| 58 | The Architect (Capstone) | Full system design, service extraction | Design the complete architecture using every concept learned. | |

---

## Rails 8 Features Integration

| Feature | Level | Why |
|---|---|---|
| `rails new --api` | L2 | Project setup |
| SQLite production (WAL, IMMEDIATE) | L2 | DB choice |
| `params.expect()` | L14 | Safer than require/permit |
| `normalizes` | L11 | Clean data on assignment |
| Built-in auth generator | L9 | Auth scaffolding |
| `authenticate_by` | L9 | Timing-safe login |
| `Current` attributes | L9, L12 | Request-scoped user |
| `generates_token_for` | L21 | Password reset tokens |
| Solid Queue | L22, L46 | Background jobs, recurring tasks |
| Solid Cache | L30 | Database-backed caching |
| Solid Cable | L37 | WebSocket pub/sub |
| `encrypts` | L36 | Encrypted attributes |
| Built-in `rate_limit` | L43 | Throttling |
| Kamal 2 | L42 | Deployment |

## Stats

- **58 levels, 7 acts**
- **API-only**, no view/Turbo complexity
- **~28 levels** requiring tests (from Level 13 onward)
- **App-driven**: each level solves a real problem, not a feature demo

# Rails Expert: Game Design Document

This is the definitive design document for Rails Expert. It outlines the 50-level progression from `rails new` to High-Scale Architecture.

## Core Philosophy: App-Driven Learning

Every level exists because the app **needs** it at that stage — not because Rails has a feature to showcase. Players build a production-grade, billion-dollar SaaS app while learning major Rails 8 concepts along the way.

**Rails 8 API-only** with a React frontend. Rails 8 features (Solid Trifecta, built-in auth, `rate_limit`, `params.expect()`, etc.) appear naturally when they solve a real problem.

**Narrative Arc:** Blog API → Social Platform → SaaS with Payments → Enterprise Scale

---

## ACT 1: The Foundation (Levels 1-7)

*Build a working API from nothing. App: Blog API.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 1 | The Stack Choice | `rails new --api`, PostgreSQL vs SQLite | Day 1. Choose your database. Rails 8 makes SQLite production-ready, PostgreSQL for scale. |
| 2 | The Model | ActiveRecord, migrations, schema | Need a blog API. Define what a Post looks like — attributes, types, constraints. |
| 3 | CRUD Operations | ActiveRecord CRUD, Rails console | Model exists but DB is empty. Create, read, update, destroy records. |
| 4 | The Controller | API controllers, `render json:`, `params.expect()` | HTTP requests arrive but nothing responds. Build a controller that accepts params and returns JSON. |
| 5 | Serializers | JSON shaping, jsonapi-serializer (JSON:API standard) | API dumps raw `to_json` with internal columns. Control exactly what the client sees. |
| 6 | Routes & Request Lifecycle | `resources`, middleware stack, request flow | Wire the full cycle: Route → Controller → Model → DB → Serializer → JSON. |
| 7 | Associations | `has_many`, `belongs_to`, nested JSON | Posts need comments. Users need posts. Model relationships and include them in responses. |

---

## ACT 2: Users & Security (Levels 8-14)

*Real users arrive. Things break. App: Blog API with users.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 8 | Authentication | Rails 8 auth generator, `has_secure_password`, Bearer tokens | Anyone can hit any endpoint. Generate auth scaffolding, adapt for API mode. |
| 9 | Validations | `validates`, presence/uniqueness/format, custom messages | Users submit empty posts, duplicate emails, garbage data. Reject it. |
| 10 | Callbacks & Normalizations | `before_save`, `after_create`, `normalizes` | Emails stored as " JOE@GMAIL.COM " break lookups. Normalize on save. |
| 11 | Authorization | Pundit policies, `Current.user` | Anyone can edit anyone's posts. Restrict actions based on who's asking. |
| 12 | Testing | RSpec, FactoryBot, request specs | Zero tests. Ship breaks silently. Set up RSpec, write your first spec. |
| 13 | Security | CORS, credentials, `rate_limit`, strong params | Security audit: no CORS headers, API keys in source, no rate limit on login. |
| 14 | Scopes & Enums | `enum`, named scopes, query interface | API returns all posts including drafts. Filter by status. |

---

## ACT 3: Clean Architecture (Levels 15-21)

*Codebase doubles. Fat controllers, duplicated logic. Time to refactor. App: Social platform API.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 15 | Service Objects | PORO services, Result pattern | Registration does too much in one controller action. | Yes |
| 16 | Concerns & Modules | `ActiveSupport::Concern`, shared behavior | Tagging logic duplicated across Post, Comment, Photo. | Yes |
| 17 | Validation Contracts | `Dry::Validation`, `Dry::Schema`, multi-model validation | Onboarding creates User + Company + Address. Cross-model validations. | Yes |
| 18 | Query Objects | PORO queries, composable filters | Admin dashboard has 60-line controller. Extract into PostQuery with chainable methods. | Yes |
| 19 | Error Handling | `rescue_from`, structured JSON errors | API returns raw 500s with stack traces. Build consistent error responses. | Yes |
| 20 | Action Mailer | Mailers, `generates_token_for`, password resets | Users forget passwords. Build a password reset flow. | Yes |
| 21 | Background Jobs | Solid Queue, ActiveJob, queues, retries | Email sending blocks the response. Move it to a background job. | Yes |

---

## ACT 4: Performance (Levels 22-28)

*10K users. API is slow. Database groaning. App: Growing platform.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 22 | The N+1 Problem | N+1 queries, `bullet` gem | `/api/posts` runs 101 queries for 100 posts. | |
| 23 | Eager Loading | `includes`, `preload`, `eager_load` | Fix the N+1. Batch those queries. | Yes |
| 24 | Database Indexing | `add_index`, composite indexes, EXPLAIN | `GET /api/users?email=...` does a full table scan. | |
| 25 | Counter Caches | `counter_cache`, denormalization | `post.comments.count` runs COUNT for every post. | Yes |
| 26 | Pagination | Pagy, cursor-based pagination, `Link` headers | `GET /api/posts` returns all 50K posts at once. | Yes |
| 27 | Search | PostgreSQL full-text / SQLite FTS5, `pg_search` | `LIKE '%query%'` is impossibly slow on 500K rows. | Yes |
| 28 | Caching | Solid Cache, low-level cache, HTTP caching, ETags | Same expensive computation on every request. | Yes |

---

## ACT 5: Production Features (Levels 29-36)

*Real users, real money, real failures. App: SaaS API with payments.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 29 | Polymorphic Associations | `polymorphic: true` | Comments on Posts, Photos, AND Videos. One table. | Yes |
| 30 | Transactions & Locking | `transaction`, optimistic/pessimistic locking | Two users update the same resource. Data corrupted. | Yes |
| 31 | Active Storage | File uploads, presigned URLs, variants | Users want profile photos. Direct upload. | Yes |
| 32 | Encrypted Attributes | `encrypts`, deterministic vs non-deterministic | GDPR audit: user PII must be encrypted at rest. | Yes |
| 33 | Real-Time | Action Cable, Solid Cable, WebSocket auth | Users want live notifications. HTTP polling kills the server. | Yes |
| 34 | External APIs | HTTP clients, timeouts, retries, circuit breakers | Stripe payment timeout crashes checkout. | Yes |
| 35 | Webhooks & Idempotency | Webhook receivers, signature verification, idempotency keys | Stripe webhook fires twice. User charged twice. | Yes |
| 36 | API Versioning | Version namespaces, deprecation, breaking changes | Partners on v1. Need v2 without breaking them. | Yes |

---

## ACT 6: Reliability (Levels 37-42)

*100K users. Outages hurt. App: Production SaaS.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 37 | Middleware & Rack | Rack middleware stack, custom middleware | Need request logging, bot detection, request ID tracking. | |
| 38 | Rate Limiting | Rails 8 `rate_limit`, per-user/per-IP throttling | Bots hammer the API. 10K req/sec from one IP. | Yes |
| 39 | Soft Deletes & Audit Trails | `discard` gem, PaperTrail | Admin deletes a user. No undo. No record of changes. | Yes |
| 40 | Safe Migrations | `strong_migrations`, zero-downtime patterns | Deploy locks the table for 30 seconds. API returns 500s. | |
| 41 | Recurring Jobs & Scheduling | Solid Queue recurring tasks, data maintenance | Expired tokens pile up. Need automated maintenance. | Yes |
| 42 | Structured Error Monitoring | Exception tracking, error context, error budgets | 500 errors nobody notices until users complain. | |

---

## ACT 7: Scale (Levels 43-47)

*1M users. Architectural decisions. App: Enterprise SaaS.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 43 | Multi-Database | `connects_to`, read replicas, `connected_to` | Reads competing with writes. Split databases. | |
| 44 | State Machines | AASM, transition guards, audit trail | Invalid state transitions happening. Guard them. | Yes |
| 45 | Multi-Tenancy | ActsAsTenant, schema-based isolation | B2B SaaS: each company must only see their data. | Yes |
| 46 | Observability | Structured logging, APM, distributed tracing | PagerDuty fires but nobody knows what's wrong. | |
| 47 | Domain Events & Decoupling | Pub/Sub, domain events, event-driven architecture | Payment failure cascades everywhere. Decouple with events. | Yes |

---

## ACT 8: Mastery (Levels 48-50)

*Architect entire systems.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 48 | API Gateway | Gateway pattern, request routing, auth at edge | Multiple services, each handling auth differently. |
| 49 | Database Sharding | Horizontal sharding, tenant isolation | 10M users. Single DB at capacity. Shard by tenant. |
| 50 | The Architect (Capstone) | Full system design, service extraction | Design the complete architecture using every concept learned. |

---

## Rails 8 Features Integration

| Feature | Level | Why |
|---|---|---|
| `rails new --api` | L1 | Project setup |
| SQLite production (WAL, IMMEDIATE) | L1 | DB choice |
| `params.expect()` | L4 | Safer than require/permit |
| `normalizes` | L10 | Clean data on assignment |
| Built-in auth generator | L8 | Auth scaffolding |
| `authenticate_by` | L8 | Timing-safe login |
| `Current` attributes | L8, L11 | Request-scoped user |
| `enum` (new syntax) | L14 | Status filtering |
| `generates_token_for` | L20 | Password reset tokens |
| Solid Queue | L21, L41 | Background jobs, recurring tasks |
| Solid Cache | L28 | Database-backed caching |
| Solid Cable | L33 | WebSocket pub/sub |
| `encrypts` | L32 | Encrypted attributes |
| Built-in `rate_limit` | L13, L38 | Throttling |

## Stats

- **50 levels, 8 acts**
- **API-only** — no view/Turbo complexity
- **~24 levels** requiring tests (from Level 12 onward)
- **App-driven**: each level solves a real problem, not a feature demo

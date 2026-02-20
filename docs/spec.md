# Rails Expert: Game Design Document

This is the definitive design document for Rails Expert. It outlines the 55-level progression from `rails new` to High-Scale Architecture.

## Core Philosophy: App-Driven Learning

Every level exists because the app **needs** it at that stage — not because Rails has a feature to showcase. Players build a production-grade, billion-dollar SaaS app while learning major Rails 8 concepts along the way.

**Rails 8 API-only** with a React frontend. Rails 8 features (Solid Trifecta, built-in auth, `rate_limit`, `params.expect()`, etc.) appear naturally when they solve a real problem.

**Narrative Arc:** Blog API → Social Platform → SaaS with Payments → Enterprise Scale

---

## ACT 1: The Foundation (Levels 1-8)

*Build a working API from nothing. App: Blog API.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 1 | First Boot | `rails new --api`, PostgreSQL vs SQLite | Day 1. Choose your database. Rails 8 makes SQLite production-ready, PostgreSQL for scale. |
| 2 | The Model | ActiveRecord, migrations, schema | Need a blog API. Define what a Post looks like — attributes, types, constraints. |
| 3 | CRUD Operations | ActiveRecord CRUD, Rails console | Model exists but DB is empty. Create, read, update, destroy records. |
| 4 | Routes & Request Lifecycle | `resources`, namespaces, request flow | Routes defined, requests traced. Map HTTP verbs + URLs to controller actions under /api/v1/. |
| 5 | The Controller | API controllers, `render json:`, `params.expect()` | Routes exist but nothing responds. Build a controller that handles those routes and returns JSON. |
| 6 | Serializers | JSON shaping, jsonapi-serializer (JSON:API standard) | API dumps raw `to_json` with internal columns. Control exactly what the client sees. |
| 7 | Associations | `has_many`, `belongs_to`, nested JSON | Posts need comments. Users need posts. Model relationships and include them in responses. |
| 8 | Seeds & Sample Data | `db/seeds.rb`, Faker, idempotent seeding | DB is empty in dev. Create realistic seed data for development and testing. |

---

## ACT 2: Users & Security (Levels 9-15)

*Real users arrive. Things break. App: Blog API with users.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 9 | Authentication | Rails 8 auth generator, `has_secure_password`, Bearer tokens | Anyone can hit any endpoint. Generate auth scaffolding, adapt for API mode. |
| 10 | Validations | `validates`, presence/uniqueness/format, custom messages | Users submit empty posts, duplicate emails, garbage data. Reject it. |
| 11 | Callbacks & Normalizations | `before_save`, `after_create`, `normalizes` | Emails stored as " JOE@GMAIL.COM " break lookups. Normalize on save. |
| 12 | Authorization | Pundit policies, `Current.user` | Anyone can edit anyone's posts. Restrict actions based on who's asking. |
| 13 | Testing | RSpec, FactoryBot, request specs | Zero tests. Ship breaks silently. Set up RSpec, write your first spec. |
| 14 | Security | CORS, credentials, `rate_limit`, strong params | Security audit: no CORS headers, API keys in source, no rate limit on login. |
| 15 | Scopes & Enums | `enum`, named scopes, query interface | API returns all posts including drafts. Filter by status. |

---

## ACT 3: Clean Architecture (Levels 16-22)

*Codebase doubles. Fat controllers, duplicated logic. Time to refactor. App: Social platform API.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 16 | Service Objects | PORO services, Result pattern | Registration does too much in one controller action. | Yes |
| 17 | Concerns & Modules | `ActiveSupport::Concern`, shared behavior | Tagging logic duplicated across Post, Comment, Photo. | Yes |
| 18 | Validation Contracts | `Dry::Validation`, `Dry::Schema`, multi-model validation | Registration creates User + Profile + NotificationPrefs. Extract scattered validations into composable Dry::Schema + Contract with cross-field rules. Stepped: schemas -> contract composition + rules. | Yes |
| 19 | Query Objects | PORO queries, composable filters | Admin dashboard has 60-line controller. Extract into PostQuery with chainable methods. | Yes |
| 20 | Error Handling | `rescue_from`, structured JSON errors | API returns raw 500s with stack traces. Build consistent error responses. | Yes |
| 21 | Action Mailer | Mailers, `generates_token_for`, password resets | Users forget passwords. Build a password reset flow. | Yes |
| 22 | Background Jobs | Solid Queue, ActiveJob, queues, retries | Email sending blocks the response. Move it to a background job. | Yes |

---

## ACT 4: Performance (Levels 23-31)

*10K users. API is slow. Database groaning. App: Growing platform.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 23 | The N+1 Problem | N+1 queries, `bullet` gem | `/api/posts` runs 101 queries for 100 posts. | |
| 24 | Eager Loading | `includes`, `preload`, `eager_load` | Fix the N+1. Batch those queries. | Yes |
| 25 | Narrow Fetching | `pluck`, `select`, `find_in_batches` | API loads full AR objects just to read one column. Fetch only what you need. | Yes |
| 26 | Database Indexing | `add_index`, composite indexes, EXPLAIN | `GET /api/users?email=...` does a full table scan. | |
| 27 | Counter Caches | `counter_cache`, denormalization | `post.comments.count` runs COUNT for every post. | Yes |
| 28 | Pagination | Pagy, cursor-based pagination, `Link` headers | `GET /api/posts` returns all 50K posts at once. | Yes |
| 29 | Search | PostgreSQL full-text / SQLite FTS5, `pg_search` | `LIKE '%query%'` is impossibly slow on 500K rows. | Yes |
| 30 | Caching | Solid Cache, low-level cache, cache invalidation | Same expensive computation on every request. | Yes |
| 31 | HTTP Caching & CDNs | Cache-Control, ETags, CDN config | Every request hits the origin server. Use HTTP caching and CDNs to serve responses at the edge. | Yes |

---

## ACT 5: Production Features (Levels 32-39)

*Real users, real money, real failures. App: SaaS API with payments.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 32 | Polymorphic Associations | `polymorphic: true` | Comments on Posts, Photos, AND Videos. One table. | Yes |
| 33 | Transactions & Locking | `transaction`, optimistic/pessimistic locking | Two users update the same resource. Data corrupted. | Yes |
| 34 | Active Storage | File uploads, presigned URLs, variants | Users want profile photos. Direct upload. | Yes |
| 35 | Encrypted Attributes | `encrypts`, deterministic vs non-deterministic | GDPR audit: user PII must be encrypted at rest. | Yes |
| 36 | Real-Time | Action Cable, Solid Cable, WebSocket auth | Users want live notifications. HTTP polling kills the server. | Yes |
| 37 | External APIs | HTTP clients, timeouts, retries, circuit breakers | Stripe payment timeout crashes checkout. | Yes |
| 38 | Webhooks & Idempotency | Webhook receivers, signature verification, idempotency keys | Stripe webhook fires twice. User charged twice. | Yes |
| 39 | API Versioning | Version namespaces, deprecation, breaking changes | Partners on v1. Need v2 without breaking them. | Yes |

---

## ACT 6: Reliability (Levels 40-46)

*100K users. Outages hurt. App: Production SaaS.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 40 | Middleware & Rack | Rack middleware stack, custom middleware | Need request logging, bot detection, request ID tracking. | |
| 41 | Rate Limiting | Rails 8 `rate_limit`, per-user/per-IP throttling | Bots hammer the API. 10K req/sec from one IP. | Yes |
| 42 | Soft Deletes & Audit Trails | `discard` gem, PaperTrail | Admin deletes a user. No undo. No record of changes. | Yes |
| 43 | Safe Migrations | `strong_migrations`, zero-downtime patterns | Deploy locks the table for 30 seconds. API returns 500s. | |
| 44 | Recurring Jobs & Scheduling | Solid Queue recurring tasks, data maintenance | Expired tokens pile up. Need automated maintenance. | Yes |
| 45 | Data Lifecycle | Hot/warm/cold data, archiving, destruction | Old records bloat the DB. Implement data archiving and scheduled destruction policies. | Yes |
| 46 | Structured Error Monitoring | Exception tracking, error context, error budgets | 500 errors nobody notices until users complain. | |

---

## ACT 7: Scale (Levels 47-52)

*1M users. Architectural decisions. App: Enterprise SaaS.*

| # | Name | Concept | Scenario | Tests? |
|---|------|---------|----------|--------|
| 47 | Multi-Database | `connects_to`, read replicas, `connected_to` | Reads competing with writes. Split databases. | |
| 48 | State Machines | AASM, transition guards, audit trail | Invalid state transitions happening. Guard them. | Yes |
| 49 | Multi-Tenancy | ActsAsTenant, schema-based isolation | B2B SaaS: each company must only see their data. | Yes |
| 50 | Observability | Structured logging, APM, distributed tracing | PagerDuty fires but nobody knows what's wrong. | |
| 51 | Modular Monolith | Packwerk, CODEOWNERS, enforced boundaries | Monolith is a tangle. Enforce module boundaries without extracting services. | Yes |
| 52 | Domain Events & Decoupling | Pub/Sub, domain events, event-driven architecture | Payment failure cascades everywhere. Decouple with events. | Yes |

---

## ACT 8: Mastery (Levels 53-55)

*Architect entire systems.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 53 | API Gateway | Gateway pattern, request routing, auth at edge | Multiple services, each handling auth differently. |
| 54 | Database Sharding | Horizontal sharding, tenant isolation | 10M users. Single DB at capacity. Shard by tenant. |
| 55 | The Architect (Capstone) | Full system design, service extraction | Design the complete architecture using every concept learned. |

---

## Rails 8 Features Integration

| Feature | Level | Why |
|---|---|---|
| `rails new --api` | L1 | Project setup |
| SQLite production (WAL, IMMEDIATE) | L1 | DB choice |
| `params.expect()` | L5 | Safer than require/permit |
| `normalizes` | L11 | Clean data on assignment |
| Built-in auth generator | L9 | Auth scaffolding |
| `authenticate_by` | L9 | Timing-safe login |
| `Current` attributes | L9, L12 | Request-scoped user |
| `enum` (new syntax) | L15 | Status filtering |
| `generates_token_for` | L21 | Password reset tokens |
| Solid Queue | L22, L44 | Background jobs, recurring tasks |
| Solid Cache | L30 | Database-backed caching |
| Solid Cable | L36 | WebSocket pub/sub |
| `encrypts` | L35 | Encrypted attributes |
| Built-in `rate_limit` | L14, L41 | Throttling |

## Stats

- **55 levels, 8 acts**
- **API-only** — no view/Turbo complexity
- **~28 levels** requiring tests (from Level 13 onward)
- **App-driven**: each level solves a real problem, not a feature demo

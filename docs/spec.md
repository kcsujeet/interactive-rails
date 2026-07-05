# Interactive Rails: Game Design Document

This is the definitive design document for Interactive Rails. It outlines the 58-level progression from `rails new` to High-Scale Architecture.

**Source of truth:** the level tables below mirror the live curriculum in `src/lib/acts-registry.ts`. A consistency test (`src/lib/__tests__/spec-consistency.test.ts`) fails if this document drifts from the registry: act names, level ranges, level numbers, level names, headline counts, and the Rails 8 feature table are all pinned. When the curriculum changes, update both the registry and this document.

## Core Philosophy: App-Driven Learning

Every level exists because the app **needs** it at that stage, not because Rails has a feature to showcase. Players build a production-grade, billion-dollar SaaS app while learning major Rails 8 concepts along the way.

**Rails 8 API-only** with a React frontend. Rails 8 features (Solid Trifecta, built-in auth, `rate_limit`, `params.expect()`, etc.) appear naturally when they solve a real problem.

**Narrative Arc:** Product Catalog API -> E-commerce Platform -> SaaS with Payments -> Enterprise Scale

---

## ACT 1: The Foundation (Levels 1-8)

*Build a working API from nothing. App: Product Catalog API.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 1 | The Environment | mise, Ruby, Rails install | Day 0. No Ruby, no Rails. Set up a version manager so each project locks to the Ruby it was built with. |
| 2 | First Boot | `rails new --api`, SQLite (WAL) vs PostgreSQL | Stand up a JSON-only Rails project, pick a database that handles concurrent users, boot it on localhost:3000. |
| 3 | The Model | ActiveRecord, migrations, schema | The server boots but the database is empty. Teach Rails what a Product looks like: name, description, price. |
| 4 | Associations | `has_many`, `belongs_to`, cascade deletion | Customers want reviews. Two records that belong together need a relationship Rails understands. |
| 5 | CRUD Operations | ActiveRecord CRUD, Rails console | The Product table holds zero rows. Create, read, update, and destroy records from the console. |
| 6 | Routes & Request Lifecycle | `resources`, namespaces, request flow | Every HTTP request 404s. Map verbs and URLs to controller actions under /api/v1/. |
| 7 | The Controller | API controllers, `render json:`, RESTful actions | Routes resolve but crash with "uninitialized constant". Build the controller that answers them. |
| 8 | Serializers | JSON shaping, jsonapi-serializer (JSON:API standard) | Every endpoint dumps every column to JSON. Control exactly what the client sees. |

---

## ACT 2: Users & Security (Levels 9-14)

*Users are signing up. Time to lock it down. App: Product Catalog with users.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 9 | Authentication | Rails 8 auth generator, `has_secure_password`, `authenticate_by`, Bearer tokens | Anyone can hit any endpoint. There is no concept of who is making the request. |
| 10 | Encrypted Attributes | `encrypts`, deterministic vs non-deterministic | Pre-launch security review: every PII column on users is plaintext. Encrypt at rest before the first signup. |
| 11 | Authorization | Pundit policies, `Current.user` | User A can edit and delete User B's products. Authentication says WHO; nothing checks what they are ALLOWED to do. |
| 12 | Validations | `validates`, presence/uniqueness/format, custom messages | Users submit products with missing names, zero prices, duplicate emails. Reject bad data before it hits the DB. |
| 13 | Strong Params | `params.expect`, strict parameter filtering | The controller mass-assigns every field a request includes. Any user could self-promote to featured with one API call. |
| 14 | Testing | RSpec, FactoryBot, request specs | Strong params, authorization, and encryption each prevent a real failure, but nothing checks they still hold after the next refactor. |

---

## ACT 3: Clean Architecture (Levels 15-20)

*Features are piling up. The codebase is getting messy. App: E-commerce API.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 15 | Callbacks & Normalizations | `before_save`, `after_create`, `normalizes`, lifecycle boundaries | Whitespaced product names break storefront search; signups miss welcome emails and create duplicates. What belongs in the model lifecycle, and what does not? |
| 16 | Service Objects | PORO services, Result pattern | RegistrationsController#create is 80 lines: creates a user, logs, subscribes to the newsletter. Too much in one action. |
| 17 | Concerns & Modules | `ActiveSupport::Concern`, shared behavior | Tagging logic is copy-pasted across Product and Review. DRY it up with a Taggable concern. |
| 18 | Validation Contracts | `Dry::Validation`, `Dry::Schema`, multi-model validation | Registration creates User + Profile + NotificationPrefs with validations scattered inline. Extract composable contracts with cross-field rules. |
| 19 | Query Objects | PORO queries, composable filters | A 60-line admin action chains .where().joins().group().order(), duplicated in the API controller and a CSV export job. |
| 20 | Error Handling | `rescue_from`, structured JSON errors | Production returns raw 500s with stack traces; another endpoint 404s as plain text. Every endpoint formats errors differently. |

---

## ACT 4: Performance (Levels 21-29)

*Traffic is growing. The API is slowing down. App: Growing e-commerce platform.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 21 | The N+1 Problem | N+1 queries, Prosopite detection, strict_loading | 10K daily users, responses above 2 seconds. Trace the query explosion, then catch N+1s automatically. |
| 22 | Eager Loading | `includes`, `preload`, `eager_load`, `joins` | Compare four loading strategies across three scenarios to learn which fits which situation. |
| 23 | Narrow Fetching | `pluck`, `select`, `find_in_batches` | SELECT * loads 30 columns when 2 are needed. Choose the right fetching strategy per endpoint. |
| 24 | Database Indexing | `add_index`, composite indexes, EXPLAIN | Fire EXPLAIN probes to watch sequential scans crawl, then add indexes so the database jumps straight to the answer. |
| 25 | Counter Caches | `counter_cache`, denormalization | The products index fires a separate COUNT(*) per product just to count reviews. |
| 26 | Pagination | Pagy, cursor-based pagination, `Link` headers | GET /api/products returns all 50K products: 12MB of JSON. Mobile clients crash. |
| 27 | Search | PostgreSQL full-text / SQLite FTS5, `pg_search` | LIKE '%query%' is killing search. Build full-text search with ranking, stemming, and index lookups. |
| 28 | Caching | Solid Cache, low-level cache, cache invalidation | Trending rankings recompute from 50K products on every request: 200 identical 512ms computations per minute. |
| 29 | HTTP Caching & CDNs | Cache-Control, ETags, CDN config | Rails caching is great, but 1,000 req/sec still hit the server. Stop requests from reaching Rails at all. |

---

## ACT 5: Advanced Features (Levels 30-39)

*Beyond CRUD: the features Rails apps reach for when they grow up.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 30 | Polymorphic Associations | `polymorphic: true` | Reviews on Products, ProductImages, AND ProductVideos. Three identical review tables exist. Unify them. |
| 31 | Soft Deletes & Audit Trails | `discard` gem, PaperTrail | Admin accidentally deletes a user. No undo, no record of who changed what. |
| 32 | Transactions | `transaction`, atomicity, rollback | A user spends 10 credits to boost a product, but the boost record never gets created. Credits gone, no trace. |
| 33 | Locking | Optimistic/pessimistic locking, `lock_version`, `FOR UPDATE` | Two customers check out the same product simultaneously. 18 units sold, only 8 deducted from stock. |
| 34 | Active Storage | File uploads, direct upload, variants | Users want profile photos; the product team wants image uploads with automatic thumbnails. |
| 35 | Action Mailer | Mailers, `generates_token_for`, password resets | Users forget passwords with no way back. Build a reset flow with secure tokens and email delivery. |
| 36 | Background Jobs | Solid Queue, ActiveJob, queues, retries | Email sending blocks the HTTP response for 3 seconds; profile sync adds 2 more. Move it all to background jobs. |
| 37 | Real-Time | Action Cable, Solid Cable, WebSocket auth | Users want live payment notifications. Polling every 2 seconds is killing the server at 50K concurrent users. |
| 38 | External APIs | HTTP clients, timeouts, retries, circuit breakers | Stripe returned 503 for 5 minutes. ProcessPayment hung 30s per request and blocked every Puma thread. |
| 39 | Webhooks & Idempotency | Webhook receivers, signature verification, idempotency keys | Stripe retried the same webhook event. The handler processed it twice and double-credited the customer. |

---

## ACT 6: Operations (Levels 40-50)

*Ship it. Run it. Keep it alive.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 40 | Middleware & Rack | Rack middleware stack, custom middleware | Production errors are untraceable and bots scrape undetected. Requests arrive and leave with no visibility. |
| 41 | CORS | rack-cors, cross-origin configuration | A React frontend needs to call the API from the browser, but cross-origin requests are blocked by default. |
| 42 | Rate Limiting | Rails 8 `rate_limit`, per-user/per-IP throttling | Bots hammer the API at 10K req/sec from one IP. The login endpoint is being brute-forced. |
| 43 | Safe Migrations | `strong_migrations`, zero-downtime patterns | A deploy changes a column type on a large table and locks it for 30 seconds. API returns 500s. |
| 44 | Recurring Jobs & Scheduling | Solid Queue recurring tasks, data maintenance | Expired tokens pile up, sessions never clean, stale cache bloats the DB. One-off jobs exist; nothing runs on a schedule. |
| 45 | Data Lifecycle | Hot/warm/cold data, archiving, destruction | The orders table has 50M rows and 95% are never accessed. Queries slow, backups fail, migrations take hours. |
| 46 | Structured Error Monitoring | Exception tracking, error context, error budgets | 500s in production but nobody notices until users complain. Exceptions have no context, grouping, or alerts. |
| 47 | Observability | Structured logging, APM, distributed tracing | PagerDuty fires at 3 AM: "High error rate." No metrics, no traces, just a wall of unformatted text. |
| 48 | API Versioning | Version namespaces, deprecation, breaking changes | Order totals must change from integer cents to a money object, but 200 partners depend on the current format. |
| 49 | Deployment | Kamal 2, Dockerized zero-downtime deploy, rollback, health checks | The app still lives on your laptop. Hand-shipping drops traffic, has no rollback, and breaks with a second server. |
| 50 | Feature Flags & Staged Rollouts | Rollout strategies, kill switches, gradual exposure | Ship a half-built payment processor now, launch it Tuesday 9am, and kill a flaky integration faster than a redeploy. |

---

## ACT 7: Scale (Levels 51-58)

*Past one of everything.*

| # | Name | Concept | Scenario |
|---|------|---------|----------|
| 51 | Multi-Database | `connects_to`, read replicas, `connected_to` | Reads are 90% of traffic and compete with writes. Split read/write to separate databases. |
| 52 | Database Sharding | Horizontal sharding, tenant isolation | 10M users. Writes bottlenecked, vertical scaling at its ceiling. Shard by tenant. |
| 53 | Multi-Tenancy | ActsAsTenant, tenant isolation | B2B SaaS: each company must only see their own data. One leaked query could expose another company. |
| 54 | State Machines | AASM, transition guards, audit trail | An order went from "shipped" back to "pending" because status is just a string column. Guard the transitions. |
| 55 | Modular Monolith | Packwerk, CODEOWNERS, enforced boundaries | 200 files, 12 engineers, no ownership. A billing change breaks notifications. Enforce boundaries without extracting services. |
| 56 | Domain Events & Decoupling | Pub/Sub, domain events, event-driven architecture | Checkout directly calls Email, Inventory, Analytics, and Shipping. One slow service blocks the entire order. |
| 57 | API Gateway | Gateway pattern, request routing, auth at edge | Multiple services each handle auth differently; mobile clients call six endpoints on three hosts. One entry point. |
| 58 | The Architect | Full system design, service extraction (capstone) | Billing is coupled, synchronous, and deploys with the monolith. Design its extraction using every concept learned. |

---

## Rails 8 Features Integration

| Feature | Level | Why |
|---|---|---|
| `rails new --api` | L2 | Project setup |
| SQLite production (WAL, IMMEDIATE) | L2 | DB choice |
| `params.expect()` | L13 | Safer than require/permit |
| `normalizes` | L15 | Clean data on assignment |
| Built-in auth generator | L9 | Auth scaffolding |
| `authenticate_by` | L9 | Timing-safe login |
| `Current` attributes | L9, L11 | Request-scoped user |
| `generates_token_for` | L35 | Password reset tokens |
| Solid Queue | L36, L44 | Background jobs, recurring tasks |
| Solid Cache | L28 | Database-backed caching |
| Solid Cable | L37 | WebSocket pub/sub |
| `encrypts` | L10 | Encrypted attributes |
| Built-in `rate_limit` | L42 | Throttling |
| Kamal 2 | L49 | Deployment |

## Stats

- **58 levels, 7 acts** (an `act8-mastery` directory exists as an empty stub; it is not part of the live curriculum)
- **API-only**, no view/Turbo complexity
- **App-driven**: each level solves a real problem, not a feature demo

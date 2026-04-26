---
paths:
  - "**/Level*.tsx"
  - "**/content.ts"
  - "**/data/*.ts"
---

# Rails Conventions: Production-Safe Defaults

When proposing or auditing Rails patterns in level content (code previews, OptionCard answers, scenario stories), prefer the **production-safe default** over the textbook default. The textbook examples in the Rails Guides often show the legacy/historical pattern; billion-dollar Rails shops use the modern, scale-tested variant. This file lists ~20 patterns where the choice matters and why.

When in doubt, pick the option that fails loudly at the security boundary, has readable schema/SQL, survives migrations cleanly, and degrades gracefully in production debugging.

## Model definition

- **Enums: string-encoded over integer-encoded.** Use `enum :status, draft: "draft", listed: "listed", sold: "sold"` (string-encoded with `:string` column type). The legacy `enum :status, draft: 0, listed: 1, sold: 2` (integer-encoded) makes the schema opaque (`status: 1` means nothing in a DB dump), breaks production data on reorder/insert, and makes SQL unreadable (`WHERE status = 1` vs `WHERE status = 'listed'`). Pre-Rails-7 codebases used integers for storage size; at any reasonable scale that is irrelevant. **Default: string.** The Rails Guides still show integer in some examples — they're showing legacy.

- **Associations: always specify `dependent:` and `foreign_key:`.** `has_many :reviews, dependent: :destroy` (or `:nullify`, `:restrict_with_error` — pick deliberately, never default). On the migration side, `t.references :product, foreign_key: true` adds the FK constraint and the index. Bare integers without FK constraints leave orphans on cascade and skip referential integrity at the DB level.

- **Validation placement: model > normalization callback > controller.** Validations live on the model (`validates :email, presence: true, format: ...`). `before_validation` is for *normalization* only (`strip`, `downcase`, derived attributes). Controllers never validate. The model is the single source of truth for what "valid" means.

- **Strict loading: `strict_loading_by_default = true` on models with N+1 risk in test env.** Catches lazy loads at test time before they reach production. Pair with Prosopite (development) for the full N+1 net.

- **ID columns: `bigint` is the default. UUIDs only when distributed.** `bigint` (Rails 8 default) covers any reasonable application. UUIDs are only worth their indexing cost when you need globally-unique IDs across services or sharded databases.

## Migrations

- **Always reversible: prefer `change` over `up`/`down`.** Rails infers the rollback. Reversibility means safe rollback without writing the inverse by hand.

- **NOT NULL + indexes for foreign keys + database defaults.** Required columns get `null: false` in the migration. Foreign-key columns get an index. Defaults belong in the schema, not the model. The DB enforces what your validation library hopes for.

- **For large tables, indexes go in `:concurrently`.** `add_index :products, :status, algorithm: :concurrently` doesn't lock writes. Outside a transaction. The `strong_migrations` gem catches the unsafe variants.

- **Never modify a migration that has been run.** Create a new one. Editing run migrations diverges your schema from collaborators' schemas and from production.

## Controllers

- **Strong params: `params.expect` over `params.require().permit()` in Rails 8+.** `expect` enforces the **shape** of the request, not just the keys. If an attacker sends `product=hacked` (string) instead of `product[name]=...` (hash), `expect` raises 400 immediately. `require/permit` can let malformed shapes slip silently. New code: always `expect`.

- **HTTP statuses: be specific.** `422 Unprocessable Entity` for validation failures, `409 Conflict` for concurrent edits, `429 Too Many Requests` for rate limits. Generic `400 Bad Request` is a missed signal — it tells frontend and ops nothing about *what* went wrong.

- **Authorization: Pundit `authorize record` per action; `policy_scope(Model)` for index.** Don't write inline `if current_user.admin?` checks. Don't put authz in `before_action` blocks without record context. The policy class is the single source of truth for "can this user do this thing to this record."

## Caching

- **Cache keys: versioned, never static.** `Rails.cache.fetch([Product.maximum(:updated_at).to_i, "trending_products"], expires_in: 5.minutes)` invalidates on any record touch. `Rails.cache.fetch("trending_products", ...)` is a static key — `touch: true` on associations does nothing, and the cache only refreshes on the timer. Static keys are a foot-gun.

- **Cache stampede: use `race_condition_ttl` on hot keys.** `Rails.cache.fetch(key, expires_in: 5.minutes, race_condition_ttl: 10.seconds)` lets one request recompute while others continue serving the slightly-stale value. Without it, the first cache expiry under load means N requests all hit the DB at once.

## Background jobs

- **Job arguments: IDs only, never AR objects.** `SyncProfileJob.perform_later(user.id)`, never `perform_later(user)`. AR objects have to be serialized; on deserialization they may be stale or missing. IDs are the contract.

- **Idempotent by design.** Jobs may run more than once (retries, queue restarts). Guard with `return if record.already_synced?` and update the flag on success. Never assume single execution.

- **Workers must run.** `perform_later` puts a row in a database table. Something has to actually run it: `bin/jobs` in dev (via `Procfile.dev`), `bin/jobs` as its own process in production (Procfile entry, systemd unit, Kamal accessory). Without it, jobs queue forever and nothing happens — the most common Rails 8 background-jobs bug.

## Side effects + callbacks

- **Callbacks: normalization only.** `before_validation :downcase_email`, `before_save :strip_whitespace`. **Never** put side effects (emails, API calls, job enqueues, related-record creation) in callbacks. Side effects belong in explicit service calls where they're testable, traceable, and disablable. Callback spaghetti is the most painful Rails anti-pattern to undo.

- **Service objects: only when complexity demands them.** `user.update!(name: params[:name])` inline in the controller is fine. The bar for extracting a `UserUpdate` service is genuine multi-step orchestration (touches multiple records, calls external APIs, emits events). Don't service-ify trivial CRUD.

- **Service result shape: `Result = Data.define(:success?, :user, :errors)`.** Structured failure data beats raising for control flow at scale. Frontend, telemetry, and retry logic all read the same shape. Use `Data.define` (Ruby 3.2+) for immutability.

## Mailers + views

- **Mailer templates use ERB.** Action Mailer requires `app/views/<mailer>/<action>.html.erb` (and `.text.erb`). `<%= @user.name %>` outputs a value. `<% @user.name %>` runs the code without printing. The single most common ERB confusion. (Also: `{{ }}` is JavaScript template syntax, not Rails.)

- **Even API-only Rails apps need ERB for mailers.** API-only is a controller-layer scope; it doesn't remove views entirely. Welcome emails, password resets, receipts — all use ERB.

## Secrets + credentials

- **Use `credentials.yml.enc` + `RAILS_MASTER_KEY`. Don't use `.env`.** `bin/rails credentials:edit` decrypts, lets you edit YAML, re-encrypts. The encrypted file is committed; the master key is git-ignored and lives in `RAILS_MASTER_KEY` in production. `Rails.application.credentials.dig(:aws, :access_key_id)` reads the value. `.env` files leak more easily, are not encrypted at rest, and don't ship to production cleanly.

## Authentication

- **`bin/rails generate authentication` (Rails 8 built-in).** Not Devise. The generator gives you a `User`, `Session`, `Current`, and an `Authentication` concern. No third-party gem dependency for basic auth.

- **`User.authenticate_by(email:, password:)` (Rails 8, timing-safe).** Replaces the manual `find_by + authenticate` pattern. Returns `nil` on failure. Constant-time comparison prevents timing-attack enumeration of valid emails.

- **`Current.user` for the logged-in user.** `Current` is an `ActiveSupport::CurrentAttributes` subclass; the auth concern sets `Current.session` per request, and `Current.user` follows. Don't thread `current_user` through every method signature.

- **`allow_unauthenticated_access only: [:create]` for login/signup.** Rails 8's auth concern adds `before_action :require_authentication` to every controller that includes it (default: locked down). Login and signup are the chicken-and-egg exception. Forget this and login returns 401 before any user can ever sign in.

## Performance

- **N+1: `includes` is the default.** `Product.includes(:user)` lets Rails decide between IN-clause preload and LEFT OUTER JOIN. When you `where` on the joined table, Rails auto-promotes to JOIN. Forcing `eager_load` explicitly is verbose for the same SQL. `preload` only when you specifically don't want a JOIN. `joins` does **not** prevent N+1 — it filters but doesn't load into memory.

- **`find_each` / `in_batches` for large iterations.** Default loading of 50K rows into memory is a memory leak. `find_each(batch_size: 1000)` streams them in chunks.

## Active Storage

- **Direct upload: Rails computes the presigned URL locally.** `create_before_direct_upload!` writes a `Blob` row to your DB and computes the URL from the AWS keys in `config/storage.yml`. **No network call to S3** during URL generation. The 5MB photo never touches Rails — it goes browser → S3 directly.

## I18n

- **Default validation error messages are I18n strings.** `"Name can't be blank"` is `errors.messages.blank` translated. Even if your app is English-only, `I18n.t(...)` is the canonical way to manage user-facing copy. Hardcoded strings in code rot when product copy changes.

---

## How to use this file

When proposing a Rails pattern in a level (code preview, OptionCard answer, scenario story), check this list. If the pattern you're about to propose has a "production-safe default" entry above, default to that. If you're showing the legacy default to *contrast* it (as a wrong OptionCard option, for example), make sure the feedback explicitly explains the production gotcha — don't ship the legacy pattern as if it's the answer.

This list will grow. Add an entry whenever you encounter a new Rails pattern where the textbook default and the production-safe default diverge.

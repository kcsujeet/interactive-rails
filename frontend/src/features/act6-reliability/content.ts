/**
 * Act 6: Reliability
 * "100K users. Outages hurt."
 *
 * Levels 37-42: Middleware & Rack, Rate Limiting, Soft Deletes & Audit Trails,
 *               Safe Migrations, Recurring Jobs & Scheduling, Structured Error Monitoring
 * App context: Production SaaS
 */

import type { Act, Level } from '@/types';
import {
	middlewarePipeline,
	standardPipeline,
} from '@/utils/pipelineTemplates';

// ============================================
// Level 37: Middleware & Rack
// ============================================

const level37Middleware: Level = {
	id: 'act6-level40-middleware',
	actId: 6,
	levelNumber: 40,
	name: 'Middleware & Rack',
	trigger: {
		type: 'incident',
		description:
			'Need request logging, bot detection, and request ID tracking before requests hit Rails. The default middleware stack is not enough.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Requests arrive with no tracking ID, no logging, and bots slip through undetected. Debugging production issues is a nightmare without request correlation.',
		rootCause:
			'No custom middleware in the Rack stack to handle cross-cutting concerns before requests reach controllers.',
		codeExample: `# The Rack middleware stack processes every request BEFORE Rails
# But we have no custom middleware:

$ bin/rails middleware
# use ActionDispatch::HostAuthorization
# use Rack::Sendfile
# use ActionDispatch::Executor
# use Rack::Runtime
# use ActionDispatch::RequestId    # <-- only sets X-Request-Id
# use Rails::Rack::Logger
# ...
# run MyApp::Application.routes

# Problem: No request logging with timing, no bot detection,
# no custom headers, no request correlation across services.

# We need middleware BEFORE Rails to:
# 1. Tag every request with a correlation ID
# 2. Log request timing and metadata
# 3. Detect and block bots early (before wasting resources)`,
		goal: 'Add custom Rack middleware for request tracking, logging, and bot detection.',
		thresholds: {},
	},
	successConditions: [{ type: 'middleware_configured' }],
	availableNodes: ['middleware'],
	unlockedNodes: ['middleware'],
	learningContent: {
		title: 'Rack Middleware Stack',
		goal: `In this level, you'll:\n- learn how Rack middleware works under the hood.\n- write a custom middleware class that intercepts every request before it reaches your controllers.\n- understand the initialize/call interface.\n- insert it into the Rails middleware stack to add cross-cutting behavior like request logging or header injection.`,
		conceptExplanation: `Rack is the interface between web servers and Ruby frameworks. Middleware sits in a stack between the server and your app, processing every request/response.

**Why custom middleware?**
- Cross-cutting concerns (logging, auth, tracking) belong in middleware, not controllers
- Middleware runs before Rails, so it can reject bad requests early
- Each middleware wraps the next, forming a pipeline

**Rack middleware contract:**
- Initialize with \`app\` (the next middleware)
- Respond to \`call(env)\` returning \`[status, headers, body]\`

**Common custom middleware:**
- Request ID correlation across microservices
- Structured request/response logging
- Bot detection and early rejection
- Custom security headers
- Request timing and metrics`,
		railsCodeExample: `# lib/middleware/request_id_tracker.rb
class RequestIdTracker
  def initialize(app)
    @app = app
  end

  def call(env)
    # Use existing X-Request-Id or generate a new one
    request_id = env['HTTP_X_REQUEST_ID'] || SecureRandom.uuid
    env['HTTP_X_REQUEST_ID'] = request_id

    # Thread-local for logging
    Thread.current[:request_id] = request_id

    status, headers, body = @app.call(env)
    headers['X-Request-Id'] = request_id
    [status, headers, body]
  ensure
    Thread.current[:request_id] = nil
  end
end

# lib/middleware/request_logger.rb
class RequestLogger
  def initialize(app)
    @app = app
  end

  def call(env)
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    status, headers, body = @app.call(env)
    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

    Rails.logger.info({
      method: env['REQUEST_METHOD'],
      path: env['PATH_INFO'],
      status: status,
      duration_ms: (duration * 1000).round(2),
      request_id: env['HTTP_X_REQUEST_ID'],
      ip: env['REMOTE_ADDR'],
      user_agent: env['HTTP_USER_AGENT']
    }.to_json)

    [status, headers, body]
  end
end

# lib/middleware/bot_detector.rb
class BotDetector
  BOT_PATTERNS = /bot|crawler|spider|scraper|curl|wget/i

  def initialize(app)
    @app = app
  end

  def call(env)
    user_agent = env['HTTP_USER_AGENT'].to_s

    if BOT_PATTERNS.match?(user_agent)
      env['bot_detected'] = true
      # Block aggressive bots, allow known search engines
      unless known_search_engine?(user_agent)
        return [403, { 'Content-Type' => 'application/json' }, ['{"error":"Forbidden"}']]
      end
    end

    @app.call(env)
  end

  private

  def known_search_engine?(ua)
    /Googlebot|Bingbot|Slurp/i.match?(ua)
  end
end

# config/application.rb
module MyApp
  class Application < Rails::Application
    # Insert middleware at the top of the stack
    config.middleware.insert_before 0, RequestIdTracker
    config.middleware.insert_after RequestIdTracker, BotDetector
    config.middleware.insert_after BotDetector, RequestLogger
  end
end

# Verify the stack:
# $ bin/rails middleware
# use RequestIdTracker
# use BotDetector
# use RequestLogger
# use ActionDispatch::HostAuthorization
# ...`,
		commonMistakes: [
			'Putting cross-cutting logic in ApplicationController instead of middleware',
			'Not passing the request to the next middleware (breaking the chain)',
			'Middleware that catches exceptions silently (hiding errors)',
			'Inserting middleware in the wrong order (logging after auth, etc.)',
			'Not cleaning up Thread.current after the request (memory leak across requests)',
		],
		whenToUse:
			'Use middleware for concerns that apply to every request: logging, auth, tracking, security headers, bot detection.',
		furtherReading: [
			{
				title: 'Rails on Rack',
				url: 'https://guides.rubyonrails.org/rails_on_rack.html',
			},
			{
				title: 'Rack Specification',
				url: 'https://github.com/rack/rack/blob/main/SPEC.rdoc',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Middleware node between Request and Router. Middleware processes every request before Rails sees it.',
	},
};

// ============================================
// Level 38: Rate Limiting
// ============================================

const level38RateLimiting: Level = {
	id: 'act6-level41-rate-limiting',
	actId: 6,
	levelNumber: 41,
	name: 'Rate Limiting',
	requiresTests: true,
	trigger: {
		type: 'attack',
		description:
			'Bots hammer the API. 10K req/sec from one IP. The login endpoint is getting brute-forced. Need to throttle by IP and by user.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'10,000 requests per second from a single IP. Login endpoint returns 500s under load. Legitimate users are locked out.',
		rootCause:
			'No rate limiting at any level. Every request hits the full stack regardless of origin or frequency.',
		codeExample: `# Server logs show the attack:
# 10.0.0.42 - POST /api/v1/sessions - 200 - 2ms
# 10.0.0.42 - POST /api/v1/sessions - 200 - 3ms
# 10.0.0.42 - POST /api/v1/sessions - 200 - 5ms
# ... (10,000 per second)

# Meanwhile, real users:
# 203.0.113.5 - GET /api/v1/posts - 504 Gateway Timeout

# Rails 8 has a built-in rate_limit macro:
class SessionsController < ApplicationController
  rate_limit to: 10, within: 3.minutes, only: :create
  # But we also need IP-level and user-level throttling
end

# Problem: No per-IP throttling, no per-user API limits,
# no global safeguard against traffic spikes.`,
		goal: 'Configure rate limiting at both the controller level (Rails 8 rate_limit) and the Rack level.',
		thresholds: { maxErrorRate: 0.01 },
	},
	successConditions: [{ type: 'rate_limiting_configured' }],
	availableNodes: ['rate_limiter'],
	unlockedNodes: ['rate_limiter'],
	learningContent: {
		title: 'Rate Limiting: Rails 8 Built-in & Rack::Attack',
		goal: `In this level, you'll:\n- protect your API from abuse by implementing rate limiting at multiple layers.\n- use Rails 8's built-in rate_limit to throttle requests per controller action.\n- return proper 429 responses with Retry-After headers.\n- understand the trade-offs between fixed window, sliding window, and token bucket strategies.`,
		conceptExplanation: `Rate limiting protects your app at multiple layers:

**Without rate limiting:**
\`\`\`
Attacker: 10,000 requests/second from one IP
Result:   Server overwhelmed, all legitimate users get 500 errors
          Login endpoint brute-forced: 1M password attempts in 100 seconds
          Database connection pool exhausted
\`\`\`

**With Rack::Attack:**
\`\`\`
Attacker: 10,000 requests/second → 10 allowed, 9,990 get 429 Too Many Requests
Legitimate users: Unaffected
Cost:     Request rejected at Rack middleware level, never hits Rails controllers,
          never touches the database, minimal server resources consumed
\`\`\`

**Rails 8 built-in \`rate_limit\`:**
- Declarative, per-controller macro
- Uses Solid Cache or MemoryStore by default
- Simple to configure for specific actions
- Returns 429 Too Many Requests automatically

**Rack::Attack (Rack-level, more granular):**
- Global throttles: \`limit: 10, period: 1\` per IP
- Per-user throttles via Warden session integration
- 429 Too Many Requests response with customizable \`throttled_responder\`
- Operates at the middleware level: before Rails controllers, before authentication, before any application logic

**Why Rack::Attack over Rails 8 \`rate_limit\`:** Rails 8's built-in rate_limit works per-controller action. Rack::Attack operates at the middleware level: the request is rejected with minimal resource consumption.

**Record creation limits** (often overlooked): Add \`MAX_AMOUNT\` validators to prevent data abuse. Real-world story: a customer support SaaS had users storing billions of tickets on the cheapest plan, not doing customer support, using it as free storage.

**Rate limit values should be in editable storage** (DB column, env var), not hardcoded. Avoid deploying just to change a limit.

**Defense in depth, three layers for production:**
1. **Rack::Attack** at the Rack level: Catches abuse before Rails even boots. IP throttling, blocklists, and Allow2Ban for repeat offenders. This is your first line of defense
2. **Rails 8 \`rate_limit\`** at the controller level: Per-action, per-user limits with business context (e.g., 10 login attempts per 3 minutes per IP)
3. **CDN/Load balancer** at the edge: Cloudflare, AWS WAF, or nginx rate limiting. Cheapest place to drop bad traffic; it never even reaches your servers`,
		railsCodeExample: `# ============================
# Layer 1: Rails 8 rate_limit
# ============================

# app/controllers/sessions_controller.rb
class SessionsController < ApplicationController
  # 10 login attempts per 3 minutes per IP
  rate_limit to: 10, within: 3.minutes, only: :create,
    by: -> { request.remote_ip },
    with: -> { render json: { error: "Too many login attempts. Try again later." }, status: :too_many_requests }
end

# app/controllers/api/v1/posts_controller.rb
class Api::V1::PostsController < ApplicationController
  # 100 requests per minute per user
  rate_limit to: 100, within: 1.minute, only: [:index, :show],
    by: -> { current_user&.id || request.remote_ip }
end

# app/controllers/api/v1/password_resets_controller.rb
class Api::V1::PasswordResetsController < ApplicationController
  # 3 password resets per hour per IP
  rate_limit to: 3, within: 1.hour, only: :create,
    by: -> { request.remote_ip }
end

# ============================
# Layer 2: Rack::Attack (IP-level)
# ============================

# config/initializers/rack_attack.rb
class Rack::Attack
  # Global throttle: 300 requests per 5 minutes per IP
  throttle("req/ip", limit: 300, period: 5.minutes) do |req|
    req.ip unless req.path.start_with?("/assets")
  end

  # Strict login throttle
  throttle("logins/ip", limit: 5, period: 20.seconds) do |req|
    req.ip if req.path == "/api/v1/sessions" && req.post?
  end

  # Throttle password resets by email
  throttle("password_resets/email", limit: 3, period: 1.hour) do |req|
    if req.path == "/api/v1/password_resets" && req.post?
      req.params.dig("email")&.downcase
    end
  end

  # Safelist monitoring and health checks
  safelist("allow-health-checks") do |req|
    req.path == "/up" || req.path == "/health"
  end

  # Blocklist repeat offenders
  blocklist("block repeat offenders") do |req|
    Rack::Attack::Allow2Ban.filter(req.ip, maxretry: 20, findtime: 1.minute, bantime: 1.hour) do
      req.path == "/api/v1/sessions" && req.post?
    end
  end

  # Custom throttled response with Retry-After header
  self.throttled_responder = lambda do |env|
    match_data = env["rack.attack.match_data"]
    retry_after = (match_data || {})[:period]

    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s
      },
      [{ error: "Rate limit exceeded", retry_after: retry_after }.to_json]
    ]
  end
end

# config/application.rb
config.middleware.use Rack::Attack

# ============================
# Tests
# ============================

# test/controllers/sessions_controller_test.rb
class SessionsControllerTest < ActionDispatch::IntegrationTest
  test "rate limits login attempts to 10 per 3 minutes" do
    10.times do
      post api_v1_sessions_path, params: { email: "user@test.com", password: "wrong" }
    end

    post api_v1_sessions_path, params: { email: "user@test.com", password: "wrong" }
    assert_response :too_many_requests
    assert_includes response.parsed_body["error"], "Too many login attempts"
  end
end

# test/rack_attack_test.rb
class RackAttackTest < ActionDispatch::IntegrationTest
  setup do
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
  end

  test "throttles excessive requests from single IP" do
    301.times do
      get api_v1_posts_path, headers: { "REMOTE_ADDR" => "1.2.3.4" }
    end

    assert_response 429
  end
end`,
		commonMistakes: [
			'Only rate limiting by IP (shared IPs like offices get blocked)',
			'Only rate limiting by user (unauthenticated abuse slips through)',
			'Not including Retry-After header in 429 responses',
			'Rate limiting static assets (wasted computation)',
			'Not having a safelist for health checks and monitoring endpoints',
			'Using MemoryStore in multi-process deployments (each process has its own counter)',
		],
		whenToUse:
			'Every production API. Use Rails 8 rate_limit for per-action limits and Rack::Attack for global IP-based protection.',
		furtherReading: [
			{
				title: 'Rails 8 rate_limit',
				url: 'https://api.rubyonrails.org/classes/ActionController/RateLimiting/ClassMethods.html',
			},
			{
				title: 'Rack::Attack',
				url: 'https://github.com/rack/rack-attack',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 7: Rate Limits with Rack::Attack',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use Rails 8 rate_limit on the controller for per-action limits, and add Rack::Attack for IP-level throttling. Write tests to verify both layers.',
	},
};

// ============================================
// Level 39: Soft Deletes & Audit Trails
// ============================================

const level39SoftDeletes: Level = {
	id: 'act6-level42-soft-deletes',
	actId: 6,
	levelNumber: 42,
	name: 'Soft Deletes & Audit Trails',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Admin accidentally deletes a user. No undo. No record of who changed what. Customer data is gone forever.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'A support admin ran User.find(42).destroy and the user is gone. No way to recover the data. No log of who did it or when. This is the third time this month.',
		rootCause:
			'Hard deletes permanently remove records. No audit trail tracks changes or who made them.',
		codeExample: `# Current code: hard delete
class Admin::UsersController < ApplicationController
  def destroy
    user = User.find(params[:id])
    user.destroy  # GONE FOREVER
    head :no_content
  end
end

# Rails console:
# User.find(42).destroy
# => #<User id: 42, email: "vip@customer.com">
# User.find(42)
# => ActiveRecord::RecordNotFound

# Questions we can't answer:
# - Who deleted this user?
# - When was it deleted?
# - What did the user record look like before deletion?
# - Can we undo it?

# All answers: "We don't know" and "No"`,
		goal: 'Implement soft deletes with the discard gem and audit trails with PaperTrail.',
		thresholds: {},
	},
	successConditions: [{ type: 'soft_deletes_configured' }],
	availableNodes: ['soft_delete', 'audit_trail'],
	unlockedNodes: ['audit_trail'],
	learningContent: {
		title: 'Soft Deletes & Audit Trails',
		goal: `In this level, you'll:\n- learn how to "delete" records without actually removing them from the database.\n- implement soft deletes using a deleted_at timestamp column.\n- use the discard gem to filter soft-deleted records transparently.\n- set up an audit trail that tracks who changed what and when for compliance and debugging.`,
		conceptExplanation: `**Soft deletes** mark records as deleted without removing them from the database. The record stays in the table with a \`discarded_at\` timestamp.

**Why soft deletes?**
- Undo accidental deletions
- Maintain referential integrity (foreign keys still work)
- Compliance requirements (data retention)
- Analytics on churned/deleted entities

**Audit trails** record every change to a model: who changed it, when, what changed, and the previous values.

**Why audit trails?**
- Regulatory compliance (SOX, HIPAA, GDPR)
- Debugging: "Who changed this setting?"
- Accountability: "Which admin deleted this?"
- Recovery: Restore to any previous state

**Gems:**
- \`discard\` for soft deletes (lightweight, provides explicit scopes like \`kept\` and \`with_discarded\`)
- \`paper_trail\` for audit trails (versioning with full change history)`,
		railsCodeExample: `# ============================
# Soft Deletes with Discard
# ============================

# Gemfile
gem "discard", "~> 1.3"
gem "paper_trail", "~> 15.0"

# Migration: add discarded_at column
class AddDiscardedAtToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :discarded_at, :datetime
    add_index :users, :discarded_at
  end
end

# app/models/user.rb
class User < ApplicationRecord
  include Discard::Model

  has_paper_trail

  # Discard does NOT add a default scope.
  # Use explicit scopes to filter:
  # User.kept returns non-discarded users
  # User.discarded returns only discarded users
  # User.with_discarded returns ALL users
end

# Usage:
user = User.find(42)
user.discard          # Sets discarded_at = Time.current
user.discarded?       # => true
user.undiscard        # Sets discarded_at = nil (undo!)

# Queries automatically exclude discarded:
User.count            # Only active users
User.with_discarded.count  # All users including discarded

# ============================
# Audit Trails with PaperTrail
# ============================

# Track who made the change (set in ApplicationController)
class ApplicationController < ActionController::API
  before_action :set_paper_trail_whodunnit

  private

  def user_for_paper_trail
    current_user&.id || "system"
  end
end

# PaperTrail tracks:
# - item_type, item_id (which record)
# - event (create, update, destroy/discard)
# - whodunnit (who did it)
# - object (previous version as YAML/JSON)
# - object_changes (what changed)
# - created_at (when)

# Usage:
user.versions                    # All changes
user.versions.last.whodunnit     # "admin_42"
user.versions.last.changeset     # { "email" => ["old@x.com", "new@x.com"] }

# Restore previous version:
user.paper_trail.previous_version.save!

# Travel to any point in time:
user.paper_trail.version_at(1.day.ago)

# ============================
# Admin Controller with Soft Delete + Audit
# ============================

class Admin::UsersController < ApplicationController
  def destroy
    user = User.find(params[:id])
    user.discard  # Soft delete (not destroy!)
    # PaperTrail records the change with whodunnit
    head :no_content
  end

  def restore
    user = User.with_discarded.find(params[:id])
    user.undiscard
    render json: UserSerializer.new(user).serializable_hash.to_json
  end

  def audit_log
    user = User.with_discarded.find(params[:id])
    versions = user.versions.map do |v|
      {
        event: v.event,
        who: v.whodunnit,
        when: v.created_at,
        changes: v.changeset
      }
    end
    render json: versions
  end
end

# config/routes.rb
namespace :admin do
  resources :users, only: [:index, :show, :destroy] do
    member do
      post :restore
      get :audit_log
    end
  end
end

# ============================
# Tests
# ============================

# test/models/user_test.rb
class UserTest < ActiveSupport::TestCase
  test "soft delete sets discarded_at instead of destroying" do
    user = users(:alice)
    user.discard

    assert user.discarded?
    assert_not_nil user.discarded_at
    assert User.with_discarded.exists?(user.id)
    assert_not User.kept.exists?(user.id)
  end

  test "undiscard restores a soft-deleted user" do
    user = users(:alice)
    user.discard
    user.undiscard

    assert_not user.discarded?
    assert_nil user.discarded_at
    assert User.kept.exists?(user.id)
  end

  test "paper_trail records who changed the user" do
    PaperTrail.request.whodunnit = "admin_1"
    user = users(:alice)
    user.update!(name: "Alice Updated")

    assert_equal "admin_1", user.versions.last.whodunnit
    assert_includes user.versions.last.changeset.keys, "name"
  end
end`,
		commonMistakes: [
			'Using destroy instead of discard (bypasses soft delete)',
			'Not adding an index on discarded_at (slow queries)',
			'Forgetting to scope associations with .kept (showing discarded records in has_many)',
			'Not setting whodunnit in PaperTrail (no accountability)',
			'Storing PaperTrail versions in the same database (bloats main DB over time)',
			'Not cleaning up old versions periodically',
		],
		whenToUse:
			'Soft deletes: Any user-facing data that might need recovery. Audit trails: Any data with compliance, accountability, or debugging requirements.',
		furtherReading: [
			{
				title: 'Discard Gem',
				url: 'https://github.com/jhawthorn/discard',
			},
			{
				title: 'PaperTrail Gem',
				url: 'https://github.com/paper-trail-gem/paper_trail',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add Soft Delete and Audit Trail nodes to the pipeline. Use discard for safe deletion and PaperTrail for change tracking. Write tests for both.',
	},
};

// ============================================
// Level 40: Safe Migrations
// ============================================

const level40SafeMigrations: Level = {
	id: 'act6-level43-safe-migrations',
	actId: 6,
	levelNumber: 43,
	name: 'Safe Migrations',
	trigger: {
		type: 'outage',
		description:
			'Deploy changes a column type on a large table. Locks the table for 30 seconds while rewriting every row. API returns 500s. 100K users affected.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Deploy ran a migration that changed a column type on a 5M row table. The table was locked for 30 seconds while every row was rewritten. All API requests to that table returned 500. Monitoring lit up.',
		rootCause:
			'Unsafe migration patterns that acquire exclusive locks on large tables during production traffic.',
		codeExample: `# The migration that caused the outage:
class ChangeViewsToBigint < ActiveRecord::Migration[8.0]
  def change
    # This locks the entire table while rewriting every row!
    change_column :posts, :views, :bigint
  end
end

# PostgreSQL acquires an ACCESS EXCLUSIVE lock:
# - No reads or writes while ALTER TABLE runs
# - 5M rows rewritten to change column type = ~30 seconds of downtime
# - All queries queue up, connections exhaust, 500s everywhere

# Other dangerous patterns:
add_index :users, :email                    # Locks table during index build
rename_column :users, :name, :full_name     # Breaks running app code
remove_column :users, :legacy_field         # Breaks running app code
# Note: add_column with a constant default is instant on PG 11+,
# but change_column type always rewrites the table.`,
		goal: 'Configure strong_migrations and apply zero-downtime migration patterns.',
		thresholds: {},
	},
	successConditions: [{ type: 'safe_migrations_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Safe Migrations with strong_migrations',
		goal: `In this level, you'll:\n- learn how to run database migrations safely in production without causing downtime.\n- use the strong_migrations gem to catch dangerous patterns before they reach production.\n- split risky operations like column renames into multiple deploys.\n- test migrations against production-sized datasets.`,
		conceptExplanation: `**The problem:** Many common migration operations lock tables in production, causing downtime.

**strong_migrations** catches dangerous migrations at development time and suggests safe alternatives.

**Key zero-downtime patterns:**

1. **Change column type:** Add new column with new type, backfill, swap (always rewrites the table)
2. **Add index:** Use \`algorithm: :concurrently\` (PostgreSQL) with \`disable_ddl_transaction!\`
3. **Remove column:** First deploy ignoring the column, then remove in a separate migration
4. **Rename column:** Add new column, backfill, update code, drop old column
5. **Add column with default (pre-PG 11):** Add column (no default) -> backfill -> change default. On PG 11+ with constant defaults, this is instant and safe.

**Rule of thumb:** If a migration touches a table with >100K rows, think twice.`,
		railsCodeExample: `# Gemfile
gem "strong_migrations"

# config/initializers/strong_migrations.rb
StrongMigrations.start_after = 20240101000000
StrongMigrations.target_postgresql_version = "16"

# ============================
# UNSAFE -> SAFE: change_column type
# ============================

# UNSAFE: Rewrites the entire table (locks it for duration)
class ChangeViewsToBigint < ActiveRecord::Migration[8.0]
  def change
    change_column :posts, :views, :bigint  # REWRITES ALL ROWS!
  end
end

# SAFE: Add new column, backfill, swap

# Step 1: Add new column (instant, no lock)
class AddViewsBigintToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :views_bigint, :bigint
  end
end

# Step 2: Backfill in batches (no lock, controlled DB load)
class BackfillViewsBigintOnPosts < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    Post.in_batches(of: 10_000) do |batch|
      batch.update_all("views_bigint = views")
      sleep(0.1)  # Reduce DB load between batches
    end
  end
end

# Step 3: Swap columns (rename old, rename new)
class SwapViewsColumns < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :posts, :views, :views_old
      rename_column :posts, :views_bigint, :views
    end
  end
end

# ============================
# UNSAFE -> SAFE: add_index
# ============================

# UNSAFE: Locks table during entire index build
class AddIndexToUsersEmail < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email  # LOCKS TABLE!
  end
end

# SAFE: Concurrent index (no lock, allows reads/writes)
class AddIndexToUsersEmail < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :users, :email, algorithm: :concurrently
  end
end

# ============================
# UNSAFE -> SAFE: remove_column
# ============================

# UNSAFE: Breaks running app code that references the column
class RemoveLegacyFieldFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :legacy_field  # Running code still references it!
  end
end

# SAFE: Two deploys
# Deploy 1: Tell Rails to ignore the column
class User < ApplicationRecord
  self.ignored_columns += ["legacy_field"]
end

# Deploy 2: After Deploy 1 is running on all servers
class RemoveLegacyFieldFromUsers < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :users, :legacy_field }
  end
end

# ============================
# UNSAFE -> SAFE: rename_column
# ============================

# UNSAFE: Breaks running app code instantly
class RenameNameToFullName < ActiveRecord::Migration[8.0]
  def change
    rename_column :users, :name, :full_name  # Old code crashes!
  end
end

# SAFE: Four deploys
# Deploy 1: Add new column
class AddFullNameToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :full_name, :string
  end
end
# Deploy 2: Backfill + write to both columns
# Deploy 3: Switch reads to new column
# Deploy 4: Drop old column

# ============================
# Verify strong_migrations catches issues
# ============================

# Run migrations in development:
# $ bin/rails db:migrate
#
# === Dangerous migration detected ===
# Adding a column with a non-null default blocks reads and writes
# while the entire table is rewritten.
#
# Instead, add the column without a default value, then change
# the default.
#
# class AddAdminToUsers < ActiveRecord::Migration[8.0]
#   def change
#     add_column :users, :admin, :boolean
#     change_column_default :users, :admin, false
#   end
# end`,
		commonMistakes: [
			'Running change_column type on large tables in production (rewrites every row)',
			'Adding indexes without CONCURRENTLY on tables with active traffic',
			'Removing columns before the app stops referencing them',
			'Not using disable_ddl_transaction! with concurrent operations',
			'Backfilling in one giant UPDATE instead of batches',
			'Forgetting to set ignored_columns before dropping a column',
		],
		whenToUse:
			'Every production Rails app with users. Install strong_migrations from day one. Apply zero-downtime patterns for any table over 10K rows.',
		furtherReading: [
			{
				title: 'strong_migrations',
				url: 'https://github.com/ankane/strong_migrations',
			},
			{
				title: 'Zero-Downtime Migrations',
				url: 'https://blog.codeship.com/zero-downtime-database-migrations/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use strong_migrations to catch unsafe patterns. Split dangerous migrations into safe multi-step operations.',
	},
};

// ============================================
// Level 41: Recurring Jobs & Scheduling
// ============================================

const level41RecurringJobs: Level = {
	id: 'act6-level44-recurring-jobs',
	actId: 6,
	levelNumber: 44,
	name: 'Recurring Jobs & Scheduling',
	requiresTests: true,
	trigger: {
		type: 'data_growth',
		description:
			'Expired tokens pile up. Old sessions never cleaned. Stale cache entries bloat the database. Need automated recurring maintenance.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'controller-node',
				type: 'controller',
				x: 200,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 400,
				y: 250,
				locked: true,
				config: { label: 'User' },
			},
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c2', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'Database has 2M expired session tokens, 500K orphaned records, and 100K stale cache entries. Storage growing 5% per week. Nobody cleans up because there is no automated maintenance.',
		rootCause:
			'No scheduled recurring jobs for data maintenance. Cleanup is manual and forgotten.',
		codeExample: `# The database is full of expired data:
Session.where("expires_at < ?", Time.current).count
# => 2,147,832

AuthToken.where("revoked_at < ?", 30.days.ago).count
# => 543,210

AuditLog.where("created_at < ?", 1.year.ago).count
# => 1,234,567

# Nobody runs cleanup because:
# 1. There's no automated scheduling
# 2. Cron jobs are fragile and not tracked
# 3. No visibility into job success/failure

# We need Solid Queue recurring tasks (Rails 8)
# to automate these maintenance operations.`,
		goal: 'Configure Solid Queue recurring tasks for automated data maintenance.',
		thresholds: {},
	},
	successConditions: [{ type: 'recurring_jobs_configured' }],
	availableNodes: ['background_job', 'scheduler'],
	unlockedNodes: ['scheduler'],
	learningContent: {
		title: 'Recurring Jobs with Solid Queue',
		goal: `In this level, you'll:\n- set up recurring background tasks using Solid Queue's built-in scheduler.\n- define jobs in config/recurring.yml with cron syntax.\n- use dedicated queues for maintenance tasks like cleanup and reporting.\n- learn why Solid Queue handles scheduling natively without needing external cron or Sidekiq.`,
		conceptExplanation: `**Solid Queue** is Rails 8's default background job processor. It runs entirely on SQL (no Redis needed) and supports recurring tasks natively.

**Why recurring tasks?**
- Data hygiene: Clean expired tokens, old sessions, orphaned records
- Maintenance: Rebuild search indexes, refresh materialized views
- Business logic: Send digest emails, generate reports, check subscriptions
- Monitoring: Health checks, metric aggregation

**Solid Queue recurring tasks vs cron:**
- Defined in YAML, version-controlled
- Runs inside your Rails app (access to models, mailers, etc.)
- Visible in the Solid Queue dashboard
- No external cron daemon to manage
- Automatic leader election (only one instance runs the task)

**Key concepts:**
- \`config/recurring.yml\` defines the schedule
- Jobs inherit from \`ApplicationJob\` as normal
- Schedule uses cron syntax or human-readable intervals
- Solid Queue handles leader election (no duplicate runs in multi-process)`,
		railsCodeExample: `# ============================
# config/recurring.yml
# ============================
production:
  cleanup_expired_sessions:
    class: CleanupExpiredSessionsJob
    schedule: every hour
    description: "Remove sessions expired more than 24 hours ago"

  cleanup_revoked_tokens:
    class: CleanupRevokedTokensJob
    schedule: "0 2 * * *"  # Daily at 2 AM (cron syntax)
    description: "Remove revoked auth tokens older than 30 days"

  cleanup_old_audit_logs:
    class: CleanupOldAuditLogsJob
    schedule: every Sunday at 3am
    description: "Archive audit logs older than 1 year"

  refresh_analytics:
    class: RefreshAnalyticsJob
    schedule: every 15 minutes
    description: "Refresh materialized views for dashboard"

  send_weekly_digest:
    class: SendWeeklyDigestJob
    schedule: every Monday at 9am
    description: "Send weekly activity digest to subscribed users"

  check_subscription_expirations:
    class: CheckSubscriptionExpirationsJob
    schedule: every day at midnight
    description: "Notify users with expiring subscriptions"

# ============================
# The Jobs
# ============================

# app/jobs/cleanup_expired_sessions_job.rb
class CleanupExpiredSessionsJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 24.hours.ago
    total_deleted = 0

    Session.where("expires_at < ?", cutoff)
           .in_batches(of: 10_000) do |batch|
      total_deleted += batch.delete_all
      sleep(0.1)  # Reduce DB pressure
    end

    Rails.logger.info(
      "[CleanupExpiredSessions] Removed #{total_deleted} expired sessions"
    )
  end
end

# app/jobs/cleanup_revoked_tokens_job.rb
class CleanupRevokedTokensJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 30.days.ago
    total_deleted = 0

    AuthToken.where("revoked_at < ?", cutoff)
             .in_batches(of: 5_000) do |batch|
      total_deleted += batch.delete_all
      sleep(0.1)
    end

    Rails.logger.info(
      "[CleanupRevokedTokens] Removed #{total_deleted} tokens older than #{cutoff}"
    )
  end
end

# app/jobs/cleanup_old_audit_logs_job.rb
class CleanupOldAuditLogsJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 1.year.ago
    total_archived = 0

    # Archive to cold storage before deleting
    AuditLog.where("created_at < ?", cutoff)
            .in_batches(of: 10_000) do |batch|
      ArchiveService.export(batch)
      total_archived += batch.delete_all
    end

    Rails.logger.info(
      "[CleanupOldAuditLogs] Archived #{total_archived} logs older than #{cutoff}"
    )
  end
end

# ============================
# Solid Queue Configuration
# ============================

# config/queue.yml
production:
  dispatchers:
    - polling_interval: 1
      batch_size: 500
      concurrency_maintenance_interval: 300
  workers:
    - queues: [default, mailers]
      threads: 5
      polling_interval: 0.1
    - queues: [maintenance]
      threads: 2
      polling_interval: 1

# Start Solid Queue:
# bin/jobs  (or bundle exec rake solid_queue:start)

# ============================
# Tests
# ============================

# test/jobs/cleanup_expired_sessions_job_test.rb
class CleanupExpiredSessionsJobTest < ActiveJob::TestCase
  test "removes sessions expired more than 24 hours ago" do
    expired = Session.create!(
      user: users(:alice),
      expires_at: 25.hours.ago
    )
    active = Session.create!(
      user: users(:bob),
      expires_at: 1.hour.from_now
    )

    CleanupExpiredSessionsJob.perform_now

    assert_not Session.exists?(expired.id)
    assert Session.exists?(active.id)
  end

  test "does not remove sessions expired less than 24 hours ago" do
    recent = Session.create!(
      user: users(:alice),
      expires_at: 23.hours.ago
    )

    CleanupExpiredSessionsJob.perform_now

    assert Session.exists?(recent.id)
  end
end

# test/jobs/cleanup_revoked_tokens_job_test.rb
class CleanupRevokedTokensJobTest < ActiveJob::TestCase
  test "removes tokens revoked more than 30 days ago" do
    old_token = AuthToken.create!(
      user: users(:alice),
      revoked_at: 31.days.ago
    )
    recent_token = AuthToken.create!(
      user: users(:bob),
      revoked_at: 1.day.ago
    )

    CleanupRevokedTokensJob.perform_now

    assert_not AuthToken.exists?(old_token.id)
    assert AuthToken.exists?(recent_token.id)
  end
end`,
		commonMistakes: [
			'Deleting all matching records in one query (locks table, OOM on large sets)',
			'Not using in_batches for large cleanup operations',
			'Running maintenance jobs on the default queue (blocks user-facing jobs)',
			'No logging or monitoring of recurring job success/failure',
			'Not archiving data before deletion (compliance risk)',
			'Using external cron when Solid Queue recurring tasks handle it natively',
		],
		whenToUse:
			'Any app that creates data with an expiration: sessions, tokens, logs, temporary records. Set up recurring cleanup from the start.',
		furtherReading: [
			{
				title: 'Solid Queue',
				url: 'https://github.com/rails/solid_queue',
			},
			{
				title: 'Active Job Basics',
				url: 'https://guides.rubyonrails.org/active_job_basics.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add a Scheduler node for Solid Queue recurring tasks. Define cleanup jobs in config/recurring.yml. Write tests to verify each job cleans the right records.',
	},
};

// ============================================
// Level 41.5: Data Lifecycle (NEW - inserted after Recurring Jobs)
// ============================================

const levelDataLifecycle: Level = {
	id: 'act6-level45-data-lifecycle',
	actId: 6,
	levelNumber: 45,
	name: 'Data Lifecycle',
	trigger: {
		type: 'data_growth',
		description:
			'The orders table has 50M rows. 95% are older than 1 year and never accessed. Queries are slow, backups fail, and migrations take hours.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'controller-node',
				type: 'controller',
				x: 200,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 400,
				y: 250,
				locked: true,
				config: { label: 'Order' },
			},
			{ id: 'database-node', type: 'database', x: 600, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c2', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'The database has 50M rows but only 2.5M are accessed regularly. Old data slows every query, backups fail, and migrations take hours.',
		rootCause:
			'No data lifecycle management. All data lives in the same hot storage forever, regardless of access patterns.',
		codeExample: `# The orders table has 50M rows
Order.count  # => 50,000,000

# But only 5% are accessed:
Order.where("created_at > ?", 1.year.ago).count  # => 2,500,000
Order.where("created_at < ?", 1.year.ago).count  # => 47,500,000

# Every query scans the full table:
# EXPLAIN: Seq Scan on orders (rows=50,000,000)
# Even indexed queries are slow; the index itself is 4GB

# Backups take 6 hours and sometimes fail
# pg_dump: 48GB uncompressed
# Migrations: ALTER TABLE on 50M rows = 30 minute lock

# The "assumed requirement" is keeping everything forever.
# But who actually needs a 3-year-old draft order?`,
		goal: 'Classify data by temperature (hot/warm/cold). Archive old data. Implement data destruction policies.',
		thresholds: {},
	},
	successConditions: [{ type: 'queries_optimized' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Data Lifecycle: Hot, Warm & Cold Data',
		goal: `In this level, you'll:\n- learn how to manage data as it ages.\n- classify data into hot (actively accessed), warm (read-only), and cold (archived) tiers.\n- move old data to cheaper storage or destroy it entirely.\n- understand why cleaning up unused data is the most impactful scalability optimization you can make.`,
		conceptExplanation: `Most apps never clean up old data. This is a production reality that separates hobby projects from scalable systems.

**Data temperature tiers:**
- **Hot (last 30 days):** Full access, fast queries, primary database. This is your active working set
- **Warm (30-365 days):** Read-only access, occasional lookups. Can live in a separate table or read replica
- **Cold (1yr+):** Export-only, compliance archives. Move to S3, separate DB, or delete entirely

**Performance impact (50M rows vs 2.5M rows):**
\`\`\`
Full table (50M rows):
  Index scan:   ~45ms (4GB index)
  Backup:       6 hours (48GB)
  Migration:    30 min (table lock)

After archiving (2.5M rows):
  Index scan:   ~3ms (200MB index) → 15x faster
  Backup:       20 minutes → 18x faster
  Migration:    30 seconds → 60x faster
\`\`\`

**The Gordian Knot metaphor:** The "assumed requirement" is keeping everything forever. Challenge it. Destroying data is the most effective scalability solution: if the data isn't there, you don't need to query it, index it, back it up, or migrate it.

**Archiving strategies for warm data:**
- **Separate table** (\`archived_orders\`): SQL queries still work. Easy to re-query if needed
- **Redis with AOF persistence**: Key-value access, fast reads for specific lookups
- **S3/object storage**: Cheapest. Export-only. Good for compliance archives
- **Separate database**: Full SQL, but isolated from hot data. Use for analytics

**Data destruction best practices:**
- Define retention policies per data type (orders: 2 years, logs: 90 days, sessions: 30 days)
- Use recurring jobs (Solid Queue) to enforce retention automatically
- Archive before destroying (compliance safety net)
- Delete in batches with \`in_batches\` to avoid table locks`,
		railsCodeExample: `# === Step 1: Classify data by temperature ===

# app/models/concerns/data_lifecycle.rb
module DataLifecycle
  extend ActiveSupport::Concern

  included do
    scope :hot,  -> { where("created_at > ?", 30.days.ago) }
    scope :warm, -> { where(created_at: 1.year.ago..30.days.ago) }
    scope :cold, -> { where("created_at < ?", 1.year.ago) }
  end
end

class Order < ApplicationRecord
  include DataLifecycle
end

# === Step 2: Archive warm data ===

# app/jobs/archive_old_orders_job.rb
class ArchiveOldOrdersJob < ApplicationJob
  queue_as :maintenance

  def perform
    cutoff = 1.year.ago
    total_archived = 0

    Order.cold.in_batches(of: 5_000) do |batch|
      # Export to S3 or separate table
      ArchiveService.export_batch(batch, table: :archived_orders)
      total_archived += batch.delete_all
      sleep(0.1)  # Reduce DB pressure
    end

    Rails.logger.info(
      "[ArchiveOldOrders] Archived #{total_archived} orders older than #{cutoff}"
    )
  end
end

# === Step 3: Separate archived table ===

class CreateArchivedOrders < ActiveRecord::Migration[8.0]
  def change
    create_table :archived_orders do |t|
      t.references :user, null: false
      t.decimal :total, precision: 10, scale: 2
      t.string :status
      t.jsonb :snapshot  # Full order data as JSON
      t.datetime :original_created_at
      t.timestamps
    end
    add_index :archived_orders, :original_created_at
    add_index :archived_orders, :user_id
  end
end

# === Step 4: Retention policy enforcement ===

# config/recurring.yml
production:
  archive_old_orders:
    class: ArchiveOldOrdersJob
    schedule: every Sunday at 2am
    description: "Archive orders older than 1 year"

  destroy_expired_sessions:
    class: DestroyExpiredSessionsJob
    schedule: every hour
    description: "Delete sessions older than 30 days"

  cleanup_old_audit_logs:
    class: CleanupOldAuditLogsJob
    schedule: every Sunday at 3am
    description: "Delete audit logs older than 2 years"

# === Step 5: Query optimization after archiving ===

# Before: 50M rows, 4GB index
Order.where(status: "shipped").order(created_at: :desc).limit(25)
# Seq Scan on orders (cost=0.00..2500000.00 rows=50000000)

# After: 2.5M rows, 200MB index
Order.where(status: "shipped").order(created_at: :desc).limit(25)
# Index Scan using index_orders_on_status_created_at (rows=125000)`,
		commonMistakes: [
			'Keeping all data forever without questioning the requirement',
			'Deleting data in one giant DELETE (locks the table for minutes)',
			'Not archiving before destroying (no recovery path)',
			'Archiving to the same database (does not reduce backup size)',
			'Not automating retention with recurring jobs (manual cleanup is forgotten)',
		],
		whenToUse:
			'Any app with growing data that is accessed less frequently over time: orders, logs, sessions, audit trails, notifications. Start thinking about data lifecycle when your largest table exceeds 10M rows.',
		furtherReading: [
			{
				title: 'PostgreSQL Partitioning',
				url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 7: Hot/Warm/Cold Data & Archiving',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Classify your data into hot (30 days), warm (30-365 days), and cold (1yr+). Archive cold data to a separate table. Automate with recurring jobs.',
	},
};

// ============================================
// Level 42: Structured Error Monitoring
// ============================================

const level42ErrorMonitoring: Level = {
	id: 'act6-level46-error-monitoring',
	actId: 6,
	levelNumber: 46,
	name: 'Structured Error Monitoring',
	trigger: {
		type: 'user_complaint',
		description:
			'500 errors in production but nobody notices until users complain on Twitter. Need structured error tracking with context, grouping, and alerting.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Production logs show intermittent 500 errors but the team only finds out when users tweet about it. Errors lack context: no user ID, no request params, no breadcrumbs showing what led to the failure.',
		rootCause:
			'No structured error monitoring. Errors go to stdout logs with no grouping, alerting, or context.',
		codeExample: `# Current error handling: nothing
class Api::V1::PostsController < ApplicationController
  def show
    post = Post.find(params[:id])
    render json: PostSerializer.new(post).serializable_hash.to_json
  end
  # ActiveRecord::RecordNotFound => 500 Internal Server Error
  # No context, no alert, no grouping
end

# Production log:
# [ERROR] ActiveRecord::RecordNotFound: Couldn't find Post with 'id'=999
# ...and that's it. No user context, no request ID, no breadcrumbs.

# Questions we can't answer:
# - How many users are affected?
# - Is this a new error or recurring?
# - What was the user doing when it happened?
# - Is this getting worse or better?
# - Are we within our error budget?`,
		goal: 'Implement structured error monitoring with context, grouping, alerting, and error budgets.',
		thresholds: { maxErrorRate: 0.005 },
	},
	successConditions: [{ type: 'error_monitoring_configured' }],
	availableNodes: ['error_monitor'],
	unlockedNodes: ['error_monitor'],
	learningContent: {
		title: 'Structured Error Monitoring & SLOs',
		goal: `In this level, you'll:\n- set up structured error monitoring so you know when things break in production before your users tell you.\n- use Rails.error.handle and Rails.error.record to report errors with context like user ID and request ID.\n- route errors to services like Sentry for grouping, alerting, and prioritization.`,
		conceptExplanation: `**Error monitoring** transforms raw exceptions into actionable insights:

**Without SLOs:**
\`\`\`
PagerDuty fires at 3 AM: "High error rate"
Team: "Is this a real problem or a blip?"
      "What's the normal error rate?"
      "Should we wake more people up?"
No answers. Every alert feels equally urgent.
\`\`\`

**With SLOs:**
\`\`\`
SLO:           p95 latency ≤ 200ms, 99% of the time, 30-day rolling window
Current:       99.3%, within budget
Error budget:  0.3% remaining (was 1%)
Alert:         "Error budget at 30%, freeze risky deploys"
Decision:      Clear, data-driven, no guesswork
\`\`\`

**SLOs, SLIs, and error budgets explained:**
- **SLI (Service Level Indicator):** The metric being measured (e.g., latency p95)
- **SLO (Service Level Objective):** The goal (e.g., p95 ≤ 200ms, 99% of the time over 30-day window)
- **SLA (Service Level Agreement):** Contractual agreement with customers (consequences if breached)
- **Error budget:** If SLO is 99%, you have 1% budget for failures. Spend it on risky deploys/experiments. When exhausted → freeze features, fix reliability

**Latency percentiles (measure what matters):**
- **p50 (median):** Half of requests faster, half slower. Hides tail latency
- **p75:** 75% of requests faster than this value
- **p90:** 90% of requests. Starting to see edge cases
- **p95 (industry standard):** Captures the experience of 1-in-20 users. Alert on this, not averages
- **p99:** Worst 1%. Often reveals infrastructure problems
- **p99.9:** Extreme outliers. GC pauses, network hiccups, cold caches
- **Why not averages?** A 200ms average can hide a p99 of 5 seconds. Averages lie; percentiles reveal the tail

**Monitoring cost warning:** Coinbase spent $65M/year on Datadog. Temporary metrics from old projects linger forever. Review periodically and delete unused dashboards and metrics.

**Key capabilities:**
- **Grouping:** Same error type from different users grouped together
- **Context:** User ID, request params, breadcrumbs attached to every error
- **Alerting:** Slack/PagerDuty notifications when error rate spikes
- **Trends:** Is this error getting worse or better over time?

**Layers of error handling:**
1. **Rescue + respond:** Handle known errors gracefully (404, 422)
2. **Report:** Send unknown errors to monitoring service
3. **Context:** Attach user, request, and breadcrumb data
4. **Alert:** Notify the team based on severity and frequency
5. **Budget:** Track error rate against SLO targets

**Rails 8 ErrorReporter:**
Rails 8 has a built-in \`Rails.error\` reporter that integrates with external services (Sentry, Honeybadger, etc.).`,
		railsCodeExample: `# ============================
# Rails 8 Error Reporter Setup
# ============================

# config/initializers/error_reporting.rb
# Rails 8 built-in error reporter with custom subscriber
Rails.error.subscribe(ErrorSubscriber.new)

# app/lib/error_subscriber.rb
class ErrorSubscriber
  def report(error, handled:, severity:, context:, source: nil)
    # Send to Sentry (or Honeybadger, Bugsnag, etc.)
    Sentry.capture_exception(error, extra: context)

    # Also log structured JSON
    Rails.logger.error({
      error: error.class.name,
      message: error.message,
      handled: handled,
      severity: severity,
      context: context,
      source: source,
      backtrace: error.backtrace&.first(10)
    }.to_json)
  end
end

# ============================
# Structured Error Handling
# ============================

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  # Set error context for every request
  before_action :set_error_context

  # Handle known errors gracefully (don't send to error tracker)
  rescue_from ActiveRecord::RecordNotFound do |e|
    render json: { error: "Not found" }, status: :not_found
  end

  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { errors: e.record.errors }, status: :unprocessable_entity
  end

  rescue_from ActionController::ParameterMissing do |e|
    render json: { error: e.message }, status: :bad_request
  end

  private

  def set_error_context
    Rails.error.set_context(
      user_id: current_user&.id,
      request_id: request.request_id,
      ip: request.remote_ip,
      path: request.path,
      method: request.method,
      user_agent: request.user_agent
    )
  end
end

# ============================
# Using Rails.error in Application Code
# ============================

class Api::V1::PostsController < ApplicationController
  def create
    post = Post.new(post_params)

    # Rails.error.handle: captures error but continues execution
    Rails.error.handle(fallback: nil) do
      NotificationService.notify_followers(post.author)
    end

    if post.save
      render json: PostSerializer.new(post).serializable_hash.to_json, status: :created
    else
      render json: { errors: post.errors }, status: :unprocessable_entity
    end
  end
end

class PaymentService
  def process(order)
    # Rails.error.record: captures error AND re-raises it
    Rails.error.record(severity: :error, context: { order_id: order.id }) do
      gateway.charge(order.total_cents)
    end
  end
end

# ============================
# Error Budgets with Recurring Job
# ============================

# app/jobs/error_budget_check_job.rb
class ErrorBudgetCheckJob < ApplicationJob
  # SLO: 99.9% success rate (0.1% error budget)
  ERROR_BUDGET = 0.001

  def perform
    window = 1.hour.ago..Time.current
    total = RequestLog.where(created_at: window).count
    errors = RequestLog.where(created_at: window, status: 500..599).count

    return if total.zero?

    error_rate = errors.to_f / total

    if error_rate > ERROR_BUDGET
      AlertService.fire!(
        severity: :critical,
        message: "Error budget exceeded: #{(error_rate * 100).round(3)}% " \\
                 "(budget: #{(ERROR_BUDGET * 100).round(3)}%)",
        details: {
          total_requests: total,
          error_count: errors,
          error_rate: error_rate,
          budget: ERROR_BUDGET
        }
      )
    end

    # Log for dashboard regardless
    Rails.logger.info({
      event: "error_budget_check",
      total_requests: total,
      error_count: errors,
      error_rate: error_rate.round(6),
      budget: ERROR_BUDGET,
      within_budget: error_rate <= ERROR_BUDGET
    }.to_json)
  end
end

# config/recurring.yml
production:
  error_budget_check:
    class: ErrorBudgetCheckJob
    schedule: every 5 minutes
    description: "Check error rate against SLO budget"

# ============================
# Sentry Configuration (Rails 8)
# ============================

# Gemfile
gem "sentry-ruby"
gem "sentry-rails"

# config/initializers/sentry.rb
Sentry.init do |config|
  config.dsn = Rails.application.credentials.sentry_dsn
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = 0.1  # 10% of requests traced
  config.profiles_sample_rate = 0.1

  config.environment = Rails.env
  config.release = ENV.fetch("GIT_SHA", "unknown")

  # Filter sensitive params before sending
  config.before_send = lambda do |event, hint|
    event.request&.data&.except!("password", "token", "secret", "api_key")
    event
  end

  # Don't send common expected errors
  config.excluded_exceptions += [
    "ActionController::RoutingError",
    "ActiveRecord::RecordNotFound"
  ]
end`,
		commonMistakes: [
			'Rescuing StandardError globally (hides real bugs)',
			'Not attaching user context to error reports',
			'Alerting on every single error (alert fatigue)',
			'No error budgets or SLOs (no way to measure reliability)',
			'Logging errors as unstructured text (impossible to query)',
			'Not filtering sensitive data before sending to error service',
			'Sending expected errors (404, 422) to the error tracker (noise)',
		],
		whenToUse:
			'Every production application. Set up error monitoring before launch, not after the first outage.',
		furtherReading: [
			{
				title: 'Rails Error Reporting',
				url: 'https://guides.rubyonrails.org/error_reporting.html',
			},
			{
				title: 'Sentry for Rails',
				url: 'https://docs.sentry.io/platforms/ruby/guides/rails/',
			},
			{
				title: 'Google SRE Book: SLOs',
				url: 'https://sre.google/sre-book/service-level-objectives/',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 8: SLOs, SLIs, Error Budgets',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add an Error Monitor node connected to the controller. Use Rails.error with context and set up alerting with error budgets.',
	},
};

// ============================================
// Act 6 Definition
// ============================================

export const actSix: Act = {
	id: 6,
	name: 'Reliability',
	tagline: '100K users. Outages hurt.',
	description:
		'Build reliability features: custom middleware, rate limiting with Rails 8 built-in rate_limit, soft deletes, safe migrations, Solid Queue recurring jobs, and structured error monitoring.',
	levels: [
		level37Middleware,
		level38RateLimiting,
		level39SoftDeletes,
		level40SafeMigrations,
		level41RecurringJobs,
		levelDataLifecycle,
		level42ErrorMonitoring,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};

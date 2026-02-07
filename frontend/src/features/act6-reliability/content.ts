/**
 * Act 6: Reliability
 * "100K users. Outages hurt."
 *
 * Levels 37-42: Middleware & Rack, Rate Limiting, Soft Deletes & Audit Trails,
 *               Safe Migrations, Recurring Jobs & Scheduling, Structured Error Monitoring
 * App context: Production SaaS
 */

import type { Act, Level } from "@/types";

// ============================================
// Level 37: Middleware & Rack
// ============================================

const level37Middleware: Level = {
	id: 'act6-level37-middleware',
	actId: 6,
	levelNumber: 37,
	name: 'Middleware & Rack',
	trigger: {
		type: 'incident',
		description:
			'Need request logging, bot detection, and request ID tracking before requests hit Rails. The default middleware stack is not enough.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 300, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 500, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 700, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 900, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 700, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
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
	successConditions: [
		{ type: 'middleware_configured' },
	],
	availableNodes: ['middleware'],
	unlockedNodes: ['middleware'],
	learningContent: {
		title: 'Rack Middleware Stack',
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
	id: 'act6-level38-rate-limiting',
	actId: 6,
	levelNumber: 38,
	name: 'Rate Limiting',
	requiresTests: true,
	trigger: {
		type: 'attack',
		description:
			'Bots hammer the API. 10K req/sec from one IP. The login endpoint is getting brute-forced. Need to throttle by IP and by user.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'middleware-node', type: 'middleware', x: 240, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 400, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 560, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 740, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 920, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 740, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'middleware-node' },
			{ id: 'c2', sourceNodeId: 'middleware-node', targetNodeId: 'router-node' },
			{ id: 'c3', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c6', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
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
	successConditions: [
		{ type: 'rate_limiting_configured' },
	],
	availableNodes: ['rate_limiter'],
	unlockedNodes: ['rate_limiter'],
	learningContent: {
		title: 'Rate Limiting: Rails 8 Built-in & Rack::Attack',
		conceptExplanation: `Rate limiting protects your app at multiple layers:

**Rails 8 built-in \`rate_limit\`:**
- Declarative, per-controller macro
- Uses Solid Cache or MemoryStore by default
- Simple to configure for specific actions
- Returns 429 Too Many Requests automatically

**Rack::Attack (Rack-level):**
- IP-based throttling (blocks before Rails processes)
- Safelist/blocklist for known good/bad actors
- Multiple throttle rules for different endpoints
- Custom responses and logging

**Strategies:**
- Fixed window: N requests per time period (simplest)
- Sliding window: Smoother, prevents burst at window boundaries
- Token bucket: Allows controlled bursts
- Leaky bucket: Constant drain rate

**Defense in depth:** Use both Rails 8 \`rate_limit\` for controller-specific limits AND Rack::Attack for IP-level protection.`,
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
	id: 'act6-level39-soft-deletes',
	actId: 6,
	levelNumber: 39,
	name: 'Soft Deletes & Audit Trails',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Admin accidentally deletes a user. No undo. No record of who changed what. Customer data is gone forever.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 660, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 860, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
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
	successConditions: [
		{ type: 'soft_deletes_configured' },
	],
	availableNodes: ['soft_delete', 'audit_trail'],
	unlockedNodes: ['audit_trail'],
	learningContent: {
		title: 'Soft Deletes & Audit Trails',
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
- \`discard\` for soft deletes (lightweight, uses default scopes)
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

  # Default scope excludes discarded records
  # User.all only returns non-discarded users
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
    render json: UserBlueprint.render(user)
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
			'Forgetting to use default scope in associations (showing discarded records)',
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
	id: 'act6-level40-safe-migrations',
	actId: 6,
	levelNumber: 40,
	name: 'Safe Migrations',
	trigger: {
		type: 'outage',
		description:
			'Deploy adds a column with a default value. Locks the users table for 30 seconds. API returns 500s. 100K users affected.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 460, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 660, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 860, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 660, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c5', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'Deploy ran a migration that added a column with a default to a 5M row table. The table was locked for 30 seconds. All API requests to that table returned 500. Monitoring lit up.',
		rootCause:
			'Unsafe migration patterns that acquire exclusive locks on large tables during production traffic.',
		codeExample: `# The migration that caused the outage:
class AddAdminToUsers < ActiveRecord::Migration[8.0]
  def change
    # This locks the entire users table while rewriting every row!
    add_column :users, :admin, :boolean, default: false
  end
end

# PostgreSQL acquires an ACCESS EXCLUSIVE lock:
# - No reads or writes while ALTER TABLE runs
# - 5M rows x ~6us/row = ~30 seconds of downtime
# - All queries queue up, connections exhaust, 500s everywhere

# Other dangerous patterns:
add_index :users, :email                    # Locks table during index build
rename_column :users, :name, :full_name     # Breaks running app code
change_column :posts, :views, :bigint       # Rewrites entire table
remove_column :users, :legacy_field         # Breaks running app code`,
		goal: 'Configure strong_migrations and apply zero-downtime migration patterns.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'safe_migrations_configured' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Safe Migrations with strong_migrations',
		conceptExplanation: `**The problem:** Many common migration operations lock tables in production, causing downtime.

**strong_migrations** catches dangerous migrations at development time and suggests safe alternatives.

**Key zero-downtime patterns:**

1. **Add column with default:** Add column (no default) -> backfill in batches -> change column default
2. **Add index:** Use \`algorithm: :concurrently\` (PostgreSQL) with \`disable_ddl_transaction!\`
3. **Remove column:** First deploy ignoring the column, then remove in a separate migration
4. **Rename column:** Add new column, backfill, update code, drop old column
5. **Change column type:** Add new column with new type, backfill, swap

**Rule of thumb:** If a migration touches a table with >100K rows, think twice.`,
		railsCodeExample: `# Gemfile
gem "strong_migrations"

# config/initializers/strong_migrations.rb
StrongMigrations.start_after = 20240101000000
StrongMigrations.target_postgresql_version = "16"

# ============================
# UNSAFE -> SAFE: add_column with default
# ============================

# UNSAFE: Locks the table while rewriting every row
class AddAdminToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :admin, :boolean, default: false  # LOCKS TABLE!
  end
end

# SAFE: Three-step migration (zero downtime)

# Step 1: Add column without default (instant, no lock)
class AddAdminToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :admin, :boolean
  end
end

# Step 2: Backfill in batches (no lock, controlled DB load)
class BackfillAdminOnUsers < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    User.in_batches(of: 10_000) do |batch|
      batch.update_all(admin: false)
      sleep(0.1)  # Reduce DB load between batches
    end
  end
end

# Step 3: Add default for future rows (instant in PG 11+)
class AddDefaultAdminToUsers < ActiveRecord::Migration[8.0]
  def change
    change_column_default :users, :admin, from: nil, to: false
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
			'Running add_column with default on large tables in production',
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
	id: 'act6-level41-recurring-jobs',
	actId: 6,
	levelNumber: 41,
	name: 'Recurring Jobs & Scheduling',
	requiresTests: true,
	trigger: {
		type: 'data_growth',
		description:
			'Expired tokens pile up. Old sessions never cleaned. Stale cache entries bloat the database. Need automated recurring maintenance.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'controller-node', type: 'controller', x: 200, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 400, y: 250, locked: true, config: { label: 'User' } },
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
	successConditions: [
		{ type: 'recurring_jobs_configured' },
	],
	availableNodes: ['background_job', 'scheduler'],
	unlockedNodes: ['scheduler'],
	learningContent: {
		title: 'Recurring Jobs with Solid Queue',
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
// Level 42: Structured Error Monitoring
// ============================================

const level42ErrorMonitoring: Level = {
	id: 'act6-level42-error-monitoring',
	actId: 6,
	levelNumber: 42,
	name: 'Structured Error Monitoring',
	trigger: {
		type: 'user_complaint',
		description:
			'500 errors in production but nobody notices until users complain on Twitter. Need structured error tracking with context, grouping, and alerting.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'middleware-node', type: 'middleware', x: 240, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 400, y: 250, locked: true },
			{ id: 'controller-node', type: 'controller', x: 560, y: 250, locked: true },
			{ id: 'model-node', type: 'model', x: 740, y: 250, locked: true, config: { label: 'User' } },
			{ id: 'database-node', type: 'database', x: 920, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 740, y: 420, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'middleware-node' },
			{ id: 'c2', sourceNodeId: 'middleware-node', targetNodeId: 'router-node' },
			{ id: 'c3', sourceNodeId: 'router-node', targetNodeId: 'controller-node' },
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{ id: 'c6', sourceNodeId: 'controller-node', targetNodeId: 'response-node' },
		],
	},
	problem: {
		observation:
			'Production logs show intermittent 500 errors but the team only finds out when users tweet about it. Errors lack context: no user ID, no request params, no breadcrumbs showing what led to the failure.',
		rootCause:
			'No structured error monitoring. Errors go to stdout logs with no grouping, alerting, or context.',
		codeExample: `# Current error handling: nothing
class Api::V1::PostsController < ApplicationController
  def show
    post = Post.find(params[:id])
    render json: PostBlueprint.render(post)
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
	successConditions: [
		{ type: 'error_monitoring_configured' },
	],
	availableNodes: ['error_monitor'],
	unlockedNodes: ['error_monitor'],
	learningContent: {
		title: 'Structured Error Monitoring',
		conceptExplanation: `**Error monitoring** transforms raw exceptions into actionable insights:

**Key capabilities:**
- **Grouping:** Same error type from different users grouped together
- **Context:** User ID, request params, breadcrumbs attached to every error
- **Alerting:** Slack/PagerDuty notifications when error rate spikes
- **Trends:** Is this error getting worse or better over time?
- **Error budgets:** "We allow 0.1% error rate. Currently at 0.05%."

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
      render json: PostBlueprint.render(post), status: :created
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
		level42ErrorMonitoring,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};

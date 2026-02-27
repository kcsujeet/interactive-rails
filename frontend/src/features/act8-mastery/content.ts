/**
 * Act 8: Mastery
 * "Architect entire systems."
 *
 * Levels 53-55: API Gateway, Database Sharding, The Architect (Capstone)
 * The final act: system-level architecture
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 47: API Gateway
// ============================================

const level48APIGateway: Level = {
	id: 'act8-level53-api-gateway',
	actId: 8,
	levelNumber: 53,
	name: 'API Gateway',
	trigger: {
		type: 'architecture',
		description:
			'Multiple internal services, each handling authentication differently. Mobile clients call six endpoints on three different hosts. Need a single entry point with unified auth.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Mobile app makes 6 HTTP calls to 3 different services to render one screen. Each service has its own auth scheme. Latency compounds with each sequential call.',
		rootCause:
			'No API gateway. Clients connect directly to internal services with no aggregation, no unified authentication, and no request routing.',
		codeExample: `# Current: Client calls each service directly
# Mobile app does 6 calls for the dashboard screen:

# Call 1: GET https://users.internal/api/v1/me
#   Auth: Bearer token (JWT)
# Call 2: GET https://orders.internal/api/v1/orders?user=42
#   Auth: API key header
# Call 3: GET https://inventory.internal/api/v1/stock?items=1,2,3
#   Auth: Basic auth
# Call 4: GET https://notifications.internal/api/v1/unread
#   Auth: Bearer token (different issuer!)
# Call 5: GET https://analytics.internal/api/v1/insights
#   Auth: OAuth2
# Call 6: GET https://billing.internal/api/v1/subscription
#   Auth: HMAC signature

# Problems:
# - 6 round trips = high latency (especially on mobile)
# - Client knows about internal service topology
# - Auth is inconsistent across services
# - No rate limiting at the edge
# - Internal services exposed to the internet`,
		goal: 'Implement an API gateway for unified auth, request routing, and response aggregation.',
		thresholds: {
			maxLatency: 150,
		},
	},
	successConditions: [{ type: 'api_gateway_configured' }],
	availableNodes: ['api_gateway', 'rate_limiter'],
	unlockedNodes: ['api_gateway'],
	learningContent: {
		title: 'API Gateway Pattern',
		goal: `In this level, you'll:\n- learn the API gateway pattern, where a single entry point routes requests to the right microservice.\n- centralize cross-cutting concerns like authentication, rate limiting, and logging at the gateway layer.\n- understand how gateways translate between protocols like REST, gRPC, and WebSocket.`,
		conceptExplanation: `An API gateway is the single entry point for all client requests.

**Responsibilities:**
- **Request routing:** Route /api/users/* to the users service, /api/orders/* to orders
- **Authentication:** Verify tokens once at the edge, pass user context downstream
- **Rate limiting:** Protect internal services from abuse
- **Response aggregation:** Combine multiple service responses into one
- **Protocol translation:** REST to gRPC, WebSocket to HTTP, etc.

**Gateway vs. BFF (Backend for Frontend):**
- Gateway: Generic routing for all clients
- BFF: Tailored aggregation per client type (mobile BFF, web BFF)

**Options:**
- Rails app as gateway (simple, full control)
- Kong / AWS API Gateway (infrastructure-level)
- GraphQL as a gateway layer`,
		railsCodeExample: `# Gateway as a Rails app
# app/controllers/api/gateway_controller.rb
class Api::GatewayController < ApplicationController
  before_action :authenticate_at_edge!
  before_action :rate_limit!

  # GET /api/dashboard (aggregates from multiple services)
  def dashboard
    # Parallel service calls with resilient fetching
    user = fetch_or_default { UserClient.profile(current_user.id) }
    orders = fetch_or_default([]) { OrderClient.recent(current_user.id, limit: 5) }
    notifications = fetch_or_default(0) { NotificationClient.unread_count(current_user.id) }
    subscription = fetch_or_default { BillingClient.subscription(current_user.id) }

    render json: {
      user: user,
      recent_orders: orders,
      unread_notifications: notifications,
      subscription: subscription
    }
  end

  # Fetch with fallback: isolates each service call
  def fetch_or_default(fallback = { error: 'unavailable' })
    yield
  rescue ServiceUnavailableError
    fallback
  end

  private

  # Single auth check at the edge
  def authenticate_at_edge!
    token = request.headers['Authorization']&.split(' ')&.last
    @current_user_context = JwtService.decode(token)

    # Pass user context to downstream services via headers
    RequestContext.current = @current_user_context
  rescue JWT::DecodeError
    render json: { error: 'Unauthorized' }, status: :unauthorized
  end

  # Rate limiting at the edge
  def rate_limit!
    key = "rate_limit:#{current_user.id}"
    count = Rails.cache.increment(key, 1, expires_in: 1.minute)

    if count > 100
      render json: { error: 'Rate limit exceeded' }, status: :too_many_requests
    end
  end
end

# Service client with circuit breaker
# app/clients/order_client.rb
class OrderClient
  include CircuitBreaker

  circuit_breaker failure_threshold: 5,
                  reset_timeout: 30.seconds

  def self.recent(user_id, limit: 10)
    response = HTTParty.get(
      "#{ENV['ORDER_SERVICE_URL']}/api/v1/orders",
      query: { user_id: user_id, limit: limit },
      headers: { 'X-Request-Id' => Current.request_id },
      timeout: 5
    )
    response.parsed_response
  end
end

# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    get 'dashboard', to: 'gateway#dashboard'

    # Route proxying
    match 'users/*path', to: 'proxy#forward',
          via: :all, defaults: { service: 'users' }
    match 'orders/*path', to: 'proxy#forward',
          via: :all, defaults: { service: 'orders' }
  end
end`,
		commonMistakes: [
			'Gateway becomes a monolith with business logic (keep it thin)',
			'No circuit breakers for downstream services (cascading failures)',
			'Single point of failure (deploy multiple gateway instances)',
			'Not propagating request IDs for distributed tracing',
		],
		whenToUse:
			'When clients need a single entry point to multiple internal services.',
		furtherReading: [
			{
				title: 'API Gateway Pattern',
				url: 'https://microservices.io/patterns/apigateway.html',
			},
			{
				title: 'Kong Gateway',
				url: 'https://docs.konghq.com/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Build a thin gateway that authenticates at the edge, routes requests, and aggregates responses.',
	},
};

// ============================================
// Level 48: Database Sharding
// ============================================

const level49Sharding: Level = {
	id: 'act8-level54-sharding',
	actId: 8,
	levelNumber: 54,
	name: 'Database Sharding',
	trigger: {
		type: 'scaling',
		description:
			'10M users. Single database at capacity. Writes are bottlenecked. Vertical scaling has hit its ceiling. Time to shard by tenant.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write throughput plateaued. Largest table has 2 billion rows. Migrations take hours. Backups are failing. Single PostgreSQL instance at maximum IOPS.',
		rootCause:
			'Single database cannot handle the write volume. Vertical scaling is maxed out. Data must be horizontally partitioned across multiple database servers.',
		codeExample: `# Current: Single database, 2B rows, write bottleneck
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# The orders table alone has 800M rows
# INSERT latency: 200ms+ (was 5ms a year ago)
# Index rebuilds: 4+ hours
# pg_dump: fails after 6 hours (out of disk)
# Autovacuum: cannot keep up

# Even with read replicas, WRITES are the bottleneck
# Cannot add more write capacity to a single server`,
		goal: 'Implement horizontal sharding by tenant so writes are distributed across multiple databases.',
		thresholds: {
			maxLatency: 100,
		},
	},
	successConditions: [{ type: 'sharding_configured' }],
	availableNodes: ['shard', 'shard_router'],
	unlockedNodes: ['shard', 'shard_router'],
	learningContent: {
		title: 'Horizontal Database Sharding',
		goal: `In this level, you'll:\n- learn how to scale beyond a single database by splitting data across multiple shards.\n- choose a shard key like tenant_id that keeps related data together.\n- configure Rails' connects_to with multiple shards.\n- set up automatic query routing so your application reads and writes to the correct shard transparently.`,
		conceptExplanation: `Sharding splits data across multiple database servers (shards).

**The capacity wall (without sharding):**
\`\`\`
Orders table:    2 billion rows, 800M in largest table
INSERT latency:  200ms+ (was 5ms a year ago)
Index rebuilds:  4+ hours
pg_dump:         Fails after 6 hours (out of disk)
Autovacuum:      Cannot keep up
Even with read replicas → WRITES are the bottleneck
\`\`\`

**With sharding (3 shards by tenant_id):**
\`\`\`
Each shard:      ~660M rows (manageable)
INSERT latency:  ~5ms (back to normal)
Shard selection: company_id % 3 → shard_one/shard_two/shard_three
\`\`\`

**ShardRecord abstract class pattern:**
Only sharded models inherit from \`ShardRecord\`. Global models (users, tenants) stay on \`ApplicationRecord\`. This is critical: you cannot shard the users table because login must work cross-shard.

**Shard key selection is critical:**
- Tenant ID (company_id): Natural for B2B SaaS, all tenant data on one shard
- User ID: Good for consumer apps, even distribution
- Geographic region: Good for data sovereignty requirements

**Middleware-based shard switching:**
Middleware detects company_id from JWT/subdomain, connects to the correct shard before the controller runs. Uses modular hashing: \`company_id % 3\` → shard selection.

**Rails 6.1+ native sharding:**
- \`connects_to\` supports multiple shards
- \`connected_to(shard: :shard_one) { ... }\` for block-scoped connection
- \`connected_to(shard: :shard_one, role: :reading) { ... }\` for shard + role
- Without connecting: \`ActiveRecord::ConnectionNotEstablished\`

**The cost of sharding (from the book):**
- Analytics requires querying ALL shards + aggregating in memory
- Accounts may need rebalancing (some users generate orders of magnitude more data → hot shard)
- Regional segregation (EU data can't live on US shard) adds more complexity
- A reviewer recommended removing the sharding chapter entirely: "most projects don't need it"
- Author's response: "For many companies, sharding is one of the key decisions that allowed them to scale."

**Trade-offs:**
- Cross-shard queries are expensive (avoid them)
- Cross-shard transactions are impossible (use eventual consistency)
- Rebalancing shards is painful (plan capacity ahead)
- Migrations must run on ALL shards`,
		railsCodeExample: `# config/database.yml
production:
  primary:
    adapter: postgresql
    database: myapp_primary
    host: primary-db.example.com
  primary_replica:
    adapter: postgresql
    database: myapp_primary
    host: primary-replica.example.com
    replica: true
  primary_shard_one:
    adapter: postgresql
    database: myapp_shard_1
    host: shard1.example.com
  primary_shard_two:
    adapter: postgresql
    database: myapp_shard_2
    host: shard2.example.com
  primary_shard_three:
    adapter: postgresql
    database: myapp_shard_3
    host: shard3.example.com

# app/models/application_record.rb
# Global models (users, tenants) use the primary database.
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# === ShardRecord abstract class pattern ===
# Only sharded models inherit from ShardRecord.
# Global models (users, tenants) stay on ApplicationRecord.
class ShardRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to shards: {
    shard_one: { writing: :primary_shard_one, reading: :primary_shard_one_replica },
    shard_two: { writing: :primary_shard_two, reading: :primary_shard_two_replica },
    shard_three: { writing: :primary_shard_three, reading: :primary_shard_three_replica }
  }
end

# Sharded models:
class Order < ShardRecord
  acts_as_tenant :company
end

# Global models stay on ApplicationRecord (single DB):
class User < ApplicationRecord
  # NOT sharded, lives in the global database
end

# === Middleware shard switching ===
# Resolves the shard at the Rack level, before controllers run.
# app/middleware/shard_resolver.rb
class ShardResolver
  SHARD_MAP = {
    0 => :shard_one,
    1 => :shard_two,
    2 => :shard_three
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    tenant_id = extract_tenant_id(env)
    shard = self.class.shard_for(tenant_id)

    ActiveRecord::Base.connected_to(shard: shard) do
      @app.call(env)
    end
  end

  def self.shard_for(tenant_id)
    shard_index = tenant_id % SHARD_MAP.size
    SHARD_MAP[shard_index]
  end

  private

  def extract_tenant_id(env)
    # From JWT, subdomain, or header (depends on your auth strategy)
    env['current_tenant_id'] || 0
  end
end

# config/application.rb
config.middleware.use ShardResolver

# Migrations run on ALL shards:
# lib/tasks/db.rake
namespace :db do
  task migrate_all_shards: :environment do
    [:shard_one, :shard_two, :shard_three].each do |shard|
      puts "Migrating #{shard}..."
      ActiveRecord::Base.connected_to(shard: shard) do
        ActiveRecord::MigrationContext.new(
          ActiveRecord::Migrator.migrations_paths
        ).migrate
      end
    end
  end
end

# Cross-shard aggregation (admin only, expensive):
class AdminReportService
  def total_orders_count
    total = 0
    [:shard_one, :shard_two, :shard_three].each do |shard|
      ActiveRecord::Base.connected_to(shard: shard) do
        total += Order.count
      end
    end
    total
  end
end

# Testing with shards:
RSpec.describe Order do
  it 'routes to correct shard' do
    tenant = create(:tenant, id: 1)  # shard_two (1 % 3 = 1)

    ActiveRecord::Base.connected_to(shard: :shard_two) do
      order = create(:order, tenant: tenant)
      expect(Order.find(order.id)).to eq(order)
    end

    ActiveRecord::Base.connected_to(shard: :shard_one) do
      expect(Order.count).to eq(0)  # Not on this shard
    end
  end
end`,
		commonMistakes: [
			'Choosing a shard key that causes hot spots (e.g., timestamp-based)',
			'Attempting cross-shard JOINs (they do not work)',
			'Forgetting to run migrations on all shards',
			'Not planning for shard rebalancing when adding new shards',
		],
		whenToUse:
			'When a single database cannot handle write throughput even with vertical scaling maxed out.',
		furtherReading: [
			{
				title: 'Rails Horizontal Sharding',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html#horizontal-sharding',
			},
			{
				title: 'Vitess (MySQL Sharding)',
				url: 'https://vitess.io/',
			},
			{
				title: 'Citus (PostgreSQL Sharding)',
				url: 'https://www.citusdata.com/',
			},
			{
				title: 'Rails Scales!, Chapter 6: Horizontal Sharding',
				url: 'https://pragprog.com/titles/cpscale/rails-scales/',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Use Rails connects_to with shards. Route by tenant_id using consistent hashing.',
	},
};

// ============================================
// Level 49: The Architect (Capstone)
// ============================================

const level50Architect: Level = {
	id: 'act8-level55-architect',
	actId: 8,
	levelNumber: 55,
	name: 'The Architect',
	isCapstone: true,
	trigger: {
		type: 'architecture',
		description:
			'The billing system is a bottleneck. It is deeply coupled to the monolith, processes payments synchronously, and any change requires deploying the entire application. Design the complete architecture for extracting it into an independent service, using every concept you have learned.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Billing code is entangled with order processing, user management, and notifications. Deploying a billing fix requires a full monolith deployment (2 hours). Payment processing latency is 3x higher than it should be because billing queries compete with unrelated traffic on the same database.',
		rootCause:
			'The billing domain is not isolated. It shares the database, the deployment pipeline, and the runtime with every other feature. Extracting it requires applying multi-database routing, domain events, API gateway patterns, state machines, observability, and tenant isolation, all at once.',
		codeExample: `# The monolith today: everything coupled
class Order < ApplicationRecord
  belongs_to :user
  has_many :line_items
  has_one :payment

  # Billing logic embedded in the order model
  def charge!
    payment = Payment.create!(
      order: self,
      amount: total,
      status: 'pending'
    )

    # Direct Stripe call in the model
    charge = Stripe::Charge.create(
      amount: total_cents,
      customer: user.stripe_customer_id
    )

    payment.update!(
      status: 'completed',
      stripe_charge_id: charge.id
    )

    # Tightly coupled side effects
    update!(status: 'paid')
    InventoryService.reserve(line_items)
    UserMailer.receipt(user, self).deliver_now  # Synchronous!
    LoyaltyPoints.award(user, total)
    AnalyticsTracker.track('purchase', user_id: user.id, amount: total)

  rescue Stripe::CardError => e
    payment.update!(status: 'failed', error: e.message)
    update!(status: 'payment_failed')
    UserMailer.payment_failed(user, self).deliver_now
    raise
  end
end

# Problems:
# 1. Billing shares the database with everything else
# 2. No state machine, invalid payment transitions possible
# 3. Synchronous side effects: email failure blocks payment
# 4. No observability, payment failures are invisible
# 5. No tenant isolation, billing queries scan all tenants
# 6. Single deployment pipeline: billing fix = full deploy`,
		goal: 'Design the complete architecture for extracting billing into an independent service. Apply multi-database, state machines, domain events, API gateway, observability, and tenant isolation.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'api_gateway_configured' },
		{ type: 'message_queue_configured' },
		{ type: 'node_present', nodeType: 'event_bus' },
		{ type: 'node_present', nodeType: 'state_machine' },
		{ type: 'node_present', nodeType: 'observability' },
		{ type: 'microservice_extracted' },
	],
	availableNodes: [
		'api_gateway',
		'message_queue',
		'event_bus',
		'state_machine',
		'observability',
		'health_check',
		'shard',
		'shard_router',
		'tenant_scope',
		'rate_limiter',
		'read_replica',
		'database',
		'controller',
		'model',
		'serializer',
	],
	unlockedNodes: [],
	learningContent: {
		title: 'The Architect: Full Service Extraction',
		goal: `In this capstone level, you'll:\n- extract a full service from a monolith step by step.\n- combine state machines, domain events, API gateway routing, and observability patterns from earlier levels.\n- learn the critical judgment call: when extraction is worth the complexity, and when keeping it in the monolith is the smarter choice.`,
		conceptExplanation: `This is the capstone. You are extracting a billing service from a monolith using every concept from the game:

**1. Multi-Database (Act 7, Level 47):**
Billing gets its own database. Read replicas for reporting queries.

**2. State Machines (Act 7, Level 48):**
Payment status transitions are guarded: pending -> processing -> completed/failed. No invalid transitions.

**3. Multi-Tenancy (Act 7, Level 49):**
Each tenant's billing data is isolated. Queries are automatically scoped.

**4. Observability (Act 7, Level 50):**
Structured logs, distributed tracing across the gateway and billing service, health checks, and alerting.

**5. Modular Monolith (Act 7, Level 51):**
Enforce domain boundaries with Packwerk before extracting. Define packages with public APIs and dependency rules.

**6. Domain Events (Act 7, Level 52):**
Payment events (payment.succeeded, payment.failed) are published. Notifications, inventory, and analytics subscribe independently.

**7. API Gateway (Act 8, Level 53):**
The gateway routes billing requests, handles auth at the edge, and provides circuit breakers.

**8. Sharding (Act 8, Level 54):**
Billing data is sharded by tenant for write scalability.

**Modular monolith with Packwerk (before extracting):**
Before extracting a service, enforce domain boundaries within the monolith using Shopify's Packwerk gem. Define packages (billing/, orders/, notifications/) with explicit public APIs and dependency rules. Packwerk statically analyzes your code and flags unauthorized cross-package references, catching coupling at CI time, not at extraction time.

**Gradual rollout with Flipper feature flags:**
Flipper lets you control the extraction rollout with surgical precision: enable for specific tenants (\`Flipper.enable(:billing_v2, company)\`), by percentage (\`Flipper.enable_percentage_of_actors(:billing_v2, 5)\`), by group (\`Flipper.enable_group(:billing_v2, :beta_testers)\`), or with expressions for complex rules. If anything goes wrong, disable instantly. No deploy required.

**Extraction Strategy: Strangler Fig**
1. Define the billing bounded context (use Packwerk to enforce it)
2. Create the billing service with its own database
3. Dual-write during migration
4. Route traffic through the gateway with Flipper feature flags
5. Gradually increase traffic: 5% → 25% → 50% → 100%
6. Remove billing code from the monolith

**A note on the modular monolith (from the book):**
Eileen Uchitelle's keynote ("The Myth of the Modular Monolith", Rails World 2024) argues that modularity can't fully solve human problems, but it delivers value by reorganizing complexity in ways humans can better understand. The key insight: enforce boundaries with tools (Packwerk, CODEOWNERS), not just conventions. Jason Warner (CTO GitHub): "One of the biggest architectural mistakes of the past decade was going full microservice." Stick with a monolith for as long as possible, and no longer.`,
		railsCodeExample: `# === STEP 1: Define the bounded context ===
# Billing domain: Payment, Invoice, Subscription, Refund

# === STEP 2: Billing service (new Rails app) ===

# billing-service/app/models/payment.rb
class Payment < ApplicationRecord
  include AASM
  acts_as_tenant :company

  aasm column: :status do
    state :pending, initial: true
    state :processing, :completed, :failed, :refunded

    event :process do
      transitions from: :pending, to: :processing
    end

    event :complete do
      transitions from: :processing, to: :completed,
                  after: :publish_success_event
    end

    event :fail do
      transitions from: :processing, to: :failed,
                  after: :publish_failure_event
    end

    event :refund do
      transitions from: :completed, to: :refunded,
                  guard: :within_refund_window?,
                  after: :publish_refund_event
    end
  end

  private

  def publish_success_event
    EventBus.publish('payment.completed', {
      payment_id: id,
      order_id: order_id,
      amount: amount,
      tenant_id: company_id
    })
  end
end

# === STEP 3: Event-driven side effects ===

# billing-service/config/initializers/event_subscriptions.rb
EventBus.subscribe('payment.completed') do |payload|
  # Each subscriber runs independently
  NotificationJob.perform_later(payload)
  InventoryJob.perform_later(payload)
  AnalyticsJob.perform_later(payload)
  LoyaltyJob.perform_later(payload)
end

# === STEP 4: API Gateway routing ===

# gateway/config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    # Route billing to new service (with feature flag)
    match 'billing/*path', to: 'proxy#forward',
          via: :all, defaults: { service: 'billing' }
  end
end

# gateway/app/controllers/api/proxy_controller.rb
class Api::ProxyController < ApplicationController
  before_action :authenticate_at_edge!
  before_action :rate_limit!

  def forward
    service_url = ServiceRegistry.url_for(params[:service])

    response = HttpClient.forward(
      url: "#{service_url}/#{params[:path]}",
      method: request.method,
      headers: forwarded_headers,
      body: request.body.read,
      timeout: 10
    )

    render json: response.body, status: response.status
  end
end

# === STEP 5: Observability ===

# billing-service/config/initializers/opentelemetry.rb
OpenTelemetry::SDK.configure do |c|
  c.service_name = 'billing-service'
  c.use 'OpenTelemetry::Instrumentation::Rails'
  c.use 'OpenTelemetry::Instrumentation::ActiveRecord'
end

# === STEP 6: Gradual rollout with feature flags ===

# monolith/app/services/billing_service.rb
module BillingService
  def self.charge(order)
    if Flipper.enabled?(:billing_v2, order.company)
      # New service via gateway
      BillingClient.charge(order)
    else
      # Old monolith code
      order.charge!
    end
  end
end

# Rollout: 5% -> 25% -> 50% -> 100%
Flipper.enable_percentage_of_actors(:billing_v2, 5)`,
		commonMistakes: [
			'Extracting without a feature flag (no rollback path)',
			'Forgetting to handle dual-write consistency during migration',
			'Not adding observability to the new service from day one',
			'Skipping the state machine and using string statuses (repeating old mistakes)',
			'Tight coupling between gateway and billing service (gateway should be thin)',
			'Not testing tenant isolation in the extracted service',
		],
		whenToUse:
			'When a domain within the monolith has different scaling, deployment, or team ownership needs.',
		furtherReading: [
			{
				title: 'Strangler Fig Pattern',
				url: 'https://martinfowler.com/bliki/StranglerFigApplication.html',
			},
			{
				title: 'Building Microservices (Sam Newman)',
				url: 'https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/',
			},
			{
				title: 'Domain-Driven Design (Eric Evans)',
				url: 'https://www.domainlanguage.com/ddd/',
			},
			{
				title: 'Packwerk (Shopify)',
				url: 'https://github.com/Shopify/packwerk',
			},
			{
				title: 'Rails Scales!, Full Book (Pragmatic Bookshelf)',
				url: 'https://pragprog.com/titles/cpscale/rails-scales/',
			},
		],
	},
	hint: {
		delay: 45,
		text: 'Apply everything: state machine for payments, domain events for side effects, gateway for routing, observability for tracing, tenant isolation for data safety.',
	},
};

// ============================================
// Act 8 Definition
// ============================================

export const actEight: Act = {
	id: 8,
	name: 'Mastery',
	tagline: 'You are the architect now.',
	description:
		'The final challenge. Design API gateways, implement database sharding, and architect a complete service extraction using everything you have learned across 53 levels.',
	levels: [level48APIGateway, level49Sharding, level50Architect],
	unlockedNodes: ['api_gateway', 'shard', 'service_mesh'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};

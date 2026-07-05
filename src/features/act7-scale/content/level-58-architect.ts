import type { Level } from '@/types';

export const level58Architect: Level = {
	id: 'act7-level58-architect',
	actId: 7,
	levelNumber: 58,
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

**1. Multi-Database (Act 7, Level 51):**
Billing gets its own database. Read replicas for reporting queries.

**2. State Machines (Act 7, Level 54):**
Payment status transitions are guarded: pending -> processing -> completed/failed. No invalid transitions.

**3. Multi-Tenancy (Act 7, Level 53):**
Each tenant's billing data is isolated. Queries are automatically scoped.

**4. Observability (Act 6, Level 47):**
Structured logs, distributed tracing across the gateway and billing service, health checks, and alerting.

**5. Modular Monolith (Act 7, Level 55):**
Enforce domain boundaries with Packwerk before extracting. Define packages with public APIs and dependency rules.

**6. Domain Events (Act 7, Level 56):**
Payment events (payment.succeeded, payment.failed) are published. Notifications, inventory, and analytics subscribe independently.

**7. API Gateway (Act 7, Level 57):**
The gateway routes billing requests, handles auth at the edge, and provides circuit breakers.

**8. Sharding (Act 7, Level 52):**
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

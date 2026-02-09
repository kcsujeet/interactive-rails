/**
 * Act 7: Scale
 * "1M users. Architectural decisions."
 *
 * Levels 43-47: Multi-Database, State Machines, Multi-Tenancy, Observability, Domain Events
 * App context: Enterprise SaaS
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 43: Multi-Database
// ============================================

const level43MultiDatabase: Level = {
	id: 'act7-level43-multi-database',
	actId: 7,
	levelNumber: 43,
	name: 'Multi-Database',
	trigger: {
		type: 'scaling',
		description:
			'Reads are 90% of traffic competing with writes. The primary database is groaning under mixed workloads. Split read/write to separate databases.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write latency spikes during peak read traffic. Read queries hold locks that block inserts and updates.',
		rootCause:
			'All reads and writes hit a single database. No read/write splitting configured.',
		codeExample: `# Current: Every query hits the primary database
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end

# All reads compete with writes on the same connection:
Post.where(published: true).order(created_at: :desc) # SELECT ... (blocking writes)
Post.create!(title: "New Post", body: "...")          # INSERT ... (blocked by reads)

# Under load:
# - Read queries hold shared locks
# - Write queries wait for exclusive locks
# - p99 latency: 800ms and climbing`,
		goal: 'Configure read replicas so reads go to replicas and writes go to the primary.',
		thresholds: {
			maxLatency: 200,
		},
	},
	successConditions: [{ type: 'multi_database_configured' }],
	availableNodes: ['database', 'read_replica'],
	unlockedNodes: ['read_replica'],
	learningContent: {
		title: 'Multi-Database with connects_to',
		conceptExplanation: `Rails 6+ supports multiple databases natively via \`connects_to\`.

**Key concepts:**
- \`connects_to\` declares which databases a model can use
- \`connected_to\` switches the connection at runtime
- Automatic role switching sends reads to replicas after a configurable delay
- \`database_selector\` middleware automates read/write routing

**Read replica benefits:**
- Reads (90% of traffic) offloaded to replicas
- Writes get exclusive access to the primary
- Horizontal read scaling by adding more replicas
- Replicas can serve stale data (replication lag)`,
		railsCodeExample: `# config/database.yml
production:
  primary:
    adapter: postgresql
    database: myapp_primary
    host: primary-db.example.com
  primary_replica:
    adapter: postgresql
    database: myapp_primary
    host: replica-db.example.com
    replica: true

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# Automatic role switching (config/application.rb)
config.active_record.database_selector = { delay: 2.seconds }
config.active_record.database_resolver =
  ActiveRecord::Middleware::DatabaseSelector::Resolver
config.active_record.database_resolver_context =
  ActiveRecord::Middleware::DatabaseSelector::Resolver::Session

# Manual switching when needed
ActiveRecord::Base.connected_to(role: :reading) do
  Post.where(published: true).to_a  # Hits replica
end

ActiveRecord::Base.connected_to(role: :writing) do
  Post.create!(title: "New Post")    # Hits primary
end

# In controllers — automatic: GET requests read from replica,
# POST/PUT/PATCH/DELETE write to primary`,
		commonMistakes: [
			'Not accounting for replication lag (user writes then immediately reads stale data)',
			'Forgetting to set replica: true in database.yml (Rails treats it as writable)',
			'Running migrations against replicas instead of primary only',
			'Not configuring the delay parameter for automatic switching',
		],
		whenToUse:
			'When read traffic dominates and a single DB cannot handle the mixed workload.',
		furtherReading: [
			{
				title: 'Multiple Databases with Active Record',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use connects_to to declare writing and reading roles, then let Rails route automatically.',
	},
};

// ============================================
// Level 44: State Machines
// ============================================

const level44StateMachines: Level = {
	id: 'act7-level44-state-machines',
	actId: 7,
	levelNumber: 44,
	name: 'State Machines',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'An order went from "shipped" back to "pending". Customer support is flooded. Invalid state transitions are happening because status is just a string column.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Orders have invalid statuses. "shipped" orders are reverting to "pending". No audit trail exists for status changes.',
		rootCause:
			'Order status is a plain string with no transition guards. Any code can set any status at any time.',
		codeExample: `# Current: Status is just a string — no guards
class Order < ApplicationRecord
  # status is a string column: pending, confirmed, shipped, delivered, cancelled

  def ship!
    update!(status: 'shipped')  # No guard — what if status is 'cancelled'?
  end

  def cancel!
    update!(status: 'cancelled')  # Can cancel a delivered order?!
  end
end

# Bugs in production:
order = Order.find(42)
order.status  # => "shipped"
order.update!(status: "pending")  # Oops — no error raised!

# No audit trail:
# Who changed this? When? From what state?`,
		goal: 'Implement a state machine with guarded transitions and an audit trail.',
		thresholds: {},
	},
	successConditions: [{ type: 'state_machine_configured' }],
	availableNodes: ['state_machine'],
	unlockedNodes: ['state_machine'],
	decisionModals: [
		{
			trigger: { sourceType: 'model', targetType: 'state_machine' },
			question: 'Which state machine approach?',
			options: [
				{
					label: 'AASM',
					value: 'aasm',
					preview: 'Declarative DSL with guards, callbacks, and scopes',
					consequence: 'Adds state machine DSL to ActiveRecord models',
					correct: true,
				},
				{
					label: 'Plain enum',
					value: 'enum',
					preview: 'ActiveRecord enum with manual guard methods',
					consequence: 'Simple column-based approach, no transition logic',
					correct: false,
				},
				{
					label: 'Statesman',
					value: 'statesman',
					preview: 'History-based state machine with audit trail built in',
					consequence: 'Stores full transition history in a separate table',
					correct: false,
				},
			],
		},
	],
	learningContent: {
		title: 'State Machines with AASM',
		conceptExplanation: `State machines formalize which transitions are valid and enforce them at the model level.

**Why not just a string column?**
- No enforcement: any code can set any value
- No callbacks: no hooks for side effects on transition
- No audit: no record of who changed what, when
- No scopes: no easy way to query by state

**AASM provides:**
- Declarative state/event/transition DSL
- Guards (conditions that must be true before transitioning)
- Callbacks (after_enter, before_exit, etc.)
- Automatic scopes (Order.shipped, Order.pending)
- Bang methods raise on invalid transition`,
		railsCodeExample: `# Gemfile
gem 'aasm'

# app/models/order.rb
class Order < ApplicationRecord
  include AASM

  aasm column: :status do
    state :pending, initial: true
    state :confirmed, :shipped, :delivered, :cancelled

    event :confirm do
      transitions from: :pending, to: :confirmed,
                  guard: :payment_received?
    end

    event :ship do
      transitions from: :confirmed, to: :shipped,
                  after: :notify_customer
    end

    event :deliver do
      transitions from: :shipped, to: :delivered,
                  after: :complete_fulfillment
    end

    event :cancel do
      transitions from: [:pending, :confirmed], to: :cancelled,
                  after: :process_refund
      # Cannot cancel shipped or delivered orders!
    end
  end

  # Scopes generated automatically:
  # Order.pending, Order.confirmed, Order.shipped, etc.

  private

  def payment_received?
    payments.where(status: 'completed').exists?
  end

  def notify_customer
    OrderMailer.shipped(self).deliver_later
  end

  def process_refund
    RefundJob.perform_later(id) if confirmed?
  end
end

# Audit trail with PaperTrail
class Order < ApplicationRecord
  has_paper_trail only: [:status]
end

# Usage:
order = Order.create!
order.confirm!          # Works if payment_received?
order.ship!             # Works — transitions confirmed -> shipped
order.cancel!           # Raises AASM::InvalidTransition!
                        # Cannot cancel a shipped order

# Query by state:
Order.pending.count     # SELECT COUNT(*) FROM orders WHERE status = 'pending'`,
		commonMistakes: [
			'Using a plain string column without transition guards',
			'Forgetting to add guard clauses for business rules',
			'Not logging state transitions for audit purposes',
			'Allowing direct status column updates that bypass the state machine',
		],
		whenToUse:
			'Whenever a model has a status/state field with specific valid transitions.',
		furtherReading: [
			{
				title: 'AASM Gem',
				url: 'https://github.com/aasm/aasm',
			},
			{
				title: 'Statesman Gem',
				url: 'https://github.com/gocardless/statesman',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use AASM to declare states, events, and guarded transitions. Add PaperTrail for audit.',
	},
};

// ============================================
// Level 45: Multi-Tenancy
// ============================================

const level45MultiTenancy: Level = {
	id: 'act7-level45-multi-tenancy',
	actId: 7,
	levelNumber: 45,
	name: 'Multi-Tenancy',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			"B2B SaaS launch: each company must only see their own data. One codebase, many tenants. A single leaked query could expose another company's data.",
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			"Company A can see Company B's records. Every query must be scoped to the current tenant, but developers keep forgetting.",
		rootCause:
			'No tenant isolation. Queries are unscoped and return all records across all tenants.',
		codeExample: `# Current: No tenant scoping — data leaks!
class Project < ApplicationRecord
  belongs_to :company
end

# In controller:
def index
  @projects = Project.all  # Returns ALL projects across ALL companies!
end

# A developer forgets the where clause:
Project.where(status: 'active')  # Leaks other tenants' data

# Even with manual scoping, one mistake = data breach:
Project.where(company_id: current_company.id, status: 'active')
# Easy to forget company_id in complex queries`,
		goal: 'Implement automatic tenant isolation so every query is scoped by default.',
		thresholds: {},
	},
	successConditions: [{ type: 'multi_tenancy_configured' }],
	availableNodes: ['tenant_scope'],
	unlockedNodes: ['tenant_scope'],
	learningContent: {
		title: 'Multi-Tenancy with ActsAsTenant',
		conceptExplanation: `Multi-tenancy strategies:

**Row-level isolation (ActsAsTenant):**
- All tenants share tables, scoped by tenant_id
- Simplest to implement, easiest to scale horizontally
- Default scopes automatically filter every query

**Schema-based isolation (Apartment):**
- Each tenant gets their own PostgreSQL schema
- Stronger isolation, but harder to manage migrations
- Better for compliance requirements

**Database-per-tenant:**
- Strongest isolation, most expensive
- Each tenant has a separate database
- Used for enterprise customers with strict data sovereignty

ActsAsTenant is the most common Rails approach for SaaS.`,
		railsCodeExample: `# Gemfile
gem 'acts_as_tenant'

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end

# app/models/company.rb (the tenant)
class Company < ApplicationRecord
  has_many :users
  has_many :projects
end

# app/models/project.rb
class Project < ApplicationRecord
  acts_as_tenant :company  # Automatically scopes ALL queries

  belongs_to :company
  has_many :tasks
end

# app/models/task.rb
class Task < ApplicationRecord
  acts_as_tenant :company

  belongs_to :project
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  set_current_tenant_through_filter
  before_action :set_tenant

  private

  def set_tenant
    set_current_tenant(current_user.company)
  end
end

# Now every query is automatically scoped:
Project.all
# SELECT * FROM projects WHERE company_id = 42

Project.where(status: 'active')
# SELECT * FROM projects WHERE company_id = 42 AND status = 'active'

Project.create!(name: "New Project")
# INSERT INTO projects (name, company_id) VALUES ('New Project', 42)

# Cross-tenant queries are impossible without explicitly bypassing:
ActsAsTenant.without_tenant do
  Project.count  # Admin-only: counts all projects
end

# Testing tenant isolation:
RSpec.describe Project do
  let(:company_a) { create(:company) }
  let(:company_b) { create(:company) }

  it 'isolates data between tenants' do
    ActsAsTenant.with_tenant(company_a) do
      create(:project, name: "A's Project")
    end

    ActsAsTenant.with_tenant(company_b) do
      expect(Project.count).to eq(0)  # Cannot see A's project
    end
  end
end`,
		commonMistakes: [
			'Forgetting acts_as_tenant on a model (data leak)',
			'Using unscoped or without_tenant carelessly in production code',
			'Not testing tenant isolation in your test suite',
			'Not adding a unique index scoped to tenant_id',
		],
		whenToUse:
			'Any B2B SaaS where multiple companies share one codebase and database.',
		furtherReading: [
			{
				title: 'ActsAsTenant Gem',
				url: 'https://github.com/ErwinM/acts_as_tenant',
			},
			{
				title: 'Apartment Gem (Schema-based)',
				url: 'https://github.com/influitive/apartment',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use ActsAsTenant to automatically scope every query to the current tenant.',
	},
};

// ============================================
// Level 46: Observability
// ============================================

const level46Observability: Level = {
	id: 'act7-level46-observability',
	actId: 7,
	levelNumber: 46,
	name: 'Observability',
	trigger: {
		type: 'incident',
		description:
			'PagerDuty fires at 3 AM. "High error rate." But nobody knows what\'s wrong. No metrics, no traces, no structured logs. Just a wall of unformatted text.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Alerts fire but the team cannot diagnose the root cause. Logs are unstructured, no metrics are tracked, and there is no distributed tracing.',
		rootCause:
			'No observability stack. Logging is puts-style strings. No APM, no tracing, no dashboards.',
		codeExample: `# Current: Unstructured logging — impossible to search or aggregate
Rails.logger.info "User #{user.id} placed order #{order.id}"
Rails.logger.error "Payment failed for order #{order.id}"

# In production, this is just a wall of text:
# I, [2024-01-15 03:22:14] INFO -- : User 42 placed order 999
# E, [2024-01-15 03:22:15] ERROR -- : Payment failed for order 999
# I, [2024-01-15 03:22:15] INFO -- : Retrying payment...
# E, [2024-01-15 03:22:16] ERROR -- : Payment failed again

# No way to:
# - Filter by user_id or order_id
# - Correlate across services
# - Track request duration
# - Build dashboards or alerts`,
		goal: 'Implement structured logging, APM metrics, and distributed tracing.',
		thresholds: {},
	},
	successConditions: [{ type: 'observability_configured' }],
	availableNodes: ['observability', 'health_check'],
	unlockedNodes: ['observability'],
	learningContent: {
		title: 'Observability: Logs, Metrics, Traces',
		conceptExplanation: `The three pillars of observability:

**1. Structured Logging:**
- JSON-formatted logs with consistent fields
- Searchable by any field (user_id, request_id, etc.)
- Shipped to a log aggregator (Datadog, ELK, Loki)

**2. Metrics (APM):**
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query counts and durations
- Background job queue depth

**3. Distributed Tracing:**
- Follow a request across services
- Each span shows duration and metadata
- Identify bottlenecks visually
- OpenTelemetry is the standard`,
		railsCodeExample: `# Structured logging with Lograge
# Gemfile
gem 'lograge'
gem 'logstash-event'

# config/environments/production.rb
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Logstash.new
config.lograge.custom_payload do |controller|
  {
    user_id: controller.current_user&.id,
    company_id: controller.current_tenant&.id,
    request_id: controller.request.request_id
  }
end

# Output:
# {"method":"GET","path":"/api/v1/orders","status":200,
#  "duration":45.2,"user_id":42,"company_id":7,"request_id":"abc-123"}

# OpenTelemetry for distributed tracing
# Gemfile
gem 'opentelemetry-sdk'
gem 'opentelemetry-instrumentation-rails'
gem 'opentelemetry-instrumentation-active_record'

# config/initializers/opentelemetry.rb
OpenTelemetry::SDK.configure do |c|
  c.service_name = 'myapp'
  c.use 'OpenTelemetry::Instrumentation::Rails'
  c.use 'OpenTelemetry::Instrumentation::ActiveRecord'
  c.use 'OpenTelemetry::Instrumentation::Sidekiq'

  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
      OpenTelemetry::Exporter::OTLP::Exporter.new
    )
  )
end

# Custom instrumentation
class OrderService
  def create(params)
    tracer = OpenTelemetry.tracer_provider.tracer('order-service')

    tracer.in_span('order.create', attributes: {
      'order.total' => params[:total],
      'order.items_count' => params[:items].size
    }) do |span|
      order = Order.create!(params)
      span.set_attribute('order.id', order.id)

      tracer.in_span('payment.charge') do
        PaymentService.charge(order)
      end

      order
    end
  end
end

# Health check endpoint
# config/routes.rb
get '/health', to: 'health#show'

# app/controllers/health_controller.rb
class HealthController < ApplicationController
  skip_before_action :authenticate!

  def show
    checks = {
      database: database_healthy?,
      redis: redis_healthy?,
      sidekiq: sidekiq_healthy?
    }

    status = checks.values.all? ? :ok : :service_unavailable
    render json: { status: status, checks: checks }, status: status
  end

  private

  def database_healthy?
    ActiveRecord::Base.connection.execute('SELECT 1')
    true
  rescue StandardError
    false
  end
end`,
		commonMistakes: [
			'Logging sensitive data (passwords, tokens, PII) in structured logs',
			'Not including request_id for cross-service correlation',
			'Too many custom metrics (cardinality explosion)',
			'Not setting up alerts on the metrics you collect',
		],
		whenToUse: 'Every production application needs observability from day one.',
		furtherReading: [
			{
				title: 'Lograge Gem',
				url: 'https://github.com/roidrage/lograge',
			},
			{
				title: 'OpenTelemetry Ruby',
				url: 'https://opentelemetry.io/docs/languages/ruby/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add structured logging with Lograge, tracing with OpenTelemetry, and a health check endpoint.',
	},
};

// ============================================
// Level 47: Domain Events & Decoupling
// ============================================

const level47DomainEvents: Level = {
	id: 'act7-level47-domain-events',
	actId: 7,
	levelNumber: 47,
	name: 'Domain Events & Decoupling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Payment failure cascades into notification failure. The notification service exception prevents the payment retry from being recorded. Services are tightly coupled through direct method calls.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'When payment processing fails, the notification service also raises an error, preventing the payment failure from being logged. A bug in one subsystem breaks an unrelated subsystem.',
		rootCause:
			'Services are tightly coupled through synchronous method calls. Each service directly calls the next, creating a failure cascade.',
		codeExample: `# Current: Tight coupling — failure cascades
class PaymentService
  def process(order)
    charge = Stripe::Charge.create(amount: order.total)
    order.update!(payment_status: 'paid')

    # Direct coupling: if ANY of these fail, the whole thing fails
    NotificationService.send_receipt(order)        # Raises if email server is down!
    InventoryService.reserve_items(order)           # Raises if inventory service is down!
    AnalyticsService.track_purchase(order)           # Raises if analytics is down!
    LoyaltyService.award_points(order)               # Raises if loyalty service is down!
  rescue Stripe::CardError => e
    order.update!(payment_status: 'failed')
    NotificationService.send_failure(order)          # Also fails if email is down!
    raise  # The retry logic never runs
  end
end

# Problem: NotificationService failure prevents payment recording
# Problem: Every new feature adds another direct call
# Problem: Cannot test PaymentService without mocking 4 services`,
		goal: 'Decouple services using domain events and pub/sub so failures are isolated.',
		thresholds: {},
	},
	successConditions: [{ type: 'domain_events_configured' }],
	availableNodes: ['event_bus', 'message_queue'],
	unlockedNodes: ['event_bus'],
	learningContent: {
		title: 'Domain Events & Event-Driven Architecture',
		conceptExplanation: `Domain events decouple producers from consumers.

**The principle:** A service publishes an event describing what happened. Other services subscribe and react independently. If a subscriber fails, it does not affect the publisher or other subscribers.

**Benefits:**
- Failure isolation: notification failure does not break payment
- Open/closed: add new subscribers without modifying the publisher
- Testability: test each service in isolation
- Audit trail: events are a log of everything that happened

**Patterns:**
- In-process: ActiveSupport::Notifications or Wisper
- Out-of-process: Sidekiq, Kafka, RabbitMQ
- Hybrid: Publish in-process, fan out to background jobs`,
		railsCodeExample: `# Using Wisper for in-process domain events
# Gemfile
gem 'wisper'
gem 'wisper-sidekiq'  # async subscribers

# app/events/order_events.rb
class OrderEvents
  include Wisper::Publisher

  def payment_succeeded(order)
    broadcast(:payment_succeeded, order)
  end

  def payment_failed(order, error)
    broadcast(:payment_failed, order, error)
  end
end

# app/services/payment_service.rb
class PaymentService
  def process(order)
    charge = Stripe::Charge.create(amount: order.total)
    order.update!(payment_status: 'paid')

    # Publish event — does NOT call subscribers directly
    events.payment_succeeded(order)
  rescue Stripe::CardError => e
    order.update!(payment_status: 'failed')
    events.payment_failed(order, e)
    raise
  end

  private

  def events
    @events ||= OrderEvents.new
  end
end

# app/listeners/notification_listener.rb
class NotificationListener
  def payment_succeeded(order)
    OrderMailer.receipt(order).deliver_later
  end

  def payment_failed(order, error)
    OrderMailer.payment_failed(order).deliver_later
  end
end

# app/listeners/inventory_listener.rb
class InventoryListener
  def payment_succeeded(order)
    ReserveInventoryJob.perform_later(order.id)
  end
end

# app/listeners/analytics_listener.rb
class AnalyticsListener
  def payment_succeeded(order)
    TrackPurchaseJob.perform_later(order.id)
  end
end

# config/initializers/event_subscriptions.rb
Rails.application.config.after_initialize do
  OrderEvents.subscribe(NotificationListener.new)
  OrderEvents.subscribe(InventoryListener.new)
  OrderEvents.subscribe(AnalyticsListener.new)
  OrderEvents.subscribe(LoyaltyListener.new)
  # Add new subscribers here — PaymentService never changes!
end

# Async subscribers with Wisper-Sidekiq
OrderEvents.subscribe(NotificationListener, async: true)

# Testing in isolation:
RSpec.describe PaymentService do
  it 'publishes payment_succeeded event' do
    events = spy('events')
    service = PaymentService.new(events: events)

    service.process(order)

    expect(events).to have_received(:payment_succeeded).with(order)
    # No need to mock NotificationService, InventoryService, etc.
  end
end`,
		commonMistakes: [
			'Publishing events inside a transaction (event fires but transaction rolls back)',
			'Not handling subscriber failures (one bad subscriber breaks all)',
			'Events that are too fine-grained (event storm)',
			'Circular event chains (A publishes event, B handles it and publishes event that triggers A)',
		],
		whenToUse:
			'When multiple subsystems need to react to the same business event independently.',
		furtherReading: [
			{
				title: 'Wisper Gem',
				url: 'https://github.com/krisleech/wisper',
			},
			{
				title: 'Domain Events in Rails',
				url: 'https://blog.arkency.com/domain-events-over-active-record-callbacks/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Publish domain events from PaymentService. Let listeners subscribe independently.',
	},
};

// ============================================
// Act 7 Definition
// ============================================

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: '1M users. Architectural decisions.',
	description:
		'Handle enterprise scale: multi-database with read replicas, state machines, multi-tenancy, observability, and domain events for decoupled architecture.',
	levels: [
		level43MultiDatabase,
		level44StateMachines,
		level45MultiTenancy,
		level46Observability,
		level47DomainEvents,
	],
	unlockedNodes: ['read_replica', 'state_machine', 'tenant', 'event_bus'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};

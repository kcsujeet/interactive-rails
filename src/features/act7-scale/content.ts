/**
 * Act 7: Scale
 * "1M users. Architectural decisions."
 *
 * Levels 48-53: Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events
 * App context: Enterprise SaaS
 */

import type { Act, Level } from '@/types';

// ============================================
// Level 48: Multi-Database
// ============================================

const level48MultiDatabase: Level = {
	id: 'act7-level48-multi-database',
	actId: 7,
	levelNumber: 48,
	name: 'Multi-Database',
	trigger: {
		type: 'scaling',
		description:
			'Reads are 90% of traffic competing with writes. The primary database is groaning under mixed workloads. Split read/write to separate databases.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Write latency spikes during peak read traffic. Reads and writes compete for shared CPU, memory, and I/O on a single server.',
		rootCause:
			'All reads and writes hit a single database. No read/write splitting configured.',
		codeExample: `# Current: Every query hits the primary database
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end

# All reads compete with writes for CPU, memory, and I/O:
Order.where(status: "shipped").order(created_at: :desc) # SELECT ... (heavy read I/O)
Order.create!(customer_id: 42, total: 99_00)            # INSERT ... (competes for same resources)

# Under load:
# - PostgreSQL MVCC means readers don't block writers,
#   but they compete for CPU, memory, disk I/O, and shared buffer cache
# - Heavy analytical reads starve write throughput
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
		goal: `In this level, you'll:\n- learn how to scale your database by splitting reads and writes across multiple servers.\n- configure your application to route reads to replicas and writes to the primary.\n- set up automatic role switching so Rails handles read/write routing transparently.\n- handle the tricky edge cases around replication delay.`,
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
  Order.where(status: "shipped").to_a  # Hits replica
end

ActiveRecord::Base.connected_to(role: :writing) do
  Order.create!(customer_id: 42, total: 99_00)  # Hits primary
end

# In controllers (automatic): GET requests read from replica,
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
// Level 49: State Machines
// ============================================

const level49StateMachines: Level = {
	id: 'act7-level49-state-machines',
	actId: 7,
	levelNumber: 49,
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
		codeExample: `# Current: Status is just a string, no guards
class Order < ApplicationRecord
  # status is a string column: pending, confirmed, shipped, delivered, cancelled

  def ship!
    update!(status: 'shipped')  # No guard. What if status is 'cancelled'?
  end

  def cancel!
    update!(status: 'cancelled')  # Can cancel a delivered order?!
  end
end

# Bugs in production:
order = Order.find(42)
order.status  # => "shipped"
order.update!(status: "pending")  # Oops, no error raised!

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
					label: 'Plain enum',
					value: 'enum',
					preview: 'ActiveRecord enum with manual guard methods',
					consequence: 'Simple column-based approach, no transition logic',
					correct: false,
				},
				{
					label: 'AASM',
					value: 'aasm',
					preview: 'Declarative DSL with guards, callbacks, and scopes',
					consequence: 'Adds state machine DSL to ActiveRecord models',
					correct: true,
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
		goal: `In this level, you'll:\n- learn how to model complex workflows using a state machine library.\n- define valid states and transitions so records can only move through allowed paths.\n- add guards to enforce business rules.\n- trigger side effects on transitions.`,
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
order.ship!             # Works: transitions confirmed -> shipped
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
// Level 50: Multi-Tenancy
// ============================================

const level50MultiTenancy: Level = {
	id: 'act7-level50-multi-tenancy',
	actId: 7,
	levelNumber: 50,
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
		codeExample: `# Current: No tenant scoping, data leaks!
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
		goal: `In this level, you'll:\n- learn how to build a multi-tenant application where multiple companies share the same database without seeing each other's data.\n- use automatic tenant scoping so every query is filtered by the current tenant.\n- add tenant_id columns and prevent data leaks between organizations.`,
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
// Level 51: Observability
// ============================================

const level51Observability: Level = {
	id: 'act7-level51-observability',
	actId: 7,
	levelNumber: 51,
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
		codeExample: `# Current: Unstructured logging, impossible to search or aggregate
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
		title: 'Observability: Logs, Metrics, Traces & Flame Graphs',
		goal: `In this level, you'll:\n- learn how to make your application observable so you can diagnose problems in production.\n- add distributed tracing to follow requests across services.\n- attach trace IDs to logs, errors, and metrics so they correlate.\n- use tracing to pinpoint slow spans and bottlenecks in your request pipeline.`,
		conceptExplanation: `The three pillars of observability:

**Without observability:**
\`\`\`
Log output:
  I, [2024-01-15 03:22:14] INFO -- : User 42 placed order 999
  E, [2024-01-15 03:22:15] ERROR -- : Payment failed for order 999
→ Wall of unstructured text. Can't filter, correlate, or build dashboards.
\`\`\`

**With structured logging + APM:**
\`\`\`
Lograge JSON output:
  {"method":"GET","path":"/api/v1/orders","status":200,
   "duration":45.2,"user_id":42,"company_id":7,"request_id":"abc-123"}
→ Searchable by any field, correlatable across services via request_id
\`\`\`

**1. Structured Logging:**
- JSON-formatted logs with consistent fields
- Searchable by any field (user_id, request_id, etc.)
- Shipped to a log aggregator (Datadog, ELK, Loki)

**2. Metrics (APM):**
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query counts and durations
- Background job queue depth
- For custom business metrics, use DogStatsD: \`StatsD.increment('orders.completed', tags: ['plan:enterprise'])\`

**APM platform comparison:**
- **New Relic**: Simplest. Best for small startups / junior teams. Great Rails integration
- **Grafana** (+ Prometheus, Loki, Jaeger): Open-source, self-hosted, extremely customizable. More setup work
- **Datadog**: Easy integration, incredibly comprehensive. Coinbase spent $65M/year on it, so review your metrics periodically

**3. Distributed Tracing:**
- Follow a request across services
- Each span shows duration and metadata
- Identify bottlenecks visually
- OpenTelemetry is the standard

**Reading flame graphs (how to identify bottlenecks):**
1. **Widest boxes first**: most time spent, most optimization opportunity
2. **Recurring patterns**: repeated similar structures = possible N+1 loop
3. **Tall stacks**: deep call chains, potential simplification opportunity

**Custom traces:** \`Datadog::Tracing.trace('presenter.to_json', service: 'presentation-layer')\` creates a new service in your trace explorer. Use for business-critical code paths.`,
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
			{
				title: 'Datadog APM for Rails',
				url: 'https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/ruby/',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 8: APM, Traces, Flame Graphs',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add structured logging with Lograge, tracing with OpenTelemetry, and a health check endpoint.',
	},
};

// ============================================
// Level 52: Modular Monolith
// ============================================

const level52ModularMonolith: Level = {
	id: 'act7-level52-modular-monolith',
	actId: 7,
	levelNumber: 52,
	name: 'Modular Monolith',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'The monolith has grown to 200 files. A change to billing breaks notifications. No ownership. No boundaries. Team grew from 3 to 12 engineers and everyone touches everything.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'A billing change broke notifications because there are no boundaries. Every team touches every part of the codebase. PR reviews take days because nobody knows who owns what.',
		rootCause:
			'No domain boundaries enforced. Code is organized by Rails convention (models/, controllers/) not by business domain. Cross-domain coupling is invisible until something breaks.',
		codeExample: `# Everything lives in one flat structure:
# app/models/
#   order.rb          ← Billing domain
#   payment.rb        ← Billing domain
#   notification.rb   ← Notifications domain
#   subscription.rb   ← Billing domain
#   audit.rb          ← Compliance domain
#
# A billing change in order.rb directly calls:
class Order < ApplicationRecord
  after_create :send_notification   # Cross-domain coupling!
  after_update :update_audit_trail  # Cross-domain coupling!

  def send_notification
    Notification.create!(            # Reaches into notifications domain
      user: user,
      message: "Order ##{id} created"
    )
  end

  def update_audit_trail
    Audit.create!(                   # Reaches into compliance domain
      auditable: self,
      action: "updated"
    )
  end
end

# When billing changes Notification's interface,
# notifications break. No one knows until production.`,
		goal: 'Organize code into domain packages with enforced boundaries, public APIs, and ownership rules.',
		thresholds: {},
	},
	successConditions: [{ type: 'service_created' }],
	availableNodes: ['event_bus'],
	unlockedNodes: [],
	learningContent: {
		title: 'Modular Monolith with Packwerk',
		goal: `In this level, you'll:\n- learn how to organize a growing monolith into well-defined domain packages.\n- draw boundaries between domains.\n- mark public APIs versus private internals in each package.\n- enforce those boundaries in CI so teams can work independently without accidentally coupling their code together.`,
		conceptExplanation: `The modular monolith is the critical step BEFORE microservice extraction. It enforces domain boundaries within a single deployable codebase.

**Why modular monolith?**
- Microservices add network latency, distributed transactions, and operational complexity
- A modular monolith gives you domain isolation WITHOUT the infrastructure cost
- When you DO need to extract a service later, the boundaries are already clean

**Real users:** Shopify (the largest Rails app in the world), Zendesk, GitHub. All use Packwerk-style modular monoliths.

**Packwerk packages:**
- Each business domain becomes a "package" with its own \`package.yml\`
- \`enforce_dependencies: true\`: only allow explicit dependencies between packages
- \`enforce_privacy: true\`: only allow access through the package's public API
- \`bin/packwerk check\` catches unauthorized cross-package references at CI time

**CODEOWNERS:**
- \`.github/CODEOWNERS\` assigns domain experts as required reviewers
- PRs to \`components/billing/\` require approval from the billing team
- Branch protection rules enforce it: no merging without domain owner approval

**Eileen Uchitelle's keynote (Rails World 2024):** "The Myth of the Modular Monolith". Modularity can't fully solve human problems, but it delivers value by reorganizing complexity in ways humans can better understand.`,
		railsCodeExample: `# === Step 1: Organize into Packwerk packages ===

# Gemfile
gem 'packwerk'

# Directory structure:
# components/
#   billing/
#     app/models/billing/order.rb
#     app/models/billing/payment.rb
#     app/public/billing_interface.rb  ← Public API
#     package.yml
#   notifications/
#     app/models/notifications/notification.rb
#     app/public/notification_interface.rb
#     package.yml
#   compliance/
#     app/models/compliance/audit.rb
#     app/public/audit_interface.rb
#     package.yml

# === Step 2: Define package.yml ===

# components/billing/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - '.'  # Root package only, no direct dependency on notifications!

# components/notifications/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - '.'

# === Step 3: Create public APIs ===

# components/billing/app/public/billing_interface.rb
module BillingInterface
  def self.create_order(user:, items:)
    Billing::Order.create!(user: user, items: items)
  end

  def self.process_payment(order_id:)
    order = Billing::Order.find(order_id)
    Billing::PaymentService.charge(order)
  end
end

# components/compliance/app/public/audit_interface.rb
module AuditInterface
  def self.record(auditable:, action:, user: nil)
    Compliance::Audit.create!(
      auditable: auditable,
      action: action,
      user: user
    )
  end
end

# === Step 4: Use public APIs, not direct access ===

# BEFORE (privacy violation, Packwerk will flag this):
Audit.create!(auditable: order, action: "created")

# AFTER (goes through public API):
AuditInterface.record(auditable: order, action: "created")

# === Step 5: CODEOWNERS ===

# .github/CODEOWNERS
components/billing/   @billing-team
components/notifications/  @platform-team
components/compliance/     @compliance-team
config/                    @infra-team

# === Step 6: CI enforcement ===

# bin/packwerk check
# Checking 342 files...
#
# components/billing/app/models/billing/order.rb:15
#   Privacy violation: Notification is private to components/notifications/
#   Use NotificationInterface instead.
#
# 1 violation found. ← CI fails!

# .github/workflows/packwerk.yml
- name: Check package boundaries
  run: bin/packwerk check`,
		commonMistakes: [
			'Organizing by Rails convention (models/, controllers/) instead of by domain',
			'Allowing direct model access across packages (bypassing public APIs)',
			'Not running packwerk check in CI (boundaries only enforced locally)',
			'Making packages too granular (one per model, which defeats the purpose)',
			'Not setting up CODEOWNERS (no ownership enforcement)',
		],
		whenToUse:
			'When your team grows beyond 5-6 engineers, or when a change in one domain frequently breaks another. The modular monolith is the bridge between a tangled monolith and microservices.',
		furtherReading: [
			{
				title: 'Packwerk (Shopify)',
				url: 'https://github.com/Shopify/packwerk',
			},
			{
				title: 'CODEOWNERS (GitHub)',
				url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
			},
			{
				title:
					'Book: "Rails Scales!", Chapter 9: Packwerk & Modular Boundaries',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Organize code into Packwerk packages by business domain. Define public APIs. Set enforce_dependencies and enforce_privacy to true in package.yml.',
	},
};

// ============================================
// Level 53: Domain Events & Decoupling
// ============================================

const level53DomainEvents: Level = {
	id: 'act7-level53-domain-events',
	actId: 7,
	levelNumber: 53,
	name: 'Domain Events & Decoupling',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'The checkout service directly calls Email, Inventory, Analytics, and Shipping. One slow service blocks the entire order. A failure in email prevents shipping from running. Adding a new service means modifying checkout.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Checkout directly calls four services in sequence. If the email service is down, inventory reservation and shipping never run. A bug in one subsystem breaks unrelated subsystems.',
		rootCause:
			'Services are tightly coupled through synchronous, sequential method calls. Each service directly calls the next, creating a failure cascade.',
		codeExample: `# Current: Tight coupling, failure cascades
class CheckoutService
  def call(order)
    order.complete!

    # Direct coupling: if ANY of these fail, the rest never run
    EmailService.send_receipt(order)           # Raises if email server is down!
    InventoryService.reserve_items(order)      # Never runs if email fails!
    AnalyticsService.track_purchase(order)     # Never runs if inventory fails!
    ShippingService.schedule_delivery(order)   # Never runs if analytics fails!
  rescue => e
    # One failure blocks everything downstream
    raise  # The whole checkout fails
  end
end

# Problem: Email failure prevents shipping from running
# Problem: Every new service means modifying CheckoutService
# Problem: Cannot test CheckoutService without mocking 4 services`,
		goal: 'Decouple services using domain events and pub/sub so failures are isolated and services process in parallel.',
		thresholds: {},
	},
	successConditions: [{ type: 'domain_events_configured' }],
	availableNodes: ['event_bus', 'message_queue'],
	unlockedNodes: ['event_bus'],
	learningContent: {
		title: 'Domain Events & Event-Driven Architecture',
		goal: `In this level, you'll:\n- learn how domain events decouple modules so they can communicate without depending on each other directly.\n- publish events when important things happen (like OrderPlaced).\n- subscribe to events from other modules.\n- keep publishers and subscribers completely independent so changes in one don't break the other.`,
		conceptExplanation: `Domain events decouple producers from consumers.

**Without domain events (tight coupling, failure cascade):**
\`\`\`
CheckoutService.call(order):
  1. order.complete! ✓
  2. EmailService.send_receipt(order) ✗ ← Email server down!
  3. InventoryService.reserve(order) NEVER RUNS
  4. AnalyticsService.track(order) NEVER RUNS
  5. ShippingService.schedule(order) NEVER RUNS
Result: Order completed but nothing else happened. Sequential = slow.
\`\`\`

**With domain events (isolated failures, parallel processing):**
\`\`\`
CheckoutService.call(order):
  1. order.complete! ✓
  2. publish OrderCompleted event ← Return immediately
Subscribers (independent, parallel):
  - EmailSubscriber: ✗ (email down) → retries later
  - InventorySubscriber: ✓ (reserved items)
  - AnalyticsSubscriber: ✓ (tracked purchase)
  - ShippingSubscriber: ✓ (scheduled delivery)
Result: 3 out of 4 succeed. Email retries independently.
\`\`\`

**The principle:** A service publishes an event describing what happened. Other services subscribe and react independently. If a subscriber fails, it does not affect the publisher or other subscribers.

**Benefits:**
- Failure isolation: email failure does not block inventory or shipping
- Parallel processing: all subscribers run concurrently, not sequentially
- Open/closed: add new subscribers without modifying the publisher
- Testability: test each service in isolation
- Audit trail: events are a log of everything that happened

**Progression, Wisper to Karafka:**

**In-process (Wisper):** Events stay within the Rails process. Simple, no infrastructure. Best for decoupling within a monolith.

**Out-of-process (Karafka + Kafka):** Events published to Kafka topics, consumed by independent worker processes. Guaranteed delivery, replay, and ordering. Choose when subscribers live in separate services.
- Producing: \`Karafka.producer.produce_sync(topic: 'payments', payload: {...}.to_json)\`
- Consuming: \`class PaymentsConsumer < ApplicationConsumer; def consume; messages.each { |msg| process(msg) }; end; end\`
- Routing: \`topic :payments do; consumer PaymentsConsumer; end\`
- Karafka Web dashboard at \`/karafka\` for monitoring

**Hybrid:** Publish in-process with Wisper, fan out to Sidekiq jobs. Good middle ground before Kafka.

**Monolith philosophy:** "Stick with a monolith for as long as possible (and no longer)." Jason Warner (CTO GitHub): "One of the biggest architectural mistakes of the past decade was going full microservice."`,
		railsCodeExample: `# Using Wisper for in-process domain events
# Gemfile
gem 'wisper'
gem 'wisper-sidekiq'  # async subscribers

# app/events/order_completed_event.rb
class OrderCompletedEvent
  include Wisper::Publisher

  def initialize(order)
    @order = order
  end

  def call
    broadcast(:order_completed, @order)
  end
end

# app/services/checkout_service.rb
class CheckoutService
  def call(order)
    order.complete!

    # Publish event, does NOT call subscribers directly
    OrderCompletedEvent.new(order).call
    # That's it! No direct dependencies on Email, Inventory, etc.
  end
end

# app/subscribers/email_subscriber.rb
class EmailSubscriber
  def order_completed(order)
    OrderMailer.receipt(order).deliver_later
  end
end

# app/subscribers/inventory_subscriber.rb
class InventorySubscriber
  def order_completed(order)
    ReserveInventoryJob.perform_later(order.id)
  end
end

# app/subscribers/analytics_subscriber.rb
class AnalyticsSubscriber
  def order_completed(order)
    TrackPurchaseJob.perform_later(order.id)
  end
end

# app/subscribers/shipping_subscriber.rb
class ShippingSubscriber
  def order_completed(order)
    ScheduleDeliveryJob.perform_later(order.id)
  end
end

# config/initializers/event_subscriptions.rb
Rails.application.config.after_initialize do
  OrderCompletedEvent.subscribe(EmailSubscriber.new)
  OrderCompletedEvent.subscribe(InventorySubscriber.new)
  OrderCompletedEvent.subscribe(AnalyticsSubscriber.new)
  OrderCompletedEvent.subscribe(ShippingSubscriber.new)
  # Add new subscribers here. CheckoutService never changes!
end

# Async subscribers with Wisper-Sidekiq
OrderCompletedEvent.subscribe(EmailSubscriber, async: true)

# Testing in isolation:
RSpec.describe CheckoutService do
  it 'publishes order_completed event' do
    events = spy('events')
    allow(OrderCompletedEvent).to receive(:new).and_return(events)
    allow(events).to receive(:call)

    CheckoutService.new.call(order)

    expect(events).to have_received(:call)
    # No need to mock EmailService, InventoryService, etc.
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
				title: 'Karafka (Kafka for Ruby/Rails)',
				url: 'https://karafka.io/',
			},
			{
				title: 'Domain Events in Rails (Arkency)',
				url: 'https://blog.arkency.com/domain-events-over-active-record-callbacks/',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 6: Kafka + Karafka',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Publish an OrderCompleted event from CheckoutService. Let subscribers (Email, Inventory, Analytics, Shipping) react independently.',
	},
};

// ============================================
// Act 7 Definition
// ============================================

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: 'The old tricks are not enough anymore.',
	description:
		'Your optimizations from Act 4 carried you this far, but traffic has outgrown a single database. Introduce read replicas, state machines, multi-tenancy, observability, modular architecture, and domain events.',
	levels: [
		level48MultiDatabase,
		level49StateMachines,
		level50MultiTenancy,
		level51Observability,
		level52ModularMonolith,
		level53DomainEvents,
	],
	unlockedNodes: ['read_replica', 'state_machine', 'tenant', 'event_bus'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};

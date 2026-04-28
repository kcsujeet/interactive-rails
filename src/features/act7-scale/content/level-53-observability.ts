import type { Level } from '@/types';

export const level53Observability: Level = {
	id: 'act7-level53-observability',
	actId: 7,
	levelNumber: 53,
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

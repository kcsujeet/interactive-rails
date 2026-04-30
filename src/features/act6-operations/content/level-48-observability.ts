import type { Level } from '@/types';

export const level48Observability: Level = {
	id: 'act6-level48-observability',
	actId: 6,
	levelNumber: 48,
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
		conceptExplanation: `Your app is running but you cannot see inside it. **Logs** tell you what happened line by line. **Metrics** show you trends over time. **Traces** follow a single request through your system. Together they are the three pillars of observability: the ability to ask any question about what your app is doing without shipping new code to find out.

This level covers logs, metrics, and traces. (L47 covers exception capture and grouping specifically. The two layers complement each other: error monitoring tells you about crashes; observability tells you about everything else.)

**Without observability:**
\`\`\`
Log output:
  I, [2024-01-15 03:22:14] INFO -- : User 42 placed order 999
  E, [2024-01-15 03:22:15] ERROR -- : Payment failed for order 999
-> Wall of unstructured text. Cannot filter, correlate, or build dashboards.
\`\`\`

**With structured logging + APM:**
\`\`\`
Lograge JSON output:
  {"method":"GET","path":"/api/v1/orders","status":200,
   "duration":45.2,"user_id":42,"company_id":7,"request_id":"abc-123"}
-> Searchable by any field. Correlatable across services via request_id.
\`\`\`

**1. Structured Logging.**
Each log line is JSON (or key=value), with consistent fields. Searchable by user_id, request_id, status, duration. Shipped to a log aggregator (Datadog Logs, ELK, Loki). Lograge is the Rails idiom: it collapses Rails' default per-request multi-line log into ONE structured line per request.

**2. Metrics (APM).**
Aggregated numbers measured over time:
- Request latency at the p50, p95, p99 percentiles (see the latency primer below).
- Error rates by endpoint.
- Database query counts and durations.
- Background job queue depth.
- Custom business metrics via StatsD: \`StatsD.increment('orders.completed', tags: ['plan:enterprise'])\`.

**Latency percentiles (the right way to measure request speed):**
- **p50 (median):** half of requests are faster, half slower. Hides the slow tail.
- **p75:** 75% of requests are faster than this value.
- **p90:** edge cases start showing up here.
- **p95 (industry standard):** captures the experience of 1-in-20 users. Alert on this, never on averages.
- **p99:** worst 1%. Often reveals infrastructure problems (cold caches, GC pauses, network blips).
- **p99.9:** extreme outliers. Useful for capacity planning, not for alerts.
- **Why not averages?** A 200ms average can hide a p99 of 5 seconds. The slow tail is the user experience that drives churn. Averages lie; percentiles reveal the tail.

**Latency SLO (the budget for slowness):** "p95 latency stays under 200ms, 99% of the time, over a 30-day rolling window." Like the error-rate SLO covered in L47, this gives you a budget: the percentage of time you can be slow before you've broken your promise. Latency SLOs are enforced via metrics tools (Datadog, Grafana); error-rate SLOs are enforced via error-monitoring tools (Sentry). Same concept, different layer.

**APM platform comparison:**
- **New Relic.** Simplest setup. Best for small teams getting started. Great Rails integration out of the box.
- **Grafana stack** (+ Prometheus + Loki + Tempo). Open-source, self-hosted, extremely customizable. More setup work; you run the infrastructure.
- **Datadog.** Easy integration, comprehensive. The trap is cost: Coinbase reportedly spent $65M/year on Datadog. Temporary metrics from old projects linger forever and the bill compounds. Review periodically and delete unused dashboards and metrics.

**3. Distributed Tracing.**
Follow a single request across every service it touches. Each "span" records duration and metadata; spans nest into a tree that shows you exactly where time was spent. OpenTelemetry is the vendor-neutral standard. Critical when one user request crosses 5+ services and you need to know which one was slow.

**Reading flame graphs (where to start):**
1. **Widest boxes first.** Most time spent, biggest optimization opportunity.
2. **Recurring patterns.** Repeated similar structures often indicate an N+1 loop you missed.
3. **Tall stacks.** Deep call chains may be simplifiable.

**Custom traces** for business-critical code paths:
\`\`\`ruby
Datadog::Tracing.trace('presenter.to_json', service: 'presentation-layer') { ... }
\`\`\`
Creates a separate service entry in your trace explorer so the JSON serialization step shows up as its own bar in the flame graph.`,
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

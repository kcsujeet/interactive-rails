import type { Level } from '@/types';

export const level47Observability: Level = {
	id: 'act6-level47-observability',
	actId: 6,
	levelNumber: 47,
	name: 'Observability',
	trigger: {
		type: 'incident',
		description:
			"A bad week, and the error tracker never made a sound: checkout crawled through the lunch rush (every request a 200), one customer's failed order could not be found in the logs, and a dead job worker went unnoticed for four hours while /up stayed green. Nothing raised, so nothing alerted. Make the app observable.",
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			"Three incidents, zero exceptions. Slow checkouts raise nothing, so the error tracker stays silent. The only evidence is production.log: five lines of prose per request, interleaved across concurrent requests, with no way to filter by duration or pull one request's story out of the braid. And Rails' built-in /up returns 200 whenever the process has booted, so the uptime monitor stayed green with the job worker dead.",
		rootCause:
			'The app can only report that it is broken, not that it is degraded. Text logs cannot be queried, requests have no internal timing breakdown, and the health endpoint answers "did it boot?" instead of "does it work?". Everything that fails without raising is invisible until customers become the alerting system.',
		codeExample: `# What the on-call engineer has to work with:

# log/production.log, lunch rush:
Started POST "/checkout" for 10.0.0.7 at 12:14:31
Processing by CheckoutsController#create as JSON
Started GET "/products/9" for 10.0.0.4 at 12:14:31
  Order Load (1.2ms)  SELECT "orders".* ...
Completed 200 OK in 3214ms (Views: 11.4ms ...)
Completed 200 OK in 187ms (Views: 9.8ms ...)

# - Which Completed belongs to which Started?
# - Whose checkout took 3214ms? What did it spend it on?
# - "Show me every request over 1 second": impossible.

# And the health check (config/routes.rb, as generated):
get "up" => "rails/health#show", as: :rails_health_check
# Returns 200 if the app BOOTED. Checks nothing else,
# by design. The dead job worker sails through it.`,
		goal: 'Make every request one queryable record carrying its own id and user, make the time inside a request visible step by step, and make the health endpoint answer "is the system working" instead of "did the process boot".',
		thresholds: {},
	},
	successConditions: [{ type: 'observability_configured' }],
	availableNodes: ['observability', 'health_check'],
	unlockedNodes: ['observability'],
	learningContent: {
		title: 'Observability: Logs, Traces & Health',
		goal: `In this level, you'll:\n- learn the boundary between error monitoring (what raises) and observability (what degrades silently).\n- collapse Rails' five-lines-of-prose request logging into one queryable JSON line per request.\n- attach request_id and user_id to every line so one request's story can be pulled out of the braid.\n- trace where the time goes inside a slow request, span by span.\n- replace the boot-only /up with a health check that verifies the database and the job worker.`,
		conceptExplanation: `The error tracker from the error-monitoring level answers "what crashed?". Observability answers everything else: "what is slow?", "what happened to this customer?", "is the system actually working right now?". The defining property: you can ask questions you did not think of in advance, without shipping new code to find out.

**The thesis of this level:** plenty goes wrong without anything raising. Slow requests return 200. A dead job worker fails no jobs (they just queue). A degraded dependency times out gracefully. The error tracker is silent through all of it, and without observability, customers become the alerting system.

**1. Structured logging (Lograge).**
Rails' default logger writes ~5 lines of prose per request, interleaved across concurrent requests. Lograge collapses each request into ONE structured line. With the JSON formatter, every line is queryable:

\`{"method":"POST","path":"/checkout","status":200,"duration":3214.2,"request_id":"f3a91c","user_id":42}\`

Questions become queries: \`jq 'select(.duration > 1000)'\` replaces forty minutes of grep. The custom_payload hook (which receives the controller instance, per the lograge README) is how request_id and user_id land on every line, and request_id is the thread that ties one request's records together, including its entry in the error tracker.

**2. Tracing (OpenTelemetry).**
A log line says WHAT happened; a trace says WHERE the time went inside one request. Each step (database query, payment-provider call, rendering) records a span with its duration; the spans nest into a timeline. OpenTelemetry is the vendor-neutral standard: the same instrumentation can report to any backend. Setup is two gems and one initializer with \`service_name\` plus \`use_all\` (which auto-discovers every instrumentable library in the Gemfile, per the OpenTelemetry Ruby docs).

**Reading a trace timeline:** widest span first (most time, biggest win); repeated similar spans usually mean an N+1 you missed; deep nesting hints at simplifiable call chains.

**3. Latency percentiles (how to read the numbers structured logs unlock):**
- **p50 (median):** half faster, half slower. Hides the slow tail.
- **p95 (the industry workhorse):** the experience of 1-in-20 requests. Alert on this, never on averages.
- **p99:** the worst 1%; often infrastructure (cold caches, GC pauses).
- **Why not averages?** A 200ms average can hide a p99 of 5 seconds, and the slow tail is the experience that loses customers.

**4. Health checks that mean something.**
Rails 8 ships /up (Rails::HealthController): 200 if the app booted, and per its docs it deliberately reflects nothing about dependencies; the docs suggest replacing the route when you need real checks. A deep health check verifies what "working" requires: the database answers SELECT 1, and the Solid Queue worker has heartbeated recently (workers touch last_heartbeat_at about every 60 seconds; one silent for 5 minutes is gone). One caution from the Rails docs: check what YOU own. Failing /up because a third-party API is down restarts a healthy app.

**Backends:** the tooling is interchangeable (Grafana/Loki/Tempo self-hosted; Datadog easy but watch the bill: unused dashboards and metrics compound cost; New Relic simple to start). The instrumentation in this level is backend-neutral, which is the point of the standards.`,
		railsCodeExample: `# ── Structured logging ──
# Gemfile
gem "lograge"

# config/environments/production.rb
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new

config.lograge.custom_payload do |controller|
  {
    request_id: controller.request.request_id,
    user_id: Current.user&.id
  }
end

# One line per request:
# {"method":"POST","path":"/checkout","status":200,
#  "duration":3214.2,"request_id":"f3a91c","user_id":42}

# ── Tracing ──
# Gemfile
gem "opentelemetry-sdk"
gem "opentelemetry-instrumentation-all"

# config/initializers/opentelemetry.rb
OpenTelemetry::SDK.configure do |c|
  c.service_name = "myapp"
  c.use_all
end

# Custom span around business-critical code:
tracer = OpenTelemetry.tracer_provider.tracer("checkout")
tracer.in_span("payment.charge") do
  PaymentService.charge(order)
end

# ── Deep health check ──
# config/routes.rb (was: rails/health#show, boot check only)
get "up" => "health#show", as: :rails_health_check

# app/controllers/health_controller.rb
class HealthController < ApplicationController
  allow_unauthenticated_access

  def show
    checks = HealthCheckService.call
    status = checks.values.all? ? :ok : :service_unavailable
    render json: checks, status: status
  end
end

# app/services/health_check_service.rb
class HealthCheckService < ApplicationService
  def call
    {
      database: database_alive?,
      job_worker: worker_alive?
    }
  end

  private

  def database_alive?
    ActiveRecord::Base.connection.execute("SELECT 1")
    true
  rescue ActiveRecord::ConnectionNotEstablished, ActiveRecord::StatementInvalid
    false
  end

  def worker_alive?
    # Solid Queue processes heartbeat every 60s (they touch
    # last_heartbeat_at); no heartbeat for 5 minutes means the
    # worker is gone, the same threshold the supervisor uses.
    SolidQueue::Process.where("last_heartbeat_at > ?", 5.minutes.ago).exists?
  end
end`,
		commonMistakes: [
			'Assuming the error tracker covers you (it only sees exceptions; slow, stuck, and degraded raise nothing)',
			'Logging sensitive data (passwords, tokens, PII) into structured logs that get shipped to third-party aggregators',
			"Leaving log lines without request_id (the one field that ties a request's logs, trace, and error report together)",
			'Trusting the built-in /up as a health check (it proves boot, not function, by design)',
			'Health-checking third-party dependencies you do not own (their outage restarts your healthy app)',
			'Alerting on average latency (averages hide the slow tail; alert on p95)',
		],
		whenToUse:
			'From the first day real customers depend on the app. Error monitoring first (crashes are the loudest signal), observability immediately after, because the second week of production always contains a slow-but-not-broken incident.',
		furtherReading: [
			{
				title: 'Lograge',
				url: 'https://github.com/roidrage/lograge',
			},
			{
				title: 'OpenTelemetry Ruby: Getting Started',
				url: 'https://opentelemetry.io/docs/languages/ruby/getting-started/',
			},
			{
				title: 'Rails::HealthController (/up semantics)',
				url: 'https://api.rubyonrails.org/classes/Rails/HealthController.html',
			},
			{
				title: 'Book: "Rails Scales!", Chapter 8: APM, Traces, Flame Graphs',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
		homework: [
			{
				task: 'Collapse request logging to one queryable line: install lograge, enable it with the JSON formatter, and use custom_payload to attach request_id to every line. Turn it on in development for testing.',
				commands: [
					'bundle add lograge',
					'curl -s http://localhost:3000/api/products > /dev/null',
				],
				verify:
					'The development log shows exactly one JSON line for the request, containing method, path, status, duration, and request_id.',
			},
			{
				task: 'Make /up mean "working", not "booted": route it to your own health controller that checks the database with SELECT 1 and requires a SolidQueue::Process heartbeat within the last 5 minutes.',
				commands: ['curl -i http://localhost:3000/up'],
				verify:
					'With bin/jobs stopped, /up returns 503 with job_worker false; start bin/jobs and within a minute it returns 200 with both checks true.',
			},
			{
				task: 'Add tracing: install the OpenTelemetry SDK and all-instrumentations gems, configure service_name plus use_all in an initializer, and print spans with the console exporter.',
				commands: [
					'bundle add opentelemetry-sdk opentelemetry-instrumentation-all',
					'OTEL_TRACES_EXPORTER=console bin/rails server',
				],
				verify:
					'Each request prints spans to the server console, including nested spans for the SQL queries inside the request.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Three gaps, three tools: requests need to become one queryable record each (a gem reshapes the log), the inside of a request needs a timeline (a vendor-neutral tracing standard), and /up needs to check what "working" actually requires here: the database, and whether the job worker has heartbeated lately.',
	},
};

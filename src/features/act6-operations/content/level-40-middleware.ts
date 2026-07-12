import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level40Middleware: Level = {
	id: 'act6-level40-middleware',
	actId: 6,
	levelNumber: 40,
	name: 'Middleware & Rack',
	trigger: {
		type: 'incident',
		description:
			'Production errors are untraceable, bots scrape the catalog undetected, and there is no structured request data. Requests arrive and leave with no visibility.',
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
		goal: `In this level, you'll:
- learn how Rack middleware works under the hood.
- write a custom middleware class that intercepts every request before it reaches your controllers.
- understand the initialize/call interface.
- insert it into the Rails middleware stack to add cross-cutting behavior like request logging or header injection.`,
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
- Request timing and metrics

**Per-request state: \`ActiveSupport::CurrentAttributes\` over \`Thread.current\`:**
The example below stashes the request id in \`Thread.current[:request_id]\`. That works on Puma (threaded) but breaks on fiber-based servers like Falcon, where many fibers share one thread and stomp on each other's thread-locals. Rails ships a primitive for this exact problem:

\`\`\`ruby
# app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :request_id, :user, :tenant_id
end

# In the middleware
Current.request_id = env['HTTP_X_REQUEST_ID']

# Anywhere in the app
Rails.logger.info(request_id: Current.request_id)
\`\`\`
Rails resets \`CurrentAttributes\` between requests automatically, so the manual \`ensure Thread.current[:request_id] = nil\` cleanup goes away. \`Current\` is fiber-safe and is the only correct choice for any per-request state that crosses files.

**Distributed tracing: \`traceparent\` over \`X-Request-Id\`:**
\`X-Request-Id\` is fine inside one app. Once you have N services calling each other, the modern standard is the W3C Trace Context header \`traceparent\` (and its companion \`tracestate\`). OpenTelemetry, Datadog, Honeycomb, and Sentry all read it directly. Generate a \`traceparent\` if upstream did not send one, propagate it on every outgoing HTTP call, and log the trace id alongside the request id. Without this, a single request crossing five services produces five disconnected log streams and incident debugging is guesswork.

**Structured logging: \`lograge\` or \`Rails.logger.tagged\`:**
\`Rails.logger.info({ ... }.to_json)\` works but is fragile (one stray newline in a value breaks the parser). At production scale either:

1. Use the \`lograge\` gem to collapse Rails' default multi-line per-request log into one structured line, with \`Lograge.custom_options\` injecting the trace id and tenant.
2. Use \`Rails.logger.tagged(Current.request_id) { ... }\` so every line in the request is automatically prefixed with the id, then ship logs via a JSON formatter (Fluent Bit, Vector, the AWS firehose).

Bare \`.to_json\` middleware logging is a starter pattern, not a production one.

**Abuse and bot detection: \`Rack::Attack\` over hand-rolled regex:**
The hand-rolled \`BOT_PATTERNS\` regex below is a maintenance trap: every new bot is a regex edit. \`Rack::Attack\` is the production standard and supports throttling ("20 requests/sec per IP"), banning ("block this IP for an hour after the third 4xx"), and pattern blocking with built-in safe lists for known good crawlers. Pair with \`Rack::Attack.throttled_response\` to return \`429 Too Many Requests\` with a \`Retry-After\` header, not \`403\`.

\`\`\`ruby
# config/initializers/rack_attack.rb
class Rack::Attack
  throttle("req/ip", limit: 300, period: 5.minutes) { |req| req.ip }
  blocklist("scrape-bots") do |req|
    Rack::Attack::Fail2Ban.filter("scrape-#{req.ip}",
      maxretry: 5, findtime: 1.minute, bantime: 1.hour) do
      req.path.start_with?("/api/") && req.user_agent =~ /\\b(curl|wget)\\b/i
    end
  end
end
\`\`\`

**Health-check exemption:**
Rails 8 ships a health-check route at \`/up\`. Load balancers hit it every few seconds. If your logging middleware logs \`/up\` and your bot-detection middleware 403s curl-style user agents, the load balancer floods the logs and eventually trips the bot detector. Production middleware skips both for known health-check paths:

\`\`\`ruby
def call(env)
  return @app.call(env) if env['PATH_INFO'] == '/up'
  # ... real work
end
\`\`\`

**Rack 3: header keys are lowercase:**
Rack 3 (Rails 7.1+) requires response header keys to be lowercase strings. The example writes \`headers['X-Request-Id']\`; under Rack 3 that should be \`headers['x-request-id']\`. Mixed-case keys still work for now via deprecation shims but will break in future Rack versions. New code: lowercase everywhere.

**Middleware order: verify with \`bin/rails middleware\`:**
\`insert_before 0\` puts a middleware above \`HostAuthorization\`, which means it runs even on requests that would otherwise be rejected for a bad Host header. That is fine for request-id assignment (you want every request tagged) but wrong for anything that assumes the request has been validated. After every middleware change, run \`bin/rails middleware\` and read the stack top-to-bottom.`,
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
			'Using Thread.current for per-request state on fiber-based servers like Falcon (fibers share threads and stomp each other). Use ActiveSupport::CurrentAttributes',
			'Logging the health-check path (/up) on every load-balancer ping. Skip it explicitly to keep signal-to-noise high',
			'Hand-rolling bot detection with a regex instead of using Rack::Attack with throttle + Fail2Ban (every new bot is a regex edit and there is no rate-limiting envelope)',
			'Returning 403 for rate-limit violations instead of 429 with a Retry-After header (clients cannot back off correctly without 429)',
			'Setting response header keys with mixed case under Rack 3 (works via deprecation shim, will break)',
			'Generating a fresh X-Request-Id on every hop instead of propagating the upstream value (breaks log correlation across services). Same for traceparent: read it first, only generate when missing',
			'Using bare Rails.logger.info(...to_json) for production logs. Either tag with Rails.logger.tagged or install lograge so each request emits one structured line',
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
			{
				title: 'ActiveSupport::CurrentAttributes',
				url: 'https://api.rubyonrails.org/classes/ActiveSupport/CurrentAttributes.html',
			},
			{
				title: 'Rack::Attack',
				url: 'https://github.com/rack/rack-attack',
			},
			{
				title: 'W3C Trace Context (traceparent)',
				url: 'https://www.w3.org/TR/trace-context/',
			},
			{
				title: 'Lograge',
				url: 'https://github.com/roidrage/lograge',
			},
		],
		homework: [
			{
				task: 'Print the middleware stack of your companion project and locate where Rails already assigns request ids.',
				commands: ['bin/rails middleware'],
				verify:
					'You can point at ActionDispatch::RequestId in the printed stack and name the middleware directly above and below it.',
			},
			{
				task: 'Write a RequestTimer middleware in lib/middleware that logs one JSON line per request (method, path, status, duration_ms), then insert it at the top of the stack in config/application.rb.',
				commands: [
					'bin/rails middleware',
					'curl -i http://localhost:3000/api/products',
				],
				verify:
					'bin/rails middleware shows RequestTimer at the top of the stack, and every curl request writes exactly one JSON log line containing all four fields.',
			},
			{
				task: 'Exempt the health-check path so load-balancer pings do not flood the log: return early from your middleware when PATH_INFO is /up.',
				commands: ['curl -s http://localhost:3000/up'],
				verify:
					'Hitting /up repeatedly writes no RequestTimer log lines, while /api/products still logs one line per request.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a Middleware node between Request and Router. Middleware processes every request before Rails sees it.',
	},
};

import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level41Middleware: Level = {
	id: 'act6-level41-middleware',
	actId: 6,
	levelNumber: 41,
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

import type { Level } from '@/types';
import { middlewarePipeline } from '@/utils/pipelineTemplates';

export const level43RateLimiting: Level = {
	id: 'act6-level43-rate-limiting',
	actId: 6,
	levelNumber: 43,
	name: 'Rate Limiting',
	requiresTests: true,
	trigger: {
		type: 'attack',
		description:
			'Bots hammer the API at 10K req/sec from one IP. The login endpoint is being brute-forced. Legitimate users are locked out because the server is overloaded.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
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
# 203.0.113.5 - GET /api/v1/products - 504 Gateway Timeout

# Rails 8 has a built-in rate_limit macro:
module Api::V1
  class SessionsController < Api::BaseController
    rate_limit to: 10, within: 3.minutes, only: :create
    # But we also need IP-level and user-level throttling
  end
end

# Problem: No per-IP throttling, no per-user API limits,
# no global safeguard against traffic spikes.`,
		goal: 'Configure rate limiting at both the controller level and the middleware level to stop abuse before it reaches your app.',
		thresholds: { maxErrorRate: 0.01 },
	},
	successConditions: [{ type: 'rate_limiting_configured' }],
	availableNodes: ['rate_limiter'],
	unlockedNodes: ['rate_limiter'],
	learningContent: {
		title: 'Rate Limiting: Rails 8 Built-in & Rack::Attack',
		goal: `In this level, you'll:
- protect your API from abuse by implementing rate limiting at multiple layers.
- throttle requests per controller action using built-in Rails tools.
- return proper 429 responses with Retry-After headers.
- understand the trade-offs between fixed window, sliding window, and token bucket strategies.`,
		conceptExplanation: `Rate limiting protects your app at multiple layers:

**Without rate limiting:**
\`\`\`
Attacker: 10,000 requests/second from one IP
Result:   Server overwhelmed, all legitimate users get 500 errors
          Login endpoint brute-forced: 1M password attempts in 100 seconds
          Database connection pool exhausted
\`\`\`

**With Rack::Attack:**
\`\`\`
Attacker: 10,000 requests/second → 10 allowed, 9,990 get 429 Too Many Requests
Legitimate users: Unaffected
Cost:     Request rejected at Rack middleware level, never hits Rails controllers,
          never touches the database, minimal server resources consumed
\`\`\`

**Rails 8 built-in \`rate_limit\`:**
- Declarative, per-controller macro
- Uses Solid Cache or MemoryStore by default
- Simple to configure for specific actions
- Returns 429 Too Many Requests automatically

**Rack::Attack (Rack-level, more granular):**
- Global throttles: \`limit: 10, period: 1\` per IP
- Per-user throttles via Warden session integration
- 429 Too Many Requests response with customizable \`throttled_responder\`
- Operates at the middleware level: before Rails controllers, before authentication, before any application logic

**Why Rack::Attack over Rails 8 \`rate_limit\`:** Rails 8's built-in rate_limit works per-controller action. Rack::Attack operates at the middleware level: the request is rejected with minimal resource consumption.

**Record creation limits** (often overlooked): Add \`MAX_AMOUNT\` validators to prevent data abuse. Real-world story: a customer support SaaS had users storing billions of tickets on the cheapest plan, not doing customer support, using it as free storage.

**Rate limit values should be in editable storage** (DB column, env var), not hardcoded. Avoid deploying just to change a limit.

**Defense in depth, three layers for production:**
1. **Rack::Attack** at the Rack level: Catches abuse before Rails even boots. IP throttling, blocklists, and Allow2Ban for repeat offenders. This is your first line of defense
2. **Rails 8 \`rate_limit\`** at the controller level: Per-action, per-user limits with business context (e.g., 10 login attempts per 3 minutes per IP)
3. **CDN/Load balancer** at the edge: Cloudflare, AWS WAF, or nginx rate limiting. Cheapest place to drop bad traffic; it never even reaches your servers`,
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

# app/controllers/api/v1/products_controller.rb
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
			{
				title:
					'Book: "Rails Scales!", Chapter 7: Rate Limits with Rack::Attack',
				url: 'https://pragprog.com/titles/cpscaling/rails-scales/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use Rails 8 rate_limit on the controller for per-action limits, and add Rack::Attack for IP-level throttling. Write tests to verify both layers.',
	},
};

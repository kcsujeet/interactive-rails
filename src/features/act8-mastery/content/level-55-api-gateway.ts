import type { Level } from '@/types';

export const level55APIGateway: Level = {
	id: 'act8-level55-api-gateway',
	actId: 8,
	levelNumber: 55,
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

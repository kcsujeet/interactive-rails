/**
 * Act 6: System Design
 * "Architecting at Scale"
 *
 * Levels 32-35: Message Queues, Distributed Caching, API Gateway, Microservices (Capstone)
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 32: Message Queues
// ============================================

const level32MessageQueues: Level = {
	id: 'act6-level32-message-queues',
	actId: 6,
	levelNumber: 32,
	name: 'Message Queues',
	trigger: {
		type: 'architecture',
		description:
			'Services need to communicate asynchronously. Tight coupling is killing us.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Services directly call each other. Failure cascades.',
		rootCause: 'No asynchronous messaging layer.',
		codeExample: `# BAD: Synchronous coupling
OrderService.create(order) do
  InventoryService.reserve(items)
  PaymentService.charge(amount)
  EmailService.send_confirmation(order)
end

# GOOD: Event-driven
OrderService.create(order)
publish('order.created', order)`,
		goal: 'Implement pub/sub messaging for service decoupling.',
		thresholds: {},
	},
	successConditions: [{ type: 'message_queue_configured' }],
	availableNodes: ['message_queue'],
	unlockedNodes: ['message_queue'],
	learningContent: {
		title: 'Message Queues & Event-Driven Architecture',
		conceptExplanation: `Decouple services with asynchronous messaging.

**Patterns:**
- Pub/Sub: Broadcast events to many subscribers
- Work Queue: Distribute tasks to workers
- Request/Reply: Async RPC`,
		railsCodeExample: `# Using Sidekiq for work queues
class OrderCreatedWorker
  include Sidekiq::Worker

  def perform(order_id)
    order = Order.find(order_id)
    # Process order...
  end
end

# Using Redis pub/sub
# Publisher
Redis.current.publish('orders', order.to_json)

# Subscriber
Redis.current.subscribe('orders') do |on|
  on.message do |channel, message|
    order = JSON.parse(message)
    process_order(order)
  end
end

# Using Kafka (via Karafka gem)
class OrdersConsumer < Karafka::BaseConsumer
  def consume
    messages.each do |message|
      ProcessOrder.call(message.payload)
    end
  end
end

# config/karafka.rb
class KarafkaApp < Karafka::App
  routes.draw do
    topic :orders do
      consumer OrdersConsumer
    end
  end
end`,
		commonMistakes: [
			'No dead letter queue',
			'Not handling duplicates',
			'Losing messages on failure',
		],
		whenToUse: 'When services need to communicate without tight coupling.',
		furtherReading: [{ title: 'Karafka', url: 'https://karafka.io/' }],
	},
	hint: { delay: 20, text: 'Publish events, let subscribers handle them.' },
};

// ============================================
// Level 33: Distributed Caching
// ============================================

const level33DistributedCaching: Level = {
	id: 'act6-level33-distributed-caching',
	actId: 6,
	levelNumber: 33,
	name: 'Distributed Caching',
	trigger: {
		type: 'scaling',
		description: 'Single Redis cannot handle the load. Need distributed cache.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Single Redis at capacity. Cache misses increasing.',
		rootCause: 'No distributed caching layer.',
		codeExample: `# Single Redis: One node handles all cache
# Distributed: Multiple nodes share the load`,
		goal: 'Configure Redis Cluster for distributed caching.',
		thresholds: {},
	},
	successConditions: [{ type: 'distributed_cache_configured' }],
	availableNodes: ['redis_cluster'],
	unlockedNodes: ['redis_cluster'],
	learningContent: {
		title: 'Distributed Caching with Redis Cluster',
		conceptExplanation: `Scale cache horizontally across nodes.

**Strategies:**
- Redis Cluster: Automatic sharding
- Consistent Hashing: Predictable key distribution
- Read Replicas: Scale reads`,
		railsCodeExample: `# config/environments/production.rb
config.cache_store = :redis_cache_store, {
  cluster: [
    { host: 'redis1.example.com', port: 6379 },
    { host: 'redis2.example.com', port: 6379 },
    { host: 'redis3.example.com', port: 6379 }
  ],
  pool_size: 5,
  pool_timeout: 5,
  error_handler: -> (method:, returning:, exception:) {
    Sentry.capture_exception(exception)
  }
}

# Or using Redis Sentinel for HA
config.cache_store = :redis_cache_store, {
  url: 'redis://mymaster',
  sentinels: [
    { host: 'sentinel1.example.com', port: 26379 },
    { host: 'sentinel2.example.com', port: 26379 }
  ],
  role: :master
}

# Cache with fallback
def fetch_user_data(user_id)
  Rails.cache.fetch("user/#{user_id}", expires_in: 1.hour) do
    User.find(user_id).as_json
  end
rescue Redis::CannotConnectError
  # Fallback to database
  User.find(user_id).as_json
end

# Multi-level caching
def hot_data(key)
  # L1: In-memory (per-process)
  @memory_cache ||= LruRedux::Cache.new(1000)
  @memory_cache.getset(key) do
    # L2: Redis cluster
    Rails.cache.fetch(key, expires_in: 1.hour) do
      compute_expensive_data(key)
    end
  end
end`,
		commonMistakes: ['No error handling', 'Cache stampede', 'No fallback'],
		whenToUse: 'When single Redis cannot handle load.',
		furtherReading: [
			{
				title: 'Redis Cluster',
				url: 'https://redis.io/docs/management/scaling/',
			},
		],
	},
	hint: { delay: 20, text: 'Use Redis Cluster with proper error handling.' },
};

// ============================================
// Level 34: API Gateway
// ============================================

const level34APIGateway: Level = {
	id: 'act6-level34-api-gateway',
	actId: 6,
	levelNumber: 34,
	name: 'API Gateway',
	trigger: {
		type: 'architecture',
		description:
			'Clients calling multiple services directly. Need unified entry point.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation: 'Mobile app calls 5 different services for one screen.',
		rootCause: 'No API aggregation layer.',
		codeExample: `# Without gateway: Client calls each service
# /users/1 -> User Service
# /orders?user=1 -> Order Service
# /recommendations -> Rec Service

# With gateway: Single call
# /api/dashboard -> Gateway aggregates`,
		goal: 'Implement API Gateway pattern.',
		thresholds: {},
	},
	successConditions: [{ type: 'api_gateway_configured' }],
	availableNodes: ['api_gateway'],
	unlockedNodes: ['api_gateway'],
	learningContent: {
		title: 'API Gateway Pattern',
		conceptExplanation: `Single entry point for all client requests.

**Responsibilities:**
- Request routing
- Authentication
- Rate limiting
- Response aggregation`,
		railsCodeExample: `# Gateway controller aggregates multiple services
class Api::DashboardController < ApplicationController
  def show
    # Parallel service calls
    futures = {
      user: Concurrent::Future.execute { UserService.get(current_user.id) },
      orders: Concurrent::Future.execute { OrderService.recent(current_user.id) },
      recommendations: Concurrent::Future.execute { RecService.for(current_user.id) }
    }

    render json: {
      user: futures[:user].value,
      orders: futures[:orders].value,
      recommendations: futures[:recommendations].value
    }
  end
end

# Using GraphQL as gateway
class Types::QueryType < Types::BaseObject
  field :dashboard, Types::DashboardType, null: false

  def dashboard
    {
      user: UserService.get(context[:current_user].id),
      orders: OrderService.recent(context[:current_user].id),
      recommendations: RecService.for(context[:current_user].id)
    }
  end
end

# Kong or AWS API Gateway for infrastructure
# routes.yaml
services:
  - name: users
    url: http://users-service:3000
    routes:
      - paths: ["/api/users"]
  - name: orders
    url: http://orders-service:3000
    routes:
      - paths: ["/api/orders"]
    plugins:
      - name: rate-limiting
        config:
          minute: 100`,
		commonMistakes: [
			'Gateway becoming monolith',
			'No circuit breakers',
			'Single point of failure',
		],
		whenToUse: 'When clients need to aggregate from multiple services.',
		furtherReading: [
			{
				title: 'API Gateway Pattern',
				url: 'https://microservices.io/patterns/apigateway.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Aggregate service calls, add authentication and rate limiting.',
	},
};

// ============================================
// Level 35: Microservices (Capstone)
// ============================================

const level35Microservices: Level = {
	id: 'act6-level35-microservices',
	actId: 6,
	levelNumber: 35,
	name: 'Microservices',
	isCapstone: true,
	trigger: {
		type: 'architecture',
		description:
			'Monolith is 2M lines. Teams stepping on each other. Time to extract services.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Monolith deployment takes 2 hours. Teams blocked on each other.',
		rootCause: 'Monolith has grown too large.',
		codeExample: `# Monolith: Everything in one codebase
# Microservices: Independent deployable services

# Extraction strategy: Strangler Fig Pattern
# 1. Identify bounded context
# 2. Extract to separate service
# 3. Route traffic to new service
# 4. Remove from monolith`,
		goal: 'Design a safe extraction with routing, async events, and cache strategy.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'api_gateway_configured' },
		{ type: 'message_queue_configured' },
		{ type: 'distributed_cache_configured' },
		{ type: 'microservice_extracted' },
	],
	availableNodes: ['api_gateway', 'message_queue', 'redis_cluster'],
	unlockedNodes: ['api_gateway', 'message_queue', 'redis_cluster'],
	learningContent: {
		title: 'Microservices Extraction (Capstone)',
		conceptExplanation: `Break monolith into independently deployable services.

**When to extract:**
- Different scaling needs
- Different team ownership
- Different deployment cadence

**Strangler Fig Pattern:**
Gradually replace monolith functionality.`,
		railsCodeExample: `# Step 1: Identify bounded context (Billing)
# app/models/billing/ - extract everything here

# Step 2: Create service interface in monolith
module BillingService
  class << self
    def charge(user_id, amount)
      if Feature.enabled?(:billing_service)
        # New service
        BillingClient.charge(user_id, amount)
      else
        # Old monolith code
        Billing::Charge.create!(user_id: user_id, amount: amount)
      end
    end
  end
end

# Step 3: New Rails service (billing-service)
# billing-service/app/controllers/api/charges_controller.rb
class Api::ChargesController < ApplicationController
  def create
    charge = Charge.create!(
      user_id: params[:user_id],
      amount: params[:amount]
    )
    render json: charge
  end
end

# Step 4: Client in monolith
# lib/billing_client.rb
class BillingClient
  include HTTParty
  base_uri ENV['BILLING_SERVICE_URL']

  def self.charge(user_id, amount)
    response = post('/api/charges', body: {
      user_id: user_id,
      amount: amount
    })

    raise ServiceError unless response.success?
    response.parsed_response
  end
end

# Step 5: Feature flag rollout
# config/initializers/flipper.rb
Flipper.enable_percentage_of_actors(:billing_service, 10)
# Then 25%, 50%, 100%

# Step 6: Data migration
# Run dual writes until cutover
def create_charge(user_id, amount)
  # Write to both during migration
  old_charge = Billing::Charge.create!(user_id: user_id, amount: amount)

  if Feature.enabled?(:billing_dual_write)
    BillingClient.charge(user_id, amount)
  end

  old_charge
end`,
		commonMistakes: [
			'Extracting too many services at once',
			'Distributed monolith (services too coupled)',
			'No feature flags for rollback',
			'Forgetting data migration',
		],
		whenToUse: 'When monolith size blocks team productivity.',
		furtherReading: [
			{
				title: 'Strangler Fig Pattern',
				url: 'https://martinfowler.com/bliki/StranglerFigApplication.html',
			},
			{
				title: 'Monolith to Microservices',
				url: 'https://www.oreilly.com/library/view/monolith-to-microservices/9781492047834/',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Use Strangler Fig: gateway + events + cache + gradual cutover.',
	},
};

// ============================================
// Act 6 Definition
// ============================================

export const actSix: Act = {
	id: 6,
	name: 'System Design',
	tagline: 'Architecting at Scale',
	description:
		'Master system design: message queues, distributed caching, API gateways, and microservices extraction.',
	levels: [
		level32MessageQueues,
		level33DistributedCaching,
		level34APIGateway,
		level35Microservices,
	],
	unlockedNodes: ['message_queue', 'redis_cluster', 'api_gateway'],
	metricsVisible: true,
};

/**
 * Act IV: Hyperscale Architecture
 * "Unicorn Scale."
 *
 * Levels 19-25: Distributed Systems, Decoupling, Stability
 */

import type { Act, Level } from '../../components/game/types';

// ============================================
// Level 19: Event Driven Architecture
// ============================================

const level19EventDriven: Level = {
  id: 'act4-level19-event-driven',
  actId: 4,
  levelNumber: 19,
  name: 'Event Driven Architecture',
  trigger: {
    type: 'refactor_request',
    description: 'The Checkout code knows too much (Email, Shipping, Inventory, Analytics). It\'s a monolith.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 200, y: 250, locked: true },
      { id: 'checkout-service', type: 'service', x: 360, y: 250, locked: false, config: { label: 'Checkout' } },
      { id: 'email-service', type: 'service', x: 560, y: 120, locked: true, config: { label: 'Email' } },
      { id: 'shipping-service', type: 'service', x: 560, y: 200, locked: true, config: { label: 'Shipping' } },
      { id: 'inventory-service', type: 'service', x: 560, y: 280, locked: true, config: { label: 'Inventory' } },
      { id: 'analytics-service', type: 'service', x: 560, y: 360, locked: true, config: { label: 'Analytics' } },
      { id: 'response-node', type: 'response', x: 760, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'checkout-service' },
      { id: 'c3', sourceNodeId: 'checkout-service', targetNodeId: 'email-service' },
      { id: 'c4', sourceNodeId: 'checkout-service', targetNodeId: 'shipping-service' },
      { id: 'c5', sourceNodeId: 'checkout-service', targetNodeId: 'inventory-service' },
      { id: 'c6', sourceNodeId: 'checkout-service', targetNodeId: 'analytics-service' },
      { id: 'c7', sourceNodeId: 'checkout-service', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Checkout Service has 6 outgoing wires. Every new feature adds another wire.',
    rootCause: 'Tight coupling. Checkout knows about every downstream service.',
    codeExample: `# Current: Checkout knows everything
class CheckoutService
  def call
    save_order
    EmailService.new(order).call      # Coupled
    ShippingService.new(order).call   # Coupled
    InventoryService.new(order).call  # Coupled
    AnalyticsService.new(order).call  # Coupled
  end
end`,
    goal: 'Add an Event Bus. Checkout publishes "OrderPlaced", others subscribe.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'event_bus' },
    { type: 'connection', sourceType: 'service', targetType: 'event_bus' },
  ],
  availableNodes: ['event_bus'],
  unlockedNodes: ['feature_flag'],
  learningContent: {
    title: 'Pub/Sub: Event-Driven Architecture',
    conceptExplanation: `Decouple services with events:

**Publisher**: Emits events ("OrderPlaced")
**Subscribers**: React to events they care about
**Event Bus**: Routes events to subscribers

Checkout doesn't know (or care) who's listening.`,
    railsCodeExample: `# Publisher: Checkout
class CheckoutService
  def call
    order = save_order
    EventBus.publish('order.placed', order: order)
    # Done! Doesn't know about Email, Shipping, etc.
  end
end

# Subscriber: Email
class EmailListener
  subscribe_to 'order.placed'

  def call(event)
    OrderMailer.confirmation(event.order).deliver_later
  end
end

# config/initializers/event_subscribers.rb
EventBus.subscribe('order.placed', EmailListener)
EventBus.subscribe('order.placed', ShippingListener)`,
    commonMistakes: [
      'Using events for synchronous operations',
      'Not handling event failures',
      'Tight coupling in event payloads',
    ],
    whenToUse: 'When multiple services need to react to the same action.',
    furtherReading: [
      { title: 'Event-Driven Rails', url: 'https://www.toptal.com/ruby-on-rails/the-publish-subscribe-pattern-on-rails' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Add Event Bus. Connect Checkout → Event Bus. Connect Event Bus → all subscriber services.',
  },
};

// ============================================
// Level 20: Feature Flags
// ============================================

const level20FeatureFlags: Level = {
  id: 'act4-level20-feature-flags',
  actId: 4,
  levelNumber: 20,
  name: 'Feature Flags',
  trigger: {
    type: 'new_feature',
    description: 'We are deploying a risky new Checkout Flow. We can\'t afford to break it for everyone.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 240, y: 250, locked: false },
      { id: 'old-checkout', type: 'service', x: 480, y: 180, locked: true, config: { label: 'Old Checkout' } },
      { id: 'new-checkout', type: 'service', x: 480, y: 320, locked: true, config: { label: 'New Checkout' } },
      { id: 'response-node', type: 'response', x: 700, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'new-checkout' },
      { id: 'c3', sourceNodeId: 'new-checkout', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Connection directly to New Checkout. All users get the risky new code.',
    rootCause: 'No progressive rollout mechanism.',
    codeExample: `# Current: All or nothing deployment
def checkout
  NewCheckoutService.new.call  # Everyone gets new code!
end

# If it's buggy, 100% of users are affected`,
    goal: 'Add a Feature Flag node. Route 10% to new checkout, 90% to old.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'feature_flag' },
    { type: 'connection', sourceType: 'controller', targetType: 'feature_flag' },
    { type: 'connection', sourceType: 'feature_flag', targetType: 'service' },
  ],
  availableNodes: ['feature_flag'],
  unlockedNodes: ['read_replica'],
  learningContent: {
    title: 'Feature Flags: Progressive Delivery',
    conceptExplanation: `Deploy safely with feature flags:

1. **Percentage rollout**: 1% → 10% → 50% → 100%
2. **User targeting**: Beta users first
3. **Kill switch**: Instant rollback

Green particles (90%): Old checkout
Blue particles (10%): New checkout`,
    railsCodeExample: `# Using Flipper gem
class CheckoutController
  def create
    if Flipper.enabled?(:new_checkout, current_user)
      NewCheckoutService.new.call
    else
      OldCheckoutService.new.call
    end
  end
end

# Gradual rollout
Flipper.enable_percentage_of_actors(:new_checkout, 10)  # 10%
# Monitor...
Flipper.enable_percentage_of_actors(:new_checkout, 50)  # 50%
# Monitor...
Flipper.enable(:new_checkout)  # 100%`,
    commonMistakes: [
      'Big bang deployments without flags',
      'Leaving old flags in code forever',
      'Not monitoring flag performance',
    ],
    whenToUse: 'Any risky or significant change.',
    furtherReading: [
      { title: 'Flipper', url: 'https://github.com/flippercloud/flipper' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add Feature Flag between Controller and Services. Configure 10% to New Checkout.',
  },
};

// ============================================
// Level 21: Read/Write Splitting
// ============================================

const level21ReadWriteSplitting: Level = {
  id: 'act4-level21-read-write-splitting',
  actId: 4,
  levelNumber: 21,
  name: 'Read/Write Splitting',
  trigger: {
    type: 'traffic_spike',
    description: 'Database CPU is at 100%. It\'s mostly SELECT queries.',
    intensity: 50,
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 240, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 420, y: 250, locked: true },
      { id: 'database-node', type: 'database', x: 620, y: 250, locked: true, config: { label: 'Primary' } },
      { id: 'response-node', type: 'response', x: 820, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c3', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c4', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Single DB Node catching fire. 90% of queries are reads.',
    rootCause: 'All traffic hitting primary database.',
    codeExample: `# Current: All queries to primary
Post.all           # READ → Primary
Post.create(...)   # WRITE → Primary
User.find(id)      # READ → Primary

# Primary is overwhelmed with reads!`,
    goal: 'Add a Read Replica. Route blue (read) particles to replica, orange (write) to primary.',
    thresholds: {
      maxLatency: 200,
    },
  },
  successConditions: [
    { type: 'node_present', nodeType: 'read_replica' },
    { type: 'connection', sourceType: 'model', targetType: 'read_replica' },
  ],
  availableNodes: ['read_replica'],
  unlockedNodes: ['shard_router'],
  learningContent: {
    title: 'Database Replication: Read/Write Splitting',
    conceptExplanation: `Scale reads with replicas:

**Primary (Writer)**: All writes go here
**Replica (Reader)**: Copy of primary, handles reads

Blue particles (reads) → Replica
Orange particles (writes) → Primary

Replica lag: ~100ms delay from primary`,
    railsCodeExample: `# config/database.yml
production:
  primary:
    database: myapp_primary
    host: primary.db.example.com
  primary_replica:
    database: myapp_primary
    host: replica.db.example.com
    replica: true

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# Automatic routing
Post.all  # → Replica
Post.create(...)  # → Primary`,
    commonMistakes: [
      'Not accounting for replica lag',
      'Reading from replica after write (stale data)',
      'Not monitoring replication lag',
    ],
    whenToUse: 'When read traffic dominates (>70% reads).',
    furtherReading: [
      { title: 'Rails Multiple Databases', url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add Read Replica node. Connect Model → Replica for reads, Model → Primary for writes.',
  },
};

// ============================================
// Level 22: Database Sharding
// ============================================

const level22Sharding: Level = {
  id: 'act4-level22-sharding',
  actId: 4,
  levelNumber: 22,
  name: 'Database Sharding',
  trigger: {
    type: 'data_growth',
    description: 'The User table is 10TB. It won\'t fit on a single disk anymore.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 240, y: 250, locked: true },
      { id: 'model-node', type: 'model', x: 420, y: 250, locked: true, config: { label: 'User' } },
      { id: 'database-node', type: 'database', x: 620, y: 250, locked: true, config: { label: 'Primary (10TB)' } },
      { id: 'response-node', type: 'response', x: 820, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
      { id: 'c3', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
      { id: 'c4', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Disk Space Alarm. Single database can\'t hold all the data.',
    rootCause: 'Vertical scaling limit reached.',
    codeExample: `# Current: Single 10TB database
# Disk full!
# Can't add more storage to one server

# Need horizontal scaling (sharding)`,
    goal: 'Add Shard Router and multiple DB shards. Route by tenant_id.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'shard_router' },
    { type: 'node_count', nodeType: 'database', count: 2 },
    { type: 'connection', sourceType: 'shard_router', targetType: 'database' },
  ],
  availableNodes: ['shard_router', 'database'],
  unlockedNodes: ['circuit_breaker'],
  learningContent: {
    title: 'Horizontal Sharding',
    conceptExplanation: `When one database isn't enough:

**Sharding**: Split data across multiple databases
**Shard Key**: Determines which shard (e.g., tenant_id)

tenant_id % 2 = 0 → Shard A
tenant_id % 2 = 1 → Shard B

Note: If you chose SQLite in Level 1, you cannot shard!`,
    railsCodeExample: `# config/database.yml
production:
  shard_a:
    database: myapp_shard_a
  shard_b:
    database: myapp_shard_b

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  def self.shard_for(tenant_id)
    tenant_id.even? ? :shard_a : :shard_b
  end
end

# Usage
ApplicationRecord.connected_to(shard: shard_for(tenant.id)) do
  User.find(user_id)
end`,
    commonMistakes: [
      'Choosing SQLite (cannot shard)',
      'Cross-shard queries (very expensive)',
      'Uneven shard distribution (hot spots)',
    ],
    whenToUse: 'When data exceeds single server capacity.',
    furtherReading: [
      { title: 'Rails Sharding', url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html#horizontal-sharding' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Add Shard Router. Add 2 Database shards. Configure routing by tenant_id.',
  },
};

// ============================================
// Level 23: Circuit Breakers
// ============================================

const level23CircuitBreakers: Level = {
  id: 'act4-level23-circuit-breakers',
  actId: 4,
  levelNumber: 23,
  name: 'Circuit Breakers',
  trigger: {
    type: 'outage',
    description: 'The "Recommendations" microservice is crashing. It\'s taking down the core Feed.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 200, y: 250, locked: true },
      { id: 'feed-service', type: 'service', x: 360, y: 250, locked: true, config: { label: 'Feed' } },
      { id: 'recs-service', type: 'service', x: 560, y: 180, locked: true, config: { label: 'Recommendations' } },
      { id: 'posts-service', type: 'service', x: 560, y: 320, locked: true, config: { label: 'Posts' } },
      { id: 'response-node', type: 'response', x: 760, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'feed-service' },
      { id: 'c3', sourceNodeId: 'feed-service', targetNodeId: 'recs-service' },
      { id: 'c4', sourceNodeId: 'feed-service', targetNodeId: 'posts-service' },
      { id: 'c5', sourceNodeId: 'recs-service', targetNodeId: 'response-node' },
      { id: 'c6', sourceNodeId: 'posts-service', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'Feed failing 100% because Recs are down. Posts are fine but nobody can see them.',
    rootCause: 'No isolation between services. One failure cascades.',
    codeExample: `# Current: Tight coupling
class FeedService
  def call
    posts = PostsService.call
    recs = RecsService.call  # FAILS → everything fails
    { posts: posts, recs: recs }
  end
end`,
    goal: 'Wrap Recommendations in a Circuit Breaker. Feed continues without recs.',
    thresholds: {
      maxErrorRate: 5,
    },
  },
  successConditions: [
    { type: 'node_present', nodeType: 'circuit_breaker' },
    { type: 'connection', sourceType: 'feed-service', targetType: 'circuit_breaker' },
    { type: 'connection', sourceType: 'circuit_breaker', targetType: 'recs-service' },
  ],
  availableNodes: ['circuit_breaker'],
  unlockedNodes: ['tracer'],
  learningContent: {
    title: 'Circuit Breakers: Blast Radius Containment',
    conceptExplanation: `Circuit breakers prevent cascading failures:

**Closed**: Normal operation, requests flow
**Open**: Service failing, requests fail-fast
**Half-Open**: Testing if service recovered

After 5 errors → Circuit OPENS
After 30 seconds → Test one request
If success → Circuit CLOSES`,
    railsCodeExample: `# Using Stoplight gem
class FeedService
  def call
    posts = PostsService.call  # Always needed

    recs = Stoplight('recommendations')
      .with_fallback { [] }  # Return empty on failure
      .with_threshold(5)     # Open after 5 failures
      .run { RecsService.call }

    { posts: posts, recs: recs }
  end
end`,
    commonMistakes: [
      'Not having fallback behavior',
      'Setting threshold too high (cascades before opening)',
      'Not monitoring circuit state',
    ],
    whenToUse: 'Any call to external service or microservice.',
    furtherReading: [
      { title: 'Stoplight', url: 'https://github.com/bolshakov/stoplight' },
    ],
  },
  hint: {
    delay: 25,
    text: 'Add Circuit Breaker before Recommendations. After 5 errors, circuit "snaps" open.',
  },
};

// ============================================
// Level 24: Observability
// ============================================

const level24Observability: Level = {
  id: 'act4-level24-observability',
  actId: 4,
  levelNumber: 24,
  name: 'Observability',
  trigger: {
    type: 'incident',
    description: 'Requests are taking 2s. We have no idea which Service is the bottleneck.',
  },
  startingPipeline: {
    nodes: [
      { id: 'request-node', type: 'request', x: 60, y: 250, locked: true },
      { id: 'controller-node', type: 'controller', x: 160, y: 250, locked: true },
      { id: 'service1', type: 'service', x: 300, y: 180, locked: true, config: { label: 'Auth' } },
      { id: 'service2', type: 'service', x: 300, y: 320, locked: true, config: { label: 'Billing' } },
      { id: 'service3', type: 'service', x: 480, y: 250, locked: true, config: { label: 'Orders' } },
      { id: 'database-node', type: 'database', x: 640, y: 250, locked: true },
      { id: 'response-node', type: 'response', x: 800, y: 250, locked: true },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'controller-node' },
      { id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'service1' },
      { id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'service2' },
      { id: 'c4', sourceNodeId: 'service1', targetNodeId: 'service3' },
      { id: 'c5', sourceNodeId: 'service2', targetNodeId: 'service3' },
      { id: 'c6', sourceNodeId: 'service3', targetNodeId: 'database-node' },
      { id: 'c7', sourceNodeId: 'database-node', targetNodeId: 'response-node' },
    ],
  },
  problem: {
    observation: 'A complex graph. Mystery 2s latency. Which service is slow?',
    rootCause: 'No distributed tracing. Can\'t see where time is spent.',
    codeExample: `# Current: No visibility
# Request takes 2000ms
# Is it Auth? Billing? Orders? Database?
# We're flying blind!`,
    goal: 'Add tracing probes. View the flame graph to identify the bottleneck.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_present', nodeType: 'tracer' },
  ],
  availableNodes: ['tracer'],
  unlockedNodes: [],
  learningContent: {
    title: 'Distributed Tracing with OpenTelemetry',
    conceptExplanation: `Tracing shows where time is spent:

**Span**: One unit of work (service call, DB query)
**Trace**: All spans for one request
**Flame Graph**: Visual timeline of spans

Find the bottleneck in seconds, not hours.`,
    railsCodeExample: `# Gemfile
gem 'opentelemetry-sdk'
gem 'opentelemetry-instrumentation-all'

# config/initializers/opentelemetry.rb
OpenTelemetry::SDK.configure do |c|
  c.use_all  # Auto-instrument Rails, ActiveRecord, etc.
end

# View traces in Jaeger/Honeycomb/Datadog
# See exactly which service/query is slow`,
    commonMistakes: [
      'Not adding tracing until production fire',
      'Only logging, not tracing',
      'Not sampling (tracing everything is expensive)',
    ],
    whenToUse: 'Any distributed system. Add early, not during an incident.',
    furtherReading: [
      { title: 'OpenTelemetry Ruby', url: 'https://opentelemetry.io/docs/instrumentation/ruby/' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Add Tracer probes to services. View the Flame Graph to find the N+1 in Billing.',
  },
};

// ============================================
// Level 25: The Microservices Breakup
// ============================================

const level25Microservices: Level = {
  id: 'act4-level25-microservices',
  actId: 4,
  levelNumber: 25,
  name: 'The Microservices Breakup',
  trigger: {
    type: 'refactor_request',
    description: 'The Organization has scaled to 500 engineers. The Monolith deployment queue is 4 hours long.',
  },
  startingPipeline: {
    nodes: [
      { id: 'monolith', type: 'controller', x: 400, y: 250, locked: false, config: { label: 'Monolith (Giant!)' } },
    ],
    connections: [],
  },
  problem: {
    observation: 'One Giant App Node. Every change requires full deployment. 4 hour queue.',
    rootCause: 'Monolith too big for the team. Deployment contention.',
    codeExample: `# Current: One huge Rails app
# 500 engineers committing to one repo
# Every PR waits in 4-hour deploy queue
# One bad commit breaks everything

# Time to break it up!`,
    goal: 'Use the Scalpel tool to carve out Billing and Identity into separate services.',
    thresholds: {},
  },
  successConditions: [
    { type: 'node_count', nodeType: 'service', count: 3 },
  ],
  availableNodes: ['service', 'api_gateway'],
  unlockedNodes: [],
  learningContent: {
    title: 'Service-Oriented Architecture (SOA)',
    conceptExplanation: `When the monolith is too big:

1. **Identify domains**: Billing, Identity, Orders
2. **Define contracts**: API specs between services
3. **Extract gradually**: One domain at a time
4. **Independent deployment**: Each service deploys alone

Final test: Deploy Billing while Identity restarts. Success!`,
    railsCodeExample: `# Before: One monolith
class ApplicationController < ActionController::Base
  # Everything here
end

# After: Separate services
# billing-service/
#   API for charges, invoices
#
# identity-service/
#   API for users, auth
#
# main-app/
#   Calls billing + identity via HTTP/gRPC`,
    commonMistakes: [
      'Extracting too early (premature optimization)',
      'Not defining clear boundaries',
      'Creating a distributed monolith',
    ],
    whenToUse: 'When team size exceeds monolith coordination capacity.',
    furtherReading: [
      { title: 'Monolith to Microservices', url: 'https://martinfowler.com/articles/break-monolith-into-microservices.html' },
    ],
  },
  hint: {
    delay: 30,
    text: 'Use Scalpel to carve domains. Create Billing, Identity, and Core services.',
  },
};

// ============================================
// Act IV Definition
// ============================================

export const actFour: Act = {
  id: 4,
  name: 'Hyperscale Architecture',
  tagline: 'Unicorn Scale.',
  description: 'Distributed Systems, Decoupling, and Production Stability. Build systems for 500 engineers.',
  levels: [
    level19EventDriven,
    level20FeatureFlags,
    level21ReadWriteSplitting,
    level22Sharding,
    level23CircuitBreakers,
    level24Observability,
    level25Microservices,
  ],
  unlockedNodes: ['event_bus', 'feature_flag', 'read_replica', 'shard_router', 'tracer', 'api_gateway'],
  metricsVisible: true,
  visibleMetrics: ['latency', 'queryCount', 'errorRate', 'cacheHitRate', 'replicaLag', 'circuitState'],
};

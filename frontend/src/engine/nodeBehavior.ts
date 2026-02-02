/**
 * Node Behavior Definitions
 *
 * Formal rules for each node type per spec §38.
 * Each node has defined costs, multipliers, failure modes, and connection rules.
 */

// ============================================
// Types
// ============================================

export type FailureMode = 'soft' | 'hard' | 'silent' | 'cascade';

export interface NodeBehavior {
  /** Base latency added when request passes through this node (ms) */
  latencyCost: number;
  /** Memory units consumed by this node */
  memoryCost: number;
  /** How many times this node is called per request (1 = once, N = multiplied) */
  callMultiplier: number;
  /** Whether calls through this node block or can be async */
  blocking: boolean;
  /** How this node can fail */
  failureModes: FailureMode[];
  /** Side effects this node can cause */
  sideEffects: string[];
  /** Node types that can be targets of connections FROM this node */
  allowedConnections: string[];
  /** Node types that are explicitly forbidden as targets (with reason) */
  blockedConnections: Array<{ target: string; reason: string }>;
  /** Human-readable description of what this node does */
  description: string;
  /** The Rails/backend concept this node represents */
  railsConcept: string;
  /** When this node type unlocks (act number) */
  unlocksInAct: number;
}

export interface ConnectionCost {
  /** Additional latency for this specific connection type */
  latency: number;
  /** Whether this connection can cause N+1 queries */
  canCauseNPlusOne: boolean;
  /** Whether this connection is async/non-blocking */
  async: boolean;
}

// ============================================
// Node Behaviors by Type
// ============================================

export const NODE_BEHAVIORS: Record<string, NodeBehavior> = {
  // === Act I - Basics ===

  request: {
    latencyCost: 0,
    memoryCost: 1,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: [],
    allowedConnections: ['router'],
    blockedConnections: [
      { target: 'database', reason: 'Requests cannot directly access the database' },
      { target: 'model', reason: 'Requests must go through a router first' },
    ],
    description: 'Incoming HTTP request from a client',
    railsConcept: 'ActionDispatch::Request',
    unlocksInAct: 1,
  },

  router: {
    latencyCost: 1,
    memoryCost: 0,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: [],
    allowedConnections: ['controller'],
    blockedConnections: [
      { target: 'database', reason: 'Router cannot access database directly' },
      { target: 'model', reason: 'Router must dispatch to a controller' },
      { target: 'view', reason: 'Router cannot render views directly' },
    ],
    description: 'Routes requests to the appropriate controller action',
    railsConcept: 'config/routes.rb',
    unlocksInAct: 1,
  },

  controller: {
    latencyCost: 5,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard'],
    sideEffects: ['session_write', 'log'],
    allowedConnections: ['model', 'view', 'service', 'cache', 'job_queue'],
    blockedConnections: [
      { target: 'database', reason: 'Controllers should not query the database directly - use a Model' },
    ],
    description: 'Handles request logic and coordinates models/views',
    railsConcept: 'ActionController::Base',
    unlocksInAct: 1,
  },

  model: {
    latencyCost: 2,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard', 'silent'],
    sideEffects: ['callback', 'validation'],
    allowedConnections: ['database', 'cache', 'eager_load', 'model'],
    blockedConnections: [
      { target: 'view', reason: 'Models should not render views directly' },
      { target: 'controller', reason: 'Models should not call controllers' },
    ],
    description: 'ActiveRecord model representing a database table',
    railsConcept: 'ActiveRecord::Base',
    unlocksInAct: 1,
  },

  database: {
    latencyCost: 50,
    memoryCost: 20,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard', 'cascade'],
    sideEffects: ['query', 'write', 'lock'],
    allowedConnections: ['model', 'view', 'response', 'cache'],
    blockedConnections: [],
    description: 'PostgreSQL database executing queries',
    railsConcept: 'ActiveRecord::ConnectionAdapters',
    unlocksInAct: 1,
  },

  view: {
    latencyCost: 10,
    memoryCost: 15,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft'],
    sideEffects: ['render'],
    allowedConnections: ['response', 'cache'],
    blockedConnections: [
      { target: 'database', reason: 'Views should not query the database directly - this causes hidden N+1s' },
      { target: 'model', reason: 'Views should receive data, not fetch it' },
    ],
    description: 'ERB/HTML template rendering the response',
    railsConcept: 'ActionView::Base',
    unlocksInAct: 1,
  },

  response: {
    latencyCost: 1,
    memoryCost: 0,
    callMultiplier: 1,
    blocking: true,
    failureModes: [],
    sideEffects: [],
    allowedConnections: [],
    blockedConnections: [],
    description: 'HTTP response sent back to the client',
    railsConcept: 'ActionDispatch::Response',
    unlocksInAct: 1,
  },

  // === Act II - Performance ===

  eager_load: {
    latencyCost: 5,
    memoryCost: 30,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft'],
    sideEffects: ['memory_allocation'],
    allowedConnections: ['database', 'model'],
    blockedConnections: [],
    description: 'Eager loads associated records to prevent N+1 queries',
    railsConcept: 'includes() / eager_load() / preload()',
    unlocksInAct: 2,
  },

  index: {
    latencyCost: -40,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['index_maintenance'],
    allowedConnections: ['database'],
    blockedConnections: [],
    description: 'Database index for faster lookups',
    railsConcept: 'add_index migration',
    unlocksInAct: 2,
  },

  service: {
    latencyCost: 3,
    memoryCost: 8,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard'],
    sideEffects: [],
    allowedConnections: ['model', 'cache', 'job_queue', 'external_api'],
    blockedConnections: [
      { target: 'view', reason: 'Services should return data, not render views' },
    ],
    description: 'Service object encapsulating business logic',
    railsConcept: 'app/services/*.rb',
    unlocksInAct: 2,
  },

  scope: {
    latencyCost: 1,
    memoryCost: 2,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['silent'],
    sideEffects: [],
    allowedConnections: ['database', 'model'],
    blockedConnections: [],
    description: 'Named scope for reusable query conditions',
    railsConcept: 'scope :active, -> { where(active: true) }',
    unlocksInAct: 2,
  },

  batch: {
    latencyCost: 10,
    memoryCost: 5,
    callMultiplier: 0.01,
    blocking: true,
    failureModes: ['soft'],
    sideEffects: ['batch_processing'],
    allowedConnections: ['database', 'model'],
    blockedConnections: [],
    description: 'Batch processing for bulk operations',
    railsConcept: 'find_each / insert_all / upsert_all',
    unlocksInAct: 2,
  },

  // === Act III - Scaling ===

  cache: {
    latencyCost: 2,
    memoryCost: 25,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent', 'soft'],
    sideEffects: ['cache_write', 'cache_invalidate'],
    allowedConnections: ['database', 'model', 'view', 'response'],
    blockedConnections: [],
    description: 'Rails cache for storing computed/fetched data',
    railsConcept: 'Rails.cache.fetch',
    unlocksInAct: 3,
  },

  fragment_cache: {
    latencyCost: 1,
    memoryCost: 15,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['cache_write'],
    allowedConnections: ['view', 'response'],
    blockedConnections: [],
    description: 'Fragment caching for view partials',
    railsConcept: 'cache do ... end in views',
    unlocksInAct: 3,
  },

  http_cache: {
    latencyCost: 0,
    memoryCost: 0,
    callMultiplier: 0,
    blocking: false,
    failureModes: [],
    sideEffects: ['etag', 'last_modified'],
    allowedConnections: ['response'],
    blockedConnections: [],
    description: 'HTTP caching with ETags and Last-Modified',
    railsConcept: 'fresh_when / stale?',
    unlocksInAct: 3,
  },

  job_queue: {
    latencyCost: 5,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['soft'],
    sideEffects: ['enqueue'],
    allowedConnections: ['worker', 'redis'],
    blockedConnections: [
      { target: 'response', reason: 'Jobs are async and cannot directly affect the response' },
    ],
    description: 'Background job queue for async processing',
    railsConcept: 'ActiveJob.perform_later',
    unlocksInAct: 3,
  },

  worker: {
    latencyCost: 0,
    memoryCost: 50,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['soft', 'hard'],
    sideEffects: ['process', 'retry'],
    allowedConnections: ['model', 'database', 'cache', 'external_api', 'mailer'],
    blockedConnections: [
      { target: 'response', reason: 'Workers run asynchronously' },
      { target: 'view', reason: 'Workers do not render views' },
    ],
    description: 'Sidekiq worker processing background jobs',
    railsConcept: 'Sidekiq::Worker',
    unlocksInAct: 3,
  },

  mailer: {
    latencyCost: 100,
    memoryCost: 20,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard'],
    sideEffects: ['email_send'],
    allowedConnections: ['job_queue'],
    blockedConnections: [
      { target: 'response', reason: 'Emails should be sent async to avoid blocking' },
    ],
    description: 'ActionMailer for sending emails',
    railsConcept: 'ActionMailer::Base',
    unlocksInAct: 3,
  },

  storage: {
    latencyCost: 50,
    memoryCost: 100,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard'],
    sideEffects: ['upload', 'download'],
    allowedConnections: ['model', 'job_queue'],
    blockedConnections: [],
    description: 'ActiveStorage for file uploads',
    railsConcept: 'ActiveStorage::Blob',
    unlocksInAct: 3,
  },

  // === Act IV - Production ===

  policy: {
    latencyCost: 2,
    memoryCost: 3,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['authorize'],
    allowedConnections: ['controller', 'model'],
    blockedConnections: [],
    description: 'Authorization policy (Pundit)',
    railsConcept: 'Pundit::Policy',
    unlocksInAct: 4,
  },

  rate_limiter: {
    latencyCost: 1,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['throttle', 'block'],
    allowedConnections: ['controller', 'response'],
    blockedConnections: [],
    description: 'Rate limiting to prevent abuse',
    railsConcept: 'Rack::Attack',
    unlocksInAct: 4,
  },

  circuit_breaker: {
    latencyCost: 1,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['trip', 'reset'],
    allowedConnections: ['external_api', 'database', 'cache'],
    blockedConnections: [],
    description: 'Circuit breaker for fault tolerance',
    railsConcept: 'Circuitbox gem',
    unlocksInAct: 4,
  },

  optimistic_lock: {
    latencyCost: 0,
    memoryCost: 1,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft'],
    sideEffects: ['version_check'],
    allowedConnections: ['model', 'database'],
    blockedConnections: [],
    description: 'Optimistic locking with lock_version',
    railsConcept: 'ActiveRecord::Locking::Optimistic',
    unlocksInAct: 4,
  },

  pessimistic_lock: {
    latencyCost: 10,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard', 'cascade'],
    sideEffects: ['row_lock', 'wait'],
    allowedConnections: ['model', 'database'],
    blockedConnections: [],
    description: 'Pessimistic locking with SELECT FOR UPDATE',
    railsConcept: 'with_lock { }',
    unlocksInAct: 4,
  },

  transaction: {
    latencyCost: 5,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard', 'cascade'],
    sideEffects: ['begin', 'commit', 'rollback'],
    allowedConnections: ['model', 'database'],
    blockedConnections: [],
    description: 'Database transaction wrapper',
    railsConcept: 'ActiveRecord::Base.transaction',
    unlocksInAct: 4,
  },

  // === Act V - Infrastructure ===

  redis: {
    latencyCost: 2,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['soft', 'hard'],
    sideEffects: ['cache_write', 'pubsub'],
    allowedConnections: ['cache', 'job_queue', 'worker', 'session'],
    blockedConnections: [],
    description: 'Redis for caching, queues, and pub/sub',
    railsConcept: 'Redis.current',
    unlocksInAct: 5,
  },

  pubsub: {
    latencyCost: 1,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['publish', 'subscribe'],
    allowedConnections: ['redis', 'worker', 'websocket'],
    blockedConnections: [],
    description: 'Redis Pub/Sub for real-time messaging',
    railsConcept: 'Redis#publish / #subscribe',
    unlocksInAct: 5,
  },

  websocket: {
    latencyCost: 0,
    memoryCost: 20,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['soft'],
    sideEffects: ['broadcast', 'stream'],
    allowedConnections: ['pubsub', 'model'],
    blockedConnections: [],
    description: 'ActionCable WebSocket connection',
    railsConcept: 'ActionCable::Channel',
    unlocksInAct: 5,
  },

  event_bus: {
    latencyCost: 2,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['soft'],
    sideEffects: ['publish', 'consume'],
    allowedConnections: ['worker', 'model', 'service'],
    blockedConnections: [],
    description: 'Event bus for domain events',
    railsConcept: 'Wisper / Rails Event Store',
    unlocksInAct: 5,
  },

  // === Act VI - Platform ===

  api_gateway: {
    latencyCost: 5,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['route', 'transform'],
    allowedConnections: ['router', 'rate_limiter', 'policy'],
    blockedConnections: [],
    description: 'API gateway for request routing and transformation',
    railsConcept: 'Kong / nginx',
    unlocksInAct: 6,
  },

  load_balancer: {
    latencyCost: 1,
    memoryCost: 0,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['hard'],
    sideEffects: ['distribute'],
    allowedConnections: ['request', 'health_check'],
    blockedConnections: [],
    description: 'Load balancer distributing traffic',
    railsConcept: 'HAProxy / ALB',
    unlocksInAct: 6,
  },

  cdn: {
    latencyCost: -50,
    memoryCost: 0,
    callMultiplier: 0,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['edge_cache'],
    allowedConnections: ['response', 'storage'],
    blockedConnections: [],
    description: 'CDN for static asset delivery',
    railsConcept: 'CloudFront / Cloudflare',
    unlocksInAct: 6,
  },

  elasticsearch: {
    latencyCost: 30,
    memoryCost: 50,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard'],
    sideEffects: ['index', 'search'],
    allowedConnections: ['model', 'service'],
    blockedConnections: [],
    description: 'Elasticsearch for full-text search',
    railsConcept: 'Searchkick / Elasticsearch-rails',
    unlocksInAct: 6,
  },

  logger: {
    latencyCost: 1,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['log_write'],
    allowedConnections: [],
    blockedConnections: [],
    description: 'Structured logging',
    railsConcept: 'Rails.logger / Lograge',
    unlocksInAct: 6,
  },

  metrics_collector: {
    latencyCost: 0,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['metric_write'],
    allowedConnections: [],
    blockedConnections: [],
    description: 'Metrics collection for monitoring',
    railsConcept: 'Prometheus / StatsD',
    unlocksInAct: 6,
  },

  tracer: {
    latencyCost: 1,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: false,
    failureModes: ['silent'],
    sideEffects: ['span_create', 'trace_propagate'],
    allowedConnections: [],
    blockedConnections: [],
    description: 'Distributed tracing',
    railsConcept: 'OpenTelemetry / Datadog APM',
    unlocksInAct: 6,
  },

  // === Final Act - Expert ===

  read_replica: {
    latencyCost: 55,
    memoryCost: 20,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'cascade'],
    sideEffects: ['read_query'],
    allowedConnections: ['model'],
    blockedConnections: [
      { target: 'model', reason: 'Replicas have lag - writes go to primary' },
    ],
    description: 'Read replica for read scaling',
    railsConcept: 'ActiveRecord::Base.connected_to(role: :reading)',
    unlocksInAct: 7,
  },

  shard_router: {
    latencyCost: 5,
    memoryCost: 10,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['route_to_shard'],
    allowedConnections: ['database', 'read_replica'],
    blockedConnections: [],
    description: 'Routes queries to appropriate shard',
    railsConcept: 'ActiveRecord::Base.connected_to(shard: :shard_one)',
    unlocksInAct: 7,
  },

  feature_flag: {
    latencyCost: 1,
    memoryCost: 2,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['silent'],
    sideEffects: ['flag_check'],
    allowedConnections: ['controller', 'model', 'service'],
    blockedConnections: [],
    description: 'Feature flag for gradual rollout',
    railsConcept: 'Flipper / LaunchDarkly',
    unlocksInAct: 7,
  },

  health_check: {
    latencyCost: 5,
    memoryCost: 2,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['hard'],
    sideEffects: ['check_dependency'],
    allowedConnections: ['database', 'redis', 'external_api'],
    blockedConnections: [],
    description: 'Health check endpoint',
    railsConcept: 'OkComputer / health_check gem',
    unlocksInAct: 7,
  },

  external_api: {
    latencyCost: 200,
    memoryCost: 30,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft', 'hard', 'cascade'],
    sideEffects: ['http_request'],
    allowedConnections: ['circuit_breaker', 'cache'],
    blockedConnections: [],
    description: 'External API call',
    railsConcept: 'Faraday / HTTParty',
    unlocksInAct: 4,
  },

  session: {
    latencyCost: 2,
    memoryCost: 5,
    callMultiplier: 1,
    blocking: true,
    failureModes: ['soft'],
    sideEffects: ['session_read', 'session_write'],
    allowedConnections: ['redis', 'controller'],
    blockedConnections: [],
    description: 'Session storage',
    railsConcept: 'ActionDispatch::Session',
    unlocksInAct: 3,
  },
};

// ============================================
// Connection Cost Matrix
// ============================================

export const CONNECTION_COSTS: Record<string, Record<string, ConnectionCost>> = {
  model: {
    database: {
      latency: 50,
      canCauseNPlusOne: true,
      async: false,
    },
  },
  controller: {
    model: {
      latency: 2,
      canCauseNPlusOne: false,
      async: false,
    },
    view: {
      latency: 10,
      canCauseNPlusOne: false,
      async: false,
    },
  },
  view: {
    database: {
      latency: 50,
      canCauseNPlusOne: true,
      async: false,
    },
  },
  eager_load: {
    database: {
      latency: 60,
      canCauseNPlusOne: false,
      async: false,
    },
  },
  cache: {
    database: {
      latency: 50,
      canCauseNPlusOne: false,
      async: false,
    },
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get behavior for a node type
 */
export function getNodeBehavior(nodeType: string): NodeBehavior | null {
  return NODE_BEHAVIORS[nodeType] || null;
}

/**
 * Check if a connection is valid between two node types
 */
export function isConnectionAllowed(sourceType: string, targetType: string): { allowed: boolean; reason?: string } {
  const sourceBehavior = NODE_BEHAVIORS[sourceType];
  if (!sourceBehavior) {
    return { allowed: false, reason: `Unknown node type: ${sourceType}` };
  }

  // Check blocked connections first
  const blocked = sourceBehavior.blockedConnections.find(b => b.target === targetType);
  if (blocked) {
    return { allowed: false, reason: blocked.reason };
  }

  // Check if target is in allowed list
  if (sourceBehavior.allowedConnections.includes(targetType)) {
    return { allowed: true };
  }

  return { allowed: false, reason: `${sourceType} cannot connect to ${targetType}` };
}

/**
 * Calculate total latency for a path through the pipeline
 */
export function calculatePathLatency(path: string[]): number {
  let total = 0;

  for (let i = 0; i < path.length; i++) {
    const nodeType = path[i];
    const behavior = NODE_BEHAVIORS[nodeType];
    if (behavior) {
      total += behavior.latencyCost;
    }

    // Add connection cost if there's a next node
    if (i < path.length - 1) {
      const nextType = path[i + 1];
      const connectionCost = CONNECTION_COSTS[nodeType]?.[nextType];
      if (connectionCost) {
        total += connectionCost.latency;
      }
    }
  }

  return total;
}

/**
 * Detect N+1 query pattern in pipeline
 */
export function detectNPlusOnePattern(
  nodes: Array<{ type: string; id: string }>,
  connections: Array<{ sourceId: string; targetId: string }>
): { hasNPlusOne: boolean; affectedNodes: string[] } {
  const affectedNodes: string[] = [];

  // Find model -> database connections without eager loading
  const modelNodes = nodes.filter(n => n.type === 'model');
  const eagerLoadNodes = nodes.filter(n => n.type === 'eager_load');

  for (const model of modelNodes) {
    // Check if this model connects directly to database
    const dbConnection = connections.find(c =>
      c.sourceId === model.id && nodes.find(n => n.id === c.targetId)?.type === 'database'
    );

    if (dbConnection) {
      // Check if there's an eager load node protecting this model
      const hasEagerLoad = eagerLoadNodes.some(el => {
        // Check if eager load is between model and database
        const elToDb = connections.find(c => c.sourceId === el.id && c.targetId === dbConnection.targetId);
        const modelToEl = connections.find(c => c.sourceId === model.id && c.targetId === el.id);
        return elToDb && modelToEl;
      });

      if (!hasEagerLoad) {
        affectedNodes.push(model.id);
      }
    }
  }

  return {
    hasNPlusOne: affectedNodes.length > 0,
    affectedNodes,
  };
}

/**
 * Calculate memory usage for a pipeline
 */
export function calculateMemoryUsage(nodes: Array<{ type: string }>): number {
  return nodes.reduce((total, node) => {
    const behavior = NODE_BEHAVIORS[node.type];
    return total + (behavior?.memoryCost || 0);
  }, 0);
}

/**
 * Get all nodes available at a given act
 */
export function getNodesForAct(actNumber: number): string[] {
  return Object.entries(NODE_BEHAVIORS)
    .filter(([, behavior]) => behavior.unlocksInAct <= actNumber)
    .map(([type]) => type);
}

/**
 * Get the act in which a node type unlocks
 */
export function getNodeUnlockAct(nodeType: string): number {
  return NODE_BEHAVIORS[nodeType]?.unlocksInAct || 1;
}

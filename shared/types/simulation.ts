// Simulation state types for the pipeline simulation engine

import type { BaseNode, Connection, NodeType } from './pipeline';

// Simulated HTTP request flowing through the pipeline
export interface SimulatedRequest {
  id: string;
  // Current location in pipeline
  currentNodeId: string;
  // Path taken through nodes
  path: NodeType[];
  // Accumulated metrics
  totalLatency: number;
  queries: SimulatedQuery[];
  cacheHits: number;
  cacheMisses: number;
  // Request state
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  // Timing
  startTick: number;
  endTick?: number;
}

// Simulated database query
export interface SimulatedQuery {
  id: string;
  sql: string;
  tableName: string;
  type: 'select' | 'insert' | 'update' | 'delete';
  // Query performance
  latency: number;
  rowsAffected: number;
  // Index usage
  usedIndex: boolean;
  indexName?: string;
  // N+1 detection
  isNPlusOne: boolean;
  parentQueryId?: string;
  loopIteration?: number;
}

// Aggregate metrics for the simulation
export interface SimulationMetrics {
  // Latency percentiles (in ms)
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
  };
  // Throughput
  throughput: {
    requestsPerSecond: number;
    completedRequests: number;
    failedRequests: number;
    pendingRequests: number;
  };
  // Database
  queryCount: number;
  queriesPerRequest: number;
  nPlusOneCount: number;
  indexUsageRate: number;
  // Memory (simulated)
  memoryUsage: number;
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  // Cache
  cacheHitRate: number;
  cacheSize: number;
  // Errors
  errorRate: number;
  errorTypes: Record<string, number>;
}

// Enemy spawned from misconfiguration
export interface SpawnedEnemy {
  id: string;
  type: EnemyType;
  // Position on the dungeon map
  position: { x: number; y: number };
  // HP and damage
  hp: number;
  maxHp: number;
  damage: number;
  // Movement
  speed: number;
  targetNodeId?: string;
  // Source of the problem
  sourceNodeId: string;
  sourceIssue: string;
  // Visual
  isActive: boolean;
}

// Enemy types based on Rails issues
export type EnemyType =
  | 'query_swarm'      // N+1 queries spawn multiple small enemies
  | 'memory_blob'      // Memory leaks create growing blobs
  | 'callback_chain'   // Hidden callbacks spawn linked enemies
  | 'timeout_wraith'   // Slow queries spawn wraithlike enemies
  | 'error_spike'      // Unhandled errors spawn spike enemies
  | 'cache_phantom';   // Cache misses spawn phantom enemies

// Defense types based on Rails optimizations
export type DefenseType =
  | 'index_turret'     // Database indexes
  | 'cache_shield'     // Caching
  | 'eager_loader'     // Eager loading (includes/preload)
  | 'rate_limiter'     // Rate limiting
  | 'worker_drone'     // Background jobs
  | 'validator_wall';  // Input validation

// Active defense
export interface ActiveDefense {
  id: string;
  type: DefenseType;
  position: { x: number; y: number };
  // Effectiveness
  power: number;
  range: number;
  cooldown: number;
  currentCooldown: number;
  // What it's defending
  targetNodeIds: string[];
  // Visual
  isActive: boolean;
}

// Complete simulation state (immutable, replaced each tick)
export interface SimulationState {
  // Current tick (time step)
  tick: number;
  tickRate: number; // ticks per second

  // Pipeline state
  nodes: Map<string, BaseNode>;
  connections: Connection[];

  // Active requests
  activeRequests: SimulatedRequest[];
  completedRequests: SimulatedRequest[];

  // Aggregate metrics
  metrics: SimulationMetrics;

  // Game entities
  enemies: SpawnedEnemy[];
  defenses: ActiveDefense[];

  // Overall health
  stabilityScore: number; // 0-100, 100 = perfectly stable
  stabilityTrend: 'improving' | 'stable' | 'degrading';

  // Room progress
  objectiveProgress: number; // 0-100
  objectiveMet: boolean;
}

// Initial state factory
export function createInitialSimulationState(
  nodes: BaseNode[],
  connections: Connection[]
): SimulationState {
  const nodeMap = new Map<string, BaseNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  return {
    tick: 0,
    tickRate: 60,
    nodes: nodeMap,
    connections,
    activeRequests: [],
    completedRequests: [],
    metrics: {
      latency: { p50: 0, p95: 0, p99: 0, avg: 0, max: 0 },
      throughput: {
        requestsPerSecond: 0,
        completedRequests: 0,
        failedRequests: 0,
        pendingRequests: 0,
      },
      queryCount: 0,
      queriesPerRequest: 0,
      nPlusOneCount: 0,
      indexUsageRate: 1,
      memoryUsage: 0,
      memoryPressure: 'low',
      cacheHitRate: 0,
      cacheSize: 0,
      errorRate: 0,
      errorTypes: {},
    },
    enemies: [],
    defenses: [],
    stabilityScore: 100,
    stabilityTrend: 'stable',
    objectiveProgress: 0,
    objectiveMet: false,
  };
}

// Simulation configuration
export interface SimulationConfig {
  // Request generation
  requestsPerSecond: number;
  requestBurstSize: number;

  // Timing
  baseLatencyMs: number;
  queryLatencyMs: number;
  cacheLatencyMs: number;

  // Enemy spawning
  enemySpawnThresholds: {
    nPlusOneCount: number;      // Spawn query_swarm after this many N+1s
    memoryPressure: number;      // Spawn memory_blob at this memory %
    callbackDepth: number;       // Spawn callback_chain at this depth
    latencyMs: number;           // Spawn timeout_wraith above this latency
    errorRate: number;           // Spawn error_spike above this %
    cacheMissRate: number;       // Spawn cache_phantom above this %
  };

  // Defense effectiveness
  defenseMultipliers: Record<DefenseType, number>;

  // Victory conditions
  stabilityThreshold: number;    // Must maintain this stability to complete
  stabilityDuration: number;     // For this many ticks
}

// Default simulation configuration
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  requestsPerSecond: 10,
  requestBurstSize: 5,
  baseLatencyMs: 10,
  queryLatencyMs: 5,
  cacheLatencyMs: 1,
  enemySpawnThresholds: {
    nPlusOneCount: 3,
    memoryPressure: 70,
    callbackDepth: 3,
    latencyMs: 500,
    errorRate: 5,
    cacheMissRate: 80,
  },
  defenseMultipliers: {
    index_turret: 0.3,      // Reduces query time by 70%
    cache_shield: 0.1,      // Reduces cache miss rate by 90%
    eager_loader: 0,        // Eliminates N+1 entirely
    rate_limiter: 0.5,      // Halves incoming request rate
    worker_drone: 0.2,      // Offloads 80% of heavy work
    validator_wall: 0.1,    // Reduces errors by 90%
  },
  stabilityThreshold: 80,
  stabilityDuration: 300, // 5 seconds at 60 ticks/sec
};

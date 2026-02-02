// Enemy and defense type definitions for the game mechanics

import type { EnemyType, DefenseType } from './simulation';

// Enemy definition (static data)
export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  description: string;
  // Visual
  sprite: string;
  color: string;
  size: 'small' | 'medium' | 'large' | 'boss';
  // Stats
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
  // Behavior
  behavior: EnemyBehavior;
  // What Rails issue causes this enemy
  railsCause: string;
  // What Rails solution defeats this enemy
  railsSolution: string;
  // Weaknesses (defenses that are extra effective)
  weaknesses: DefenseType[];
}

export type EnemyBehavior =
  | 'swarm'      // Multiple small enemies, attack in groups
  | 'grow'       // Single enemy that grows over time
  | 'chain'      // Spawns more enemies when damaged
  | 'phase'      // Becomes invulnerable periodically
  | 'spike'      // High burst damage, then retreats
  | 'phantom';   // Invisible until attacking

// Enemy definitions
export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  query_swarm: {
    type: 'query_swarm',
    name: 'Query Swarm',
    description: 'A swarm of redundant database queries that multiply rapidly',
    sprite: 'query-swarm',
    color: '#ef4444', // red
    size: 'small',
    baseHp: 20,
    baseDamage: 5,
    baseSpeed: 2,
    behavior: 'swarm',
    railsCause: 'N+1 query pattern: loading associations in a loop',
    railsSolution: 'Use includes() or preload() to eager load associations',
    weaknesses: ['eager_loader', 'cache_shield'],
  },
  memory_blob: {
    type: 'memory_blob',
    name: 'Memory Blob',
    description: 'A growing mass of unreleased memory that slows everything down',
    sprite: 'memory-blob',
    color: '#8b5cf6', // purple
    size: 'large',
    baseHp: 100,
    baseDamage: 2,
    baseSpeed: 0.5,
    behavior: 'grow',
    railsCause: 'Memory leak: objects retained in memory indefinitely',
    railsSolution: 'Use find_each for batching, avoid storing large datasets in memory',
    weaknesses: ['worker_drone'],
  },
  callback_chain: {
    type: 'callback_chain',
    name: 'Callback Chain',
    description: 'A chain of hidden callbacks that trigger unexpectedly',
    sprite: 'callback-chain',
    color: '#f59e0b', // amber
    size: 'medium',
    baseHp: 40,
    baseDamage: 10,
    baseSpeed: 1.5,
    behavior: 'chain',
    railsCause: 'Deeply nested callbacks that trigger cascading side effects',
    railsSolution: 'Simplify callbacks, use explicit service objects instead',
    weaknesses: ['validator_wall'],
  },
  timeout_wraith: {
    type: 'timeout_wraith',
    name: 'Timeout Wraith',
    description: 'A spectral entity born from slow, blocking operations',
    sprite: 'timeout-wraith',
    color: '#6366f1', // indigo
    size: 'medium',
    baseHp: 60,
    baseDamage: 15,
    baseSpeed: 0.3,
    behavior: 'phase',
    railsCause: 'Slow database queries without proper indexing',
    railsSolution: 'Add database indexes, optimize query patterns',
    weaknesses: ['index_turret', 'cache_shield'],
  },
  error_spike: {
    type: 'error_spike',
    name: 'Error Spike',
    description: 'A volatile spike of unhandled errors that deals burst damage',
    sprite: 'error-spike',
    color: '#dc2626', // red-600
    size: 'small',
    baseHp: 30,
    baseDamage: 25,
    baseSpeed: 3,
    behavior: 'spike',
    railsCause: 'Unhandled exceptions and missing error recovery',
    railsSolution: 'Add proper error handling and rescue blocks',
    weaknesses: ['validator_wall'],
  },
  cache_phantom: {
    type: 'cache_phantom',
    name: 'Cache Phantom',
    description: 'An invisible entity that appears when cache fails',
    sprite: 'cache-phantom',
    color: '#0ea5e9', // sky-500
    size: 'medium',
    baseHp: 50,
    baseDamage: 8,
    baseSpeed: 2,
    behavior: 'phantom',
    railsCause: 'Missing or ineffective caching strategy',
    railsSolution: 'Implement fragment caching, use cache keys properly',
    weaknesses: ['cache_shield'],
  },
};

// Defense definition (static data)
export interface DefenseDefinition {
  type: DefenseType;
  name: string;
  description: string;
  // Visual
  sprite: string;
  color: string;
  // Stats
  basePower: number;
  baseRange: number;
  baseCooldown: number; // ticks
  // What Rails concept this represents
  railsConcept: string;
  // What it's effective against
  strongAgainst: EnemyType[];
  // Unlock level requirement
  unlockLevel: number;
}

// Defense definitions
export const DEFENSE_DEFINITIONS: Record<DefenseType, DefenseDefinition> = {
  index_turret: {
    type: 'index_turret',
    name: 'Index Turret',
    description: 'Database indexes that speed up query execution',
    sprite: 'index-turret',
    color: '#22c55e', // green-500
    basePower: 30,
    baseRange: 150,
    baseCooldown: 30,
    railsConcept: 'add_index :table, :column',
    strongAgainst: ['timeout_wraith', 'query_swarm'],
    unlockLevel: 1,
  },
  cache_shield: {
    type: 'cache_shield',
    name: 'Cache Shield',
    description: 'A protective barrier that stores frequently accessed data',
    sprite: 'cache-shield',
    color: '#3b82f6', // blue-500
    basePower: 20,
    baseRange: 200,
    baseCooldown: 60,
    railsConcept: 'Rails.cache.fetch(key) { expensive_operation }',
    strongAgainst: ['cache_phantom', 'timeout_wraith'],
    unlockLevel: 5,
  },
  eager_loader: {
    type: 'eager_loader',
    name: 'Eager Loader',
    description: 'Pre-loads associated data to prevent N+1 queries',
    sprite: 'eager-loader',
    color: '#f97316', // orange-500
    basePower: 50,
    baseRange: 100,
    baseCooldown: 45,
    railsConcept: 'Model.includes(:association).all',
    strongAgainst: ['query_swarm'],
    unlockLevel: 3,
  },
  rate_limiter: {
    type: 'rate_limiter',
    name: 'Rate Limiter',
    description: 'Controls incoming request flow to prevent overload',
    sprite: 'rate-limiter',
    color: '#eab308', // yellow-500
    basePower: 15,
    baseRange: 300,
    baseCooldown: 120,
    railsConcept: 'Rack::Attack throttle rules',
    strongAgainst: ['error_spike'],
    unlockLevel: 10,
  },
  worker_drone: {
    type: 'worker_drone',
    name: 'Worker Drone',
    description: 'Background job that handles heavy processing asynchronously',
    sprite: 'worker-drone',
    color: '#a855f7', // purple-500
    basePower: 25,
    baseRange: 250,
    baseCooldown: 90,
    railsConcept: 'ActiveJob perform_later',
    strongAgainst: ['memory_blob', 'timeout_wraith'],
    unlockLevel: 8,
  },
  validator_wall: {
    type: 'validator_wall',
    name: 'Validator Wall',
    description: 'Input validation that prevents bad data from entering',
    sprite: 'validator-wall',
    color: '#14b8a6', // teal-500
    basePower: 35,
    baseRange: 100,
    baseCooldown: 20,
    railsConcept: 'validates :field, presence: true',
    strongAgainst: ['error_spike', 'callback_chain'],
    unlockLevel: 2,
  },
};

// Calculate damage multiplier based on defense vs enemy matchup
export function calculateDamageMultiplier(
  defense: DefenseType,
  enemy: EnemyType
): number {
  const defenseDef = DEFENSE_DEFINITIONS[defense];
  const enemyDef = ENEMY_DEFINITIONS[enemy];

  // Strong against: 2x damage
  if (defenseDef.strongAgainst.includes(enemy)) {
    return 2.0;
  }

  // Weak against (enemy resists): 0.5x damage
  if (!enemyDef.weaknesses.includes(defense)) {
    return 0.5;
  }

  // Neutral: 1x damage
  return 1.0;
}

// Get enemies that can be spawned at a given level
export function getAvailableEnemies(level: number): EnemyType[] {
  // All enemies available from start - difficulty comes from quantity and stats
  return Object.keys(ENEMY_DEFINITIONS) as EnemyType[];
}

// Get defenses that are unlocked at a given level
export function getUnlockedDefenses(level: number): DefenseType[] {
  return (Object.entries(DEFENSE_DEFINITIONS) as [DefenseType, DefenseDefinition][])
    .filter(([, def]) => def.unlockLevel <= level)
    .map(([type]) => type);
}

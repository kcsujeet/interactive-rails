/**
 * Level Types
 *
 * Type definitions for the level system including rooms, objectives, and bosses.
 */

import type { NodeType } from '../stores/pipeline';
import type { DefenseType, EnemyType } from '../stores/simulation';

// ============================================
// Room Objectives
// ============================================

export interface TargetMetrics {
  maxLatencyP95?: number;
  maxQueriesPerRequest?: number;
  minCacheHitRate?: number;
  minStability?: number;
  maxErrorRate?: number;
  maxMemoryUsage?: number;
}

export interface RoomObjective {
  type: 'stabilize' | 'optimize' | 'fix' | 'build' | 'survive';
  description: string;
  targetMetrics?: TargetMetrics;
  hints?: string[];
}

// ============================================
// Rooms
// ============================================

export interface Room {
  id: string;
  name: string;
  description: string;
  briefing?: string;
  objective: RoomObjective;
  initialNodes: InitialNode[];
  availableNodeTypes: NodeType[];
  availableDefenses: DefenseType[];
  enemySpawnRate: number;
  stabilityThreshold: number;
  timeLimit?: number; // seconds
  successMessage?: string;
  failureMessage?: string;
}

export interface InitialNode {
  type: NodeType;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  locked?: boolean; // Cannot be modified by player
}

// ============================================
// Boss Rooms
// ============================================

export interface BossPhase {
  hpThreshold: number; // Percentage of HP when phase activates
  enemySpawnMultiplier: number;
  newMechanics?: string[];
}

export interface BossRoom extends Omit<Room, 'enemySpawnRate'> {
  bossType: EnemyType;
  bossName: string;
  bossDescription: string;
  bossHp: number;
  phases: BossPhase[];
}

// ============================================
// Levels
// ============================================

export interface StarThresholds {
  one: number; // Stability score threshold for 1 star
  two: number; // Stability score threshold for 2 stars
  three: number; // Stability score threshold for 3 stars
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  requiredLevel: number;
  concepts: string[];
  rooms: Room[];
  bossRoom?: BossRoom;
  starThresholds: StarThresholds;
  rewards: LevelRewards;
  prerequisites?: string[]; // Level IDs that must be completed first
}

export interface LevelRewards {
  xp: number;
  unlockNodes?: NodeType[];
  unlockDefenses?: DefenseType[];
  achievement?: string;
}

// ============================================
// Level Progress
// ============================================

export interface LevelProgress {
  levelId: string;
  completedRooms: number[];
  currentRoomIndex: number;
  stars: number;
  bestStabilityScore: number;
  timeElapsed: number;
  isCompleted: boolean;
}

// ============================================
// Enemy Definitions (for sprites)
// ============================================

export type EnemySize = 'small' | 'medium' | 'large' | 'boss';
export type EnemyBehavior = 'swarm' | 'tank' | 'grow' | 'phase' | 'spike' | 'stealth';

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  description: string;
  color: string;
  size: EnemySize;
  behavior: EnemyBehavior;
  spawnCondition: string;
}

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  query_swarm: {
    type: 'query_swarm',
    name: 'Query Swarm',
    description: 'Spawns from N+1 query patterns',
    color: '#ef4444',
    size: 'small',
    behavior: 'swarm',
    spawnCondition: 'N+1 queries detected',
  },
  memory_blob: {
    type: 'memory_blob',
    name: 'Memory Blob',
    description: 'Grows when memory pressure increases',
    color: '#8b5cf6',
    size: 'large',
    behavior: 'grow',
    spawnCondition: 'High memory pressure',
  },
  callback_chain: {
    type: 'callback_chain',
    name: 'Callback Chain',
    description: 'Linked enemies that heal each other',
    color: '#f59e0b',
    size: 'medium',
    behavior: 'tank',
    spawnCondition: 'Too many callbacks',
  },
  timeout_wraith: {
    type: 'timeout_wraith',
    name: 'Timeout Wraith',
    description: 'Phases in and out based on latency',
    color: '#6b7280',
    size: 'medium',
    behavior: 'phase',
    spawnCondition: 'p95 latency > 500ms',
  },
  error_spike: {
    type: 'error_spike',
    name: 'Error Spike',
    description: 'Fast-moving error projectiles',
    color: '#dc2626',
    size: 'small',
    behavior: 'spike',
    spawnCondition: 'Error rate > 5%',
  },
  cache_phantom: {
    type: 'cache_phantom',
    name: 'Cache Phantom',
    description: 'Appears when cache misses occur',
    color: '#06b6d4',
    size: 'medium',
    behavior: 'stealth',
    spawnCondition: 'Cache hit rate < 50%',
  },
};

// ============================================
// Backwards Compatibility Aliases
// ============================================

/** @deprecated Use Level instead */
export type Dungeon = Level;
/** @deprecated Use LevelRewards instead */
export type DungeonRewards = LevelRewards;
/** @deprecated Use LevelProgress instead */
export type DungeonProgress = LevelProgress;

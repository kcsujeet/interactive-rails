// Dungeon structure types for the game progression system

import type { BaseNode, Connection, NodeType } from './pipeline';
import type { EnemyType, DefenseType } from './simulation';

// Room objective types
export type ObjectiveType =
  | 'stabilize'   // Reach and maintain stability threshold
  | 'optimize'    // Reduce latency/query count below threshold
  | 'fix'         // Fix specific misconfiguration
  | 'build'       // Build pipeline from scratch
  | 'survive';    // Survive waves of enemies

// Target metrics for objectives
export interface TargetMetrics {
  maxLatencyP95?: number;        // Max p95 latency in ms
  maxQueriesPerRequest?: number; // Max queries per request
  minCacheHitRate?: number;      // Min cache hit rate %
  maxErrorRate?: number;         // Max error rate %
  minStability?: number;         // Min stability score
  maxMemoryUsage?: number;       // Max memory usage %
}

// Room objective definition
export interface RoomObjective {
  type: ObjectiveType;
  description: string;
  targetMetrics: TargetMetrics;
  // How long the metrics must be maintained (ticks)
  holdDuration?: number;
  // Hints shown to player
  hints?: string[];
}

// Dungeon room definition
export interface Room {
  id: string;
  name: string;
  description: string;
  // Initial pipeline state
  initialNodes: BaseNode[];
  initialConnections: Connection[];
  // What the player needs to achieve
  objective: RoomObjective;
  // Difficulty scaling
  stabilityThreshold: number;  // 0-100, required to pass
  enemySpawnRate: number;      // enemies per second
  enemyScaling: number;        // HP/damage multiplier
  // Available tools
  availableNodeTypes: NodeType[];
  availableDefenses: DefenseType[];
  // Locked until these are available (player actions/unlocks)
  requiredUnlocks?: string[];
  // Tutorial/story content
  briefing?: string;
  successMessage?: string;
  failureMessage?: string;
}

// Boss room (special room at end of dungeon)
export interface BossRoom extends Room {
  bossType: EnemyType;
  bossName: string;
  bossDescription: string;
  // Boss-specific mechanics
  phases: BossPhase[];
}

// Boss phase (bosses have multiple phases)
export interface BossPhase {
  hpThreshold: number;  // Transition when boss HP drops below this %
  description: string;
  // Phase-specific modifiers
  speedMultiplier: number;
  damageMultiplier: number;
  spawnRate: number;
  specialAbility?: string;
}

// Complete dungeon definition
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  // Dungeon metadata
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedTime: number;  // minutes
  // Prerequisites
  requiredLevel: number;
  requiredDungeons?: string[];  // Must complete these first
  // Content
  rooms: Room[];
  bossRoom?: BossRoom;
  // Rewards
  xpReward: number;
  unlocks?: string[];  // Actions/nodes unlocked on completion
  // Star ratings (1-3 stars based on performance)
  starThresholds: {
    one: number;    // Min stability for 1 star
    two: number;    // Min stability for 2 stars
    three: number;  // Min stability for 3 stars
  };
  // Educational content
  concepts: string[];     // Rails concepts taught
  learningGoals: string[];
}

// Dungeon completion record
export interface DungeonCompletion {
  odungeonId: string;
  odungeonName: string;
  completedAt: string;
  starsEarned: 1 | 2 | 3;
  finalStability: number;
  timeToComplete: number;  // seconds
  // Metrics at completion
  finalMetrics: {
    avgLatency: number;
    queriesPerRequest: number;
    cacheHitRate: number;
    errorRate: number;
  };
}

// Player's dungeon progress (what's unlocked, completed)
export interface DungeonProgress {
  odungeonId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  bestStars?: 1 | 2 | 3;
  bestStability?: number;
  bestTime?: number;
  attempts: number;
  lastAttemptAt?: string;
}

// World map (collection of dungeons)
export interface DungeonWorld {
  id: string;
  name: string;
  description: string;
  theme: string;  // Visual theme
  dungeons: Dungeon[];
  // World completion rewards
  completionReward?: {
    xp: number;
    unlocks: string[];
    achievement?: string;
  };
}

// Helper to check if a dungeon is available
export function isDungeonAvailable(
  dungeon: Dungeon,
  playerLevel: number,
  completedDungeons: string[]
): boolean {
  // Check level requirement
  if (playerLevel < dungeon.requiredLevel) {
    return false;
  }

  // Check prerequisite dungeons
  if (dungeon.requiredDungeons) {
    for (const required of dungeon.requiredDungeons) {
      if (!completedDungeons.includes(required)) {
        return false;
      }
    }
  }

  return true;
}

// Helper to calculate stars from stability
export function calculateStars(
  stability: number,
  thresholds: Dungeon['starThresholds']
): 0 | 1 | 2 | 3 {
  if (stability >= thresholds.three) return 3;
  if (stability >= thresholds.two) return 2;
  if (stability >= thresholds.one) return 1;
  return 0;
}

// Helper to get room by index
export function getRoom(dungeon: Dungeon, index: number): Room | BossRoom | undefined {
  if (index < dungeon.rooms.length) {
    return dungeon.rooms[index];
  }
  if (index === dungeon.rooms.length && dungeon.bossRoom) {
    return dungeon.bossRoom;
  }
  return undefined;
}

// Helper to get total room count
export function getTotalRooms(dungeon: Dungeon): number {
  return dungeon.rooms.length + (dungeon.bossRoom ? 1 : 0);
}

/**
 * Type exports for @/types imports
 */

// Re-export all game types
export * from '@/components/game/types';

// Re-export level types (with alias for conflicting names)
export {
	type TargetMetrics,
	type RoomObjective,
	type Room,
	type InitialNode,
	type BossPhase,
	type BossRoom,
	type StarThresholds,
	type Level as DungeonLevel,
	type LevelRewards,
	type LevelProgress,
	type EnemySize,
	type EnemyBehavior,
	type EnemyDefinition,
	ENEMY_DEFINITIONS,
	type Dungeon,
	type DungeonRewards,
	type DungeonProgress,
} from './level';

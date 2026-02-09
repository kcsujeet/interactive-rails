/**
 * Type exports for @/types imports
 */

// Re-export all game types
export * from './game';

// Re-export level types (with alias for conflicting names)
export {
	type BossPhase,
	type BossRoom,
	type Dungeon,
	type DungeonProgress,
	type DungeonRewards,
	ENEMY_DEFINITIONS,
	type EnemyBehavior,
	type EnemyDefinition,
	type EnemySize,
	type InitialNode,
	type Level as DungeonLevel,
	type LevelProgress,
	type LevelRewards,
	type Room,
	type RoomObjective,
	type StarThresholds,
	type TargetMetrics,
} from './level';

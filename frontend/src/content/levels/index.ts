/**
 * Level Content Index
 *
 * Exports all level definitions for the game.
 */

import type { Level } from '@/types/level';
import { tutorialCaching } from './tutorial-caching';
import { tutorialIndexing } from './tutorial-indexing';
import { tutorialNPlusOne } from './tutorial-n-plus-one';

// All levels in order
export const LEVELS: Level[] = [
	tutorialNPlusOne,
	tutorialIndexing,
	tutorialCaching,
];

// Level lookup by ID
export const LEVEL_MAP: Record<string, Level> = LEVELS.reduce(
	(acc, level) => {
		acc[level.id] = level;
		return acc;
	},
	{} as Record<string, Level>,
);

// Get level by ID
export function getLevelById(id: string): Level | undefined {
	return LEVEL_MAP[id];
}

// Get available levels for a player level
export function getAvailableLevels(
	playerLevel: number,
	completedLevelIds: string[],
): Level[] {
	return LEVELS.filter((level) => {
		// Check level requirement
		if (playerLevel < level.requiredLevel) return false;

		// Check prerequisites
		if (level.prerequisites) {
			const hasAllPrereqs = level.prerequisites.every((prereq) =>
				completedLevelIds.includes(prereq),
			);
			if (!hasAllPrereqs) return false;
		}

		return true;
	});
}

// Get all levels with availability status
export function getLevelsWithStatus(
	playerLevel: number,
	completedLevelIds: string[],
	levelProgress: Record<string, { stars: number; completedRooms: number }>,
): Array<
	Level & {
		isAvailable: boolean;
		isCompleted: boolean;
		progress?: { stars: number; completedRooms: number };
	}
> {
	return LEVELS.map((level) => {
		const isAvailable =
			playerLevel >= level.requiredLevel &&
			(!level.prerequisites ||
				level.prerequisites.every((prereq) =>
					completedLevelIds.includes(prereq),
				));

		const isCompleted = completedLevelIds.includes(level.id);
		const progress = levelProgress[level.id];

		return {
			...level,
			isAvailable,
			isCompleted,
			progress,
		};
	});
}

// Re-export individual levels
export { tutorialNPlusOne, tutorialIndexing, tutorialCaching };

// ============================================
// Backwards Compatibility Aliases
// ============================================

/** @deprecated Use LEVELS instead */
export const DUNGEONS = LEVELS;
/** @deprecated Use LEVEL_MAP instead */
export const DUNGEON_MAP = LEVEL_MAP;
/** @deprecated Use getLevelById instead */
export const getDungeonById = getLevelById;
/** @deprecated Use getAvailableLevels instead */
export const getAvailableDungeons = getAvailableLevels;
/** @deprecated Use getLevelsWithStatus instead */
export const getDungeonsWithStatus = getLevelsWithStatus;

/**
 * Acts & Levels Content Index
 *
 * Rails Expert: 50 levels across 8 acts
 * Build a production-grade SaaS while mastering Rails 8
 */

import type { Act, Level } from '@/types';

// Import individual act definitions
import { actOne } from './act1-foundation/content';
import { actTwo } from './act2-users-security/content';
import { actThree } from './act3-clean-architecture/content';
import { actFour } from './act4-performance/content';
import { actFive } from './act5-production/content';
import { actSix } from './act6-reliability/content';
import { actSeven } from './act7-scale/content';
import { actEight } from './act8-mastery/content';

// ============================================
// All Acts
// ============================================

export const ACTS: Act[] = [
	actOne,
	actTwo,
	actThree,
	actFour,
	actFive,
	actSix,
	actSeven,
	actEight,
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get an act by its ID
 */
export function getAct(actId: number): Act | undefined {
	return ACTS.find((act) => act.id === actId);
}

/**
 * Get a level by its ID
 */
export function getLevel(levelId: string): Level | undefined {
	for (const act of ACTS) {
		const level = act.levels.find((l) => l.id === levelId);
		if (level) return level;
	}
	return undefined;
}

/**
 * Get a level by act ID and level number
 */
export function getLevelByNumber(
	actId: number,
	levelNum: number,
): Level | undefined {
	const act = getAct(actId);
	if (!act) return undefined;
	return act.levels.find((l) => l.levelNumber === levelNum);
}

/**
 * Get all levels across all acts
 */
export function getAllLevels(): Level[] {
	return ACTS.flatMap((act) => act.levels);
}

/**
 * Get the next level after a given level ID
 */
export function getNextLevel(currentLevelId: string): Level | undefined {
	const allLevels = getAllLevels();
	const currentIndex = allLevels.findIndex((l) => l.id === currentLevelId);
	if (currentIndex === -1 || currentIndex === allLevels.length - 1) {
		return undefined;
	}
	return allLevels[currentIndex + 1];
}

/**
 * Get the act that contains a given level
 */
export function getActForLevel(levelId: string): Act | undefined {
	return ACTS.find((act) => act.levels.some((l) => l.id === levelId));
}

/**
 * Get level count for display
 */
export function getTotalLevelCount(): number {
	return ACTS.reduce((sum, act) => sum + act.levels.length, 0);
}

/**
 * Check if a level is unlocked based on player progress
 */
export function isLevelUnlocked(
	levelId: string,
	completedLevels: string[],
): boolean {
	// Dev mode: unlock all levels
	if (
		typeof window !== 'undefined' &&
		localStorage.getItem('railsexpert_unlock_all') === 'true'
	) {
		return true;
	}

	const allLevels = getAllLevels();
	const levelIndex = allLevels.findIndex((l) => l.id === levelId);

	// First level is always unlocked
	if (levelIndex === 0) return true;

	// Level is unlocked if the previous level is completed
	const prevLevel = allLevels[levelIndex - 1];
	return completedLevels.includes(prevLevel.id);
}

/**
 * Get level number within the game (1-50)
 */
export function getGlobalLevelNumber(levelId: string): number {
	const allLevels = getAllLevels();
	const index = allLevels.findIndex((l) => l.id === levelId);
	return index + 1;
}

/**
 * Check if an act is unlocked based on player progress
 */
export function isActUnlocked(
	actId: number,
	completedLevels: string[],
): boolean {
	if (actId === 1) return true;

	const prevAct = ACTS.find((a) => a.id === actId - 1);
	if (!prevAct) return false;

	// Act is unlocked if all levels in previous act are completed
	return prevAct.levels.every((level) => completedLevels.includes(level.id));
}

// Re-export individual acts for direct access
export {
	actOne,
	actTwo,
	actThree,
	actFour,
	actFive,
	actSix,
	actSeven,
	actEight,
};

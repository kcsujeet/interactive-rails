/**
 * Dungeon Content Index
 *
 * Exports all dungeon definitions for the game.
 */

import { tutorialNPlusOne } from './tutorial-n-plus-one';
import { tutorialIndexing } from './tutorial-indexing';
import { tutorialCaching } from './tutorial-caching';
import type { Dungeon } from '../../types/dungeon';

// All dungeons in order
export const DUNGEONS: Dungeon[] = [
  tutorialNPlusOne,
  tutorialIndexing,
  tutorialCaching,
];

// Dungeon lookup by ID
export const DUNGEON_MAP: Record<string, Dungeon> = DUNGEONS.reduce(
  (acc, dungeon) => {
    acc[dungeon.id] = dungeon;
    return acc;
  },
  {} as Record<string, Dungeon>
);

// Get dungeon by ID
export function getDungeonById(id: string): Dungeon | undefined {
  return DUNGEON_MAP[id];
}

// Get available dungeons for a player level
export function getAvailableDungeons(
  playerLevel: number,
  completedDungeonIds: string[]
): Dungeon[] {
  return DUNGEONS.filter((dungeon) => {
    // Check level requirement
    if (playerLevel < dungeon.requiredLevel) return false;

    // Check prerequisites
    if (dungeon.prerequisites) {
      const hasAllPrereqs = dungeon.prerequisites.every((prereq) =>
        completedDungeonIds.includes(prereq)
      );
      if (!hasAllPrereqs) return false;
    }

    return true;
  });
}

// Get all dungeons with availability status
export function getDungeonsWithStatus(
  playerLevel: number,
  completedDungeonIds: string[],
  dungeonProgress: Record<string, { stars: number; completedRooms: number }>
): Array<Dungeon & { isAvailable: boolean; isCompleted: boolean; progress?: { stars: number; completedRooms: number } }> {
  return DUNGEONS.map((dungeon) => {
    const isAvailable =
      playerLevel >= dungeon.requiredLevel &&
      (!dungeon.prerequisites ||
        dungeon.prerequisites.every((prereq) =>
          completedDungeonIds.includes(prereq)
        ));

    const isCompleted = completedDungeonIds.includes(dungeon.id);
    const progress = dungeonProgress[dungeon.id];

    return {
      ...dungeon,
      isAvailable,
      isCompleted,
      progress,
    };
  });
}

// Re-export individual dungeons
export { tutorialNPlusOne, tutorialIndexing, tutorialCaching };

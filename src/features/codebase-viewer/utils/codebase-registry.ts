/**
 * Codebase Registry
 *
 * Aggregates code files from all completed levels into a unified project view.
 * Each level registers a lazy getter that calls its existing getCodeFiles()
 * function with the final parameters, avoiding any code string duplication.
 * The registry merges them in level order using last-writer-wins for duplicate filenames.
 */

import { getAllLevels } from '@/features/acts-registry';
import type { CodeFile } from '@/utils/codeGeneration';

/** Lazy getter: returns the final code files for a level */
type CodeFilesGetter = () => CodeFile[];

// Populated by registerLevelCode calls from each level module
const levelCodeGetters: Record<string, CodeFilesGetter> = {};

/**
 * Register a level's code. Accepts a lazy getter to avoid duplicating
 * code strings that already exist in getCodeFiles().
 *
 * Usage in a level component (after getCodeFiles is defined):
 *   registerLevelCode('act1-level5-routes', () => getCodeFiles('reward', STEPS.length - 1));
 */
export function registerLevelCode(
	levelId: string,
	getFiles: CodeFilesGetter,
): void {
	levelCodeGetters[levelId] = getFiles;
}

/**
 * Build unified project from all completed levels.
 * Used on the acts page and dashboard.
 */
export function buildUnifiedProject(completedLevels: string[]): CodeFile[] {
	const allLevels = getAllLevels();
	const completedSet = new Set(completedLevels);
	const fileMap = new Map<string, CodeFile>();

	for (const level of allLevels) {
		if (!completedSet.has(level.id)) continue;
		const getter = levelCodeGetters[level.id];
		if (!getter) continue;

		for (const file of getter()) {
			fileMap.set(file.filename, file);
		}
	}

	return [...fileMap.values()];
}

/**
 * Build unified project up to a specific step in the current level.
 * Used on the level play page for real-time codebase growth.
 */
export function buildUnifiedProjectAtStep(
	completedLevels: string[],
	currentLevelId: string,
	currentLevelFiles: CodeFile[],
): CodeFile[] {
	const allLevels = getAllLevels();
	const completedSet = new Set(completedLevels);
	const fileMap = new Map<string, CodeFile>();

	// Merge all completed levels before the current one
	for (const level of allLevels) {
		if (level.id === currentLevelId) break;
		if (!completedSet.has(level.id)) continue;
		const getter = levelCodeGetters[level.id];
		if (!getter) continue;

		for (const file of getter()) {
			fileMap.set(file.filename, file);
		}
	}

	// Merge current level's in-progress files (passed directly by the component)
	for (const file of currentLevelFiles) {
		fileMap.set(file.filename, file);
	}

	return [...fileMap.values()];
}

/**
 * Get stats about the unified project.
 */
export function getProjectStats(completedLevels: string[]): {
	fileCount: number;
	levelCount: number;
} {
	const files = buildUnifiedProject(completedLevels);
	const levelsWithCode = completedLevels.filter((id) => {
		const getter = levelCodeGetters[id];
		return getter && getter().length > 0;
	});
	return {
		fileCount: files.length,
		levelCount: levelsWithCode.length,
	};
}

/**
 * Local-first progress storage.
 *
 * All progress lives in the browser's localStorage; there is no server
 * and no account. The storage key is unchanged from the earlier guest
 * mode, so progress recorded before the open-source pivot survives.
 *
 * The core is pure (mergeCompletion) over an injectable storage so it
 * is testable without a DOM. getProgress/completeLevel keep their old
 * async signatures so call sites did not have to change.
 */

export type StackChoices = {
	database: 'postgres' | 'sqlite';
};

export type LevelProgressEntry = {
	stars: number;
	bestScore: number;
};

export type ProgressData = {
	completedLevels: string[];
	levelProgress: Record<string, LevelProgressEntry>;
	stackChoices: StackChoices | null;
};

export type CompletionOptions = {
	levelId: string;
	stars: number;
	finalStability: number;
	stackChoices?: StackChoices;
};

export interface ProgressStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export const PROGRESS_KEY = 'interactive_rails_progress_v1';

const EMPTY_PROGRESS: ProgressData = {
	completedLevels: [],
	levelProgress: {},
	stackChoices: null,
};

function defaultStorage(): ProgressStorage | null {
	if (typeof window === 'undefined') return null;
	return window.localStorage;
}

export function loadProgress(
	storage: ProgressStorage | null = defaultStorage(),
): ProgressData {
	if (!storage) return structuredClone(EMPTY_PROGRESS);
	const raw = storage.getItem(PROGRESS_KEY);
	if (!raw) return structuredClone(EMPTY_PROGRESS);
	try {
		const parsed = JSON.parse(raw) as Partial<ProgressData>;
		return {
			completedLevels: parsed.completedLevels ?? [],
			levelProgress: parsed.levelProgress ?? {},
			stackChoices: parsed.stackChoices ?? null,
		};
	} catch {
		return structuredClone(EMPTY_PROGRESS);
	}
}

function saveProgress(data: ProgressData, storage: ProgressStorage | null) {
	storage?.setItem(PROGRESS_KEY, JSON.stringify(data));
}

/** Pure merge: replays keep the best stars and best score per level. */
export function mergeCompletion(
	current: ProgressData,
	options: CompletionOptions,
): ProgressData {
	const existing = current.levelProgress[options.levelId];
	const next: ProgressData = {
		completedLevels: current.completedLevels.includes(options.levelId)
			? [...current.completedLevels]
			: [...current.completedLevels, options.levelId],
		levelProgress: {
			...current.levelProgress,
			[options.levelId]: {
				stars: Math.max(existing?.stars ?? 0, options.stars),
				bestScore: Math.max(existing?.bestScore ?? 0, options.finalStability),
			},
		},
		stackChoices: options.stackChoices ?? current.stackChoices,
	};
	return next;
}

export function clearProgress(
	storage: ProgressStorage | null = defaultStorage(),
) {
	storage?.removeItem(PROGRESS_KEY);
}

export function hasProgress(
	storage: ProgressStorage | null = defaultStorage(),
): boolean {
	return loadProgress(storage).completedLevels.length > 0;
}

/** Async for call-site compatibility; resolves the locally stored data. */
export async function getProgress(
	storage: ProgressStorage | null = defaultStorage(),
): Promise<ProgressData> {
	return loadProgress(storage);
}

/** Record a completion locally. Async for call-site compatibility. */
export async function completeLevel(
	options: CompletionOptions,
	storage: ProgressStorage | null = defaultStorage(),
): Promise<{ success: boolean }> {
	const merged = mergeCompletion(loadProgress(storage), options);
	saveProgress(merged, storage);
	return { success: true };
}

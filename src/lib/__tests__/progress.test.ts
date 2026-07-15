/**
 * Local-first progress storage (open-source pivot, 2026-07-12).
 *
 * All progress lives in localStorage; there is no server. These tests
 * drive the new API: an injectable ProgressStorage (so tests run
 * without a DOM), keep-max merge semantics for stars and score, and
 * graceful recovery from corrupted storage. The storage key is kept
 * from the old guest path so existing players keep their progress.
 */

import { describe, expect, test } from 'bun:test';
import {
	completeLevel,
	getProgress,
	hasProgress,
	loadProgress,
	mergeCompletion,
	PROGRESS_KEY,
	type ProgressData,
	type ProgressStorage,
} from '../progress';

function fakeStorage(initial: Record<string, string> = {}): ProgressStorage & {
	dump(): Record<string, string>;
} {
	const map = new Map(Object.entries(initial));
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
		dump: () => Object.fromEntries(map),
	};
}

const EMPTY: ProgressData = {
	completedLevels: [],
	levelProgress: {},
	stackChoices: null,
};

describe('loadProgress', () => {
	test('empty storage yields empty progress', () => {
		expect(loadProgress(fakeStorage())).toEqual(EMPTY);
	});

	test('round-trips what completeLevel persisted', async () => {
		const storage = fakeStorage();
		await completeLevel(
			{ levelId: 'act1-level1-environment', stars: 3, finalStability: 88 },
			storage,
		);
		const loaded = loadProgress(storage);
		expect(loaded.completedLevels).toEqual(['act1-level1-environment']);
		expect(loaded.levelProgress['act1-level1-environment']).toEqual({
			stars: 3,
			bestScore: 88,
		});
	});

	test('keeps the legacy storage key so existing players keep progress', () => {
		expect(PROGRESS_KEY).toBe('interactive_rails_progress_v1');
		const storage = fakeStorage({
			[PROGRESS_KEY]: JSON.stringify({
				completedLevels: ['act1-level2-first-boot'],
				levelProgress: {
					'act1-level2-first-boot': { stars: 2, bestScore: 70 },
				},
				stackChoices: { database: 'postgres' },
			}),
		});
		const loaded = loadProgress(storage);
		expect(loaded.completedLevels).toEqual(['act1-level2-first-boot']);
		expect(loaded.stackChoices).toEqual({ database: 'postgres' });
	});

	test('recovers from corrupted JSON with empty progress', () => {
		const storage = fakeStorage({ [PROGRESS_KEY]: '{not json' });
		expect(loadProgress(storage)).toEqual(EMPTY);
	});
});

describe('mergeCompletion (pure)', () => {
	test('adds a new completion once, no duplicates on replay', () => {
		const once = mergeCompletion(EMPTY, {
			levelId: 'a',
			stars: 2,
			finalStability: 50,
		});
		const twice = mergeCompletion(once, {
			levelId: 'a',
			stars: 2,
			finalStability: 50,
		});
		expect(twice.completedLevels).toEqual(['a']);
	});

	test('keeps the best stars and best score across replays', () => {
		const first = mergeCompletion(EMPTY, {
			levelId: 'a',
			stars: 3,
			finalStability: 90,
		});
		const worseReplay = mergeCompletion(first, {
			levelId: 'a',
			stars: 1,
			finalStability: 40,
		});
		expect(worseReplay.levelProgress.a).toEqual({ stars: 3, bestScore: 90 });
		const betterReplay = mergeCompletion(worseReplay, {
			levelId: 'a',
			stars: 3,
			finalStability: 95,
		});
		expect(betterReplay.levelProgress.a).toEqual({ stars: 3, bestScore: 95 });
	});

	test('records stack choices when provided, keeps them otherwise', () => {
		const withChoice = mergeCompletion(EMPTY, {
			levelId: 'a',
			stars: 1,
			finalStability: 10,
			stackChoices: { database: 'postgres' },
		});
		const later = mergeCompletion(withChoice, {
			levelId: 'b',
			stars: 1,
			finalStability: 10,
		});
		expect(later.stackChoices).toEqual({ database: 'postgres' });
	});

	test('does not mutate its input', () => {
		const before = structuredClone(EMPTY);
		mergeCompletion(EMPTY, { levelId: 'a', stars: 1, finalStability: 1 });
		expect(EMPTY).toEqual(before);
	});
});

describe('async wrappers (call-site compatibility)', () => {
	test('getProgress resolves the stored data', async () => {
		const storage = fakeStorage();
		await completeLevel({ levelId: 'x', stars: 1, finalStability: 5 }, storage);
		const progress = await getProgress(storage);
		expect(progress.completedLevels).toEqual(['x']);
	});

	test('completeLevel reports success and hasProgress flips', async () => {
		const storage = fakeStorage();
		expect(hasProgress(storage)).toBe(false);
		const result = await completeLevel(
			{ levelId: 'x', stars: 1, finalStability: 5 },
			storage,
		);
		expect(result.success).toBe(true);
		expect(hasProgress(storage)).toBe(true);
	});
});

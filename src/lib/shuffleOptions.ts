/**
 * Shuffle an array of options so the correct answer is never first.
 *
 * Uses a seeded PRNG so the order is stable per seed (prevents re-renders
 * from reshuffling). Pass the step index as the seed so each step gets a
 * different but deterministic order within a session, and a different order
 * across page reloads (seed is combined with a session-level random salt).
 *
 * Usage:
 *   const shuffled = useMemo(() => shuffleOptions(OPTIONS, stepIndex), [stepIndex]);
 */

// Session-level salt: generated once per page load so positions vary across reloads
const SESSION_SALT = Math.random();

/** Simple seeded PRNG (mulberry32). Returns a function that yields 0-1. */
function seededRng(seed: number): () => number {
	let s = (seed + SESSION_SALT * 2147483647) | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Shuffle options ensuring the correct answer is never at index 0.
 *
 * @param options - Array of objects with a `correct` boolean field
 * @param seed - Deterministic seed (e.g., step index)
 * @returns New shuffled array (original is not mutated)
 */
export function shuffleOptions<T extends { correct: boolean }>(
	options: T[],
	seed: number,
): T[] {
	const rng = seededRng(seed);
	const shuffled = [...options];

	// Fisher-Yates shuffle
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	// If correct answer ended up first, swap it with a random non-first position
	if (shuffled[0].correct && shuffled.length > 1) {
		const swapIdx = 1 + Math.floor(rng() * (shuffled.length - 1));
		[shuffled[0], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[0]];
	}

	return shuffled;
}

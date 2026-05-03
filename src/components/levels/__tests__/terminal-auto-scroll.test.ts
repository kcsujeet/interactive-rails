/**
 * Regression test for "terminal auto-scroll stops working after the first
 * render."
 *
 * The bug: a `useEffect(() => { scrollRef.current.scrollTop = ... }, [])`
 * with EMPTY dependency array runs once on mount and never again. New
 * probe responses, animated output lines, and stress-test results that
 * arrive later don't trigger the scroll. ProbeTerminal and SimulatedTerminal
 * shipped with this bug; the user noticed it on L9's probe terminal.
 *
 * The test: scan each terminal component file. If it has a useEffect that
 * touches `scrollTo` / `scrollTop` / `scrollIntoView` AND the deps array of
 * that useEffect is `[]`, fail.
 *
 * Per project rule, no DOM rendering — pure source-level static analysis.
 */

import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..', '..');

// Components that render a scrollable terminal-like surface and should auto-
// scroll as content arrives. Add to this list when introducing a new terminal.
const TERMINAL_COMPONENTS: readonly string[] = [
	'src/components/levels/ProbeTerminal.tsx',
	'src/components/levels/SimulatedTerminal.tsx',
	'src/components/levels/StressTestPanel.tsx',
];

const SCROLL_TOKEN = /scrollTo\b|scrollTop\b|scrollIntoView\b/;
const EMPTY_DEPS_CLOSE = /\},\s*\[\s*\]\s*\)/g;
const USE_EFFECT_OPEN = /useEffect\(\s*\(\s*\)\s*=>\s*\{/;

/**
 * Returns true if the source has a `useEffect(() => { ... scrollX ... }, [])`
 * — auto-scroll wired with empty deps, so it only runs on mount.
 *
 * Implementation: walks each `}, []);` (close of an empty-deps useEffect
 * callback) and checks the preceding ~600 chars for a useEffect-callback
 * opener AND a scroll token. Robust against arbitrary scroll-side code
 * inside the callback (we don't try to brace-balance — we just confirm the
 * callback opened recently and contains a scroll call).
 */
export function hasEmptyDepsScrollEffect(src: string): boolean {
	for (const close of src.matchAll(EMPTY_DEPS_CLOSE)) {
		const closeIdx = close.index ?? 0;
		const windowStart = Math.max(0, closeIdx - 600);
		const window = src.slice(windowStart, closeIdx);
		if (!USE_EFFECT_OPEN.test(window)) continue;
		if (SCROLL_TOKEN.test(window)) return true;
	}
	return false;
}

describe('static: terminal components auto-scroll on content change', () => {
	test('no terminal component has scroll useEffect with empty deps', async () => {
		const offenders: string[] = [];
		for (const rel of TERMINAL_COMPONENTS) {
			const src = await Bun.file(resolve(REPO_ROOT, rel)).text();
			if (hasEmptyDepsScrollEffect(src)) {
				offenders.push(`${rel}: useEffect with scroll-call has empty deps []`);
			}
		}
		expect(offenders).toEqual([]);
	});
});

describe('static: hasEmptyDepsScrollEffect helper', () => {
	test('flags scrollTop with empty deps', () => {
		const src = `
			useEffect(() => {
				if (ref.current) {
					ref.current.scrollTop = ref.current.scrollHeight;
				}
			}, []);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(true);
	});

	test('flags scrollTo with empty deps', () => {
		const src = `
			useEffect(() => {
				ref.current?.scrollTo({ top: 9999, behavior: 'smooth' });
			}, []);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(true);
	});

	test('flags scrollIntoView with empty deps', () => {
		const src = `
			useEffect(() => {
				lastItem.current?.scrollIntoView({ block: 'end' });
			}, []);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(true);
	});

	test('passes when deps include a state value', () => {
		const src = `
			useEffect(() => {
				ref.current.scrollTop = ref.current.scrollHeight;
			}, [history, visibleLines]);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(false);
	});

	test('passes when deps include a single state value', () => {
		const src = `
			useEffect(() => {
				ref.current.scrollTo({ top: ref.current.scrollHeight });
			}, [resultCount]);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(false);
	});

	test('does NOT flag a non-scroll useEffect with empty deps', () => {
		const src = `
			useEffect(() => {
				logger.info("mounted");
			}, []);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(false);
	});

	test('flags one offender among multiple useEffects in a file', () => {
		const src = `
			useEffect(() => {
				ref.current.scrollTop = ref.current.scrollHeight;
			}, []);
			useEffect(() => {
				logger.info("mounted");
			}, []);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(true);
	});

	test('passes when all useEffects with scroll calls have proper deps', () => {
		const src = `
			useEffect(() => {
				logger.info("mounted");
			}, []);
			useEffect(() => {
				ref.current.scrollTop = ref.current.scrollHeight;
			}, [history]);
		`;
		expect(hasEmptyDepsScrollEffect(src)).toBe(false);
	});
});

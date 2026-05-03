/**
 * Regression tests for the L8-class of bugs:
 *
 *   1. Stranded `getCodeFiles` reveals: a guard whose threshold exceeds the
 *      max value the right panel ever passes during gameplay. The file would
 *      appear in the codebase viewer (via `registerLevelCode(..., () =>
 *      getCodeFiles('reward', STEP_DEFS.length, ...))`) but never in-game.
 *      L8's controller went missing because its guard was `>= 5` while the
 *      render path passed `currentStep` (0-based, max 4).
 *
 *      The codebase mixes two stepper conventions:
 *        - 0-based: `getCodeFiles(..., isCompleted ? currentStep : currentStep - 1, ...)`
 *          → max in-game = STEP_DEFS.length - 1; guards `>= STEP_DEFS.length` are stranded.
 *        - 1-based: `getCodeFiles({ furthestStep: stepper.furthestStep })`
 *          → max in-game = STEP_DEFS.length; guards `>= STEP_DEFS.length + 1` are stranded.
 *
 *   2. Duplicate filenames in `registerLevelCode` output: two `files.push({...})`
 *      calls land the same `filename`. L8 had a duplicate Gemfile push.
 */

import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { Glob } from 'bun';
import { getLevelCode, getRegisteredLevelIds } from '@/lib/codebase-registry';
import { importAllLevels } from '../validate-codebase';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');

// ──────────────────────────────────────────────────────────────────────────
// Static scan: detect convention + max getCodeFiles guard
// ──────────────────────────────────────────────────────────────────────────

export type StepConvention = 'zero-based' | 'one-based' | 'unknown';

export interface ScanResult {
	stepCount: number | null;
	maxGuard: number | null;
	convention: StepConvention;
	/** Highest furthestStep value reachable in-game given the convention. */
	inGameMax: number | null;
}

export function scanLevelSource(src: string): ScanResult {
	const stepCount = countStepDefs(src);
	const maxGuard = findMaxFurthestStepGuard(src);
	const convention = detectConvention(src);
	let inGameMax: number | null = null;
	if (stepCount !== null && convention !== 'unknown') {
		inGameMax = convention === 'zero-based' ? stepCount - 1 : stepCount;
	}
	return { stepCount, maxGuard, convention, inGameMax };
}

function countStepDefs(src: string): number | null {
	const m = src.match(/const STEP_DEFS\b[^=]*=\s*\[([\s\S]*?)\];/);
	if (!m) return null;
	const matches = m[1].match(/\{\s*id:/g);
	return matches ? matches.length : null;
}

function findMaxFurthestStepGuard(src: string): number | null {
	const re = /(?:furthestStep|completedStep)\s*>=\s*(\d+)/g;
	const matches = [...src.matchAll(re)];
	if (matches.length === 0) return null;
	return Math.max(...matches.map((m) => Number(m[1])));
}

/**
 * Detect which step convention the level's render-side getCodeFiles call uses.
 * The right panel call is the source of truth for "what the player ever sees."
 */
function detectConvention(src: string): StepConvention {
	// Render-side call. The `<CodePreviewPanel files={getCodeFiles(` block
	// always lands within ~6 lines of args.
	const renderCall = src.match(/files=\{getCodeFiles\(([\s\S]{0,400}?)\)\}/);
	if (!renderCall) return 'unknown';
	const args = renderCall[1];
	if (/stepper\.currentStep/.test(args)) return 'zero-based';
	if (/stepper\.furthestStep|furthestStep:\s*stepper\.furthestStep/.test(args))
		return 'one-based';
	return 'unknown';
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

/**
 * Baseline of levels that already have stranded `getCodeFiles` guards. Each
 * entry is technical debt — the level's right-panel reveal is unreachable
 * during gameplay because of the same off-by-one that L8 had before fix.
 *
 * To remove an entry: fix the level's `getCodeFiles` guards (shift them down
 * by 1 to match the 0-based `currentStep` convention, or change the render
 * call to pass `stepper.furthestStep`), then delete the path from this set.
 *
 * Adding to this set is forbidden — new levels must not introduce this bug.
 */
const KNOWN_STRANDED_GUARDS = new Set<string>([
	'src/features/act1-foundation/components/level-4-associations/Level4Associations.tsx',
	'src/features/act1-foundation/components/level-6-routes/Level6Routes.tsx',
	'src/features/act1-foundation/components/level-7-controller/Level7Controller.tsx',
	'src/features/act2-users-security/components/level-11-authorization/Level11Authorization.tsx',
	'src/features/act2-users-security/components/level-13-strong-params/Level13StrongParams.tsx',
	'src/features/act2-users-security/components/level-14-testing/Level14Testing.tsx',
	'src/features/act3-clean-architecture/components/level-16-service-objects/Level16ServiceObjects.tsx',
	'src/features/act3-clean-architecture/components/level-17-concerns/Level17Concerns.tsx',
	'src/features/act3-clean-architecture/components/level-18-validation-contracts/Level18ValidationContracts.tsx',
	'src/features/act3-clean-architecture/components/level-19-query-objects/Level19QueryObjects.tsx',
	'src/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling.tsx',
	'src/features/act6-operations/components/level-41-cors/Level41CORS.tsx',
]);

describe('static: getCodeFiles guards reachable in-game', () => {
	test('no NEW level has a stranded guard (baselined existing ones)', async () => {
		const glob = new Glob('src/features/act*/components/level-*-*/Level*.tsx');
		const newOffenders: string[] = [];
		const seenOffenders = new Set<string>();
		for await (const filepath of glob.scan(REPO_ROOT)) {
			if (filepath.includes('/__tests__/')) continue;
			const src = await Bun.file(resolve(REPO_ROOT, filepath)).text();
			const { stepCount, maxGuard, convention, inGameMax } =
				scanLevelSource(src);
			if (
				stepCount === null ||
				maxGuard === null ||
				convention === 'unknown' ||
				inGameMax === null
			) {
				continue;
			}
			if (maxGuard > inGameMax) {
				seenOffenders.add(filepath);
				if (!KNOWN_STRANDED_GUARDS.has(filepath)) {
					newOffenders.push(
						`${filepath}: ${convention} render path can pass at most ${inGameMax}, but a guard requires >= ${maxGuard}`,
					);
				}
			}
		}
		expect(newOffenders).toEqual([]);
		// Also flag baseline entries that have been fixed but not removed from the set
		const stale = [...KNOWN_STRANDED_GUARDS].filter(
			(p) => !seenOffenders.has(p),
		);
		expect(stale, 'KNOWN_STRANDED_GUARDS contains stale entries').toEqual([]);
	});
});

describe('static: scanLevelSource helpers', () => {
	const wrapInRender = (innerArgs: string, body: string) => `
		const STEP_DEFS: StepDef[] = [
			{ id: 'a', title: 'A' },
			{ id: 'b', title: 'B' },
			{ id: 'c', title: 'C' },
		];
		function getCodeFiles() { ${body} }
		// fake render snippet
		<CodePreviewPanel files={getCodeFiles(${innerArgs})} />
	`;

	test('counts STEP_DEFS entries', () => {
		expect(
			scanLevelSource(wrapInRender('stepper.currentStep', '')).stepCount,
		).toBe(3);
	});

	test('returns null stepCount when no STEP_DEFS', () => {
		expect(scanLevelSource('const STEPS = [];').stepCount).toBeNull();
	});

	test('takes max across multiple `>=` guards', () => {
		const src = wrapInRender(
			'stepper.currentStep',
			'if (furthestStep >= 1) { } if (furthestStep >= 3) { } if (furthestStep >= 2) { }',
		);
		expect(scanLevelSource(src).maxGuard).toBe(3);
	});

	test('detects 0-based convention from `stepper.currentStep` arg', () => {
		const src = wrapInRender('stepper.currentStep', '');
		expect(scanLevelSource(src).convention).toBe('zero-based');
		expect(scanLevelSource(src).inGameMax).toBe(2); // 3 steps - 1
	});

	test('detects 1-based convention from `stepper.furthestStep` arg', () => {
		const src = wrapInRender('{ furthestStep: stepper.furthestStep }', '');
		expect(scanLevelSource(src).convention).toBe('one-based');
		expect(scanLevelSource(src).inGameMax).toBe(3); // 3 steps
	});

	test('regression: L8 pre-fix shape would have flagged (0-based, guard=length)', () => {
		const preFixL8 = `
			const STEP_DEFS: StepDef[] = [
				{ id: 'choose-gem', title: 'Choose Gem' },
				{ id: 'install-gem', title: 'Install Gem' },
				{ id: 'base-serializer', title: 'Base Serializer' },
				{ id: 'define-attributes', title: 'Define Attributes' },
				{ id: 'update-controller', title: 'Update Controller' },
			];
			function getCodeFiles() {
				if (furthestStep >= 5) { /* controller — STRANDED */ }
			}
			<CodePreviewPanel files={getCodeFiles(stepper.isCurrentStepCompleted ? stepper.currentStep : stepper.currentStep - 1)} />
		`;
		const r = scanLevelSource(preFixL8);
		expect(r.stepCount).toBe(5);
		expect(r.maxGuard).toBe(5);
		expect(r.convention).toBe('zero-based');
		expect(r.inGameMax).toBe(4);
		expect(r.maxGuard! > r.inGameMax!).toBe(true);
	});

	test('1-based level with guard==length is OK (not flagged)', () => {
		const src = `
			const STEP_DEFS: StepDef[] = [
				{ id: 'a', title: 'A' },
				{ id: 'b', title: 'B' },
				{ id: 'c', title: 'C' },
				{ id: 'd', title: 'D' },
			];
			function getCodeFiles() {
				if (furthestStep >= 4) { /* reachable when last step completes */ }
			}
			<CodePreviewPanel files={getCodeFiles({ furthestStep: stepper.furthestStep })} />
		`;
		const r = scanLevelSource(src);
		expect(r.stepCount).toBe(4);
		expect(r.maxGuard).toBe(4);
		expect(r.convention).toBe('one-based');
		expect(r.inGameMax).toBe(4);
		expect(r.maxGuard! > r.inGameMax!).toBe(false);
	});
});

// ──────────────────────────────────────────────────────────────────────────
// Runtime: registry returns no duplicate filenames
// ──────────────────────────────────────────────────────────────────────────

/**
 * Baseline of levels that already register duplicate filenames in their
 * `registerLevelCode` output. Same removal/addition policy as
 * KNOWN_STRANDED_GUARDS above.
 */
const KNOWN_DUPLICATE_FILENAMES = new Set<string>([
	'act4-level29-http-caching',
]);

describe('runtime: registerLevelCode returns no duplicate filenames', () => {
	test('no NEW level has duplicate filenames (baselined existing ones)', async () => {
		await importAllLevels();
		const newOffenders: string[] = [];
		const seenOffenders = new Set<string>();
		for (const id of getRegisteredLevelIds()) {
			const files = getLevelCode(id) ?? [];
			const seen = new Set<string>();
			const dups = new Set<string>();
			for (const f of files) {
				if (seen.has(f.filename)) dups.add(f.filename);
				else seen.add(f.filename);
			}
			if (dups.size > 0) {
				seenOffenders.add(id);
				if (!KNOWN_DUPLICATE_FILENAMES.has(id)) {
					newOffenders.push(
						`${id}: duplicate filenames ${[...dups].join(', ')}`,
					);
				}
			}
		}
		expect(newOffenders).toEqual([]);
		const stale = [...KNOWN_DUPLICATE_FILENAMES].filter(
			(id) => !seenOffenders.has(id),
		);
		expect(stale, 'KNOWN_DUPLICATE_FILENAMES contains stale entries').toEqual(
			[],
		);
	});
});

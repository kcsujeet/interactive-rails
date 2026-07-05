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
	'src/features/act3-clean-architecture/components/level-16-service-objects/Level16ServiceObjects.tsx',
	'src/features/act3-clean-architecture/components/level-17-concerns/Level17Concerns.tsx',
	'src/features/act3-clean-architecture/components/level-18-validation-contracts/Level18ValidationContracts.tsx',
	'src/features/act3-clean-architecture/components/level-19-query-objects/Level19QueryObjects.tsx',
	'src/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling.tsx',
	'src/features/act6-operations/components/level-41-cors/Level41CORS.tsx',
]);

describe('static: getCodeFiles guards reachable in-game', () => {
	test('no NEW level has a stranded guard (baselined existing ones)', async () => {
		const glob = new Glob('src/features/act*/components/level-*-*/**/*.tsx');
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
		expect((r.maxGuard ?? 0) > (r.inGameMax ?? 0)).toBe(true);
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
		expect((r.maxGuard ?? 0) > (r.inGameMax ?? 0)).toBe(false);
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

// ──────────────────────────────────────────────────────────────────────────
// Static: observe phase shows only what currently exists
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per `.agents/rules/pedagogy.md` ("show only what currently exists"), the
 * observe phase must NOT render a node for a component the build phase will
 * introduce. L8 had a `Serializer` node with sublabel "Missing!" — wrong; the
 * serializer doesn't exist yet, so it shouldn't be a node at all. Probes
 * communicate the absence by showing what goes wrong (raw JSON, 404, etc.).
 *
 * This test catches the textual fingerprints of the bug:
 *   - inspector titles ending in `(Missing)` / `(Missing!)`
 *   - stage labels ending in `(Missing)` / `(Missing!)`
 *   - bare `sublabel: 'Missing'` / `'Missing!'` values
 *
 * Pure "No X" sublabels (e.g. `'No WHERE clause'` on an existing query node)
 * are NOT flagged — those describe an absent property of an existing node,
 * not a non-existent node.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
	/title:\s*['"`][^'"`]+\([Mm]issing!?\)['"`]/,
	/label:\s*['"`][^'"`]+\([Mm]issing!?\)['"`]/,
	/sublabel:\s*['"`][Mm]issing!?['"`]/,
];

const KNOWN_OBSERVE_PHASE_PLACEHOLDERS = new Set<string>([
	'src/features/act1-foundation/components/level-7-controller/Level7Controller.tsx',
	'src/features/act2-users-security/components/level-9-authentication/Level9Authentication.tsx',
	'src/features/act2-users-security/components/level-11-authorization/Level11Authorization.tsx',
	'src/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling.tsx',
	'src/features/act4-performance/components/level-28-caching/Level28Caching.tsx',
	'src/features/act4-performance/components/level-29-http-caching/Level29HTTPCaching.tsx',
	'src/features/act5-production/components/level-35-action-mailer/Level35ActionMailer.tsx',
	'src/features/act6-operations/components/level-41-cors/Level41CORS.tsx',
	'src/features/act6-operations/components/level-47-observability/Level47Observability.tsx',
]);

export function findPlaceholderViolations(src: string): string[] {
	const hits: string[] = [];
	for (const re of PLACEHOLDER_PATTERNS) {
		const m = src.match(re);
		if (m) hits.push(m[0]);
	}
	return hits;
}

describe('static: observe phase shows only what currently exists', () => {
	test('no NEW level renders a "(Missing)" placeholder in observe', async () => {
		const glob = new Glob('src/features/act*/components/level-*-*/**/*.tsx');
		const newOffenders: string[] = [];
		const seenOffenders = new Set<string>();
		for await (const filepath of glob.scan(REPO_ROOT)) {
			if (filepath.includes('/__tests__/')) continue;
			const src = await Bun.file(resolve(REPO_ROOT, filepath)).text();
			const hits = findPlaceholderViolations(src);
			if (hits.length === 0) continue;
			seenOffenders.add(filepath);
			if (!KNOWN_OBSERVE_PHASE_PLACEHOLDERS.has(filepath)) {
				newOffenders.push(`${filepath}: ${hits.join(' | ')}`);
			}
		}
		expect(newOffenders).toEqual([]);
		const stale = [...KNOWN_OBSERVE_PHASE_PLACEHOLDERS].filter(
			(p) => !seenOffenders.has(p),
		);
		expect(
			stale,
			'KNOWN_OBSERVE_PHASE_PLACEHOLDERS contains stale entries',
		).toEqual([]);
	});
});

describe('static: findPlaceholderViolations helper', () => {
	test('flags inspector title ending in "(Missing!)"', () => {
		expect(
			findPlaceholderViolations(`title: 'Serializer (Missing!)',`),
		).toEqual([`title: 'Serializer (Missing!)'`]);
	});

	test('flags stage label ending in "(Missing)"', () => {
		expect(
			findPlaceholderViolations(`label: 'Cache Layer (Missing)',`),
		).toEqual([`label: 'Cache Layer (Missing)'`]);
	});

	test('flags bare sublabel "Missing!" value', () => {
		expect(findPlaceholderViolations(`sublabel: 'Missing!',`)).toEqual([
			`sublabel: 'Missing!'`,
		]);
	});

	test('does NOT flag legitimate "No X" sublabels (existing node, absent property)', () => {
		expect(findPlaceholderViolations(`sublabel: 'No WHERE clause',`)).toEqual(
			[],
		);
		expect(
			findPlaceholderViolations(`sublabel: 'No store configured',`),
		).toEqual([]);
		expect(findPlaceholderViolations(`sublabel: 'No fallback',`)).toEqual([]);
	});

	test('does NOT flag "Missing (404)" inside a sublabel string used on an existing node', () => {
		// The "Missing (404)" pattern is a probe response state on an existing
		// node, not a placeholder node. Flagged separately if/when we extend.
		expect(findPlaceholderViolations(`sublabel: 'Missing (404)',`)).toEqual([]);
	});

	test('regression: the L8 pre-fix shape would have been flagged', () => {
		const preFixL8 = `
			serializer: {
				stageId: 'serializer',
				title: 'Serializer (Missing!)',
				description: 'No serializer exists. ...',
			},
		`;
		expect(findPlaceholderViolations(preFixL8).length).toBeGreaterThan(0);
	});
});

// ──────────────────────────────────────────────────────────────────────────
// Static: PipelineFlow edges should not animate by default
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per `.agents/rules/pedagogy.md` ("the dormant-edges default — undefined is a
 * trap"): when no probe / scenario has fired, edges must be dormant. The level
 * achieves this by passing `activeConnections={[]}` to PipelineFlow. Omitting
 * the prop puts edges into 'idle' mode, which animates dot motion continuously
 * before the player has done anything — implying data is flowing when nothing
 * has happened.
 *
 * This test scans every level component file and asserts that any
 * `<PipelineFlow ...>` JSX includes an `activeConnections=` prop.
 */
// Baseline emptied 2026-07-05: all seven known offenders were wired with
// fire-driven activeConnections (L20, L29, L35, L36) or explicit dormant
// arrays (L49 phases). New offenders fail immediately.
const KNOWN_AUTO_ANIMATING_EDGES = new Set<string>([]);

/**
 * Returns true if the source contains a `<PipelineFlow ...>` JSX render
 * that does NOT pass `activeConnections=`. Scans every PipelineFlow opening
 * tag in the file (a level can render it more than once for observe + reward).
 */
export function hasAutoAnimatingPipelineFlow(src: string): boolean {
	// Match `<PipelineFlow` followed by props up to the first `>` (or `/>`).
	// JSX tags don't nest `<` inside attribute values in any of our levels, so
	// a non-greedy match up to `>` is reliable.
	const re = /<PipelineFlow\s[^>]*?>/g;
	for (const match of src.matchAll(re)) {
		const tag = match[0];
		if (!/activeConnections\s*=/.test(tag)) return true;
	}
	return false;
}

describe('static: PipelineFlow edges do not animate by default', () => {
	test('every PipelineFlow render passes activeConnections= (baselined existing)', async () => {
		const glob = new Glob('src/features/act*/components/level-*-*/**/*.tsx');
		const newOffenders: string[] = [];
		const seenOffenders = new Set<string>();
		for await (const filepath of glob.scan(REPO_ROOT)) {
			if (filepath.includes('/__tests__/')) continue;
			const src = await Bun.file(resolve(REPO_ROOT, filepath)).text();
			if (!hasAutoAnimatingPipelineFlow(src)) continue;
			seenOffenders.add(filepath);
			if (!KNOWN_AUTO_ANIMATING_EDGES.has(filepath)) {
				newOffenders.push(
					`${filepath}: <PipelineFlow ...> rendered without activeConnections=`,
				);
			}
		}
		expect(newOffenders).toEqual([]);
		const stale = [...KNOWN_AUTO_ANIMATING_EDGES].filter(
			(p) => !seenOffenders.has(p),
		);
		expect(stale, 'KNOWN_AUTO_ANIMATING_EDGES contains stale entries').toEqual(
			[],
		);
	});
});

describe('static: hasAutoAnimatingPipelineFlow helper', () => {
	test('flags PipelineFlow without activeConnections', () => {
		const src = `<PipelineFlow connections={CONNS} stages={stages} />`;
		expect(hasAutoAnimatingPipelineFlow(src)).toBe(true);
	});

	test('passes when activeConnections is provided', () => {
		const src = `<PipelineFlow connections={CONNS} stages={stages} activeConnections={[]} />`;
		expect(hasAutoAnimatingPipelineFlow(src)).toBe(false);
	});

	test('flags multi-line tag without activeConnections', () => {
		const src = `
			<PipelineFlow
				connections={OBSERVE_CONNECTIONS}
				stages={observeStages}
				onNodeClick={handleStageClick}
			>
		`;
		expect(hasAutoAnimatingPipelineFlow(src)).toBe(true);
	});

	test('handles two PipelineFlow renders, flags if either is missing the prop', () => {
		const src = `
			<PipelineFlow connections={A} activeConnections={[]} />
			<PipelineFlow connections={B} stages={s} />
		`;
		expect(hasAutoAnimatingPipelineFlow(src)).toBe(true);
	});

	test('passes when all PipelineFlow renders include the prop', () => {
		const src = `
			<PipelineFlow connections={A} activeConnections={obs} />
			<PipelineFlow connections={B} activeConnections={rew} />
		`;
		expect(hasAutoAnimatingPipelineFlow(src)).toBe(false);
	});

	test('passes when there are no PipelineFlow renders at all', () => {
		expect(hasAutoAnimatingPipelineFlow('// no flow here')).toBe(false);
	});
});

// ──────────────────────────────────────────────────────────────────────────
// Runtime + static: stress scenarios target endpoints the codebase viewer shows
// ──────────────────────────────────────────────────────────────────────────

/**
 * If a level's reward phase fires stress tests against an endpoint (e.g.
 * `GET /api/v1/products/1`), the level's `getCodeFiles` reward state must
 * include the controller for that endpoint. Otherwise the player runs
 * stress tests against an endpoint they cannot see in the codebase viewer
 * and has no way to understand how the test outcomes are produced. L9
 * shipped with this gap (stress tests on `/api/v1/products` but no products
 * controller in the snapshot).
 *
 * Implementation: static-scan each level for `STRESS_SCENARIOS = [...]`,
 * extract every `path:` value, derive the resource name, and check that the
 * level's runtime `getLevelCode(slug)` output includes a controller file
 * whose basename matches the resource (or its singular / plural form).
 */
const STRESS_PATH_RE = /path:\s*['"`]([^'"`]+)['"`]/g;
const STRESS_BLOCK_RE = /const STRESS_SCENARIOS\b[^=]*=\s*\[([\s\S]*?)\];/;

export function extractStressPaths(src: string): string[] {
	const block = src.match(STRESS_BLOCK_RE);
	if (!block) return [];
	const paths: string[] = [];
	for (const m of block[1].matchAll(STRESS_PATH_RE)) {
		paths.push(m[1]);
	}
	return paths;
}

/**
 * Best-effort resource name from a Rails-ish path. Strips `:id` segments
 * and pure-numeric segments; takes the last meaningful segment as the
 * resource. `/api/v1/products/1` -> `products`. `/session` -> `session`.
 */
export function resourceFromPath(path: string): string | null {
	const segments = path
		.split('/')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.filter((s) => !s.startsWith(':'))
		.filter((s) => !/^\d+$/.test(s));
	if (segments.length === 0) return null;
	return segments[segments.length - 1];
}

/**
 * Returns true if any of the level's snapshot filenames matches the
 * resource as a controller file (handles both singular and plural forms).
 *
 * For resource `products`: matches `products_controller.rb`.
 * For resource `session`: matches `session_controller.rb` OR
 * `sessions_controller.rb` (Rails uses plural for resources, singular for
 * `resource :session`).
 */
export function snapshotCoversResource(
	filenames: string[],
	resource: string,
): boolean {
	const candidates = new Set<string>([
		`${resource}_controller.rb`,
		// Naive plural / singular flips covering Rails conventions
		`${resource}s_controller.rb`,
		`${resource.replace(/s$/, '')}_controller.rb`,
	]);
	for (const f of filenames) {
		const basename = f.split('/').pop() ?? '';
		if (candidates.has(basename)) return true;
	}
	return false;
}

/**
 * Baseline of levels whose stress scenarios target a path the level's
 * snapshot does NOT include the controller for. Same removal/addition
 * policy as the other baselines in this file.
 *
 * NOTE: this baseline is large (40 entries). The test's heuristic is
 * deliberately broad — it flags any stress scenario whose `path:` field
 * doesn't have a matching `*_controller.rb` in the snapshot. False
 * positives come from levels that overload `path:` for non-HTTP labels
 * (migration DSL in L43, job names in L44, channel names in L37, etc.)
 * AND from levels that legitimately don't need to show the controller
 * (L41 CORS demonstrates middleware behavior; the products controller
 * itself is unchanged from L7). Each entry is a TODO: either fix the
 * level (add the controller, or move the scenarios to a different field
 * that's not `path:`) or remove from the baseline after audit.
 */
const KNOWN_MISSING_STRESS_TARGET_CONTROLLER = new Set<string>([
	'src/features/act1-foundation/components/level-4-associations/Level4Associations.tsx',
	'src/features/act1-foundation/components/level-6-routes/Level6Routes.tsx',
	'src/features/act2-users-security/components/level-9-authentication/Level9Authentication.tsx',
	'src/features/act2-users-security/components/level-10-encryption/Level10Encryption.tsx',
	'src/features/act2-users-security/components/level-12-validations/Level12Validations.tsx',
	'src/features/act2-users-security/components/level-14-testing/Level14Testing.tsx',
	'src/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling.tsx',
	'src/features/act4-performance/components/level-21-n1-problem/Level21N1Problem.tsx',
	'src/features/act4-performance/components/level-22-eager-loading/Level22EagerLoading.tsx',
	'src/features/act4-performance/components/level-23-narrow-fetching/Level23NarrowFetching.tsx',
	'src/features/act4-performance/components/level-24-indexing/Level24Indexing.tsx',
	'src/features/act4-performance/components/level-25-counter-caches/Level25CounterCaches.tsx',
	'src/features/act4-performance/components/level-26-pagination/Level26Pagination.tsx',
	'src/features/act4-performance/components/level-27-search/Level27Search.tsx',
	'src/features/act4-performance/components/level-28-caching/Level28Caching.tsx',
	'src/features/act4-performance/components/level-29-http-caching/Level29HTTPCaching.tsx',
	'src/features/act5-production/components/level-31-soft-deletes/Level31SoftDeletes.tsx',
	'src/features/act5-production/components/level-33-locking/Level33Locking.tsx',
	'src/features/act5-production/components/level-34-active-storage/Level34ActiveStorage.tsx',
	'src/features/act5-production/components/level-35-action-mailer/Level35ActionMailer.tsx',
	'src/features/act5-production/components/level-36-background-jobs/Level36BackgroundJobs.tsx',
	'src/features/act5-production/components/level-37-real-time/Level37RealTime.tsx',
	'src/features/act5-production/components/level-38-external-apis/Level38ExternalAPIs.tsx',
	'src/features/act6-operations/components/level-40-middleware/Level40Middleware.tsx',
	'src/features/act6-operations/components/level-41-cors/Level41CORS.tsx',
	'src/features/act6-operations/components/level-42-rate-limiting/Level42RateLimiting.tsx',
	'src/features/act6-operations/components/level-43-safe-migrations/Level43SafeMigrations.tsx',
	'src/features/act6-operations/components/level-44-recurring-jobs/Level44RecurringJobs.tsx',
	'src/features/act6-operations/components/level-45-data-lifecycle/Level45DataLifecycle.tsx',
	'src/features/act6-operations/components/level-46-error-monitoring/Level46ErrorMonitoring.tsx',
	'src/features/act6-operations/components/level-47-observability/Level47Observability.tsx',
	'src/features/act6-operations/components/level-48-api-versioning/Level48APIVersioning.tsx',
	'src/features/act7-scale/components/level-51-multi-database/Level51MultiDatabase.tsx',
	'src/features/act7-scale/components/level-52-sharding/Level52Sharding.tsx',
	'src/features/act7-scale/components/level-53-multi-tenancy/Level53MultiTenancy.tsx',
	'src/features/act7-scale/components/level-54-state-machines/Level54StateMachines.tsx',
	'src/features/act7-scale/components/level-55-modular-monolith/Level55ModularMonolith.tsx',
	'src/features/act7-scale/components/level-56-domain-events/Level56DomainEvents.tsx',
	'src/features/act7-scale/components/level-57-api-gateway/Level57APIGateway.tsx',
	'src/features/act7-scale/components/level-58-architect/Level58Architect.tsx',
]);

describe('static + runtime: stress scenarios show their target controller', () => {
	test('every stress path has a matching controller in the snapshot', async () => {
		await importAllLevels();
		const glob = new Glob('src/features/act*/components/level-*-*/**/*.tsx');
		const newOffenders: string[] = [];
		const seenOffenders = new Set<string>();
		for await (const filepath of glob.scan(REPO_ROOT)) {
			if (filepath.includes('/__tests__/')) continue;
			const src = await Bun.file(resolve(REPO_ROOT, filepath)).text();
			const paths = extractStressPaths(src);
			if (paths.length === 0) continue;

			// Find the level slug for this file from its registerLevelCode call
			const slugMatch = src.match(/registerLevelCode\(\s*['"`]([\w-]+)['"`]/);
			if (!slugMatch) continue;
			const slug = slugMatch[1];
			const files = getLevelCode(slug) ?? [];
			const filenames = files.map((f) => f.filename);

			const uncovered = new Set<string>();
			for (const path of paths) {
				const resource = resourceFromPath(path);
				if (!resource) continue;
				// Skip Rails internals (`/up` health endpoint, etc.)
				if (resource === 'up') continue;
				if (!snapshotCoversResource(filenames, resource)) {
					uncovered.add(resource);
				}
			}
			if (uncovered.size > 0) {
				seenOffenders.add(filepath);
				if (!KNOWN_MISSING_STRESS_TARGET_CONTROLLER.has(filepath)) {
					newOffenders.push(
						`${filepath}: stress scenarios target [${[...uncovered].join(', ')}] but the snapshot has no matching controller`,
					);
				}
			}
		}
		expect(newOffenders).toEqual([]);
		const stale = [...KNOWN_MISSING_STRESS_TARGET_CONTROLLER].filter(
			(p) => !seenOffenders.has(p),
		);
		expect(
			stale,
			'KNOWN_MISSING_STRESS_TARGET_CONTROLLER contains stale entries',
		).toEqual([]);
	});
});

describe('static: helpers', () => {
	test('extractStressPaths pulls path values from a STRESS_SCENARIOS array', () => {
		const src = `
			const STRESS_SCENARIOS: StressScenario[] = [
				{ id: 'a', path: '/api/v1/products', method: 'GET' },
				{ id: 'b', path: '/api/v1/products/1', method: 'DELETE' },
				{ id: 'c', path: '/session', method: 'POST' },
			];
		`;
		expect(extractStressPaths(src)).toEqual([
			'/api/v1/products',
			'/api/v1/products/1',
			'/session',
		]);
	});

	test('extractStressPaths returns [] when no STRESS_SCENARIOS', () => {
		expect(extractStressPaths('const FOO = [];')).toEqual([]);
	});

	test('resourceFromPath drops dynamic segments and namespace prefix', () => {
		expect(resourceFromPath('/api/v1/products/1')).toBe('products');
		expect(resourceFromPath('/api/v1/products/:id')).toBe('products');
		expect(resourceFromPath('/api/v1/products')).toBe('products');
		expect(resourceFromPath('/session')).toBe('session');
		expect(resourceFromPath('/up')).toBe('up');
	});

	test('snapshotCoversResource matches plural and singular forms', () => {
		expect(
			snapshotCoversResource(
				['app/controllers/api/v1/products_controller.rb'],
				'products',
			),
		).toBe(true);
		expect(
			snapshotCoversResource(
				['app/controllers/sessions_controller.rb'],
				'session',
			),
		).toBe(true);
		expect(snapshotCoversResource(['app/models/user.rb'], 'products')).toBe(
			false,
		);
	});

	test('snapshotCoversResource regression: L9 pre-fix would fail for products', () => {
		// L9's pre-fix snapshot had User, Session, SessionsController,
		// Authentication concern — but no products_controller.rb.
		const preFix = [
			'app/models/user.rb',
			'app/models/session.rb',
			'app/controllers/sessions_controller.rb',
			'app/controllers/concerns/authentication.rb',
		];
		expect(snapshotCoversResource(preFix, 'products')).toBe(false);
	});
});

/**
 * Tests for Level 24: Eager Loading
 *
 * Validates data consistency across phases, build step quality,
 * stress scenario correctness, and cross-phase consistency.
 */

import { describe, expect, test } from 'bun:test';

// ──────────────────────────────────────────────
// Types (mirrored from component)
// ──────────────────────────────────────────────

interface DiscoveryDef {
	id: string;
	label: string;
}

interface ProbeConfig {
	id: string;
	label: string;
	command: string;
	responseLines: { text: string; color?: string }[];
}

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

interface StressScenario {
	id: string;
	label: string;
	description: string;
	method: string;
	path: string;
	actor: string;
	expectedResult: 'allowed' | 'blocked';
}

interface StepDef {
	id: string;
	title: string;
}

interface QueryBlock {
	label: string;
	color: 'green' | 'amber' | 'red';
	wide?: boolean;
}

interface RewardLaneData {
	strategy: string;
	blocks: QueryBlock[];
	floodCount?: number;
	totalLabel: string;
	result: 'works' | 'fails';
}

// ──────────────────────────────────────────────
// Data (mirrored from component)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'joins-trap', label: 'joins does NOT prevent N+1' },
	{ id: 'nested-syntax', label: 'Nested associations need nested includes' },
	{
		id: 'filter-needs-join',
		label: 'Filtering by association requires a JOIN strategy',
	},
	{
		id: 'strategy-diff',
		label: 'Different scenarios need different strategies',
	},
];

const PROBES: ProbeConfig[] = [
	{
		id: 'basic-users',
		label: 'Load products with users',
		command: 'Product.all + product.user.name (basic N+1)',
		responseLines: [
			{
				text: 'Scenario: 100 products, each needs .user.name',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'includes(:user)   => 2 queries (SELECT products + SELECT users IN(...))',
				color: 'green',
			},
			{
				text: 'preload(:user)    => 2 queries (separate SELECTs)',
				color: 'green',
			},
			{
				text: 'eager_load(:user) => 1 query (LEFT OUTER JOIN)',
				color: 'green',
			},
			{
				text: 'joins(:user)      => 101 queries! (loads nothing into memory)',
				color: 'red',
			},
		],
	},
	{
		id: 'nested-reviews',
		label: 'Load products + reviews + users',
		command: 'Product.all + product.reviews.map(&:user) (nested N+1)',
		responseLines: [
			{
				text: 'Scenario: products -> reviews -> review authors (2 levels deep)',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'includes(reviews: :user) => 3 queries (products + reviews + users)',
				color: 'green',
			},
			{
				text: 'preload(reviews: :user)  => 3 queries (always separate)',
				color: 'green',
			},
			{
				text: 'eager_load(c: :user)      => 1 wide JOIN (high memory)',
				color: 'yellow',
			},
			{
				text: 'includes(:reviews) only  => N+1 on review.user!',
				color: 'red',
			},
		],
	},
	{
		id: 'filtered-assoc',
		label: 'Filter by association column',
		command: 'Product.where(tags: { active: true }) (filter on assoc)',
		responseLines: [
			{
				text: 'Scenario: filter products WHERE tags.active = true',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'eager_load(:tags).where(tags: { active: true }) => 1 JOIN query',
				color: 'green',
			},
			{
				text: 'includes(:tags).where(...)  => works (auto-switches to JOIN)',
				color: 'yellow',
			},
			{
				text: 'preload(:tags).where(...)   => ERROR! Cannot filter with separate queries',
				color: 'red',
			},
			{
				text: 'When filtering on associations, you need a JOIN strategy.',
				color: 'yellow',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'basic-users': 'joins-trap',
	'nested-reviews': 'nested-syntax',
	'filtered-assoc': 'filter-needs-join',
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	joins: 'joins-trap',
	includes: 'strategy-diff',
	preload: 'strategy-diff',
	eager_load: 'strategy-diff',
};

const STEP_DEFS: StepDef[] = [
	{ id: 'basic-includes', title: 'Fix Products with Users' },
	{ id: 'nested-includes', title: 'Fix Nested Associations' },
	{ id: 'conditional-eager', title: 'Fix Filtered Query' },
];

const OPTION_STEP_0: StepOption[] = [
	{
		id: 'joins',
		label: 'Product.joins(:user)',
		correct: false,
		feedback:
			'joins creates an INNER JOIN but does NOT load user records into memory. You will still get N+1 when accessing product.user.',
	},
	{
		id: 'includes',
		label: 'Product.includes(:user)',
		correct: true,
	},
	{
		id: 'find-each',
		label: 'Product.find_each { |p| p.user }',
		correct: false,
		feedback:
			'find_each processes records in batches to save memory, but it still lazy-loads each user individually. The association query pattern does not change.',
	},
];

const OPTION_STEP_1: StepOption[] = [
	{
		id: 'flat-includes',
		label: 'Product.includes(:reviews)',
		correct: false,
		feedback:
			'That loads reviews but not their users. You will still get N+1 on review.user. The nested association needs to be specified.',
	},
	{
		id: 'separate',
		label: 'Product.includes(:reviews).includes(:users)',
		correct: false,
		feedback:
			'Products do not have a direct :users association. The users belong to reviews, so you need to express that nesting in the includes call.',
	},
	{
		id: 'nested-includes',
		label: 'Product.includes(reviews: :user)',
		correct: true,
	},
];

const OPTION_STEP_2: StepOption[] = [
	{
		id: 'preload',
		label: 'Product.preload(:tags).where(tags: { active: true })',
		correct: false,
		feedback:
			'preload always uses separate queries, so it cannot apply a WHERE clause on the associated table. Rails will raise an error.',
	},
	{
		id: 'eager-load',
		label: 'Product.eager_load(:tags).where(tags: { active: true })',
		correct: false,
		feedback:
			'eager_load works, but Rails auto-promotes to LEFT OUTER JOIN whenever you filter on the associated table. Forcing the JOIN strategy explicitly here adds words without changing the SQL.',
	},
	{
		id: 'includes-where',
		label: 'Product.includes(:tags).where(tags: { active: true })',
		correct: true,
	},
];

const ALL_OPTION_STEPS: StepOption[][] = [
	OPTION_STEP_0,
	OPTION_STEP_1,
	OPTION_STEP_2,
];

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'basic-includes',
		label: 'Products with users (includes)',
		description: 'Load 100 products with user names',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'includes(:user)',
		expectedResult: 'allowed',
	},
	{
		id: 'nested-includes',
		label: 'Products with nested reviews',
		description: 'Load products with reviews and their users',
		method: 'GET',
		path: '/api/v1/products?include=reviews',
		actor: 'includes(reviews: :user)',
		expectedResult: 'allowed',
	},
	{
		id: 'filtered-eager',
		label: 'Filtered by active tags',
		description: 'Load products filtered by association column',
		method: 'GET',
		path: '/api/v1/products?tag=active',
		actor: 'eager_load(:tags)',
		expectedResult: 'allowed',
	},
	{
		id: 'no-eager-basic',
		label: 'Products without eager loading',
		description: 'Forgot to add includes, N+1 detected',
		method: 'GET',
		path: '/api/v1/admin/products',
		actor: 'Product.all (no includes)',
		expectedResult: 'blocked',
	},
	{
		id: 'joins-mistake',
		label: 'Using joins (common mistake)',
		description: 'joins does NOT load associations into memory',
		method: 'GET',
		path: '/api/v1/products?admin=true',
		actor: 'Product.joins(:user)',
		expectedResult: 'blocked',
	},
];

const REWARD_LANE_DATA: Record<string, RewardLaneData> = {
	'basic-includes': {
		strategy: 'includes(:user)',
		blocks: [
			{ label: 'SELECT products', color: 'green' },
			{ label: 'SELECT users WHERE id IN(...)', color: 'green' },
		],
		totalLabel: '2 queries',
		result: 'works',
	},
	'nested-includes': {
		strategy: 'includes(reviews: :user)',
		blocks: [
			{ label: 'SELECT products', color: 'green' },
			{ label: 'SELECT reviews IN(...)', color: 'green' },
			{ label: 'SELECT users IN(...)', color: 'green' },
		],
		totalLabel: '3 queries',
		result: 'works',
	},
	'filtered-eager': {
		strategy: 'eager_load(:tags).where(...)',
		blocks: [
			{
				label: 'SELECT products LEFT JOIN tags WHERE active',
				color: 'green',
				wide: true,
			},
		],
		totalLabel: '1 query (JOIN)',
		result: 'works',
	},
	'no-eager-basic': {
		strategy: 'Product.all (no includes)',
		blocks: [{ label: 'SELECT products', color: 'amber' }],
		floodCount: 100,
		totalLabel: '101 queries!',
		result: 'fails',
	},
	'joins-mistake': {
		strategy: 'Product.joins(:user)',
		blocks: [{ label: 'SELECT products JOIN users', color: 'amber' }],
		floodCount: 100,
		totalLabel: '101 queries!',
		result: 'fails',
	},
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 24: Eager Loading', () => {
	// ── Discovery definitions ──

	describe('Discovery definitions', () => {
		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('requires all 4 discoveries (minRequired: 4)', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('all discoveries reachable via probes or lane clicks', () => {
			const reachable = new Set([
				...Object.values(PROBE_DISCOVERY_MAP),
				...Object.values(STAGE_DISCOVERY_MAP),
			]);
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	// ── Probes (observe phase) ──

	describe('Probes', () => {
		test('three probes exist', () => {
			expect(PROBES.length).toBe(3);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all probe labels are unique', () => {
			const labels = PROBES.map((p) => p.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every probe has response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('probe labels are short (no full paths)', () => {
			for (const probe of PROBES) {
				expect(probe.label.length).toBeLessThan(50);
				expect(probe.label).not.toContain('/');
			}
		});

		test('every probe maps to a valid discovery ID', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const probe of PROBES) {
				const discoveryId = PROBE_DISCOVERY_MAP[probe.id];
				expect(discoveryId).toBeTruthy();
				expect(validIds.has(discoveryId)).toBe(true);
			}
		});

		test('basic-users probe shows joins trap (101 queries)', () => {
			const probe = PROBES.find((p) => p.id === 'basic-users');
			expect(probe).toBeTruthy();
			const hasJoinsTrap = probe?.responseLines.some(
				(l) => l.text.includes('101 queries') && l.color === 'red',
			);
			expect(hasJoinsTrap).toBe(true);
		});

		test('nested-reviews probe shows nested N+1', () => {
			const probe = PROBES.find((p) => p.id === 'nested-reviews');
			expect(probe).toBeTruthy();
			const hasNestedN1 = probe?.responseLines.some((l) =>
				l.text.includes('N+1'),
			);
			expect(hasNestedN1).toBe(true);
		});

		test('filtered-assoc probe shows preload ERROR', () => {
			const probe = PROBES.find((p) => p.id === 'filtered-assoc');
			expect(probe).toBeTruthy();
			const hasError = probe?.responseLines.some(
				(l) => l.text.includes('ERROR') && l.color === 'red',
			);
			expect(hasError).toBe(true);
		});
	});

	// ── Build step quality ──

	describe('Build steps', () => {
		test('step definitions have unique IDs', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('3 total option steps', () => {
			expect(STEP_DEFS.length).toBe(3);
			expect(ALL_OPTION_STEPS.length).toBe(3);
		});

		for (const [idx, options] of ALL_OPTION_STEPS.entries()) {
			test(`step ${idx}: correct answer is not first`, () => {
				const correctIndex = options.findIndex((o) => o.correct);
				expect(correctIndex).toBeGreaterThan(0);
			});

			test(`step ${idx}: exactly one correct answer`, () => {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			});

			test(`step ${idx}: every wrong option has feedback`, () => {
				for (const option of options) {
					if (!option.correct) {
						expect(option.feedback).toBeTruthy();
					}
				}
			});

			test(`step ${idx}: feedback does not reveal the correct answer`, () => {
				const correct = options.find((o) => o.correct);
				for (const option of options) {
					if (!option.correct && option.feedback) {
						expect(option.feedback).not.toContain(correct?.label ?? '');
					}
				}
			});
		}

		test('step 0 correct answer uses includes(:user)', () => {
			const correct = OPTION_STEP_0.find((o) => o.correct);
			expect(correct?.label).toBe('Product.includes(:user)');
		});

		test('step 1 correct answer uses nested includes(reviews: :user)', () => {
			const correct = OPTION_STEP_1.find((o) => o.correct);
			expect(correct?.label).toBe('Product.includes(reviews: :user)');
		});

		test('step 2 correct answer uses includes for filtering (Rails auto-promotes to JOIN)', () => {
			const correct = OPTION_STEP_2.find((o) => o.correct);
			expect(correct?.label).toContain('includes');
			expect(correct?.label).toContain('where');
			expect(correct?.label).not.toContain('eager_load');
		});
	});

	// ── Stress scenarios (reward phase) ──

	describe('Stress scenarios', () => {
		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('5 scenarios total', () => {
			expect(STRESS_SCENARIOS.length).toBe(5);
		});

		test('mix of allowed and blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(3);
			expect(blocked.length).toBe(2);
		});

		test('every scenario has a reward lane data entry', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(REWARD_LANE_DATA[scenario.id]).toBeTruthy();
			}
		});

		test('allowed scenarios have "works" result in reward data', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				expect(REWARD_LANE_DATA[scenario.id].result).toBe('works');
			}
		});

		test('blocked scenarios have "fails" result in reward data', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				expect(REWARD_LANE_DATA[scenario.id].result).toBe('fails');
			}
		});

		test('allowed reward lanes have green blocks', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const lane = REWARD_LANE_DATA[scenario.id];
				const hasGreen = lane.blocks.some((b) => b.color === 'green');
				expect(hasGreen).toBe(true);
			}
		});

		test('blocked reward lanes have floodCount (N+1 pattern)', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				const lane = REWARD_LANE_DATA[scenario.id];
				expect(lane.floodCount).toBeGreaterThan(0);
			}
		});

		test('blocked scenarios reference N+1 patterns (no includes or joins trap)', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			const actors = blocked.map((s) => s.actor);
			// One is "no includes", one is "joins" (common mistake)
			const hasNoIncludes = actors.some((a) => a.includes('no includes'));
			const hasJoins = actors.some((a) => a.includes('joins'));
			expect(hasNoIncludes).toBe(true);
			expect(hasJoins).toBe(true);
		});
	});

	// ── Cross-phase consistency ──

	describe('Cross-phase consistency', () => {
		test('observe probes cover all three scenarios (basic, nested, filtered)', () => {
			const probeIds = PROBES.map((p) => p.id);
			expect(probeIds).toContain('basic-users');
			expect(probeIds).toContain('nested-reviews');
			expect(probeIds).toContain('filtered-assoc');
		});

		test('reward scenarios cover all three fix strategies', () => {
			const strategies = Object.values(REWARD_LANE_DATA).map((d) => d.strategy);
			expect(strategies.some((s) => s.includes('includes(:user)'))).toBe(true);
			expect(
				strategies.some((s) => s.includes('includes(reviews: :user)')),
			).toBe(true);
			expect(strategies.some((s) => s.includes('eager_load'))).toBe(true);
		});

		test('observe and reward both cover /api/v1/ endpoints', () => {
			// Observe probes reference Product queries
			const probeCommands = PROBES.map((p) => p.command);
			expect(probeCommands.some((c) => c.includes('Product'))).toBe(true);

			// Reward scenarios all hit /api/v1/ endpoints with products
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.path).toContain('/api/v1/');
				expect(scenario.path).toContain('products');
			}
		});

		test('service pattern (ProductList) referenced consistently', () => {
			// Build steps describe ProductList service
			const step0 = ALL_OPTION_STEPS[0];
			// The correct answer for step 0 uses Product.includes(:user) which is what ProductList should call
			const correct0 = step0.find((o) => o.correct);
			expect(correct0?.label).toContain('Product.');

			// Reward lane strategies also reference Product/includes patterns
			expect(REWARD_LANE_DATA['basic-includes'].strategy).toContain('includes');
		});

		test('joins trap is taught in observe and tested in reward', () => {
			// Observe: joins-trap discovery via basic-users probe
			expect(PROBE_DISCOVERY_MAP['basic-users']).toBe('joins-trap');

			// Reward: joins-mistake scenario tests it
			const joinsMistake = STRESS_SCENARIOS.find(
				(s) => s.id === 'joins-mistake',
			);
			expect(joinsMistake).toBeTruthy();
			expect(joinsMistake?.expectedResult).toBe('blocked');
			expect(joinsMistake?.actor).toContain('joins');
		});
	});

	// ── Data consistency ──

	describe('Data consistency', () => {
		test('no em dashes in any text', () => {
			// Check probes
			for (const probe of PROBES) {
				expect(probe.label).not.toContain('\u2014');
				expect(probe.command).not.toContain('\u2014');
				for (const line of probe.responseLines) {
					expect(line.text).not.toContain('\u2014');
				}
			}
			// Check scenarios
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).not.toContain('\u2014');
				expect(scenario.description).not.toContain('\u2014');
			}
			// Check step options
			for (const options of ALL_OPTION_STEPS) {
				for (const option of options) {
					expect(option.label).not.toContain('\u2014');
					if (option.feedback) {
						expect(option.feedback).not.toContain('\u2014');
					}
				}
			}
		});

		test('discovery IDs match between defs and maps', () => {
			const defIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			const probeMapIds = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const stageMapIds = new Set(Object.values(STAGE_DISCOVERY_MAP));
			const allMappedIds = new Set([...probeMapIds, ...stageMapIds]);

			// Every mapped ID should be in the defs
			for (const id of allMappedIds) {
				expect(defIds.has(id)).toBe(true);
			}
			// Every def ID should be reachable
			for (const id of defIds) {
				expect(allMappedIds.has(id)).toBe(true);
			}
		});

		test('reward lane data keys match stress scenario IDs', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			const laneKeys = new Set(Object.keys(REWARD_LANE_DATA));
			expect(scenarioIds.size).toBe(laneKeys.size);
			for (const id of scenarioIds) {
				expect(laneKeys.has(id)).toBe(true);
			}
		});

		test('all reward lane blocks have valid colors', () => {
			const validColors = new Set(['green', 'amber', 'red']);
			for (const lane of Object.values(REWARD_LANE_DATA)) {
				for (const block of lane.blocks) {
					expect(validColors.has(block.color)).toBe(true);
				}
			}
		});
	});
});

/**
 * Tests for Level 27: Counter Caches
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

interface TerminalCommand {
	id: string;
	label: string;
	command: string;
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
	responseLines?: { text: string; color?: string }[];
}

interface StepDef {
	id: string;
	title: string;
}

// ──────────────────────────────────────────────
// Data (mirrored from component)
// ──────────────────────────────────────────────

const OBSERVE_POST_COUNT = 20;

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'n-plus-one-counts',
		label: 'Each post fires a separate COUNT(*) to the reviews table',
	},
];

const PROBES: ProbeConfig[] = [
	{
		id: 'load-posts',
		label: 'GET /api/posts',
		command: 'GET /api/posts?limit=20',
		responseLines: [
			{
				text: 'Product Load (1.2ms)  SELECT "products".* FROM "products" LIMIT 20',
				color: 'green',
			},
			{
				text: '  Loading review counts for 20 posts...',
				color: 'muted',
			},
			{
				text: '  (0.4ms)  SELECT COUNT(*) FROM "reviews" WHERE "product_id" = 1',
				color: 'red',
			},
			{
				text: '  (0.3ms)  SELECT COUNT(*) FROM "reviews" WHERE "product_id" = 2',
				color: 'red',
			},
			{
				text: '  ... 18 more COUNT(*) queries',
				color: 'red',
			},
			{
				text: '  Total: 21 queries for 20 posts',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'load-posts': ['n-plus-one-counts'],
};

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-migration', title: 'Generate the Migration' },
	{ id: 'run-migration', title: 'Run the Migration' },
	{ id: 'add-counter-cache', title: 'Enable counter_cache' },
	{ id: 'reset-counters', title: 'Reset Existing Counters' },
	{ id: 'update-serializer', title: 'Use the Cached Count' },
];

const MIGRATION_COMMANDS: TerminalCommand[] = [
	{
		id: 'add-column-raw',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: false,
		feedback:
			'There is no migration to run yet. You need to generate one first that adds the counter column.',
	},
	{
		id: 'generate-migration',
		label:
			'rails generate migration AddReviewsCountToPosts reviews_count:integer',
		command:
			'rails generate migration AddReviewsCountToPosts reviews_count:integer',
		correct: true,
	},
	{
		id: 'add-index',
		label: 'rails generate migration AddIndexToReviews product_id:index',
		command: 'rails generate migration AddIndexToReviews product_id:index',
		correct: false,
		feedback:
			'An index on reviews.product_id helps query speed, but it does not eliminate the N+1 COUNT queries. You need a column on the parent table.',
	},
];

const RUN_MIGRATION_COMMANDS: TerminalCommand[] = [
	{
		id: 'generate-again',
		label: 'rails generate migration AddReviewsCountToPosts',
		command: 'rails generate migration AddReviewsCountToPosts',
		correct: false,
		feedback:
			'The migration file already exists. You need to apply it to the database.',
	},
	{
		id: 'run-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'db-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'This recreates the entire database from schema.rb. You just need to run the pending migration.',
	},
];

const COUNTER_CACHE_OPTIONS: StepOption[] = [
	{
		id: 'has-many-counter',
		label: 'has_many :reviews, counter_cache: true',
		correct: false,
		feedback:
			'counter_cache is declared on the belongs_to side, not has_many. The child model owns the relationship declaration.',
	},
	{
		id: 'after-create',
		label: 'after_create { Product.increment_counter(:reviews_count, product_id) }',
		correct: false,
		feedback:
			'Manual callbacks are error-prone. You would also need after_destroy, after_update, and handle edge cases. Rails provides a built-in option.',
	},
	{
		id: 'belongs-to-counter',
		label: 'belongs_to :product, counter_cache: true',
		correct: true,
	},
];

const RESET_OPTIONS: StepOption[] = [
	{
		id: 'update-all',
		label: 'Product.update_all(reviews_count: Product.joins(:reviews).count)',
		correct: false,
		feedback:
			'This sets every product to the same total count, not each product to its own count. Rails provides a method that recalculates per-record.',
	},
	{
		id: 'manual-each',
		label: 'Product.find_each { |p| p.update(reviews_count: p.reviews.count) }',
		correct: false,
		feedback:
			'This works but fires N+1 queries and skips the counter cache mechanism. Rails has a dedicated method that uses efficient SQL.',
	},
	{
		id: 'reset-counters',
		label: 'Product.find_each { |p| Product.reset_counters(p.id, :reviews) }',
		correct: true,
	},
];

const SERIALIZER_OPTIONS: StepOption[] = [
	{
		id: 'reviews-count-method',
		label: 'product.reviews.count',
		correct: false,
		feedback:
			'This always runs a COUNT(*) query, completely bypassing the counter cache column you just added.',
	},
	{
		id: 'reviews-length',
		label: 'product.reviews.length',
		correct: false,
		feedback:
			'This loads ALL review records into memory just to count them. Even worse than COUNT(*) for large collections.',
	},
	{
		id: 'reviews-size',
		label: 'product.reviews.size',
		correct: true,
	},
];

const ALL_OPTION_STEPS: StepOption[][] = [
	COUNTER_CACHE_OPTIONS,
	RESET_OPTIONS,
	SERIALIZER_OPTIONS,
];

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'ten-posts',
		label: '10 posts index',
		description: 'Small page load with counter cache',
		method: 'GET',
		path: '/api/posts?limit=10',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (1.2ms)  SELECT "products".* FROM "products" LIMIT 10',
				color: 'yellow',
			},
			{
				text: '  reviews_count read from column (0 queries)',
				color: 'green',
			},
			{ text: '  Total: 1 query (was 11)', color: 'green' },
		],
	},
	{
		id: 'fifty-posts',
		label: '50 posts index',
		description: 'Medium listing with counter cache',
		method: 'GET',
		path: '/api/posts?limit=50',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (1.8ms)  SELECT "products".* FROM "products" LIMIT 50',
				color: 'yellow',
			},
			{
				text: '  reviews_count read from column (0 queries)',
				color: 'green',
			},
			{ text: '  Total: 1 query (was 51)', color: 'green' },
		],
	},
	{
		id: 'hundred-posts',
		label: '100 posts index',
		description: 'Full page with counter cache',
		method: 'GET',
		path: '/api/posts?limit=100',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (2.4ms)  SELECT "products".* FROM "products" LIMIT 100',
				color: 'yellow',
			},
			{
				text: '  reviews_count read from column (0 queries)',
				color: 'green',
			},
			{ text: '  Total: 1 query (was 101)', color: 'green' },
		],
	},
	{
		id: 'five-hundred-posts',
		label: '500 posts export',
		description: 'Admin export with counter cache',
		method: 'GET',
		path: '/api/posts?limit=500',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (5.1ms)  SELECT "products".* FROM "products" LIMIT 500',
				color: 'yellow',
			},
			{
				text: '  reviews_count read from column (0 queries)',
				color: 'green',
			},
			{ text: '  Total: 1 query (was 501)', color: 'green' },
		],
	},
	{
		id: 'force-count',
		label: '.count bypasses cache',
		description: 'Serializer still using .count instead of .size',
		method: 'GET',
		path: '/api/posts?limit=100&method=count',
		actor: 'client',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'Product Load (2.4ms)  SELECT "products".* FROM "products" LIMIT 100',
				color: 'yellow',
			},
			{
				text: '  product.reviews.count -> 100 COUNT(*) queries!',
				color: 'red',
			},
			{
				text: '  .count ALWAYS runs SQL, ignoring the cached column',
				color: 'red',
			},
			{
				text: '  Total: 101 queries (counter cache wasted)',
				color: 'red',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 27: Counter Caches', () => {
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
	});

	// ── Probes (observe phase) ──

	describe('Probe (single observe probe)', () => {
		const probe = PROBES[0];

		test('single probe exists', () => {
			expect(PROBES.length).toBe(1);
			expect(probe.id).toBe('load-posts');
		});

		test('probe has 6 response lines with correct colors', () => {
			expect(probe.responseLines.length).toBe(6);
			expect(probe.responseLines[0].color).toBe('green');
			expect(probe.responseLines[1].color).toBe('muted');
			expect(probe.responseLines[2].color).toBe('red');
			expect(probe.responseLines[3].color).toBe('red');
			expect(probe.responseLines[4].color).toBe('red');
			expect(probe.responseLines[5].color).toBe('red');
		});

		test('probe maps to valid discovery ID', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			const discoveryIds = PROBE_DISCOVERY_MAP[probe.id];
			expect(discoveryIds).toBeTruthy();
			for (const did of discoveryIds) {
				expect(validIds.has(did)).toBe(true);
			}
		});

		test('all discoveries are reachable via probe', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});

		test('first response line is the SELECT query (green)', () => {
			const first = probe.responseLines[0];
			expect(first.color).toBe('green');
			expect(first.text).toContain('SELECT');
			expect(first.text).toContain(`LIMIT ${OBSERVE_POST_COUNT}`);
		});

		test('response lines show COUNT(*) sample queries (red)', () => {
			const countLines = probe.responseLines.filter(
				(l) => l.text.includes('COUNT(*)') && l.color === 'red',
			);
			expect(countLines.length).toBeGreaterThanOrEqual(2);
		});

		test('ellipsis line shows remaining COUNT query count', () => {
			const ellipsisLine = probe.responseLines[4];
			expect(ellipsisLine.text).toContain('more COUNT(*)');
			expect(ellipsisLine.text).toContain(`${OBSERVE_POST_COUNT - 2}`);
		});

		test('last response line shows total query count (N+1)', () => {
			const last = probe.responseLines[probe.responseLines.length - 1];
			expect(last.color).toBe('red');
			expect(last.text).toContain('Total:');
			expect(last.text).toContain(
				`${OBSERVE_POST_COUNT + 1} queries for ${OBSERVE_POST_COUNT} posts`,
			);
		});
	});

	// ── Build step quality ──

	describe('Build steps', () => {
		test('step definitions have unique IDs', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('terminal step: correct answer is not first', () => {
			const correctIndex = MIGRATION_COMMANDS.findIndex((c) => c.correct);
			expect(correctIndex).toBeGreaterThan(0);
		});

		test('terminal step: exactly one correct answer', () => {
			const correctCount = MIGRATION_COMMANDS.filter((c) => c.correct).length;
			expect(correctCount).toBe(1);
		});

		test('terminal step: every wrong option has feedback', () => {
			for (const cmd of MIGRATION_COMMANDS) {
				if (!cmd.correct) {
					expect(cmd.feedback).toBeTruthy();
				}
			}
		});

		test('terminal step 0: feedback does not reveal the answer', () => {
			const correctCommand = MIGRATION_COMMANDS.find((c) => c.correct);
			for (const cmd of MIGRATION_COMMANDS) {
				if (!cmd.correct && cmd.feedback) {
					expect(cmd.feedback).not.toContain(correctCommand?.command ?? '');
					expect(cmd.feedback).not.toContain('AddReviewsCountToPosts');
				}
			}
		});

		test('terminal step 1 (run migration): correct answer is not first', () => {
			const correctIndex = RUN_MIGRATION_COMMANDS.findIndex((c) => c.correct);
			expect(correctIndex).toBeGreaterThan(0);
		});

		test('terminal step 1 (run migration): exactly one correct answer', () => {
			const correctCount = RUN_MIGRATION_COMMANDS.filter(
				(c) => c.correct,
			).length;
			expect(correctCount).toBe(1);
		});

		test('terminal step 1 (run migration): every wrong option has feedback', () => {
			for (const cmd of RUN_MIGRATION_COMMANDS) {
				if (!cmd.correct) {
					expect(cmd.feedback).toBeTruthy();
				}
			}
		});

		test('terminal step 1 (run migration): feedback does not reveal the answer', () => {
			const correctCommand = RUN_MIGRATION_COMMANDS.find((c) => c.correct);
			for (const cmd of RUN_MIGRATION_COMMANDS) {
				if (!cmd.correct && cmd.feedback) {
					expect(cmd.feedback).not.toContain(correctCommand?.command ?? '');
				}
			}
		});

		for (const [idx, options] of ALL_OPTION_STEPS.entries()) {
			const stepNum = idx + 2;

			test(`step ${stepNum}: correct answer is not first`, () => {
				const correctIndex = options.findIndex((o) => o.correct);
				expect(correctIndex).toBeGreaterThan(0);
			});

			test(`step ${stepNum}: exactly one correct answer`, () => {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			});

			test(`step ${stepNum}: every wrong option has feedback`, () => {
				for (const option of options) {
					if (!option.correct) {
						expect(option.feedback).toBeTruthy();
					}
				}
			});

			test(`step ${stepNum}: feedback does not reveal the correct answer`, () => {
				const correct = options.find((o) => o.correct);
				for (const option of options) {
					if (!option.correct && option.feedback) {
						expect(option.feedback).not.toContain(correct?.label ?? '');
					}
				}
			});
		}
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

		test('mix of allowed and blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('every scenario has response lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines).toBeTruthy();
				expect(scenario.responseLines?.length).toBeGreaterThan(0);
			}
		});

		test('allowed scenarios have green response lines', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const hasGreen = scenario.responseLines?.some(
					(l) => l.color === 'green',
				);
				expect(hasGreen).toBe(true);
			}
		});

		test('blocked scenarios have red response lines', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				const hasRed = scenario.responseLines?.some((l) => l.color === 'red');
				expect(hasRed).toBe(true);
			}
		});

		test('first response line of each scenario is the SQL query (yellow)', () => {
			for (const scenario of STRESS_SCENARIOS) {
				const firstLine = scenario.responseLines?.[0];
				expect(firstLine?.color).toBe('yellow');
				expect(firstLine?.text).toContain('SELECT');
			}
		});
	});

	// ── Cross-phase consistency ──

	describe('Cross-phase consistency', () => {
		test('reward scenarios cover a range of post counts', () => {
			const scenarioLimits = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			).map((s) => {
				const match = s.path.match(/limit=(\d+)/);
				return match ? Number.parseInt(match[1], 10) : 0;
			});
			// Reward should have varied post counts
			expect(new Set(scenarioLimits).size).toBeGreaterThanOrEqual(2);
		});

		test('reward response lines tell opposite story from observe', () => {
			// Observe: N+1 COUNT queries. Reward (allowed): 1 query, 0 counts
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult === 'allowed') {
					const hasZeroQueries = scenario.responseLines?.some((l) =>
						l.text.includes('0 queries'),
					);
					const hasTotalOne = scenario.responseLines?.some((l) =>
						l.text.includes('1 query'),
					);
					expect(hasZeroQueries).toBe(true);
					expect(hasTotalOne).toBe(true);
				}
			}
		});

		test('blocked scenario shows N+1 pattern returning', () => {
			const blocked = STRESS_SCENARIOS.find(
				(s) => s.expectedResult === 'blocked',
			);
			expect(blocked).toBeTruthy();
			const hasCountQuery = blocked?.responseLines?.some((l) =>
				l.text.includes('COUNT(*)'),
			);
			expect(hasCountQuery).toBe(true);
		});

		test('reward "was N" numbers match observe query counts', () => {
			// Each allowed scenario says "was X" where X = limit + 1
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult === 'allowed') {
					const limitMatch = scenario.path.match(/limit=(\d+)/);
					if (limitMatch) {
						const limit = Number.parseInt(limitMatch[1], 10);
						const wasLine = scenario.responseLines?.find((l) =>
							l.text.includes('was'),
						);
						expect(wasLine).toBeTruthy();
						expect(wasLine?.text).toContain(`was ${limit + 1}`);
					}
				}
			}
		});
	});

	// ── Data consistency ──

	describe('Data consistency', () => {
		test('probe query count formula: total = OBSERVE_POST_COUNT + 1', () => {
			const totalLine = PROBES[0].responseLines.find((l) =>
				l.text.includes('Total:'),
			);
			expect(totalLine).toBeTruthy();
			expect(totalLine?.color).toBe('red');
			expect(totalLine?.text).toContain(`${OBSERVE_POST_COUNT + 1} queries`);
		});

		test('stress scenario paths contain valid limit values', () => {
			for (const scenario of STRESS_SCENARIOS) {
				const match = scenario.path.match(/limit=(\d+)/);
				expect(match).toBeTruthy();
				const limit = Number.parseInt(match?.[1] ?? '0', 10);
				expect(limit).toBeGreaterThan(0);
			}
		});

		test('blocked scenario uses .count method reference', () => {
			const blocked = STRESS_SCENARIOS.find(
				(s) => s.expectedResult === 'blocked',
			);
			expect(blocked?.label).toContain('.count');
			expect(
				blocked?.responseLines?.some((l) => l.text.includes('.count')),
			).toBe(true);
		});

		test('SQL in response lines matches the limit in path', () => {
			for (const scenario of STRESS_SCENARIOS) {
				const limitMatch = scenario.path.match(/limit=(\d+)/);
				if (limitMatch) {
					const limit = limitMatch[1];
					const sqlLine = scenario.responseLines?.find((l) =>
						l.text.includes('SELECT'),
					);
					expect(sqlLine?.text).toContain(`LIMIT ${limit}`);
				}
			}
		});
	});
});

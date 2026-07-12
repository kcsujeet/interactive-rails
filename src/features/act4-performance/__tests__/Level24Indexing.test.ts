/**
 * Tests for Level 26: Database Indexing
 *
 * Validates data consistency across phases, reward scenario correctness,
 * and visualization data integrity.
 */

import { describe, expect, test } from 'bun:test';

// ──────────────────────────────────────────────
// Types (mirrored from component)
// ──────────────────────────────────────────────

interface ScanResult {
	scanType: 'seq' | 'index';
	plan: string;
	time: string;
	rowsScanned: number;
	totalRows: number;
	rowsRemoved?: number;
	expected?: boolean;
	sortKey?: string;
}

interface QueryLane {
	id: string;
	label: string;
	table: string;
	sql: string;
	totalRows: number;
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

interface RewardScanData extends ScanResult {
	laneId: string;
	sqlOverride?: string;
	labelOverride?: string;
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

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

// ──────────────────────────────────────────────
// Data (mirrored from component)
// ──────────────────────────────────────────────

const QUERY_LANES: QueryLane[] = [
	{
		id: 'email',
		label: 'Email Lookup',
		table: 'users',
		sql: "SELECT * FROM users WHERE email = 'alice@example.com'",
		totalRows: 10000,
	},
	{
		id: 'fk',
		label: 'Foreign Key Lookup',
		table: 'products',
		sql: 'SELECT * FROM products WHERE user_id = 42',
		totalRows: 50000,
	},
	{
		id: 'composite',
		label: 'Composite Query',
		table: 'products',
		sql: 'SELECT * FROM products WHERE published = true ORDER BY created_at',
		totalRows: 50000,
	},
];

const GRID_SIZE = 100;

const GRID_MATCHES: Record<string, number[]> = {
	email: [73],
	fk: [12, 37, 54, 71, 89],
	composite: Array.from({ length: 50 }, (_, i) => i * 2),
};

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'email-lookup',
		label: 'Find user by email',
		description: 'Unique index lookup on users.email',
		method: 'GET',
		path: '/api/users?email=alice@example.com',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_users_on_email on users',
				color: 'green',
			},
			{
				text: "  Index Cond: (email = 'alice@example.com')",
				color: 'yellow',
			},
			{ text: '  Rows Scanned: 1 of 10,000', color: 'green' },
			{ text: '  Execution Time: 0.05 ms (was 820ms)', color: 'green' },
		],
	},
	{
		id: 'fk-lookup',
		label: 'Load user products',
		description: 'B-tree index on products.user_id',
		method: 'GET',
		path: '/api/users/42/products',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_products_on_user_id on products',
				color: 'green',
			},
			{ text: '  Index Cond: (user_id = 42)', color: 'yellow' },
			{ text: '  Rows Scanned: 25 of 50,000', color: 'green' },
			{ text: '  Execution Time: 0.10 ms (was 450ms)', color: 'green' },
		],
	},
	{
		id: 'composite-query',
		label: 'Published products sorted',
		description: 'Composite index on [published, created_at]',
		method: 'GET',
		path: '/api/products?published=true&sort=created_at',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Index Scan using index_products_on_published_created_at on products',
				color: 'green',
			},
			{
				text: '  Index Cond: (published = true)',
				color: 'yellow',
			},
			{ text: '  Rows Scanned: 25,000 of 50,000', color: 'green' },
			{ text: '  Execution Time: 0.20 ms (was 650ms)', color: 'green' },
		],
	},
	{
		id: 'created-at-only',
		label: 'Products by date only',
		description: 'Leftmost prefix violation',
		method: 'GET',
		path: '/api/products?sort=created_at',
		actor: 'client',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'Seq Scan on products  (cost=0.00..1125.00)',
				color: 'red',
			},
			{
				text: '  Sort Key: created_at (no covering index)',
				color: 'yellow',
			},
			{
				text: '  Index on [published, created_at] skipped: leftmost column not in query',
				color: 'red',
			},
			{ text: '  Execution Time: 650.00 ms (still slow!)', color: 'red' },
		],
	},
	{
		id: 'admin-all-users',
		label: 'Admin: list all users',
		description: 'Full table scan, no WHERE clause to index',
		method: 'GET',
		path: '/api/admin/users',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Seq Scan on users  (cost=0.00..245.00)',
				color: 'yellow',
			},
			{
				text: '  No WHERE clause: index not applicable',
				color: 'yellow',
			},
			{
				text: '  Full scan expected (loading all rows is the goal)',
				color: 'green',
			},
			{
				text: '  Execution Time: 12.00 ms (acceptable for admin)',
				color: 'green',
			},
		],
	},
];

const REWARD_SCAN_DATA: Record<string, RewardScanData> = {
	'email-lookup': {
		laneId: 'email',
		scanType: 'index',
		plan: 'Index Scan using index_users_on_email',
		time: '0.05ms',
		rowsScanned: 1,
		totalRows: 10000,
	},
	'fk-lookup': {
		laneId: 'fk',
		scanType: 'index',
		plan: 'Index Scan using index_products_on_user_id',
		time: '0.10ms',
		rowsScanned: 25,
		totalRows: 50000,
	},
	'composite-query': {
		laneId: 'composite',
		scanType: 'index',
		plan: 'Index Scan using index_products_on_published_and_created_at',
		time: '0.20ms',
		rowsScanned: 25000,
		totalRows: 50000,
	},
	'created-at-only': {
		laneId: 'composite',
		scanType: 'seq',
		plan: 'Seq Scan on products (leftmost prefix violation)',
		time: '650ms',
		rowsScanned: 50000,
		totalRows: 50000,
	},
	'admin-all-users': {
		laneId: 'email',
		scanType: 'seq',
		plan: 'Seq Scan on users (no WHERE clause, expected)',
		time: '12ms',
		rowsScanned: 10000,
		totalRows: 10000,
		expected: true,
		sqlOverride: 'SELECT * FROM users',
		labelOverride: 'Admin: All Users',
	},
};

const OBSERVE_SCAN_DATA: Record<string, ScanResult> = {
	email: {
		scanType: 'seq',
		plan: 'Seq Scan on users',
		time: '820ms',
		rowsScanned: 10000,
		totalRows: 10000,
		rowsRemoved: 9999,
	},
	fk: {
		scanType: 'seq',
		plan: 'Seq Scan on products',
		time: '450ms',
		rowsScanned: 50000,
		totalRows: 50000,
		rowsRemoved: 49975,
	},
	composite: {
		scanType: 'seq',
		plan: 'Sort + Seq Scan on products',
		time: '650ms',
		rowsScanned: 50000,
		totalRows: 50000,
		sortKey: 'created_at',
	},
};

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'query-email': 'seq-scan-email',
	'query-fk': 'seq-scan-fk',
	'query-composite': 'seq-scan-composite',
};

const PROBE_LANE_MAP: Record<string, string> = {
	'query-email': 'email',
	'query-fk': 'fk',
	'query-composite': 'composite',
};

// Build step options
const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Unique Index on Email',
		description:
			'User.find_by(email: ...) triggers a Seq Scan across 10,000 rows.',
		options: [
			{
				id: 'wrong-plain',
				label: 'add_index :users, :email',
				correct: false,
				feedback:
					'A plain index speeds up lookups but does not enforce uniqueness at the database level.',
			},
			{
				id: 'correct',
				label: 'add_index :users, :email, unique: true',
				correct: true,
			},
			{
				id: 'wrong-column',
				label: 'add_index :users, :name, unique: true',
				correct: false,
				feedback:
					'The slow query filters by email, not name. Index the column that appears in the WHERE clause.',
			},
		],
	},
	2: {
		title: 'Foreign Key Index',
		description: 'Product.where(user_id: 42) scans all 50,000 products.',
		options: [
			{
				id: 'wrong-composite',
				label: 'add_index :products, [:user_id, :name]',
				correct: false,
				feedback: 'A composite index on user_id and name is overkill here.',
			},
			{
				id: 'correct',
				label: 'add_index :products, :user_id',
				correct: true,
			},
			{
				id: 'wrong-table',
				label: 'add_index :users, :id',
				correct: false,
				feedback: 'The primary key already has an index.',
			},
		],
	},
	3: {
		title: 'Composite Index',
		description:
			'Product.where(published: true).order(:created_at) does a sort on top of a Seq Scan.',
		options: [
			{
				id: 'wrong-order',
				label: 'add_index :products, [:created_at, :published]',
				correct: false,
				feedback:
					'Column order matters. Here the leftmost column matches the ORDER BY instead of the WHERE clause, so the filter cannot use the index prefix.',
			},
			{
				id: 'correct',
				label: 'add_index :products, [:published, :created_at]',
				correct: true,
			},
			{
				id: 'wrong-single',
				label: 'add_index :products, :created_at',
				correct: false,
				feedback:
					'A single-column index on created_at cannot cover the WHERE published = true filter.',
			},
		],
	},
};

const generateMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-schema',
		label: 'rails db:schema:dump',
		command: 'rails db:schema:dump',
		correct: false,
		feedback: 'That dumps the current schema to a file.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddIndexes',
		command: 'rails generate migration AddIndexes',
		correct: true,
	},
	{
		id: 'wrong-model',
		label: 'rails generate model Index',
		command: 'rails generate model Index',
		correct: false,
		feedback: 'An index is a database optimization, not an ActiveRecord model.',
	},
];

const runMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback: 'That recreates the database from scratch.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback: 'That loads seed data.',
	},
];

// Validation logic (from component)
function validateLevel26Solution(state: {
	stepsCompleted: boolean[];
}): ValidationResult {
	const stepTitles = [
		'Generate Migration',
		'Unique Index on Email',
		'Foreign Key Index',
		'Composite Index',
		'Run Migration',
	];
	const incomplete = state.stepsCompleted
		.map((done, i) => (done ? null : stepTitles[i]))
		.filter(Boolean) as string[];

	if (incomplete.length > 0) {
		return {
			valid: false,
			message: 'Complete all steps first',
			details: incomplete,
		};
	}
	return { valid: true, message: 'Database indexes are deployed!' };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 26: Database Indexing', () => {
	describe('Validation', () => {
		test('should be invalid when no steps completed', () => {
			const result = validateLevel26Solution({
				stepsCompleted: [false, false, false, false, false],
			});
			expect(result.valid).toBe(false);
			expect(result.details).toHaveLength(5);
		});

		test('should be invalid with partial completion', () => {
			const result = validateLevel26Solution({
				stepsCompleted: [true, true, false, false, false],
			});
			expect(result.valid).toBe(false);
			expect(result.details).toHaveLength(3);
		});

		test('should be valid when all steps completed', () => {
			const result = validateLevel26Solution({
				stepsCompleted: [true, true, true, true, true],
			});
			expect(result.valid).toBe(true);
			expect(result.message).toContain('indexes are deployed');
		});
	});

	describe('Reward Scenario Data Consistency', () => {
		test('every stress scenario has a matching reward scan entry', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(REWARD_SCAN_DATA[scenario.id]).toBeDefined();
			}
		});

		test('every reward scan maps to a valid lane', () => {
			const laneIds = new Set(QUERY_LANES.map((l) => l.id));
			for (const [_scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				expect(laneIds.has(data.laneId)).toBe(true);
			}
		});

		test('reward scan SQL must not contradict the lane SQL', () => {
			for (const [_scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				const lane = QUERY_LANES.find((l) => l.id === data.laneId);
				if (!lane) throw new Error(`unknown laneId: ${data.laneId}`);
				// The SQL shown to the player is sqlOverride if present, else lane.sql
				const displayedSql = data.sqlOverride ?? lane.sql;

				// If the plan says "no WHERE clause", the displayed SQL must not have WHERE
				if (data.plan.includes('no WHERE clause')) {
					expect(displayedSql.toUpperCase()).not.toContain('WHERE');
				}

				// If the displayed SQL has a WHERE clause, the plan should not say "no WHERE clause"
				if (displayedSql.toUpperCase().includes('WHERE')) {
					expect(data.plan).not.toContain('no WHERE clause');
				}
			}
		});

		test('expected seq scans must have sqlOverride when lane SQL has WHERE', () => {
			for (const [_scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				if (!data.expected) continue;
				const lane = QUERY_LANES.find((l) => l.id === data.laneId);
				if (!lane) throw new Error(`unknown laneId: ${data.laneId}`);

				// If the lane SQL has WHERE but the scenario is "expected" (no WHERE clause),
				// there MUST be a sqlOverride to avoid contradiction
				if (lane.sql.toUpperCase().includes('WHERE')) {
					expect(data.sqlOverride).toBeDefined();
					expect(data.sqlOverride?.toUpperCase()).not.toContain('WHERE');
				}
			}
		});

		test('expected seq scans should have labelOverride when lane label mismatches', () => {
			for (const [scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				if (!data.expected) continue;
				const _lane = QUERY_LANES.find((l) => l.id === data.laneId);
				const _scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);

				// If the scenario is about a different query type (e.g., admin list all)
				// the lane label ("Email Lookup") would be misleading without an override
				if (data.sqlOverride) {
					expect(data.labelOverride).toBeDefined();
				}
			}
		});

		test('allowed scenarios with index scans should have fewer rows than total', () => {
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult !== 'allowed') continue;
				const data = REWARD_SCAN_DATA[scenario.id];
				if (data.scanType === 'index') {
					expect(data.rowsScanned).toBeLessThan(data.totalRows);
				}
			}
		});

		test('blocked scenarios should use seq scan', () => {
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult !== 'blocked') continue;
				const data = REWARD_SCAN_DATA[scenario.id];
				expect(data.scanType).toBe('seq');
			}
		});

		test('expected seq scans should only be on allowed scenarios', () => {
			for (const [scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				if (!data.expected) continue;
				const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
				if (!scenario) throw new Error(`unknown scenarioId: ${scenarioId}`);
				expect(scenario.expectedResult).toBe('allowed');
			}
		});
	});

	describe('Stress Scenario Response Lines', () => {
		test('every stress scenario has response lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines).toBeDefined();
				expect(scenario.responseLines?.length).toBeGreaterThan(0);
			}
		});

		test('allowed index scan scenarios have green response lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult !== 'allowed') continue;
				const data = REWARD_SCAN_DATA[scenario.id];
				if (data.scanType !== 'index') continue;
				const hasGreen = scenario.responseLines?.some(
					(l) => l.color === 'green',
				);
				expect(hasGreen).toBe(true);
			}
		});

		test('blocked scenarios have red response lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				if (scenario.expectedResult !== 'blocked') continue;
				const hasRed = scenario.responseLines?.some((l) => l.color === 'red');
				expect(hasRed).toBe(true);
			}
		});
	});

	describe('Grid Matches', () => {
		test('every lane has grid match positions', () => {
			for (const lane of QUERY_LANES) {
				expect(GRID_MATCHES[lane.id]).toBeDefined();
				expect(GRID_MATCHES[lane.id].length).toBeGreaterThan(0);
			}
		});

		test('all match positions are within grid bounds', () => {
			for (const [_laneId, matches] of Object.entries(GRID_MATCHES)) {
				for (const pos of matches) {
					expect(pos).toBeGreaterThanOrEqual(0);
					expect(pos).toBeLessThan(GRID_SIZE);
				}
			}
		});

		test('email lane has exactly 1 match (unique index)', () => {
			expect(GRID_MATCHES.email).toHaveLength(1);
		});

		test('fk lane has multiple scattered matches', () => {
			expect(GRID_MATCHES.fk.length).toBeGreaterThan(1);
		});

		test('composite lane has ~50% matches (published products)', () => {
			expect(GRID_MATCHES.composite.length).toBe(50);
		});
	});

	describe('Observe Phase Data', () => {
		test('every lane has observe scan data', () => {
			for (const lane of QUERY_LANES) {
				expect(OBSERVE_SCAN_DATA[lane.id]).toBeDefined();
			}
		});

		test('all observe scans are seq scans (no indexes yet)', () => {
			for (const scan of Object.values(OBSERVE_SCAN_DATA)) {
				expect(scan.scanType).toBe('seq');
			}
		});

		test('observe scans read all rows (full table scan)', () => {
			for (const scan of Object.values(OBSERVE_SCAN_DATA)) {
				expect(scan.rowsScanned).toBe(scan.totalRows);
			}
		});

		test('every probe maps to a valid discovery', () => {
			const discoveryIds = new Set([
				'seq-scan-email',
				'seq-scan-fk',
				'seq-scan-composite',
				'no-indexes',
			]);
			for (const discoveryId of Object.values(PROBE_DISCOVERY_MAP)) {
				expect(discoveryIds.has(discoveryId)).toBe(true);
			}
		});

		test('every probe maps to a valid lane', () => {
			const laneIds = new Set(QUERY_LANES.map((l) => l.id));
			for (const laneId of Object.values(PROBE_LANE_MAP)) {
				expect(laneIds.has(laneId)).toBe(true);
			}
		});
	});

	describe('Build Step Quality', () => {
		test('correct terminal command is never the first option', () => {
			const allTerminalCommands = [
				generateMigrationCommands,
				runMigrationCommands,
			];
			for (const commands of allTerminalCommands) {
				expect(commands[0].correct).toBe(false);
			}
		});

		test('correct OptionCard answer is never the first option', () => {
			for (const config of Object.values(OPTION_STEP_CONFIG)) {
				expect(config.options[0].correct).toBe(false);
			}
		});

		test('every wrong option has feedback', () => {
			// Terminal commands
			for (const cmd of [
				...generateMigrationCommands,
				...runMigrationCommands,
			]) {
				if (!cmd.correct) {
					expect(cmd.feedback).toBeDefined();
					expect(cmd.feedback?.length).toBeGreaterThan(0);
				}
			}
			// Option cards
			for (const config of Object.values(OPTION_STEP_CONFIG)) {
				for (const opt of config.options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			// Check that wrong-option feedback does not contain the correct option text
			for (const config of Object.values(OPTION_STEP_CONFIG)) {
				const correctLabel = config.options.find((o) => o.correct)?.label;
				for (const opt of config.options) {
					if (!opt.correct && opt.feedback) {
						expect(opt.feedback).not.toContain(correctLabel);
					}
				}
			}
		});

		test('each step has exactly one correct answer', () => {
			for (const config of Object.values(OPTION_STEP_CONFIG)) {
				const correctCount = config.options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
			const genCorrect = generateMigrationCommands.filter(
				(c) => c.correct,
			).length;
			expect(genCorrect).toBe(1);
			const runCorrect = runMigrationCommands.filter((c) => c.correct).length;
			expect(runCorrect).toBe(1);
		});
	});

	describe('Cross-Phase Consistency', () => {
		test('observe and reward cover the same lanes', () => {
			const observeLanes = new Set(Object.keys(OBSERVE_SCAN_DATA));
			const rewardLanes = new Set(
				Object.values(REWARD_SCAN_DATA).map((d) => d.laneId),
			);
			// Every observe lane should have at least one reward scenario
			for (const laneId of observeLanes) {
				expect(rewardLanes.has(laneId)).toBe(true);
			}
		});

		test('observe seq scans become index scans in reward for allowed scenarios', () => {
			// For each allowed scenario that maps to an observed lane,
			// the reward should show improvement (index scan)
			const allowedIndexScenarios = STRESS_SCENARIOS.filter(
				(s) =>
					s.expectedResult === 'allowed' &&
					REWARD_SCAN_DATA[s.id].scanType === 'index',
			);
			expect(allowedIndexScenarios.length).toBeGreaterThan(0);

			for (const scenario of allowedIndexScenarios) {
				const reward = REWARD_SCAN_DATA[scenario.id];
				const observe = OBSERVE_SCAN_DATA[reward.laneId];
				// Observe was slow (seq), reward is fast (index)
				expect(observe.scanType).toBe('seq');
				expect(reward.scanType).toBe('index');
				expect(reward.rowsScanned).toBeLessThan(observe.rowsScanned);
			}
		});

		test('stress scenario labels match probe labels for overlapping endpoints', () => {
			// "Find user by email" probe label should match the stress scenario label
			const probeLabels: Record<string, string> = {
				'query-email': 'Find user by email',
				'query-fk': 'Load user products',
				'query-composite': 'Published products by date',
			};
			const scenarioLabels: Record<string, string> = {};
			for (const s of STRESS_SCENARIOS) {
				scenarioLabels[s.id] = s.label;
			}

			// Probe "Find user by email" -> Scenario "Find user by email"
			expect(scenarioLabels['email-lookup']).toBe(probeLabels['query-email']);
			expect(scenarioLabels['fk-lookup']).toBe(probeLabels['query-fk']);
		});
	});

	describe('Scenario Uniqueness', () => {
		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has a mix of allowed and blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});
	});
});

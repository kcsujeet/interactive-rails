import { describe, expect, test } from 'bun:test';

// ──────────────────────────────────────────────
// Mirrored data structures from Level25NarrowFetching.tsx
// (independent copy for snapshot testing)
// ──────────────────────────────────────────────

// Discovery definitions
const DISCOVERY_DEFS = [
	{ id: 'select-star', label: 'SELECT * loads all 30 columns' },
	{ id: 'ar-overhead', label: 'Full AR objects waste memory' },
	{ id: 'batch-missing', label: 'Loading all records exhausts memory' },
	{ id: 'text-column', label: 'Large TEXT columns dominate footprint' },
];

// Probe configurations
const PROBES = [
	{
		id: 'csv-export',
		label: 'CSV Export',
		command: 'GET /api/v1/users/export.csv (as admin)',
		responseLines: [
			{ text: 'SELECT * FROM users;', color: 'yellow' },
			{ text: '-- 30 columns loaded, only 2 needed (id, email)', color: 'red' },
			{ text: '-- big_text_column: 75 KB per row', color: 'red' },
			{ text: 'Memory: 681 MB for 10K rows', color: 'red' },
			{ text: 'Needed: 2.35 MB (id + email only)', color: 'green' },
		],
	},
	{
		id: 'dropdown-api',
		label: 'Dropdown',
		command: 'GET /api/v1/categories/options (as frontend)',
		responseLines: [
			{ text: 'categories = Category.all', color: 'yellow' },
			{ text: 'categories.map { |c| [c.id, c.name] }', color: 'yellow' },
			{ text: '-- 10K ActiveRecord objects instantiated', color: 'red' },
			{ text: '-- Each object: 2.5 KB overhead for 2 values', color: 'red' },
			{ text: 'Plain arrays would use 80 bytes each', color: 'green' },
		],
	},
	{
		id: 'nightly-sync',
		label: 'Nightly Sync',
		command: 'rails runner NightlySyncJob.perform (as scheduler)',
		responseLines: [
			{ text: 'User.all.each { |u| SyncService.process(u) }', color: 'yellow' },
			{ text: '-- Loading 50K records into memory at once', color: 'red' },
			{ text: '-- Peak memory: 3.4 GB', color: 'red' },
			{ text: '-- Server swap triggered, OOM killer invoked', color: 'red' },
			{ text: 'Batching 1K at a time: ~50 MB constant', color: 'green' },
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'csv-export': 'select-star',
	'dropdown-api': 'ar-overhead',
	'nightly-sync': 'batch-missing',
};

// Stage inspector discovery (text-column via big_text_column click)
const STAGE_DISCOVERY_ID = 'text-column';
const _STAGE_ID = 'big_text_column';

// Step definitions (4 OptionCard steps)
const STEP_DEFS = [
	{ id: 'csv-export', title: 'CSV Export Strategy' },
	{ id: 'dropdown', title: 'Dropdown Data' },
	{ id: 'batch', title: 'Batch Processing' },
	{ id: 'api-response', title: 'API Response Building' },
];

// OptionCard step data
const csvExportOptions = [
	{
		id: 'map-all',
		label: 'User.all.map { |u| [u.id, u.email] }',
		correct: false,
		feedback:
			'This loads full ActiveRecord objects with all 30 columns including the 75KB bio field. Massive memory waste when you only need two columns.',
	},
	{
		id: 'pluck',
		label: 'User.pluck(:id, :email)',
		correct: true,
	},
	{
		id: 'select-two',
		label: 'User.select(:id, :email)',
		correct: false,
		feedback:
			'This creates ActiveRecord objects when you only need raw data for a CSV. For simple values without model methods, there is a lighter approach that skips object creation entirely.',
	},
];

const dropdownOptions = [
	{
		id: 'all',
		label: 'Category.all',
		correct: false,
		feedback:
			'Loading full ActiveRecord objects for a simple dropdown is wasteful. You instantiate AR overhead for each of 10K records when you only need two plain values.',
	},
	{
		id: 'select',
		label: 'Category.select(:id, :name)',
		correct: false,
		feedback:
			'This creates ActiveRecord objects when you only need plain data. For simple key-value pairs without model methods, there is a lighter approach.',
	},
	{
		id: 'pluck',
		label: 'Category.pluck(:id, :name)',
		correct: true,
	},
];

const batchOptions = [
	{
		id: 'all-each',
		label: 'User.all.each { |u| process(u) }',
		correct: false,
		feedback:
			'This loads ALL 50K records into memory at once. With large datasets this will exhaust memory and crash the process.',
	},
	{
		id: 'find-in-batches',
		label:
			'User.find_in_batches(batch_size: 1000) { |batch| batch.each { |u| process(u) } }',
		correct: true,
	},
	{
		id: 'pluck-find',
		label: 'User.pluck(:id).each { |id| process(User.find(id)) }',
		correct: false,
		feedback:
			'This plucks all IDs then does an individual database query for each one, a classic N+1 problem that makes 50K extra queries.',
	},
];

const apiResponseOptions = [
	{
		id: 'pluck-manual',
		label: 'User.pluck(:first_name, :last_name).map { |f,l| "#{f} #{l}" }',
		correct: false,
		feedback:
			'This reimplements the full_name logic in the query layer. If the model method changes, you have to update it in two places. Keep model logic in the model.',
	},
	{
		id: 'all',
		label: 'User.all',
		correct: false,
		feedback:
			'This loads every column when you only need names. Wasteful, especially with large TEXT columns bloating memory.',
	},
	{
		id: 'select',
		label: 'User.select(:id, :first_name, :last_name)',
		correct: true,
	},
];

const ALL_OPTION_STEPS = [
	csvExportOptions,
	dropdownOptions,
	batchOptions,
	apiResponseOptions,
];

// Stress test scenarios (reward phase)
const STRESS_SCENARIOS = [
	{
		id: 'csv-pluck',
		label: 'CSV Export',
		description: 'pluck(:id, :email) returns plain arrays',
		method: 'GET',
		path: '/api/v1/users/export.csv',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.pluck(:id, :email)', color: 'yellow' },
			{ text: '-- 2 columns, plain arrays (no AR objects)', color: 'green' },
			{ text: 'Memory: 2.35 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'dropdown-pluck',
		label: 'Dropdown',
		description: 'pluck(:id, :name) returns key-value pairs',
		method: 'GET',
		path: '/api/v1/categories/options',
		actor: 'frontend',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'Category.pluck(:id, :name)', color: 'yellow' },
			{
				text: '-- 2 columns, 80 bytes per pair (no 2.5 KB objects)',
				color: 'green',
			},
			{ text: 'Memory: 0.8 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'api-select',
		label: 'API Response',
		description: 'select(:id, :first_name, :last_name) for model methods',
		method: 'GET',
		path: '/api/v1/users',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.select(:id, :first_name, :last_name)', color: 'yellow' },
			{ text: '-- 3 columns, AR objects with model methods', color: 'green' },
			{ text: 'Memory: 12.1 MB for 10K rows', color: 'green' },
		],
	},
	{
		id: 'batch-sync',
		label: 'Nightly Sync',
		description: 'find_in_batches(batch_size: 1000) processes in chunks',
		method: 'POST',
		path: '/jobs/nightly_sync',
		actor: 'scheduler',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'User.find_in_batches(batch_size: 1000)', color: 'yellow' },
			{ text: '-- Batch 1/50... Batch 2/50... processing', color: 'green' },
			{ text: 'Peak memory: ~50 MB constant (not 3.4 GB)', color: 'green' },
		],
	},
	{
		id: 'wide-fetch',
		label: 'Wide Fetch',
		description: 'User.all loads all 30 columns for 50K records',
		method: 'GET',
		path: '/api/v1/users/all',
		actor: 'legacy_client',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'User.all', color: 'yellow' },
			{ text: '-- SELECT * FROM users (30 columns, 50K rows)', color: 'red' },
			{ text: '-- big_text_column: 75 KB per row', color: 'red' },
			{ text: 'Memory: 3.4 GB, server OOM killed', color: 'red' },
		],
	},
];

// Stress needed columns (reward heatmap)
const STRESS_NEEDED_COLUMNS: Record<string, string[]> = {
	'csv-pluck': ['id', 'email'],
	'dropdown-pluck': ['id', 'name'],
	'api-select': ['id', 'first_name', 'last_name'],
	'batch-sync': [], // all columns, but batched
	'wide-fetch': [], // all columns, blocked
};

// Stress memory data
const STRESS_MEMORY: Record<string, { label: string; pct: number }> = {
	'csv-pluck': { label: '2.35 MB', pct: 0.35 },
	'dropdown-pluck': { label: '0.8 MB', pct: 0.12 },
	'api-select': { label: '12.1 MB', pct: 1.8 },
	'batch-sync': { label: '~50 MB/batch', pct: 7.3 },
	'wide-fetch': { label: '681 MB', pct: 100 },
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 25: Narrow Fetching', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('probes cover 3 of 4 discoveries', () => {
			const probeDiscoveries = Object.values(PROBE_DISCOVERY_MAP);
			const discoveryIds = DISCOVERY_DEFS.map((d) => d.id);
			for (const pd of probeDiscoveries) {
				expect(discoveryIds).toContain(pd);
			}
			expect(probeDiscoveries).toHaveLength(3);
		});

		test('4th discovery (text-column) is via stage inspector', () => {
			const probeDiscoveryIds = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const nonProbeDiscoveries = DISCOVERY_DEFS.filter(
				(d) => !probeDiscoveryIds.has(d.id),
			);
			expect(nonProbeDiscoveries).toHaveLength(1);
			expect(nonProbeDiscoveries[0].id).toBe(STAGE_DISCOVERY_ID);
		});

		test('all discoveries are reachable via probes or stage click', () => {
			const probeReachable = new Set(Object.values(PROBE_DISCOVERY_MAP));
			probeReachable.add(STAGE_DISCOVERY_ID);
			const allIds = DISCOVERY_DEFS.map((d) => d.id);
			for (const id of allIds) {
				expect(probeReachable.has(id)).toBe(true);
			}
		});
	});

	describe('Probe configurations', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all probe labels are unique', () => {
			const labels = PROBES.map((p) => p.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('all probes have response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('probe labels are short (no full paths)', () => {
			for (const probe of PROBES) {
				expect(probe.label.length).toBeLessThan(30);
				expect(probe.label).not.toContain('/api/');
				expect(probe.label).not.toContain('GET ');
				expect(probe.label).not.toContain('POST ');
			}
		});

		test('each probe maps to a discovery', () => {
			for (const probe of PROBES) {
				expect(PROBE_DISCOVERY_MAP[probe.id]).toBeTruthy();
			}
		});
	});

	describe('Step definitions', () => {
		test('has exactly 4 steps', () => {
			expect(STEP_DEFS).toHaveLength(4);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step count matches option step count', () => {
			expect(ALL_OPTION_STEPS).toHaveLength(STEP_DEFS.length);
		});
	});

	describe('Build step quality', () => {
		test('correct answer is never first in any option step', () => {
			for (const options of ALL_OPTION_STEPS) {
				const firstOption = options[0];
				expect(firstOption.correct).toBe(false);
			}
		});

		test('each step has exactly one correct answer', () => {
			for (const options of ALL_OPTION_STEPS) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			for (const options of ALL_OPTION_STEPS) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeTruthy();
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			// Collect all correct answers
			const _correctAnswers = ALL_OPTION_STEPS.map(
				(options) => options.find((o) => o.correct)?.label ?? '',
			);

			const allFeedback = ALL_OPTION_STEPS.flatMap((options) =>
				options.filter((o) => !o.correct).map((o) => o.feedback),
			);

			for (const fb of allFeedback) {
				expect(fb).toBeTruthy();
				const lower = (fb as string).toLowerCase();
				// Should not contain exact correct method calls
				expect(lower).not.toContain('user.pluck(:id, :email)');
				expect(lower).not.toContain('category.pluck(:id, :name)');
				expect(lower).not.toContain('find_in_batches');
				expect(lower).not.toContain('user.select(:id, :first_name');
			}
		});

		test('each step has at least 3 options', () => {
			for (const options of ALL_OPTION_STEPS) {
				expect(options.length).toBeGreaterThanOrEqual(3);
			}
		});
	});

	describe('Stress test scenarios', () => {
		test('has exactly 5 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(5);
		});

		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has mix of allowed and blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('all scenarios have response lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('every scenario has needed columns data', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(STRESS_NEEDED_COLUMNS[scenario.id]).toBeDefined();
			}
		});

		test('every scenario has memory data', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(STRESS_MEMORY[scenario.id]).toBeDefined();
			}
		});

		test('allowed scenarios have low memory percentage', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				expect(STRESS_MEMORY[scenario.id].pct).toBeLessThan(100);
			}
		});

		test('blocked scenario has 100% memory usage', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				expect(STRESS_MEMORY[scenario.id].pct).toBe(100);
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('probe labels and scenario labels overlap for same endpoints', () => {
			// CSV Export probe -> CSV Export stress scenario
			const csvProbe = PROBES.find((p) => p.id === 'csv-export');
			const csvScenario = STRESS_SCENARIOS.find((s) => s.id === 'csv-pluck');
			expect(csvProbe).toBeTruthy();
			expect(csvScenario).toBeTruthy();
			expect(csvProbe?.label).toBe('CSV Export');
			expect(csvScenario?.label).toBe('CSV Export');
		});

		test('dropdown probe and scenario share label convention', () => {
			const dropdownProbe = PROBES.find((p) => p.id === 'dropdown-api');
			const dropdownScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'dropdown-pluck',
			);
			expect(dropdownProbe).toBeTruthy();
			expect(dropdownScenario).toBeTruthy();
			expect(dropdownProbe?.label).toBe('Dropdown');
			expect(dropdownScenario?.label).toBe('Dropdown');
		});

		test('nightly sync probe and scenario share label convention', () => {
			const syncProbe = PROBES.find((p) => p.id === 'nightly-sync');
			const syncScenario = STRESS_SCENARIOS.find((s) => s.id === 'batch-sync');
			expect(syncProbe).toBeTruthy();
			expect(syncScenario).toBeTruthy();
			expect(syncProbe?.label).toBe('Nightly Sync');
			expect(syncScenario?.label).toBe('Nightly Sync');
		});

		test('service pattern references use pluck/select/find_in_batches in reward', () => {
			const allowedScenarios = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const allResponseText = allowedScenarios.flatMap((s) =>
				s.responseLines.map((r) => r.text),
			);
			const joinedText = allResponseText.join(' ');
			expect(joinedText).toContain('pluck');
			expect(joinedText).toContain('select');
			expect(joinedText).toContain('find_in_batches');
		});

		test('blocked scenario references SELECT * (the problem pattern)', () => {
			const blockedScenario = STRESS_SCENARIOS.find(
				(s) => s.expectedResult === 'blocked',
			);
			const responseText = blockedScenario?.responseLines
				.map((r) => r.text)
				.join(' ');
			expect(responseText).toContain('SELECT *');
		});

		test('allowed narrow-fetch scenarios specify fewer needed columns than total', () => {
			const TOTAL_COLUMN_COUNT = 30;
			const narrowScenarios = ['csv-pluck', 'dropdown-pluck', 'api-select'];
			for (const id of narrowScenarios) {
				const cols = STRESS_NEEDED_COLUMNS[id];
				expect(cols.length).toBeGreaterThan(0);
				expect(cols.length).toBeLessThan(TOTAL_COLUMN_COUNT);
			}
		});
	});

	describe('Answer hiding', () => {
		test('step titles do not reveal specific method names', () => {
			for (const step of STEP_DEFS) {
				const lower = step.title.toLowerCase();
				expect(lower).not.toContain('pluck');
				expect(lower).not.toContain('select');
				expect(lower).not.toContain('find_in_batches');
			}
		});

		test('discovery labels do not reveal correct build step answers', () => {
			for (const disc of DISCOVERY_DEFS) {
				const lower = disc.label.toLowerCase();
				expect(lower).not.toContain('pluck');
				expect(lower).not.toContain('find_in_batches');
				expect(lower).not.toContain('.select(');
			}
		});
	});
});

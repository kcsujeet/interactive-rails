/**
 * Tests for Level 23: The N+1 Problem
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
}

interface StepDef {
	id: string;
	title: string;
}

// ──────────────────────────────────────────────
// Data (mirrored from component)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'n1-pattern', label: 'N+1 query pattern in serializer' },
	{ id: 'query-count', label: '101 queries for 100 posts' },
	{ id: 'no-eager-load', label: 'No eager loading on the query' },
	{ id: 'hidden-in-serializer', label: 'N+1 hides inside the serializer' },
];

const PROBES: ProbeConfig[] = [
	{
		id: 'get-posts-5',
		label: 'GET /posts (5 posts)',
		command: 'GET /api/v1/products (5 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 6', color: 'yellow' },
			{ text: '  SELECT * FROM products              (1 query)', color: 'muted' },
			{ text: '  SELECT * FROM users WHERE id = 1 (+1)', color: 'red' },
			{ text: '  SELECT * FROM users WHERE id = 2 (+1)', color: 'red' },
			{ text: '  SELECT * FROM users WHERE id = 3 (+1)', color: 'red' },
			{ text: '  ... 2 more author queries', color: 'red' },
			{ text: '1 + 5 = 6 queries. That is the N+1 pattern.', color: 'yellow' },
		],
	},
	{
		id: 'get-posts-100',
		label: 'GET /posts (100 posts)',
		command: 'GET /api/v1/products (100 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (850ms)', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 101', color: 'red' },
			{
				text: '  SELECT * FROM products                (1 query)',
				color: 'muted',
			},
			{ text: '  SELECT * FROM users WHERE id = ... (x100)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '101 queries, 850ms. Each product.user call fires a query.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-posts-1000',
		label: 'GET /posts (1000 posts)',
		command: 'GET /api/v1/products (1000 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (4873ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 1001', color: 'red' },
			{
				text: '1001 queries, 4.9 seconds. The page is unusable.',
				color: 'red',
			},
			{
				text: 'Memory: 1,564 MB | Objects allocated: 5,301,574',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-posts-5': 'n1-pattern',
	'get-posts-100': 'query-count',
	'get-posts-1000': 'no-eager-load',
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	serializer: 'hidden-in-serializer',
	database: 'no-eager-load',
};

const STAGE_INSPECTOR_MAP_KEYS = ['controller', 'serializer', 'database'];

const STEP_DEFS: StepDef[] = [
	{ id: 'add-prosopite', title: 'Add Prosopite Gem' },
	{ id: 'config-prosopite', title: 'Configure Prosopite' },
	{ id: 'strict-loading', title: 'Enable strict_loading' },
];

const addProsopiteCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install prosopite',
		command: 'gem install prosopite',
		correct: false,
		feedback:
			'That installs system-wide, not into your project. You need it in the Gemfile.',
	},
	{
		id: 'wrong-no-pg-query',
		label: 'bundle add prosopite',
		command: 'bundle add prosopite',
		correct: false,
		feedback:
			'Prosopite needs pg_query for SQL fingerprinting on ProductgreSQL. Without it, Prosopite cannot group similar queries to detect N+1 patterns.',
	},
	{
		id: 'correct',
		label: 'bundle add prosopite pg_query',
		command: 'bundle add prosopite pg_query',
		correct: true,
	},
];

const PROSOPITE_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-log-only',
		label: 'config.after_initialize do\n  Prosopite.rails_logger = true\nend',
		correct: false,
		feedback:
			'Logging alone means N+1 warnings get buried in the log. You want it to stop execution so you notice immediately.',
	},
	{
		id: 'correct',
		label:
			'config.after_initialize do\n  Prosopite.rails_logger = true\n  Prosopite.raise = true\nend',
		correct: true,
	},
	{
		id: 'wrong-prod',
		label:
			'config.after_initialize do\n  Prosopite.raise = true\n  Prosopite.prosopite_logger = true\nend',
		correct: false,
		feedback:
			'prosopite_logger writes to a separate file but does not feed into the Rails log. Use rails_logger so N+1 warnings appear alongside your normal log output.',
	},
];

const STRICT_LOADING_OPTIONS: StepOption[] = [
	{
		id: 'wrong-global',
		label:
			'# config/application.rb\nconfig.active_record.strict_loading_by_default = true',
		correct: false,
		feedback:
			'Enabling strict_loading globally on every model in the entire app is too aggressive. It breaks legitimate lazy loading everywhere. Start with the specific model that has the N+1.',
	},
	{
		id: 'correct',
		label:
			'# app/models/product.rb\nclass Product < ApplicationRecord\n  self.strict_loading_by_default = true\nend',
		correct: true,
	},
	{
		id: 'wrong-scope',
		label: '# app/models/product.rb\nscope :safe, -> { strict_loading }',
		correct: false,
		feedback:
			'A scope only applies when explicitly used. Developers will forget to chain it. The default should enforce it.',
	},
];

const ALL_OPTION_STEPS: StepOption[][] = [
	PROSOPITE_CONFIG_OPTIONS,
	STRICT_LOADING_OPTIONS,
];

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'posts-no-includes',
		label: 'PostList (no includes)',
		description:
			'Service loads posts without eager loading, serializer accesses .user',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'blocked',
	},
	{
		id: 'posts-with-includes',
		label: 'PostList (with includes)',
		description: 'Service loads posts with eager-loaded users',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'allowed',
	},
	{
		id: 'comments-no-includes',
		label: 'PostList + .comments.count',
		description:
			'Service loads posts, serializer counts comments without counter cache',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'blocked',
	},
	{
		id: 'find-each-n1',
		label: 'find_each { |p| p.user }',
		description: 'find_each block accessing association without preloading',
		method: 'TASK',
		path: '/jobs/export_posts',
		actor: 'find_each block',
		expectedResult: 'blocked',
	},
	{
		id: 'preload-scope',
		label: 'policy_scope + preload',
		description: 'Scoped query with preloaded associations',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'scope + preload',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 23: N+1 Problem', () => {
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

		test('all discoveries are reachable via probes or zone clicks', () => {
			const reachableViaProbes = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const reachableViaStages = new Set(
				Object.values(STAGE_DISCOVERY_MAP),
			);
			const allReachable = new Set([
				...reachableViaProbes,
				...reachableViaStages,
			]);
			for (const def of DISCOVERY_DEFS) {
				expect(allReachable.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map references valid discovery IDs', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveryId of Object.values(PROBE_DISCOVERY_MAP)) {
				expect(validIds.has(discoveryId)).toBe(true);
			}
		});

		test('stage discovery map references valid discovery IDs', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveryId of Object.values(STAGE_DISCOVERY_MAP)) {
				expect(validIds.has(discoveryId)).toBe(true);
			}
		});
	});

	// ── Probes (observe phase) ──

	describe('Probe configurations', () => {
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
				expect(probe.label.length).toBeLessThan(40);
				expect(probe.label).not.toContain('app/');
				expect(probe.label).not.toContain('config/');
			}
		});

		test('all probes map to valid discovery IDs', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const probe of PROBES) {
				const discoveryId = PROBE_DISCOVERY_MAP[probe.id];
				expect(discoveryId).toBeTruthy();
				expect(validIds.has(discoveryId)).toBe(true);
			}
		});

		test('probes show escalating N+1 severity', () => {
			// First probe: 6 queries, second: 101, third: 1001
			const firstQueryCount = PROBES[0].responseLines.find((l) =>
				l.text.includes('SQL queries executed'),
			);
			const secondQueryCount = PROBES[1].responseLines.find((l) =>
				l.text.includes('SQL queries executed'),
			);
			const thirdQueryCount = PROBES[2].responseLines.find((l) =>
				l.text.includes('SQL queries executed'),
			);
			expect(firstQueryCount?.text).toContain('6');
			expect(secondQueryCount?.text).toContain('101');
			expect(thirdQueryCount?.text).toContain('1001');
		});

		test('each probe has at least one red response line', () => {
			for (const probe of PROBES) {
				const hasRed = probe.responseLines.some((l) => l.color === 'red');
				expect(hasRed).toBe(true);
			}
		});
	});

	// ── Build step quality ──

	describe('Build steps', () => {
		test('step definitions have unique IDs', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step definitions have unique titles', () => {
			const titles = STEP_DEFS.map((s) => s.title);
			expect(new Set(titles).size).toBe(titles.length);
		});

		// Terminal step 0: add prosopite
		test('terminal step: correct answer is not first', () => {
			const correctIndex = addProsopiteCommands.findIndex(
				(c) => c.correct,
			);
			expect(correctIndex).toBeGreaterThan(0);
		});

		test('terminal step: exactly one correct answer', () => {
			const correctCount = addProsopiteCommands.filter(
				(c) => c.correct,
			).length;
			expect(correctCount).toBe(1);
		});

		test('terminal step: every wrong option has feedback', () => {
			for (const cmd of addProsopiteCommands) {
				if (!cmd.correct) {
					expect(cmd.feedback).toBeTruthy();
				}
			}
		});

		test('terminal step: feedback does not reveal the correct answer', () => {
			const correct = addProsopiteCommands.find((c) => c.correct);
			for (const cmd of addProsopiteCommands) {
				if (!cmd.correct && cmd.feedback) {
					expect(cmd.feedback).not.toContain(correct?.command ?? '');
					expect(cmd.feedback).not.toContain('bundle add prosopite pg_query');
				}
			}
		});

		// OptionCard steps
		for (const [idx, options] of ALL_OPTION_STEPS.entries()) {
			const stepNum = idx + 1; // step 1 = config, step 2 = strict_loading

			test(`option step ${stepNum}: correct answer is not first`, () => {
				const correctIndex = options.findIndex((o) => o.correct);
				expect(correctIndex).toBeGreaterThan(0);
			});

			test(`option step ${stepNum}: exactly one correct answer`, () => {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			});

			test(`option step ${stepNum}: every wrong option has feedback`, () => {
				for (const option of options) {
					if (!option.correct) {
						expect(option.feedback).toBeTruthy();
					}
				}
			});

			test(`option step ${stepNum}: feedback does not reveal the correct answer`, () => {
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

		test('every scenario has a description', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.description).toBeTruthy();
				expect(scenario.description.length).toBeGreaterThan(0);
			}
		});

		test('every scenario has a method and path', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.method).toBeTruthy();
				expect(scenario.path).toBeTruthy();
			}
		});

		test('every scenario has an actor', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.actor).toBeTruthy();
			}
		});

		test('blocked scenarios describe N+1 patterns', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				const mentionsN1 =
					scenario.description.includes('N+1') ||
					scenario.description.includes('without') ||
					scenario.description.includes('no ') ||
					scenario.label.includes('no ');
				expect(mentionsN1).toBe(true);
			}
		});

		test('allowed scenarios describe safe patterns', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const mentionsSafe =
					scenario.description.includes('eager') ||
					scenario.description.includes('preload') ||
					scenario.label.includes('includes') ||
					scenario.label.includes('preload');
				expect(mentionsSafe).toBe(true);
			}
		});
	});

	// ── Cross-phase consistency ──

	describe('Cross-phase consistency', () => {
		test('observe and reward use the same 3-zone layout', () => {
			// Both phases use controller, serializer, database zones
			const observeZoneIds = ['controller', 'serializer', 'database'];
			expect(STAGE_INSPECTOR_MAP_KEYS).toEqual(observeZoneIds);
		});

		test('service pattern (PostList) referenced in both probes and stress scenarios', () => {
			// Probes reference the ProductList service path
			const probeRefsService = PROBES.some(
				(p) =>
					p.command.includes('posts') || p.label.includes('posts'),
			);
			expect(probeRefsService).toBe(true);

			// Stress scenarios reference PostList
			const stressRefsService = STRESS_SCENARIOS.some(
				(s) =>
					s.actor.includes('PostList') || s.label.includes('PostList'),
			);
			expect(stressRefsService).toBe(true);
		});

		test('probes use consistent label convention (method + resource)', () => {
			for (const probe of PROBES) {
				// All probe labels follow "GET /posts (N posts)" pattern
				expect(probe.label).toMatch(/^GET \/posts/);
			}
		});

		test('stress scenario labels are descriptive and concise', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label.length).toBeLessThan(40);
			}
		});

		test('build steps teach Prosopite (the detection tool for N+1)', () => {
			const prosopiteStep = STEP_DEFS.find((s) =>
				s.title.toLowerCase().includes('prosopite'),
			);
			expect(prosopiteStep).toBeTruthy();

			const prosopiteCommand = addProsopiteCommands.find((c) => c.correct);
			expect(prosopiteCommand?.command).toContain('prosopite');
		});

		test('build steps cover both detection (Prosopite) and prevention (strict_loading)', () => {
			const hasProsopite = STEP_DEFS.some((s) =>
				s.title.toLowerCase().includes('prosopite'),
			);
			const hasStrictLoading = STEP_DEFS.some((s) =>
				s.title.toLowerCase().includes('strict_loading'),
			);
			expect(hasProsopite).toBe(true);
			expect(hasStrictLoading).toBe(true);
		});

		test('stress scenarios include both eager-loading and non-eager-loading patterns', () => {
			const hasEager = STRESS_SCENARIOS.some(
				(s) =>
					s.label.includes('includes') ||
					s.description.includes('eager'),
			);
			const hasNoEager = STRESS_SCENARIOS.some(
				(s) =>
					s.label.includes('no includes') ||
					s.description.includes('without eager'),
			);
			expect(hasEager).toBe(true);
			expect(hasNoEager).toBe(true);
		});
	});

	// ── Data consistency ──

	describe('Data consistency', () => {
		test('exactly 4 discoveries required (matching minRequired: 4)', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('exactly 3 probes (escalating scale: 5, 100, 1000 posts)', () => {
			expect(PROBES.length).toBe(3);
		});

		test('exactly 3 build steps', () => {
			expect(STEP_DEFS.length).toBe(3);
		});

		test('probe IDs map 1:1 in PROBE_DISCOVERY_MAP', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			const mapKeys = new Set(Object.keys(PROBE_DISCOVERY_MAP));
			expect(probeIds).toEqual(mapKeys);
		});

		test('stage discovery map keys are valid zone IDs', () => {
			const validZoneIds = new Set(STAGE_INSPECTOR_MAP_KEYS);
			for (const key of Object.keys(STAGE_DISCOVERY_MAP)) {
				expect(validZoneIds.has(key)).toBe(true);
			}
		});
	});
});

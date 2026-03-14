import { describe, expect, test } from 'bun:test';

// ──────────────────────────────────────────────
// Mirrored data structures from Level29Search.tsx
// (independent copy for snapshot testing)
// ──────────────────────────────────────────────

// Step definitions
const STEP_DEFS = [
	{ id: 'install-gem', title: 'Install Search Gem' },
	{ id: 'generate-migration', title: 'Generate Search Column' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'include-module', title: 'Include Search Module' },
	{ id: 'configure-scope', title: 'Define Search Scope' },
	{ id: 'update-service', title: 'Update Service' },
];

const STEP_TYPES = [
	'terminal', // 0
	'terminal', // 1
	'terminal', // 2
	'option', // 3
	'option', // 4
	'option', // 5
] as const;

// Discovery definitions
const DISCOVERY_DEFS = [
	{ id: 'seq-scan', label: 'LIKE forces a sequential scan (3,200ms)' },
	{ id: 'no-stemming', label: '"running" does not match "run"' },
	{ id: 'no-ranking', label: 'Results have no relevance ranking' },
	{ id: 'controller-like', label: 'Controller uses raw LIKE query' },
];

// Probe configurations
const PROBES = [
	{
		id: 'search-rails',
		label: 'Search "rails"',
		command: 'GET /api/posts?q=rails (50K rows)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'Seq Scan on posts (cost=0.00..1250.00)', color: 'red' },
			{
				text: "Filter: (title ~~ '%rails%' OR body ~~ '%rails%')",
				color: 'muted',
			},
			{ text: 'Rows Removed by Filter: 49,500', color: 'muted' },
			{ text: 'Execution Time: 3,200ms', color: 'red' },
		],
	},
	{
		id: 'search-running',
		label: 'Search "running"',
		command: 'GET /api/posts?q=running (stemming test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: '0 results for "running"', color: 'red' },
			{
				text: 'Post titled "Running Tests in RSpec" not found.',
				color: 'muted',
			},
			{ text: 'LIKE has no stemming: "running" != "run"', color: 'red' },
		],
	},
	{
		id: 'search-database',
		label: 'Search "database"',
		command: 'GET /api/posts?q=database (ranking test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Results returned in insertion order, not relevance.',
				color: 'red',
			},
			{
				text: 'A title match and a body mention are ranked equally.',
				color: 'muted',
			},
			{ text: 'No relevance scoring with LIKE queries.', color: 'red' },
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'search-rails': 'seq-scan',
	'search-running': 'no-stemming',
	'search-database': 'no-ranking',
};

// Grid matches
const GRID_SIZE = 100;

const OBSERVE_GRID_MATCHES: Record<string, number[]> = {
	'search-rails': [8, 23, 41, 56, 72, 87],
	'search-running': [],
	'search-database': [3, 15, 31, 47, 62, 78, 91],
};

const REWARD_GRID_MATCHES: Record<string, number[]> = {
	'exact-term': [8, 23, 41, 56, 72, 87],
	'stemmed-term': [5, 19, 44],
	'ranked-results': [15, 3, 31, 47, 62, 78, 91],
	'multi-word': [23, 56],
	'empty-query': [],
	'sql-injection': [],
};

// Stress scenarios
const STRESS_SCENARIOS = [
	{
		id: 'exact-term',
		label: 'Search exact term',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using posts_searchable_idx',
				color: 'green',
			},
			{ text: "  Index Cond: searchable @@ 'rail'", color: 'yellow' },
			{ text: '  Rows: 6 of 50,000 (GIN lookup)', color: 'green' },
			{ text: '  Execution Time: 1.8ms (was 3,200ms)', color: 'green' },
		],
	},
	{
		id: 'stemmed-term',
		label: 'Stemmed search',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using posts_searchable_idx',
				color: 'green',
			},
			{
				text: "  Index Cond: searchable @@ 'run' (stemmed from 'running')",
				color: 'yellow',
			},
			{ text: '  Rows: 3 matched via English stemming', color: 'green' },
			{ text: '  Execution Time: 1.5ms', color: 'green' },
		],
	},
	{
		id: 'ranked-results',
		label: 'Ranked results',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using posts_searchable_idx',
				color: 'green',
			},
			{
				text: "  ts_rank: title(A) > body(B) for 'databas'",
				color: 'yellow',
			},
			{ text: '  Rows: 7, sorted by relevance', color: 'green' },
			{ text: '  Execution Time: 2.1ms (was 3,200ms)', color: 'green' },
		],
	},
	{
		id: 'multi-word',
		label: 'Multi-word query',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Bitmap Heap Scan using posts_searchable_idx',
				color: 'green',
			},
			{
				text: "  Index Cond: searchable @@ 'rubi' & 'test'",
				color: 'yellow',
			},
			{ text: '  Rows: 2 (AND intersection)', color: 'green' },
			{ text: '  Execution Time: 1.2ms', color: 'green' },
		],
	},
	{
		id: 'empty-query',
		label: 'Empty search blocked',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'HTTP/1.1 422 Unprocessable Entity', color: 'red' },
			{ text: '  params[:q] is blank, search skipped', color: 'yellow' },
			{ text: '  No database query executed', color: 'green' },
		],
	},
	{
		id: 'sql-injection',
		label: 'SQL injection blocked',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{
				text: "  plainto_tsquery sanitized input: '' | '1' | '1'",
				color: 'green',
			},
			{ text: '  0 results (no matching stems)', color: 'green' },
			{ text: '  SQL injection attempt safely neutralized', color: 'green' },
		],
	},
];

// Reward scan data
const REWARD_SCAN_DATA: Record<
	string,
	{
		scanType: 'gin' | 'blocked';
		matchCount: number;
		ranked: boolean;
		stemmed: boolean;
	}
> = {
	'exact-term': {
		scanType: 'gin',
		matchCount: 6,
		ranked: true,
		stemmed: false,
	},
	'stemmed-term': {
		scanType: 'gin',
		matchCount: 3,
		ranked: true,
		stemmed: true,
	},
	'ranked-results': {
		scanType: 'gin',
		matchCount: 7,
		ranked: true,
		stemmed: false,
	},
	'multi-word': {
		scanType: 'gin',
		matchCount: 2,
		ranked: true,
		stemmed: false,
	},
	'empty-query': {
		scanType: 'blocked',
		matchCount: 0,
		ranked: false,
		stemmed: false,
	},
	'sql-injection': {
		scanType: 'blocked',
		matchCount: 0,
		ranked: false,
		stemmed: false,
	},
};

// GIN Index data
const GIN_INDEX_DATA_IDS = [
	'exact-term',
	'stemmed-term',
	'ranked-results',
	'multi-word',
];

// Terminal step commands
const installGemCommands = [
	{
		id: 'wrong-gem-install',
		label: 'gem install pg_search',
		correct: false,
		feedback:
			'That installs the gem system-wide, not into your project. You need it in the Gemfile so the app can load it.',
	},
	{
		id: 'wrong-elasticsearch',
		label: 'bundle add elasticsearch-model',
		correct: false,
		feedback:
			'Elasticsearch is a separate search engine. PostgreSQL has built-in full-text search that handles most needs without extra infrastructure.',
	},
	{ id: 'correct', label: 'bundle add pg_search', correct: true },
];

const generateMigrationCommands = [
	{
		id: 'wrong-model-gen',
		label: 'rails generate model SearchIndex',
		correct: false,
		feedback:
			'Full-text search does not need a separate model. You add a search column and index to the existing posts table via a migration.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddSearchToPosts',
		correct: true,
	},
	{
		id: 'wrong-no-gin',
		label: 'rails generate migration AddSearchToPosts searchable:tsvector',
		correct: false,
		feedback:
			'Passing the column type on the command line only adds the column. You need to manually add the GIN index and trigger in the migration file.',
	},
];

const runMigrationCommands = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		correct: false,
		feedback:
			'That recreates the database from scratch. You need to run pending migrations on the existing database.',
	},
	{ id: 'correct', label: 'rails db:migrate', correct: true },
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		correct: false,
		feedback:
			'That loads seed data. You need to apply the migration that creates the search column and index.',
	},
];

// OptionCard step data
const INCLUDE_OPTIONS = [
	{
		id: 'wrong-concern',
		label: 'include Searchable',
		correct: false,
		feedback:
			'That would require a custom concern you have not defined. The gem provides its own module to include.',
	},
	{ id: 'correct', label: 'include PgSearch::Model', correct: true },
	{
		id: 'wrong-ar',
		label: 'include ActiveRecord::FullTextSearch',
		correct: false,
		feedback:
			'ActiveRecord does not have a built-in FullTextSearch module. The gem provides the integration layer.',
	},
];

const SCOPE_OPTIONS = [
	{
		id: 'wrong-like-scope',
		label: 'scope :search, ->(q) {\n  where("title LIKE ?", "%#{q}%")\n}',
		correct: false,
		feedback:
			'That is the same LIKE approach you are replacing. The gem provides a DSL that uses tsvector under the hood.',
	},
	{
		id: 'wrong-no-weights',
		label: 'pg_search_scope :search,\n  against: [:title, :body]',
		correct: false,
		feedback:
			'Passing columns as an array gives them equal weight. Title matches should rank higher than body matches for better relevance.',
	},
	{
		id: 'correct',
		label:
			"pg_search_scope :search,\n  against: { title: 'A', body: 'B' },\n  using: {\n    tsearch: { dictionary: 'english' }\n  }",
		correct: true,
	},
];

const SERVICE_OPTIONS = [
	{
		id: 'wrong-keep-like',
		label: 'Post.where("title LIKE :q OR body LIKE :q", q: "%#{@query}%")',
		correct: false,
		feedback:
			'That is the same LIKE query you are replacing. You just defined a search scope on the model that uses the GIN index.',
	},
	{ id: 'correct', label: 'Post.search(@query)', correct: true },
	{
		id: 'wrong-raw-tsquery',
		label: 'Post.where("searchable @@ plainto_tsquery(?)", @query)',
		correct: false,
		feedback:
			'Writing raw SQL defeats the purpose of the gem. You already defined a clean search scope that handles tsvector, ranking, and stemming.',
	},
];

const ALL_OPTION_STEPS = [INCLUDE_OPTIONS, SCOPE_OPTIONS, SERVICE_OPTIONS];

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 29: Search', () => {
	describe('Step definitions', () => {
		test('has exactly 6 steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('step types match step count', () => {
			expect(STEP_TYPES).toHaveLength(STEP_DEFS.length);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step labels do not reveal specific gem names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title.toLowerCase()).not.toContain('pg_search');
				expect(step.title.toLowerCase()).not.toContain('pgsearch');
				expect(step.title.toLowerCase()).not.toContain('pagy');
			}
		});

		test('migration generation is followed by db:migrate', () => {
			const generateIdx = STEP_DEFS.findIndex(
				(s) => s.id === 'generate-migration',
			);
			const migrateIdx = STEP_DEFS.findIndex((s) => s.id === 'run-migration');
			expect(migrateIdx).toBe(generateIdx + 1);
		});

		test('first 3 steps are terminal, last 3 are option', () => {
			expect(STEP_TYPES.slice(0, 3).every((t) => t === 'terminal')).toBe(true);
			expect(STEP_TYPES.slice(3).every((t) => t === 'option')).toBe(true);
		});
	});

	describe('Build step quality', () => {
		test('correct answer is never first in terminal steps', () => {
			for (const commands of [
				installGemCommands,
				generateMigrationCommands,
				runMigrationCommands,
			]) {
				const firstOption = commands[0];
				expect(firstOption.correct).toBe(false);
			}
		});

		test('correct answer is never first in option steps', () => {
			for (const options of ALL_OPTION_STEPS) {
				const firstOption = options[0];
				expect(firstOption.correct).toBe(false);
			}
		});

		test('each terminal step has exactly one correct answer', () => {
			for (const commands of [
				installGemCommands,
				generateMigrationCommands,
				runMigrationCommands,
			]) {
				const correctCount = commands.filter((c) => c.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('each option step has exactly one correct answer', () => {
			for (const options of ALL_OPTION_STEPS) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong terminal option has feedback', () => {
			for (const commands of [
				installGemCommands,
				generateMigrationCommands,
				runMigrationCommands,
			]) {
				for (const cmd of commands) {
					if (!cmd.correct) {
						expect(cmd.feedback).toBeTruthy();
					}
				}
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
			const allFeedback = [
				...installGemCommands.filter((c) => !c.correct).map((c) => c.feedback),
				...generateMigrationCommands
					.filter((c) => !c.correct)
					.map((c) => c.feedback),
				...runMigrationCommands
					.filter((c) => !c.correct)
					.map((c) => c.feedback),
				...ALL_OPTION_STEPS.flatMap((options) =>
					options.filter((o) => !o.correct).map((o) => o.feedback),
				),
			];

			for (const fb of allFeedback) {
				expect(fb).toBeTruthy();
				const lower = (fb as string).toLowerCase();
				// Should not contain exact correct commands
				expect(lower).not.toContain('bundle add pg_search');
				expect(lower).not.toContain(
					'rails generate migration addsearchtoposts',
				);
				expect(lower).not.toContain('rails db:migrate');
				expect(lower).not.toContain('include pgsearch::model');
				expect(lower).not.toContain('post.search(@query');
			}
		});
	});

	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('probes cover 3 of 4 discoveries', () => {
			const probeDiscoveries = Object.values(PROBE_DISCOVERY_MAP);
			const discoveryIds = DISCOVERY_DEFS.map((d) => d.id);
			for (const pd of probeDiscoveries) {
				expect(discoveryIds).toContain(pd);
			}
			expect(probeDiscoveries).toHaveLength(3);
		});

		test('4th discovery (controller-like) is via stage inspector', () => {
			const probeDiscoveryIds = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const nonProbeDiscoveries = DISCOVERY_DEFS.filter(
				(d) => !probeDiscoveryIds.has(d.id),
			);
			expect(nonProbeDiscoveries).toHaveLength(1);
			expect(nonProbeDiscoveries[0].id).toBe('controller-like');
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

		test('all probes have response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('each probe maps to a discovery', () => {
			for (const probe of PROBES) {
				expect(PROBE_DISCOVERY_MAP[probe.id]).toBeTruthy();
			}
		});

		test('each probe has grid matches defined', () => {
			for (const probe of PROBES) {
				expect(OBSERVE_GRID_MATCHES[probe.id]).toBeDefined();
			}
		});
	});

	describe('Grid data consistency', () => {
		test('observe match positions are within grid bounds', () => {
			for (const [probeId, positions] of Object.entries(OBSERVE_GRID_MATCHES)) {
				for (const pos of positions) {
					expect(pos).toBeGreaterThanOrEqual(0);
					expect(pos).toBeLessThan(GRID_SIZE);
				}
			}
		});

		test('reward match positions are within grid bounds', () => {
			for (const [scenarioId, positions] of Object.entries(
				REWARD_GRID_MATCHES,
			)) {
				for (const pos of positions) {
					expect(pos).toBeGreaterThanOrEqual(0);
					expect(pos).toBeLessThan(GRID_SIZE);
				}
			}
		});

		test('stemming probe has 0 observe matches (no stemming with LIKE)', () => {
			expect(OBSERVE_GRID_MATCHES['search-running']).toHaveLength(0);
		});

		test('stemming scenario has reward matches (stemming works with GIN)', () => {
			expect(REWARD_GRID_MATCHES['stemmed-term'].length).toBeGreaterThan(0);
		});

		test('blocked scenarios have 0 reward matches', () => {
			expect(REWARD_GRID_MATCHES['empty-query']).toHaveLength(0);
			expect(REWARD_GRID_MATCHES['sql-injection']).toHaveLength(0);
		});
	});

	describe('Stress test scenarios', () => {
		test('has exactly 6 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(6);
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

		test('every scenario has reward scan data', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(REWARD_SCAN_DATA[scenario.id]).toBeDefined();
			}
		});

		test('every scenario has reward grid matches', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(REWARD_GRID_MATCHES[scenario.id]).toBeDefined();
			}
		});

		test('allowed scenarios have GIN scan type in reward data', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				expect(REWARD_SCAN_DATA[scenario.id].scanType).toBe('gin');
			}
		});

		test('blocked scenarios have blocked scan type in reward data', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				expect(REWARD_SCAN_DATA[scenario.id].scanType).toBe('blocked');
			}
		});

		test('GIN index data exists for all allowed scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				expect(GIN_INDEX_DATA_IDS).toContain(scenario.id);
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('observe and reward use same grid size', () => {
			// Both phases render DocumentGrid with totalRows=50000
			// Grid is 100 blocks in both phases
			expect(GRID_SIZE).toBe(100);
		});

		test('exact-term reward matches equal observe "rails" matches', () => {
			expect(REWARD_GRID_MATCHES['exact-term']).toEqual(
				OBSERVE_GRID_MATCHES['search-rails'],
			);
		});

		test('ranked-results reward has same matches as observe "database" (reordered)', () => {
			const observeMatches = new Set(OBSERVE_GRID_MATCHES['search-database']);
			const rewardMatches = new Set(REWARD_GRID_MATCHES['ranked-results']);
			expect(rewardMatches).toEqual(observeMatches);
		});

		test('reward scan data match counts match reward grid matches', () => {
			for (const [scenarioId, data] of Object.entries(REWARD_SCAN_DATA)) {
				const gridMatches = REWARD_GRID_MATCHES[scenarioId];
				expect(gridMatches).toBeDefined();
				expect(data.matchCount).toBe(gridMatches.length);
			}
		});

		test('probe labels and scenario labels overlap for same concepts', () => {
			// "Search rails" probe -> "Search exact term" scenario (same query)
			const railsProbe = PROBES.find((p) => p.id === 'search-rails');
			const exactScenario = STRESS_SCENARIOS.find((s) => s.id === 'exact-term');
			expect(railsProbe).toBeTruthy();
			expect(exactScenario).toBeTruthy();
			// Both reference searching for "rails"
			expect(railsProbe?.command ?? '').toContain('q=rails');
			// Scenario label confirms it's a search test
			expect(exactScenario?.label ?? '').toContain('exact term');
		});
	});

	describe('Answer hiding', () => {
		test('step labels do not reveal gem or module names', () => {
			for (const step of STEP_DEFS) {
				const lower = step.title.toLowerCase();
				expect(lower).not.toContain('pg_search');
				expect(lower).not.toContain('pgsearch');
				expect(lower).not.toContain('tsvector');
				expect(lower).not.toContain('::model');
			}
		});

		test('discovery labels do not reveal correct build step answers', () => {
			for (const disc of DISCOVERY_DEFS) {
				const lower = disc.label.toLowerCase();
				expect(lower).not.toContain('pg_search_scope');
				expect(lower).not.toContain('include pgsearch');
				expect(lower).not.toContain('bundle add');
			}
		});
	});
});

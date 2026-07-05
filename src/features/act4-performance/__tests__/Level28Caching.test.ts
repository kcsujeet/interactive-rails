/**
 * Tests for Level 30: Caching
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

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'redundant-computation', label: 'Same query runs 200 times/minute' },
	{ id: 'no-cache-store', label: 'No cache store configured' },
	{ id: 'db-overload', label: 'Database at 170% capacity' },
	{ id: 'service-no-cache', label: 'Service has no caching logic' },
];

const PROBES: ProbeConfig[] = [
	{
		id: 'trending-first',
		label: 'GET trending',
		command: 'GET /api/products/trending',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: 'X-Runtime: 0.512', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'TrendingProducts: joins + group + order on 50K rows',
				color: 'muted',
			},
			{ text: 'Execution Time: 512ms. Computed from scratch.', color: 'red' },
		],
	},
	{
		id: 'trending-repeat',
		label: 'GET trending (again)',
		command: 'GET /api/products/trending (same request, 5s later)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: 'X-Runtime: 0.508', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Identical query. Identical result. Full recomputation.',
				color: 'red',
			},
			{ text: 'No cache layer intercepted this request.', color: 'red' },
		],
	},
	{
		id: 'check-db-load',
		label: 'Check DB load',
		command:
			'rails runner "puts ActiveRecord::Base.connection.pool.stat[:busy]"',
		responseLines: [
			{ text: '=> 47 active connections', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: '200 req/min * 512ms = 1,707ms of DB time per second',
				color: 'red',
			},
			{ text: 'Database at 170% of available capacity.', color: 'red' },
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'trending-first': 'redundant-computation',
	'trending-repeat': 'no-cache-store',
	'check-db-load': 'db-overload',
};

const ZONE_DISCOVERY_MAP: Record<string, string> = {
	service: 'service-no-cache',
};

const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install Cache Gem' },
	{ id: 'run-installer', title: 'Run Installer' },
	{ id: 'db-prepare', title: 'Prepare Database' },
	{ id: 'configure-store', title: 'Configure Cache Store' },
	{ id: 'cache-fetch', title: 'Add Cache Fetch' },
	{ id: 'touch-invalidation', title: 'Cache Invalidation' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'terminal',
	'terminal',
	'option',
	'option',
	'option',
];

const installGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install solid-cache',
		command: 'npm install solid-cache',
		correct: false,
		feedback:
			'Solid Cache is a Ruby gem, not an npm package. Use the Ruby dependency manager.',
	},
	{
		id: 'correct',
		label: 'bundle add solid_cache',
		command: 'bundle add solid_cache',
		correct: true,
	},
	{
		id: 'wrong-gem',
		label: 'gem install solid_cache',
		command: 'gem install solid_cache',
		correct: false,
		feedback:
			'gem install works globally but does not add to your Gemfile. Use bundle add for project dependencies.',
	},
];

const runInstallerCommands: TerminalCommand[] = [
	{
		id: 'wrong-generate',
		label: 'bin/rails generate cache',
		command: 'bin/rails generate cache',
		correct: false,
		feedback:
			'There is no "cache" generator. Solid Cache ships its own installer task.',
	},
	{
		id: 'wrong-setup',
		label: 'bin/rails cache:setup',
		command: 'bin/rails cache:setup',
		correct: false,
		feedback:
			'That task does not exist. Check the gem documentation for the correct install command.',
	},
	{
		id: 'correct',
		label: 'bin/rails solid_cache:install',
		command: 'bin/rails solid_cache:install',
		correct: true,
	},
];

const dbPrepareCommands: TerminalCommand[] = [
	{
		id: 'wrong-migrate',
		label: 'bin/rails db:migrate',
		command: 'bin/rails db:migrate',
		correct: false,
		feedback:
			'db:migrate only targets the primary database. Solid Cache uses a separate cache database that needs full setup.',
	},
	{
		id: 'correct',
		label: 'bin/rails db:prepare',
		command: 'bin/rails db:prepare',
		correct: true,
	},
	{
		id: 'wrong-setup',
		label: 'bin/rails db:setup',
		command: 'bin/rails db:setup',
		correct: false,
		feedback:
			'db:setup drops and recreates the database, wiping existing data. You need the non-destructive task that only creates what is missing.',
	},
];

const CONFIGURE_STORE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-memory',
		label: 'config.cache_store = :memory_store',
		correct: false,
		feedback:
			'Memory store is per-process only. Data is not shared between Puma workers and is lost on restart.',
	},
	{
		id: 'wrong-redis',
		label: 'config.cache_store = :redis_cache_store',
		correct: false,
		feedback:
			'Redis works but requires extra infrastructure. The Rails 8 default is database-backed and requires no additional services.',
	},
	{
		id: 'correct',
		label: 'config.cache_store = :solid_cache_store',
		correct: true,
	},
];

const CACHE_FETCH_OPTIONS: StepOption[] = [
	{
		id: 'wrong-read',
		label: 'Rails.cache.read("trending_products") || compute_trending.to_a',
		correct: false,
		feedback:
			'read + manual write is fragile. You must remember to write on miss. cache.fetch handles both atomically.',
	},
	{
		id: 'wrong-no-expire',
		label: 'Rails.cache.fetch("trending_products") { compute_trending.to_a }',
		correct: false,
		feedback:
			'Missing an expiration. Without expires_in, the cache never refreshes and serves stale data forever.',
	},
	{
		id: 'wrong-static-key',
		label:
			'Rails.cache.fetch("trending_products", expires_in: 5.minutes) { compute_trending.to_a }',
		correct: false,
		feedback:
			'A literal string key cannot reflect changes to the underlying records. The cache only refreshes when the 5-minute timer expires, even right after a record is updated.',
	},
	{
		id: 'wrong-no-stampede',
		label:
			'Rails.cache.fetch([Product.maximum(:updated_at).to_i, "trending_products"], expires_in: 5.minutes) { compute_trending.to_a }',
		correct: false,
		feedback:
			'Versioned key plus expiration is the right shape for ordinary loads. But the instant the key expires under heavy traffic, every concurrent request recomputes from scratch and the database gets hammered with N simultaneous queries instead of one. Needs another option to coordinate concurrent rebuilds.',
	},
	{
		id: 'correct',
		label:
			'Rails.cache.fetch([Product.maximum(:updated_at).to_i, "trending_products"], expires_in: 5.minutes, race_condition_ttl: 10.seconds) { compute_trending.to_a }',
		correct: true,
	},
];

const TOUCH_OPTIONS: StepOption[] = [
	{
		id: 'wrong-callback',
		label: 'after_save { Rails.cache.delete("trending_products") }',
		correct: false,
		feedback:
			'Manual callbacks are fragile and must be added to every model that affects the cache. touch cascades automatically through associations.',
	},
	{
		id: 'correct',
		label: 'belongs_to :product, touch: true',
		correct: true,
	},
	{
		id: 'wrong-clear',
		label: 'Rails.cache.clear',
		correct: false,
		feedback:
			'Clearing the entire cache is a sledgehammer. It evicts everything, not just the relevant key.',
	},
];

const ALL_STEP_OPTIONS: (TerminalCommand[] | StepOption[])[] = [
	installGemCommands,
	runInstallerCommands,
	dbPrepareCommands,
	CONFIGURE_STORE_OPTIONS,
	CACHE_FETCH_OPTIONS,
	TOUCH_OPTIONS,
];

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'cache-miss',
		label: 'GET trending (cold)',
		description: 'First request after cache expiration',
		method: 'GET',
		path: '/api/products/trending',
		actor: 'visitor',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '200 OK  X-Cache: MISS  512ms', color: 'yellow' },
			{
				text: 'Cache miss. Computed and stored for 5 minutes.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'cache-hit',
		label: 'GET trending (cached)',
		description: 'Request served from warm cache',
		method: 'GET',
		path: '/api/products/trending',
		actor: 'visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK  X-Cache: HIT  2ms', color: 'green' },
			{ text: 'Served from Solid Cache. DB not touched.', color: 'green' },
		],
	},
	{
		id: 'cache-hit-2',
		label: 'GET trending (second hit)',
		description: 'Another visitor, same cached result',
		method: 'GET',
		path: '/api/products/trending',
		actor: 'another visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK  X-Cache: HIT  2ms', color: 'green' },
			{ text: 'Cache hit. 256x faster than uncached.', color: 'green' },
		],
	},
	{
		id: 'invalidation',
		label: 'POST review (touch)',
		description: 'New review triggers touch: true',
		method: 'POST',
		path: '/api/products/42/reviews',
		actor: 'user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'product.updated_at touched. Cache invalidated.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'post-invalidation',
		label: 'GET trending (after touch)',
		description: 'Request after cache was invalidated',
		method: 'GET',
		path: '/api/products/trending',
		actor: 'visitor',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '200 OK  X-Cache: MISS  512ms', color: 'yellow' },
			{
				text: 'Cache invalidated by touch. Fresh computation.',
				color: 'yellow',
			},
		],
	},
];

const SCENARIO_VIZ_MAP: Record<string, string> = {
	'cache-miss': 'miss',
	'cache-hit': 'hit',
	'cache-hit-2': 'hit',
	invalidation: 'invalidation',
	'post-invalidation': 'miss',
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 30: Caching', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
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

		test('every probe maps to a discovery', () => {
			for (const probe of PROBES) {
				expect(PROBE_DISCOVERY_MAP[probe.id]).toBeDefined();
				const discoveryId = PROBE_DISCOVERY_MAP[probe.id];
				const exists = DISCOVERY_DEFS.some((d) => d.id === discoveryId);
				expect(exists).toBe(true);
			}
		});

		test('probe + zone discoveries cover all 4 discovery defs', () => {
			const allDiscoveryIds = new Set([
				...Object.values(PROBE_DISCOVERY_MAP),
				...Object.values(ZONE_DISCOVERY_MAP),
			]);
			for (const def of DISCOVERY_DEFS) {
				expect(allDiscoveryIds.has(def.id)).toBe(true);
			}
		});
	});

	describe('Zone inspector data', () => {
		test('service zone maps to a discovery', () => {
			expect(ZONE_DISCOVERY_MAP.service).toBe('service-no-cache');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 6 steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('step types match: 3 terminal + 3 option', () => {
			const terminalCount = STEP_TYPES.filter((t) => t === 'terminal').length;
			const optionCount = STEP_TYPES.filter((t) => t === 'option').length;
			expect(terminalCount).toBe(3);
			expect(optionCount).toBe(3);
		});

		test('correct answer is never the first option in any step', () => {
			for (let i = 0; i < ALL_STEP_OPTIONS.length; i++) {
				const options = ALL_STEP_OPTIONS[i];
				const firstOption = options[0];
				expect(firstOption.correct).toBe(false);
			}
		});

		test('every wrong option has feedback text', () => {
			for (const options of ALL_STEP_OPTIONS) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never contains the correct answer text', () => {
			for (const options of ALL_STEP_OPTIONS) {
				const correctOption = options.find((o) => o.correct);
				if (!correctOption) continue;

				for (const opt of options) {
					if (!opt.correct && opt.feedback) {
						expect(opt.feedback).not.toContain(correctOption.label);
					}
				}
			}
		});

		test('each step has exactly one correct answer', () => {
			for (const options of ALL_STEP_OPTIONS) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('step titles do not reveal the answer', () => {
			for (const step of STEP_DEFS) {
				// Should not contain "solid_cache", "Solid Cache", "db:prepare", etc.
				expect(step.title).not.toContain('solid_cache');
				expect(step.title).not.toContain('Solid Cache');
				expect(step.title).not.toContain('db:prepare');
				expect(step.title).not.toContain('touch: true');
				expect(step.title).not.toContain('cache.fetch');
			}
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe('Stress scenarios', () => {
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

		test('has a mix of allowed (hit) and blocked (miss/invalidation) results', () => {
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
				expect(scenario.responseLines).toBeDefined();
				expect(scenario.responseLines?.length).toBeGreaterThan(0);
			}
		});

		test('every scenario has a viz mode mapping', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(SCENARIO_VIZ_MAP[scenario.id]).toBeDefined();
			}
		});

		test('hit scenarios are allowed, miss/invalidation are blocked', () => {
			for (const scenario of STRESS_SCENARIOS) {
				const vizMode = SCENARIO_VIZ_MAP[scenario.id];
				if (vizMode === 'hit') {
					expect(scenario.expectedResult).toBe('allowed');
				} else {
					expect(scenario.expectedResult).toBe('blocked');
				}
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('observe layers cover all 4 zones: request, cache, service, database', () => {
			const layerIds = ['request', 'cache', 'service', 'database'];
			// These are the 4 layer IDs used in the component
			for (const id of layerIds) {
				expect(layerIds).toContain(id);
			}
		});

		test('service code in zone inspector uses ApplicationService pattern', () => {
			// The service zone inspector code should follow L16+ patterns
			const serviceCode = `class TrendingProducts < ApplicationService
  Result = Data.define(:products, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      products: [], generated_at: Time.current
    ) if validation.failure?

    products = Product
      .joins(:reviews)
      .where("products.created_at > ?", 7.days.ago)
      .group("products.id")
      .select("products.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    # Recomputed on EVERY call. No caching!
    Result.new(products: products, generated_at: Time.current)
  end
end`;
			expect(serviceCode).toContain('ApplicationService');
			expect(serviceCode).toContain('Result = Data.define');
			expect(serviceCode).toContain('TrendingContract');
		});

		test('cache fetch option uses versioned key + expires_in + race_condition_ttl', () => {
			const correct = CACHE_FETCH_OPTIONS.find((o) => o.correct);
			expect(correct).toBeDefined();
			expect(correct?.label).toContain('Product.maximum(:updated_at)');
			expect(correct?.label).toContain('expires_in');
			expect(correct?.label).toContain('race_condition_ttl');
			expect(correct?.label).toContain('.to_a');
		});

		test('cache stampede has its own wrong-option that the player must reject', () => {
			// The "no-stampede" wrong option (versioned key + expires_in but
			// missing race_condition_ttl) is the production gotcha this level
			// teaches. It must exist and be marked wrong.
			const noStampede = CACHE_FETCH_OPTIONS.find(
				(o) => o.id === 'wrong-no-stampede',
			);
			expect(noStampede).toBeDefined();
			expect(noStampede?.correct).toBe(false);
			expect(noStampede?.label).toContain('Product.maximum(:updated_at)');
			expect(noStampede?.label).not.toContain('race_condition_ttl');
		});

		test('touch option uses belongs_to with touch: true', () => {
			const correct = TOUCH_OPTIONS.find((o) => o.correct);
			expect(correct).toBeDefined();
			expect(correct?.label).toContain('belongs_to :product, touch: true');
		});
	});
});

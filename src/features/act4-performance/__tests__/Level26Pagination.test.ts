/**
 * Tests for Level 28: Pagination
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
	{ id: 'huge-response', label: 'Response is 12MB of JSON' },
	{ id: 'no-pagination', label: 'No pagination in controller' },
	{ id: 'memory-spike', label: 'Server loads 50K records into memory' },
	{ id: 'mobile-crash', label: 'Mobile clients crash parsing response' },
];

const PROBES: ProbeConfig[] = [
	{
		id: 'get-all-products',
		label: 'GET all products',
		command: 'GET /api/v1/products',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912  (12MB!)', color: 'yellow' },
			{ text: 'Transfer-Encoding: chunked', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: '[{"id":1,...},{"id":2,...},...,{"id":50000,...}]',
				color: 'muted',
			},
			{
				text: 'All 50,000 products returned. No pagination.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-mobile',
		label: 'GET from mobile client',
		command: 'GET /api/v1/products (iPhone, 3G connection)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Downloading 12MB on 3G... 45 seconds elapsed',
				color: 'yellow',
			},
			{
				text: 'JSON.parse() on 50K objects: out of memory.',
				color: 'red',
			},
			{ text: 'App crashed.', color: 'red' },
		],
	},
	{
		id: 'check-memory',
		label: 'Check server memory',
		command: 'rails runner "GC.stat[:heap_live_slots]"',
		responseLines: [
			{ text: '=> 2,847,391 live objects', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Product.includes(:user).all loads 50K AR objects + 50K User objects.',
				color: 'muted',
			},
			{
				text: 'Each request allocates ~180MB before serialization.',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-all-products': 'huge-response',
	'get-mobile': 'mobile-crash',
	'check-memory': 'memory-spike',
};

const ZONE_DISCOVERY_MAP: Record<string, string> = {
	database: 'no-pagination',
};

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Install Pagination Gem' },
	{ id: 'include-method', title: 'Include Controller Module' },
	{ id: 'configure-limit', title: 'Set Page Size' },
	{ id: 'wire-index', title: 'Paginate the Query' },
	{ id: 'add-headers', title: 'Add Navigation Headers' },
];

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-kaminari',
		label: 'bundle add kaminari',
		command: 'bundle add kaminari',
		correct: false,
		feedback:
			'Kaminari works but is significantly slower. The recommended pagination gem is 40x faster with a smaller memory footprint.',
	},
	{
		id: 'correct',
		label: 'bundle add pagy',
		command: 'bundle add pagy',
		correct: true,
	},
	{
		id: 'wrong-will-paginate',
		label: 'bundle add will_paginate',
		command: 'bundle add will_paginate',
		correct: false,
		feedback:
			'will_paginate is a legacy gem. The modern alternative is faster and supports offset, cursor, and keyset strategies.',
	},
];

const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-frontend',
		label: 'include Pagy::Frontend',
		correct: false,
		feedback:
			'Pagy::Frontend is for view helpers (HTML pagination links). API controllers need the module that provides the pagy() method.',
	},
	{
		id: 'correct',
		label: 'include Pagy::Method',
		correct: true,
	},
	{
		id: 'wrong-backend',
		label: 'include Pagy::Backend',
		correct: false,
		feedback:
			'That was the old module name from Pagy v8 and earlier. The v43+ API uses a different module name.',
	},
];

const CONFIGURE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-100',
		label: 'Pagy::OPTIONS[:limit] = 100',
		correct: false,
		feedback:
			'100 items per page is still too large for mobile clients. A typical API page size is much smaller.',
	},
	{
		id: 'wrong-old-api',
		label: 'Pagy::DEFAULT[:items] = 25',
		correct: false,
		feedback:
			'That is the old Pagy API (pre-v43). The current version uses OPTIONS and :limit instead of DEFAULT and :items.',
	},
	{
		id: 'correct',
		label: 'Pagy::OPTIONS[:limit] = 25',
		correct: true,
	},
];

const WIRE_INDEX_OPTIONS: StepOption[] = [
	{
		id: 'wrong-kaminari-style',
		label: '@products = result.scope.page(params[:page]).per(25)',
		correct: false,
		feedback:
			'That is Kaminari syntax. Pagy uses a different API: the pagy() method returns both metadata and the paginated collection.',
	},
	{
		id: 'wrong-manual',
		label: '@products = result.scope.limit(25).offset(params[:page].to_i * 25)',
		correct: false,
		feedback:
			'Manual LIMIT/OFFSET works but loses pagination metadata (total count, page links). The gem handles this automatically.',
	},
	{
		id: 'correct',
		label: '@pagy, @products = pagy(:offset, result.scope)',
		correct: true,
	},
];

const HEADERS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-body',
		label: 'render json: { data: @products, meta: { page: @pagy.page } }',
		correct: false,
		feedback:
			'Embedding pagination in the JSON body is non-standard. RFC 5988 specifies Link headers so the payload stays clean.',
	},
	{
		id: 'correct',
		label: 'response.headers.merge!(@pagy.headers_hash)',
		correct: true,
	},
	{
		id: 'wrong-custom',
		label: 'response.headers["X-Pagination"] = @pagy.to_json',
		correct: false,
		feedback:
			'Custom headers are non-standard. Pagy has built-in support for RFC 5988 Link headers via headers_hash.',
	},
];

const ALL_OPTION_STEPS: StepOption[][] = [
	INCLUDE_OPTIONS,
	CONFIGURE_OPTIONS,
	WIRE_INDEX_OPTIONS,
	HEADERS_OPTIONS,
];

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'page-1',
		label: 'GET page 1 (default)',
		description: 'First page of products, 25 items',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'web client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=2>; rel="next", </products?page=2000>; rel="last"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'page-50',
		label: 'GET page 50',
		description: 'Middle of the dataset',
		method: 'GET',
		path: '/api/v1/products?page=50',
		actor: 'web client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=49>; rel="prev", </products?page=51>; rel="next"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'page-2000',
		label: 'GET page 2000 (last)',
		description: 'Last page of 50K products',
		method: 'GET',
		path: '/api/v1/products?page=2000',
		actor: 'mobile client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Link: </products?page=1999>; rel="prev"',
				color: 'green',
			},
			{ text: 'Content-Length: 6,250  (6KB, 25 items)', color: 'green' },
		],
	},
	{
		id: 'mobile-page-1',
		label: 'GET page 1 (mobile)',
		description: 'Mobile client gets paginated response',
		method: 'GET',
		path: '/api/v1/products?page=1',
		actor: 'iPhone (3G)',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{
				text: 'Content-Length: 6,250  (6KB on 3G = 0.1s)',
				color: 'green',
			},
			{ text: 'Mobile renders instantly.', color: 'green' },
		],
	},
	{
		id: 'invalid-page',
		label: 'GET page 99999',
		description: 'Page beyond dataset range',
		method: 'GET',
		path: '/api/v1/products?page=99999',
		actor: 'API client',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'Pagy::OverflowError: page 99999 out of 1..2000',
				color: 'red',
			},
			{ text: 'Returned: []  (empty array)', color: 'red' },
		],
	},
];

const SCENARIO_PAGE_MAP: Record<string, number> = {
	'page-1': 1,
	'page-50': 50,
	'page-2000': 2000,
	'mobile-page-1': 1,
	'invalid-page': 99999,
};

// Page-to-bar mapping helper (mirrored from component)
// 20 bars, each covering 2,500 records (100 pages of 25)
function pageToBar(page: number): number | null {
	if (page < 1 || page > 2000) return null;
	const barIndex = Math.floor((page - 1) / 100);
	return barIndex < 20 ? barIndex : null;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Level 28: Pagination', () => {
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

		test('every probe has response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
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

		test('all discoveries are reachable via probes + zones', () => {
			const reachable = new Set([
				...Object.values(PROBE_DISCOVERY_MAP),
				...Object.values(ZONE_DISCOVERY_MAP),
			]);
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});

		test('get-all-products probe mentions 12MB response', () => {
			const probe = PROBES.find((p) => p.id === 'get-all-products');
			expect(probe).toBeTruthy();
			const has12MB = probe?.responseLines.some((l) => l.text.includes('12'));
			expect(has12MB).toBe(true);
		});

		test('get-mobile probe mentions crash', () => {
			const probe = PROBES.find((p) => p.id === 'get-mobile');
			expect(probe).toBeTruthy();
			const hasCrash = probe?.responseLines.some((l) =>
				l.text.toLowerCase().includes('crash'),
			);
			expect(hasCrash).toBe(true);
		});

		test('check-memory probe mentions 180MB allocation', () => {
			const probe = PROBES.find((p) => p.id === 'check-memory');
			expect(probe).toBeTruthy();
			const has180MB = probe?.responseLines.some((l) =>
				l.text.includes('180MB'),
			);
			expect(has180MB).toBe(true);
		});
	});

	// ── Build step quality ──

	describe('Build steps', () => {
		test('step definitions have unique IDs', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('5 total steps (1 terminal + 4 option)', () => {
			expect(STEP_DEFS.length).toBe(5);
		});

		test('terminal step 0: correct answer is not first', () => {
			const correctIndex = addGemCommands.findIndex((c) => c.correct);
			expect(correctIndex).toBeGreaterThan(0);
		});

		test('terminal step 0: exactly one correct answer', () => {
			const correctCount = addGemCommands.filter((c) => c.correct).length;
			expect(correctCount).toBe(1);
		});

		test('terminal step 0: every wrong option has feedback', () => {
			for (const cmd of addGemCommands) {
				if (!cmd.correct) {
					expect(cmd.feedback).toBeTruthy();
				}
			}
		});

		test('terminal step 0: feedback does not reveal the answer', () => {
			const correctCommand = addGemCommands.find((c) => c.correct);
			for (const cmd of addGemCommands) {
				if (!cmd.correct && cmd.feedback) {
					expect(cmd.feedback).not.toContain(correctCommand?.command ?? '');
					expect(cmd.feedback).not.toContain('bundle add pagy');
				}
			}
		});

		test('terminal step 0: correct answer is "bundle add pagy"', () => {
			const correct = addGemCommands.find((c) => c.correct);
			expect(correct?.command).toBe('bundle add pagy');
		});

		for (const [idx, options] of ALL_OPTION_STEPS.entries()) {
			const stepNum = idx + 1;

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

		test('step 1 correct answer uses Pagy::Method (v43 API)', () => {
			const correct = INCLUDE_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('Pagy::Method');
			expect(correct?.label).not.toContain('Backend');
		});

		test('step 2 correct answer uses Pagy::OPTIONS (v43 API)', () => {
			const correct = CONFIGURE_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('Pagy::OPTIONS');
			expect(correct?.label).not.toContain('DEFAULT');
		});

		test('step 3 correct answer uses pagy(:offset, ...) (v43 API)', () => {
			const correct = WIRE_INDEX_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('pagy(:offset');
		});

		test('step 4 correct answer uses headers_hash (v43 API)', () => {
			const correct = HEADERS_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('headers_hash');
			expect(correct?.label).not.toContain('pagy_headers_merge');
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
			expect(allowed.length).toBe(4);
			expect(blocked.length).toBe(1);
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

		test('allowed scenarios mention 6KB or 25 items', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const mentions6KB = scenario.responseLines?.some(
					(l) => l.text.includes('6') || l.text.includes('25'),
				);
				expect(mentions6KB).toBe(true);
			}
		});

		test('blocked scenario mentions overflow', () => {
			const blocked = STRESS_SCENARIOS.find(
				(s) => s.expectedResult === 'blocked',
			);
			expect(blocked).toBeTruthy();
			const mentionsOverflow = blocked?.responseLines?.some(
				(l) => l.text.includes('Overflow') || l.text.includes('out of'),
			);
			expect(mentionsOverflow).toBe(true);
		});

		test('every scenario has a page mapping', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(SCENARIO_PAGE_MAP[scenario.id]).toBeDefined();
			}
		});
	});

	// ── Page-to-bar mapping ──

	describe('Page-to-bar mapping', () => {
		test('page 1 maps to bar 0', () => {
			expect(pageToBar(1)).toBe(0);
		});

		test('page 50 maps to bar 0 (first 100 pages in bar 0)', () => {
			expect(pageToBar(50)).toBe(0);
		});

		test('page 101 maps to bar 1', () => {
			expect(pageToBar(101)).toBe(1);
		});

		test('page 2000 maps to bar 19 (last bar)', () => {
			expect(pageToBar(2000)).toBe(19);
		});

		test('page 99999 maps to null (out of range)', () => {
			expect(pageToBar(99999)).toBe(null);
		});

		test('page 0 maps to null (invalid)', () => {
			expect(pageToBar(0)).toBe(null);
		});

		test('page -1 maps to null (invalid)', () => {
			expect(pageToBar(-1)).toBe(null);
		});

		test('allowed scenarios map to valid bars (0-19)', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const page = SCENARIO_PAGE_MAP[scenario.id];
				const bar = pageToBar(page);
				expect(bar).not.toBe(null);
				expect(bar).toBeGreaterThanOrEqual(0);
				expect(bar).toBeLessThan(20);
			}
		});

		test('blocked scenario maps to null bar', () => {
			const blocked = STRESS_SCENARIOS.find(
				(s) => s.expectedResult === 'blocked',
			);
			expect(blocked).toBeTruthy();
			const page = SCENARIO_PAGE_MAP[blocked?.id ?? ''];
			expect(pageToBar(page)).toBe(null);
		});
	});

	// ── Cross-phase consistency ──

	describe('Cross-phase consistency', () => {
		test('observe probes show the problem (12MB, crash, memory)', () => {
			const probeIds = PROBES.map((p) => p.id);
			expect(probeIds).toContain('get-all-products');
			expect(probeIds).toContain('get-mobile');
			expect(probeIds).toContain('check-memory');
		});

		test('reward scenarios show the fix (6KB pages, Link headers)', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			for (const scenario of allowed) {
				const hasSmallPayload = scenario.responseLines?.some(
					(l) => l.text.includes('6') && l.color === 'green',
				);
				expect(hasSmallPayload).toBe(true);
			}
		});

		test('observe and reward cover the same endpoint', () => {
			// Observe probes hit /api/v1/products
			const observeEndpoint = PROBES[0].command;
			expect(observeEndpoint).toContain('/api/v1/products');

			// Reward scenarios also hit /api/v1/products
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.path).toContain('/api/v1/products');
			}
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
				for (const line of scenario.responseLines ?? []) {
					expect(line.text).not.toContain('\u2014');
				}
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

		test('all text uses Pagy v43 API (not old API)', () => {
			// The correct answers should use v43 API
			const includeCorrect = INCLUDE_OPTIONS.find((o) => o.correct);
			expect(includeCorrect?.label).not.toContain('Backend');

			const configCorrect = CONFIGURE_OPTIONS.find((o) => o.correct);
			expect(configCorrect?.label).not.toContain('DEFAULT');
			expect(configCorrect?.label).not.toContain(':items');

			const wireCorrect = WIRE_INDEX_OPTIONS.find((o) => o.correct);
			expect(wireCorrect?.label).toContain(':offset');

			const headersCorrect = HEADERS_OPTIONS.find((o) => o.correct);
			expect(headersCorrect?.label).toContain('headers_hash');
		});

		test('discovery IDs match between defs and maps', () => {
			const defIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			const probeMapIds = new Set(Object.values(PROBE_DISCOVERY_MAP));
			const zoneMapIds = new Set(Object.values(ZONE_DISCOVERY_MAP));
			const allMappedIds = new Set([...probeMapIds, ...zoneMapIds]);

			// Every mapped ID should be in the defs
			for (const id of allMappedIds) {
				expect(defIds.has(id)).toBe(true);
			}
			// Every def ID should be reachable
			for (const id of defIds) {
				expect(allMappedIds.has(id)).toBe(true);
			}
		});
	});
});

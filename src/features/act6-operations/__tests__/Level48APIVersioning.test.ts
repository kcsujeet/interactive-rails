/**
 * Level 40: API Versioning
 *
 * Tests mirror data structures to verify:
 * - Discovery defs and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level48APIVersioning.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'single-controller', label: 'One controller serves all API versions' },
	{
		id: 'breaking-change',
		label: 'Response shape change breaks v1 clients',
	},
	{ id: 'no-deprecation', label: 'No deprecation warning for v1 consumers' },
	{ id: 'no-migration-path', label: 'No v2 endpoint exists for new clients' },
];

const PROBES = [
	{
		id: 'v1-format-break',
		label: 'v1 partner fetches order (format changed)',
		command: 'curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '{ "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'yellow',
			},
			{
				text: '# v1 partner expects total as integer (1999 cents)',
				color: 'red',
			},
			{
				text: '# Their code: order.total / 100 -> NaN (got object)',
				color: 'red',
			},
		],
	},
	{
		id: 'no-deprecation',
		label: 'v1 partner checks for deprecation notice',
		command:
			'curl -I localhost:3000/api/orders/42 | grep -i "deprecation\\|sunset"',
		responseLines: [
			{ text: '# Checking response headers...', color: 'cyan' },
			{
				text: '# No Deprecation header found',
				color: 'red',
			},
			{
				text: '# No Sunset header found',
				color: 'red',
			},
			{
				text: '# Partner has no idea changes are coming',
				color: 'red',
			},
		],
	},
	{
		id: 'v2-404',
		label: 'v2 partner wants money object format',
		command: 'curl localhost:3000/api/v2/orders/42',
		responseLines: [
			{
				text: '404 Not Found',
				color: 'red',
			},
			{
				text: '{ "error": { "code": "NOT_FOUND", "message": "No route matches /api/v2/*" } }',
				color: 'red',
			},
			{
				text: '# No /api/v2 namespace exists',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'v1-format-break': ['single-controller', 'breaking-change'],
	'no-deprecation': ['no-deprecation'],
	'v2-404': ['no-migration-path'],
};

// ── Build step option arrays ──

const WRAP_V1_ROUTES_COMMANDS = [
	{
		id: 'wrong-leave-flat',
		label: 'Leave routes flat: namespace :api do; resources :orders; end',
		correct: false,
		feedback:
			'Leaving the routes flat means a future v2 has nowhere to live. To ship a new format alongside the old one, the existing partners need to be pinned to a stable surface first.',
	},
	{
		id: 'wrong-scope-v1',
		label: 'scope "/api/v1" do; resources :orders; end',
		correct: false,
		feedback:
			'scope only changes the URL prefix, not the controller module. Routes would point at Api::OrdersController, but the file still lives at app/controllers/api/orders_controller.rb. Module path and URL path must move together.',
	},
	{
		id: 'correct',
		label: 'namespace :api do; namespace :v1 do; resources :orders; end; end',
		correct: true,
	},
];

const ADD_V2_ROUTES_COMMANDS = [
	{
		id: 'wrong-replace-v1',
		label: 'Replace v1 entirely with v2 (drop the v1 block)',
		correct: false,
		feedback:
			'Replacing the existing version block breaks every partner that integrated with the old format. The whole point of versioning is keeping the old surface stable while you evolve the new one. Both must coexist.',
	},
	{
		id: 'wrong-scope-v2',
		label: 'scope "/api/v2" do; resources :orders; end',
		correct: false,
		feedback:
			'scope only changes the URL path, not the controller module. Routes still hit Api::OrdersController instead of a dedicated v2 controller.',
	},
	{
		id: 'correct',
		label: 'Add a parallel namespace block for v2 alongside v1',
		correct: true,
	},
];

const GENERATE_V2_COMMANDS = [
	{
		id: 'wrong-no-namespace',
		label: 'rails g controller Orders show index',
		correct: false,
		feedback:
			'This generates an unnamespaced controller. You need Api::V2::OrdersController to match the v2 route namespace.',
	},
	{
		id: 'correct',
		label: 'rails g controller api/v2/orders show index',
		correct: true,
	},
	{
		id: 'wrong-v1',
		label: 'rails g controller api/v1/orders show index',
		correct: false,
		feedback:
			'V1 already exists. You need to generate the V2 controller alongside it.',
	},
];

const V2_SERIALIZER_OPTIONS = [
	{
		id: 'wrong-modify-v1',
		label: 'Modify existing Api::V1::OrderSerializer',
		correct: false,
		feedback:
			'Modifying v1 serializer changes the response for existing partners. Each version needs its own serializer so changes are isolated.',
	},
	{
		id: 'wrong-conditional',
		label: 'Conditional serializer based on version header',
		correct: false,
		feedback:
			'A shared serializer with conditionals couples versions together. Adding v3 logic later makes this unmanageable. Separate serializers per version.',
	},
	{
		id: 'correct',
		label: 'New Api::V2::OrderSerializer with money object',
		correct: true,
	},
];

const DEPRECATION_OPTIONS = [
	{
		id: 'wrong-no-headers',
		label: 'No deprecation signal (just update docs)',
		correct: false,
		feedback:
			'Documentation alone is not enough. Partners parse response headers programmatically. Without Deprecation headers, automated migration tools cannot detect the change.',
	},
	{
		id: 'correct',
		label: 'Add Deprecation and Link headers to v1',
		correct: true,
	},
	{
		id: 'wrong-body-warning',
		label: 'Add deprecation warning in response body',
		correct: false,
		feedback:
			'Adding a warning field to the response body changes the response shape, which is itself a breaking change. Deprecation signals belong in HTTP headers, not the body.',
	},
];

const SUNSET_OPTIONS = [
	{
		id: 'wrong-no-date',
		label: 'Sunset header with no date',
		correct: false,
		feedback:
			'The Sunset header (RFC 8594) requires an HTTP-date value. "soon" is not a valid date. Partners need a concrete deadline to plan their migration.',
	},
	{
		id: 'wrong-past-date',
		label: 'Sunset date in the past',
		correct: false,
		feedback:
			'A sunset date in the past implies v1 should already be gone. Partners need 6-12 months of notice. Set a future date.',
	},
	{
		id: 'correct',
		label: 'Sunset header with future date (12 months)',
		correct: true,
	},
];

const FREEZE_V1_OPTIONS = [
	{
		id: 'wrong-direct-render',
		label: 'Render JSON directly in v1 controller',
		correct: false,
		feedback:
			'Inline JSON in the controller bypasses the service object pattern (L16+). The controller should delegate to a service and use a dedicated v1 serializer.',
	},
	{
		id: 'wrong-shared-serializer',
		label: 'Use the shared (unversioned) serializer',
		correct: false,
		feedback:
			'Using the shared serializer means v1 output changes whenever the shared serializer is updated. V1 needs its own frozen serializer to guarantee stability.',
	},
	{
		id: 'correct',
		label: 'Dedicated v1 serializer via service',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ name: 'WRAP_V1_ROUTES_COMMANDS', options: WRAP_V1_ROUTES_COMMANDS },
	{ name: 'ADD_V2_ROUTES_COMMANDS', options: ADD_V2_ROUTES_COMMANDS },
	{ name: 'GENERATE_V2_COMMANDS', options: GENERATE_V2_COMMANDS },
	{ name: 'V2_SERIALIZER_OPTIONS', options: V2_SERIALIZER_OPTIONS },
	{ name: 'DEPRECATION_OPTIONS', options: DEPRECATION_OPTIONS },
	{ name: 'SUNSET_OPTIONS', options: SUNSET_OPTIONS },
	{ name: 'FREEZE_V1_OPTIONS', options: FREEZE_V1_OPTIONS },
];

// ── Stress scenarios ──

const STRESS_SCENARIOS = [
	{
		id: 'v1-format-break',
		label: 'v1 partner fetches order (versioned)',
		description: 'v1 Partner gets cents format with deprecation headers',
		method: 'GET' as const,
		path: '/api/v1/orders/42',
		actor: 'v1-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '{ "total": 1999 }', color: 'green' },
			{ text: 'Deprecation: true, Sunset: 2027-06-01', color: 'yellow' },
		],
	},
	{
		id: 'no-deprecation',
		label: 'v1 partner checks deprecation (with headers)',
		description: 'Deprecation + Sunset + Link headers present',
		method: 'GET' as const,
		path: '/api/v1/orders/42',
		actor: 'v1-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'Deprecation: true', color: 'yellow' },
			{ text: 'Sunset: Sun, 01 Jun 2027 00:00:00 GMT', color: 'yellow' },
			{
				text: 'Link: </api/v2/docs>; rel="successor-version"',
				color: 'green',
			},
		],
	},
	{
		id: 'v2-404',
		label: 'v2 partner gets money object (versioned)',
		description: 'v2 endpoint exists with structured format',
		method: 'GET' as const,
		path: '/api/v2/orders/42',
		actor: 'v2-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '{ "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'green',
			},
		],
	},
	{
		id: 'v1-v2-coexist',
		label: 'v1 and v2 coexist simultaneously',
		description: 'Both versions serve correct format at the same time',
		method: 'GET' as const,
		path: '/api/v1 + /api/v2',
		actor: 'both',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'v1: { "total": 1999 } + Deprecation headers',
				color: 'yellow',
			},
			{
				text: 'v2: { "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'green',
			},
			{ text: 'Both versions active, zero conflicts', color: 'green' },
		],
	},
	{
		id: 'v3-not-found',
		label: 'GET /api/v3/orders (unknown version)',
		description: 'Unknown version returns 404',
		method: 'GET' as const,
		path: '/api/v3/orders/42',
		actor: 'unknown',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '404 Not Found', color: 'red' },
			{ text: 'No /api/v3 namespace configured', color: 'muted' },
		],
	},
];

// ── Tests ──

describe('Level 40: API Versioning', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all labels unique and non-empty', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
			for (const label of labels) {
				expect(label.length).toBeGreaterThan(5);
			}
		});

		test('exact IDs match component', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(ids).toEqual([
				'single-controller',
				'breaking-change',
				'no-deprecation',
				'no-migration-path',
			]);
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES.length).toBe(3);
		});

		test('exact probe IDs', () => {
			expect(PROBES.map((p) => p.id)).toEqual([
				'v1-format-break',
				'no-deprecation',
				'v2-404',
			]);
		});

		test('v1-format-break probe has 4 response lines', () => {
			const probe = PROBES.find((p) => p.id === 'v1-format-break');
			expect(probe?.responseLines.length).toBe(4);
		});

		test('no-deprecation probe has 4 response lines', () => {
			const probe = PROBES.find((p) => p.id === 'no-deprecation');
			expect(probe?.responseLines.length).toBe(4);
		});

		test('v2-404 probe has 3 response lines', () => {
			const probe = PROBES.find((p) => p.id === 'v2-404');
			expect(probe?.responseLines.length).toBe(3);
		});

		test('v1-format-break probe shows NaN error', () => {
			const probe = PROBES.find((p) => p.id === 'v1-format-break');
			expect(probe?.responseLines[3].text).toBe(
				'# Their code: order.total / 100 -> NaN (got object)',
			);
		});

		test('no-deprecation probe shows missing headers', () => {
			const probe = PROBES.find((p) => p.id === 'no-deprecation');
			expect(probe?.responseLines[1].text).toBe(
				'# No Deprecation header found',
			);
			expect(probe?.responseLines[2].text).toBe('# No Sunset header found');
		});

		test('v2-404 probe shows 404 error', () => {
			const probe = PROBES.find((p) => p.id === 'v2-404');
			expect(probe?.responseLines[0].text).toBe('404 Not Found');
			expect(probe?.responseLines[2].text).toBe(
				'# No /api/v2 namespace exists',
			);
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to at least one discovery', () => {
			for (const probe of PROBES) {
				const mapped = PROBE_DISCOVERY_MAP[probe.id];
				expect(mapped).toBeDefined();
				expect(mapped.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped discovery IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const [, discoveryIds] of Object.entries(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveryIds) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via probes', () => {
			const allMapped = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(allMapped.has(def.id)).toBe(true);
			}
		});

		test('v1-format-break maps to single-controller and breaking-change', () => {
			expect(PROBE_DISCOVERY_MAP['v1-format-break']).toEqual([
				'single-controller',
				'breaking-change',
			]);
		});

		test('no-deprecation maps to no-deprecation', () => {
			expect(PROBE_DISCOVERY_MAP['no-deprecation']).toEqual(['no-deprecation']);
		});

		test('v2-404 maps to no-migration-path', () => {
			expect(PROBE_DISCOVERY_MAP['v2-404']).toEqual(['no-migration-path']);
		});
	});

	describe('Build step quality', () => {
		for (const { name, options } of ALL_OPTION_SETS) {
			describe(name, () => {
				test('has exactly 3 options', () => {
					expect(options.length).toBe(3);
				});

				test('exactly one correct answer', () => {
					const correctCount = options.filter((o) => o.correct).length;
					expect(correctCount).toBe(1);
				});

				test('correct answer is not the first option', () => {
					expect(options[0].correct).toBe(false);
				});

				test('every wrong option has non-empty feedback', () => {
					const wrongOptions = options.filter((o) => !o.correct);
					for (const opt of wrongOptions) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(10);
					}
				});
			});
		}

		test('WRAP_V1_ROUTES feedback does not reveal "namespace :v1 do" answer', () => {
			const wrong = WRAP_V1_ROUTES_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('namespace :v1 do');
			}
		});

		test('ADD_V2_ROUTES feedback does not contain "namespace :v2 do" answer', () => {
			const wrong = ADD_V2_ROUTES_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('namespace :v2 do');
			}
		});

		test('GENERATE_V2 feedback does not contain "api/v2/orders"', () => {
			const wrong = GENERATE_V2_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('api/v2/orders');
			}
		});

		test('V2_SERIALIZER feedback does not contain "Api::V2::OrderSerializer"', () => {
			const wrong = V2_SERIALIZER_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('Api::V2::OrderSerializer');
			}
		});

		test('DEPRECATION feedback does not contain "add_deprecation_headers" or "before_action"', () => {
			const wrong = DEPRECATION_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('add_deprecation_headers');
				expect(opt.feedback ?? '').not.toContain('before_action');
			}
		});

		test('SUNSET feedback does not contain "2027" or "Jun"', () => {
			const wrong = SUNSET_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('2027');
				expect(opt.feedback ?? '').not.toContain('Jun');
			}
		});

		test('FREEZE_V1 feedback does not contain "Api::V1::OrderSerializer"', () => {
			const wrong = FREEZE_V1_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('Api::V1::OrderSerializer');
			}
		});
	});

	describe('Stress scenarios', () => {
		test('has exactly 5 scenarios', () => {
			expect(STRESS_SCENARIOS.length).toBe(5);
		});

		test('all IDs unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all labels unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('exact scenario IDs', () => {
			expect(STRESS_SCENARIOS.map((s) => s.id)).toEqual([
				'v1-format-break',
				'no-deprecation',
				'v2-404',
				'v1-v2-coexist',
				'v3-not-found',
			]);
		});

		test('every scenario has non-empty responseLines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBeGreaterThanOrEqual(2);
				expect(s.responseLines[0].text.length).toBeGreaterThan(0);
			}
		});

		test('response line counts match exactly', () => {
			const counts: Record<string, number> = {
				'v1-format-break': 3,
				'no-deprecation': 3,
				'v2-404': 2,
				'v1-v2-coexist': 3,
				'v3-not-found': 2,
			};
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBe(counts[s.id]);
			}
		});

		test('mix of allowed and blocked', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(4);
			expect(blocked.length).toBe(1);
		});

		test('specific expected results match', () => {
			const resultMap = Object.fromEntries(
				STRESS_SCENARIOS.map((s) => [s.id, s.expectedResult]),
			);
			expect(resultMap['v1-format-break']).toBe('allowed');
			expect(resultMap['no-deprecation']).toBe('allowed');
			expect(resultMap['v2-404']).toBe('allowed');
			expect(resultMap['v1-v2-coexist']).toBe('allowed');
			expect(resultMap['v3-not-found']).toBe('blocked');
		});

		test('v1-format-break scenario shows cents format', () => {
			const s = STRESS_SCENARIOS.find((s) => s.id === 'v1-format-break');
			expect(s?.responseLines[1].text).toBe('{ "total": 1999 }');
			expect(s?.responseLines[2].text).toBe(
				'Deprecation: true, Sunset: 2027-06-01',
			);
		});

		test('v2-404 scenario shows money object', () => {
			const s = STRESS_SCENARIOS.find((s) => s.id === 'v2-404');
			expect(s?.responseLines[0].text).toBe('200 OK');
			expect(s?.responseLines[1].text).toBe(
				'{ "total": { "amount": "19.99", "currency": "USD" } }',
			);
		});

		test('v3-not-found scenario returns 404', () => {
			const s = STRESS_SCENARIOS.find((s) => s.id === 'v3-not-found');
			expect(s?.responseLines[0].text).toBe('404 Not Found');
		});

		test('all scenarios use GET method', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.method).toBe('GET');
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe has a matching reward scenario', () => {
			const probeIds = PROBES.map((p) => p.id);
			const scenarioIds = STRESS_SCENARIOS.map((s) => s.id);
			for (const probeId of probeIds) {
				expect(scenarioIds).toContain(probeId);
			}
		});

		test('probe and scenario labels mirror each other', () => {
			for (const probe of PROBES) {
				const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
				expect(scenario).toBeDefined();

				if (probe.id === 'v1-format-break') {
					expect(probe.label).toContain('v1 partner');
					expect(scenario?.label).toContain('v1 partner');
				}
				if (probe.id === 'no-deprecation') {
					expect(probe.label).toContain('deprecation');
					expect(scenario?.label).toContain('deprecation');
				}
				if (probe.id === 'v2-404') {
					expect(probe.label).toContain('v2 partner');
					expect(scenario?.label).toContain('v2 partner');
				}
			}
		});

		test('reward scenarios include additional scenarios beyond observe probes', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			const extras = STRESS_SCENARIOS.filter((s) => !probeIds.has(s.id));
			expect(extras.length).toBe(2);
			expect(extras.map((e) => e.id)).toContain('v1-v2-coexist');
			expect(extras.map((e) => e.id)).toContain('v3-not-found');
		});
	});
});

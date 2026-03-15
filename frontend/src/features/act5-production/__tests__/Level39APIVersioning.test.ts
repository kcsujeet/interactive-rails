/**
 * Level 39: API Versioning
 *
 * Tests mirror data structures to verify:
 * - Discovery defs and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency
 * - Cumulative pattern compliance (service objects, serializers)
 * - Data consistency
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data ──

const DISCOVERY_DEFS = [
	{ id: 'single-controller', label: 'One controller serves all API versions' },
	{
		id: 'breaking-change',
		label: 'Response shape change breaks v1 clients',
	},
	{ id: 'no-deprecation', label: 'No deprecation warning for v1 consumers' },
	{ id: 'no-migration-path', label: 'No migration path from v1 to v2' },
];

const PROBES = [
	{
		id: 'v1-expects-cents',
		label: 'GET /api/orders/42 (v1 client)',
		command: 'curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '{ "id": 42, "total": 1999 }', color: 'green' },
			{
				text: '# v1 client expects "total" as integer cents',
				color: 'cyan',
			},
			{
				text: '# No deprecation header. Client has no idea v2 exists.',
				color: 'amber',
			},
		],
	},
	{
		id: 'v2-wants-object',
		label: 'GET /api/orders/42 (v2 client)',
		command:
			'curl localhost:3000/api/orders/42 -H "Accept: application/json"',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '{ "id": 42, "total": 1999 }', color: 'amber' },
			{
				text: '# v2 client expects { "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'red',
			},
			{
				text: '# Gets integer cents instead. No versioned endpoint exists.',
				color: 'red',
			},
		],
	},
	{
		id: 'breaking-deploy',
		label: 'GET /api/orders/42 (after format change)',
		command:
			'# Deploy new response format, then: curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'amber' },
			{
				text: '{ "id": 42, "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'amber',
			},
			{
				text: '# 200 partners parse response["total"] as integer',
				color: 'red',
			},
			{
				text: "# Their apps crash: \"undefined method `/' for Hash\"",
				color: 'red',
			},
			{
				text: '# No way to serve BOTH formats from one controller',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'v1-expects-cents': ['no-deprecation', 'no-migration-path'],
	'v2-wants-object': ['single-controller'],
	'breaking-deploy': ['breaking-change'],
};

const STEP_DEFS = [
	{ id: 'add-v2-routes', label: 'Add Version Namespace' },
	{ id: 'generate-v2-controller', label: 'Generate V2 Controller' },
	{ id: 'create-v2-serializer', label: 'Create V2 Serializer' },
	{ id: 'add-deprecation', label: 'Add Deprecation Headers' },
	{ id: 'add-sunset', label: 'Add Sunset Header' },
	{ id: 'wire-v1-service', label: 'Wire V1 Controller' },
];

const ADD_V2_ROUTES_COMMANDS = [
	{
		id: 'wrong-single-namespace',
		label: 'namespace :api do; resources :orders; end',
		correct: false,
		feedback:
			'A single namespace serves one version. You need nested version namespaces so v1 and v2 can coexist under /api/v1/ and /api/v2/.',
	},
	{
		id: 'correct',
		label:
			'namespace :api do; namespace :v1 do; ... end; namespace :v2 do; ... end; end',
		correct: true,
	},
	{
		id: 'wrong-scope',
		label: 'scope "/v2" do; resources :orders; end',
		correct: false,
		feedback:
			'scope changes the URL but not the controller lookup path. The controller would still be OrdersController, not Api::V2::OrdersController. Use namespace instead.',
	},
];

const GENERATE_V2_CONTROLLER_COMMANDS = [
	{
		id: 'wrong-no-namespace',
		label: 'rails g controller Orders show --no-helper',
		correct: false,
		feedback:
			'This generates OrdersController in the root namespace. You need a controller nested under Api::V2:: to match the versioned route namespace.',
	},
	{
		id: 'wrong-v1',
		label: 'rails g controller api/v1/orders show --no-helper',
		correct: false,
		feedback:
			'This generates the v1 controller, which already exists. You need the v2 controller for the new response format.',
	},
	{
		id: 'correct',
		label: 'rails g controller api/v2/orders show --no-helper',
		correct: true,
	},
];

const CREATE_V2_SERIALIZER_OPTIONS = [
	{
		id: 'wrong-modify-v1',
		label: 'Modify existing v1 serializer to return object format',
		correct: false,
		feedback:
			'Modifying the v1 serializer changes the response for all v1 clients. The whole point of versioning is that v1 stays frozen. Create a new v2 serializer instead.',
	},
	{
		id: 'correct',
		label: 'New v2 serializer with object format, v1 stays frozen',
		correct: true,
	},
	{
		id: 'wrong-conditional',
		label: 'One serializer with version parameter',
		correct: false,
		feedback:
			'Conditional logic in a shared serializer makes it fragile. Adding v3 means more branches. Separate serializers per version are simpler and independently testable.',
	},
];

const ADD_DEPRECATION_OPTIONS = [
	{
		id: 'wrong-no-headers',
		label: 'Log deprecation but send no headers',
		correct: false,
		feedback:
			'Server-side logging does not help API consumers. Clients need HTTP headers to detect deprecation programmatically and trigger migration alerts.',
	},
	{
		id: 'correct',
		label: 'Deprecation + Link headers in before_action',
		correct: true,
	},
	{
		id: 'wrong-body-warning',
		label: 'Add deprecation warning in response body',
		correct: false,
		feedback:
			'Adding fields to the response body changes the contract and may break clients that strictly parse the schema. Use HTTP headers for metadata.',
	},
];

const ADD_SUNSET_OPTIONS = [
	{
		id: 'wrong-no-date',
		label: 'Sunset header with no specific date',
		correct: false,
		feedback:
			'The Sunset header must contain an HTTP-date (RFC 7231) so clients can programmatically schedule their migration. "soon" is not parseable.',
	},
	{
		id: 'wrong-past-date',
		label: 'Sunset header with past date',
		correct: false,
		feedback:
			'A past date implies the endpoint should already be removed. Clients may interpret this as "already retired" and stop calling. Use a future date.',
	},
	{
		id: 'correct',
		label: 'Sunset header with future date (RFC 7231 format)',
		correct: true,
	},
];

const WIRE_V1_SERVICE_OPTIONS = [
	{
		id: 'wrong-direct-render',
		label: 'Render JSON hash directly in controller',
		correct: false,
		feedback:
			'Rendering raw hashes in controllers bypasses serializers and the service layer. The controller should delegate to a service that returns a Result, then render via the versioned serializer.',
	},
	{
		id: 'correct',
		label: 'Controller delegates to service, renders via v1 serializer',
		correct: true,
	},
	{
		id: 'wrong-no-serializer',
		label: 'Service returns data, controller renders without serializer',
		correct: false,
		feedback:
			'as_json bypasses the serializer, making the response shape implicit and hard to test. Use the versioned serializer to ensure the contract is explicit and locked.',
	},
];

const ALL_OPTION_SETS = [
	{
		name: 'CREATE_V2_SERIALIZER_OPTIONS',
		options: CREATE_V2_SERIALIZER_OPTIONS,
	},
	{ name: 'ADD_DEPRECATION_OPTIONS', options: ADD_DEPRECATION_OPTIONS },
	{ name: 'ADD_SUNSET_OPTIONS', options: ADD_SUNSET_OPTIONS },
	{ name: 'WIRE_V1_SERVICE_OPTIONS', options: WIRE_V1_SERVICE_OPTIONS },
];

const ALL_COMMAND_SETS = [
	{ name: 'ADD_V2_ROUTES_COMMANDS', commands: ADD_V2_ROUTES_COMMANDS },
	{
		name: 'GENERATE_V2_CONTROLLER_COMMANDS',
		commands: GENERATE_V2_CONTROLLER_COMMANDS,
	},
];

const STRESS_SCENARIOS = [
	{
		id: 'v1-cents',
		label: 'GET /api/v1/orders/42 (v1 client)',
		expectedResult: 'allowed',
	},
	{
		id: 'v2-object',
		label: 'GET /api/v2/orders/42 (v2 client)',
		expectedResult: 'allowed',
	},
	{
		id: 'v1-deprecated',
		label: 'GET /api/v1/orders (deprecated)',
		expectedResult: 'allowed',
	},
	{
		id: 'v3-not-found',
		label: 'GET /api/v3/orders/42 (unknown)',
		expectedResult: 'blocked',
	},
	{
		id: 'v2-line-items',
		label: 'GET /api/v2/orders/42 (with line_items)',
		expectedResult: 'allowed',
	},
	{
		id: 'no-version',
		label: 'GET /api/orders/42 (unversioned)',
		expectedResult: 'blocked',
	},
];

// ── Tests ──

describe('Level 39: API Versioning', () => {
	describe('Discovery definitions', () => {
		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every discovery is reachable via at least one probe', () => {
			const reachable = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map only references valid discovery IDs', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('probe discovery map only references valid probe IDs', () => {
			const validProbeIds = new Set(PROBES.map((p) => p.id));
			for (const probeId of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(validProbeIds.has(probeId)).toBe(true);
			}
		});
	});

	describe('Probes', () => {
		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all probe labels are unique', () => {
			const labels = PROBES.map((p) => p.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every probe has at least one response line', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('every probe has a command', () => {
			for (const probe of PROBES) {
				expect(probe.command.length).toBeGreaterThan(0);
			}
		});

		test('response line colors are valid', () => {
			const validColors = new Set(['green', 'red', 'amber', 'cyan']);
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(validColors.has(line.color)).toBe(true);
				}
			}
		});
	});

	describe('Build step quality', () => {
		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step labels do not reveal specific APIs or methods', () => {
			for (const step of STEP_DEFS) {
				expect(step.label).not.toMatch(/Api::V2/);
				expect(step.label).not.toMatch(/OrderSerializer/);
				expect(step.label).not.toMatch(/before_action/);
				// "Sunset" is the concept name (RFC 8594), not a hidden answer
			}
		});

		test('correct answer is never the first option in command sets', () => {
			for (const set of ALL_COMMAND_SETS) {
				const firstCmd = set.commands[0];
				expect(firstCmd.correct).toBe(false);
			}
		});

		test('correct answer is never the first option in option sets', () => {
			for (const set of ALL_OPTION_SETS) {
				const firstOpt = set.options[0];
				expect(firstOpt.correct).toBe(false);
			}
		});

		test('each command set has exactly one correct answer', () => {
			for (const set of ALL_COMMAND_SETS) {
				const correctCount = set.commands.filter(
					(c) => c.correct,
				).length;
				expect(correctCount).toBe(1);
			}
		});

		test('each option set has exactly one correct answer', () => {
			for (const set of ALL_OPTION_SETS) {
				const correctCount = set.options.filter(
					(o) => o.correct,
				).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong command has feedback', () => {
			for (const set of ALL_COMMAND_SETS) {
				for (const cmd of set.commands) {
					if (!cmd.correct) {
						expect(cmd.feedback).toBeDefined();
						expect(cmd.feedback.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('every wrong option has feedback', () => {
			for (const set of ALL_OPTION_SETS) {
				for (const opt of set.options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never reveals the correct answer directly', () => {
			for (const set of ALL_OPTION_SETS) {
				for (const opt of set.options) {
					if (!opt.correct && opt.feedback) {
						// Feedback should not contain exact correct patterns
						expect(opt.feedback).not.toContain(
							'Api::V1::BaseController',
						);
						expect(opt.feedback).not.toContain(
							'serializable_hash',
						);
					}
				}
			}

			for (const set of ALL_COMMAND_SETS) {
				for (const cmd of set.commands) {
					if (!cmd.correct && cmd.feedback) {
						expect(cmd.feedback).not.toContain(
							'api/v2/orders',
						);
					}
				}
			}
		});
	});

	describe('Stress scenarios', () => {
		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('at least 4 allowed and 2 blocked', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThanOrEqual(4);
			expect(blocked.length).toBeGreaterThanOrEqual(2);
		});

		test('probe and stress labels use consistent GET format', () => {
			for (const probe of PROBES) {
				expect(probe.label).toMatch(/^GET /);
			}
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).toMatch(/^GET /);
			}
		});

		test('v1 and v2 scenarios both present', () => {
			const hasV1 = STRESS_SCENARIOS.some((s) =>
				s.label.includes('/v1/'),
			);
			const hasV2 = STRESS_SCENARIOS.some((s) =>
				s.label.includes('/v2/'),
			);
			expect(hasV1).toBe(true);
			expect(hasV2).toBe(true);
		});
	});

	describe('Cross-phase consistency', () => {
		test('v1 client appears in both observe and reward', () => {
			const hasV1Probe = PROBES.some((p) =>
				p.label.toLowerCase().includes('v1'),
			);
			const hasV1Scenario = STRESS_SCENARIOS.some((s) =>
				s.label.toLowerCase().includes('v1'),
			);
			expect(hasV1Probe).toBe(true);
			expect(hasV1Scenario).toBe(true);
		});

		test('v2 client appears in both observe and reward', () => {
			const hasV2Probe = PROBES.some((p) =>
				p.label.toLowerCase().includes('v2'),
			);
			const hasV2Scenario = STRESS_SCENARIOS.some((s) =>
				s.label.toLowerCase().includes('v2'),
			);
			expect(hasV2Probe).toBe(true);
			expect(hasV2Scenario).toBe(true);
		});

		test('build steps cover versioning, deprecation, and service wiring', () => {
			const stepIds = STEP_DEFS.map((s) => s.id);
			expect(stepIds).toContain('add-v2-routes');
			expect(stepIds).toContain('create-v2-serializer');
			expect(stepIds).toContain('add-deprecation');
			expect(stepIds).toContain('add-sunset');
			expect(stepIds).toContain('wire-v1-service');
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('correct v1 wiring option uses service delegation', () => {
			const correct = WIRE_V1_SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct).toBeDefined();
			expect(correct?.label).toContain('service');
		});

		test('wrong direct-render option flagged for bypassing service pattern', () => {
			const directRender = WIRE_V1_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-direct-render',
			);
			expect(directRender).toBeDefined();
			expect(directRender?.correct).toBe(false);
			expect(directRender?.feedback).toContain('service layer');
		});

		test('correct serializer option creates separate v2 serializer', () => {
			const correct = CREATE_V2_SERIALIZER_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correct).toBeDefined();
			expect(correct?.label).toContain('v2 serializer');
		});

		test('wrong modify-v1 option flagged for changing frozen contract', () => {
			const modifyV1 = CREATE_V2_SERIALIZER_OPTIONS.find(
				(o) => o.id === 'wrong-modify-v1',
			);
			expect(modifyV1).toBeDefined();
			expect(modifyV1?.feedback).toContain('frozen');
		});
	});

	describe('Data consistency', () => {
		test('6 build steps total', () => {
			expect(STEP_DEFS.length).toBe(6);
		});

		test('4 discoveries total', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('3 probes total', () => {
			expect(PROBES.length).toBe(3);
		});

		test('6 stress scenarios total', () => {
			expect(STRESS_SCENARIOS.length).toBe(6);
		});

		test('all probe IDs map to discoveries', () => {
			for (const probe of PROBES) {
				expect(PROBE_DISCOVERY_MAP[probe.id]).toBeDefined();
				expect(
					PROBE_DISCOVERY_MAP[probe.id].length,
				).toBeGreaterThan(0);
			}
		});

		test('all option IDs within each set are unique', () => {
			for (const set of ALL_OPTION_SETS) {
				const ids = set.options.map((o) => o.id);
				expect(new Set(ids).size).toBe(ids.length);
			}
		});

		test('all command IDs within each set are unique', () => {
			for (const set of ALL_COMMAND_SETS) {
				const ids = set.commands.map((c) => c.id);
				expect(new Set(ids).size).toBe(ids.length);
			}
		});

		test('blocked scenarios are for unknown or unversioned requests', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				const isUnknown =
					scenario.label.includes('unknown') ||
					scenario.label.includes('unversioned') ||
					scenario.label.includes('v3');
				expect(isUnknown).toBe(true);
			}
		});
	});
});

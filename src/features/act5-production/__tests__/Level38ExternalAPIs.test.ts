/**
 * Level 38: External APIs (Resilient Integration)
 *
 * Tests mirror data structures to verify:
 * - Discovery defs and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level38ExternalAPIs.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-timeout', label: 'No timeout on HTTP requests' },
	{ id: 'thread-blocking', label: 'Slow API blocks Puma threads' },
	{ id: 'no-retry', label: 'Transient errors not retried' },
	{ id: 'cascade-failure', label: 'One failing API takes down entire app' },
];

const PROBES = [
	{
		id: 'slow-stripe',
		label: 'POST create payment (slow response)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 5000}\'',
		responseLines: [
			{ text: '# Waiting... 10s... 20s... 30s...', color: 'yellow' },
			{
				text: '# Thread blocked. No timeout configured.',
				color: 'red',
			},
			{ text: '504 Gateway Timeout (after 30 seconds)', color: 'red' },
			{
				text: '# Puma thread wasted for 30 seconds on a single request',
				color: 'red',
			},
		],
	},
	{
		id: 'stripe-503',
		label: 'GET check payment status (Stripe 503)',
		command: 'curl localhost:3000/api/v1/payments/ch_abc/status',
		responseLines: [
			{ text: '503 Service Unavailable', color: 'red' },
			{
				text: '{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Stripe temporarily unavailable" } }',
				color: 'red',
			},
			{
				text: '# No retry attempted. Request fails immediately.',
				color: 'yellow',
			},
			{
				text: '# A simple retry would likely succeed (transient error)',
				color: 'yellow',
			},
		],
	},
	{
		id: 'stripe-down',
		label: 'Black Friday traffic (Stripe outage)',
		command:
			'for i in {1..50}; do curl -X POST localhost:3000/api/v1/payments; done',
		responseLines: [
			{
				text: '# 50 concurrent checkout requests during Stripe outage',
				color: 'yellow',
			},
			{
				text: '# Each request hangs for 30 seconds (no timeout)',
				color: 'red',
			},
			{
				text: '# 50 threads x 30s = all Puma threads blocked',
				color: 'red',
			},
			{
				text: '# GET /products, GET /search... nothing works!',
				color: 'red',
			},
			{
				text: '# No circuit breaker to stop hammering a dead service',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'slow-stripe': ['no-timeout', 'thread-blocking'],
	'stripe-503': ['no-retry'],
	'stripe-down': ['cascade-failure'],
};

// ── Build step option arrays ──

const INSTALL_FARADAY_COMMANDS = [
	{
		id: 'wrong-httparty',
		label: 'bundle add httparty',
		correct: false,
		feedback:
			'HTTParty lacks middleware support. You need an HTTP client with a composable middleware stack for timeouts, retries, and instrumentation.',
	},
	{
		id: 'correct',
		label: 'bundle add faraday',
		correct: true,
	},
	{
		id: 'wrong-rest-client',
		label: 'bundle add rest-client',
		correct: false,
		feedback:
			'RestClient does not support middleware. You need pluggable middleware for retry, instrumentation, and circuit breaking.',
	},
];

const INSTALL_STOPLIGHT_COMMANDS = [
	{
		id: 'wrong-circuitbox',
		label: 'bundle add circuitbox',
		correct: false,
		feedback:
			'Circuitbox is an older gem. The modern, actively maintained option integrates cleanly with any code block.',
	},
	{
		id: 'wrong-semian',
		label: 'bundle add semian',
		correct: false,
		feedback:
			'Semian is Shopify-specific infrastructure. A standalone circuit breaker gem is simpler and more widely applicable.',
	},
	{
		id: 'correct',
		label: 'bundle add stoplight',
		correct: true,
	},
];

const CONFIGURE_TIMEOUT_OPTIONS = [
	{
		id: 'wrong-no-timeout',
		label: 'No timeout (use defaults)',
		correct: false,
		feedback:
			'Default timeouts are 60+ seconds. A stuck request blocks a thread that long, exhausting your thread pool under load.',
	},
	{
		id: 'wrong-too-long',
		label: 'Set timeout to 60 seconds',
		correct: false,
		feedback:
			'60 seconds is far too long. Under load, slow requests pile up and exhaust your thread pool. Keep timeouts under 15 seconds.',
	},
	{
		id: 'correct',
		label: 'Set open_timeout and timeout',
		correct: true,
	},
];

const CONFIGURE_RETRY_OPTIONS = [
	{
		id: 'wrong-retry-all',
		label: 'Retry all HTTP methods',
		correct: false,
		feedback:
			'Retrying POST requests without idempotency is dangerous. A successful charge that timed out would be charged again on retry.',
	},
	{
		id: 'wrong-no-backoff',
		label: 'Retry immediately (no backoff)',
		correct: false,
		feedback:
			'Retrying immediately creates a thundering herd. All clients retry at the same time, overwhelming the recovering service.',
	},
	{
		id: 'correct',
		label: 'Retry with backoff, skip non-idempotent',
		correct: true,
	},
];

const CONFIGURE_CIRCUIT_OPTIONS = [
	{
		id: 'wrong-high-threshold',
		label: 'Open after 50 failures',
		correct: false,
		feedback:
			'50 failures means 50 wasted requests and blocked threads before protection kicks in. The circuit should open much sooner.',
	},
	{
		id: 'wrong-no-error-filter',
		label: 'Trip on all errors including 4xx',
		correct: false,
		feedback:
			'This trips the circuit on client errors (400, 422) which are never transient. The circuit should only track server-side failures.',
	},
	{
		id: 'correct',
		label: 'Threshold 5, filter client errors',
		correct: true,
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-no-service',
		label: 'Call Stripe directly in controller',
		correct: false,
		feedback:
			'HTTP calls in controllers violate the service object pattern. Business logic and external integrations belong in services.',
	},
	{
		id: 'wrong-no-circuit',
		label: 'Service without circuit breaker',
		correct: false,
		feedback:
			'This service has no circuit breaker. During an outage, every request still hits the failing API, wasting threads and amplifying the problem.',
	},
	{
		id: 'correct',
		label: 'Service with contract, circuit breaker, and Result',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ name: 'INSTALL_FARADAY_COMMANDS', options: INSTALL_FARADAY_COMMANDS },
	{ name: 'INSTALL_STOPLIGHT_COMMANDS', options: INSTALL_STOPLIGHT_COMMANDS },
	{ name: 'CONFIGURE_TIMEOUT_OPTIONS', options: CONFIGURE_TIMEOUT_OPTIONS },
	{ name: 'CONFIGURE_RETRY_OPTIONS', options: CONFIGURE_RETRY_OPTIONS },
	{ name: 'CONFIGURE_CIRCUIT_OPTIONS', options: CONFIGURE_CIRCUIT_OPTIONS },
	{ name: 'BUILD_SERVICE_OPTIONS', options: BUILD_SERVICE_OPTIONS },
];

// ── Stress scenarios ──

const STRESS_SCENARIOS = [
	{
		id: 'slow-timeout',
		label: 'POST create payment (with timeout)',
		description: 'Same slow Stripe, but timeout kills it at 10s',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Timeout: 10s limit reached!', color: 'yellow' },
			{ text: 'Thread freed after 10s (was 30s before)', color: 'green' },
			{ text: '503 - { "error": { "code": "TIMEOUT" } }', color: 'red' },
		],
	},
	{
		id: 'retry-503',
		label: 'GET check payment status (with retry)',
		description: 'Same 503, but retry middleware handles it',
		method: 'GET',
		path: '/api/v1/payments/ch_abc/status',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'GET /api/v1/payments/ch_abc/status -> Stripe API',
				color: 'cyan',
			},
			{ text: 'Attempt 1: 503 Service Unavailable', color: 'yellow' },
			{ text: 'Retry middleware: backing off 0.5s...', color: 'yellow' },
			{ text: 'Attempt 2: 200 OK', color: 'green' },
		],
	},
	{
		id: 'circuit-open',
		label: 'Black Friday traffic (with circuit breaker)',
		description: 'Same outage, but circuit breaker protects the app',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Circuit breaker', color: 'cyan' },
			{ text: 'Stoplight: circuit OPEN (5 failures)', color: 'red' },
			{ text: 'Fail-fast: 2ms (was 30s before!)', color: 'green' },
			{ text: '503 - { "error": { "code": "CIRCUIT_OPEN" } }', color: 'red' },
		],
	},
	{
		id: 'fast-charge',
		label: 'POST charge (fast response)',
		description: 'Stripe responds in 200ms, all middleware passes through',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Timeout: 200ms (within 10s limit)', color: 'green' },
			{ text: 'Circuit breaker: CLOSED (healthy)', color: 'green' },
			{ text: '200 OK - Payment ch_abc123 created', color: 'green' },
		],
	},
	{
		id: 'client-error',
		label: 'POST charge (400 bad params)',
		description: 'Client error, circuit breaker ignores it',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Stripe: 400 Bad Request (missing amount)', color: 'red' },
			{ text: 'Circuit breaker: NOT counted (client error)', color: 'green' },
			{ text: '400 - { "error": { "code": "VALIDATION" } }', color: 'red' },
		],
	},
];

// ── Tests ──

describe('Level 38: External APIs', () => {
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
				'no-timeout',
				'thread-blocking',
				'no-retry',
				'cascade-failure',
			]);
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES.length).toBe(3);
		});

		test('exact probe IDs', () => {
			expect(PROBES.map((p) => p.id)).toEqual([
				'slow-stripe',
				'stripe-503',
				'stripe-down',
			]);
		});

		test('each probe has at least 4 response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(4);
			}
		});

		test('slow-stripe probe shows timeout issue', () => {
			const probe = PROBES.find((p) => p.id === 'slow-stripe');
			expect(probe?.responseLines[0].text).toBe(
				'# Waiting... 10s... 20s... 30s...',
			);
			expect(probe?.responseLines[1].text).toBe(
				'# Thread blocked. No timeout configured.',
			);
		});

		test('stripe-down probe shows cascade failure', () => {
			const probe = PROBES.find((p) => p.id === 'stripe-down');
			expect(probe?.responseLines.length).toBe(5);
			expect(probe?.responseLines[4].text).toBe(
				'# No circuit breaker to stop hammering a dead service',
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

		test('slow-stripe maps to no-timeout and thread-blocking', () => {
			expect(PROBE_DISCOVERY_MAP['slow-stripe']).toEqual([
				'no-timeout',
				'thread-blocking',
			]);
		});

		test('stripe-503 maps to no-retry', () => {
			expect(PROBE_DISCOVERY_MAP['stripe-503']).toEqual(['no-retry']);
		});

		test('stripe-down maps to cascade-failure', () => {
			expect(PROBE_DISCOVERY_MAP['stripe-down']).toEqual(['cascade-failure']);
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

		test('INSTALL_FARADAY feedback does not contain "faraday"', () => {
			const wrong = INSTALL_FARADAY_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback?.toLowerCase()).not.toContain('faraday');
			}
		});

		test('INSTALL_STOPLIGHT feedback does not contain "stoplight"', () => {
			const wrong = INSTALL_STOPLIGHT_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback?.toLowerCase()).not.toContain('stoplight');
			}
		});

		test('CONFIGURE_TIMEOUT feedback does not contain "open_timeout" or "timeout = 10"', () => {
			const wrong = CONFIGURE_TIMEOUT_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback?.toLowerCase()).not.toContain('open_timeout');
				expect(opt.feedback!).not.toContain('timeout = 10');
			}
		});

		test('CONFIGURE_RETRY feedback does not contain "interval_randomness" or "backoff_factor"', () => {
			const wrong = CONFIGURE_RETRY_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback?.toLowerCase()).not.toContain(
					'interval_randomness',
				);
				expect(opt.feedback?.toLowerCase()).not.toContain('backoff_factor');
			}
		});

		test('CONFIGURE_CIRCUIT feedback does not contain "with_error_handler" or "ClientError"', () => {
			const wrong = CONFIGURE_CIRCUIT_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback!).not.toContain('with_error_handler');
				expect(opt.feedback!).not.toContain('ClientError');
			}
		});

		test('BUILD_SERVICE feedback does not contain "Stoplight::Error::RedLight"', () => {
			const wrong = BUILD_SERVICE_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback!).not.toContain('Stoplight::Error::RedLight');
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
				'slow-timeout',
				'retry-503',
				'circuit-open',
				'fast-charge',
				'client-error',
			]);
		});

		test('every scenario has non-empty responseLines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBeGreaterThanOrEqual(2);
				expect(s.responseLines[0].text.length).toBeGreaterThan(0);
			}
		});

		test('each scenario has exactly 4 response lines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBe(4);
			}
		});

		test('mix of allowed and blocked', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(2);
			expect(blocked.length).toBe(3);
		});

		test('specific expected results match', () => {
			const resultMap = Object.fromEntries(
				STRESS_SCENARIOS.map((s) => [s.id, s.expectedResult]),
			);
			expect(resultMap['slow-timeout']).toBe('blocked');
			expect(resultMap['retry-503']).toBe('allowed');
			expect(resultMap['circuit-open']).toBe('blocked');
			expect(resultMap['fast-charge']).toBe('allowed');
			expect(resultMap['client-error']).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('observe probes have thematic counterparts in reward scenarios', () => {
			// L38 scenarios are not 1:1 by ID (probes use stripe-down, scenarios use circuit-open)
			// but every probe problem is addressed by at least one scenario
			const probeIds = PROBES.map((p) => p.id);
			const scenarioIds = STRESS_SCENARIOS.map((s) => s.id);

			// slow-stripe -> slow-timeout
			expect(probeIds).toContain('slow-stripe');
			expect(scenarioIds).toContain('slow-timeout');

			// stripe-503 -> retry-503
			expect(probeIds).toContain('stripe-503');
			expect(scenarioIds).toContain('retry-503');

			// stripe-down -> circuit-open
			expect(probeIds).toContain('stripe-down');
			expect(scenarioIds).toContain('circuit-open');
		});

		test('probe and scenario labels mirror each other thematically', () => {
			// slow-stripe -> slow-timeout (both about slow payment)
			const slowProbe = PROBES.find((p) => p.id === 'slow-stripe');
			const slowScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'slow-timeout',
			);
			expect(slowProbe?.label).toContain('slow');
			expect(slowScenario?.label).toContain('timeout');

			// stripe-503 -> retry-503 (both about 503)
			const s503Probe = PROBES.find((p) => p.id === 'stripe-503');
			const retryScenario = STRESS_SCENARIOS.find((s) => s.id === 'retry-503');
			expect(s503Probe?.label).toContain('503');
			expect(retryScenario?.label).toContain('retry');

			// stripe-down -> circuit-open (both about outage)
			const downProbe = PROBES.find((p) => p.id === 'stripe-down');
			const circuitScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'circuit-open',
			);
			expect(downProbe?.label).toContain('Black Friday');
			expect(circuitScenario?.label).toContain('Black Friday');
		});

		test('reward scenarios include additional scenarios beyond observe probes', () => {
			// fast-charge and client-error are additional reward-only scenarios
			const extraIds = STRESS_SCENARIOS.map((s) => s.id).filter(
				(id) => !['slow-timeout', 'retry-503', 'circuit-open'].includes(id),
			);
			expect(extraIds).toContain('fast-charge');
			expect(extraIds).toContain('client-error');
		});
	});
});

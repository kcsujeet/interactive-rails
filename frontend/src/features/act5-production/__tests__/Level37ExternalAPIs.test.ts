/**
 * Level 37: External APIs (Resilient Integration)
 *
 * Tests mirror data structures to verify:
 * - Discovery defs and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency
 * - Cumulative pattern compliance (service objects, contracts)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data ──

const DISCOVERY_DEFS = [
	{ id: 'no-timeout', label: 'No timeout on HTTP requests' },
	{ id: 'thread-blocking', label: 'Slow API blocks all Puma threads' },
	{ id: 'no-retry', label: 'Transient errors not retried' },
	{ id: 'cascade-failure', label: 'One failing API takes down entire app' },
];

const PROBES = [
	{
		id: 'slow-stripe',
		label: 'POST charge (Stripe slow)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 50}\'',
		responseLines: [
			{ text: '# Waiting... 10s... 20s... 30s...', color: 'amber' },
			{ text: '# Thread blocked. No timeout configured.', color: 'red' },
			{ text: '504 Gateway Timeout (after 30 seconds)', color: 'red' },
			{
				text: '# Puma thread wasted for 30 seconds on a single request',
				color: 'red',
			},
		],
	},
	{
		id: 'stripe-503',
		label: 'POST charge (Stripe 503)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 75}\'',
		responseLines: [
			{ text: '503 Service Unavailable', color: 'red' },
			{
				text: '{ "error": "Stripe is temporarily unavailable" }',
				color: 'red',
			},
			{
				text: '# No retry attempted. Request fails immediately.',
				color: 'amber',
			},
			{
				text: '# A simple retry would likely succeed (transient error)',
				color: 'amber',
			},
		],
	},
	{
		id: 'stripe-down',
		label: 'POST charge (Stripe outage)',
		command:
			'for i in {1..50}; do curl -X POST localhost:3000/api/v1/payments; done',
		responseLines: [
			{
				text: '# 50 concurrent checkout requests during Stripe outage',
				color: 'amber',
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
				text: '# App is completely unresponsive, not just payments',
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

const STEP_DEFS = [
	{ id: 'install-faraday', label: 'Install HTTP Client' },
	{ id: 'install-stoplight', label: 'Install Circuit Breaker' },
	{ id: 'configure-timeout', label: 'Configure Timeout' },
	{ id: 'configure-retry', label: 'Configure Retry' },
	{ id: 'configure-circuit', label: 'Configure Circuit Breaker' },
	{ id: 'build-service', label: 'Build Payment Service' },
];

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
		id: 'correct',
		label: 'Set open_timeout and timeout',
		correct: true,
	},
	{
		id: 'wrong-too-long',
		label: 'Set timeout to 60 seconds',
		correct: false,
		feedback:
			'60 seconds is far too long. Under load, slow requests pile up and exhaust your thread pool. Keep timeouts under 15 seconds.',
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
		id: 'correct',
		label: 'Retry with backoff, skip non-idempotent',
		correct: true,
	},
	{
		id: 'wrong-no-backoff',
		label: 'Retry immediately (no backoff)',
		correct: false,
		feedback:
			'Retrying immediately creates a thundering herd. All clients retry at the same time, overwhelming the recovering service.',
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
		id: 'correct',
		label: 'Service with contract, circuit breaker, and Result',
		code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)
  # ... uses PaymentContract, Stoplight circuit breaker
end`,
		correct: true,
	},
	{
		id: 'wrong-no-circuit',
		label: 'Service without circuit breaker',
		correct: false,
		feedback:
			'This service has no circuit breaker. During an outage, every request still hits the failing API, wasting threads and amplifying the problem.',
	},
];

const STRESS_SCENARIOS = [
	{
		id: 'fast-charge',
		label: 'POST charge (fast response)',
		description: 'Stripe responds in 200ms, charge succeeds',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'slow-charge',
		label: 'POST charge (slow, timeout)',
		description: 'Stripe takes 15s, timeout kicks in at 10s',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked',
	},
	{
		id: 'transient-503',
		label: 'GET balance (503, retried)',
		description: 'First attempt 503, retry succeeds',
		method: 'GET',
		path: '/api/v1/balance',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'circuit-open',
		label: 'POST charge (circuit open)',
		description:
			'Circuit breaker is open, fails fast without calling Stripe',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked',
	},
	{
		id: 'idempotent-retry',
		label: 'GET invoice (timeout, retried)',
		description: 'GET request times out, safely retried with backoff',
		method: 'GET',
		path: '/api/v1/invoices/42',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'client-error',
		label: 'POST charge (400 bad params)',
		description: 'Client error, circuit breaker ignores it',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked',
	},
];

// ── Tests ──

describe('Level 37: External APIs (Resilient Integration)', () => {
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
	});

	describe('Probe definitions and mappings', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
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

		test('every probe maps to at least one discovery', () => {
			for (const probe of PROBES) {
				const discoveries = PROBE_DISCOVERY_MAP[probe.id];
				expect(discoveries).toBeDefined();
				expect(discoveries.length).toBeGreaterThan(0);
			}
		});

		test('all mapped discoveries exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via at least one probe', () => {
			const reachable = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Build step quality', () => {
		const ALL_OPTION_SETS = [
			{ name: 'Install Faraday', options: INSTALL_FARADAY_COMMANDS },
			{ name: 'Install Stoplight', options: INSTALL_STOPLIGHT_COMMANDS },
			{ name: 'Configure Timeout', options: CONFIGURE_TIMEOUT_OPTIONS },
			{ name: 'Configure Retry', options: CONFIGURE_RETRY_OPTIONS },
			{ name: 'Configure Circuit', options: CONFIGURE_CIRCUIT_OPTIONS },
			{ name: 'Build Service', options: BUILD_SERVICE_OPTIONS },
		];

		test('has exactly 6 build steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		for (const { name, options } of ALL_OPTION_SETS) {
			test(`${name}: exactly one correct answer`, () => {
				const correct = options.filter((o) => o.correct);
				expect(correct).toHaveLength(1);
			});

			test(`${name}: correct answer is not first`, () => {
				expect(options[0].correct).toBe(false);
			});

			test(`${name}: every wrong option has feedback`, () => {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback!.length).toBeGreaterThan(10);
					}
				}
			});

			test(`${name}: feedback does not reveal correct answer`, () => {
				for (const opt of options) {
					if (!opt.correct && opt.feedback) {
						const fb = opt.feedback.toLowerCase();
						expect(fb).not.toContain('faraday');
						expect(fb).not.toContain('stoplight');
						expect(fb).not.toContain('open_timeout');
					}
				}
			});

			test(`${name}: all option IDs are unique`, () => {
				const ids = options.map((o) => o.id);
				expect(new Set(ids).size).toBe(ids.length);
			});
		}

		test('step labels do not reveal specific gem names', () => {
			for (const step of STEP_DEFS) {
				const label = step.label.toLowerCase();
				expect(label).not.toContain('faraday');
				expect(label).not.toContain('stoplight');
			}
		});
	});

	describe('Stress scenarios', () => {
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

		test('has 3 allowed and 3 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(3);
			expect(blocked).toHaveLength(3);
		});

		test('every scenario has a description', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.description.length).toBeGreaterThan(10);
			}
		});

		test('scenarios cover all resilience patterns', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label.toLowerCase());
			expect(labels.some((l) => l.includes('timeout'))).toBe(true);
			expect(labels.some((l) => l.includes('retried'))).toBe(true);
			expect(labels.some((l) => l.includes('circuit'))).toBe(true);
		});
	});

	describe('Cross-phase consistency', () => {
		test('observe probes and reward scenarios both cover Stripe failures', () => {
			const probeLabels = PROBES.map((p) => p.label.toLowerCase());
			expect(probeLabels.some((l) => l.includes('stripe'))).toBe(true);

			const scenarioLabels = STRESS_SCENARIOS.map((s) =>
				s.label.toLowerCase(),
			);
			expect(scenarioLabels.some((l) => l.includes('charge'))).toBe(true);
		});

		test('observe covers timeout, retry, and cascade problems', () => {
			const probeIds = PROBES.map((p) => p.id);
			expect(probeIds).toContain('slow-stripe');
			expect(probeIds).toContain('stripe-503');
			expect(probeIds).toContain('stripe-down');
		});

		test('reward covers timeout, retry, and circuit breaker solutions', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(ids).toContain('slow-charge');
			expect(ids).toContain('transient-503');
			expect(ids).toContain('circuit-open');
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('correct service option uses ApplicationService base class', () => {
			const correct = BUILD_SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.code).toContain('< ApplicationService');
		});

		test('correct service option uses Result = Data.define pattern', () => {
			const correct = BUILD_SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.code).toContain('Result = Data.define');
			expect(correct?.code).toContain(':success?');
		});

		test('wrong "no service" option correctly shows controller anti-pattern', () => {
			const wrong = BUILD_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-no-service',
			);
			expect(wrong?.feedback).toContain('service object pattern');
		});
	});

	describe('Data consistency', () => {
		test('no em dashes in any text content', () => {
			const allText = [
				...DISCOVERY_DEFS.map((d) => d.label),
				...PROBES.flatMap((p) => [
					p.label,
					...p.responseLines.map((r) => r.text),
				]),
				...STEP_DEFS.map((s) => s.label),
				...STRESS_SCENARIOS.flatMap((s) => [s.label, s.description]),
				...INSTALL_FARADAY_COMMANDS.flatMap((c) => [
					c.label,
					c.feedback ?? '',
				]),
				...INSTALL_STOPLIGHT_COMMANDS.flatMap((c) => [
					c.label,
					c.feedback ?? '',
				]),
				...CONFIGURE_TIMEOUT_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
				...CONFIGURE_RETRY_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
				...CONFIGURE_CIRCUIT_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
				...BUILD_SERVICE_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
			];
			for (const text of allText) {
				expect(text).not.toContain('\u2014');
			}
		});

		test('all response line colors are valid', () => {
			const validColors = ['cyan', 'amber', 'red', 'green'];
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(validColors).toContain(line.color);
				}
			}
		});
	});
});

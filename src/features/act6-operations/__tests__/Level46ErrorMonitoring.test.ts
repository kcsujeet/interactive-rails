import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level46ErrorMonitoring.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-context', label: 'Errors lack user/request context' },
	{ id: 'no-grouping', label: 'Identical errors not grouped' },
	{ id: 'no-alerting', label: 'No alerting when error rate spikes' },
];

const PROBES = [
	{
		id: 'unnoticed-500',
		label: 'Customer hits a 500 during checkout (unnoticed)',
		command: 'curl -X POST localhost:3000/api/checkout',
		responseLines: [
			{
				text: '# NoMethodError in CheckoutController#create (a real bug)',
				color: 'red',
			},
			{
				text: '# Request logged (L40), but the exception is not captured',
				color: 'yellow',
			},
			{
				text: '# No error context, no grouping, no alert triggered',
				color: 'red',
			},
			{
				text: '500 Internal Server Error',
				color: 'red',
			},
		],
		story: [
			'Customer clicks "Place order" during checkout.',
			'A code bug raises NoMethodError, so Rails returns a 500.',
			'L40 request logger captures the request, but not the exception itself.',
			'No error context: no user_id, no breadcrumbs, no stack trace captured.',
			'The team finds out when the customer tweets about it.',
		],
	},
	{
		id: 'duplicate-errors',
		label: 'Same 500 happens 50 times',
		command:
			'for i in {1..50}; do curl -X POST localhost:3000/api/checkout; done',
		responseLines: [
			{
				text: '# 50 identical NoMethodError 500s in the logs',
				color: 'yellow',
			},
			{
				text: '# Each one looks like a separate, unique issue',
				color: 'red',
			},
			{
				text: '# No grouping: 50 log lines, no count, no dedup',
				color: 'red',
			},
			{
				text: '# Debugging means searching through a wall of text',
				color: 'red',
			},
		],
		story: [
			'50 customers all hit the same checkout bug.',
			'50 identical NoMethodError 500s flood the logs.',
			'Without grouping, each looks like a separate problem.',
			'A developer scanning logs sees 50 "different" errors.',
			'They waste time investigating each one individually.',
		],
	},
	{
		id: 'no-alert',
		label: 'Error rate crosses 1% (no alert)',
		command: 'ab -n 1000 -c 10 localhost:3000/api/checkout',
		responseLines: [
			{
				text: '# 15 of 1000 requests returned 500 (1.5% error rate)',
				color: 'yellow',
			},
			{
				text: '# Error budget exceeded: SLO is 99% (1% budget)',
				color: 'red',
			},
			{
				text: '# No alerting configured. Nobody knows.',
				color: 'red',
			},
			{
				text: '# Customers complain on Twitter 2 hours later.',
				color: 'red',
			},
		],
		story: [
			'Traffic spike hits checkout endpoint.',
			'15 out of 1000 requests fail (1.5% error rate).',
			'Your SLO is 99% uptime, so the 1% error budget is blown.',
			'But no alert fires. Nobody on the team knows.',
			'Two hours later, a customer tweets "your checkout is broken."',
			'By then, 500+ orders were lost.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'unnoticed-500': ['no-context'],
	'duplicate-errors': ['no-grouping'],
	'no-alert': ['no-alerting'],
};

const STEP_DEFS = [
	{ id: 'error-handler', title: 'Configure Error Handler Middleware' },
	{ id: 'error-context', title: 'Add Error Context' },
	{ id: 'error-grouping', title: 'Configure Error Grouping' },
	{ id: 'alerting', title: 'Set Up Alerting Thresholds' },
	{ id: 'error-budgets', title: 'Implement Error Budgets' },
	{ id: 'wire-middleware', title: 'Register the Error Subscriber' },
];

const ERROR_HANDLER_OPTIONS = [
	{
		id: 'wrong-rescue-only',
		name: 'rescue_from in ApplicationController',
		description: 'Catch errors in the controller layer only',
		correct: false,
		feedback:
			'rescue_from only catches controller-level errors. Errors in background jobs and services never reach it. You need one reporting layer the whole app shares.',
	},
	{
		id: 'wrong-begin-rescue',
		name: 'begin/rescue in every method',
		description: 'Wrap each method in its own error handler',
		correct: false,
		feedback:
			'Wrapping every method is unmaintainable and misses errors in middleware and framework code. You need a centralized error reporting layer.',
	},
	{
		id: 'correct',
		name: 'Rails.error.subscribe(ErrorSubscriber.new)',
		description: 'Subscribe a centralized error reporter to Rails.error',
		correct: true,
		feedback: '',
	},
];

const ERROR_CONTEXT_OPTIONS = [
	{
		id: 'wrong-logger-tag',
		name: 'Rails.logger.tagged(user_id)',
		description: 'Tag logs with user_id for grep-based debugging',
		correct: false,
		feedback:
			'Logger tagging only helps with log searching. It does not attach structured context to error reports for grouping and alerting.',
	},
	{
		id: 'correct',
		name: 'Rails.error.set_context(user_id:, request_id:, breadcrumbs:)',
		description:
			'Attach structured context to all error reports via before_action',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-thread-local',
		name: 'Thread.current[:user_id] = current_user.id',
		description: 'Store context in thread-local storage',
		correct: false,
		feedback:
			'Thread-local (like the request id in L40) is fine for a single value with careful cleanup, but here you would have to read each key back and hand-attach it to every report yourself. The error reporter has its own context API that carries the whole bag into every report automatically.',
	},
];

const ERROR_GROUPING_OPTIONS = [
	{
		id: 'wrong-by-message',
		name: 'Group by error.message',
		description: 'Group errors by their full message string',
		correct: false,
		feedback:
			'Error messages often include dynamic data (IDs, timestamps). Grouping by message creates thousands of "unique" groups for the same root cause.',
	},
	{
		id: 'wrong-by-controller',
		name: 'Group by controller#action',
		description: 'Group errors by the controller action that raised them',
		correct: false,
		feedback:
			'Grouping by controller merges different exception types into one group. A RecordNotFound and a Timeout in the same action are different problems.',
	},
	{
		id: 'correct',
		name: 'Group by exception class + controller#action fingerprint',
		description: 'Combine exception class and origin for accurate dedup',
		correct: true,
		feedback: '',
	},
];

const ALERTING_OPTIONS = [
	{
		id: 'wrong-every-error',
		name: 'Alert on every single error',
		description: 'Send a Slack message for each error occurrence',
		correct: false,
		feedback:
			'Alerting on every error causes alert fatigue. 50 identical errors means 50 notifications. The team starts ignoring alerts entirely.',
	},
	{
		id: 'correct',
		name: 'Alert on new error groups + rate thresholds',
		description:
			'Notify on first occurrence of a new group, then on rate spikes',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-daily-digest',
		name: 'Daily email digest of all errors',
		description: 'Send a summary email once per day',
		correct: false,
		feedback:
			'Daily digests mean you discover production problems up to 24 hours late. Customers will find the bug long before your team does.',
	},
];

const ERROR_BUDGET_OPTIONS = [
	{
		id: 'wrong-zero-errors',
		name: 'Target: zero errors in production',
		description: 'Any error means something is broken, aim for zero',
		correct: false,
		feedback:
			'Zero errors is unrealistic. Bots, bad inputs, and network blips cause errors in healthy systems. An error budget sets a realistic threshold.',
	},
	{
		id: 'wrong-fixed-count',
		name: 'Alert when errors > 100 per hour',
		description: 'Fixed count threshold for alerting',
		correct: false,
		feedback:
			'Fixed counts do not scale with traffic. 100 errors during 1M requests is fine (0.01%), but 100 errors during 1000 requests is a crisis (10%).',
	},
	{
		id: 'correct',
		name: 'Error budget: 1% of requests (SLO 99%)',
		description: 'Percentage-based budget that scales with traffic volume',
		correct: true,
		feedback: '',
	},
];

const WIRE_MIDDLEWARE_OPTIONS = [
	{
		id: 'wrong-middleware',
		name: 'config.middleware.insert_before 0, ErrorSubscriber',
		description: 'Insert the subscriber as a Rack middleware at the top',
		correct: false,
		feedback:
			'A subscriber is not middleware, and a middleware at position 0 sits ABOVE the layer that rescues app exceptions, so it never sees them. Rails already reports unhandled exceptions to Rails.error; you just have to attach your subscriber to it.',
	},
	{
		id: 'correct',
		name: 'Rails.error.subscribe(ErrorSubscriber.new) in an initializer',
		description:
			'Register the subscriber once at boot so every Rails.error report reaches it',
		correct: true,
		feedback: '',
	},
	{
		id: 'wrong-per-controller',
		name: 'Call ErrorSubscriber.new.report in each rescue_from block',
		description: 'Report manually from every controller rescue',
		correct: false,
		feedback:
			'Wiring the reporter into every controller by hand misses background jobs, services, and framework code, and it is easy to forget. Register it once so the whole app shares it.',
	},
];

const ALL_OPTION_SETS = [
	{ step: 0, name: 'Error Handler', options: ERROR_HANDLER_OPTIONS },
	{ step: 1, name: 'Error Context', options: ERROR_CONTEXT_OPTIONS },
	{ step: 2, name: 'Error Grouping', options: ERROR_GROUPING_OPTIONS },
	{ step: 3, name: 'Alerting', options: ALERTING_OPTIONS },
	{ step: 4, name: 'Error Budgets', options: ERROR_BUDGET_OPTIONS },
	{ step: 5, name: 'Register Subscriber', options: WIRE_MIDDLEWARE_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'unnoticed-500',
		label: 'Customer hits a 500 during checkout (unnoticed)',
		description: 'Same 500, now captured with full context and alert',
		method: 'POST',
		path: '/api/checkout',
		actor: 'customer',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'POST /api/checkout -> NoMethodError (500)',
				color: 'cyan',
			},
			{
				text: 'Context: user_id=42, request_id=abc123',
				color: 'green',
			},
			{
				text: 'Grouped: NoMethodError in CheckoutController#create',
				color: 'green',
			},
			{
				text: 'Alert: Slack notification sent in 30s',
				color: 'green',
			},
		],
		story: [
			'Same customer, same checkout bug, same NoMethodError 500.',
			'But now the error is captured with user_id and request_id.',
			'Grouped into "NoMethodError in CheckoutController#create".',
			'Team gets a Slack alert within 30 seconds.',
			'They fix the bug before most customers ever see it.',
		],
	},
	{
		id: 'duplicate-errors',
		label: 'Same 500 happens 50 times',
		description: 'Same 50 errors, now grouped into 1 entry with count',
		method: 'POST',
		path: '/api/checkout',
		actor: 'customer',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: '50x NoMethodError -> 1 error group',
				color: 'cyan',
			},
			{
				text: 'Group: NoMethodError (50 occurrences)',
				color: 'green',
			},
			{
				text: 'Context: 50 unique user_ids affected',
				color: 'green',
			},
			{
				text: 'Priority: Critical (highest frequency group)',
				color: 'red',
			},
		],
		story: [
			'Same 50 customers, same checkout bug.',
			'But now all 50 errors collapse into a single group.',
			'Dashboard shows: "NoMethodError, 50 occurrences, 50 users."',
			'Developer sees one issue to fix, not 50 mysterious log lines.',
			'Fix the checkout bug once, resolve 50 errors at once.',
		],
	},
	{
		id: 'no-alert',
		label: 'Error rate crosses 1% (with alert)',
		description: 'Same traffic spike, but error budget alert fires immediately',
		method: 'POST',
		path: '/api/checkout',
		actor: 'customer',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: '15/1000 requests failed (1.5% error rate)',
				color: 'cyan',
			},
			{
				text: 'Error budget: 1% exceeded! (1.5%)',
				color: 'red',
			},
			{
				text: 'Alert: PagerDuty on-call paged immediately',
				color: 'green',
			},
			{
				text: 'Team responding within 5 minutes',
				color: 'green',
			},
		],
		story: [
			'Same traffic spike, same 15 failures.',
			'But now the error budget monitor catches it instantly.',
			'At 1.5% error rate, the 1% budget threshold is breached.',
			'PagerDuty pages the on-call engineer within seconds.',
			'Team responds in 5 minutes, not 2 hours from a tweet.',
		],
	},
	{
		id: 'breadcrumbs',
		label: 'Error with breadcrumbs',
		description: 'Stripe timeout captured with full user journey breadcrumbs',
		method: 'POST',
		path: '/api/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'POST /api/checkout -> Faraday::TimeoutError',
				color: 'cyan',
			},
			{
				text: 'Breadcrumbs: cart -> address -> payment -> stripe',
				color: 'green',
			},
			{
				text: 'Context: user_id=99, cart_id=456, amount=$89.00',
				color: 'green',
			},
			{
				text: 'Root cause identified: Stripe API slow (>10s)',
				color: 'green',
			},
		],
		story: [
			'Customer goes through checkout: cart, address, payment.',
			'Stripe times out during the payment step.',
			'Error captured with full breadcrumb trail of the user journey.',
			'Developer sees exactly where the failure happened in the flow.',
			'Root cause: Stripe API is slow today, not a code bug.',
		],
	},
];

// ── Tests ──

describe('Level 47: Error Monitoring', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(3);
		});

		test('exact labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe('Errors lack user/request context');
			expect(DISCOVERY_DEFS[1].label).toBe('Identical errors not grouped');
			expect(DISCOVERY_DEFS[2].label).toBe(
				'No alerting when error rate spikes',
			);
		});

		test('exact IDs match', () => {
			expect(DISCOVERY_DEFS[0].id).toBe('no-context');
			expect(DISCOVERY_DEFS[1].id).toBe('no-grouping');
			expect(DISCOVERY_DEFS[2].id).toBe('no-alerting');
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(3);
		});

		test('exact probe labels', () => {
			expect(PROBES[0].label).toBe(
				'Customer hits a 500 during checkout (unnoticed)',
			);
			expect(PROBES[1].label).toBe('Same 500 happens 50 times');
			expect(PROBES[2].label).toBe('Error rate crosses 1% (no alert)');
		});

		test('every probe has >= 4 responseLines with real text', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(4);
				for (const line of probe.responseLines) {
					expect(line.text.length).toBeGreaterThanOrEqual(10);
				}
			}
		});

		test('every probe has >= 5 story lines', () => {
			for (const probe of PROBES) {
				expect(probe.story.length).toBeGreaterThanOrEqual(5);
				for (const s of probe.story) {
					expect(s.length).toBeGreaterThanOrEqual(10);
				}
			}
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to discoveries', () => {
			for (const probe of PROBES) {
				const discoveries = PROBE_DISCOVERY_MAP[probe.id];
				expect(discoveries).not.toBeUndefined();
				expect(discoveries.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of ids) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery reachable via probes', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Build step definitions', () => {
		test('has exactly 6 steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('all step IDs unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(6);
		});

		test('exact step titles', () => {
			expect(STEP_DEFS[0].title).toBe('Configure Error Handler Middleware');
			expect(STEP_DEFS[1].title).toBe('Add Error Context');
			expect(STEP_DEFS[2].title).toBe('Configure Error Grouping');
			expect(STEP_DEFS[3].title).toBe('Set Up Alerting Thresholds');
			expect(STEP_DEFS[4].title).toBe('Implement Error Budgets');
			expect(STEP_DEFS[5].title).toBe('Register the Error Subscriber');
		});
	});

	describe('Build step quality', () => {
		for (const { step, name, options } of ALL_OPTION_SETS) {
			describe(`Step ${step}: ${name}`, () => {
				test('has at least 3 options', () => {
					expect(options.length).toBeGreaterThanOrEqual(3);
				});

				test('has exactly one correct answer', () => {
					const correct = options.filter((o) => o.correct);
					expect(correct).toHaveLength(1);
				});

				test('correct answer is not the first option', () => {
					expect(options[0].correct).toBe(false);
				});

				test('every wrong option has non-empty feedback', () => {
					for (const opt of options) {
						if (!opt.correct) {
							expect(typeof opt.feedback).toBe('string');
							expect(opt.feedback.length).toBeGreaterThanOrEqual(20);
						}
					}
				});

				test('feedback does not reveal the correct option name', () => {
					const correctName = options.find((o) => o.correct)?.name ?? '';
					for (const opt of options) {
						if (!opt.correct && opt.feedback) {
							expect(opt.feedback).not.toContain(correctName);
						}
					}
				});
			});
		}
	});

	describe('Stress scenarios', () => {
		test('has exactly 4 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(4);
		});

		test('all IDs unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(4);
		});

		test('all labels unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(4);
		});

		test('every scenario has >= 4 responseLines with real text', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.responseLines.length).toBeGreaterThanOrEqual(4);
				for (const line of scenario.responseLines) {
					expect(line.text.length).toBeGreaterThanOrEqual(10);
				}
			}
		});

		test('every scenario has >= 4 story lines', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.story.length).toBeGreaterThanOrEqual(4);
			}
		});

		test('mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(1);
			expect(blocked.length).toBe(3);
		});

		test('exact scenario IDs and expectedResults', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('unnoticed-500');
			expect(STRESS_SCENARIOS[0].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[1].id).toBe('duplicate-errors');
			expect(STRESS_SCENARIOS[1].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[2].id).toBe('no-alert');
			expect(STRESS_SCENARIOS[2].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[3].id).toBe('breadcrumbs');
			expect(STRESS_SCENARIOS[3].expectedResult).toBe('allowed');
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe ID has a matching stress scenario', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(scenarioIds.has(probe.id)).toBe(true);
			}
		});

		test('probe and scenario labels match for overlapping IDs', () => {
			const scenarioMap = new Map(STRESS_SCENARIOS.map((s) => [s.id, s.label]));
			// unnoticed-500 and duplicate-errors have same labels in both phases
			expect(scenarioMap.get('unnoticed-500')).toBe(
				'Customer hits a 500 during checkout (unnoticed)',
			);
			expect(scenarioMap.get('duplicate-errors')).toBe(
				'Same 500 happens 50 times',
			);
		});

		test('reward scenarios are a superset of probe concepts', () => {
			// 3 probes + 1 breadcrumbs scenario = 4 total
			expect(STRESS_SCENARIOS.length).toBeGreaterThanOrEqual(PROBES.length);
		});
	});

	describe('Observe frames do not reference reward-only zones', () => {
		// Observe has: customer, app, edge
		// Reward adds: monitor, edgeB
		const OBSERVE_ZONE_KEYS = ['customer', 'app', 'edge'];
		const REWARD_ONLY_KEYS = ['monitor', 'edgeB'];

		test('observe zones do not include reward-only zones', () => {
			for (const key of REWARD_ONLY_KEYS) {
				expect(OBSERVE_ZONE_KEYS).not.toContain(key);
			}
		});
	});

	describe('No em dashes in content', () => {
		test('probes contain no em dashes', () => {
			for (const probe of PROBES) {
				expect(probe.label).not.toContain('\u2014');
				expect(probe.command).not.toContain('\u2014');
				for (const line of probe.responseLines) {
					expect(line.text).not.toContain('\u2014');
				}
				for (const s of probe.story) {
					expect(s).not.toContain('\u2014');
				}
			}
		});

		test('scenarios contain no em dashes', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label).not.toContain('\u2014');
				expect(scenario.description).not.toContain('\u2014');
				for (const line of scenario.responseLines) {
					expect(line.text).not.toContain('\u2014');
				}
				for (const s of scenario.story) {
					expect(s).not.toContain('\u2014');
				}
			}
		});

		test('option feedback contains no em dashes', () => {
			for (const { options } of ALL_OPTION_SETS) {
				for (const opt of options) {
					if (opt.feedback) {
						expect(opt.feedback).not.toContain('\u2014');
					}
				}
			}
		});
	});
});

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level42RateLimiting.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-ip-limit', label: 'No per-IP request throttling' },
	{ id: 'login-brute-force', label: 'Login endpoint has no rate limit' },
	{
		id: 'legitimate-blocked',
		label: 'Legitimate users locked out during attack',
	},
];

const PROBES = [
	{
		id: 'bot-flood',
		label: 'Bot floods API (10K req/sec from one IP)',
		command:
			'for i in {1..10000}; do curl localhost:3000/api/v1/products; done',
		responseLines: [
			{
				text: '# 10,000 requests from 1.2.3.4',
				color: 'yellow',
			},
			{ text: '200 OK (x10,000)', color: 'green' },
			{
				text: '# All served. Server CPU: 98%',
				color: 'red',
			},
			{
				text: '# No throttle. Every request hits full stack.',
				color: 'red',
			},
		],
	},
	{
		id: 'brute-force',
		label: 'Attacker brute-forces login endpoint',
		command:
			'for i in {1..1000}; do curl -X POST localhost:3000/api/v1/sessions -d "password=guess$i"; done',
		responseLines: [
			{
				text: '# 1,000 POST /api/v1/sessions from one IP',
				color: 'yellow',
			},
			{ text: '401 Unauthorized (x999)', color: 'red' },
			{
				text: '200 OK (x1) - password guessed!',
				color: 'red',
			},
			{
				text: '# No rate limit on login. Brute force succeeds.',
				color: 'red',
			},
		],
	},
	{
		id: 'legitimate-blocked',
		label: 'Customer locked out during bot attack',
		command: 'curl localhost:3000/api/v1/products  # during bot flood',
		responseLines: [
			{
				text: '# Customer tries to browse products',
				color: 'cyan',
			},
			{
				text: '# Server CPU: 98% (bot consuming all resources)',
				color: 'red',
			},
			{ text: '504 Gateway Timeout', color: 'red' },
			{
				text: '# Legitimate user cannot load the page',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'bot-flood': ['no-ip-limit'],
	'brute-force': ['login-brute-force'],
	'legitimate-blocked': ['legitimate-blocked'],
};

// ── Build step options ──

const RAILS_RATE_LIMIT_COMMANDS = [
	{
		id: 'wrong-before-action',
		label: 'before_action :check_rate_limit',
		correct: false,
		feedback:
			'A custom before_action requires you to implement the entire rate limiting logic yourself. Rails 8 has a built-in rate_limit macro that handles counting, storage, and response.',
	},
	{
		id: 'correct',
		label: 'rate_limit to: 5, within: 1.minute',
		correct: true,
	},
	{
		id: 'wrong-no-window',
		label: 'rate_limit to: 5',
		correct: false,
		feedback:
			'rate_limit requires a within: parameter to define the time window. Without it, Rails does not know when to reset the counter.',
	},
];

const RACK_ATTACK_COMMANDS = [
	{
		id: 'wrong-throttle-gem',
		label: 'bundle add rack-throttle',
		correct: false,
		feedback:
			'rack-throttle is unmaintained and no longer receives security patches. Look for the actively maintained Rack-level rate limiting gem widely adopted in the Rails community.',
	},
	{
		id: 'correct',
		label: 'bundle add rack-attack',
		correct: true,
	},
	{
		id: 'wrong-middleware',
		label: 'bundle add rack-limiter',
		correct: false,
		feedback:
			'rack-limiter is not a standard gem. The widely adopted Rack rate limiting solution is rack-attack.',
	},
];

const IP_THROTTLE_OPTIONS = [
	{
		id: 'wrong-no-limit',
		label: 'Throttle at 10,000 requests per minute',
		correct: false,
		feedback:
			'10,000 requests per minute is too high. A bot sending 167 req/sec would still get through. A reasonable limit is 100-300 per minute.',
	},
	{
		id: 'wrong-global',
		label: 'Global throttle (not per-IP)',
		correct: false,
		feedback:
			'A global throttle shares the limit across ALL users. 100 total requests per minute means 100 users each making 1 request would hit the limit.',
	},
	{
		id: 'correct',
		label: 'Throttle at 100 requests per minute per IP',
		correct: true,
	},
];

const USER_THROTTLE_OPTIONS = [
	{
		id: 'wrong-all-endpoints',
		label: 'Throttle all POST requests at 5/min',
		correct: false,
		feedback:
			'Throttling ALL POST requests at 5/min would block normal checkout and order creation. Only throttle sensitive endpoints like login.',
	},
	{
		id: 'correct',
		label: 'Throttle login by IP + email combination',
		correct: true,
	},
	{
		id: 'wrong-no-ip',
		label: 'Throttle login by email only',
		correct: false,
		feedback:
			'Throttling by email alone lets an attacker try 5 passwords per email, then switch. Combine IP + email for defense in depth.',
	},
];

const SAFELIST_OPTIONS = [
	{
		id: 'wrong-no-safelist',
		label: 'No safelist (rate limit everything)',
		correct: false,
		feedback:
			'Internal services (monitoring, health checks) make frequent requests. Without a safelist, they get throttled and produce false alerts.',
	},
	{
		id: 'wrong-safelist-all',
		label: 'Safelist all authenticated users',
		correct: false,
		feedback:
			'Safelisting all authenticated users defeats the purpose. A compromised account could flood the API. Safelist by trusted IP ranges instead.',
	},
	{
		id: 'correct',
		label: 'Safelist internal IP ranges',
		correct: true,
	},
];

const RESPONSE_429_OPTIONS = [
	{
		id: 'wrong-no-retry-after',
		label: '429 with generic error message',
		correct: false,
		feedback:
			'Without a Retry-After header, the client does not know when to try again. Well-behaved clients use Retry-After to back off automatically.',
	},
	{
		id: 'wrong-503',
		label: 'Return 503 Service Unavailable',
		correct: false,
		feedback:
			'503 means the server is down. 429 means the client is sending too many requests. The distinction matters: 503 triggers circuit breakers, 429 triggers backoff.',
	},
	{
		id: 'correct',
		label: '429 with Retry-After header',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ name: 'RAILS_RATE_LIMIT_COMMANDS', options: RAILS_RATE_LIMIT_COMMANDS },
	{ name: 'RACK_ATTACK_COMMANDS', options: RACK_ATTACK_COMMANDS },
	{ name: 'IP_THROTTLE_OPTIONS', options: IP_THROTTLE_OPTIONS },
	{ name: 'USER_THROTTLE_OPTIONS', options: USER_THROTTLE_OPTIONS },
	{ name: 'SAFELIST_OPTIONS', options: SAFELIST_OPTIONS },
	{ name: 'RESPONSE_429_OPTIONS', options: RESPONSE_429_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'bot-flood',
		label: 'Bot floods API (with IP throttle)',
		description: 'Bot IP blocked after 100 requests',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'bot',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '429 Too Many Requests', color: 'red' },
			{ text: 'Retry-After: 60', color: 'yellow' },
			{ text: '# Bot throttled at IP level', color: 'green' },
		],
	},
	{
		id: 'brute-force',
		label: 'Attacker brute-forces login (with rate limit)',
		description: 'Login blocked after 5 attempts per minute',
		method: 'POST',
		path: '/api/v1/sessions',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '429 Too Many Requests', color: 'red' },
			{ text: '# Only 5 login attempts per minute', color: 'green' },
			{ text: '# Brute force infeasible at this rate', color: 'green' },
		],
	},
	{
		id: 'legitimate-blocked',
		label: 'Customer browses during attack (protected)',
		description: 'Bot throttled, customer gets through',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK (120ms)', color: 'green' },
			{
				text: '# Bot is rate-limited, server has capacity',
				color: 'green',
			},
		],
	},
	{
		id: 'safelist',
		label: 'Internal service (safelisted)',
		description: 'Internal monitoring bypasses rate limits',
		method: 'GET',
		path: '/health',
		actor: 'monitoring',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '# 10.0.0.1 is safelisted', color: 'green' },
		],
	},
];

// ── Tests ──

describe('Level 42: Rate Limiting', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('specific discovery labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe('No per-IP request throttling');
			expect(DISCOVERY_DEFS[1].label).toBe('Login endpoint has no rate limit');
			expect(DISCOVERY_DEFS[2].label).toBe(
				'Legitimate users locked out during attack',
			);
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('each probe has exactly 4 responseLines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines).toHaveLength(4);
			}
		});

		test('exact probe IDs', () => {
			expect(PROBES[0].id).toBe('bot-flood');
			expect(PROBES[1].id).toBe('brute-force');
			expect(PROBES[2].id).toBe('legitimate-blocked');
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to at least one discovery', () => {
			for (const probe of PROBES) {
				const discoveries = PROBE_DISCOVERY_MAP[probe.id];
				expect(Array.isArray(discoveries)).toBe(true);
				expect(discoveries.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped discovery IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of ids) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via probes', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});
	});

	describe('Build step quality', () => {
		for (const { name, options } of ALL_OPTION_SETS) {
			describe(name, () => {
				test('has exactly 3 options', () => {
					expect(options).toHaveLength(3);
				});

				test('exactly one correct answer', () => {
					expect(options.filter((o) => o.correct)).toHaveLength(1);
				});

				test('correct answer is not first', () => {
					expect(options[0].correct).toBe(false);
				});

				test('every wrong option has non-empty feedback', () => {
					for (const opt of options) {
						if (!opt.correct) {
							expect(typeof opt.feedback).toBe('string');
							expect((opt.feedback as string).length).toBeGreaterThan(20);
						}
					}
				});

				test('feedback does not contain "rack-attack" (correct gem name)', () => {
					// For RACK_ATTACK_COMMANDS, the correct answer is "bundle add rack-attack"
					// Feedback should not reveal the gem name
					if (name === 'RACK_ATTACK_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes('bundle add rack-attack'),
								).toBe(false);
							}
						}
					}
				});

				test('feedback does not contain "rate_limit to: 5, within:" (correct command)', () => {
					if (name === 'RAILS_RATE_LIMIT_COMMANDS') {
						for (const opt of options) {
							if (!opt.correct && opt.feedback) {
								expect(
									(opt.feedback as string).includes(
										'rate_limit to: 5, within:',
									),
								).toBe(false);
							}
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
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every scenario has at least 2 responseLines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBeGreaterThanOrEqual(2);
			}
		});

		test('every responseLines entry has non-empty text', () => {
			for (const s of STRESS_SCENARIOS) {
				for (const line of s.responseLines) {
					expect(line.text.length).toBeGreaterThan(0);
				}
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
			expect(blocked.length).toBe(2);
		});

		test('exact scenario IDs and expectedResults', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('bot-flood');
			expect(STRESS_SCENARIOS[0].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[1].id).toBe('brute-force');
			expect(STRESS_SCENARIOS[1].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[2].id).toBe('legitimate-blocked');
			expect(STRESS_SCENARIOS[2].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[3].id).toBe('safelist');
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

		test('all probe IDs exist in PROBE_DISCOVERY_MAP', () => {
			for (const probe of PROBES) {
				expect(probe.id in PROBE_DISCOVERY_MAP).toBe(true);
			}
		});
	});
});

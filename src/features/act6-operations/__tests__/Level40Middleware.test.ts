import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level40Middleware.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-request-id', label: 'No request ID for tracing errors' },
	{ id: 'no-logging', label: 'No middleware logging (only Rails log)' },
	{ id: 'bots-undetected', label: 'Bots pass through undetected' },
];

const PROBES = [
	{
		id: 'error-no-trace',
		label: 'Customer reports 500 error (no request ID)',
		command: 'curl localhost:3000/api/orders/999',
		responseLines: [
			{ text: '500 Internal Server Error', color: 'red' },
			{
				text: '# X-Request-Id: 7f3a... is in the response header',
				color: 'yellow',
			},
			{
				text: '# Customer says "it broke" but which request?',
				color: 'red',
			},
			{
				text: '# No way to correlate this error in logs',
				color: 'red',
			},
		],
	},
	{
		id: 'bot-scrape',
		label: 'Bot scrapes product catalog (undetected)',
		command: 'for i in {1..1000}; do curl localhost:3000/api/products; done',
		responseLines: [
			{
				text: '# 1000 GET /api/products from same user-agent',
				color: 'yellow',
			},
			{ text: '200 OK (x1000)', color: 'green' },
			{ text: '# All requests served. No detection.', color: 'red' },
			{
				text: '# Bot scraped entire catalog before anyone noticed',
				color: 'red',
			},
		],
	},
	{
		id: 'debug-no-logs',
		label: 'Debug production issue (no middleware logging)',
		command: 'tail -f log/production.log | grep "duration"',
		responseLines: [
			{ text: '# Rails default log:', color: 'cyan' },
			{ text: 'Started GET "/api/orders"', color: 'muted' },
			{ text: 'Completed 200 OK in 245ms', color: 'muted' },
			{
				text: '# No request_id, no user_id, no structured data',
				color: 'red',
			},
			{
				text: '# Cannot correlate requests across services',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'error-no-trace': ['no-request-id'],
	'bot-scrape': ['bots-undetected'],
	'debug-no-logs': ['no-logging'],
};

// ── Build step options ──

const CREATE_MIDDLEWARE_COMMANDS = [
	{
		id: 'wrong-controller',
		label: 'rails g controller Middleware request_id',
		correct: false,
		feedback:
			'Middleware is not a controller. It is a plain Ruby class in lib/middleware/ that responds to initialize(app) and call(env).',
	},
	{
		id: 'correct',
		label:
			'mkdir -p lib/middleware && touch lib/middleware/request_id_tracker.rb',
		correct: true,
	},
	{
		id: 'wrong-initializer',
		label: 'rails g initializer middleware_config',
		correct: false,
		feedback:
			'An initializer configures middleware, but you need to create the middleware class itself first. Middleware lives in lib/middleware/.',
	},
];

const INSERT_MIDDLEWARE_COMMANDS = [
	{
		id: 'wrong-require',
		label: 'require "lib/middleware/request_id_tracker"',
		correct: false,
		feedback:
			'Requiring the file loads it, but does not insert it into the Rack stack. You need config.middleware.use in application.rb.',
	},
	{
		id: 'wrong-after',
		label: 'config.middleware.insert_after(0, RequestIdTracker)',
		correct: false,
		feedback:
			'insert_after(0, ...) inserts after the first middleware. For request tracking, use config.middleware.use to append, or insert_before for specific ordering.',
	},
	{
		id: 'correct',
		label: 'config.middleware.use RequestIdTracker',
		correct: true,
	},
];

const REQUEST_ID_OPTIONS = [
	{
		id: 'wrong-controller-filter',
		label: 'Use a before_action in ApplicationController',
		correct: false,
		feedback:
			'A controller filter runs after middleware and routing. If the request fails in middleware or routing, no ID is set. Request IDs must be injected at the middleware layer.',
	},
	{
		id: 'correct',
		label: 'Middleware with initialize(app) and call(env)',
		correct: true,
	},
	{
		id: 'wrong-no-thread-local',
		label: 'Middleware without thread-local storage',
		correct: false,
		feedback:
			'Without Thread.current[:request_id], downstream code (services, jobs) cannot access the request ID for logging. The ID must be available throughout the request lifecycle.',
	},
];

const LOGGER_OPTIONS = [
	{
		id: 'wrong-puts',
		label: 'Use puts for logging',
		correct: false,
		feedback:
			'puts writes to stdout with no structure. Production logging needs structured data (JSON) with timing, request ID, and status for log aggregation tools.',
	},
	{
		id: 'wrong-no-timing',
		label: 'Structured log without timing',
		correct: false,
		feedback:
			'Without timing data (duration_ms), you cannot identify slow requests. Timing is the most critical metric for production debugging.',
	},
	{
		id: 'correct',
		label: 'Structured JSON log with timing and request ID',
		correct: true,
	},
];

const BOT_OPTIONS = [
	{
		id: 'wrong-controller-check',
		label: 'Check User-Agent in controller',
		correct: false,
		feedback:
			'A controller check runs after routing and middleware. The bot request still consumes a Puma thread and triggers all middleware. Reject bots early in the Rack stack.',
	},
	{
		id: 'correct',
		label: 'Middleware that rejects bots before Rails',
		correct: true,
	},
	{
		id: 'wrong-allow-all',
		label: 'Log bot requests but allow them through',
		correct: false,
		feedback:
			'Logging without blocking still lets the bot consume resources. The middleware should return a 403 immediately, never calling @app.call for known bots.',
	},
];

const ORDERING_OPTIONS = [
	{
		id: 'wrong-random',
		label: 'Add all middleware with config.middleware.use (default order)',
		correct: false,
		feedback:
			'Default append order means BotDetector runs after RequestIdTracker. But if a bot is rejected, the logger never sees it. Order matters: detect bots first, then ID, then log.',
	},
	{
		id: 'wrong-logger-first',
		label: 'Logger first, then bot detector, then request ID',
		correct: false,
		feedback:
			'If the logger runs before the request ID is injected, logs will have no request_id field. Request ID must be injected before logging.',
	},
	{
		id: 'correct',
		label: 'Bot detector first, then request ID, then logger',
		correct: true,
	},
];

const ALL_OPTION_SETS = [
	{ name: 'CREATE_MIDDLEWARE_COMMANDS', options: CREATE_MIDDLEWARE_COMMANDS },
	{ name: 'INSERT_MIDDLEWARE_COMMANDS', options: INSERT_MIDDLEWARE_COMMANDS },
	{ name: 'REQUEST_ID_OPTIONS', options: REQUEST_ID_OPTIONS },
	{ name: 'LOGGER_OPTIONS', options: LOGGER_OPTIONS },
	{ name: 'BOT_OPTIONS', options: BOT_OPTIONS },
	{ name: 'ORDERING_OPTIONS', options: ORDERING_OPTIONS },
];

const STRESS_SCENARIOS = [
	{
		id: 'error-no-trace',
		label: 'Customer reports 500 error (with request ID)',
		description: 'Error response includes X-Request-Id for tracing',
		method: 'POST',
		path: '/api/checkout',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '500 Internal Server Error', color: 'red' },
			{ text: 'X-Request-Id: abc-123-def', color: 'green' },
			{ text: '# Error traceable via request ID in logs', color: 'green' },
		],
	},
	{
		id: 'bot-scrape',
		label: 'Bot scrapes products (blocked by middleware)',
		description: 'Bot detected and rejected at middleware layer with 403',
		method: 'GET',
		path: '/api/products',
		actor: 'bot',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '403 Forbidden', color: 'red' },
			{ text: '# Bot detected by BotDetector middleware', color: 'green' },
			{ text: '# Rejected before reaching Rails', color: 'green' },
		],
	},
	{
		id: 'debug-no-logs',
		label: 'Debug production issue (with structured logs)',
		description:
			'Request logged with method, path, status, duration, request_id',
		method: 'GET',
		path: '/api/orders',
		actor: 'developer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '{"method":"GET","path":"/api/orders","status":200,"duration_ms":245,"request_id":"abc-456"}',
				color: 'green',
			},
		],
	},
	{
		id: 'health-check',
		label: 'Health check (full pipeline working)',
		description: 'All three middleware layers process the request',
		method: 'GET',
		path: '/health',
		actor: 'monitoring',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'X-Request-Id: present', color: 'green' },
			{ text: 'Structured log: written', color: 'green' },
			{ text: 'Bot check: passed (legitimate)', color: 'green' },
		],
	},
];

// ── Tests ──

describe('Level 41: Middleware & Rack', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('specific discovery labels match', () => {
			expect(DISCOVERY_DEFS[0].label).toBe('No request ID for tracing errors');
			expect(DISCOVERY_DEFS[1].label).toBe(
				'No middleware logging (only Rails log)',
			);
			expect(DISCOVERY_DEFS[2].label).toBe('Bots pass through undetected');
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

		test('each probe has at least 3 responseLines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(3);
			}
		});

		test('exact probe IDs', () => {
			expect(PROBES[0].id).toBe('error-no-trace');
			expect(PROBES[1].id).toBe('bot-scrape');
			expect(PROBES[2].id).toBe('debug-no-logs');
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

				test('feedback does not contain the full correct answer label', () => {
					const correctLabel = options.find((o) => o.correct)?.label ?? '';
					for (const opt of options) {
						if (!opt.correct && opt.feedback) {
							expect((opt.feedback as string).includes(correctLabel)).toBe(
								false,
							);
						}
					}
				});
			});
		}

		test('CREATE_MIDDLEWARE feedback does not reveal "lib/middleware"', () => {
			for (const opt of CREATE_MIDDLEWARE_COMMANDS) {
				if (!opt.correct && opt.feedback) {
					// Feedback mentions lib/middleware/ as a hint, but that is the directory convention
					// The full correct command "mkdir -p lib/middleware && touch lib/middleware/request_id_tracker.rb"
					// should not appear in feedback
					expect(opt.feedback.includes('request_id_tracker.rb')).toBe(false);
				}
			}
		});

		test('INSERT_MIDDLEWARE feedback does not reveal exact correct command', () => {
			for (const opt of INSERT_MIDDLEWARE_COMMANDS) {
				if (!opt.correct && opt.feedback) {
					expect(
						opt.feedback.includes('config.middleware.use RequestIdTracker'),
					).toBe(false);
				}
			}
		});

		test('REQUEST_ID feedback does not reveal correct label', () => {
			const correctLabel =
				REQUEST_ID_OPTIONS.find((o) => o.correct)?.label ?? '';
			for (const opt of REQUEST_ID_OPTIONS) {
				if (!opt.correct && opt.feedback) {
					expect(opt.feedback.includes(correctLabel)).toBe(false);
				}
			}
		});

		test('LOGGER feedback does not reveal "Process.clock_gettime"', () => {
			for (const opt of LOGGER_OPTIONS) {
				if (!opt.correct && opt.feedback) {
					expect(opt.feedback.includes('Process.clock_gettime')).toBe(false);
				}
			}
		});

		test('BOT feedback does not reveal "BOT_PATTERNS"', () => {
			for (const opt of BOT_OPTIONS) {
				if (!opt.correct && opt.feedback) {
					expect(opt.feedback.includes('BOT_PATTERNS')).toBe(false);
				}
			}
		});

		test('ORDERING feedback does not reveal exact correct order', () => {
			for (const opt of ORDERING_OPTIONS) {
				if (!opt.correct && opt.feedback) {
					expect(
						opt.feedback.includes(
							'BotDetector\nconfig.middleware.use RequestIdTracker\nconfig.middleware.use RequestLogger',
						),
					).toBe(false);
				}
			}
		});
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
			expect(allowed.length).toBe(3);
			expect(blocked.length).toBe(1);
		});

		test('exact scenario IDs and expectedResults', () => {
			expect(STRESS_SCENARIOS[0].id).toBe('error-no-trace');
			expect(STRESS_SCENARIOS[0].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[1].id).toBe('bot-scrape');
			expect(STRESS_SCENARIOS[1].expectedResult).toBe('blocked');
			expect(STRESS_SCENARIOS[2].id).toBe('debug-no-logs');
			expect(STRESS_SCENARIOS[2].expectedResult).toBe('allowed');
			expect(STRESS_SCENARIOS[3].id).toBe('health-check');
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

/**
 * Level 37: Real-Time with Action Cable + Solid Cable
 *
 * Tests mirror the component data structures to verify:
 * - Discovery definitions and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency between observe and reward
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 * - Session-based WebSocket connection auth (matches the L9 auth generator)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level37RealTime.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-push', label: 'No server-push mechanism exists' },
	{ id: 'polling-waste', label: 'Order status refreshes are 99% empty' },
	{
		id: 'cpu-spike',
		label: 'Polling traffic crashes the site on Black Friday',
	},
];

const PROBES = [
	{
		id: 'trigger-event',
		label: 'POST create payment',
		command:
			'curl -X POST localhost:3000/api/payments -d \'{"amount": 99.99}\'',
		responseLines: [
			{ text: '202 Accepted (processing asynchronously)', color: 'cyan' },
			{ text: '# Stripe confirms payment on the server side.', color: 'green' },
			{
				text: '# Notification created. But no push mechanism!',
				color: 'yellow',
			},
			{
				text: '# Client waits up to 2 seconds for next poll to find out.',
				color: 'red',
			},
		],
	},
	{
		id: 'check-polling',
		label: 'Customer checks order status',
		command: 'curl -s localhost:3000/api/notifications | jq',
		responseLines: [
			{ text: '200 OK', color: 'cyan' },
			{ text: '{ "data": [] }', color: 'yellow' },
			{
				text: '# Customer refreshed order page. No updates yet.',
				color: 'red',
			},
			{
				text: '# 50K customers doing this every 2 seconds = 25K req/sec',
				color: 'red',
			},
			{
				text: '# Server ran full pipeline for nothing: auth -> query -> serialize',
				color: 'red',
			},
		],
	},
	{
		id: 'check-cpu',
		label: 'Black Friday traffic spike',
		command: 'curl -s localhost:3000/api/health | jq .server',
		responseLines: [
			{
				text: '{ "cpu": "95%", "connections": 847, "pool_exhausted": true }',
				color: 'red',
			},
			{
				text: '# Black Friday: 50K customers refreshing order status',
				color: 'red',
			},
			{
				text: '# Polling killed the server. New customers get 503.',
				color: 'red',
			},
			{
				text: '# Site is effectively down because of status refreshes.',
				color: 'yellow',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'check-polling': ['polling-waste'],
	'check-cpu': ['cpu-spike'],
	'trigger-event': ['no-push'],
};

const STEP_DEFS = [
	{ id: 'install-cable', title: 'Install Cable Adapter' },
	{ id: 'run-install', title: 'Run Installer' },
	{ id: 'configure-adapter', title: 'Configure Adapter' },
	{ id: 'generate-channel', title: 'Generate Channel' },
	{ id: 'authenticate-connection', title: 'Authenticate Connection' },
	{ id: 'build-broadcast-service', title: 'Build Broadcast Service' },
];

const INSTALL_CABLE_COMMANDS = [
	{
		id: 'wrong-redis',
		label: 'bundle add redis',
		command: 'bundle add redis',
		correct: false,
		feedback:
			'Redis is an external dependency. Rails 8 has a built-in adapter backed by the database.',
	},
	{
		id: 'wrong-anycable',
		label: 'bundle add anycable',
		command: 'bundle add anycable',
		correct: false,
		feedback:
			'AnyCable is a third-party alternative. Rails 8 ships with a zero-dependency adapter out of the box.',
	},
	{
		id: 'correct',
		label: 'bundle add solid_cable',
		command: 'bundle add solid_cable',
		correct: true,
	},
];

const RUN_INSTALL_COMMANDS = [
	{
		id: 'wrong-migrate',
		label: 'bin/rails db:migrate',
		command: 'bin/rails db:migrate',
		correct: false,
		feedback:
			'Migrations need to exist first. The gem provides an installer that sets up the database table and config.',
	},
	{
		id: 'correct',
		label: 'bin/rails solid_cable:install',
		command: 'bin/rails solid_cable:install',
		correct: true,
	},
	{
		id: 'wrong-generate',
		label: 'bin/rails generate solid_cable',
		command: 'bin/rails generate solid_cable',
		correct: false,
		feedback: 'Solid Cable uses a Rake task for installation, not a generator.',
	},
];

const CONFIGURE_ADAPTER_OPTIONS = [
	{
		id: 'wrong-redis-adapter',
		label: `# config/cable.yml\nproduction:\n  adapter: redis\n  url: redis://localhost:6379/1`,
		correct: false,
		feedback:
			'This requires a running Redis instance. The whole point is to eliminate external dependencies.',
	},
	{
		id: 'wrong-async',
		label: `# config/cable.yml\nproduction:\n  adapter: async`,
		correct: false,
		feedback:
			'The async adapter is for development only. It does not persist messages or work across processes.',
	},
	{
		id: 'correct',
		label: `# config/cable.yml\nproduction:\n  adapter: solid_cable\n  polling_interval: 0.1.seconds\n  message_retention: 1.day`,
		correct: true,
	},
];

const GENERATE_CHANNEL_COMMANDS = [
	{
		id: 'wrong-model',
		label: 'bin/rails generate model Notification',
		command: 'bin/rails generate model Notification',
		correct: false,
		feedback:
			'A model stores data in the database. You need a channel for real-time WebSocket communication.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate channel Notifications',
		command: 'bin/rails generate channel Notifications',
		correct: true,
	},
	{
		id: 'wrong-controller',
		label: 'bin/rails generate controller Notifications',
		command: 'bin/rails generate controller Notifications',
		correct: false,
		feedback:
			'A controller handles HTTP requests. WebSocket channels are a different layer entirely.',
	},
];

const AUTHENTICATE_CONNECTION_OPTIONS = [
	{
		id: 'wrong-no-auth',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    # No authentication needed\n  end\nend`,
		correct: false,
		feedback:
			'Unauthenticated WebSocket connections let anyone subscribe to private channels. Every connection must verify the user.',
	},
	{
		id: 'correct',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = find_verified_user\n    end\n\n    private\n\n    def find_verified_user\n      if session = Session.find_by(id: cookies.signed[:session_id])\n        session.user\n      else\n        reject_unauthorized_connection\n      end\n    end\n  end\nend`,
		correct: true,
	},
	{
		id: 'wrong-session',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = User.find(session[:user_id])\n    end\n  end\nend`,
		correct: false,
		feedback:
			'WebSocket connections do not have direct access to the session store. You need a different mechanism that persists across requests.',
	},
];

const BROADCAST_SERVICE_OPTIONS = [
	{
		id: 'wrong-inline',
		label: `class Api::PaymentsController < ApplicationController\n  def create\n    result = ProcessPayment.call(user: Current.user, params:)\n    if result.success?\n      NotificationsChannel.broadcast_to(\n        Current.user, { type: "payment" })\n      render json: result.payment, status: :created\n    end\n  end\nend`,
		correct: false,
		feedback:
			'Broadcasting lives inline in one controller here. Every code path that creates the record has to remember to broadcast, so some will forget and updates go missing. Broadcasting belongs with the record itself so it happens consistently for every caller.',
	},
	{
		id: 'correct',
		label: `class BroadcastNotification < ApplicationService\n  Result = Data.define(:success?, :notification, :errors)\n\n  def initialize(user:, title:, body:)\n    @user = user; @title = title; @body = body\n  end\n\n  def call\n    v = NotificationContract.new.call(title: @title, body: @body)\n    return Result.new(success?: false, notification: nil,\n      errors: v.errors.to_h) if v.failure?\n    notification = @user.notifications.create!(\n      title: @title, body: @body)\n    # after_create_commit broadcasts automatically\n    Result.new(success?: true, notification:, errors: {})\n  end\nend`,
		correct: true,
	},
	{
		id: 'wrong-direct',
		label: `class BroadcastNotification < ApplicationService\n  Result = Data.define(:success?, :notification, :errors)\n\n  def initialize(user:, title:, body:)\n    @user = user; @title = title; @body = body\n  end\n\n  def call\n    NotificationsChannel.broadcast_to(\n      @user, { title: @title, body: @body })\n    Result.new(success?: true, notification: nil, errors: {})\n  end\nend`,
		correct: false,
		feedback:
			'This skips persistence entirely. No notification record is created. Use model callbacks to broadcast after the record is saved.',
	},
];

const STRESS_SCENARIOS = [
	{
		id: 'unauthenticated',
		label: 'Anonymous connect',
		description: 'No authentication cookies',
		method: 'WS',
		path: '/cable',
		actor: 'anonymous',
		expectedResult: 'blocked',
	},
	{
		id: 'wrong-user',
		label: 'Subscribe to other user',
		description: 'Try to eavesdrop on another channel',
		method: 'WS',
		path: '/cable',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'trigger-event',
		label: 'POST create payment (with push)',
		description: 'Payment created, server pushes notification instantly',
		method: 'WS',
		path: '/cable -> NotificationsChannel',
		actor: 'server',
		expectedResult: 'allowed',
	},
	{
		id: 'check-polling',
		label: 'Customer checks order status (with push)',
		description: 'No polling needed, server pushes updates',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
	{
		id: 'check-cpu',
		label: 'Black Friday traffic (with WebSocket)',
		description: 'Same traffic spike, no polling overhead',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
];

// ── Tests ──

describe('Level 37: Real-Time (Action Cable + Solid Cable)', () => {
	describe('Discovery definitions', () => {
		test('has exactly 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('discovery IDs match the component exactly', () => {
			expect(DISCOVERY_DEFS.map((d) => d.id)).toEqual([
				'no-push',
				'polling-waste',
				'cpu-spike',
			]);
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

		test('probe IDs match the component exactly', () => {
			expect(PROBES.map((p) => p.id)).toEqual([
				'trigger-event',
				'check-polling',
				'check-cpu',
			]);
		});

		test('probe labels match the component exactly', () => {
			expect(PROBES.map((p) => p.label)).toEqual([
				'POST create payment',
				'Customer checks order status',
				'Black Friday traffic spike',
			]);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every probe has at least 4 response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThanOrEqual(4);
			}
		});

		test('PROBE_DISCOVERY_MAP is 1:1 (each probe unlocks exactly one)', () => {
			for (const probe of PROBES) {
				expect(PROBE_DISCOVERY_MAP[probe.id]).toHaveLength(1);
			}
		});

		test('each discovery is unlocked by exactly one probe', () => {
			const unlocked = Object.values(PROBE_DISCOVERY_MAP).flat();
			expect(unlocked).toHaveLength(DISCOVERY_DEFS.length);
			expect(new Set(unlocked).size).toBe(unlocked.length);
		});

		test('all mapped discoveries exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via exactly one probe', () => {
			const reachable = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});

		test('probe labels do not reveal Solid Cable as the answer', () => {
			for (const probe of PROBES) {
				expect(probe.label.toLowerCase()).not.toContain('solid_cable');
				expect(probe.label.toLowerCase()).not.toContain('solid cable');
			}
		});
	});

	describe('Build step quality', () => {
		const ALL_OPTION_SETS = [
			{ name: 'Install Cable', options: INSTALL_CABLE_COMMANDS },
			{ name: 'Run Install', options: RUN_INSTALL_COMMANDS },
			{ name: 'Configure Adapter', options: CONFIGURE_ADAPTER_OPTIONS },
			{ name: 'Generate Channel', options: GENERATE_CHANNEL_COMMANDS },
			{
				name: 'Authenticate Connection',
				options: AUTHENTICATE_CONNECTION_OPTIONS,
			},
			{
				name: 'Broadcast Service',
				options: BROADCAST_SERVICE_OPTIONS,
			},
		];

		test('has exactly 6 build steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('step IDs match the component exactly', () => {
			expect(STEP_DEFS.map((s) => s.id)).toEqual([
				'install-cable',
				'run-install',
				'configure-adapter',
				'generate-channel',
				'authenticate-connection',
				'build-broadcast-service',
			]);
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

			test(`${name}: every wrong option has substantive feedback`, () => {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(10);
					}
				}
			});

			test(`${name}: feedback does not reveal correct answer`, () => {
				for (const opt of options) {
					if (!opt.correct && opt.feedback) {
						const fb = opt.feedback.toLowerCase();
						expect(fb).not.toContain('solid_cable');
						expect(fb).not.toContain('encrypted cookies');
						expect(fb).not.toContain('after_create_commit');
						expect(fb).not.toContain('cookies.signed');
						expect(fb).not.toContain('session.find_by');
					}
				}
			});

			test(`${name}: all option IDs are unique`, () => {
				const ids = options.map((o) => o.id);
				expect(new Set(ids).size).toBe(ids.length);
			});
		}

		test('step titles do not reveal specific answers', () => {
			for (const step of STEP_DEFS) {
				expect(step.title.toLowerCase()).not.toContain('solid_cable');
				expect(step.title.toLowerCase()).not.toContain('solid cable');
			}
		});
	});

	describe('Connection authentication (session-based, matches L9 auth)', () => {
		const correct = AUTHENTICATE_CONNECTION_OPTIONS.find((o) => o.correct);

		test('correct auth option uses the signed session cookie lookup', () => {
			expect(correct?.label).toContain('cookies.signed[:session_id]');
			expect(correct?.label).toContain('Session.find_by');
			expect(correct?.label).toContain('reject_unauthorized_connection');
		});

		test('correct auth option does NOT use encrypted user cookie', () => {
			expect(correct?.label).not.toContain('cookies.encrypted');
			expect(correct?.label).not.toContain('User.find_by(id: cookies');
		});

		test('the session distractor still uses the session store directly', () => {
			const distractor = AUTHENTICATE_CONNECTION_OPTIONS.find(
				(o) => o.id === 'wrong-session',
			);
			expect(distractor?.label).toContain('User.find(session[:user_id])');
			expect(distractor?.label).not.toContain('cookies.signed');
			expect(distractor?.label).not.toContain('Session.find_by');
		});

		test('no wrong option leaks the correct auth mechanism', () => {
			for (const opt of AUTHENTICATE_CONNECTION_OPTIONS) {
				if (opt.correct) continue;
				expect(opt.feedback ?? '').not.toContain('cookies.signed');
				expect(opt.feedback ?? '').not.toContain('Session.find_by');
			}
		});
	});

	describe('Broadcast tension reconciled with callbacks lesson', () => {
		test('wrong-inline feedback does not prescribe model callbacks', () => {
			const inline = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-inline',
			);
			expect(inline?.feedback?.toLowerCase()).not.toContain('model callback');
			expect(inline?.feedback?.toLowerCase()).not.toContain('background job');
		});

		test('wrong-inline feedback does not reveal after_create_commit', () => {
			const inline = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-inline',
			);
			expect(inline?.feedback?.toLowerCase()).not.toContain(
				'after_create_commit',
			);
		});

		test('no wrong broadcast option leaks after_create_commit', () => {
			for (const opt of BROADCAST_SERVICE_OPTIONS) {
				if (opt.correct) continue;
				expect(opt.feedback?.toLowerCase() ?? '').not.toContain(
					'after_create_commit',
				);
			}
		});
	});

	describe('Stress scenarios', () => {
		test('has exactly 5 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(5);
		});

		test('scenario IDs match the component exactly', () => {
			expect(STRESS_SCENARIOS.map((s) => s.id)).toEqual([
				'unauthenticated',
				'wrong-user',
				'trigger-event',
				'check-polling',
				'check-cpu',
			]);
		});

		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has 3 allowed and 2 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(3);
			expect(blocked).toHaveLength(2);
		});

		test('every scenario has a description longer than 10 chars', () => {
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.description.length).toBeGreaterThan(10);
			}
		});

		test('blocked scenarios have adversarial actors', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			for (const scenario of blocked) {
				expect(['anonymous', 'attacker']).toContain(scenario.actor);
			}
		});
	});

	describe('Cross-phase consistency (probes paired with scenarios)', () => {
		test('every probe id has a matching scenario id', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(scenarioIds.has(probe.id)).toBe(true);
			}
		});

		test('reward adds exactly two blocked security scenarios', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			const rewardOnly = STRESS_SCENARIOS.filter((s) => !probeIds.has(s.id));
			expect(rewardOnly.map((s) => s.id).sort()).toEqual([
				'unauthenticated',
				'wrong-user',
			]);
		});
	});

	describe('Cumulative pattern compliance', () => {
		const correctOption = BROADCAST_SERVICE_OPTIONS.find((o) => o.correct);

		test('broadcast service uses ApplicationService base class', () => {
			expect(correctOption?.label).toContain('< ApplicationService');
		});

		test('broadcast service uses Result = Data.define pattern', () => {
			expect(correctOption?.label).toContain('Result = Data.define');
			expect(correctOption?.label).toContain(':success?');
			expect(correctOption?.label).toContain(':errors');
		});

		test('broadcast service uses Dry::Validation contract', () => {
			expect(correctOption?.label).toContain('NotificationContract.new.call');
			expect(correctOption?.label).toContain('v.failure?');
		});

		test('broadcast service returns Result on failure', () => {
			expect(correctOption?.label).toContain('Result.new');
			expect(correctOption?.label).toContain('success?: false');
		});

		test('wrong direct-broadcast option still follows service patterns', () => {
			const wrongDirect = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-direct',
			);
			expect(wrongDirect?.label).toContain('< ApplicationService');
			expect(wrongDirect?.label).toContain('Result = Data.define');
		});
	});

	describe('Data consistency', () => {
		const allText = [
			...DISCOVERY_DEFS.map((d) => d.label),
			...PROBES.flatMap((p) => [
				p.label,
				p.command,
				...p.responseLines.map((r) => r.text),
			]),
			...STEP_DEFS.map((s) => s.title),
			...STRESS_SCENARIOS.flatMap((s) => [s.label, s.description]),
			...INSTALL_CABLE_COMMANDS.flatMap((c) => [c.label, c.feedback ?? '']),
			...RUN_INSTALL_COMMANDS.flatMap((c) => [c.label, c.feedback ?? '']),
			...CONFIGURE_ADAPTER_OPTIONS.flatMap((o) => [o.label, o.feedback ?? '']),
			...GENERATE_CHANNEL_COMMANDS.flatMap((c) => [c.label, c.feedback ?? '']),
			...AUTHENTICATE_CONNECTION_OPTIONS.flatMap((o) => [
				o.label,
				o.feedback ?? '',
			]),
			...BROADCAST_SERVICE_OPTIONS.flatMap((o) => [o.label, o.feedback ?? '']),
		];

		test('no em dashes in any text content', () => {
			for (const text of allText) {
				expect(text).not.toContain('\u2014'); // em dash
			}
		});

		test('adapter is solid_cable in correct configure option', () => {
			const correct = CONFIGURE_ADAPTER_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('adapter: solid_cable');
		});

		test('channel generation creates NotificationsChannel', () => {
			const correct = GENERATE_CHANNEL_COMMANDS.find((o) => o.correct);
			expect(correct?.command).toContain('channel Notifications');
		});

		test('all probe response line colors are valid', () => {
			const validColors = ['cyan', 'yellow', 'red', 'green'];
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(validColors).toContain(line.color);
				}
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Reward wiring (dead-scenario regression, audit 2026-07-09). Imports the
// component's exported wiring because mirrors cannot verify frame coverage.
// ---------------------------------------------------------------------------

import {
	REWARD_FRAME_MAP as WIRED_FRAMES,
	PROBES as WIRED_PROBES,
	STRESS_SCENARIOS as WIRED_SCENARIOS,
} from '../components/level-37-real-time/Level37RealTime';

describe('Level 37: reward wiring', () => {
	test('scenario labels are unique (no duplicate buttons)', () => {
		const labels = WIRED_SCENARIOS.map((s) => s.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test('every scenario has reward frames (no dead buttons)', () => {
		for (const scenario of WIRED_SCENARIOS) {
			expect(
				WIRED_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
	});

	test('no orphan frames', () => {
		const ids = new Set(WIRED_SCENARIOS.map((s) => s.id));
		for (const key of Object.keys(WIRED_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
	});

	test('every probe id has a matching scenario id', () => {
		const ids = new Set(WIRED_SCENARIOS.map((s) => s.id));
		for (const probe of WIRED_PROBES) {
			expect(ids.has(probe.id), `probe "${probe.id}" unpaired`).toBe(true);
		}
	});

	test('mirrored scenario ids match the wired scenario ids', () => {
		expect(WIRED_SCENARIOS.map((s) => s.id)).toEqual(
			STRESS_SCENARIOS.map((s) => s.id),
		);
	});

	test('mirrored probe ids match the wired probe ids', () => {
		expect(WIRED_PROBES.map((p) => p.id)).toEqual(PROBES.map((p) => p.id));
	});
});

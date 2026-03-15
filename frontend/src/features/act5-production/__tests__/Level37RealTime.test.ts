/**
 * Level 37: Real-Time with Action Cable + Solid Cable
 *
 * Tests mirror the component data structures to verify:
 * - Discovery definitions and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency between observe and reward
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level36RealTime.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'polling-waste', label: 'Polling returns 99% empty responses' },
	{ id: 'cpu-spike', label: '25K req/sec exhausts server CPU' },
	{ id: 'no-push', label: 'No server-push mechanism exists' },
	{ id: 'latency-delay', label: 'Notifications delayed by poll interval' },
];

const PROBES = [
	{
		id: 'check-polling',
		label: 'GET notifications (poll)',
		command: 'curl -s localhost:3000/api/v1/notifications | jq',
		responseLines: [
			{ text: '200 OK', color: 'cyan' },
			{ text: '{ "notifications": [] }', color: 'amber' },
			{ text: '# Empty. 99% of polls return nothing.', color: 'red' },
			{
				text: '# 50K users x 0.5 req/sec = 25,000 requests/sec wasted',
				color: 'red',
			},
		],
	},
	{
		id: 'check-cpu',
		label: 'GET server stats',
		command: 'curl -s localhost:3000/api/v1/health | jq .server',
		responseLines: [
			{
				text: '{ "cpu": "94%", "connections": 847, "pool_exhausted": true }',
				color: 'red',
			},
			{
				text: '# Database connection pool exhausted from polling load',
				color: 'red',
			},
			{
				text: '# Each poll hits: authenticate -> query -> serialize -> respond',
				color: 'amber',
			},
		],
	},
	{
		id: 'trigger-event',
		label: 'POST create payment',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 99.99}\'',
		responseLines: [
			{ text: '201 Created', color: 'cyan' },
			{
				text: '{ "payment": { "id": 42, "status": "completed" } }',
				color: 'green',
			},
			{
				text: '# Payment completed... but how does the user find out?',
				color: 'amber',
			},
			{
				text: '# They must wait for their next poll cycle (up to 2 seconds)',
				color: 'red',
			},
			{
				text: '# No server-push mechanism to notify them instantly',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'check-polling': ['polling-waste'],
	'check-cpu': ['cpu-spike'],
	'trigger-event': ['no-push', 'latency-delay'],
};

const STEP_DEFS = [
	{ id: 'install-cable', label: 'Install Cable Adapter' },
	{ id: 'run-install', label: 'Run Installer' },
	{ id: 'configure-adapter', label: 'Configure Adapter' },
	{ id: 'generate-channel', label: 'Generate Channel' },
	{ id: 'authenticate-connection', label: 'Authenticate Connection' },
	{ id: 'build-broadcast-service', label: 'Build Broadcast Service' },
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
		feedback:
			'Solid Cable uses a Rake task for installation, not a generator.',
	},
];

const CONFIGURE_ADAPTER_OPTIONS = [
	{
		id: 'wrong-redis-adapter',
		label: 'adapter: redis',
		code: `# config/cable.yml
production:
  adapter: redis
  url: redis://localhost:6379/1`,
		correct: false,
		feedback:
			'This requires a running Redis instance. The whole point is to eliminate external dependencies.',
	},
	{
		id: 'wrong-async',
		label: 'adapter: async',
		code: `# config/cable.yml
production:
  adapter: async`,
		correct: false,
		feedback:
			'The async adapter is for development only. It does not persist messages or work across processes.',
	},
	{
		id: 'correct',
		label: 'adapter: solid_cable',
		code: `# config/cable.yml
production:
  adapter: solid_cable
  polling_interval: 0.1.seconds
  message_retention: 1.day`,
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
		label: 'Skip authentication',
		code: `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    # No authentication needed for WebSockets
  end
end`,
		correct: false,
		feedback:
			'Unauthenticated WebSocket connections let anyone subscribe to private channels. Every connection must verify the user.',
	},
	{
		id: 'correct',
		label: 'Verify via encrypted cookies',
		code: `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      verified = User.find_by(id: cookies.encrypted[:user_id])
      verified || reject_unauthorized_connection
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-session',
		label: 'Use session directly',
		code: `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = User.find(session[:user_id])
    end
  end
end`,
		correct: false,
		feedback:
			'WebSocket connections do not have direct access to the session store. You need a different mechanism that persists across requests.',
	},
];

const BROADCAST_SERVICE_OPTIONS = [
	{
		id: 'wrong-inline',
		label: 'Broadcast inline in controller',
		code: `class Api::V1::PaymentsController < ApplicationController
  def create
    result = ProcessPayment.call(user: Current.user, params:)
    if result.success?
      NotificationsChannel.broadcast_to(
        Current.user,
        { type: "payment", data: result.payment }
      )
      render json: result.payment, status: :created
    end
  end
end`,
		correct: false,
		feedback:
			'Broadcasting in the request cycle blocks the response. Notifications should be triggered by model callbacks or background jobs.',
	},
	{
		id: 'correct',
		label: 'Service with after_create_commit broadcast',
		code: `class BroadcastNotification < ApplicationService
  Result = Data.define(:success?, :notification, :errors)

  def initialize(user:, title:, body:)
    @user = user
    @title = title
    @body = body
  end

  def call
    validation = NotificationContract.new.call(
      title: @title, body: @body
    )
    if validation.failure?
      return Result.new(
        success?: false, notification: nil,
        errors: validation.errors.to_h
      )
    end

    notification = @user.notifications.create!(
      title: @title, body: @body
    )
    # after_create_commit on Notification broadcasts automatically
    Result.new(success?: true, notification:, errors: {})
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-direct-broadcast',
		label: 'Call broadcast_to directly in service',
		code: `class BroadcastNotification < ApplicationService
  Result = Data.define(:success?, :notification, :errors)

  def initialize(user:, title:, body:)
    @user = user
    @title = title
    @body = body
  end

  def call
    NotificationsChannel.broadcast_to(
      @user, { title: @title, body: @body }
    )
    Result.new(success?: true, notification: nil, errors: {})
  end
end`,
		correct: false,
		feedback:
			'This skips persistence entirely. No notification record is created. Use model callbacks to broadcast after the record is saved.',
	},
];

const STRESS_SCENARIOS = [
	{
		id: 'payment-notification',
		label: 'Payment completed (push)',
		description: 'WebSocket pushes payment confirmation instantly',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
	{
		id: 'message-received',
		label: 'New message (push)',
		description: 'Direct message pushed to recipient channel',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
	{
		id: 'activity-feed',
		label: 'Activity update (push)',
		description: 'Activity feed item broadcast to followers',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
	{
		id: 'unauthenticated',
		label: 'Anonymous connect',
		description: 'Connection attempt without authentication',
		method: 'WS',
		path: '/cable',
		actor: 'anonymous',
		expectedResult: 'blocked',
	},
	{
		id: 'wrong-user',
		label: 'Subscribe to other user',
		description:
			'Authenticated user tries to subscribe to another user channel',
		method: 'WS',
		path: '/cable',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'batch-broadcast',
		label: 'Batch broadcast (1000 users)',
		description: 'Server pushes to 1000 connected users simultaneously',
		method: 'WS',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
	},
];

// ── Tests ──

describe('Level 37: Real-Time (Action Cable + Solid Cable)', () => {
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
						expect(opt.feedback.toLowerCase()).not.toContain(
							'solid_cable',
						);
						expect(opt.feedback.toLowerCase()).not.toContain(
							'encrypted cookies',
						);
						expect(opt.feedback.toLowerCase()).not.toContain(
							'after_create_commit',
						);
					}
				}
			});

			test(`${name}: all option IDs are unique`, () => {
				const ids = options.map((o) => o.id);
				expect(new Set(ids).size).toBe(ids.length);
			});
		}

		test('step labels do not reveal specific answers', () => {
			for (const step of STEP_DEFS) {
				expect(step.label.toLowerCase()).not.toContain('solid_cable');
				expect(step.label.toLowerCase()).not.toContain('solid cable');
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

		test('has 4 allowed and 2 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(4);
			expect(blocked).toHaveLength(2);
		});

		test('every scenario has a description', () => {
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

	describe('Cross-phase consistency', () => {
		test('observe probes and reward scenarios both cover notifications', () => {
			const probeLabels = PROBES.map((p) => p.label.toLowerCase());
			expect(
				probeLabels.some((l) => l.includes('notification') || l.includes('poll')),
			).toBe(true);

			const scenarioLabels = STRESS_SCENARIOS.map((s) =>
				s.label.toLowerCase(),
			);
			expect(
				scenarioLabels.some(
					(l) => l.includes('push') || l.includes('broadcast'),
				),
			).toBe(true);
		});

		test('observe probes cover the polling problem', () => {
			const probeLabels = PROBES.map((p) => p.label.toLowerCase());
			expect(probeLabels.some((l) => l.includes('poll'))).toBe(true);
		});

		test('reward scenarios cover the WebSocket solution', () => {
			const scenarioLabels = STRESS_SCENARIOS.map((s) =>
				s.label.toLowerCase(),
			);
			expect(scenarioLabels.some((l) => l.includes('push'))).toBe(true);
		});

		test('reward blocked scenarios cover security (auth)', () => {
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			const labels = blocked.map((s) => s.label.toLowerCase());
			expect(
				labels.some((l) => l.includes('anonymous') || l.includes('other user')),
			).toBe(true);
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('broadcast service uses ApplicationService base class', () => {
			const correctOption = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correctOption?.code).toContain('< ApplicationService');
		});

		test('broadcast service uses Result = Data.define pattern', () => {
			const correctOption = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correctOption?.code).toContain('Result = Data.define');
			expect(correctOption?.code).toContain(':success?');
			expect(correctOption?.code).toContain(':errors');
		});

		test('broadcast service uses Dry::Validation contract', () => {
			const correctOption = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correctOption?.code).toContain('NotificationContract.new.call');
			expect(correctOption?.code).toContain('validation.failure?');
		});

		test('broadcast service returns Result on failure', () => {
			const correctOption = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correctOption?.code).toContain('Result.new');
			expect(correctOption?.code).toContain('success?: false');
		});

		test('connection authentication uses encrypted cookies (not session)', () => {
			const correctOption = AUTHENTICATE_CONNECTION_OPTIONS.find(
				(o) => o.correct,
			);
			expect(correctOption?.code).toContain('cookies.encrypted');
			expect(correctOption?.code).toContain('reject_unauthorized_connection');
			expect(correctOption?.code).not.toContain('session[');
		});

		test('wrong options still follow cumulative patterns (service base)', () => {
			// The wrong "direct broadcast" option still uses ApplicationService
			const wrongDirect = BROADCAST_SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-direct-broadcast',
			);
			expect(wrongDirect?.code).toContain('< ApplicationService');
			expect(wrongDirect?.code).toContain('Result = Data.define');
		});
	});

	describe('Data consistency', () => {
		test('no em dashes in any text content', () => {
			const allText = [
				...DISCOVERY_DEFS.map((d) => d.label),
				...PROBES.flatMap((p) => [
					p.label,
					p.command,
					...p.responseLines.map((r) => r.text),
				]),
				...STEP_DEFS.map((s) => s.label),
				...STRESS_SCENARIOS.flatMap((s) => [s.label, s.description]),
				...INSTALL_CABLE_COMMANDS.flatMap((c) => [
					c.label,
					c.feedback ?? '',
				]),
				...RUN_INSTALL_COMMANDS.flatMap((c) => [
					c.label,
					c.feedback ?? '',
				]),
				...CONFIGURE_ADAPTER_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
				...GENERATE_CHANNEL_COMMANDS.flatMap((c) => [
					c.label,
					c.feedback ?? '',
				]),
				...AUTHENTICATE_CONNECTION_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
				...BROADCAST_SERVICE_OPTIONS.flatMap((o) => [
					o.label,
					o.feedback ?? '',
				]),
			];
			for (const text of allText) {
				expect(text).not.toContain('\u2014'); // em dash
			}
		});

		test('adapter is solid_cable in correct configure option', () => {
			const correct = CONFIGURE_ADAPTER_OPTIONS.find((o) => o.correct);
			expect(correct?.code).toContain('adapter: solid_cable');
		});

		test('channel generation creates NotificationsChannel', () => {
			const correct = GENERATE_CHANNEL_COMMANDS.find((o) => o.correct);
			expect(correct?.command).toContain('channel Notifications');
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

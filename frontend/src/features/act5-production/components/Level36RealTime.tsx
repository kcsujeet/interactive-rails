/**
 * Level 36: Real-Time with Action Cable + Solid Cable
 *
 * Replace HTTP polling with WebSocket-based real-time via Action Cable.
 * Uses Solid Cable (Rails 8 default) as the adapter, no Redis needed.
 *
 * Visualization: "Connection Comparison" showing two lanes side-by-side.
 * Left lane: HTTP polling with repeated request/response arrows (99% empty).
 * Right lane: WebSocket with a single persistent connection, push-only messages.
 * Probes fire both lanes simultaneously to reveal the waste.
 */

import {
	Activity,
	ArrowRight,
	Globe,
	Radio,
	RefreshCw,
	Server,
	Wifi,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';

// ─── Discovery definitions ─────────────────────────────────────────────
const DISCOVERY_DEFS = [
	{ id: 'polling-waste', label: 'Polling returns 99% empty responses' },
	{ id: 'cpu-spike', label: '25K req/sec exhausts server CPU' },
	{ id: 'no-push', label: 'No server-push mechanism exists' },
	{ id: 'latency-delay', label: 'Notifications delayed by poll interval' },
] as const;

// ─── Probe definitions ─────────────────────────────────────────────────
const PROBES = [
	{
		id: 'check-polling',
		label: 'GET notifications (poll)',
		command: 'curl -s localhost:3000/api/v1/notifications | jq',
		responseLines: [
			{ text: '200 OK', color: 'cyan' as const },
			{ text: '{ "notifications": [] }', color: 'amber' as const },
			{ text: '# Empty. 99% of polls return nothing.', color: 'red' as const },
			{
				text: '# 50K users x 0.5 req/sec = 25,000 requests/sec wasted',
				color: 'red' as const,
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
				color: 'red' as const,
			},
			{
				text: '# Database connection pool exhausted from polling load',
				color: 'red' as const,
			},
			{
				text: '# Each poll hits: authenticate -> query -> serialize -> respond',
				color: 'amber' as const,
			},
		],
	},
	{
		id: 'trigger-event',
		label: 'POST create payment',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 99.99}\'',
		responseLines: [
			{ text: '201 Created', color: 'cyan' as const },
			{
				text: '{ "payment": { "id": 42, "status": "completed" } }',
				color: 'green' as const,
			},
			{
				text: '# Payment completed... but how does the user find out?',
				color: 'amber' as const,
			},
			{
				text: '# They must wait for their next poll cycle (up to 2 seconds)',
				color: 'red' as const,
			},
			{
				text: '# No server-push mechanism to notify them instantly',
				color: 'red' as const,
			},
		],
	},
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'check-polling': ['polling-waste'],
	'check-cpu': ['cpu-spike'],
	'trigger-event': ['no-push', 'latency-delay'],
};

// ─── Build step definitions ────────────────────────────────────────────
const STEP_DEFS = [
	{ id: 'install-cable', label: 'Install Cable Adapter' },
	{ id: 'run-install', label: 'Run Installer' },
	{ id: 'configure-adapter', label: 'Configure Adapter' },
	{ id: 'generate-channel', label: 'Generate Channel' },
	{ id: 'authenticate-connection', label: 'Authenticate Connection' },
	{ id: 'build-broadcast-service', label: 'Build Broadcast Service' },
] as const;

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

const TERMINAL_STEP_MAP: ({
	commands: typeof INSTALL_CABLE_COMMANDS;
	outputLines: { text: string; color: 'green' | 'cyan' }[];
} | null)[] = [
	{
		commands: INSTALL_CABLE_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RUN_INSTALL_COMMANDS,
		outputLines: [
			{
				text: 'create  db/cable_migrate/create_solid_cable_messages.rb',
				color: 'cyan' as const,
			},
			{ text: 'create  config/cable.yml', color: 'cyan' as const },
			{ text: 'Solid Cable installed successfully.', color: 'green' as const },
		],
	},
	null, // configure-adapter: OptionCard
	{
		commands: GENERATE_CHANNEL_COMMANDS,
		outputLines: [
			{
				text: 'create  app/channels/notifications_channel.rb',
				color: 'cyan' as const,
			},
			{
				text: 'create  test/channels/notifications_channel_test.rb',
				color: 'cyan' as const,
			},
		],
	},
	null, // authenticate-connection: OptionCard
	null, // build-broadcast-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────
const STRESS_SCENARIOS = [
	{
		id: 'payment-notification',
		label: 'Payment completed (push)',
		description: 'WebSocket pushes payment confirmation instantly',
		method: 'WS' as const,
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'message-received',
		label: 'New message (push)',
		description: 'Direct message pushed to recipient channel',
		method: 'WS' as const,
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'activity-feed',
		label: 'Activity update (push)',
		description: 'Activity feed item broadcast to followers',
		method: 'WS' as const,
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'unauthenticated',
		label: 'Anonymous connect',
		description: 'Connection attempt without authentication',
		method: 'WS' as const,
		path: '/cable',
		actor: 'anonymous',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'wrong-user',
		label: 'Subscribe to other user',
		description:
			'Authenticated user tries to subscribe to another user channel',
		method: 'WS' as const,
		path: '/cable',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'batch-broadcast',
		label: 'Batch broadcast (1000 users)',
		description: 'Server pushes to 1000 connected users simultaneously',
		method: 'WS' as const,
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed' as const,
	},
];

// ─── Visualization data ────────────────────────────────────────────────
interface PollArrow {
	id: number;
	empty: boolean;
	phase: 'request' | 'response';
}

interface WsMessage {
	id: number;
	label: string;
	color: string;
}

// ─── Code preview builder ──────────────────────────────────────────────
function getCodeFiles(
	phase: 'observe' | 'build' | 'activate' | 'reward',
	furthestStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/controllers/api/v1/notifications_controller.rb',
				language: 'ruby',
				code: `class Api::V1::NotificationsController < ApplicationController
  # Client polls this every 2 seconds
  # 50K users = 25K requests/sec
  def index
    notifications = Current.user
      .notifications
      .where(read_at: nil)
      .order(created_at: :desc)
    render json: NotificationSerializer.new(notifications)
  end
end`,
			},
			{
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    payment = @user.payments.create!(
      amount: @params[:amount], status: :completed
    )
    # No way to notify the user in real-time!
    # They have to wait for their next poll cycle
    Result.new(success?: true, payment:, errors: {})
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (furthestStep >= 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `# Gemfile
gem "solid_cable"${furthestStep >= 1 ? '\n# Installed + solid_cable:install run' : ''}`,
			});
		}

		if (furthestStep >= 2) {
			files.push({
				filename: 'config/cable.yml',
				language: 'yaml',
				code: `production:
  adapter: solid_cable
  polling_interval: 0.1.seconds
  message_retention: 1.day`,
			});
		}

		if (furthestStep >= 3) {
			files.push({
				filename: 'app/channels/notifications_channel.rb',
				language: 'ruby',
				code: `class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end

  def unsubscribed
    # Cleanup when client disconnects
  end
end`,
			});
		}

		if (furthestStep >= 4) {
			files.push({
				filename: 'app/channels/application_cable/connection.rb',
				language: 'ruby',
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
			});
		}

		if (furthestStep >= 5) {
			files.push({
				filename: 'app/services/broadcast_notification.rb',
				language: 'ruby',
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
    # after_create_commit on Notification model broadcasts
    Result.new(success?: true, notification:, errors: {})
  end
end`,
			});
			files.push({
				filename: 'app/models/notification.rb',
				language: 'ruby',
				code: `class Notification < ApplicationRecord
  belongs_to :user

  validates :title, :body, presence: true

  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(
      user,
      NotificationSerializer.new(self).serializable_hash
    )
  end
end`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: '# Step 1: Install the WebSocket adapter gem...',
			});
		}

		return files;
	}

	// activate + reward: full solution
	return [
		{
			filename: 'config/cable.yml',
			language: 'yaml',
			code: `production:
  adapter: solid_cable
  polling_interval: 0.1.seconds
  message_retention: 1.day`,
		},
		{
			filename: 'app/channels/application_cable/connection.rb',
			language: 'ruby',
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
		},
		{
			filename: 'app/channels/notifications_channel.rb',
			language: 'ruby',
			code: `class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end

  def unsubscribed
    # Cleanup when client disconnects
  end
end`,
		},
		{
			filename: 'app/services/broadcast_notification.rb',
			language: 'ruby',
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
    Result.new(success?: true, notification:, errors: {})
  end
end`,
		},
		{
			filename: 'app/models/notification.rb',
			language: 'ruby',
			code: `class Notification < ApplicationRecord
  belongs_to :user

  validates :title, :body, presence: true

  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(
      user,
      NotificationSerializer.new(self).serializable_hash
    )
  end
end`,
		},
		{
			filename: 'app/contracts/notification_contract.rb',
			language: 'ruby',
			code: `class NotificationContract < Dry::Validation::Contract
  params do
    required(:title).filled(:string)
    required(:body).filled(:string)
  end

  rule(:title) do
    key.failure('must be under 255 characters') if value.length > 255
  end
end`,
		},
	];
}

// ─── Main component ────────────────────────────────────────────────────
export function Level36RealTime({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<
		'observe' | 'build' | 'activate' | 'reward'
	>('observe');

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const [flowPhase, setFlowPhase] = useState(-1);
	const [pollArrows, setPollArrows] = useState<PollArrow[]>([]);
	const [wsMessages, setWsMessages] = useState<WsMessage[]>([]);
	const [_lastProbeId, setLastProbeId] = useState<string | null>(null);
	const flowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			// Animate the visualization
			setFlowPhase(0);

			if (probeId === 'check-polling') {
				// Show rapid empty polling requests
				const arrows: PollArrow[] = [];
				for (let i = 0; i < 8; i++) {
					arrows.push({ id: i, empty: i < 7, phase: 'response' });
				}
				setPollArrows(arrows);
			} else if (probeId === 'check-cpu') {
				// Show overloaded server
				const arrows: PollArrow[] = [];
				for (let i = 0; i < 10; i++) {
					arrows.push({ id: i + 100, empty: true, phase: 'request' });
				}
				setPollArrows(arrows);
			} else if (probeId === 'trigger-event') {
				// Show the delay: WS side is empty (no push), polling side shows delay
				setPollArrows([{ id: 200, empty: false, phase: 'response' }]);
				setWsMessages([]);
			}

			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
			flowTimerRef.current = setTimeout(() => {
				setFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 3);
		},
		[discoveryGating],
	);

	useEffect(() => {
		return () => {
			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
		};
	}, []);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	useEffect(() => {
		if (stepper.isComplete && phase === 'build') {
			setPhase('activate');
		}
	}, [stepper.isComplete, phase]);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardWsMessages, setRewardWsMessages] = useState<WsMessage[]>([]);
	const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleStressFire = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			setRewardFlowPhase(0);

			if (scenario.expectedResult === 'allowed') {
				setRewardWsMessages((prev) => [
					...prev.slice(-5),
					{
						id: Date.now(),
						label: scenario.label.replace(' (push)', ''),
						color: 'text-emerald-600 dark:text-emerald-400',
					},
				]);
			}

			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
			rewardTimerRef.current = setTimeout(() => {
				setRewardFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 2);
		},
		[stressTest],
	);

	useEffect(() => {
		return () => {
			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
		};
	}, []);

	// ── Render helpers ──
	const renderConnectionComparison = (isReward: boolean) => {
		const probeActive = isReward ? rewardFlowPhase !== -1 : flowPhase !== -1;
		const currentMessages = isReward ? rewardWsMessages : wsMessages;
		const lastResult = isReward
			? stressTest.results[stressTest.results.length - 1]
			: null;
		const isBlocked = lastResult?.result === 'blocked';

		return (
			<div className="flex gap-4 h-full">
				{/* HTTP Polling Lane */}
				<div className="flex-1 border rounded-lg border-border overflow-hidden flex flex-col">
					<div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-border flex items-center gap-2">
						<RefreshCw className="w-4 h-4 text-red-600 dark:text-red-400" />
						<span className="text-sm font-semibold text-red-700 dark:text-red-300">
							{isReward ? 'Before: HTTP Polling' : 'HTTP Polling'}
						</span>
						{isReward && (
							<Badge
								className="ml-auto text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
								variant="outline"
							>
								Replaced
							</Badge>
						)}
					</div>

					<div className="flex-1 p-3 flex flex-col gap-2">
						{/* Client -> Server arrows */}
						<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
							<span className="flex items-center gap-1">
								<Globe className="w-3 h-3" /> Client
							</span>
							<span className="flex items-center gap-1">
								Server <Server className="w-3 h-3" />
							</span>
						</div>

						{/* Poll request/response visualization */}
						<div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 space-y-1 overflow-hidden font-mono text-xs">
							{!probeActive && !isReward && (
								<div className="text-muted-foreground text-center py-6">
									Fire a probe to see polling traffic
								</div>
							)}
							{isReward && (
								<>
									<div className="text-red-600 dark:text-red-400 font-semibold mb-1">
										25,000 req/sec (99% empty)
									</div>
									{Array.from({ length: 6 }).map((_, i) => (
										<div
											className="flex items-center gap-1 text-red-500/60 dark:text-red-400/50"
											key={i}
										>
											<ArrowRight className="w-3 h-3" />
											<span>GET /notifications</span>
											<span className="ml-auto">{'{ }'}</span>
										</div>
									))}
								</>
							)}
							{!isReward &&
								probeActive &&
								pollArrows.map((a) => (
									<div
										className={`flex items-center gap-1 ${
											a.empty
												? 'text-red-500/70 dark:text-red-400/60'
												: 'text-amber-600 dark:text-amber-400'
										}`}
										key={a.id}
									>
										<ArrowRight className="w-3 h-3" />
										<span>GET /notifications</span>
										<span className="ml-auto">
											{a.empty ? '[ ]' : '[1 item]'}
										</span>
									</div>
								))}
						</div>

						{/* Stats */}
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 text-center">
								<div className="text-muted-foreground">CPU</div>
								<div className="text-red-600 dark:text-red-400 font-mono font-bold">
									95%
								</div>
							</div>
							<div className="bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 text-center">
								<div className="text-muted-foreground">Latency</div>
								<div className="text-red-600 dark:text-red-400 font-mono font-bold">
									~2s
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Flow connector between lanes */}
				<div className="flex flex-col items-center justify-center gap-2">
					<FlowConnector
						active={probeActive}
						direction="right"
						variant={isReward ? 'success' : 'danger'}
					/>
					<span className="text-xs text-muted-foreground font-medium">vs</span>
					<FlowConnector
						active={probeActive}
						direction="right"
						variant={isReward ? 'success' : 'default'}
					/>
				</div>

				{/* WebSocket Lane */}
				<div className="flex-1 border rounded-lg border-border overflow-hidden flex flex-col">
					<div
						className={`px-3 py-2 border-b border-border flex items-center gap-2 ${
							isReward
								? 'bg-emerald-50 dark:bg-emerald-950/30'
								: 'bg-zinc-50 dark:bg-zinc-900/30'
						}`}
					>
						<Wifi
							className={`w-4 h-4 ${
								isReward
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-muted-foreground'
							}`}
						/>
						<span
							className={`text-sm font-semibold ${
								isReward
									? 'text-emerald-700 dark:text-emerald-300'
									: 'text-muted-foreground'
							}`}
						>
							{isReward
								? 'After: WebSocket (Action Cable)'
								: 'WebSocket (not configured)'}
						</span>
						{isReward && (
							<Badge
								className="ml-auto text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
								variant="outline"
							>
								Active
							</Badge>
						)}
					</div>

					<div className="flex-1 p-3 flex flex-col gap-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
							<span className="flex items-center gap-1">
								<Globe className="w-3 h-3" /> Client
							</span>
							<span className="flex items-center gap-1">
								Server <Server className="w-3 h-3" />
							</span>
						</div>

						<div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 space-y-1 overflow-hidden font-mono text-xs">
							{!isReward && (
								<div className="text-muted-foreground text-center py-6">
									No WebSocket connection configured
								</div>
							)}
							{isReward && (
								<>
									<div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
										<Radio className="w-3 h-3" />
										Connected (persistent)
									</div>
									{isBlocked && lastResult && (
										<div className="flex items-center gap-1 text-red-600 dark:text-red-400">
											<span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
											REJECTED:{' '}
											{
												STRESS_SCENARIOS.find(
													(s) => s.id === lastResult.scenarioId,
												)?.label
											}
										</div>
									)}
									{currentMessages.length === 0 && !isBlocked && (
										<div className="text-muted-foreground">
											Waiting for events...
										</div>
									)}
									{currentMessages.map((msg) => (
										<div
											className={`flex items-center gap-1 ${msg.color}`}
											key={msg.id}
										>
											<Zap className="w-3 h-3" />
											<span>PUSH</span>
											<span>{msg.label}</span>
										</div>
									))}
								</>
							)}
						</div>

						{/* Stats */}
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 text-center">
								<div className="text-muted-foreground">CPU</div>
								<div
									className={`font-mono font-bold ${
										isReward
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-muted-foreground'
									}`}
								>
									{isReward ? '3%' : 'N/A'}
								</div>
							</div>
							<div className="bg-zinc-50 dark:bg-zinc-900/50 rounded border border-border p-2 text-center">
								<div className="text-muted-foreground">Latency</div>
								<div
									className={`font-mono font-bold ${
										isReward
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-muted-foreground'
									}`}
								>
									{isReward ? '~15ms' : 'N/A'}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// ── Build phase: current step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 0)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[0] };
		if (idx === 1)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[1] };
		if (idx === 2)
			return { type: 'option' as const, options: CONFIGURE_ADAPTER_OPTIONS };
		if (idx === 3)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[3] };
		if (idx === 4)
			return {
				type: 'option' as const,
				options: AUTHENTICATE_CONNECTION_OPTIONS,
			};
		if (idx === 5)
			return { type: 'option' as const, options: BROADCAST_SERVICE_OPTIONS };
		return null;
	}, [stepper.currentStep]);

	// ── Left panel content ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							50,000 users poll{' '}
							<code className="text-xs bg-muted px-1 rounded">
								GET /notifications
							</code>{' '}
							every 2 seconds. That is 25,000 requests per second, and 99%
							return empty arrays. Server CPU is at 95%.
						</p>
					</div>
					<DiscoveryChecklist
						discoveries={DISCOVERY_DEFS.map((d) => ({
							id: d.id,
							label: d.label,
							found: discoveryGating.isDiscovered(d.id),
						}))}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Replace HTTP polling with WebSocket real-time using Action Cable
							and Solid Cable.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						furthestStep={stepper.furthestStep}
						steps={STEP_DEFS.map((s) => s.label)}
					/>
				</div>
			);
		}

		if (phase === 'activate') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Solution Complete
						</h3>
						<p className="text-sm text-muted-foreground">
							Action Cable with Solid Cable is configured. Visualize the
							improvement.
						</p>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Push delivered</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">Connection rejected</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Delivered</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Rejected</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleStressFire)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
			</div>
		);
	};

	// ── Center panel content ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						{renderConnectionComparison(false)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={flowPhase !== -1}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build' && currentStepConfig) {
			if (currentStepConfig.type === 'terminal' && currentStepConfig.commands) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Install the database-backed WebSocket adapter for Rails 8.'}
									{stepper.currentStep === 1 &&
										'Run the installer to create the cable message table and configuration.'}
									{stepper.currentStep === 3 &&
										'Generate a channel class for real-time notification delivery.'}
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].label}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option') {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].label}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'Configure the Action Cable adapter for production.'}
								{stepper.currentStep === 4 &&
									'Authenticate WebSocket connections to prevent unauthorized access.'}
								{stepper.currentStep === 5 &&
									'Build a service that creates notifications and broadcasts them via the channel.'}
							</p>
						</div>
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									code={opt.code}
									disabled={stepper.isCurrentStepCompleted}
									key={opt.id}
									label={opt.label}
									language="ruby"
									onClick={() => {
										if (opt.correct) {
											stepper.completeStep();
										} else {
											stepper.recordWrongAttempt(opt.feedback);
										}
									}}
								/>
							))}
						</div>
						{stepper.lastFeedback && !stepper.isCurrentStepCompleted && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button className="w-fit" onClick={stepper.nextStep}>
									Next Step <ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							)}
					</div>
				);
			}
		}

		if (phase === 'activate') {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center space-y-4">
						<div className="flex justify-center gap-1">
							{[1, 2, 3].map((star) => (
								<Activity
									className="w-8 h-8 text-amber-400 fill-amber-400"
									key={star}
								/>
							))}
						</div>
						<Button onClick={() => setPhase('reward')}>
							Visualize Real-Time <Zap className="w-4 h-4 ml-2" />
						</Button>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">{renderConnectionComparison(true)}</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						disabled={rewardFlowPhase !== -1}
						onFire={handleStressFire}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>{renderCenterPanel()}</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal="Action Cable + Solid Cable replaces HTTP polling with WebSocket push. No Redis needed."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level36RealTime;

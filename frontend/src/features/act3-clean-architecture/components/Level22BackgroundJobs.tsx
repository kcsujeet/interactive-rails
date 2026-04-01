/**
 * Level 22: Background Jobs
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   discover that the registration service sends email with deliver_now (blocks 3s)
 *   and does other inline work synchronously. Fire registration probes to see
 *   slow response times. Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 4 steps (mix of TerminalChoice and OptionCard)
 *   Step 0: Configure Solid Queue (TerminalChoiceStep)
 *   Step 1: Create a background job (OptionCard)
 *   Step 2: Make the job idempotent (OptionCard)
 *   Step 3: Switch service to async (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire registration requests and see
 *   instant responses. Jobs process in background via Solid Queue.
 *
 * Teaches: Solid Queue (Rails 8 default), ActiveJob, perform_later, idempotency
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'email-blocks', label: 'Email blocks for 3s' },
	{ id: 'sync-side-effects', label: 'Side effects are synchronous' },
	{ id: 'slow-registration', label: 'Registration is slow' },
	{ id: 'failures-cascade', label: 'Failures cascade' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'register-alice',
		label: 'Register new user (Alice)',
		command:
			'POST /api/v1/registrations {name: "Alice", email: "alice@example.com"}',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'yellow' },
			{ text: '... waiting for SMTP server ...', color: 'muted' },
			{ text: 'Response time: 3.2s', color: 'red' },
			{
				text: 'deliver_now blocked the response while the SMTP server processed the email.',
				color: 'red',
			},
		],
	},
	{
		id: 'register-bob',
		label: 'Register new user (Bob)',
		command:
			'POST /api/v1/registrations {name: "Bob", email: "bob@example.com"}',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'yellow' },
			{
				text: '... waiting for SMTP + external profile sync ...',
				color: 'muted',
			},
			{ text: 'Response time: 4.1s', color: 'red' },
			{
				text: 'Email delivery (2.8s) plus external profile sync (1.3s) ran inline. User waited for all of it.',
				color: 'red',
			},
		],
	},
	{
		id: 'register-fail',
		label: 'Register when SMTP is down',
		command:
			'POST /api/v1/registrations {name: "Carol", email: "carol@example.com"}',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{
				text: 'Net::SMTPAuthenticationError: SMTP connection refused',
				color: 'red',
			},
			{ text: 'Response time: 8.3s (timeout)', color: 'red' },
			{
				text: 'The user was created, but deliver_now raised an exception. The entire registration failed because of the mailer.',
				color: 'yellow',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'register-alice': 'slow-registration',
	'register-bob': 'sync-side-effects',
	'register-fail': 'failures-cascade',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ mailerSublabel: string; mailerBadge: string }
> = {
	'register-alice': {
		mailerSublabel: 'deliver_now (3.2s)',
		mailerBadge: 'BLOCKING',
	},
	'register-bob': {
		mailerSublabel: 'deliver_now (2.8s)',
		mailerBadge: 'BLOCKING',
	},
	'register-fail': {
		mailerSublabel: 'SMTP TIMEOUT',
		mailerBadge: '500!',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	service: {
		stageId: 'service',
		title: 'UserRegistration',
		description:
			'The service creates a user, then runs all side effects inline: welcome email via deliver_now, external profile sync, and notification preferences setup. Each one blocks the HTTP response.',
		code: `class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # All of these block the response!
    UserMailer.welcome(user).deliver_now  # 2-3s
    sync_external_profile(user)           # 1-2s
    setup_notification_prefs(user)        # 0.3s

    Result.new(success?: true, user: user)
  end
end`,
	},
	mailer: {
		stageId: 'mailer',
		title: 'UserMailer (deliver_now)',
		description:
			'deliver_now calls the SMTP server synchronously. The HTTP response cannot return until the email is fully sent. If the SMTP server is slow or down, the entire request fails.',
		code: `# deliver_now = synchronous, blocks the response
UserMailer.welcome(user).deliver_now

# The controller waits 2-3 seconds here
# If SMTP is down, this raises an exception
# The user sees a 500 error even though
# their account was already created`,
	},
	controller: {
		stageId: 'controller',
		title: 'RegistrationsController',
		description:
			'The controller calls UserRegistration.call and waits for ALL side effects to finish before returning the response. The user stares at a loading spinner the entire time.',
	},
	database: {
		stageId: 'database',
		title: 'Database (User.create!)',
		description:
			'User.create! takes about 5-10ms. The database operation is fast. The slow part is everything that happens after: email, profile sync, and notifications.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	mailer: 'email-blocks',
	service: 'sync-side-effects',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'register-user-1',
		label: 'Register new user',
		description: 'POST registration with valid params',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'visitor',
		expectedResult: 'allowed',
	},
	{
		id: 'register-user-2',
		label: 'Register another user',
		description: 'POST registration, jobs enqueued async',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'visitor',
		expectedResult: 'allowed',
	},
	{
		id: 'register-smtp-down',
		label: 'Register (SMTP down)',
		description: 'POST registration when email server is offline',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'visitor',
		expectedResult: 'allowed',
	},
	{
		id: 'check-queue',
		label: 'Check job queue',
		description: 'GET queue status (pending jobs)',
		method: 'GET',
		path: '/admin/solid_queue/jobs',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'register-invalid',
		label: 'Register invalid params',
		description: 'POST registration with missing email',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'visitor',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 steps: 1 TerminalChoice + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'configure-queue', title: 'Configure Solid Queue' },
	{ id: 'create-job', title: 'Create a Background Job' },
	{ id: 'make-idempotent', title: 'Make the Job Idempotent' },
	{ id: 'switch-async', title: 'Switch Service to Async' },
];

// ──────────────────────────────────────────────
// Step 0: TerminalChoiceStep data
// ──────────────────────────────────────────────

const TERMINAL_STEP_0 = {
	title: 'Configure Solid Queue',
	description: (
		<p className="text-sm text-muted-foreground">
			Rails 8 ships with Solid Queue as the default job backend. It is
			database-backed, so no Redis is needed. Choose the right command to set it
			up.
		</p>
	),
	commands: [
		{
			id: 'sidekiq',
			label: 'bundle add sidekiq',
			command: 'bundle add sidekiq',
			correct: false,
			feedback:
				'Sidekiq requires Redis as an external dependency. Rails 8 has a built-in, database-backed alternative.',
		},
		{
			id: 'redis-queue',
			label: 'bundle add resque',
			command: 'bundle add resque',
			correct: false,
			feedback:
				'Resque also requires Redis. Rails 8 includes a job backend that uses your existing database.',
		},
		{
			id: 'solid-queue',
			label: 'bin/rails generate solid_queue:install',
			command: 'bin/rails generate solid_queue:install',
			correct: true,
		},
	],
	outputLines: [
		{ text: 'create  config/queue.yml', color: 'green' as const },
		{ text: 'create  db/queue_schema.rb', color: 'green' as const },
		{ text: 'insert  config/application.rb', color: 'green' as const },
		{
			text: '  config.active_job.queue_adapter = :solid_queue',
			color: 'muted' as const,
		},
		{
			text: 'Solid Queue installed. Database-backed, no Redis needed.',
			color: 'green' as const,
		},
	],
};

// Build TerminalStepData map for history (step 0 = terminal, steps 1-3 = null)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: TERMINAL_STEP_0.commands,
		outputLines: TERMINAL_STEP_0.outputLines,
	},
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step data (steps 1-3)
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// Step 1: Create a Background Job
const JOB_CLASS_OPTIONS: StepOption[] = [
	{
		id: 'plain-ruby',
		label: `class SendWelcomeNotificationJob\n  def perform(user_id)\n    user = User.find(user_id)\n    UserMailer.welcome(user).deliver_now\n  end\nend`,
		correct: false,
		feedback:
			'A plain Ruby class has no queue integration. Background jobs need to inherit from a base class that provides enqueuing, retries, and queue management.',
	},
	{
		id: 'active-job-object',
		label: `class SendWelcomeNotificationJob < ApplicationJob\n  queue_as :default\n  def perform(user)\n    UserMailer.welcome(user).deliver_now\n  end\nend`,
		correct: false,
		feedback:
			'Passing an ActiveRecord object to perform_later causes serialization issues. Jobs should receive primitive IDs and look up the record themselves.',
	},
	{
		id: 'active-job-correct',
		label: `class SendWelcomeNotificationJob < ApplicationJob\n  queue_as :default\n  def perform(user_id)\n    user = User.find(user_id)\n    UserMailer.welcome(user).deliver_now\n  end\nend`,
		correct: true,
	},
];

// Step 2: Make the Job Idempotent
const IDEMPOTENT_OPTIONS: StepOption[] = [
	{
		id: 'no-guard',
		label: `def perform(user_id)\n  user = User.find(user_id)\n  UserMailer.welcome(user).deliver_now\nend`,
		correct: false,
		feedback:
			'Without a guard, retrying the job sends the welcome email again. Jobs can run more than once due to retries or queue restarts.',
	},
	{
		id: 'rescue-only',
		label: `def perform(user_id)\n  user = User.find(user_id)\n  UserMailer.welcome(user).deliver_now\nrescue => e\n  Rails.logger.error(e)\nend`,
		correct: false,
		feedback:
			'Rescuing exceptions hides errors but does not prevent duplicate work. The job still sends the email every time it runs.',
	},
	{
		id: 'idempotent-guard',
		label: `def perform(user_id)\n  user = User.find(user_id)\n  return if user.welcome_email_sent?\n\n  UserMailer.welcome(user).deliver_now\n  user.update!(welcome_email_sent_at: Time.current)\nend`,
		correct: true,
	},
];

// Step 3: Switch Service to Async
const ASYNC_OPTIONS: StepOption[] = [
	{
		id: 'perform-now',
		label: `UserMailer.welcome(user).deliver_now\nSyncExternalProfileJob.perform_now(user.id)`,
		correct: false,
		feedback:
			'deliver_now and perform_now both run synchronously. The whole point is to stop blocking the HTTP response.',
	},
	{
		id: 'partial-async',
		label: `UserMailer.welcome(user).deliver_later\nSyncExternalProfileJob.perform_now(user.id)`,
		correct: false,
		feedback:
			'The mailer is async, but the profile sync still runs inline. All side effects should be moved to the background.',
	},
	{
		id: 'full-async',
		label: `UserMailer.welcome(user).deliver_later\nSyncExternalProfileJob.perform_later(user.id)`,
		correct: true,
	},
];

// Map from step index -> OptionCard config (only for OptionCard steps)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Create a Background Job',
		description:
			'The welcome email needs to run in the background instead of inline. Which job class follows ActiveJob conventions correctly?',
		options: JOB_CLASS_OPTIONS,
	},
	2: {
		title: 'Make the Job Idempotent',
		description:
			'Jobs can run more than once due to retries or queue restarts. Which implementation ensures the welcome email is only sent once per user?',
		options: IDEMPOTENT_OPTIONS,
	},
	3: {
		title: 'Switch Service to Async',
		description:
			'The registration service currently calls deliver_now and runs the profile sync inline. Which version moves all side effects to the background?',
		options: ASYNC_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'service', dots: 'mixed' },
	{ from: 'service', to: 'database', dots: 'clean' },
	{ from: 'service', to: 'mailer', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'service', dots: 'clean' },
	{ from: 'service', to: 'database', dots: 'clean' },
	{ from: 'service', to: 'queue', dots: 'clean' },
	{ from: 'queue', to: 'mailer', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show synchronous registration service
	if (phase === 'observe') {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # These block the HTTP response!
    UserMailer.welcome(user).deliver_now  # 2-3s
    sync_external_profile(user)           # 1-2s
    setup_notification_prefs(user)        # 0.3s

    Result.new(success?: true, user: user)
  end
end

# Total response time: 4-6 seconds
# If SMTP is down, registration fails
# User stares at loading spinner`,
			highlight: [6, 7, 8],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		// Step 0: Configuring Solid Queue
		files.push({
			filename: 'config/application.rb',
			language: 'ruby',
			code: `module MyApp
  class Application < Rails::Application
    # Rails 8: Solid Queue as default job backend
    # Database-backed, no Redis needed
    config.active_job.queue_adapter = :solid_queue
  end
end`,
			highlight: [5],
		});
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # Still synchronous (not yet fixed)
    UserMailer.welcome(user).deliver_now
    sync_external_profile(user)

    Result.new(success?: true, user: user)
  end
end`,
			highlight: [6, 7],
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'app/jobs/send_welcome_notification_job.rb',
			language: 'ruby',
			code: `class SendWelcomeNotificationJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end`,
			highlight: [1, 2, 4],
		});
	}

	if (furthestStep >= 2 && furthestStep < 3) {
		files.push({
			filename: 'app/jobs/send_welcome_notification_job.rb',
			language: 'ruby',
			code: `class SendWelcomeNotificationJob < ApplicationJob
  queue_as :default

  retry_on Net::SMTPError, wait: :polynomially_longer, attempts: 5

  def perform(user_id)
    user = User.find(user_id)
    return if user.welcome_email_sent?

    UserMailer.welcome(user).deliver_now
    user.update!(welcome_email_sent_at: Time.current)
  end
end`,
			highlight: [4, 8, 11],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/jobs/send_welcome_notification_job.rb',
			language: 'ruby',
			code: `class SendWelcomeNotificationJob < ApplicationJob
  queue_as :default

  retry_on Net::SMTPError, wait: :polynomially_longer, attempts: 5

  def perform(user_id)
    user = User.find(user_id)
    return if user.welcome_email_sent?

    UserMailer.welcome(user).deliver_now
    user.update!(welcome_email_sent_at: Time.current)
  end
end`,
			highlight: [4, 8, 11],
		});
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `class UserRegistration < ApplicationService
  def call
    user = User.create!(@params)

    # All side effects are now background jobs
    UserMailer.welcome(user).deliver_later
    SyncExternalProfileJob.perform_later(user.id)

    # Response returns instantly (< 200ms)
    Result.new(success?: true, user: user)
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, user: nil,
               errors: e.record.errors.full_messages)
  end
end`,
			highlight: [6, 7],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase left panel)
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Instant response (jobs queued async)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Validation error (no jobs enqueued)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level22BackgroundJobs({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'request',
				label: 'Request',
			},
			{
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'service',
				label: 'UserRegistration',
				inspectable: true,
				inspected: inspectedStages.has('service'),
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: 'User.create! (5ms)',
				inspectable: true,
				inspected: inspectedStages.has('database'),
			},
			{
				id: 'mailer',
				label: 'UserMailer',
				sublabel: probeDisplay ? probeDisplay.mailerSublabel : 'deliver_now',
				variant: (probeDisplay ? 'danger' : 'danger') as 'danger',
				badge: probeDisplay ? probeDisplay.mailerBadge : 'SYNC',
				inspectable: true,
				inspected: inspectedStages.has('mailer'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'controller', label: 'Controller' },
			{
				id: 'service',
				label: 'UserRegistration',
				sublabel: wasBlocked ? '422 Unprocessable' : '< 50ms',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: wasBlocked ? 'SKIPPED' : 'User.create!',
			},
			{
				id: 'queue',
				label: 'Solid Queue',
				sublabel: wasBlocked ? 'NO JOBS' : 'Jobs enqueued',
				variant: wasBlocked ? ('inactive' as const) : ('active' as const),
				badge: wasBlocked ? undefined : 'ASYNC',
			},
			{
				id: 'mailer',
				label: 'UserMailer',
				sublabel: wasBlocked ? 'SKIPPED' : 'deliver_later',
				variant: wasBlocked ? ('inactive' as const) : ('active' as const),
			},
		];
	}, [lastResult]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			// Trigger discovery if this stage has one
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
	);

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Background jobs are configured!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const isTerminalStep = stepper.currentStep === 0;

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your registration service sends the welcome email with{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								deliver_now
							</code>
							, which blocks the HTTP response for 3+ seconds. It also runs an
							external profile sync and notification setup inline.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Users stare at a loading spinner while the SMTP server processes
							the email. If the mail server is down, the entire registration
							fails.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build phase: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Allowed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Background Jobs"
					levelNumber={22}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="Registration Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: TerminalChoiceStep */}
								{isTerminalStep && (
									<TerminalChoiceStep
										commands={TERMINAL_STEP_0.commands}
										completed={isViewingCompletedStep}
										description={TERMINAL_STEP_0.description}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={TERMINAL_STEP_0.outputLines}
										stepKey={stepper.currentStep}
										terminalTitle="Terminal"
										title={TERMINAL_STEP_0.title}
									/>
								)}

								{/* Steps 1-3: OptionCard steps */}
								{!isTerminalStep && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														color="violet"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{currentOptionConfig.options.map((opt) => (
														<OptionCard
															color="violet"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
															size="lg"
														/>
													))}
												</div>

												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}

										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={
														hasNextStep ? stepper.nextStep : handleStartReward
													}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={stressTest.toggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level22BackgroundJobs;

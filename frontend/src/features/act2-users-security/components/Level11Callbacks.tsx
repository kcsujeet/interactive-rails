/**
 * Level 11: Callbacks & Normalizations
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration of the data lifecycle.
 *   Click pipeline stages to inspect the missing normalizes/callback layers.
 *   Fire data probes to discover raw email storage and missing side effects.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 4 steps (all OptionCard) building normalizations and callbacks
 *   Step 0: Choose Normalization (normalizes vs before_validation vs before_save)
 *   Step 1: Add Callback (after_create vs after_initialize vs after_save)
 *   Step 2: Order Callbacks (lifecycle ordering quiz)
 *   Step 3: Avoid Pitfall (after_commit vs after_save for external calls)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Lifecycle" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire data scenarios at the
 *   lifecycle pipeline and watch normalizes/callbacks handle each one.
 *
 * Teaches: Rails 8 normalizes, after_create, callback ordering, after_commit
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
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

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'raw-stored', label: 'Raw email stored without cleanup' },
	{ id: 'lookup-fails', label: 'Case-sensitive lookup returns nil' },
	{ id: 'no-welcome', label: 'No welcome email on signup' },
	{ id: 'no-hooks', label: 'Model has no lifecycle hooks' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'signup-messy',
		label: 'POST signup with messy email',
		command: 'POST /api/v1/users (email: "  JOE@GMAIL.COM  ")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":5,"email":"  JOE@GMAIL.COM  "}',
				color: 'yellow',
			},
			{
				text: 'Email stored with leading spaces and uppercase. No cleanup.',
				color: 'red',
			},
		],
	},
	{
		id: 'lookup-clean',
		label: 'GET user by clean email',
		command: 'User.find_by(email: "joe@gmail.com")',
		responseLines: [
			{ text: '=> nil', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'DB has "  JOE@GMAIL.COM  " but query uses "joe@gmail.com".',
				color: 'yellow',
			},
			{
				text: 'Case mismatch + whitespace. Lookup fails silently.',
				color: 'red',
			},
		],
	},
	{
		id: 'check-mailer',
		label: 'Check mailer queue after signup',
		command: 'ActionMailer::Base.deliveries.count',
		responseLines: [
			{ text: '=> 0', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No emails queued. User.create! does nothing beyond INSERT.',
				color: 'yellow',
			},
			{
				text: 'No after_create callback to trigger the welcome email.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'signup-messy': 'raw-stored',
	'lookup-clean': 'lookup-fails',
	'check-mailer': 'no-welcome',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ normalizesSublabel: string; callbacksBadge: string }
> = {
	'signup-messy': {
		normalizesSublabel: '"  JOE@GMAIL.COM  "',
		callbacksBadge: 'RAW!',
	},
	'lookup-clean': {
		normalizesSublabel: 'nil (mismatch)',
		callbacksBadge: 'MISS!',
	},
	'check-mailer': {
		normalizesSublabel: '(skipped)',
		callbacksBadge: '0 emails',
	},
};

// Map probe IDs to data display text
const PROBE_DATA_CARD: Record<string, string> = {
	'signup-messy': '"  JOE@GMAIL.COM  "',
	'lookup-clean': '"joe@gmail.com"',
	'check-mailer': 'User.create!',
};

// ──────────────────────────────────────────────
// Flow animation messages (per probe / scenario)
// ──────────────────────────────────────────────

// Observe phase: 4 zones (Input, Normalizes, Model, Callbacks)
const OBSERVE_FLOW: Record<string, string[]> = {
	'signup-messy': [
		'POST /api/v1/users from signup form',
		'No normalizes, raw data passes through',
		'Saved as "  JOE@GMAIL.COM  "',
		'No callbacks, nothing else happens',
	],
	'lookup-clean': [
		'User.find_by(email: "joe@gmail.com")',
		'No normalization on queries either',
		'DB has "  JOE@GMAIL.COM  ", query uses "joe@gmail.com"',
		'Lookup fails silently, nil returned',
	],
	'check-mailer': [
		'User.create! from registration',
		'No normalizes configured',
		'Record saved to database',
		'No after_create callback, 0 emails sent',
	],
};

// Reward phase: 4 zones (Input, Normalizes, Model, Callbacks)
const REWARD_FLOW: Record<string, string[]> = {
	'messy-signup': [
		'"  JOE@GMAIL.COM  " from signup',
		'strip + downcase: "joe@gmail.com"',
		'Cleaned email saved to DB',
		'after_create: welcome email queued',
	],
	'clean-lookup': [
		'find_by(email: "joe@gmail.com")',
		'Query value normalized automatically',
		'Match found in database',
		'No callback needed for reads',
	],
	'welcome-email': [
		'New user registration',
		'Email normalized on write',
		'User record persisted',
		'after_create fires: UserMailer.welcome',
	],
	'update-no-welcome': [
		'PATCH /api/v1/users/5',
		'Normalizes still runs on update',
		'Updated record saved',
		'after_create skipped (not a create)',
	],
	'rollback-crm': [
		'POST /users (transaction fails)',
		'Normalizes runs before validation',
		'Transaction rolled back',
		'after_commit PREVENTED (safe!)',
	],
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	input: {
		stageId: 'input',
		title: 'Incoming User Data',
		description:
			'Raw params arrive from the signup form. The email field contains whatever the user typed: extra spaces, mixed case, accidental whitespace. No transformation happens before it reaches the model.',
	},
	normalizes: {
		stageId: 'normalizes',
		title: 'Normalizes (Missing!)',
		description:
			'This stage does not exist yet. There is no normalization layer to clean data before it reaches validation or the database. Rails 8 introduces a declarative normalizes API for exactly this purpose.',
	},
	model: {
		stageId: 'model',
		title: 'User Model',
		description:
			'The model validates presence and uniqueness, but stores data exactly as received. Email "  JOE@GMAIL.COM  " passes validation and gets saved as-is.',
		code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true,
                    uniqueness: true
  # No normalizes, no callbacks
end`,
	},
	callbacks: {
		stageId: 'callbacks',
		title: 'Callbacks (Missing!)',
		description:
			'No lifecycle hooks are configured. After a user is created, nothing else happens: no welcome email, no CRM sync, no side effects. The controller would have to do everything inline.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	normalizes: 'raw-stored',
	callbacks: 'no-hooks',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'messy-signup',
		label: 'Messy email signup',
		description: 'Email with spaces and uppercase gets normalized',
		method: 'POST',
		path: '/api/v1/users',
		actor: '"  JOE@GMAIL.COM  "',
		expectedResult: 'allowed',
	},
	{
		id: 'clean-lookup',
		label: 'Lookup by different case',
		description: 'Query value normalized automatically by Rails',
		method: 'GET',
		path: '/api/v1/users?email=joe@gmail.com',
		actor: 'system query',
		expectedResult: 'allowed',
	},
	{
		id: 'welcome-email',
		label: 'Welcome email on create',
		description: 'after_create fires and queues the mailer',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
	{
		id: 'update-no-welcome',
		label: 'Update skips welcome email',
		description: 'after_create does not fire on updates',
		method: 'PATCH',
		path: '/api/v1/users/5',
		actor: 'existing_user',
		expectedResult: 'allowed',
	},
	{
		id: 'rollback-crm',
		label: 'Rollback prevents CRM sync',
		description: 'after_commit blocks orphan API calls on rollback',
		method: 'POST',
		path: '/api/v1/users (rollback)',
		actor: 'failed_txn',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 steps: all OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-normalization', title: 'Choose Normalization' },
	{ id: 'add-callback', title: 'Add Callback' },
	{ id: 'order-callbacks', title: 'Order Callbacks' },
	{ id: 'avoid-pitfall', title: 'Avoid Pitfall' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// Step 0: Choose Normalization
const NORMALIZATION_OPTIONS: StepOption[] = [
	{
		id: 'before-validation',
		label: 'before_validation :downcase_email',
		correct: false,
		feedback:
			"Manual callbacks work, but they don't normalize query values. Rails 8 has a declarative API that handles both writes and reads.",
	},
	{
		id: 'normalizes',
		label: 'normalizes :email, with: -> e { e.strip.downcase }',
		correct: true,
	},
	{
		id: 'before-save',
		label: 'before_save { self.email = email.strip.downcase }',
		correct: false,
		feedback:
			"before_save runs too late for validation uniqueness checks. Also, this pattern doesn't normalize finder queries.",
	},
];

// Step 1: Add Callback
const CALLBACK_OPTIONS: StepOption[] = [
	{
		id: 'after-initialize',
		label: 'after_initialize :send_welcome_email',
		correct: false,
		feedback:
			'after_initialize runs every time a record is loaded from the database, not just on creation. Users would get welcome emails on every page load.',
	},
	{
		id: 'after-save',
		label: 'after_save :send_welcome_email',
		correct: false,
		feedback:
			'after_save fires on both create AND update. Users would get a welcome email every time their profile is edited.',
	},
	{
		id: 'after-create',
		label: 'after_create :send_welcome_email',
		correct: true,
	},
];

// Step 2: Order Callbacks
const ORDER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-alpha',
		label: 'after_save -> before_validation -> before_save -> after_commit',
		correct: false,
		feedback:
			'Callbacks run in lifecycle order, not alphabetical. Validation happens before save, not after.',
	},
	{
		id: 'wrong-mixed',
		label: 'before_save -> before_validation -> after_commit -> after_save',
		correct: false,
		feedback:
			'Validation always runs before save. The lifecycle follows a strict sequence from validation through to commit.',
	},
	{
		id: 'correct-order',
		label: 'before_validation -> before_save -> after_save -> after_commit',
		correct: true,
	},
];

// Step 3: Avoid Pitfall
const PITFALL_OPTIONS: StepOption[] = [
	{
		id: 'after-save',
		label: 'after_save',
		correct: false,
		feedback:
			'after_save runs inside the transaction. If the transaction rolls back, the external API call already happened and cannot be undone.',
	},
	{
		id: 'after-create',
		label: 'after_create',
		correct: false,
		feedback:
			'after_create also runs inside the transaction. External calls made here can fire for data that never actually gets committed.',
	},
	{
		id: 'after-commit',
		label: 'after_commit',
		correct: true,
	},
];

// Map step index to option config
const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Choose Normalization',
		description:
			'Emails are stored with leading/trailing spaces and inconsistent casing. Pick the best way to normalize the email field so writes and reads are consistent.',
		options: NORMALIZATION_OPTIONS,
	},
	1: {
		title: 'Add Callback',
		description:
			'New users sign up but never receive a welcome email. Add the right callback to trigger it when a user is first created.',
		options: CALLBACK_OPTIONS,
	},
	2: {
		title: 'Order Callbacks',
		description:
			'Your normalizes must run before validation checks uniqueness, and the welcome email must fire only after the record is persisted. Which lifecycle order does Rails actually follow?',
		options: ORDER_OPTIONS,
	},
	3: {
		title: 'Avoid Pitfall',
		description:
			'You need to sync new users to an external CRM via an API call. Which callback is safe for external side effects that should not fire if the transaction rolls back?',
		options: PITFALL_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the bare User model
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  # No normalization
  # No callbacks
  # Email stored as-is: " JOE@GMAIL.COM "
end`,
			highlight: [5, 6, 7],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  # No normalization
  # No callbacks
  # Email stored as-is: " JOE@GMAIL.COM "
end`,
			highlight: [5, 6, 7],
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }
end`,
			highlight: [5],
		});
	}

	if (furthestStep >= 2 && furthestStep < 3) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  after_create :send_welcome_email

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end`,
			highlight: [7, 11, 12, 13],
		});
	}

	if (furthestStep >= 3 && furthestStep < 4) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  # Lifecycle order:
  # 1. before_validation (normalizes run here)
  # 2. before_save
  # 3. after_save (inside transaction)
  # 4. after_commit (transaction committed)

  after_create :send_welcome_email

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end`,
			highlight: [7, 8, 9, 10, 11],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  # Lifecycle order:
  # 1. before_validation (normalizes run here)
  # 2. before_save
  # 3. after_save (inside transaction)
  # 4. after_commit (transaction committed)

  after_create :send_welcome_email

  # Safe for external calls: runs after transaction commits
  after_commit :sync_to_crm, on: :create

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end

  def sync_to_crm
    CrmSyncJob.perform_later(id)
  end
end`,
			highlight: [15, 16, 25, 26, 27],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase)
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
					<span className="text-foreground">Data processed correctly</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Side effect prevented (rollback)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level11Callbacks({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] =
		useState<StageInspectorData | null>(null);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Probe display state (tracks last probe for visualization) ──
	const probeDisplay = lastProbeId
		? PROBE_PIPELINE_MAP[lastProbeId]
		: null;

	// ── Latest stress test result (for reward visualization) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastScenario = lastResult
		? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
		: null;
	const wasBlocked = lastResult?.result === 'blocked';

	// ── Flow animation state ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<string[]>([]);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: string[]) => {
			clearFlow();
			setFlowMessages(messages);
			const totalPhases = messages.length * 2 - 1;
			const delay = 1000;

			setFlowPhase(0);

			for (let p = 1; p <= totalPhases; p++) {
				const t = setTimeout(() => {
					setFlowPhase(p);
				}, delay * p);
				flowTimeoutsRef.current.push(t);
			}

			const endT = setTimeout(() => {
				setFlowPhase(-1);
			}, delay * (totalPhases + 2));
			flowTimeoutsRef.current.push(endT);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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
			const messages = OBSERVE_FLOW[probeId];
			if (messages) runFlow(messages);
			// Mark all zones as inspected after animation reveals them
			setInspectedStages(new Set(['input', 'normalizes', 'model', 'callbacks']));
		},
		[discoveryGating, runFlow],
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

	const handleActivateLifecycle = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runFlow(messages);
		},
		[stressTest, runFlow],
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
		return { valid: true, message: 'Callbacks and normalizations configured!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your User model stores emails exactly as typed. Signups arrive
							as{' '}
							<span className="font-mono text-primary">
								&quot; JOE@GMAIL.COM &quot;
							</span>{' '}
							with extra whitespace and mixed case. Lookups by{' '}
							<span className="font-mono text-primary">joe@gmail.com</span>{' '}
							fail because the stored value does not match.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							No welcome email fires on signup either. The model has no
							lifecycle hooks. Rails 8 introduces{' '}
							<span className="text-foreground font-medium">normalizes</span>{' '}
							for declarative data cleaning, and callbacks like{' '}
							<span className="text-foreground font-medium">after_create</span>{' '}
							for side effects.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
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
										<div className="text-xs text-success/70">Processed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Prevented</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Callbacks & Normalizations"
					levelNumber={11}
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
							{/* Data Transform Lane: vertical zones with arrows */}
							<div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-6 relative">
								{/* Input Zone */}
								<button
									type="button"
									className={`w-full max-w-sm border rounded-lg p-3 bg-card text-left transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: !inspectedStages.has('input')
												? 'ring-1 ring-primary/20'
												: ''
									}`}
									onClick={() => handleStageClick('input')}
								>
									<div className="flex items-center justify-between mb-1.5">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Raw User Data
										</span>
										{!inspectedStages.has('input') && flowPhase !== 0 && (
											<span className="text-primary text-sm animate-pulse font-bold">
												?
											</span>
										)}
									</div>
									<pre className="text-xs font-mono text-foreground leading-relaxed">
										{lastProbeId
											? PROBE_DATA_CARD[lastProbeId]
											: '"  JOE@GMAIL.COM  "'}
									</pre>
									{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
										<div className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[0]}
										</div>
									)}
								</button>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 1}
									dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
								/>

								{/* Normalizes Zone */}
								<button
									type="button"
									className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 2
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
											: probeDisplay
												? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10'
									} ${
										flowPhase !== 2 && !inspectedStages.has('normalizes')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('normalizes')}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Normalizes
									</div>
									<div
										className={`text-sm font-mono mt-1 ${
											probeDisplay
												? 'text-destructive'
												: 'text-muted-foreground/50'
										}`}
									>
										{probeDisplay
											? probeDisplay.normalizesSublabel
											: '(no normalizes)'}
									</div>
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[1]}
										</div>
									)}
									{!inspectedStages.has('normalizes') && flowPhase !== 2 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 3}
								/>

								{/* Model Zone */}
								<button
									type="button"
									className={`w-full max-w-sm border rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 4
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: !inspectedStages.has('model')
												? 'ring-1 ring-primary/20'
												: ''
									}`}
									onClick={() => handleStageClick('model')}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										User Model
									</div>
									<div className="text-xs font-mono text-muted-foreground mt-1">
										validates + saves
									</div>
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div className={`text-xs text-primary font-medium mt-1 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[2]}
										</div>
									)}
									{!inspectedStages.has('model') && flowPhase !== 4 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 5}
									dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
								/>

								{/* Callbacks Zone */}
								<button
									type="button"
									className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 6
											? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
											: probeDisplay
												? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10'
									} ${
										flowPhase !== 6 && !inspectedStages.has('callbacks')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('callbacks')}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Callbacks
									</div>
									<div
										className={`text-sm font-mono mt-1 ${
											probeDisplay
												? 'text-destructive'
												: 'text-muted-foreground/50'
										}`}
									>
										{probeDisplay
											? probeDisplay.callbacksBadge
											: '(no callbacks)'}
									</div>
									{flowMessages[3] && (flowPhase >= 6 || flowPhase === -1) && (
										<div className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 6 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[3]}
										</div>
									)}
									{!inspectedStages.has('callbacks') && flowPhase !== 6 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Stage Inspector overlay */}
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
									disabled={flowPhase !== -1}
									onProbe={handleProbe}
									probes={PROBES}
									title="Data Probe"
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
								{currentOptionConfig && (
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

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
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

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Your model now normalizes data and fires lifecycle callbacks.
									Watch how messy inputs get cleaned and side effects fire
									safely.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateLifecycle}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Lifecycle
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Data Transform Lane: active normalizes + callbacks */}
							<div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-6">
								{/* Input Zone */}
								<div
									className={`w-full max-w-sm border rounded-lg p-3 bg-card text-center transition-all duration-300 ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: ''
									}`}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
										Raw User Data
									</div>
									<div className="text-xs font-mono text-foreground">
										{lastScenario
											? lastScenario.actor
											: 'Fire a scenario below'}
									</div>
									{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
										<div className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[0]}
										</div>
									)}
								</div>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 1}
								/>

								{/* Normalizes Zone (active) */}
								<div
									className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 ${
										flowPhase === 2
											? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
											: lastScenario?.id === 'messy-signup'
												? 'border-success bg-success/10 dark:bg-success/15'
												: 'border-success/40 bg-success/5 dark:bg-success/10'
									}`}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Normalizes
									</div>
									<div className="font-mono text-xs text-success mt-1">
										{lastScenario?.id === 'messy-signup'
											? 'strip + downcase'
											: lastScenario?.id ===
												  'clean-lookup'
												? 'query normalized'
												: 'e.strip.downcase'}
									</div>
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div className={`text-xs text-success font-medium mt-1 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[1]}
										</div>
									)}
								</div>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 3}
								/>

								{/* Model Zone */}
								<div
									className={`w-full max-w-sm border rounded-lg p-3 text-center bg-card transition-all duration-300 ${
										flowPhase === 4
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: ''
									}`}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										User Model
									</div>
									<div className="text-xs font-mono text-muted-foreground mt-1">
										validates + saves
									</div>
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div className={`text-xs text-primary font-medium mt-1 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}>
											{flowMessages[2]}
										</div>
									)}
								</div>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 5}
									dotColor={
										wasBlocked
											? 'bg-destructive'
											: lastResult
												? 'bg-success'
												: 'bg-primary'
									}
								/>

								{/* Callbacks Zone (active) */}
								<div
									className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 ${
										flowPhase === 6
											? wasBlocked
												? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive bg-destructive/5 dark:bg-destructive/10'
												: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
											: wasBlocked
												? 'border-destructive bg-destructive/5 dark:bg-destructive/10'
												: lastScenario?.id ===
													  'welcome-email'
													? 'border-success bg-success/10 dark:bg-success/15'
													: 'border-success/40 bg-success/5 dark:bg-success/10'
									}`}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Callbacks
									</div>
									<div
										className={`font-mono text-xs mt-1 ${
											wasBlocked
												? 'text-destructive font-bold'
												: 'text-success'
										}`}
									>
										{wasBlocked
											? 'after_commit: PREVENTED'
											: lastScenario?.id ===
												  'welcome-email'
												? 'welcome queued'
												: lastScenario?.id ===
													  'update-no-welcome'
													? 'skipped (update)'
													: 'after_create'}
									</div>
									{flowMessages[3] && (flowPhase >= 6 || flowPhase === -1) && (
										<div className={`text-xs font-medium mt-1 ${flowPhase === 6 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
											wasBlocked ? 'text-destructive' : 'text-success'
										}`}>
											{flowMessages[3]}
										</div>
									)}
									{wasBlocked && flowPhase !== 6 && (
										<div className="text-xs font-bold text-destructive mt-1">
											SAFE (rollback detected)
										</div>
									)}
								</div>
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={flowPhase !== -1}
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

export default Level11Callbacks;

/**
 * Level 10: Validations
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire data probes to see garbage get saved. Discovery gating
 *   controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 4 steps building ActiveRecord validations
 *   Step 0: Add presence validation (OptionCard)
 *   Step 1: Add uniqueness validation (OptionCard)
 *   Step 2: Add format validation (OptionCard)
 *   Step 3: Test invalid record in Rails Console (TerminalChoiceStep)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Validations" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire data payloads at the
 *   validated model and watch accepted/rejected results.
 *
 * Teaches: validates, presence, uniqueness, format, errors.full_messages
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
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
	{ id: 'empty-saved', label: 'Empty posts get saved to the database' },
	{ id: 'duplicate-email', label: 'Duplicate emails are accepted' },
	{ id: 'bad-format', label: 'Malformed emails pass through' },
	{ id: 'no-validations', label: 'Model has no validations' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'empty-post',
		label: 'POST empty record',
		command: 'POST /api/v1/posts (title: "", body: "")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":5,"title":"","body":""}',
				color: 'muted',
			},
			{
				text: 'Empty post saved. No presence check ran.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'duplicate-email',
		label: 'POST duplicate email',
		command: 'POST /api/v1/users (email: "joe@test.com") [already exists]',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":8,"email":"joe@test.com"}',
				color: 'muted',
			},
			{
				text: 'Duplicate email saved. No uniqueness check.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'bad-email',
		label: 'POST invalid email',
		command: 'POST /api/v1/users (email: "not-an-email")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":9,"email":"not-an-email"}',
				color: 'muted',
			},
			{
				text: 'Malformed email saved. No format validation.',
				color: 'yellow',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'empty-post': 'empty-saved',
	'duplicate-email': 'duplicate-email',
	'bad-email': 'bad-format',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ modelSublabel: string; dbBadge: string }
> = {
	'empty-post': {
		modelSublabel: 'title: ""',
		dbBadge: '201!',
	},
	'duplicate-email': {
		modelSublabel: 'joe@test.com',
		dbBadge: '201!',
	},
	'bad-email': {
		modelSublabel: 'not-an-email',
		dbBadge: '201!',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'The controller receives the request, builds a new record, and calls save. It trusts whatever data comes in.',
		code: `def create
  post = Post.new(post_params)
  post.save  # Always succeeds, no checks!
  render json: post, status: :created
end`,
	},
	model: {
		stageId: 'model',
		title: 'Post Model (No Validations)',
		description:
			'The model has no validations. Any data passes straight through to the database. Empty strings, duplicates, malformed values all get saved.',
		code: `class Post < ApplicationRecord
  # No validations!
  # Anything gets saved.
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database (Garbage In)',
		description:
			'The database stores whatever the model sends. Empty titles, duplicate emails, and malformed data pile up. Cleaning up later is painful.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	model: 'no-validations',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-post',
		label: 'Valid post with title and body',
		description: 'A complete post with all required fields',
		method: 'POST',
		path: '/api/v1/posts',
		actor: 'authenticated user',
		expectedResult: 'allowed',
	},
	{
		id: 'empty-title',
		label: 'Post with blank title',
		description: 'Missing required title field',
		method: 'POST',
		path: '/api/v1/posts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-user',
		label: 'User with valid email',
		description: 'New user with unique, properly formatted email',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'registration',
		expectedResult: 'allowed',
	},
	{
		id: 'duplicate-email',
		label: 'User with duplicate email',
		description: 'Email already exists in the database',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'registration',
		expectedResult: 'blocked',
	},
	{
		id: 'bad-email-format',
		label: 'User with malformed email',
		description: 'Email fails format validation',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'registration',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 steps: 3 OptionCard + 1 terminal)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'presence', title: 'Add Presence Validation' },
	{ id: 'uniqueness', title: 'Add Uniqueness Validation' },
	{ id: 'format', title: 'Add Format Validation' },
	{ id: 'test-invalid', title: 'Test Invalid Record' },
];

// ──────────────────────────────────────────────
// Step option types
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Step 0: Presence validation (OptionCard)
// ──────────────────────────────────────────────

const PRESENCE_OPTIONS: StepOption[] = [
	{
		id: 'callback',
		label: 'before_save { raise if title.blank? }',
		correct: false,
		feedback:
			'Raising in a callback crashes the request with a 500. Validations return structured error messages instead.',
	},
	{
		id: 'db-constraint',
		label: 'add_column :posts, :title, :string, null: false',
		correct: false,
		feedback:
			'Database constraints are a safety net, but they return cryptic errors. Model validations give user-friendly messages.',
	},
	{
		id: 'presence',
		label: 'validates :title, presence: true',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 1: Uniqueness validation (OptionCard)
// ──────────────────────────────────────────────

const UNIQUENESS_OPTIONS: StepOption[] = [
	{
		id: 'manual-check',
		label: 'User.find_by(email: email).nil?',
		correct: false,
		feedback:
			'Manual lookups have race conditions. Two requests can check simultaneously and both pass.',
	},
	{
		id: 'uniqueness',
		label: 'validates :email, uniqueness: { case_sensitive: false }',
		correct: true,
	},
	{
		id: 'rescue',
		label: 'rescue ActiveRecord::RecordNotUnique',
		correct: false,
		feedback:
			'Rescuing database errors is reactive. Validations check proactively before attempting the save.',
	},
];

// ──────────────────────────────────────────────
// Step 2: Format validation (OptionCard)
// ──────────────────────────────────────────────

const FORMAT_OPTIONS: StepOption[] = [
	{
		id: 'simple-regex',
		label: 'validates :email, format: { with: /@/ }',
		correct: false,
		feedback:
			'A single @ check is too permissive. "not@valid" would pass. Use the standard email regexp.',
	},
	{
		id: 'custom-method',
		label: 'validate :check_email_format',
		correct: false,
		feedback:
			'Writing custom email regex is error-prone. Ruby ships a battle-tested pattern in URI::MailTo.',
	},
	{
		id: 'uri-regexp',
		label: 'validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 3: Test invalid record (TerminalChoiceStep, irb>)
// ──────────────────────────────────────────────

const testCommands: TerminalCommand[] = [
	{
		id: 'valid-check',
		label: 'post.valid?',
		command: 'post.valid?',
		correct: false,
		feedback:
			'That returns true/false but does not show the error details. You need the actual messages.',
	},
	{
		id: 'save-bang',
		label: 'post.save!',
		command: 'post.save!',
		correct: false,
		feedback:
			'Bang methods raise exceptions on failure. You want to inspect the errors, not crash.',
	},
	{
		id: 'full-messages',
		label: 'post.errors.full_messages',
		command: 'post.errors.full_messages',
		correct: true,
	},
];

const testOutput: TerminalOutputLine[] = [
	{
		text: '=> ["Title can\'t be blank", "Body can\'t be blank"]',
		color: 'red',
	},
];

// Terminal step map for buildTerminalHistory
const CONSOLE_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: testCommands, outputLines: testOutput },
];

// OptionCard step configs (indexed by step number)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Add Presence Validation',
		description:
			'Posts are being created with blank titles. How should you prevent empty values from being saved?',
		options: PRESENCE_OPTIONS,
	},
	1: {
		title: 'Add Uniqueness Validation',
		description:
			'Users are signing up with duplicate emails (including case variations like "Admin@" vs "admin@"). Pick the validation that prevents duplicates regardless of casing.',
		options: UNIQUENESS_OPTIONS,
	},
	2: {
		title: 'Add Format Validation',
		description:
			'Uniqueness alone is not enough. Strings like "not-an-email" still pass. Add a format check to ensure the email matches a proper pattern.',
		options: FORMAT_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unvalidated model
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  # No validations!
  # Any data gets saved, even blanks and duplicates.
end`,
			highlight: [2, 3],
		});
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  # No email validation!
end`,
			highlight: [3],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	const postValidations: string[] = [];
	const userValidations: string[] = [];

	if (furthestStep >= 1) {
		postValidations.push('  validates :title, presence: true');
		postValidations.push('  validates :body, presence: true');
	}

	if (furthestStep >= 2) {
		userValidations.push(
			'  validates :email, uniqueness: { case_sensitive: false }',
		);
	}

	if (furthestStep >= 3) {
		userValidations.push(
			'  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }',
		);
	}

	files.push({
		filename: 'app/models/post.rb',
		language: 'ruby',
		code:
			postValidations.length > 0
				? `class Post < ApplicationRecord\n${postValidations.join('\n')}\nend`
				: `class Post < ApplicationRecord\n  # No validations yet.\nend`,
		highlight:
			postValidations.length > 0
				? postValidations.map((_, i) => i + 2)
				: [],
	});

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
${userValidations.join('\n')}
end`,
			highlight: userValidations.map((_, i) => i + 3),
		});
	}

	// After all steps: show controller error response pattern
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def create
    post = Post.new(post_params)

    if post.save
      render json: PostSerializer.new(post), status: :created
    else
      render json: { errors: post.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end`,
			highlight: [7, 8, 9],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend
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
					<span className="text-foreground">Valid data (saved)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Invalid data (rejected with 422)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level10Validations({ onComplete }: LevelComponentProps) {
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

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId
		? PROBE_PIPELINE_MAP[lastProbeId]
		: null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? 'post.save' : undefined,
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Model',
				sublabel: probeDisplay ? probeDisplay.modelSublabel : '(no validations)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				badge: probeDisplay ? probeDisplay.dbBadge : 'GARBAGE',
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('database'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'controller', label: 'Controller' },
			{
				id: 'model',
				label: 'Validations',
				sublabel: wasBlocked ? '422 Unprocessable' : 'valid!',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'REJECTED' : undefined,
			},
			{ id: 'database', label: 'Database' },
		];
	}, [lastResult]);

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

	const handleActivateValidations = () => {
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
		return { valid: true, message: 'Validations are in place!' };
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
							Your database is full of garbage data: empty posts with no
							title, duplicate emails, and malformed addresses.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							ActiveRecord{' '}
							<span className="text-foreground font-medium">validations</span>{' '}
							catch bad data before it reaches the database, returning clear
							error messages to API consumers.
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
										<div className="text-xs text-success/70">Saved</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Rejected</div>
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
					levelName="Validations"
					levelNumber={10}
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
								{/* OptionCard steps (0, 1, 2) */}
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

								{/* Terminal step (3: test invalid record) */}
								{stepper.currentStep === 3 && (
									<TerminalChoiceStep
										commands={testCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												You have a post with no title and no body. The record
												fails validation. How do you inspect the error
												messages that explain what went wrong?
											</p>
										}
										hasNext={false}
										initialHistory={buildTerminalHistory(
											CONSOLE_STEP_MAP,
											0,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={testOutput}
										prompt="irb>"
										stepKey={stepper.currentStep}
										terminalTitle="Rails Console"
										title="Test Invalid Record"
									/>
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
									Your validations are in place. Watch invalid data get
									rejected at the model layer.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateValidations}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Validations
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
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

export default Level10Validations;

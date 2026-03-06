/**
 * Level 16: Service Objects
 *
 * Sequential phase flow: intro -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Annotated code display showing fat controller
 *   with color-coded responsibility sections. The code tells the story.
 *
 * Phase 2 (HOW - build): 3 OptionCard steps
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Service" button
 * Phase 4 (ADVANTAGE - reward): Two-zone layout with stress test
 *
 * Teaches: Service object pattern, Result pattern with Data.define, thin controllers
 */

import {
	ArrowRight,
	Check,
	Play,
	Star,
	X,
} from 'lucide-react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro phase)
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'side-effect';
	code: string;
}

const ANNOTATED_SECTIONS: AnnotatedSection[] = [
	{
		id: 'core',
		label: 'Core Logic',
		variant: 'core',
		code: `@user = User.new(registration_params)
if @user.save`,
	},
	{
		id: 'logging',
		label: 'Side Effect: Logging',
		variant: 'side-effect',
		code: `  Rails.logger.info("New: #\{@user.email}")`,
	},
	{
		id: 'preferences',
		label: 'Side Effect: Preferences',
		variant: 'side-effect',
		code: `  @user.update!(
    locale: "en", timezone: "UTC",
    notification_preference: "email"
  )`,
	},
	{
		id: 'token',
		label: 'Side Effect: Token',
		variant: 'side-effect',
		code: `  token = @user.generate_token_for(:session)`,
	},
];

// ──────────────────────────────────────────────
// Responsibility labels for reward phase
// ──────────────────────────────────────────────

const RESPONSIBILITY_LABELS = [
	'User Creation',
	'Welcome Logging',
	'Default Preferences',
	'Token Generation',
];

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-registration',
		label: 'Valid registration',
		description: 'POST with valid email and password',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
	{
		id: 'invalid-email',
		label: 'Invalid email format',
		description: 'POST with malformed email',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'duplicate-email',
		label: 'Duplicate email',
		description: 'POST with existing email address',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'missing-password',
		label: 'Missing password',
		description: 'POST without password field',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-with-name',
		label: 'Full registration',
		description: 'POST with email, password, and name',
		method: 'POST',
		path: '/api/v1/registrations',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
];

// Reward flow messages: [controller, service-result]
const REWARD_FLOW: Record<string, string[]> = {
	'valid-registration': [
		'Delegates to service',
		'Result(success: true, user: alice)',
	],
	'invalid-email': [
		'Delegates to service',
		'Result(success: false, errors: ["invalid email"])',
	],
	'duplicate-email': [
		'Delegates to service',
		'Result(success: false, errors: ["taken"])',
	],
	'missing-password': [
		'Delegates to service',
		'Result(success: false, errors: ["blank"])',
	],
	'valid-with-name': [
		'Delegates to service',
		'Result(success: true, user: bob)',
	],
};

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'define-result', title: 'Define the Result Object' },
	{ id: 'wire-controller', title: 'Wire the Controller' },
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

const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'concern',
		label: 'Extract into an ActiveSupport::Concern',
		correct: false,
		feedback:
			'Concerns mix behavior into existing classes. Registration is a multi-step workflow, not shared behavior across models.',
	},
	{
		id: 'service',
		label: 'Extract into a PORO service class (UserRegistration)',
		correct: true,
	},
	{
		id: 'callback',
		label: 'Use model callbacks (after_create)',
		correct: false,
		feedback:
			'Callbacks couple side effects to the model lifecycle. They run on every save, not just registration, and make the flow harder to follow.',
	},
	{
		id: 'module',
		label: 'Extract into a Ruby module and include it',
		correct: false,
		feedback:
			'Modules add methods to the including class. This workflow needs its own object with explicit inputs and outputs, not mixed-in methods.',
	},
];

const RESULT_OPTIONS: StepOption[] = [
	{
		id: 'hash',
		label: 'Return a hash: { success: true, user: user, errors: [] }',
		correct: false,
		feedback:
			'Hashes have no type guarantees. A typo like result[:succes] silently returns nil instead of raising an error.',
	},
	{
		id: 'openstruct',
		label: 'Use OpenStruct.new(success: true, user: user)',
		correct: false,
		feedback:
			'OpenStruct is mutable and accepts any key without validation. Typos become silent nil values, just like hashes.',
	},
	{
		id: 'data-define',
		label: 'Result = Data.define(:success?, :user, :errors)',
		correct: true,
	},
	{
		id: 'custom-class',
		label: 'Build a custom Result class with attr_reader and initialize',
		correct: false,
		feedback:
			'A custom class works but requires boilerplate. Ruby provides a built-in immutable value object that does this in one line.',
	},
];

const WIRING_OPTIONS: StepOption[] = [
	{
		id: 'instantiate-manual',
		label: 'service = UserRegistration.new(params)\nservice.call',
		correct: false,
		feedback:
			'That works but exposes two steps to every caller. The convention is a single class-level entry point that handles instantiation internally.',
	},
	{
		id: 'call-class-method',
		label: 'result = UserRegistration.call(registration_params)',
		correct: true,
	},
	{
		id: 'inline-block',
		label: 'UserRegistration.new(params) do |service|\n  service.call\nend',
		correct: false,
		feedback:
			'Block-style invocation adds complexity with no benefit. Services should have a simple, predictable call interface.',
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Choose Extraction Pattern',
		description:
			'The RegistrationsController#create is 80 lines. It handles user creation, logging, defaults, and token generation all inline. How should you extract this workflow?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define the Result Object',
		description:
			'Your service needs to communicate success or failure back to the controller. What should it return?',
		options: RESULT_OPTIONS,
	},
	2: {
		title: 'Wire the Controller',
		description:
			'The service is built. Now the controller needs to call it and handle the result. What is the conventional way to invoke a service object?',
		options: WIRING_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'intro') {
		files.push({
			filename: 'app/controllers/api/v1/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::V1::RegistrationsController < ApplicationController
  def create
    @user = User.new(registration_params)

    if @user.save
      # Log welcome message inline
      Rails.logger.info("New registration: #\{@user.email}")

      # Set default preferences inline
      @user.update!(
        locale: "en",
        timezone: "UTC",
        notification_preference: "email"
      )

      # Generate session token inline
      token = @user.generate_token_for(:session)

      render json: { user: @user, token: token },
             status: :created
    else
      render json: { errors: @user.errors },
             status: :unprocessable_entity
    end
  rescue => e
    @user&.destroy  # Cleanup attempt
    render json: { error: e.message },
           status: :internal_server_error
  end

  private

  def registration_params
    params.expect(user: [:email, :password, :name])
  end
end`,
			highlight: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
		});
		return files;
	}

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::V1::RegistrationsController < ApplicationController
  def create
    @user = User.new(registration_params)

    if @user.save
      Rails.logger.info("New registration: #\{@user.email}")
      @user.update!(locale: "en", timezone: "UTC",
                    notification_preference: "email")
      token = @user.generate_token_for(:session)

      render json: { user: @user, token: token },
             status: :created
    else
      render json: { errors: @user.errors },
             status: :unprocessable_entity
    end
  rescue => e
    @user&.destroy
    render json: { error: e.message },
           status: :internal_server_error
  end
end`,
			highlight: [5, 6, 7, 8, 9],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? [
							'class UserRegistration < ApplicationService',
							'  Result = Data.define(:success?, :user, :errors)',
							'',
							'  def initialize(params)',
							'    @params = params',
							'  end',
							'',
							'  def call',
							'    user = User.new(@params)',
							'',
							'    unless user.save',
							'      return Result.new(',
							'        success?: false, user: nil,',
							'        errors: user.errors.full_messages',
							'      )',
							'    end',
							'',
							'    # Side effects (isolated, non-blocking)',
							'    Rails.logger.info("New registration: #{user.email}")',
							'    user.update!(locale: "en", timezone: "UTC",',
							'                 notification_preference: "email")',
							'',
							'    Result.new(success?: true, user: user, errors: [])',
							'  end',
							'end',
						].join('\n')
					: furthestStep >= 2
						? [
								'class UserRegistration < ApplicationService',
								'  Result = Data.define(:success?, :user, :errors)',
								'',
								'  def initialize(params)',
								'    @params = params',
								'  end',
								'',
								'  def call',
								'    user = User.new(@params)',
								'',
								'    unless user.save',
								'      return Result.new(',
								'        success?: false, user: nil,',
								'        errors: user.errors.full_messages',
								'      )',
								'    end',
								'',
								'    # Side effects here...',
								'    Result.new(success?: true, user: user, errors: [])',
								'  end',
								'end',
								'',
								'# How does the controller call this service?',
							].join('\n')
						: [
								'class UserRegistration < ApplicationService',
								'  # What should the service return?',
								'',
								'  def initialize(params)',
								'    @params = params',
								'  end',
								'',
								'  def call',
								'    user = User.new(@params)',
								'',
								'    unless user.save',
								'      # return failure...',
								'    end',
								'',
								'    # Side effects here...',
								'    # return success...',
								'  end',
								'end',
							].join('\n'),
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/api/v1/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::V1::RegistrationsController < ApplicationController
  def create
    result = UserRegistration.call(registration_params)

    if result.success?
      render json: { user: result.user },
             status: :created
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end

  private

  def registration_params
    params.expect(user: [:email, :password, :name])
  end
end`,
			highlight: [3, 5],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Legend (reward phase left panel)
// ──────────────────────────────────────────────

function ServiceLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Architecture Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Valid input (service returns Result with success)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Invalid input (service returns Result with errors)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level16ServiceObjects({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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

	const handleActivateService = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler (reward phase) ──
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardFlowMessages, setRewardFlowMessages] = useState<string[]>([]);
	const rewardFlowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearRewardFlow = useCallback(() => {
		for (const t of rewardFlowTimeoutsRef.current) clearTimeout(t);
		rewardFlowTimeoutsRef.current = [];
	}, []);

	const runRewardFlow = useCallback(
		(messages: string[]) => {
			clearRewardFlow();
			setRewardFlowMessages(messages);
			setRewardFlowPhase(0);

			const t1 = setTimeout(() => setRewardFlowPhase(1), 600);
			const t2 = setTimeout(() => setRewardFlowPhase(2), 1200);
			const t3 = setTimeout(() => setRewardFlowPhase(-1), 2400);
			rewardFlowTimeoutsRef.current.push(t1, t2, t3);
		},
		[clearRewardFlow],
	);

	useEffect(() => {
		return () => clearRewardFlow();
	}, [clearRewardFlow]);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runRewardFlow(messages);
		},
		[stressTest, runRewardFlow],
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
		return { valid: true, message: 'Service object extracted cleanly!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Latest stress test result for reward visualization
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastWasBlocked = lastResult?.result === 'blocked';

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								RegistrationsController#create
							</code>{' '}
							action is 80 lines long. It handles user creation,
							logging, preferences, and token generation all
							inline in one action.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{phase === 'intro'
								? 'The annotated code shows 4 distinct responsibilities tangled together. Extract them into a service object.'
								: 'Extract the workflow into a service object with a clear Result type.'}
						</p>
					</div>

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

					{phase === 'reward' && (
						<>
							<ServiceLegend />
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">
											Allowed
										</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">
											Rejected
										</div>
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
					levelName="Service Objects"
					levelNumber={16}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									The Problem: RegistrationsController#create
								</div>
								<span className="text-xs font-mono text-destructive font-bold">
									80 lines, 4 responsibilities
								</span>
							</div>

							{/* Annotated code sections */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-1">
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'def create'}
									</pre>

									{ANNOTATED_SECTIONS.map((section) => {
										const isSideEffect =
											section.variant === 'side-effect';

										return (
											<div
												key={section.id}
												className={`border-l-2 rounded-r-md px-3 py-2 ${
													isSideEffect
														? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-400/5'
														: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30'
												}`}
											>
												<div className="flex items-center gap-2 mb-1">
													<Badge
														variant={
															isSideEffect
																? 'outline'
																: 'secondary'
														}
														className={`text-[10px] px-1.5 py-0 ${
															isSideEffect
																? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
																: 'text-muted-foreground'
														}`}
													>
														{section.label}
													</Badge>
												</div>
												<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
													{section.code}
												</pre>
											</div>
										);
									})}

									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'  render json: { user: @user, token: token }'}
									</pre>
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'end'}
									</pre>
								</div>
							</div>

							{/* Callout */}
							<div className="px-6 py-3">
								<div className="max-w-lg mx-auto">
									<div className="border border-amber-500/30 bg-amber-500/5 dark:bg-amber-400/5 rounded-lg p-3 text-sm text-foreground">
										<strong>4 responsibilities in one method.</strong>{' '}
										This logic can&apos;t be reused by a rake task,
										tested without HTTP, or understood at a glance.
									</div>
								</div>
							</div>

							{/* Build the Fix button (always visible) */}
							<div className="p-4 flex justify-center">
								<Button
									className="gap-2"
									onClick={handleStartBuild}
									size="lg"
								>
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{currentOptionConfig.options.map(
											(opt) => (
												<OptionCard
													color="violet"
													disabled={!opt.correct}
													key={opt.id}
													mono
													name={opt.label}
													selected={opt.correct}
													size="lg"
												/>
											),
										)}
									</div>
								) : (
									<>
										<div className="space-y-2">
											{currentOptionConfig.options.map(
												(opt) => (
													<OptionCard
														color="violet"
														key={opt.id}
														mono
														name={opt.label}
														onClick={() =>
															handleOptionClick(
																opt,
															)
														}
														size="lg"
													/>
												),
											)}
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
							</div>
						</div>
					)}

					{/* ── Phase 3: Activate ── */}
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
									Your service object is extracted. The
									controller is now 5 lines. Watch the service
									handle registrations cleanly.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateService}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Service
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex items-center justify-center px-6">
								<div className="flex items-center gap-4 w-full max-w-2xl">
									{/* Thin Controller zone */}
									<div
										className={`flex-shrink-0 w-48 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 0
												? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-primary/30'
												: 'border-success/50 bg-success/5 dark:bg-success/10'
										}`}
									>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Controller
										</div>
										<pre className="text-xs font-mono text-foreground leading-relaxed">
											{`result = UserRegistration
  .call(params)

if result.success?
  render :created
else
  render :errors
end`}
										</pre>
										<div className="mt-2 text-xs font-mono text-success">
											8 lines
										</div>
										{rewardFlowMessages[0] &&
											rewardFlowPhase >= 0 && (
												<div
													className={`text-xs font-medium mt-1.5 text-primary ${
														rewardFlowPhase === 0
															? 'animate-in fade-in duration-300'
															: 'opacity-70'
													}`}
												>
													{rewardFlowMessages[0]}
												</div>
											)}
									</div>

									<FlowConnector
										direction="horizontal"
										active={rewardFlowPhase === 1}
										dotColor={
											lastWasBlocked
												? 'bg-destructive'
												: 'bg-success'
										}
									/>

									{/* Service zone */}
									<div
										className={`flex-1 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 2
												? lastWasBlocked
													? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/30 bg-destructive/5 dark:bg-destructive/10'
													: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/30 bg-success/5 dark:bg-success/10'
												: 'border-border bg-card'
										}`}
									>
										<div className="flex items-center justify-between mb-2">
											<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												UserRegistration Service
											</div>
											{lastResult && (
												<div
													className={`text-xs font-mono font-bold ${
														lastWasBlocked
															? 'text-destructive'
															: 'text-success'
													}`}
												>
													{lastWasBlocked
														? 'Result(failure)'
														: 'Result(success)'}
												</div>
											)}
										</div>

										<div className="space-y-1.5">
											{RESPONSIBILITY_LABELS.map((label) => (
												<div
													key={label}
													className="border border-border/50 rounded px-2.5 py-1.5 bg-muted/30 dark:bg-muted/10"
												>
													<span className="text-xs font-medium text-foreground">
														{label}
													</span>
												</div>
											))}
										</div>

										{rewardFlowMessages[1] &&
											rewardFlowPhase >= 2 && (
												<div
													className={`text-xs font-medium mt-2 ${
														rewardFlowPhase === 2
															? 'animate-in fade-in duration-300'
															: 'opacity-70'
													} ${
														lastWasBlocked
															? 'text-destructive'
															: 'text-success'
													}`}
												>
													{rewardFlowMessages[1]}
												</div>
											)}
									</div>
								</div>
							</div>

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
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level16ServiceObjects;

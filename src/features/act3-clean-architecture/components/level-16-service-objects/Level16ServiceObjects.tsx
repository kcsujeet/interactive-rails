/**
 * Level 16: Service Objects
 *
 * Sequential phase flow: intro -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Annotated code display showing fat controller
 *   with color-coded responsibility sections. The code tells the story.
 *
 * Phase 2 (HOW - build): 4 OptionCard steps
 * Phase 3 (ADVANTAGE - reward): Two-zone layout with stress test
 *
 * Teaches: Service object pattern, Result pattern with Data.define, thin controllers
 */

import { ArrowRight, Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act3-level16-service-objects', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

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
		id: 'checks',
		label: 'Inline Validation Checks',
		variant: 'core',
		code: `if params[:email].blank?
  return render json: { error: "Email required" }, status: 422
end
if params[:password].length < 8
  return render json: { error: "Too short" }, status: 422
end
if params[:display_name].blank?
  return render json: { error: "Name required" }, status: 422
end`,
	},
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
		code: `  Rails.logger.info("New: #{@user.email}")`,
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
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'define-result', title: 'Define the Result Object' },
	{ id: 'move-side-effects', title: 'Move the Side Effects' },
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

const SIDE_EFFECTS_OPTIONS: StepOption[] = [
	{
		id: 'callbacks',
		label: 'Move them into after_create callbacks on User',
		correct: false,
		feedback:
			'Callbacks run on every save, not just registration. Logging and preference setup would fire on admin edits, CSV imports, and tests too.',
	},
	{
		id: 'separate-services',
		label:
			'Create a separate service for each (WelcomeLogger, PreferenceSetter, TokenGenerator)',
		correct: false,
		feedback:
			'Three extra classes for three lines of code each. Over-extraction makes the workflow harder to follow, not easier.',
	},
	{
		id: 'inline-in-call',
		label:
			"Run them sequentially inside the service's #call method, after the save",
		correct: true,
	},
	{
		id: 'background-job',
		label: 'Enqueue each side effect as a background job',
		correct: false,
		feedback:
			'Background jobs add async complexity. Preferences and tokens are needed immediately for the response. Logging could be async, but not all three.',
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
		title: 'Move the Side Effects',
		description:
			'The controller has 3 side effects after user creation: logging, setting default preferences, and generating a session token. Where should they live in the service?',
		options: SIDE_EFFECTS_OPTIONS,
	},
	3: {
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
			filename: 'app/controllers/api/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::RegistrationsController < ApplicationController
  def create
    @user = User.new(registration_params)

    # Inline validation checks
    if params[:email].blank?
      return render json: { error: "Email required" }, status: 422
    end
    if params[:password].length < 8
      return render json: { error: "Too short" }, status: 422
    end
    if params[:display_name].blank?
      return render json: { error: "Name required" }, status: 422
    end

    if @user.save
      # Log welcome message inline
      Rails.logger.info("New registration: #{@user.email}")

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
			highlight: [
				6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
				27, 28, 29,
			],
		});
		return files;
	}

	// Step 0: fat controller (choosing extraction pattern)
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::RegistrationsController < ApplicationController
  def create
    @user = User.new(registration_params)

    # Inline validation checks
    return render json: { error: "Email required" }, status: 422 if params[:email].blank?
    return render json: { error: "Too short" }, status: 422 if params[:password].length < 8
    return render json: { error: "Name required" }, status: 422 if params[:display_name].blank?

    if @user.save
      Rails.logger.info("New registration: #{@user.email}")
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
			highlight: [6, 7, 8, 10, 11, 12, 13, 14],
		});
	}

	// Step 1: service skeleton, no Result yet (choosing Result type)
	if (furthestStep === 1) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: [
				'class UserRegistration < ApplicationService',
				'  # What should the service return?',
				'',
				'  def initialize(params)',
				'    @params = params',
				'  end',
				'',
				'  def call',
				'    # Inline checks (carried from controller)',
				'    # return failure if @params[:email].blank?',
				'    # return failure if @params[:password].length < 8',
				'',
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

	// Step 2: service with Result, placeholder side effects (choosing where side effects go)
	if (furthestStep === 2) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: [
				'class UserRegistration < ApplicationService',
				'  Result = Data.define(:success?, :user, :errors)',
				'',
				'  def initialize(params)',
				'    @params = params',
				'  end',
				'',
				'  def call',
				'    # Inline validation checks (from controller)',
				'    if @params[:email].blank?',
				'      return Result.new(success?: false, user: nil, errors: ["Email required"])',
				'    end',
				'    if @params[:password].length < 8',
				'      return Result.new(success?: false, user: nil, errors: ["Password too short"])',
				'    end',
				'',
				'    user = User.new(@params)',
				'',
				'    unless user.save',
				'      return Result.new(',
				'        success?: false, user: nil,',
				'        errors: user.errors.full_messages',
				'      )',
				'    end',
				'',
				'    # Where do the side effects go?',
				'    # - logging',
				'    # - default preferences',
				'    # - token generation',
				'',
				'    Result.new(success?: true, user: user, errors: [])',
				'  end',
				'end',
			].join('\n'),
			highlight: [2, 23, 24, 25, 26],
		});
	}

	// Step 3: service complete with side effects (choosing how to wire controller)
	if (furthestStep === 3) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: [
				'class UserRegistration < ApplicationService',
				'  Result = Data.define(:success?, :user, :errors)',
				'',
				'  def initialize(params)',
				'    @params = params',
				'  end',
				'',
				'  def call',
				'    # Inline validation checks (from controller)',
				'    if @params[:email].blank?',
				'      return Result.new(success?: false, user: nil, errors: ["Email required"])',
				'    end',
				'    if @params[:password].length < 8',
				'      return Result.new(success?: false, user: nil, errors: ["Password too short"])',
				'    end',
				'',
				'    user = User.new(@params)',
				'',
				'    unless user.save',
				'      return Result.new(',
				'        success?: false, user: nil,',
				'        errors: user.errors.full_messages',
				'      )',
				'    end',
				'',
				'    # Side effects (isolated, testable)',
				'    Rails.logger.info("New registration: #{user.email}")',
				'    user.update!(locale: "en", timezone: "UTC",',
				'                 notification_preference: "email")',
				'    token = user.generate_token_for(:session)',
				'',
				'    Result.new(success?: true, user: user, errors: [])',
				'  end',
				'end',
				'',
				'# How does the controller call this service?',
			].join('\n'),
			highlight: [23, 24, 25, 26],
		});
	}

	// Step 4 (all complete): service + thin controller
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: [
				'class UserRegistration < ApplicationService',
				'  Result = Data.define(:success?, :user, :errors)',
				'',
				'  def initialize(params)',
				'    @params = params',
				'  end',
				'',
				'  def call',
				'    # Inline validation checks (from controller)',
				'    if @params[:email].blank?',
				'      return Result.new(success?: false, user: nil, errors: ["Email required"])',
				'    end',
				'    if @params[:password].length < 8',
				'      return Result.new(success?: false, user: nil, errors: ["Password too short"])',
				'    end',
				'',
				'    user = User.new(@params)',
				'',
				'    unless user.save',
				'      return Result.new(',
				'        success?: false, user: nil,',
				'        errors: user.errors.full_messages',
				'      )',
				'    end',
				'',
				'    # Side effects (isolated, testable)',
				'    Rails.logger.info("New registration: #{user.email}")',
				'    user.update!(locale: "en", timezone: "UTC",',
				'                 notification_preference: "email")',
				'    token = user.generate_token_for(:session)',
				'',
				'    Result.new(success?: true, user: user, errors: [])',
				'  end',
				'end',
			].join('\n'),
			highlight: [2],
		});
		files.push({
			filename: 'app/controllers/api/registrations_controller.rb',
			language: 'ruby',
			code: `class Api::RegistrationsController < ApplicationController
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
// Component
// ──────────────────────────────────────────────

export function Level16ServiceObjects({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('intro');

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
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

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
							action is 80 lines long. It handles validation checks, user
							creation, logging, preferences, and token generation all inline in
							one action.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{phase === 'intro'
								? 'The annotated code shows 5 distinct responsibilities tangled together. Extract them into a service object.'
								: 'Move the workflow out of the controller into one dedicated place with a return value the caller can branch on.'}
						</p>
					</div>

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
									80 lines, 5 responsibilities
								</span>
							</div>

							{/* Annotated code sections */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-1">
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'def create'}
									</pre>

									{ANNOTATED_SECTIONS.map((section) => {
										const isSideEffect = section.variant === 'side-effect';

										return (
											<div
												className={`border-l-2 rounded-r-md px-3 py-2 ${
													isSideEffect
														? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-400/5'
														: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30'
												}`}
												key={section.id}
											>
												<div className="flex items-center gap-2 mb-1">
													<Badge
														className={`text-[10px] px-1.5 py-0 ${
															isSideEffect
																? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
																: 'text-muted-foreground'
														}`}
														variant={isSideEffect ? 'outline' : 'secondary'}
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
										<strong>5 responsibilities in one method.</strong> This
										logic can&apos;t be reused by a rake task, tested without
										HTTP, or understood at a glance.
									</div>
								</div>
							</div>

							{/* Build the Fix button (always visible) */}
							<div className="p-4 flex justify-center">
								<Button className="gap-2" onClick={handleStartBuild} size="lg">
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
										{shuffledOptions.map((opt) => (
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
											{shuffledOptions.map((opt) => (
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
												hasNextStep
													? stepper.nextStep
													: () => {
															setPhase('reward');
														}
											}
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

					{/* ── Phase 3: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									The Fix: Controller + UserRegistration Service
								</div>
							</div>

							{/* Annotated code: thin controller */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-1">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
										Controller (8 lines)
									</div>
									<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/5 rounded-r-md px-3 py-2">
										<div className="flex items-center gap-2 mb-1">
											<Badge
												className="text-[10px] px-1.5 py-0 text-success"
												variant="secondary"
											>
												Delegates
											</Badge>
										</div>
										<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`result = UserRegistration.call(params)
if result.success?
  render json: { user: result.user }, status: :created
else
  render json: { errors: result.errors }, status: :unprocessable_entity
end`}</pre>
									</div>
								</div>
							</div>

							{/* Annotated code: service with responsibilities */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-1">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
										UserRegistration Service
									</div>
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'def call'}
									</pre>

									<div className="border-l-2 border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30 rounded-r-md px-3 py-2">
										<div className="flex items-center gap-2 mb-1">
											<Badge
												className="text-[10px] px-1.5 py-0 text-muted-foreground"
												variant="secondary"
											>
												Inline Checks + Core Logic
											</Badge>
										</div>
										<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`return failure if @params[:email].blank?
return failure if @params[:password].length < 8
user = User.new(@params)
return Result.new(failure) unless user.save`}</pre>
									</div>

									{ANNOTATED_SECTIONS.filter(
										(s) => s.variant === 'side-effect',
									).map((section) => (
										<div
											className="border-l-2 border-l-success bg-success/5 dark:bg-success/5 rounded-r-md px-3 py-2"
											key={section.id}
										>
											<div className="flex items-center gap-2 mb-1">
												<Badge
													className="text-[10px] px-1.5 py-0 border-success/50 text-success"
													variant="outline"
												>
													{section.label.replace('Side Effect: ', 'Isolated: ')}
												</Badge>
											</div>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												{section.code}
											</pre>
										</div>
									))}

									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'  Result.new(success: true, user: user)'}
									</pre>
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'end'}
									</pre>
								</div>
							</div>

							{/* Problems solved checklist */}
							<div className="px-6 py-3">
								<div className="max-w-lg mx-auto">
									<div className="border border-success/30 bg-success/5 dark:bg-success/5 rounded-lg p-3 space-y-2">
										<div className="text-xs font-semibold text-success uppercase tracking-wider">
											Problems Solved
										</div>
										<div className="space-y-1.5 text-sm text-foreground">
											<div className="flex items-start gap-2">
												<Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
												<span>
													<strong>Reusable by a rake task:</strong>{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														UserRegistration.call(params)
													</code>{' '}
													works from controllers, rake tasks, console, or tests.
												</span>
											</div>
											<div className="flex items-start gap-2">
												<Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
												<span>
													<strong>Testable without HTTP:</strong> Unit test
													calls{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														UserRegistration.call
													</code>{' '}
													directly. No request context needed.
												</span>
											</div>
											<div className="flex items-start gap-2">
												<Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
												<span>
													<strong>Readable at a glance:</strong> Controller is 8
													lines. Service has one public method with clear inputs
													and outputs.
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward'
							? STEP_DEFS.length
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level16ServiceObjects;

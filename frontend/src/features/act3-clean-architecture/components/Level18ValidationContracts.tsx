/**
 * Level 18: Validation Contracts
 *
 * Sequential phase flow: intro -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Static annotated code display (Type 2).
 *   Shows the registration service (from L16) with color-coded validation blocks.
 *   Each inline check gets a destructive left border + Badge label.
 *   Callout states the structural problems. "Build the Fix" always visible.
 * Phase 2 (HOW - build): 4 steps (1 TerminalChoice + 3 OptionCard)
 *   Step 0: Install dry-validation gem (TerminalChoiceStep)
 *   Step 1: Choose schema approach (OptionCard)
 *   Step 2: Create composed contract (OptionCard)
 *   Step 3: Add cross-field rule (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Same annotated code style as intro, now
 *   showing thin service (green) + contract with composed schemas (green).
 *   "Problems Solved" checklist closing the loop on intro's stated problems.
 *
 * Visualization approach: Type 2 static intro (refactoring concept).
 * The scattered validations are self-evident by reading the service code.
 *
 * Teaches: dry-validation gem, Dry::Schema, schema composition, cross-field rules
 */

import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro)
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'scattered' | 'buried';
	code: string;
}

const INTRO_SECTIONS: AnnotatedSection[] = [
	{
		id: 'email-check',
		label: 'Inline: Email Check',
		variant: 'scattered',
		code: `if @params[:email].blank?\n  return Result.new(success?: false, errors: ["Email required"])\nend`,
	},
	{
		id: 'password-check',
		label: 'Inline: Password Check',
		variant: 'scattered',
		code: `if @params[:password].length < 8\n  return Result.new(success?: false, errors: ["Password too short"])\nend`,
	},
	{
		id: 'name-check',
		label: 'Inline: Display Name Check',
		variant: 'scattered',
		code: `if @params[:display_name].blank?\n  return Result.new(success?: false, errors: ["Name required"])\nend`,
	},
	{
		id: 'digest-check',
		label: 'Inline: Digest Frequency',
		variant: 'scattered',
		code: `unless %w[daily weekly monthly never].include?(@params[:digest])\n  return Result.new(success?: false, errors: ["Bad digest"])\nend`,
	},
	{
		id: 'cross-field',
		label: 'Buried: Cross-Field Rule',
		variant: 'buried',
		code: `if @params[:role] == "creator" && @params[:digest] != "weekly"\n  return Result.new(success?: false, errors: ["Creators need weekly"])\nend`,
	},
	{
		id: 'create',
		label: 'Core: Record Creation',
		variant: 'core',
		code: `user = User.create!(email: @params[:email], ...)\nProfile.create!(user: user, ...)\nNotificationPref.create!(user: user, ...)`,
	},
];

// ──────────────────────────────────────────────
// Step definitions (1 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install dry-validation' },
	{ id: 'schema-approach', title: 'Choose Schema Approach' },
	{ id: 'compose-contract', title: 'Create the Contract' },
	{ id: 'cross-field-rule', title: 'Add Cross-Field Rule' },
];

// ──────────────────────────────────────────────
// Terminal step data (step 0)
// ──────────────────────────────────────────────

const INSTALL_GEM_COMMANDS = [
	{
		id: 'npm-install',
		label: 'npm install dry-validation',
		command: 'npm install dry-validation',
		correct: false,
		feedback:
			'dry-validation is a Ruby gem, not an npm package. Ruby gems are installed through a different tool.',
	},
	{
		id: 'gem-install',
		label: 'gem install dry-validation',
		command: 'gem install dry-validation',
		correct: false,
		feedback:
			'That installs system-wide. In a Rails project, dependencies are managed through the Gemfile so the whole team stays in sync.',
	},
	{
		id: 'bundle-add',
		label: 'bundle add dry-validation',
		command: 'bundle add dry-validation',
		correct: true,
	},
];

const INSTALL_GEM_OUTPUT = [
	{ text: 'Fetching dry-validation 1.10.0', color: 'muted' as const },
	{ text: 'Fetching dry-schema 1.13.4', color: 'muted' as const },
	{ text: 'Installing dry-schema 1.13.4', color: 'green' as const },
	{ text: 'Installing dry-validation 1.10.0', color: 'green' as const },
	{
		text: 'Bundle updated! dry-validation and dry-schema added to Gemfile.',
		color: 'green' as const,
	},
];

// Terminal step map for building history (step 0 is terminal, rest are null)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: INSTALL_GEM_COMMANDS, outputLines: INSTALL_GEM_OUTPUT },
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

// Step 1: Choose Schema Approach
const SCHEMA_APPROACH_OPTIONS: StepOption[] = [
	{
		id: 'inline-checks',
		label: 'Keep inline if/else checks in the service',
		correct: false,
		feedback:
			'Inline checks are exactly the problem. They scatter validation logic and produce inconsistent errors.',
	},
	{
		id: 'active-model',
		label: 'Use ActiveModel::Model with validates macros',
		correct: false,
		feedback:
			'ActiveModel ties validation to Rails. It cannot separate schema checks (types, formats) from business rules (cross-field logic).',
	},
	{
		id: 'dry-schema',
		label: 'Dry::Schema.Params { required(:email).filled(:string) }',
		correct: true,
	},
	{
		id: 'json-schema',
		label: 'JSON Schema validation with json_schemer gem',
		correct: false,
		feedback:
			'JSON Schema validates structure but has no Ruby-native rule blocks for cross-field business logic.',
	},
];

// Step 2: Create the Contract
const COMPOSE_CONTRACT_OPTIONS: StepOption[] = [
	{
		id: 'single-schema',
		label: 'params(RegistrationSchema)',
		correct: false,
		feedback:
			'One giant schema defeats the purpose. Individual schemas per model are reusable across different contracts.',
	},
	{
		id: 'nested-schemas',
		label: 'params { schema UserSchema; schema ProfileSchema }',
		correct: false,
		feedback:
			'That is not valid dry-validation syntax. Schemas compose with a different operator.',
	},
	{
		id: 'composed-and',
		label: 'params(UserSchema & ProfileSchema & NotifPrefsSchema)',
		correct: true,
	},
];

// Step 3: Add Cross-Field Rule
const CROSS_FIELD_RULE_OPTIONS: StepOption[] = [
	{
		id: 'validate-method',
		label: `validate :check_creator_digest\ndef check_creator_digest\n  errors.add(:role, "...") if ...\nend`,
		correct: false,
		feedback:
			'That is ActiveRecord callback syntax. Dry::Validation contracts use a different block-based API for rules.',
	},
	{
		id: 'before-action',
		label: `before_action :validate_creator_digest\ndef validate_creator_digest\n  # check in controller\nend`,
		correct: false,
		feedback:
			'That puts the logic back in the service. The whole point is to keep business rules in the contract.',
	},
	{
		id: 'rule-block',
		label: `rule(:role, :email_digest) do\n  if values[:role] == "creator" &&\n     values[:email_digest] != "weekly"\n    key(:role).failure("creators need weekly digest")\n  end\nend`,
		correct: true,
	},
];

// Map from step index -> OptionCard config (steps 1-3)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Choose Schema Approach',
		description:
			'The registration service has scattered inline checks for email format, password length, display name, bio, and digest frequency. How should you define reusable validation schemas?',
		options: SCHEMA_APPROACH_OPTIONS,
	},
	2: {
		title: 'Create the Contract',
		description:
			'You have three separate schemas: UserSchema, ProfileSchema, and NotifPrefsSchema. How do you compose them into a single contract that validates the entire registration payload?',
		options: COMPOSE_CONTRACT_OPTIONS,
	},
	3: {
		title: 'Add Cross-Field Rule',
		description:
			'Creator accounts must enable weekly digest. This business rule spans two fields (role and email_digest). How do you add it to the contract?',
		options: CROSS_FIELD_RULE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Intro phase: show service with scattered validations (service exists from L16)
	if (phase === 'intro') {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `# Service exists from L16, but validations are scattered inline!
class UserRegistration < ApplicationService
  def call
    # User validations (inline!)
    if @params[:email].blank?
      return Result.new(success?: false, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, errors: ["Password too short"])
    end

    # Profile validations (inline!)
    if @params[:display_name].blank?
      return Result.new(success?: false, errors: ["Name required"])
    end
    if @params[:bio]&.length.to_i > 500
      return Result.new(success?: false, errors: ["Bio too long"])
    end

    # Notification prefs (inline!)
    digests = %w[daily weekly monthly never]
    unless digests.include?(@params[:digest])
      return Result.new(success?: false, errors: ["Bad digest"])
    end

    # Cross-field rule (also inline!)
    if @params[:role] == "creator" && @params[:digest] != "weekly"
      return Result.new(success?: false, errors: ["Creators need weekly"])
    end

    user = User.create!(email: @params[:email], ...)
    Profile.create!(user: user, ...)
    NotificationPref.create!(user: user, ...)
    Result.new(success?: true, data: user)
  end
end`,
			highlight: [5, 6, 8, 9, 13, 14, 16, 17, 22, 23, 27, 28],
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "puma"
gem "sqlite3"

# Add dry-validation for contract-based validation
# gem "dry-validation"  <-- install this`,
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "puma"
gem "sqlite3"
gem "dry-validation"`,
			highlight: [5],
		});
	}

	if (furthestStep >= 2 && furthestStep < 3) {
		files.push({
			filename: 'app/schemas/user_schema.rb',
			language: 'ruby',
			code: `UserSchema = Dry::Schema.Params do
  required(:email).filled(:string,
    format?: URI::MailTo::EMAIL_REGEXP)
  required(:password).filled(:string, min_size?: 8)
  optional(:role).filled(:string)
end`,
		});
		files.push({
			filename: 'app/schemas/profile_schema.rb',
			language: 'ruby',
			code: `ProfileSchema = Dry::Schema.Params do
  required(:display_name).filled(:string)
  optional(:bio).filled(:string, max_size?: 500)
  optional(:location).filled(:string)
end`,
		});
		files.push({
			filename: 'app/schemas/notif_prefs_schema.rb',
			language: 'ruby',
			code: `NotifPrefsSchema = Dry::Schema.Params do
  required(:email_digest).filled(:string,
    included_in?: %w[daily weekly monthly never])
  optional(:push_enabled).filled(:bool)
  optional(:mentions_only).filled(:bool)
end`,
		});
	}

	if (furthestStep >= 3 && furthestStep < 4) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  # Add cross-field rules here...
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  rule(:role, :email_digest) do
    if values[:role] == "creator" &&
       values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end`,
			highlight: [4, 5, 6, 7],
		});
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `# Service from L16, now delegates validation to the contract
class UserRegistration < ApplicationService
  def call
    result = RegistrationContract.new.call(@params)

    if result.failure?
      return Result.new(success?: false, errors: result.errors.to_h)
    end

    attrs = result.to_h
    user = User.create!(email: attrs[:email],
                        password: attrs[:password])
    Profile.create!(user: user,
                    display_name: attrs[:display_name])
    NotificationPref.create!(user: user,
                             email_digest: attrs[:email_digest])
    Result.new(success?: true, data: user)
  end
end`,
			highlight: [4, 6, 7],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level18ValidationContracts({
	onComplete,
}: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('intro');

	// ── OptionCard step handler ──
	const handleOptionClick = (option: StepOption) => {
		if (option.correct) {
			stepper.completeStep();
		} else if (option.feedback) {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

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
		return { valid: true, message: 'Validation contract is locked down!' };
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
							The registration service (extracted in L16) creates a User,
							Profile, and NotificationPrefs. Validations are scattered inline
							inside the service with duplicated{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								Result.new
							</code>{' '}
							calls and inconsistent error formats.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Cross-field rules like "creator accounts must enable weekly
							digest" are buried between model checks. You need a validation
							contract to centralize all of this.
						</p>
					</div>

					{/* Build phases: step progress */}
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
					levelName="Validation Contracts"
					levelNumber={18}
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
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Problem: Scattered Inline Validations
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										UserRegistration#call, scattered inline checks
									</p>
								</div>

								{/* Annotated code blocks */}
								<div className="w-full max-w-2xl space-y-1.5">
									{INTRO_SECTIONS.map((section) => {
										const isScattered = section.variant === 'scattered';
										const isBuried = section.variant === 'buried';
										const borderClass = isScattered
											? 'border-l-destructive bg-destructive/5 dark:bg-destructive/10'
											: isBuried
												? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
												: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30';
										const badgeClass = isScattered
											? 'border-destructive/50 text-destructive bg-destructive/10'
											: isBuried
												? 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10'
												: 'border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';

										return (
											<div
												className={`border-l-2 rounded-r-md px-3 py-2 ${borderClass}`}
												key={section.id}
											>
												<Badge
													className={`text-[10px] mb-1 ${badgeClass}`}
													variant="outline"
												>
													{section.label}
												</Badge>
												<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
													{section.code}
												</pre>
											</div>
										);
									})}
								</div>

								{/* Callout */}
								<div className="w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3">
									<p className="text-sm text-destructive font-medium">
										5 scattered checks, each returning a separate{' '}
										<code className="text-xs bg-destructive/10 px-1 py-0.5 rounded">
											Result
										</code>
										. Only one error returned per call. Cross-field rules are
										buried. Cannot reuse validations in other services or test
										them in isolation.
									</p>
								</div>

								{/* Build the Fix button (always visible) */}
								<Button className="gap-2" onClick={handleStartBuild} size="lg">
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: Terminal choice (install gem) */}
								{stepper.currentStep === 0 && (
									<TerminalChoiceStep
										commands={INSTALL_GEM_COMMANDS}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												The dry-validation gem provides contract-based
												validation with composable schemas and cross-field
												rules. How do you add it to your Rails project?
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={INSTALL_GEM_OUTPUT}
										stepKey={stepper.currentStep}
										title="Install dry-validation"
									/>
								)}

								{/* Steps 1-3: OptionCard choices */}
								{stepper.currentStep >= 1 && currentOptionConfig && (
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
									</>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Fix: RegistrationContract
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Composable schemas, cross-field rules, structured errors
									</p>
								</div>

								{/* Clean service (thin) */}
								<div className="w-full max-w-2xl space-y-1.5">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										app/services/user_registration.rb
									</div>
									<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
										<Badge
											className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
											variant="outline"
										>
											Delegates to Contract
										</Badge>
										<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`result = RegistrationContract.new.call(@params)
if result.failure?
  return Result.new(success?: false, errors: result.errors.to_h)
end
# create records from result.to_h`}</pre>
									</div>
									<div className="mt-1 text-xs text-success font-medium px-3">
										Clean (12 lines, no inline validation)
									</div>
								</div>

								{/* Contract with schemas */}
								<div className="w-full max-w-2xl border-2 border-success/30 bg-success/5 dark:bg-success/10 rounded-lg p-4">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
										app/contracts/registration_contract.rb
									</div>
									<div className="grid grid-cols-3 gap-2 mb-2">
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												UserSchema
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												email, password{'\n'}role
											</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												ProfileSchema
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												display_name{'\n'}bio
											</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												NotifPrefsSchema
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
												email_digest{'\n'}push_enabled
											</pre>
										</div>
									</div>
									<div className="border-l-2 border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10 rounded-r-md px-2 py-1.5">
										<Badge
											className="text-[10px] mb-1 border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
											variant="outline"
										>
											Cross-Field Rule
										</Badge>
										<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
											rule(:role, :email_digest) {'{'} creators need weekly{' '}
											{'}'}
										</pre>
									</div>
								</div>

								{/* Problems Solved checklist */}
								<div className="w-full max-w-2xl rounded-lg border border-success/30 bg-success/5 dark:bg-success/10 p-3">
									<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
										Problems Solved
									</div>
									<div className="space-y-2">
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													All errors returned at once.
												</span>{' '}
												<span className="text-muted-foreground">
													Schema validates every field, returns structured
													errors for all failures in one response.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													Reusable in any endpoint.
												</span>{' '}
												<span className="text-muted-foreground">
													Admin registration, API import, CSV upload can all
													call{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														RegistrationContract.new.call(params)
													</code>
													.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">
													Cross-field rules are explicit and testable.
												</span>{' '}
												<span className="text-muted-foreground">
													<code className="text-xs bg-muted px-1 py-0.5 rounded">
														rule(:role, :email_digest)
													</code>{' '}
													lives in the contract, unit-testable without HTTP.
												</span>
											</p>
										</div>
									</div>
								</div>
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

export default Level18ValidationContracts;

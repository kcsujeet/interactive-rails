/**
 * Level 11: Callbacks & Normalizations
 *
 * 4-step progression teaching Rails 8 normalizes, lifecycle callbacks,
 * callback ordering, and after_commit for external side effects.
 * Steps: Choose Normalization -> Add Callback -> Order Callbacks -> Avoid Pitfall
 */

import { ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-normalization', title: 'Choose Normalization' },
	{ id: 'add-callback', title: 'Add Callback' },
	{ id: 'order-callbacks', title: 'Order Callbacks' },
	{ id: 'avoid-pitfall', title: 'Avoid Pitfall' },
];

// ---------------------------------------------------------------------------
// Step 1: Normalization options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface NormalizationOption {
	id: string;
	code: string;
	correct: boolean;
	feedback: string;
}

const NORMALIZATION_OPTIONS: NormalizationOption[] = [
	{
		id: 'before-validation',
		code: 'before_validation :downcase_email',
		correct: false,
		feedback:
			"Manual callbacks work, but they don't normalize query values. Rails 8 has a declarative API that handles both writes and reads.",
	},
	{
		id: 'normalizes',
		code: 'normalizes :email, with: -> e { e.strip.downcase }',
		correct: true,
		feedback: '',
	},
	{
		id: 'before-save',
		code: 'before_save { self.email = email.strip.downcase }',
		correct: false,
		feedback:
			"before_save runs too late for validation uniqueness checks. Also, this pattern doesn't normalize finder queries.",
	},
];

// ---------------------------------------------------------------------------
// Step 2: Add Callback options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface CallbackOption {
	id: string;
	code: string;
	correct: boolean;
	feedback: string;
}

const CALLBACK_OPTIONS: CallbackOption[] = [
	{
		id: 'after-initialize',
		code: 'after_initialize :send_welcome_email',
		correct: false,
		feedback:
			'after_initialize runs every time a record is loaded from the database, not just on creation. Users would get welcome emails on every page load.',
	},
	{
		id: 'after-save',
		code: 'after_save :send_welcome_email',
		correct: false,
		feedback:
			'after_save fires on both create AND update. Users would get a welcome email every time their profile is edited.',
	},
	{
		id: 'after-create',
		code: 'after_create :send_welcome_email',
		correct: true,
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Step 3: Callback ordering options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface OrderOption {
	id: string;
	label: string;
	correct: boolean;
	feedback: string;
}

const ORDER_OPTIONS: OrderOption[] = [
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
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Step 4: Avoid Pitfall options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface PitfallOption {
	id: string;
	code: string;
	correct: boolean;
	feedback: string;
}

const PITFALL_OPTIONS: PitfallOption[] = [
	{
		id: 'after-save',
		code: 'after_save',
		correct: false,
		feedback:
			'after_save runs inside the transaction. If the transaction rolls back, the external API call already happened and cannot be undone.',
	},
	{
		id: 'after-create',
		code: 'after_create',
		correct: false,
		feedback:
			'after_create also runs inside the transaction. External calls made here can fire for data that never actually gets committed.',
	},
	{
		id: 'after-commit',
		code: 'after_commit',
		correct: true,
		feedback: '',
	},
];


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level11Callbacks({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Step 1: selected normalization
	const [selectedNorm, setSelectedNorm] = useState<string | null>(null);

	// Step 2: selected callback
	const [selectedCallback, setSelectedCallback] = useState<string | null>(null);

	// Step 3: selected ordering
	const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

	// Step 4: selected pitfall answer
	const [selectedPitfall, setSelectedPitfall] = useState<string | null>(null);

	// Step 1: Normalization selection
	const handleSelectNorm = (option: NormalizationOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedNorm(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 2: Callback selection
	const handleSelectCallback = (option: CallbackOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedCallback(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 3: Ordering selection
	const handleSelectOrder = (option: OrderOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedOrder(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 4: Pitfall selection
	const handleSelectPitfall = (option: PitfallOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedPitfall(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Completion
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

	// Code preview that evolves with progress
	const getCodeFiles = () => {
		const files = [];

		// Before any progress: bare User model
		if (stepper.furthestStep === 0) {
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

		// After step 1: normalizes added
		if (stepper.furthestStep >= 1 && stepper.furthestStep < 2) {
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

		// After step 2: after_create callback added
		if (stepper.furthestStep >= 2 && stepper.furthestStep < 3) {
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

		// After step 3: full callback chain with ordering comments
		if (stepper.furthestStep >= 3 && stepper.furthestStep < 4) {
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

		// After step 4: after_commit for external sync
		if (stepper.furthestStep >= 4) {
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
				highlight: [15, 16, 24, 25, 26],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your User model stores emails exactly as typed. Signups
							arrive as{' '}
							<span className="font-mono text-primary">
								&quot; JOE@GMAIL.COM &quot;
							</span>{' '}
							with extra whitespace and mixed case. User lookups fail
							because{' '}
							<span className="font-mono text-primary">
								joe@gmail.com
							</span>{' '}
							does not match the stored value. No welcome email is sent
							on signup either.
						</p>
					</div>

					{/* Step Progress */}
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
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Callbacks & Normalizations"
					levelNumber={11}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Choose Normalization */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Normalization
								</h3>
								<p className="text-sm text-muted-foreground">
									Emails are stored with leading/trailing spaces and
									inconsistent casing. Pick the best way to normalize
									the email field so writes and reads are consistent.
								</p>

								<div className="grid gap-2">
									{NORMALIZATION_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.code}
											onClick={() => handleSelectNorm(option)}
											selected={selectedNorm === option.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step{' '}
											<ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 2: Add Callback (OptionCard) */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Callback
								</h3>
								<p className="text-sm text-muted-foreground">
									New users sign up but never receive a welcome
									email. Add the right callback to trigger it
									when a user is first created.
								</p>

								<div className="grid gap-2">
									{CALLBACK_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.code}
											onClick={() => handleSelectCallback(option)}
											selected={selectedCallback === option.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step{' '}
											<ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 3: Order Callbacks */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Order Callbacks
								</h3>
								<p className="text-sm text-muted-foreground">
									Rails callbacks fire in a specific lifecycle order.
									Which sequence is correct?
								</p>

								<div className="grid gap-2">
									{ORDER_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.label}
											onClick={() => handleSelectOrder(option)}
											selected={selectedOrder === option.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step{' '}
											<ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 4: Avoid Pitfall */}
						{stepper.currentStep === 3 && !stepper.isComplete && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Avoid Pitfall
								</h3>
								<p className="text-sm text-muted-foreground">
									You need to sync new users to an external CRM via
									an API call. Which callback is safe for external
									side effects that should not fire if the
									transaction rolls back?
								</p>

								<div className="grid gap-2">
									{PITFALL_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.code}
											onClick={() => handleSelectPitfall(option)}
											selected={selectedPitfall === option.id}
										/>
									))}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Completion: ADVANTAGE phase with before/after */}
						{stepper.isComplete && (
							<div className="space-y-6 py-6">
								<div className="text-center space-y-2">
									<div className="text-4xl">
										{'★'.repeat(stepper.starRating)}
										{'☆'.repeat(3 - stepper.starRating)}
									</div>
									<h3 className="text-xl font-bold text-foreground">
										Callbacks Configured!
									</h3>
								</div>

								{/* Before / After comparison */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
											<X className="w-4 h-4" />
											Before (Controller)
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												def create
											</div>
											<div className="ml-2 text-red-400">
												email = params[:email]
											</div>
											<div className="ml-2 text-red-400">
												email = email.strip.downcase
											</div>
											<div className="ml-2 text-zinc-300">
												user = User.create!(email: email)
											</div>
											<div className="ml-2 text-red-400">
												UserMailer.welcome(user).deliver_later
											</div>
											<div className="ml-2 text-red-400">
												CrmSyncJob.perform_later(user.id)
											</div>
											<div className="text-zinc-400">end</div>
											<div className="mt-2 text-zinc-600">
												# 6 lines of inline logic per action
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
											<ArrowRight className="w-4 h-4" />
											After (Model)
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												class User {'<'} ApplicationRecord
											</div>
											<div className="ml-2 text-emerald-400">
												normalizes :email, with: -{'>'} e {'{'}
												e.strip.downcase {'}'}
											</div>
											<div className="ml-2 text-emerald-400">
												after_create :send_welcome_email
											</div>
											<div className="ml-2 text-emerald-400">
												after_commit :sync_to_crm, on: :create
											</div>
											<div className="text-zinc-400">end</div>
											<div className="mt-2 text-zinc-600">
												# Controller stays thin, model owns the logic
											</div>
										</div>
									</div>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									The model declares all normalization and lifecycle
									behavior. Controllers just call{' '}
									<span className="font-mono text-primary">
										User.create!
									</span>{' '}
									and the rest happens automatically.
								</p>

								<div className="flex justify-center">
									<Button onClick={handleComplete}>
										Complete Level
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>
								<span className="font-mono text-primary">normalizes</span>{' '}
								transforms values on both write and read (finders)
							</li>
							<li>
								<span className="font-mono text-primary">after_create</span>{' '}
								fires only when a new record is inserted
							</li>
							<li>
								<span className="font-mono text-primary">after_commit</span>{' '}
								runs after the DB transaction is finalized
							</li>
							<li>
								Callback order: validation, save, commit
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level11Callbacks;

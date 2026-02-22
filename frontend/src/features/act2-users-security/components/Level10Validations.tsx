/**
 * Level 10: Validations
 *
 * 4-step progression to add ActiveRecord validations to the Post model.
 * Steps: Add Presence → Add Uniqueness → Add Format → Test Invalid Record
 */

import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
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
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'presence', title: 'Add Presence Validation' },
	{ id: 'uniqueness', title: 'Add Uniqueness Validation' },
	{ id: 'format', title: 'Add Format Validation' },
	{ id: 'test-invalid', title: 'Test Invalid Record' },
];

// ---------------------------------------------------------------------------
// Step 1: Presence validation (OptionCard, correct NOT first)
// ---------------------------------------------------------------------------

interface PresenceOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const PRESENCE_OPTIONS: PresenceOption[] = [
	{
		id: 'callback',
		name: 'before_save { raise if title.blank? }',
		description: 'Raise in a callback if blank',
		correct: false,
		feedback:
			'Raising in a callback crashes the request with a 500. Validations return structured error messages instead.',
	},
	{
		id: 'db-constraint',
		name: 'NOT NULL constraint (DB only)',
		description: 'Database-level constraint only',
		correct: false,
		feedback:
			'Database constraints are a safety net, but they return cryptic errors. Model validations give user-friendly messages.',
	},
	{
		id: 'presence',
		name: 'validates :title, presence: true',
		description: 'ActiveRecord presence validation',
		correct: true,
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Step 2: Uniqueness validation (TerminalChoiceStep, correct NOT first)
// ---------------------------------------------------------------------------

const uniquenessCommands: TerminalCommand[] = [
	{
		id: 'manual-check',
		label: 'User.find_by(email: email).nil?',
		command: 'User.find_by(email: email).nil?',
		correct: false,
		feedback:
			'Manual lookups have race conditions. Two requests can check simultaneously and both pass.',
	},
	{
		id: 'uniqueness',
		label: 'validates :email, uniqueness: { case_sensitive: false }',
		command: 'validates :email, uniqueness: { case_sensitive: false }',
		correct: true,
	},
	{
		id: 'rescue',
		label: 'rescue ActiveRecord::RecordNotUnique',
		command: 'rescue ActiveRecord::RecordNotUnique',
		correct: false,
		feedback:
			'Rescuing database errors is reactive. Validations check proactively before attempting the save.',
	},
];

const uniquenessOutput: TerminalOutputLine[] = [
	{ text: '=> :validates', color: 'green' },
	{ text: '', color: 'muted' },
	{
		text: 'Case-insensitive uniqueness constraint added to :email',
		color: 'cyan',
	},
];

// ---------------------------------------------------------------------------
// Step 3: Format validation (OptionCard, correct NOT first)
// ---------------------------------------------------------------------------

interface FormatOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
	{
		id: 'simple-regex',
		name: 'validates :email, format: { with: /@/ }',
		description: 'Check for @ symbol only',
		correct: false,
		feedback:
			'A single @ check is too permissive. "not@valid" would pass. Use the standard email regexp.',
	},
	{
		id: 'uri-regexp',
		name: 'validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }',
		description: 'Ruby standard library email pattern',
		correct: true,
		feedback: '',
	},
	{
		id: 'custom-method',
		name: 'validate :check_email_format',
		description: 'Custom validation method with hand-written regex',
		correct: false,
		feedback:
			'Writing custom email regex is error-prone. Ruby ships a battle-tested pattern in URI::MailTo.',
	},
];

// ---------------------------------------------------------------------------
// Step 4: Test invalid record (TerminalChoiceStep, irb> prompt, correct NOT first)
// ---------------------------------------------------------------------------

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
		text: '=> ["Title can\'t be blank", "Body can\'t be blank", "Email is invalid"]',
		color: 'red',
	},
];

// ---------------------------------------------------------------------------
// Terminal step maps (separate for shell vs console to avoid mixed history)
// ---------------------------------------------------------------------------

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: uniquenessCommands, outputLines: uniquenessOutput },
];

const CONSOLE_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: testCommands, outputLines: testOutput },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level10Validations({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Track selected options for code preview
	const [selectedPresence, setSelectedPresence] = useState<string | null>(null);
	const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

	// Step 1: Presence selection
	const handleSelectPresence = (option: PresenceOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedPresence(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Step 3: Format selection
	const handleSelectFormat = (option: FormatOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedFormat(option.id);
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
		return { valid: true, message: 'Validations are in place!' };
	};

	// Code preview that evolves with progress
	const getCodeFiles = () => {
		const files = [];

		// Build Post model with progressively added validations
		const validationLines: string[] = [];

		if (stepper.furthestStep >= 1) {
			validationLines.push('  validates :title, presence: true');
			validationLines.push('  validates :body, presence: true');
		}

		if (stepper.furthestStep >= 2) {
			validationLines.push('  validates :email, uniqueness: { case_sensitive: false }');
		}

		if (stepper.furthestStep >= 3) {
			validationLines.push('  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }');
		}

		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code:
				validationLines.length > 0
					? `class Post < ApplicationRecord\n${validationLines.join('\n')}\nend`
					: `class Post < ApplicationRecord\n  # No validations yet.\n  # Any data gets saved, even blanks and duplicates.\nend`,
			highlight:
				validationLines.length > 0
					? validationLines.map((_, i) => i + 2)
					: [],
		});

		// After all steps: show controller error response pattern
		if (stepper.furthestStep >= 4) {
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
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your database is full of garbage data: empty posts with no
							title, duplicate emails, and malformed addresses.
							ActiveRecord validations catch bad data before it reaches the
							database, returning clear error messages to API consumers.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Validations"
					levelNumber={10}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Add Presence Validation */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Presence Validation
								</h3>
								<p className="text-sm text-muted-foreground">
									Posts are being created with blank titles.
									How should you prevent empty values from being saved?
								</p>

								<div className="grid gap-2">
									{PRESENCE_OPTIONS.map((opt) => (
										<OptionCard
											color="blue"
											description={opt.description}
											disabled={isViewingCompletedStep}
											key={opt.id}
											mono
											name={opt.name}
											onClick={() => handleSelectPresence(opt)}
											selected={selectedPresence === opt.id}
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
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 2: Add Uniqueness Validation */}
						{stepper.currentStep === 1 && (
							<TerminalChoiceStep
								commands={uniquenessCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										Users are signing up with duplicate emails (including
										case variations like "Admin@" vs "admin@").
										Pick the validation that prevents duplicates
										regardless of casing.
									</p>
								}
								hasNext={stepper.currentStep < STEP_DEFS.length - 1}
								initialHistory={buildTerminalHistory(
									SHELL_STEP_MAP,
									0,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={uniquenessOutput}
								stepKey={stepper.currentStep}
								title="Add Uniqueness Validation"
							/>
						)}

						{/* Step 3: Add Format Validation */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Format Validation
								</h3>
								<p className="text-sm text-muted-foreground">
									Uniqueness alone is not enough. Strings like
									{' '}<span className="font-mono text-primary">"not-an-email"</span>{' '}
									still pass. Add a format check to ensure the email
									matches a proper pattern.
								</p>

								<div className="grid gap-2">
									{FORMAT_OPTIONS.map((opt) => (
										<OptionCard
											color="blue"
											description={opt.description}
											disabled={isViewingCompletedStep}
											key={opt.id}
											mono
											name={opt.name}
											onClick={() => handleSelectFormat(opt)}
											selected={selectedFormat === opt.id}
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
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 4: Test Invalid Record */}
						{stepper.currentStep === 3 && (
							<TerminalChoiceStep
								commands={testCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										You have a post with no title and no body. The record
										fails validation. How do you inspect the error
										messages that explain what went wrong?
									</p>
								}
								hasNext={stepper.currentStep < STEP_DEFS.length - 1}
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

						{/* ADVANTAGE phase: Before/After comparison */}
						{stepper.isComplete && (
							<div className="space-y-6 py-6">
								<div className="text-center space-y-2">
									<div className="text-4xl">
										{'★'.repeat(stepper.starRating)}
										{'☆'.repeat(3 - stepper.starRating)}
									</div>
									<h3 className="text-xl font-bold text-foreground">
										Validations Active!
									</h3>
								</div>

								{/* Before / After comparison */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
											<XCircle className="w-4 h-4" />
											Before
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												{'>'} Post.create(title: "", body: "")
											</div>
											<div className="text-red-400 mt-1">
												=&gt; #&lt;Post id: 5, title: "", body: ""&gt;
											</div>
											<div className="text-zinc-500 mt-2 text-[11px]">
												Garbage saved to the database.
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
											<CheckCircle className="w-4 h-4" />
											After
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">
												{'>'} Post.create(title: "", body: "")
											</div>
											<div className="text-emerald-400 mt-1">
												=&gt; false
											</div>
											<div className="text-zinc-300 mt-1">
												errors:
											</div>
											<div className="text-amber-400 ml-2">
												"Title can&apos;t be blank"
											</div>
											<div className="text-amber-400 ml-2">
												"Body can&apos;t be blank"
											</div>
											<div className="text-zinc-500 mt-2 text-[11px]">
												Rejected with clear error messages.
											</div>
										</div>
									</div>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									Invalid data is caught at the model layer before it
									reaches the database. Error messages are structured
									and ready for API responses.
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
								<span className="font-mono text-primary">presence: true</span>{' '}
								rejects blank values
							</li>
							<li>
								<span className="font-mono text-primary">uniqueness</span>{' '}
								prevents duplicates with DB check
							</li>
							<li>
								<span className="font-mono text-primary">format: {'{ with: /.../ }'}</span>{' '}
								validates against a pattern
							</li>
							<li>
								<span className="font-mono text-primary">errors.full_messages</span>{' '}
								returns human-readable errors
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level10Validations;

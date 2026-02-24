/**
 * Level 21: Error Handling
 *
 * Centralize error handling with rescue_from in ApplicationController.
 * Teaches: rescue_from, HTTP status code mapping, consistent JSON error shape,
 * testing error responses.
 *
 * Three-phase pedagogy:
 *   WHY   -- scattered begin/rescue blocks produce inconsistent error formats
 *   HOW   -- 4 steps: choose strategy, map exceptions, define shape, test
 *   ADVANTAGE -- before/after: raw stack trace vs clean JSON error
 */

import { ArrowRight, AlertTriangle, Check, Shield, Terminal } from 'lucide-react';
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
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-strategy', title: 'Choose Strategy' },
	{ id: 'map-exceptions', title: 'Map Exceptions to Status Codes' },
	{ id: 'define-shape', title: 'Define Error Shape' },
	{ id: 'test-response', title: 'Test Error Response' },
];

// ---------------------------------------------------------------------------
// Step 1: Choose Strategy (OptionCard click-to-select)
// ---------------------------------------------------------------------------

interface StrategyOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback?: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
	{
		id: 'per-action',
		name: 'Per-action begin/rescue blocks',
		description: 'Wrap each controller action in its own begin/rescue',
		correct: false,
		feedback:
			'Duplicating begin/rescue in every action means inconsistent error formats. One controller returns JSON, another returns plain text.',
	},
	{
		id: 'rescue-from',
		name: 'rescue_from in ApplicationController',
		description: 'Declare exception handlers once in the base controller',
		correct: true,
	},
	{
		id: 'rack-middleware',
		name: 'Rack middleware error handler',
		description: 'Catch all exceptions at the Rack layer before Rails',
		correct: false,
		feedback:
			'Middleware catches errors too early, before Rails has parsed params. You lose access to controller context and error details.',
	},
];

// ---------------------------------------------------------------------------
// Step 2: Map Exceptions to Status Codes (OptionCard click-to-select)
// ---------------------------------------------------------------------------

interface StatusOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback?: string;
}

const STATUS_OPTIONS: StatusOption[] = [
	{
		id: '500',
		name: '500 Internal Server Error',
		description: 'Server encountered an unexpected condition',
		correct: false,
		feedback:
			'500 means something broke on the server. A missing resource is a client-side issue, not a server error.',
	},
	{
		id: '400',
		name: '400 Bad Request',
		description: 'Malformed request syntax',
		correct: false,
		feedback:
			'400 means malformed request syntax. The request format is fine; the resource simply does not exist.',
	},
	{
		id: '404',
		name: '404 Not Found',
		description: 'The requested resource does not exist',
		correct: true,
	},
];

// ---------------------------------------------------------------------------
// Step 3: Define Error Shape (OptionCard click-to-select)
// ---------------------------------------------------------------------------

interface ShapeOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback?: string;
}

const SHAPE_OPTIONS: ShapeOption[] = [
	{
		id: 'bare-string',
		name: '{ error: "message" }',
		description: 'Simple string under an error key',
		correct: false,
		feedback:
			'A bare string gives clients nothing to switch on programmatically. Include a machine-readable code and structured details.',
	},
	{
		id: 'structured',
		name: '{ error: { code, message, details } }',
		description: 'Nested object with machine-readable code and details',
		correct: true,
	},
	{
		id: 'success-flag',
		name: '{ message: "...", success: false }',
		description: 'Top-level message with a success boolean',
		correct: false,
		feedback:
			'Mixing success flags with messages is ambiguous. Nest errors under an error key with code, message, and details for consistency.',
	},
];

// ---------------------------------------------------------------------------
// Step 4: Test Error Response (TerminalChoiceStep)
// ---------------------------------------------------------------------------

const testCommands: TerminalCommand[] = [
	{
		id: 'curl-raw',
		label: 'curl /api/v1/posts/999',
		command: 'curl /api/v1/posts/999',
		correct: false,
		feedback:
			'That returns the raw response. Pipe through jq to verify the JSON structure matches your error shape.',
	},
	{
		id: 'curl-jq',
		label: 'curl -s /api/v1/posts/999 | jq .error',
		command: 'curl -s /api/v1/posts/999 | jq .error',
		correct: true,
	},
	{
		id: 'rails-console',
		label: 'rails console -e test',
		command: 'rails console -e test',
		correct: false,
		feedback:
			"Console doesn't test HTTP responses. You need to make a real HTTP request to see the error formatting.",
	},
];

const testOutput: TerminalOutputLine[] = [
	{ text: '{', color: 'cyan' },
	{ text: '  "code": "not_found",', color: 'cyan' },
	{ text: '  "message": "Post not found",', color: 'cyan' },
	{ text: '  "details": {}', color: 'cyan' },
	{ text: '}', color: 'cyan' },
];

// ---------------------------------------------------------------------------
// Terminal step map for building history
// ---------------------------------------------------------------------------

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: OptionCard (strategy)
	null, // step 1: OptionCard (status codes)
	null, // step 2: OptionCard (error shape)
	{ commands: testCommands, outputLines: testOutput }, // step 3: terminal
];

// ---------------------------------------------------------------------------
// Code preview files that evolve with step completion
// ---------------------------------------------------------------------------

function getCodeFiles(completedSteps: number) {
	const files = [];

	if (completedSteps === 0) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def show
    begin
      @post = Post.find(params[:id])
      render json: @post
    rescue ActiveRecord::RecordNotFound
      render plain: "Not found", status: 500
    rescue => e
      render json: { msg: e.message }
    end
  end

  def create
    begin
      @post = Post.create!(post_params)
      render json: @post, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render plain: e.message, status: 400
    rescue => e
      render json: "<h1>Error</h1>", status: 500
    end
  end
end`,
			highlight: [3, 7, 8, 14, 17, 18, 19],
		});
	}

	if (completedSteps >= 1) {
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code:
				completedSteps === 1
					? `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from StandardError,
              with: :handle_internal_error

  private

  # Status mapping methods go here...
end`
					: completedSteps === 2
						? `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from StandardError,
              with: :handle_internal_error

  private

  def handle_not_found(exception)
    render json: { error: "..." }, status: :not_found
  end

  def handle_unprocessable(exception)
    render json: { error: "..." }, status: :unprocessable_entity
  end

  def handle_internal_error(exception)
    render json: { error: "..." }, status: :internal_server_error
  end
end`
						: completedSteps === 3
							? `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from StandardError,
              with: :handle_internal_error

  private

  def handle_not_found(exception)
    render json: {
      error: {
        code: "not_found",
        message: exception.message,
        details: {}
      }
    }, status: :not_found
  end

  def handle_unprocessable(exception)
    render json: {
      error: {
        code: "unprocessable_entity",
        message: exception.message,
        details: exception.record.errors.to_hash
      }
    }, status: :unprocessable_entity
  end

  def handle_internal_error(exception)
    render json: {
      error: {
        code: "internal_server_error",
        message: "Something went wrong",
        details: {}
      }
    }, status: :internal_server_error
  end
end`
							: `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from StandardError,
              with: :handle_internal_error

  private

  def handle_not_found(exception)
    render json: {
      error: {
        code: "not_found",
        message: exception.message,
        details: {}
      }
    }, status: :not_found
  end

  def handle_unprocessable(exception)
    render json: {
      error: {
        code: "unprocessable_entity",
        message: exception.message,
        details: exception.record.errors.to_hash
      }
    }, status: :unprocessable_entity
  end

  def handle_internal_error(exception)
    render json: {
      error: {
        code: "internal_server_error",
        message: "Something went wrong",
        details: {}
      }
    }, status: :internal_server_error
  end
end`,
			highlight:
				completedSteps === 1
					? [2, 3, 4, 5, 6, 7]
					: completedSteps === 2
						? [11, 12, 13, 15, 16, 17, 19, 20, 21]
						: [13, 14, 15, 16, 24, 25, 26, 34, 35, 36],
		});
	}

	if (completedSteps >= 4) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])
    render json: @post
  end

  def create
    @post = Post.create!(post_params)
    render json: @post, status: :created
  end

  private

  def post_params
    params.expect(post: [:title, :body, :published])
  end
end`,
			highlight: [3, 4, 8, 9],
		});
	}

	if (files.length === 0) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `# Scattered error handling across controllers
# Each action has its own begin/rescue
# Inconsistent formats: plain text, JSON, HTML`,
			highlight: [],
		});
	}

	return files;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level21ErrorHandling({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Track which options were selected for visual feedback
	const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
	const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
	const [selectedShape, setSelectedShape] = useState<string | null>(null);

	// -----------------------------------------------------------------------
	// Handlers
	// -----------------------------------------------------------------------

	const handleStrategyClick = (option: StrategyOption) => {
		if (isViewingCompletedStep && stepper.currentStep === 0) return;

		if (option.correct) {
			setSelectedStrategy(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback ?? 'Not the best strategy.');
		}
	};

	const handleStatusClick = (option: StatusOption) => {
		if (isViewingCompletedStep && stepper.currentStep === 1) return;

		if (option.correct) {
			setSelectedStatus(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback ?? 'Not the right status code.');
		}
	};

	const handleShapeClick = (option: ShapeOption) => {
		if (isViewingCompletedStep && stepper.currentStep === 2) return;

		if (option.correct) {
			setSelectedShape(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback ?? 'Not the right error shape.');
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level21-error-handling', {
			stars: stepper.starRating,
		});
		if (success) {
			onComplete({ stars: stepper.starRating });
		}
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
		return { valid: true, message: 'Error handling is centralized!' };
	};

	// Calculate completed steps for code preview
	const completedSteps = stepper.steps.filter(
		(s) => s.status === 'completed',
	).length;

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Context */}
					<div className="p-4 border-b border-border">
						<div className="flex items-center gap-2 mb-3">
							<AlertTriangle className="w-4 h-4 text-warning" />
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								The Problem
							</div>
						</div>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your API returns raw 500 errors with stack traces in production.
							Every controller has its own begin/rescue block with different
							error formats: some return JSON, some return plain text, some
							return HTML. Clients cannot parse errors reliably.
						</p>
					</div>

					{/* Steps */}
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

					{/* Key concepts */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li className="flex items-start gap-2">
								<Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<code className="text-primary">rescue_from</code> catches
									exceptions globally in one place
								</span>
							</li>
							<li className="flex items-start gap-2">
								<AlertTriangle className="w-3 h-3 mt-0.5 text-warning shrink-0" />
								<span>
									Map each exception class to the correct HTTP status code
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Terminal className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									A consistent error shape lets clients parse every error the same way
								</span>
							</li>
						</ul>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Error Handling"
					levelNumber={21}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Choose Strategy */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Error Handling Strategy
								</h3>
								<p className="text-sm text-muted-foreground">
									Every controller action wraps its logic in begin/rescue with
									different error formats. How should you centralize this?
								</p>

								<div className="space-y-3">
									{STRATEGY_OPTIONS.map((option) => {
										const isSelected = selectedStrategy === option.id;
										const isCorrectAndSelected =
											isSelected && option.correct;
										const isDone =
											stepper.isCurrentStepCompleted &&
											stepper.currentStep === 0;

										return (
											<OptionCard
												color={
													isCorrectAndSelected ? 'success' : 'primary'
												}
												description={option.description}
												disabled={isDone}
												icon={
													isCorrectAndSelected ? Check : Shield
												}
												key={option.id}
												name={option.name}
												onClick={() => handleStrategyClick(option)}
												selected={isCorrectAndSelected}
											/>
										);
									})}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button className="gap-2" onClick={stepper.nextStep} size="sm">
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 2: Map Exceptions to Status Codes */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Map Exceptions to Status Codes
								</h3>
								<p className="text-sm text-muted-foreground">
									A request hits{' '}
									<code className="text-primary font-mono">
										GET /api/v1/posts/999
									</code>
									. The post does not exist. What status code should{' '}
									<code className="text-primary font-mono">
										ActiveRecord::RecordNotFound
									</code>{' '}
									map to?
								</p>

								<div className="space-y-3">
									{STATUS_OPTIONS.map((option) => {
										const isSelected = selectedStatus === option.id;
										const isCorrectAndSelected =
											isSelected && option.correct;
										const isDone =
											stepper.isCurrentStepCompleted &&
											stepper.currentStep === 1;

										return (
											<OptionCard
												color={
													isCorrectAndSelected ? 'success' : 'primary'
												}
												description={option.description}
												disabled={isDone}
												icon={
													isCorrectAndSelected ? Check : AlertTriangle
												}
												key={option.id}
												name={option.name}
												onClick={() => handleStatusClick(option)}
												selected={isCorrectAndSelected}
											/>
										);
									})}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button className="gap-2" onClick={stepper.nextStep} size="sm">
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 3: Define Error Shape */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Define Error Shape
								</h3>
								<p className="text-sm text-muted-foreground">
									Your rescue_from handlers need to render a consistent JSON
									structure. Which shape lets clients parse errors
									programmatically?
								</p>

								<div className="space-y-3">
									{SHAPE_OPTIONS.map((option) => {
										const isSelected = selectedShape === option.id;
										const isCorrectAndSelected =
											isSelected && option.correct;
										const isDone =
											stepper.isCurrentStepCompleted &&
											stepper.currentStep === 2;

										return (
											<OptionCard
												color={
													isCorrectAndSelected ? 'success' : 'primary'
												}
												description={option.description}
												disabled={isDone}
												icon={isCorrectAndSelected ? Check : Terminal}
												key={option.id}
												mono
												name={option.name}
												onClick={() => handleShapeClick(option)}
												selected={isCorrectAndSelected}
											/>
										);
									})}
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button className="gap-2" onClick={stepper.nextStep} size="sm">
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 4: Test Error Response */}
						{stepper.currentStep === 3 && (
							<TerminalChoiceStep
								commands={testCommands}
								completed={stepper.isCurrentStepCompleted}
								description={
									<p className="text-sm text-muted-foreground">
										Your rescue_from handlers are in place with a structured
										error shape. Verify the response by requesting a post
										that does not exist.
									</p>
								}
								hasNext={false}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={testOutput}
								stepKey={stepper.currentStep}
								title="Test Error Response"
							/>
						)}

						{/* ADVANTAGE: Completion section with before/after */}
						{stepper.isComplete && (
							<div className="space-y-4">
								<div className="bg-success/10 border border-success/30 rounded-xl p-4">
									<div className="flex items-center gap-2 text-success font-semibold mb-2">
										<Shield className="w-4 h-4" />
										Error Handling Centralized!
									</div>
									<p className="text-sm text-muted-foreground mb-4">
										All error handling lives in ApplicationController. Individual
										controllers are clean, and every error response follows the
										same shape.
									</p>

									{/* Before / After comparison */}
									<div className="grid grid-cols-2 gap-3">
										<div className="bg-card rounded-lg border border-destructive/30 overflow-hidden">
											<div className="bg-destructive/10 px-3 py-2 border-b border-destructive/20">
												<span className="text-xs font-semibold text-destructive">
													Before
												</span>
											</div>
											<pre className="p-3 text-xs text-muted-foreground overflow-x-auto leading-relaxed">
{`GET /api/v1/posts/999

500 Internal Server Error
Content-Type: text/html

<h1>ActiveRecord::
  RecordNotFound</h1>
<pre>app/controllers/
  posts_controller.rb:4
</pre>`}
											</pre>
										</div>

										<div className="bg-card rounded-lg border border-success/30 overflow-hidden">
											<div className="bg-success/10 px-3 py-2 border-b border-success/20">
												<span className="text-xs font-semibold text-success">
													After
												</span>
											</div>
											<pre className="p-3 text-xs text-muted-foreground overflow-x-auto leading-relaxed">
{`GET /api/v1/posts/999

404 Not Found
Content-Type: application/json

{
  "error": {
    "code": "not_found",
    "message": "Post not found",
    "details": {}
  }
}`}
											</pre>
										</div>
									</div>
								</div>

								<div className="text-center">
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
				<CodePreviewPanel files={getCodeFiles(completedSteps)}>
					{/* Key concepts */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							rescue_from Lookup Order
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Most specific exceptions first (RecordNotFound, RecordInvalid)
								</span>
							</li>
							<li className="flex items-start gap-2">
								<AlertTriangle className="w-3 h-3 mt-0.5 text-warning shrink-0" />
								<span>
									StandardError as a catch-all at the end
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Terminal className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Child controllers inherit all handlers from ApplicationController
								</span>
							</li>
						</ul>
					</div>

					{/* HTTP status code reference */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Common Status Codes
						</div>
						<div className="space-y-1.5 text-xs font-mono">
							<div className="flex justify-between text-muted-foreground">
								<span>RecordNotFound</span>
								<span className="text-warning">404</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>RecordInvalid</span>
								<span className="text-warning">422</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>ParameterMissing</span>
								<span className="text-warning">400</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>StandardError</span>
								<span className="text-destructive">500</span>
							</div>
						</div>
					</div>

					{/* Error shape reference */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Consistent Error Shape
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`{
  "error": {
    "code": "not_found",
    "message": "Post not found",
    "details": {}
  }
}

# code:    machine-readable identifier
# message: human-readable description
# details: validation errors, context`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level21ErrorHandling;

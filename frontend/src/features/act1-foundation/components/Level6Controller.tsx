/**
 * Level 5: The Controller
 *
 * 4-step progression to build the controller that handles routes.
 * Steps: Generate Controller → Add Actions → Strong Params → Test Endpoint
 */

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
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalOutputLine,
	type TerminalStepData,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { ArrowRight } from 'lucide-react';

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-controller', title: 'Generate Controller' },
	{ id: 'add-actions', title: 'Add Actions' },
	{ id: 'strong-params', title: 'Strong Params' },
	{ id: 'test-endpoint', title: 'Test Endpoint' },
];

const RESTFUL_ACTIONS = ['index', 'show', 'create', 'update', 'destroy'];
const DISTRACTOR_ACTIONS = ['list', 'get', 'add', 'remove', 'new', 'edit'];

const WRONG_ACTION_FEEDBACK: Record<string, string> = {
	list: '"list" isn\'t a Rails convention. There\'s a standard RESTful name for listing records.',
	get: '"get" isn\'t a Rails action. There\'s a standard RESTful name for displaying a single record.',
	add: '"add" isn\'t a Rails action. There\'s a standard RESTful name for saving a new record.',
	remove: '"remove" isn\'t a Rails action. There\'s a standard RESTful name for deleting a record.',
	new: '"new" renders a form in full-stack Rails. API controllers don\'t need it.',
	edit: '"edit" renders a form in full-stack Rails. API controllers don\'t need it.',
};

// Strong params pieces
interface ParamsPiece {
	id: string;
	text: string;
	position: number; // correct position in assembly
}

const PARAMS_PIECES: ParamsPiece[] = [
	{ id: 'params', text: 'params', position: 0 },
	{ id: 'expect', text: '.expect(', position: 1 },
	{ id: 'require', text: '.require(', position: -1 }, // wrong
	{ id: 'permit', text: '.permit(', position: -1 }, // wrong
	{ id: 'post-key', text: 'post:', position: 2 },
	{ id: 'partial-attrs', text: '[:title, :body]', position: -1 }, // wrong - missing published
	{ id: 'full-attrs', text: '[:title, :body, :published]', position: 3 },
	{ id: 'close', text: ')', position: 4 },
];

const CORRECT_PARAMS_ORDER = [
	'params',
	'expect',
	'post-key',
	'full-attrs',
	'close',
];

export function Level6Controller({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Step 2: placed actions
	const [placedActions, setPlacedActions] = useState<string[]>([]);

	// Step 3: assembled params pieces
	const [assembledPieces, setAssembledPieces] = useState<string[]>([]);

	// Step 1: Generate controller commands
	const generateCommands = [
		{
			id: 'wrong-singular',
			label: 'rails generate controller Post',
			command: 'rails generate controller Post',
			correct: false,
			feedback:
				'Controller names are plural and must include the full route namespace, not just a singular model name.',
		},
		{
			id: 'correct',
			label: 'rails generate controller Api::V1::Posts',
			command: 'rails generate controller Api::V1::Posts',
			correct: true,
		},
		{
			id: 'wrong-no-namespace',
			label: 'rails generate controller Posts',
			command: 'rails generate controller Posts',
			correct: false,
			feedback:
				'The controller name must include namespaces to match your route structure, not just the resource name alone.',
		},
	];

	const generateOutput: TerminalOutputLine[] = [
		{
			text: '      create  app/controllers/api/v1/posts_controller.rb',
			color: 'green',
		},
		{ text: '      invoke  test_unit', color: 'muted' },
		{
			text: '      create    test/controllers/api/v1/posts_controller_test.rb',
			color: 'muted',
		},
	];

	// Step 2: Action handling
	const handleAddAction = (action: string) => {
		if (RESTFUL_ACTIONS.includes(action)) {
			if (!placedActions.includes(action)) {
				const newPlaced = [...placedActions, action];
				setPlacedActions(newPlaced);

				if (newPlaced.length === RESTFUL_ACTIONS.length) {
					stepper.completeStep();
				}
			}
		} else {
			const fb =
				WRONG_ACTION_FEEDBACK[action] ||
				`"${action}" isn't a standard RESTful action.`;
			stepper.recordWrongAttempt(fb);
		}
	};

	// Step 3: Params assembly
	const handleAddPiece = (pieceId: string) => {
		if (assembledPieces.includes(pieceId)) return;

		const newAssembled = [...assembledPieces, pieceId];
		setAssembledPieces(newAssembled);

		// Check if complete
		if (newAssembled.length === CORRECT_PARAMS_ORDER.length) {
			const isCorrect = newAssembled.every(
				(id, i) => id === CORRECT_PARAMS_ORDER[i],
			);
			if (isCorrect) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(getParamsErrorFeedback(newAssembled));
				setAssembledPieces([]);
			}
		}
	};

	const getParamsErrorFeedback = (pieces: string[]): string => {
		if (pieces.includes('require') || pieces.includes('permit')) {
			return 'Rails 8 replaced the require/permit pattern with a single, more concise method.';
		}
		if (pieces.includes('partial-attrs')) {
			return 'Include all three attributes: title, body, and published.';
		}
		return 'The pieces are in the wrong order. Think about how method chaining works in Ruby.';
	};

	// Step 4: Test endpoint
	const testCommands = [
		{
			id: 'wrong-browser',
			label: 'open http://localhost:3000/api/v1/posts',
			command: 'open http://localhost:3000/api/v1/posts',
			correct: false,
			feedback:
				'Opening in a browser works for viewing HTML, but API endpoints return JSON. Use a command-line HTTP client to see headers and status codes.',
		},
		{
			id: 'get',
			label: 'curl localhost:3000/api/v1/posts',
			command: 'curl localhost:3000/api/v1/posts',
			correct: true,
		},
		{
			id: 'wrong-rails-routes',
			label: 'rails routes',
			command: 'rails routes',
			correct: false,
			feedback:
				'That lists route definitions, but does not actually send an HTTP request to test if the endpoint responds.',
		},
	];

	const testOutput: TerminalOutputLine[] = [
		{ text: 'HTTP/1.1 200 OK', color: 'green' },
		{ text: 'Content-Type: application/json', color: 'muted' },
		{ text: '', color: 'muted' },
		{ text: '[]', color: 'cyan' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level6-controller', {
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
		return { valid: true, message: 'Controller is ready!' };
	};

	// Terminal step data for building history (steps 1-2 are non-terminal)
	const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
		{ commands: generateCommands, outputLines: generateOutput },
		null, // step 1: Add Actions (click-to-select)
		null, // step 2: Strong Params (assembly)
		{ commands: testCommands, outputLines: testOutput },
	];

	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep >= 1) {
			const actionCode =
				placedActions.length > 0
					? placedActions
							.map((a) => {
								const body = getActionBody(a);
								return `  def ${a}\n    ${body}\n  end`;
							})
							.join('\n\n')
					: '  # Add actions here...';

			const paramsMethod =
				stepper.currentStep >= 3
					? `\n\n  private\n\n  def post_params\n    params.expect(post: [:title, :body, :published])\n  end`
					: '';

			files.push({
				filename: 'app/controllers/api/v1/posts_controller.rb',
				language: 'ruby',
				code: `class Api::V1::PostsController < ApplicationController
${actionCode}${paramsMethod}
end`,
				highlight:
					stepper.currentStep >= 3
						? [placedActions.length * 3 + 4]
						: placedActions.map((_, i) => i * 3 + 2),
			});
		}

		if (stepper.isComplete) {
			files.push({
				filename: 'Test Results',
				language: 'ruby',
				code: `# GET /api/v1/posts
# => 200 OK, []
#
# POST /api/v1/posts
# => 201 Created
# {"id":1,"title":"Hello","body":"World"}`,
				highlight: [2, 5, 6],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'app/controllers/api/v1/posts_controller.rb',
				language: 'ruby',
				code: `# Generate the controller first`,
				highlight: [],
			});
		}

		return files;
	};

	const allActions = [...RESTFUL_ACTIONS, ...DISTRACTOR_ACTIONS].sort();

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							In Level 5, you mapped 5 RESTful routes under /api/v1/posts.
							But hitting those URLs returns "uninitialized constant" because
							no controller exists yet. Build one.
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
					actNumber={1}
					levelName="The Controller"
					levelNumber={6}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Generate Controller */}
						{stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={generateCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										Your routes live under{' '}
										<span className="font-mono text-primary">
											namespace :api / :v1
										</span>{' '}
										from Level 5. Generate a controller that matches.
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
								outputLines={generateOutput}
								stepKey={stepper.currentStep}
								title="Generate Controller"
							/>
						)}

						{/* Step 2: Add Actions */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Actions
								</h3>
								<p className="text-sm text-muted-foreground">
									Click the 5 standard RESTful actions. Watch out for
									distractors!
								</p>

								{/* Action buttons */}
								<div>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										Actions ({placedActions.length} / {RESTFUL_ACTIONS.length})
									</div>
									<div className="flex flex-wrap gap-1.5">
										{allActions.map((action) => {
											const isPlaced = placedActions.includes(action);
											return (
												<Button
													className={`font-mono text-xs ${
														isPlaced ? 'opacity-50 cursor-not-allowed' : ''
													}`}
													disabled={isPlaced || isViewingCompletedStep}
													key={action}
													onClick={() => handleAddAction(action)}
													size="sm"
													variant={isPlaced ? 'secondary' : 'outline'}
												>
													{action}
												</Button>
											);
										})}
									</div>
								</div>

								{/* Controller skeleton */}
								<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
									<div className="text-zinc-400">
										class Api::V1::PostsController {'<'} ApplicationController
									</div>
									{placedActions.map((action) => (
										<div className="ml-4 text-emerald-400" key={action}>
											def {action}
											<div className="ml-4 text-zinc-500">
												{getActionBody(action)}
											</div>
											end
										</div>
									))}
									{placedActions.length < RESTFUL_ACTIONS.length && (
										<div className="ml-4 text-zinc-600 animate-pulse">
											# click actions above...
										</div>
									)}
									<div className="text-zinc-400">end</div>
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

						{/* Step 3: Strong Params */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Strong Params
								</h3>
								<p className="text-sm text-muted-foreground">
									Your{' '}
									<span className="font-mono text-primary">create</span> and{' '}
									<span className="font-mono text-primary">update</span>{' '}
									actions call{' '}
									<span className="font-mono text-primary">post_params</span>,
									but the method doesn't exist yet. Build it using Rails 8
									strong params. Click pieces in the correct order.
								</p>

								{/* Assembly area */}
								<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm min-h-[60px] flex items-center gap-1 flex-wrap">
									{assembledPieces.length > 0 ? (
										assembledPieces.map((pieceId) => {
											const piece = PARAMS_PIECES.find(
												(p) => p.id === pieceId,
											)!;
											return (
												<span className="text-emerald-400" key={pieceId}>
													{piece.text}
												</span>
											);
										})
									) : (
										<span className="text-zinc-600">
											Click pieces to assemble...
										</span>
									)}
								</div>

								{/* Available pieces */}
								{!isViewingCompletedStep && (
									<div className="flex flex-wrap gap-2">
										{PARAMS_PIECES.filter(
											(p) => !assembledPieces.includes(p.id),
										).map((piece) => (
											<Button
												className="font-mono text-xs"
												key={piece.id}
												onClick={() => handleAddPiece(piece.id)}
												size="sm"
												variant="outline"
											>
												{piece.text}
											</Button>
										))}
									</div>
								)}

								{assembledPieces.length > 0 && !isViewingCompletedStep && (
									<Button
										className="text-xs"
										onClick={() => setAssembledPieces([])}
										size="sm"
										variant="ghost"
									>
										Reset
									</Button>
								)}

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

						{/* Step 4: Test Endpoint */}
						{stepper.currentStep === 3 && (
							<TerminalChoiceStep
								commands={testCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										You booted Puma in Level 2, but had no routes or controller
										back then. Now both exist. Hit the endpoint with curl.
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
								outputLines={testOutput}
								stepKey={stepper.currentStep}
								title="Test Endpoint"
							/>
						)}

						{/* Complete */}
						{stepper.isComplete && (
							<div className="text-center py-12 space-y-4">
								<div className="text-4xl">
									{'★'.repeat(stepper.starRating)}
									{'☆'.repeat(3 - stepper.starRating)}
								</div>
								<h3 className="text-xl font-bold text-foreground">
									Controller Built!
								</h3>
								<p className="text-muted-foreground">
									Your PostsController handles all 5 RESTful actions with Rails
									8 strong params.
								</p>
								<Button onClick={handleComplete}>Complete Level</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							RESTful Actions
						</div>
						<div className="text-xs text-muted-foreground space-y-1">
							<div>
								<span className="text-emerald-400 font-mono">index</span>: List
								all records
							</div>
							<div>
								<span className="text-emerald-400 font-mono">show</span>:
								Display one record
							</div>
							<div>
								<span className="text-blue-400 font-mono">create</span>: Save a
								new record
							</div>
							<div>
								<span className="text-amber-400 font-mono">update</span>: Modify
								existing
							</div>
							<div>
								<span className="text-red-400 font-mono">destroy</span>: Delete
								a record
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

function getActionBody(action: string): string {
	switch (action) {
		case 'index':
			return 'render json: Post.all';
		case 'show':
			return 'render json: Post.find(params[:id])';
		case 'create':
			return 'post = Post.create!(post_params)\n      render json: post, status: :created';
		case 'update':
			return 'post = Post.find(params[:id])\n      post.update!(post_params)\n      render json: post';
		case 'destroy':
			return 'Post.find(params[:id]).destroy\n      head :no_content';
		default:
			return '# ...';
	}
}

export default Level6Controller;

/**
 * Level 5: The Controller
 *
 * 4-step progression to build the controller that handles routes.
 * Steps: Generate Controller → Add Actions → Strong Params → Test Endpoint
 */

import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	SimulatedTerminal,
	StepProgress,
	useLevelCompletion,
	type TerminalOutputLine,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-controller', title: 'Generate Controller' },
	{ id: 'add-actions', title: 'Add Actions' },
	{ id: 'strong-params', title: 'Strong Params' },
	{ id: 'test-endpoint', title: 'Test Endpoint' },
];

const RESTFUL_ACTIONS = ['index', 'show', 'create', 'update', 'destroy'];
const DISTRACTOR_ACTIONS = ['list', 'get', 'add', 'remove', 'new', 'edit'];

const WRONG_ACTION_FEEDBACK: Record<string, string> = {
	list: '"list" isn\'t a Rails convention — use "index" for listing records.',
	get: '"get" isn\'t a Rails action — use "show" to display a single record.',
	add: '"add" isn\'t a Rails action — use "create" to save a new record.',
	remove: '"remove" isn\'t a Rails action — use "destroy" to delete a record.',
	new: '"new" renders a form in full-stack Rails — API controllers don\'t need it.',
	edit: '"edit" renders a form in full-stack Rails — API controllers don\'t need it.',
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

const CORRECT_PARAMS_ORDER = ['params', 'expect', 'post-key', 'full-attrs', 'close'];

export function Level5Controller({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);

	// Step 2: placed actions
	const [placedActions, setPlacedActions] = useState<string[]>([]);

	// Step 3: assembled params pieces
	const [assembledPieces, setAssembledPieces] = useState<string[]>([]);

	// Step 1: Generate controller commands
	const generateCommands = [
		{
			id: 'correct',
			label: 'rails generate controller Api::V1::Posts',
			command: 'rails generate controller Api::V1::Posts',
			correct: true,
		},
		{
			id: 'wrong-singular',
			label: 'rails generate controller Post',
			command: 'rails generate controller Post',
			correct: false,
			feedback:
				'Controller names are plural and match the route namespace — use "Api::V1::Posts".',
		},
		{
			id: 'wrong-no-namespace',
			label: 'rails generate controller Posts',
			command: 'rails generate controller Posts',
			correct: false,
			feedback:
				'Include the namespace to match your routes — "Api::V1::Posts", not just "Posts".',
		},
	];

	const generateOutput: TerminalOutputLine[] = [
		{ text: '      create  app/controllers/api/v1/posts_controller.rb', color: 'green' },
		{ text: '      invoke  test_unit', color: 'muted' },
		{ text: '      create    test/controllers/api/v1/posts_controller_test.rb', color: 'muted' },
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
				stepper.recordWrongAttempt(
					getParamsErrorFeedback(newAssembled),
				);
				setAssembledPieces([]);
			}
		}
	};

	const getParamsErrorFeedback = (pieces: string[]): string => {
		if (pieces.includes('require') || pieces.includes('permit')) {
			return '`.expect` is the Rails 8 way — it combines require + permit in one call.';
		}
		if (pieces.includes('partial-attrs')) {
			return 'Include all three attributes: title, body, and published.';
		}
		return 'Check the order: params.expect(post: [:title, :body, :published])';
	};

	// Step 4: Test endpoint
	const testCommands = [
		{
			id: 'get',
			label: 'curl localhost:3000/api/v1/posts',
			command: 'curl localhost:3000/api/v1/posts',
			correct: true,
		},
	];

	const testOutput: TerminalOutputLine[] = [
		{ text: 'HTTP/1.1 200 OK', color: 'green' },
		{ text: 'Content-Type: application/json', color: 'muted' },
		{ text: '', color: 'muted' },
		{ text: '[]', color: 'cyan' },
		{ text: '', color: 'muted' },
		{ text: '$ curl -X POST localhost:3000/api/v1/posts \\', color: 'yellow' },
		{ text: '  -H "Content-Type: application/json" \\', color: 'yellow' },
		{ text: '  -d \'{"post":{"title":"Hello","body":"World"}}\'', color: 'yellow' },
		{ text: '', color: 'muted' },
		{ text: 'HTTP/1.1 201 Created', color: 'green' },
		{ text: '{"id":1,"title":"Hello","body":"World","published":null}', color: 'cyan' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level5-controller', {
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

		if (stepper.currentStep >= 4) {
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
							Routes are defined but nothing handles the requests yet. Build the
							controller with actions that match those routes.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Action cards for step 2 */}
					{stepper.currentStep === 1 && (
						<div className="p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Actions ({placedActions.length} / {RESTFUL_ACTIONS.length})
							</div>
							<div className="flex flex-wrap gap-1.5">
								{allActions.map((action) => {
									const isPlaced = placedActions.includes(action);
									return (
										<Button
											className={`font-mono text-xs ${
												isPlaced
													? 'opacity-50 cursor-not-allowed'
													: ''
											}`}
											disabled={isPlaced}
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
							<p className="text-xs text-muted-foreground mt-2">
								Pick the 5 RESTful actions
							</p>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The Controller"
					levelNumber={5}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Generate Controller */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Generate Controller
								</h3>
								<p className="text-sm text-muted-foreground">
									Generate a controller that matches your route namespace.
								</p>
								<SimulatedTerminal
									commands={generateCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={generateOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 2: Add Actions */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Actions
								</h3>
								<p className="text-sm text-muted-foreground">
									Click the 5 standard RESTful actions from the left panel.
									Watch out for distractors!
								</p>

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
											# click actions from the left panel...
										</div>
									)}
									<div className="text-zinc-400">end</div>
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: Strong Params */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Strong Params
								</h3>
								<p className="text-sm text-muted-foreground">
									Build the{' '}
									<span className="font-mono text-primary">post_params</span>{' '}
									method. Click pieces in order to assemble{' '}
									<span className="font-mono text-primary">
										params.expect(post: [:title, :body, :published])
									</span>
									.
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

								{assembledPieces.length > 0 && (
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
							</div>
						)}

						{/* Step 4: Test Endpoint */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Test Endpoint
								</h3>
								<p className="text-sm text-muted-foreground">
									Test your controller by making a request.
								</p>
								<SimulatedTerminal
									commands={testCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={testOutput}
								/>
							</div>
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
									Your PostsController handles all 5 RESTful actions with
									Rails 8 strong params.
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
								<span className="text-emerald-400 font-mono">index</span> — List
								all records
							</div>
							<div>
								<span className="text-emerald-400 font-mono">show</span> —
								Display one record
							</div>
							<div>
								<span className="text-blue-400 font-mono">create</span> — Save a
								new record
							</div>
							<div>
								<span className="text-amber-400 font-mono">update</span> —
								Modify existing
							</div>
							<div>
								<span className="text-red-400 font-mono">destroy</span> — Delete
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

export default Level5Controller;

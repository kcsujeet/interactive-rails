/**
 * Level 4: Routes & Request Lifecycle
 *
 * 4-step progression to define how the API responds to URLs.
 * Steps: Define Resource → Add Namespace → View Routes → Trace a Request
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
	{ id: 'define-resource', title: 'Define Resource' },
	{ id: 'add-namespace', title: 'Add Namespace' },
	{ id: 'view-routes', title: 'View Routes' },
	{ id: 'trace-request', title: 'Trace a Request' },
];

// Route definitions for step 1
const RESOURCE_OPTIONS = [
	{
		id: 'resources',
		label: 'resources :posts',
		correct: true,
	},
	{
		id: 'get-only',
		label: "get '/posts' => 'posts#index'",
		correct: false,
		feedback:
			"That's only one route — `resources :posts` generates all 5 RESTful endpoints at once.",
	},
	{
		id: 'match',
		label: "match '/posts', to: 'posts#index'",
		correct: false,
		feedback:
			"`match` is for custom routes — `resources :posts` gives you all RESTful routes with one line.",
	},
];

// Namespace blocks for step 2
interface NamespaceBlock {
	id: string;
	label: string;
	indent: number;
}

const ROUTE_TABLE = [
	{ method: 'GET', path: '/api/v1/posts', action: 'api/v1/posts#index', description: 'List all posts' },
	{ method: 'POST', path: '/api/v1/posts', action: 'api/v1/posts#create', description: 'Create a post' },
	{ method: 'GET', path: '/api/v1/posts/:id', action: 'api/v1/posts#show', description: 'Show one post' },
	{ method: 'PATCH', path: '/api/v1/posts/:id', action: 'api/v1/posts#update', description: 'Update a post' },
	{ method: 'DELETE', path: '/api/v1/posts/:id', action: 'api/v1/posts#destroy', description: 'Delete a post' },
];

const METHOD_COLORS: Record<string, string> = {
	GET: 'text-emerald-400',
	POST: 'text-blue-400',
	PATCH: 'text-amber-400',
	DELETE: 'text-red-400',
};

export function Level4Routes({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);

	// Step 2: namespace ordering
	const [namespaceOrder, setNamespaceOrder] = useState<string[]>([]);
	const correctNamespaceOrder = ['api', 'v1', 'resources'];

	// Step 4: traced routes
	const [tracedRoutes, setTracedRoutes] = useState<Set<number>>(new Set());

	const handleNamespaceAdd = (id: string) => {
		if (namespaceOrder.includes(id)) return;
		const newOrder = [...namespaceOrder, id];
		setNamespaceOrder(newOrder);

		// Check if all 3 are placed
		if (newOrder.length === 3) {
			if (
				newOrder[0] === 'api' &&
				newOrder[1] === 'v1' &&
				newOrder[2] === 'resources'
			) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(
					'Nest in this order: namespace :api → namespace :v1 → resources :posts. The outer namespace comes first.',
				);
				setNamespaceOrder([]);
			}
		}
	};

	// Step 3: View routes terminal
	const viewRoutesCommands = [
		{
			id: 'correct',
			label: 'rails routes',
			command: 'rails routes',
			correct: true,
		},
		{
			id: 'wrong',
			label: 'rake routes',
			command: 'rake routes',
			correct: false,
			feedback: 'The modern command is "rails routes" — "rake routes" is the old way.',
		},
	];

	const viewRoutesOutput: TerminalOutputLine[] = [
		{ text: '      Prefix  Verb    URI Pattern                    Controller#Action', color: 'muted' },
		{ text: '  api_v1_posts  GET     /api/v1/posts(.:format)        api/v1/posts#index', color: 'green' },
		{ text: '               POST    /api/v1/posts(.:format)        api/v1/posts#create', color: 'cyan' },
		{ text: '   api_v1_post  GET     /api/v1/posts/:id(.:format)    api/v1/posts#show', color: 'green' },
		{ text: '               PATCH   /api/v1/posts/:id(.:format)    api/v1/posts#update', color: 'yellow' },
		{ text: '               DELETE  /api/v1/posts/:id(.:format)    api/v1/posts#destroy', color: 'red' },
	];

	// Step 4: Route tracing
	const handleTraceRoute = (index: number) => {
		const newTraced = new Set(tracedRoutes);
		newTraced.add(index);
		setTracedRoutes(newTraced);

		if (newTraced.size === ROUTE_TABLE.length) {
			stepper.completeStep();
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act1-level4-routes', {
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
		return { valid: true, message: 'Routes are configured!' };
	};

	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep === 0) {
			files.push({
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `Rails.application.routes.draw do
  # No routes defined yet...
end`,
				highlight: [],
			});
		}

		if (stepper.currentStep === 1) {
			files.push({
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `Rails.application.routes.draw do
  resources :posts
  # But this creates /posts, not /api/v1/posts
  # We need namespaces!
end`,
				highlight: [2],
			});
		}

		if (stepper.currentStep >= 2) {
			files.push({
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :posts
    end
  end
end`,
				highlight: [2, 3, 4],
			});
		}

		if (stepper.currentStep >= 3) {
			files.push({
				filename: 'Route Table',
				language: 'ruby',
				code: `# rails routes
#
# GET    /api/v1/posts          => api/v1/posts#index
# POST   /api/v1/posts          => api/v1/posts#create
# GET    /api/v1/posts/:id      => api/v1/posts#show
# PATCH  /api/v1/posts/:id      => api/v1/posts#update
# DELETE /api/v1/posts/:id      => api/v1/posts#destroy`,
				highlight: [3, 4, 5, 6, 7],
			});
		}

		return files;
	};

	const availableNamespaceBlocks: NamespaceBlock[] = [
		{ id: 'v1', label: 'namespace :v1 do', indent: 1 },
		{ id: 'api', label: 'namespace :api do', indent: 0 },
		{ id: 'resources', label: 'resources :posts', indent: 2 },
	];

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Post model and CRUD operations work in the console. But how
							do HTTP requests from the outside world reach your app? You need
							routes.
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
					levelName="Routes & Request Lifecycle"
					levelNumber={5}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Define Resource */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Define Resource
								</h3>
								<p className="text-sm text-muted-foreground">
									Which line in{' '}
									<span className="font-mono text-primary">
										config/routes.rb
									</span>{' '}
									generates all 5 RESTful routes for posts?
								</p>
								<div className="space-y-3">
									{RESOURCE_OPTIONS.map((opt) => (
										<Button
											className="w-full h-auto py-4 text-left font-mono text-sm"
											key={opt.id}
											onClick={() => {
												if (opt.correct) {
													stepper.completeStep();
												} else {
													stepper.recordWrongAttempt(opt.feedback!);
												}
											}}
											variant="outline"
										>
											{opt.label}
										</Button>
									))}
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 2: Add Namespace */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Add Namespace
								</h3>
								<p className="text-sm text-muted-foreground">
									Wrap the resource in API version namespaces. Click blocks in
									the correct nesting order (outermost first).
								</p>

								{/* Available blocks */}
								<div className="flex flex-wrap gap-2">
									{availableNamespaceBlocks
										.filter((b) => !namespaceOrder.includes(b.id))
										.map((block) => (
											<Button
												className="font-mono text-sm"
												key={block.id}
												onClick={() => handleNamespaceAdd(block.id)}
												variant="outline"
											>
												{block.label}
											</Button>
										))}
								</div>

								{/* Preview of current nesting */}
								<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
									<div className="text-zinc-400">
										Rails.application.routes.draw do
									</div>
									{namespaceOrder.map((id, i) => {
										const block = availableNamespaceBlocks.find(
											(b) => b.id === id,
										)!;
										return (
											<div
												className="text-emerald-400"
												key={id}
											>
												{'  '.repeat(i + 1)}
												{block.label}
											</div>
										);
									})}
									{namespaceOrder.length > 0 &&
										[...namespaceOrder]
											.reverse()
											.filter((id) => id !== 'resources')
											.map((id, i) => (
												<div
													className="text-zinc-400"
													key={`end-${id}`}
												>
													{'  '.repeat(
														namespaceOrder.length - i - 1,
													)}
													end
												</div>
											))}
									<div className="text-zinc-400">end</div>
								</div>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: View Routes */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									View Routes
								</h3>
								<p className="text-sm text-muted-foreground">
									Run the command to see all generated routes.
								</p>
								<SimulatedTerminal
									commands={viewRoutesCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={viewRoutesOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 4: Trace a Request */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Trace a Request
								</h3>
								<p className="text-sm text-muted-foreground">
									Click each route to see how it maps to a controller action.
									Trace all 5 routes.
								</p>

								<div className="bg-card rounded-lg border border-border overflow-hidden">
									<div className="grid grid-cols-[100px_1fr_1fr] bg-secondary border-b border-border text-xs font-semibold text-muted-foreground px-4 py-2">
										<span>Method</span>
										<span>Path</span>
										<span>Controller#Action</span>
									</div>
									{ROUTE_TABLE.map((route, i) => {
										const isTraced = tracedRoutes.has(i);
										return (
											<button
												className={`grid grid-cols-[100px_1fr_1fr] w-full px-4 py-3 text-sm text-left border-b border-border transition-all ${
													isTraced
														? 'bg-primary/5'
														: 'hover:bg-secondary cursor-pointer'
												}`}
												disabled={isTraced}
												key={route.path + route.method}
												onClick={() => handleTraceRoute(i)}
												type="button"
											>
												<span
													className={`font-mono font-bold ${METHOD_COLORS[route.method]}`}
												>
													{route.method}
												</span>
												<span className="font-mono text-foreground">
													{route.path}
												</span>
												<span
													className={`font-mono ${isTraced ? 'text-primary' : 'text-muted-foreground'}`}
												>
													{isTraced ? route.action : '???'}
												</span>
											</button>
										);
									})}
								</div>

								{/* Animated path visualization when clicking */}
								{tracedRoutes.size > 0 && tracedRoutes.size < ROUTE_TABLE.length && (
									<p className="text-xs text-muted-foreground text-center">
										{tracedRoutes.size} / {ROUTE_TABLE.length} routes traced
									</p>
								)}
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
									Routes Configured!
								</h3>
								<p className="text-muted-foreground">
									5 RESTful routes are mapped under /api/v1/posts.
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
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>
								<span className="font-mono text-primary">resources :posts</span>{' '}
								generates all 5 RESTful routes
							</li>
							<li>
								<span className="font-mono text-primary">namespace :api</span>{' '}
								nests routes under /api/
							</li>
							<li>
								Routes map HTTP verbs + URLs to controller actions
							</li>
							<li>
								Check routes with{' '}
								<span className="font-mono text-primary">rails routes</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level4Routes;

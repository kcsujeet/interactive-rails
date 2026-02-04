/**
 * Level 4: Your First Controller
 *
 * Learn that Controllers handle HTTP requests.
 * Player routes a request to the correct action.
 */

import { useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '../shared';

interface Route {
	id: string;
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	action: string | null;
	description: string;
	correctAction: string;
}

interface ControllerAction {
	id: string;
	name: string;
	description: string;
	code: string;
}

const ROUTES: Route[] = [
	{
		id: 'index',
		method: 'GET',
		path: '/posts',
		action: null,
		description: 'List all posts',
		correctAction: 'index',
	},
	{
		id: 'show',
		method: 'GET',
		path: '/posts/:id',
		action: null,
		description: 'Show one post',
		correctAction: 'show',
	},
	{
		id: 'create',
		method: 'POST',
		path: '/posts',
		action: null,
		description: 'Create a post',
		correctAction: 'create',
	},
	{
		id: 'update',
		method: 'PATCH',
		path: '/posts/:id',
		action: null,
		description: 'Update a post',
		correctAction: 'update',
	},
	{
		id: 'destroy',
		method: 'DELETE',
		path: '/posts/:id',
		action: null,
		description: 'Delete a post',
		correctAction: 'destroy',
	},
];

const ACTIONS: ControllerAction[] = [
	{
		id: 'index',
		name: 'index',
		description: 'List all records',
		code: '@posts = Post.all',
	},
	{
		id: 'show',
		name: 'show',
		description: 'Display one record',
		code: '@post = Post.find(params[:id])',
	},
	{
		id: 'create',
		name: 'create',
		description: 'Save a new record',
		code: '@post = Post.create(post_params)',
	},
	{
		id: 'update',
		name: 'update',
		description: 'Modify existing record',
		code: '@post.update(post_params)',
	},
	{
		id: 'destroy',
		name: 'destroy',
		description: 'Remove a record',
		code: '@post.destroy',
	},
];

const METHOD_COLORS: Record<string, string> = {
	GET: '#22c55e',
	POST: '#3b82f6',
	PATCH: '#f59e0b',
	DELETE: '#ef4444',
};

export function Level4Controller({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [routes, setRoutes] = useState<Route[]>(ROUTES);
	const [selectedAction, setSelectedAction] = useState<string | null>(null);
	const [dragOverRoute, setDragOverRoute] = useState<string | null>(null);

	const correctCount = routes.filter(
		(r) => r.action === r.correctAction,
	).length;

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const unmatchedRoutes = routes.filter((r) => !r.action);
		if (unmatchedRoutes.length > 0) {
			errors.push(`${unmatchedRoutes.length} route(s) need actions assigned`);
		}

		const incorrectRoutes = routes.filter(
			(r) => r.action && r.action !== r.correctAction,
		);
		if (incorrectRoutes.length > 0) {
			errors.push(`${incorrectRoutes.length} route(s) have wrong actions`);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Routes need adjustment!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'All routes correctly mapped to controller actions!',
		};
	};

	const handleDragStart = (e: React.DragEvent, actionId: string) => {
		e.dataTransfer.setData('actionId', actionId);
		setSelectedAction(actionId);
	};

	const handleDragEnd = () => {
		setSelectedAction(null);
		setDragOverRoute(null);
	};

	const handleDrop = (routeId: string) => {
		if (selectedAction) {
			setRoutes((prev) =>
				prev.map((r) =>
					r.id === routeId ? { ...r, action: selectedAction } : r,
				),
			);
		}
		setSelectedAction(null);
		setDragOverRoute(null);
	};

	const clearRoute = (routeId: string) => {
		setRoutes((prev) =>
			prev.map((r) => (r.id === routeId ? { ...r, action: null } : r)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act1-level4-your-first-controller', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Generate routes.rb code
	const generateRoutesCode = () => {
		return `Rails.application.routes.draw do
  resources :posts
  # This creates all RESTful routes:
  # GET    /posts          => posts#index
  # GET    /posts/:id      => posts#show
  # POST   /posts          => posts#create
  # PATCH  /posts/:id      => posts#update
  # DELETE /posts/:id      => posts#destroy
end`;
	};

	// Generate controller code based on assigned actions
	const generateControllerCode = () => {
		const assignedActions = routes
			.filter((r) => r.action)
			.map((r) => {
				const action = ACTIONS.find((a) => a.id === r.action);
				return action ? `  def ${action.name}\n    ${action.code}\n  end` : '';
			})
			.join('\n\n');

		return `class PostsController < ApplicationController
${assignedActions || '  # Assign actions to routes'}
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Understand that Controllers are the traffic cops of Rails - they receive requests and decide what to do."
					instructions={[
						'Controllers handle HTTP requests',
						'Each route maps to a controller action',
						'Drag actions to match with routes',
						'RESTful conventions: index, show, create, update, destroy',
					]}
					scenario="HTTP requests are coming in, but they're getting lost. You need to route each request to the right controller action."
				>
					{/* Action Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Controller Actions
						</div>
						<div className="space-y-2">
							{ACTIONS.map((action) => {
								const isUsed = routes.some((r) => r.action === action.id);
								return (
									<div
										className={`p-3 rounded-lg border transition-all ${
											isUsed
												? 'bg-secondary/50 border-border opacity-50 cursor-not-allowed'
												: 'bg-primary/10 border-primary cursor-grab hover:border-primary/70 active:cursor-grabbing'
										}`}
										draggable={!isUsed}
										key={action.id}
										onDragEnd={handleDragEnd}
										onDragStart={(e) => handleDragStart(e, action.id)}
									>
										<div className="flex items-center justify-between">
											<span className="font-mono text-sm text-primary">
												{action.name}
											</span>
											{isUsed && (
												<svg
													className="w-4 h-4 text-success"
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path
														clipRule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														fillRule="evenodd"
													/>
												</svg>
											)}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											{action.description}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correctly matched</span>
							<span
								className={
									correctCount === routes.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{correctCount} / {routes.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{ width: `${(correctCount / routes.length) * 100}%` }}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Your First Controller"
					levelNumber={4}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setRoutes(ROUTES)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Header with file paths */}
						<div className="grid grid-cols-2 gap-4 mb-2">
							<div className="text-center">
								<span className="inline-flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/50 rounded-lg text-xs">
									<span className="text-warning font-mono">
										config/routes.rb
									</span>
								</span>
							</div>
							<div className="text-center">
								<span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/50 rounded-lg text-xs">
									<span className="text-primary font-mono">
										app/controllers/posts_controller.rb
									</span>
								</span>
							</div>
						</div>

						{/* Two-column route → controller mapping */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							{/* Column Headers */}
							<div className="grid grid-cols-2 bg-secondary border-b border-border">
								<div className="px-4 py-3 border-r border-border">
									<span className="text-foreground font-semibold">
										HTTP Routes
									</span>
								</div>
								<div className="px-4 py-3 flex items-center gap-2">
									<span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-foreground font-bold text-xs">
										C
									</span>
									<span className="text-foreground font-semibold">
										PostsController
									</span>
								</div>
							</div>

							{/* Route → Action rows */}
							<div className="divide-y divide-border">
								{routes.map((route) => {
									const isCorrect = route.action === route.correctAction;
									const assignedAction = ACTIONS.find(
										(a) => a.id === route.action,
									);

									return (
										<div className="grid grid-cols-2" key={route.id}>
											{/* Left: Route */}
											<div
												className={`p-4 flex items-center gap-3 border-r border-border transition-colors ${
													dragOverRoute === route.id ? 'bg-primary/10' : ''
												}`}
												onDragLeave={() => setDragOverRoute(null)}
												onDragOver={(e) => {
													e.preventDefault();
													setDragOverRoute(route.id);
												}}
												onDrop={() => handleDrop(route.id)}
											>
												{/* HTTP Method */}
												<span
													className="px-2 py-1 rounded text-xs font-bold w-14 text-center shrink-0"
													style={{
														backgroundColor: `${METHOD_COLORS[route.method]}20`,
														color: METHOD_COLORS[route.method],
													}}
												>
													{route.method}
												</span>

												{/* Path */}
												<span className="font-mono text-sm text-muted-foreground">
													{route.path}
												</span>

												{/* Arrow */}
												<svg
													className="w-5 h-5 text-muted-foreground shrink-0 ml-auto"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														d="M14 5l7 7m0 0l-7 7m7-7H3"
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
													/>
												</svg>

												{/* Action slot (drop zone) */}
												{route.action ? (
													<div
														className={`flex items-center gap-2 px-2 py-1 rounded border shrink-0 ${
															isCorrect
																? 'bg-success/10 border-success'
																: 'bg-destructive/10 border-destructive'
														}`}
													>
														<span
															className={`font-mono text-xs ${isCorrect ? 'text-success' : 'text-destructive'}`}
														>
															#{assignedAction?.name}
														</span>
														<Button
															className="w-4 h-4 p-0"
															onClick={() => clearRoute(route.id)}
															size="icon"
															variant="ghost"
														>
															<svg
																className="w-3 h-3"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	d="M6 18L18 6M6 6l12 12"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																/>
															</svg>
														</Button>
													</div>
												) : (
													<div
														className={`px-3 py-1 rounded border-2 border-dashed text-xs shrink-0 ${
															dragOverRoute === route.id
																? 'border-primary text-primary'
																: 'border-border text-muted-foreground'
														}`}
													>
														drop
													</div>
												)}
											</div>

											{/* Right: Controller Action */}
											<div
												className={`p-4 transition-all ${
													route.action
														? isCorrect
															? 'bg-success/5'
															: 'bg-destructive/5'
														: 'bg-card/50'
												}`}
											>
												{route.action && assignedAction ? (
													<div className="space-y-1">
														<div className="flex items-center gap-2">
															<span
																className={`font-mono text-sm font-semibold ${isCorrect ? 'text-success' : 'text-destructive'}`}
															>
																def {assignedAction.name}
															</span>
															{isCorrect && (
																<svg
																	className="w-4 h-4 text-success"
																	fill="currentColor"
																	viewBox="0 0 20 20"
																>
																	<path
																		clipRule="evenodd"
																		d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																		fillRule="evenodd"
																	/>
																</svg>
															)}
														</div>
														<code className="text-xs text-muted-foreground font-mono pl-4 block">
															{assignedAction.code}
														</code>
														<span className="text-xs text-muted-foreground font-mono pl-4 block">
															end
														</span>
													</div>
												) : (
													<div className="text-muted-foreground text-sm italic">
														No action mapped
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Hint */}
						<div className="mt-4 text-center text-muted-foreground text-sm">
							Drag actions from the left panel to map each route to its
							controller action
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/routes.rb',
							language: 'ruby',
							code: generateRoutesCode(),
							highlight: [2],
						},
						{
							filename: 'app/controllers/posts_controller.rb',
							language: 'ruby',
							code: generateControllerCode(),
							highlight: routes
								.filter((r) => r.action === r.correctAction)
								.map((_, i) => (i + 1) * 3 + 1),
						},
					]}
					learningGoal="Controllers are the C in MVC. They receive HTTP requests, interact with models, and prepare data for views."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							RESTful Actions
						</div>
						<div className="text-xs text-muted-foreground space-y-1">
							<div>
								<span className="text-success">index</span> - List all
							</div>
							<div>
								<span className="text-success">show</span> - Display one
							</div>
							<div>
								<span className="text-primary">create</span> - Make new
							</div>
							<div>
								<span className="text-warning">update</span> - Modify
							</div>
							<div>
								<span className="text-destructive">destroy</span> - Delete
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level4Controller;

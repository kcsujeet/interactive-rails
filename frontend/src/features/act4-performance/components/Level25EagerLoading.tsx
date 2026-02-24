/**
 * Level 23: Eager Loading
 *
 * Fix N+1 with includes, preload, and eager_load.
 * Player applies eager loading strategies to reduce queries.
 */

import { useState } from 'react';
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
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface LoadingStrategy {
	id: string;
	name: string;
	code: string;
	description: string;
	queries: number | string;
	selected: boolean;
	correct: boolean;
	sqlPlan: string;
}

interface Scenario {
	id: string;
	title: string;
	description: string;
	code: string;
	currentQueries: number;
	strategies: LoadingStrategy[];
	solved: boolean;
}

const INITIAL_SCENARIOS: Scenario[] = [
	{
		id: 'basic',
		title: 'Posts with Authors',
		description: 'Load posts and display author names',
		code: '@posts = Post.all\n# View: post.author.name',
		currentQueries: 101,
		solved: false,
		strategies: [
			{
				id: 'none',
				name: 'No Change',
				code: 'Post.all',
				description: 'Keep N+1 problem',
				queries: 101,
				selected: true,
				correct: false,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM users WHERE id = 1;  -- per post\nSELECT * FROM users WHERE id = 2;  -- per post\n-- ...100 more user queries',
			},
			{
				id: 'includes',
				name: 'includes',
				code: 'Post.includes(:author)',
				description: 'Loads authors in separate query',
				queries: 2,
				selected: false,
				correct: true,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM users WHERE id IN (1, 2, 3, ...);  -- ONE query for all authors',
			},
			{
				id: 'joins',
				name: 'joins',
				code: 'Post.joins(:author)',
				description: 'Only filters, does not load',
				queries: 101,
				selected: false,
				correct: false,
				sqlPlan: 'SELECT posts.* FROM posts INNER JOIN users ON users.id = posts.author_id;\n-- Filters only, doesn\'t load user data!',
			},
		],
	},
	{
		id: 'nested',
		title: 'Posts → Comments → Users',
		description: 'Load posts with comments and their users',
		code: '@posts = Post.all\n# View: comment.user.name',
		currentQueries: 1001,
		solved: false,
		strategies: [
			{
				id: 'none',
				name: 'No Change',
				code: 'Post.all',
				description: 'Triple N+1!',
				queries: 1001,
				selected: true,
				correct: false,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM comments WHERE post_id = 1;\nSELECT * FROM users WHERE id = 5;\n-- ...1000 more queries',
			},
			{
				id: 'includes',
				name: 'includes (nested)',
				code: 'Post.includes(comments: :user)',
				description: 'Eager load nested associations',
				queries: 3,
				selected: false,
				correct: true,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM comments WHERE post_id IN (1, 2, ...);\nSELECT * FROM users WHERE id IN (5, 6, ...);  -- 3 total',
			},
			{
				id: 'flat',
				name: 'includes (flat)',
				code: 'Post.includes(:comments)',
				description: 'Only loads comments',
				queries: 102,
				selected: false,
				correct: false,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM comments WHERE post_id IN (1, 2, ...);\n-- Users still N+1! 102 queries',
			},
		],
	},
	{
		id: 'conditional',
		title: 'Posts with Filtered Tags',
		description: 'Load posts with specific tags using a WHERE clause',
		code: '@posts = Post.where(tags: { active: true })',
		currentQueries: 101,
		solved: false,
		strategies: [
			{
				id: 'includes',
				name: 'includes',
				code: 'Post.includes(:tags).where(tags: { active: true })',
				description: 'Generates LEFT OUTER JOIN',
				queries: 2,
				selected: false,
				correct: false,
				sqlPlan: 'SELECT "posts"."id" FROM "posts" LEFT OUTER JOIN "tags" ON ...\n  WHERE "tags"."active" = true;\nSELECT * FROM tags WHERE post_id IN (...);  -- 2 queries',
			},
			{
				id: 'eager_load',
				name: 'eager_load',
				code: 'Post.eager_load(:tags).where(tags: { active: true })',
				description: 'Forces LEFT OUTER JOIN',
				queries: 1,
				selected: false,
				correct: true,
				sqlPlan: 'SELECT "posts".*, "tags".* FROM "posts"\n  LEFT OUTER JOIN "tags" ON ...\n  WHERE "tags"."active" = true;  -- 1 query, 1 JOIN',
			},
			{
				id: 'preload',
				name: 'preload',
				code: 'Post.preload(:tags).where(tags: { active: true })',
				description: 'Separate queries, cannot filter',
				queries: 'Error!',
				selected: false,
				correct: false,
				sqlPlan: 'SELECT * FROM posts;\nSELECT * FROM tags WHERE post_id IN (...);\n-- ERROR: Cannot use WHERE on preloaded association!',
			},
		],
	},
];

export function Level25EagerLoading({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [scenarios, setScenarios] = useState<Scenario[]>(INITIAL_SCENARIOS);
	const [activeScenario, setActiveScenario] = useState<string>('basic');

	const solvedCount = scenarios.filter((s) => s.solved).length;
	const currentScenario = scenarios.find((s) => s.id === activeScenario)!;

	const validateSolution = (): ValidationResult => {
		const unsolved = scenarios.filter((s) => !s.solved);
		if (unsolved.length > 0) {
			return {
				valid: false,
				message: 'Optimize all scenarios!',
				details: unsolved.map((s) => `"${s.title}" still has N+1 problem`),
			};
		}
		return {
			valid: true,
			message: 'All queries optimized with eager loading!',
		};
	};

	const selectStrategy = (scenarioId: string, strategyId: string) => {
		setScenarios((prev) =>
			prev.map((scenario) => {
				if (scenario.id !== scenarioId) return scenario;

				const newStrategies = scenario.strategies.map((s) => ({
					...s,
					selected: s.id === strategyId,
				}));

				const selectedStrategy = newStrategies.find((s) => s.selected);

				return {
					...scenario,
					strategies: newStrategies,
					currentQueries:
						typeof selectedStrategy?.queries === 'number'
							? selectedStrategy.queries
							: scenario.currentQueries,
					solved: selectedStrategy?.correct || false,
				};
			}),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level25-eager-loading', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getSelectedStrategy = (scenario: Scenario) =>
		scenario.strategies.find((s) => s.selected);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Choose the right eager loading strategy for each scenario."
					instructions={[
						'includes: Smart choice, uses separate query or JOIN',
						'preload: Always uses separate queries',
						'eager_load: Always uses LEFT OUTER JOIN',
						'Match the strategy to the scenario',
					]}
					scenario="Level 23 exposed the N+1 problem in your posts query. Now fix it. Rails provides three eager loading methods, each with different tradeoffs."
				>
					{/* Scenario Tabs */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Scenarios
						</div>
						<div className="space-y-2">
							{scenarios.map((scenario) => (
								<Button
									className={`w-full p-3 h-auto rounded-lg text-left justify-start flex-col items-start ${
										activeScenario === scenario.id
											? 'bg-primary/20 border border-primary'
											: 'bg-secondary border border-border hover:border-muted-foreground'
									}`}
									key={scenario.id}
									onClick={() => setActiveScenario(scenario.id)}
									variant={
										activeScenario === scenario.id ? 'default' : 'outline'
									}
								>
									<div className="flex justify-between items-center w-full">
										<span
											className={`text-sm font-medium ${scenario.solved ? 'text-success' : 'text-foreground'}`}
										>
											{scenario.title}
										</span>
										{scenario.solved && (
											<span className="text-success text-xs">✓</span>
										)}
									</div>
									<div className="text-xs text-muted-foreground">
										{scenario.description}
									</div>
								</Button>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Scenarios optimized</span>
							<span
								className={
									solvedCount === scenarios.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{solvedCount} / {scenarios.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{ width: `${(solvedCount / scenarios.length) * 100}%` }}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Eager Loading"
					levelNumber={25}
					onComplete={handleComplete}
					onReset={() => setScenarios(INITIAL_SCENARIOS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto">
						{/* Current Scenario */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									{currentScenario.title}
								</div>
								<div className="text-xs text-muted-foreground">
									{currentScenario.description}
								</div>
							</div>

							<div className="p-4">
								<div className="text-xs text-muted-foreground mb-2">
									Current Code:
								</div>
								<pre className="bg-secondary p-3 rounded-lg text-sm text-muted-foreground overflow-x-auto">
									<code>{currentScenario.code}</code>
								</pre>
							</div>

							{/* Query Counter */}
							<div className="px-4 pb-4">
								<div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
									<div>
										<div className="text-xs text-muted-foreground">
											Database Queries
										</div>
										<div className="text-sm text-muted-foreground">
											for 100 posts
										</div>
									</div>
									<div
										className={`text-4xl font-bold ${
											currentScenario.solved
												? 'text-success'
												: 'text-destructive'
										}`}
									>
										{typeof currentScenario.currentQueries === 'number'
											? currentScenario.currentQueries
											: currentScenario.currentQueries}
									</div>
								</div>
							</div>
						</div>

						{/* Strategy Selection */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Choose Loading Strategy
								</div>
								<div className="text-xs text-muted-foreground">
									Select the best approach for this scenario
								</div>
							</div>

							<div className="p-4 space-y-3">
								{currentScenario.strategies.map((strategy) => {
									const isSelected = strategy.selected;
									const isCorrect = strategy.correct;
									const showResult = isSelected;

									return (
										<Button
											className={`w-full p-4 h-auto rounded-lg text-left justify-start flex-col items-start border-2 ${
												isSelected
													? isCorrect
														? 'border-success bg-success/20'
														: 'border-destructive bg-destructive/20'
													: 'border-border bg-secondary/50 hover:border-muted-foreground'
											}`}
											color={
												isSelected && !isCorrect ? 'destructive' : 'primary'
											}
											key={strategy.id}
											onClick={() =>
												selectStrategy(currentScenario.id, strategy.id)
											}
											variant={isSelected ? 'default' : 'outline'}
										>
											<div className="flex justify-between items-start mb-2 w-full">
												<div>
													<span
														className={`font-mono text-sm ${
															isSelected
																? isCorrect
																	? 'text-success'
																	: 'text-destructive'
																: 'text-primary'
														}`}
													>
														{strategy.name}
													</span>
												</div>
												<div
													className={`text-sm font-bold ${
														typeof strategy.queries === 'number'
															? strategy.queries <= 3
																? 'text-success'
																: 'text-destructive'
															: 'text-destructive'
													}`}
												>
													{strategy.queries}{' '}
													{typeof strategy.queries === 'number'
														? 'queries'
														: ''}
												</div>
											</div>
											<div className="text-xs text-muted-foreground mb-2">
												{strategy.description}
											</div>
											<pre className="text-xs bg-card/50 p-2 rounded text-muted-foreground overflow-x-auto">
												<code>{strategy.code}</code>
											</pre>
											{showResult && (
												<div
													className={`mt-2 text-xs ${isCorrect ? 'text-success' : 'text-destructive'}`}
												>
													{isCorrect
														? '✓ Optimal choice!'
														: '✗ Not the best option for this scenario'}
												</div>
											)}
											{isSelected && (
												<div className="mt-2 p-2 bg-card rounded border border-border w-full">
													<div className="text-xs text-muted-foreground mb-1 font-semibold">
														Generated SQL:
													</div>
													<pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap">
														{strategy.sqlPlan}
													</pre>
												</div>
											)}
										</Button>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/post.rb',
							language: 'ruby',
							code: `class Post < ApplicationRecord
  belongs_to :author
  has_many :comments
  has_many :tags
end

# Eager Loading Comparison:

# includes (recommended default)
Post.includes(:author)
# Uses separate query OR JOIN
# Smart: adapts to your query

# preload (force separate queries)
Post.preload(:author)
# Always: 2 separate queries
# Cannot use in WHERE clause

# eager_load (force JOIN)
Post.eager_load(:author)
# Always: LEFT OUTER JOIN
# Required for WHERE on association`,
							highlight: [],
						},
					]}
					learningGoal="includes is usually right. Use eager_load when filtering on associations. Use preload when you need separate queries."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Quick Reference
						</div>
						<div className="space-y-2 text-xs">
							<div className="flex justify-between text-muted-foreground">
								<span className="text-primary">includes</span>
								<span>Auto-picks best method</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span className="text-warning">preload</span>
								<span>Separate queries only</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span className="text-purple-400">eager_load</span>
								<span>LEFT OUTER JOIN only</span>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Nested Associations
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Load multiple levels:
Post.includes(comments: :user)

# Load multiple associations:
Post.includes(:author, :tags)

# Combine both:
Post.includes(:author,
  comments: [:user, :likes]
)`}
						</pre>
					</div>

					{solvedCount === scenarios.length && (
						<>
							<div className="p-4 border-t border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Performance Impact (10K records)
								</div>
								<div className="space-y-2 text-xs font-mono">
									<div className="flex justify-between">
										<span className="text-primary">includes</span>
										<span className="text-muted-foreground">2 queries, SQL IN clause</span>
									</div>
									<div className="flex justify-between">
										<span className="text-warning">preload</span>
										<span className="text-muted-foreground">2 queries, separate SELECTs</span>
									</div>
									<div className="flex justify-between">
										<span className="text-purple-400">eager_load</span>
										<span className="text-muted-foreground">1 query, LEFT JOIN</span>
									</div>
									<div className="flex justify-between mt-2 pt-2 border-t border-border">
										<span className="text-destructive">No eager loading</span>
										<span className="text-destructive">10,001 queries</span>
									</div>
								</div>
								<div className="text-xs text-muted-foreground mt-2">
									Memory: 681MB (no eager) to 45MB (with includes) for 10K records
								</div>
							</div>

							<div className="p-4 border-t border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
									Further Reading
								</div>
								<ul className="text-xs text-muted-foreground space-y-1">
									<li>
										<span className="text-primary">bullet gem</span> - Auto-detects N+1 and suggests eager loading
									</li>
									<li>
										<span className="text-primary">strict_loading</span> - Raises on lazy loads in development
									</li>
									<li>
										<span className="text-primary">Rails Guides</span> - Eager Loading Associations
									</li>
								</ul>
							</div>
						</>
					)}
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level25EagerLoading;

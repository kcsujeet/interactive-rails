/**
 * Level 19: Pagination
 *
 * Handle large datasets with pagination strategies.
 * Player implements different pagination approaches.
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

interface PaginationStrategy {
	id: string;
	name: string;
	description: string;
	pros: string[];
	cons: string[];
	code: string;
	bestFor: string;
	selected: boolean;
}

const PAGINATION_STRATEGIES: PaginationStrategy[] = [
	{
		id: 'offset',
		name: 'Offset Pagination',
		description: 'Skip N rows, take M rows',
		pros: ['Simple to implement', 'Jump to any page', 'Works with any gem'],
		cons: [
			'Slow on large offsets',
			'Inconsistent with insertions',
			'Full count required',
		],
		code: `# Using Kaminari/WillPaginate
@posts = Post.page(params[:page]).per(25)

# Raw SQL
Post.limit(25).offset((page - 1) * 25)

# Page 1000 = OFFSET 24975
# DB must scan 24975 rows to skip them!`,
		bestFor: 'Small datasets, admin panels',
		selected: false,
	},
	{
		id: 'cursor',
		name: 'Cursor Pagination',
		description: 'Use last item as reference point',
		pros: [
			'Consistent performance',
			'No duplicates on insert',
			'Infinite scroll friendly',
		],
		cons: [
			'Cannot jump to page N',
			'Requires sortable cursor',
			'Complex implementation',
		],
		code: `# Using cursor (usually ID or timestamp)
@posts = Post.where("id > ?", params[:cursor])
             .order(:id)
             .limit(25)

# Response includes next_cursor
{
  data: [...],
  next_cursor: 12345
}`,
		bestFor: 'Large datasets, feeds, infinite scroll',
		selected: false,
	},
	{
		id: 'keyset',
		name: 'Keyset Pagination',
		description: 'Use indexed columns for seeking',
		pros: ['O(log n) performance', 'Works with compound keys', 'Very scalable'],
		cons: [
			'Must have suitable index',
			'Complex with multiple sorts',
			'Needs careful SQL',
		],
		code: `# Seek to position using index
@posts = Post
  .where("(created_at, id) > (?, ?)",
         last_created_at, last_id)
  .order(:created_at, :id)
  .limit(25)

# Requires index:
# add_index :posts, [:created_at, :id]`,
		bestFor: 'High-traffic APIs, real-time data',
		selected: false,
	},
];

interface Scenario {
	id: string;
	name: string;
	description: string;
	dataSize: string;
	traffic: string;
	features: string[];
	correctStrategy: string;
	userChoice: string | null;
}

const SCENARIOS: Scenario[] = [
	{
		id: 'admin',
		name: 'Admin Dashboard',
		description: 'Internal tool for managing users',
		dataSize: '10,000 records',
		traffic: 'Low (10 req/min)',
		features: ['Jump to any page', 'Show page numbers', 'Sort by any column'],
		correctStrategy: 'offset',
		userChoice: null,
	},
	{
		id: 'feed',
		name: 'Social Feed',
		description: 'Twitter-like timeline with real-time posts',
		dataSize: '100M+ records',
		traffic: 'Very High (10K req/sec)',
		features: ['Infinite scroll', 'No duplicate posts', 'Real-time updates'],
		correctStrategy: 'cursor',
		userChoice: null,
	},
	{
		id: 'api',
		name: 'Public API',
		description: 'REST API for third-party developers',
		dataSize: '50M records',
		traffic: 'High (1K req/sec)',
		features: ['Consistent ordering', 'Compound sort', 'Rate limited'],
		correctStrategy: 'keyset',
		userChoice: null,
	},
];

export function Level19Pagination({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [strategies] = useState<PaginationStrategy[]>(PAGINATION_STRATEGIES);
	const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);
	const [activeScenario, setActiveScenario] = useState<string>('admin');

	const solvedCount = scenarios.filter(
		(s) => s.userChoice === s.correctStrategy,
	).length;
	const currentScenario = scenarios.find((s) => s.id === activeScenario)!;

	const validateSolution = (): ValidationResult => {
		const wrong = scenarios.filter((s) => s.userChoice !== s.correctStrategy);
		if (wrong.length === scenarios.length) {
			return {
				valid: false,
				message: 'Choose a pagination strategy for each scenario!',
				details: ['Match the right strategy to each use case'],
			};
		}
		if (wrong.length > 0) {
			return {
				valid: false,
				message: 'Some choices could be better!',
				details: wrong.map(
					(s) => `"${s.name}": Consider the data size and access patterns`,
				),
			};
		}
		return { valid: true, message: 'Perfect pagination strategy choices!' };
	};

	const selectStrategy = (scenarioId: string, strategyId: string) => {
		setScenarios((prev) =>
			prev.map((s) =>
				s.id === scenarioId ? { ...s, userChoice: strategyId } : s,
			),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level19-pagination', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn when to use each pagination strategy based on data size and access patterns."
					instructions={[
						'Offset: Simple but slow for large pages',
						'Cursor: Great for feeds, no page jumping',
						'Keyset: Most scalable, needs good indexes',
						'Match strategy to use case',
					]}
					scenario="Your 'Show All Posts' page is timing out. Loading 1 million records into memory isn't going to work. Time to paginate - but which strategy?"
				>
					{/* Scenario Tabs */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Scenarios
						</div>
						<div className="space-y-2">
							{scenarios.map((scenario) => {
								const isCorrect =
									scenario.userChoice === scenario.correctStrategy;
								const hasChoice = scenario.userChoice !== null;

								return (
									<Button
										className={`w-full p-2 h-auto rounded-lg text-left justify-start ${
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
												className={`text-sm ${hasChoice ? (isCorrect ? 'text-success' : 'text-warning') : 'text-foreground'}`}
											>
												{scenario.name}
											</span>
											{hasChoice && (
												<span
													className={
														isCorrect
															? 'text-success text-xs'
															: 'text-warning text-xs'
													}
												>
													{isCorrect ? '✓' : '?'}
												</span>
											)}
										</div>
									</Button>
								);
							})}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correct matches</span>
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
					actNumber={3}
					levelName="Pagination"
					levelNumber={19}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setScenarios(SCENARIOS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Current Scenario */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold text-lg">
									{currentScenario.name}
								</div>
								<div className="text-sm text-muted-foreground">
									{currentScenario.description}
								</div>
							</div>

							<div className="p-4 grid grid-cols-3 gap-4">
								<div className="bg-secondary/50 p-3 rounded-lg">
									<div className="text-xs text-muted-foreground">Data Size</div>
									<div className="text-foreground font-semibold">
										{currentScenario.dataSize}
									</div>
								</div>
								<div className="bg-secondary/50 p-3 rounded-lg">
									<div className="text-xs text-muted-foreground">Traffic</div>
									<div className="text-foreground font-semibold">
										{currentScenario.traffic}
									</div>
								</div>
								<div className="bg-secondary/50 p-3 rounded-lg">
									<div className="text-xs text-muted-foreground">
										Requirements
									</div>
									<div className="text-xs text-muted-foreground">
										{currentScenario.features.join(', ')}
									</div>
								</div>
							</div>
						</div>

						{/* Strategy Selection */}
						<div className="grid grid-cols-3 gap-4">
							{strategies.map((strategy) => {
								const isSelected = currentScenario.userChoice === strategy.id;
								const isCorrect =
									currentScenario.correctStrategy === strategy.id;

								return (
									<Button
										className={`p-4 h-auto rounded-xl border-2 text-left justify-start flex-col items-start ${
											isSelected
												? isCorrect
													? 'border-success bg-success/20'
													: 'border-warning bg-warning/20'
												: 'border-border bg-card hover:border-muted-foreground'
										}`}
										key={strategy.id}
										onClick={() =>
											selectStrategy(currentScenario.id, strategy.id)
										}
										variant={
											isSelected
												? isCorrect
													? 'default'
													: 'secondary'
												: 'outline'
										}
									>
										<div className="text-foreground font-semibold mb-1">
											{strategy.name}
										</div>
										<div className="text-xs text-muted-foreground mb-3">
											{strategy.description}
										</div>

										<div className="mb-2 w-full">
											<div className="text-xs text-success font-semibold mb-1">
												Pros
											</div>
											<ul className="text-xs text-muted-foreground space-y-0.5">
												{strategy.pros.map((pro, i) => (
													<li key={i}>+ {pro}</li>
												))}
											</ul>
										</div>

										<div className="mb-2 w-full">
											<div className="text-xs text-destructive font-semibold mb-1">
												Cons
											</div>
											<ul className="text-xs text-muted-foreground space-y-0.5">
												{strategy.cons.map((con, i) => (
													<li key={i}>- {con}</li>
												))}
											</ul>
										</div>

										<div className="text-xs bg-secondary p-2 rounded mt-2 w-full">
											<span className="text-primary">Best for:</span>
											<span className="text-muted-foreground ml-1">
												{strategy.bestFor}
											</span>
										</div>

										{isSelected && (
											<div
												className={`mt-2 text-xs text-center p-1 rounded w-full ${isCorrect ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}
											>
												{isCorrect
													? '✓ Good choice!'
													: 'Consider the requirements...'}
											</div>
										)}
									</Button>
								);
							})}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={strategies.map((s) => ({
						filename: `${s.id}_pagination.rb`,
						language: 'ruby',
						code: s.code,
						highlight: [],
					}))}
					learningGoal="Offset for simplicity, cursor for consistency, keyset for scale. Choose based on your data and access patterns."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Decision Matrix
						</div>
						<div className="text-xs space-y-2">
							<div className="flex justify-between text-muted-foreground">
								<span>Small data + page numbers</span>
								<span className="text-primary">Offset</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>Large data + infinite scroll</span>
								<span className="text-primary">Cursor</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>Massive data + API</span>
								<span className="text-primary">Keyset</span>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Popular Gems
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• kaminari - Offset pagination</li>
							<li>• will_paginate - Classic offset</li>
							<li>• pagy - Fast, flexible</li>
							<li>• graphql-connections - Cursor</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level19Pagination;

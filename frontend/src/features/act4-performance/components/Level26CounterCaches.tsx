/**
 * Level 25: Counter Caches
 *
 * Teaches counter caches through a before/after comparison.
 * Player observes the COUNT(*) explosion, adds a counter cache, then sees queries drop to one.
 */

import {
	ArrowDown,
	ArrowRight,
	Check,
	Database,
	Hash,
	Timer,
	TrendingDown,
	Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Step = 'before' | 'adding' | 'after';

interface QueryLogEntry {
	text: string;
	time: number;
}

const BEFORE_QUERIES: QueryLogEntry[] = [
	{ text: 'Post Load (1.2ms)  SELECT "posts".* FROM "posts"', time: 1.2 },
	...Array.from({ length: 100 }, (_, i) => ({
		text: `  (${(0.3 + Math.random() * 0.2).toFixed(1)}ms)  SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = ${i + 1}`,
		time: 0.3 + Math.random() * 0.2,
	})),
];

const AFTER_QUERIES: QueryLogEntry[] = [
	{ text: 'Post Load (1.2ms)  SELECT "posts".* FROM "posts"', time: 1.2 },
];

const STEP_LABELS = ['Observe', 'Add Column', 'Enable', 'Verify'] as const;
const TOTAL_BEFORE_TIME = BEFORE_QUERIES.reduce((s, q) => s + q.time, 0);

export function Level26CounterCaches({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [counterCacheEnabled, setCounterCacheEnabled] = useState(false);
	const [isSimulating, setIsSimulating] = useState(false);
	const [queryCount, setQueryCount] = useState(0);
	const [simulationTime, setSimulationTime] = useState(0);
	const [step, setStep] = useState<Step>('before');
	const [viewedBefore, setViewedBefore] = useState(false);
	const [visibleQueries, setVisibleQueries] = useState<QueryLogEntry[]>([]);
	const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');
	const [migrationProgress, setMigrationProgress] = useState(0);
	const logRef = useRef<HTMLDivElement>(null);
	const simulationRef = useRef<number | null>(null);

	const stepIndex =
		step === 'before' ? (viewedBefore ? 1 : 0) : step === 'adding' ? 2 : 3;

	// Auto-scroll the query log
	useEffect(() => {
		if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
	}, [visibleQueries]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (simulationRef.current) clearInterval(simulationRef.current);
		};
	}, []);

	const runBeforeSimulation = () => {
		setIsSimulating(true);
		setVisibleQueries([]);
		setQueryCount(0);
		setSimulationTime(0);
		let idx = 0;
		const iv = setInterval(() => {
			if (idx >= BEFORE_QUERIES.length) {
				clearInterval(iv);
				setIsSimulating(false);
				setViewedBefore(true);
				return;
			}
			const entry = BEFORE_QUERIES[idx];
			setVisibleQueries((prev) => [...prev, entry]);
			setQueryCount(idx + 1);
			setSimulationTime((prev) => prev + entry.time);
			idx++;
		}, 40);
		simulationRef.current = iv as unknown as number;
	};

	const runAfterSimulation = () => {
		setIsSimulating(true);
		setVisibleQueries([]);
		setQueryCount(0);
		setSimulationTime(0);
		setTimeout(() => {
			setVisibleQueries(AFTER_QUERIES);
			setQueryCount(1);
			setSimulationTime(1.2);
			setIsSimulating(false);
		}, 600);
	};

	const runMigration = () => {
		setStep('adding');
		setMigrationProgress(0);
		let progress = 0;
		const iv = setInterval(() => {
			progress += 2;
			setMigrationProgress(progress);
			if (progress >= 100) {
				clearInterval(iv);
				setTimeout(() => {
					setCounterCacheEnabled(true);
					setStep('after');
					setActiveTab('after');
					setVisibleQueries([]);
					setQueryCount(0);
					setSimulationTime(0);
				}, 400);
			}
		}, 30);
	};

	const validateSolution = (): ValidationResult => {
		if (!viewedBefore) {
			return {
				valid: false,
				message: 'Run the "Before" simulation first!',
				details: ['Click "Run Simulation" to see the COUNT(*) query explosion'],
			};
		}
		if (!counterCacheEnabled) {
			return {
				valid: false,
				message: 'Add the counter cache to fix the problem!',
				details: ['Click "Add Counter Cache" to apply the optimization'],
			};
		}
		return {
			valid: true,
			message: 'Counter cache eliminates N COUNT queries!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level26-counter-caches', {
			stars: 3,
		});
		if (success) onComplete({ stars: 3 });
	};

	const handleReset = () => {
		if (simulationRef.current) clearInterval(simulationRef.current);
		setCounterCacheEnabled(false);
		setIsSimulating(false);
		setQueryCount(0);
		setSimulationTime(0);
		setStep('before');
		setViewedBefore(false);
		setVisibleQueries([]);
		setActiveTab('before');
		setMigrationProgress(0);
	};

	const qColor = (n: number) =>
		n === 0
			? 'text-muted-foreground'
			: n <= 1
				? 'text-success'
				: 'text-destructive';
	const tColor = (t: number) =>
		t === 0
			? 'text-muted-foreground'
			: t <= 2
				? 'text-success'
				: 'text-destructive';

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Eliminate N COUNT(*) queries by storing the count directly on the parent table."
					instructions={[
						'Observe the COUNT query explosion',
						'Add comments_count column to posts',
						'Enable counter_cache on belongs_to',
						'Watch queries drop to zero',
					]}
					scenario="The posts index shows comment counts. Each post.comments.count fires a COUNT(*) query. 100 posts = 100 extra queries."
				>
					{/* Steps Indicator */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Progress
						</div>
						<div className="space-y-2">
							{STEP_LABELS.map((label, i) => (
								<div className="flex items-center gap-2" key={label}>
									<div
										className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
											i < stepIndex
												? 'bg-success text-success-foreground'
												: i === stepIndex
													? 'bg-primary text-primary-foreground'
													: 'bg-secondary text-muted-foreground'
										}`}
									>
										{i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
									</div>
									<span
										className={`text-sm ${
											i === stepIndex
												? 'text-foreground font-medium'
												: i < stepIndex
													? 'text-success'
													: 'text-muted-foreground'
										}`}
									>
										{label}
									</span>
									{i < STEP_LABELS.length - 1 && (
										<ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
									)}
								</div>
							))}
						</div>
					</div>

					{/* Query Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Query Stats
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Database className="w-4 h-4" />
									<span>Queries</span>
								</div>
								<span className={`text-sm font-bold ${qColor(queryCount)}`}>
									{queryCount}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Timer className="w-4 h-4" />
									<span>Time</span>
								</div>
								<span className={`text-sm font-bold ${tColor(simulationTime)}`}>
									{simulationTime.toFixed(1)}ms
								</span>
							</div>
						</div>
					</div>

					{/* Improvement comparison after enabling */}
					{counterCacheEnabled && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
								<TrendingDown className="w-3 h-3" />
								Improvement
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-destructive/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										Before
									</div>
									<div className="text-lg font-bold text-destructive">101</div>
									<div className="text-xs text-muted-foreground">queries</div>
								</div>
								<div className="bg-success/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										After
									</div>
									<div className="text-lg font-bold text-success">1</div>
									<div className="text-xs text-muted-foreground">query</div>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3 mt-2">
								<div className="bg-destructive/10 rounded-lg p-3 text-center">
									<div className="text-lg font-bold text-destructive">
										{TOTAL_BEFORE_TIME.toFixed(1)}ms
									</div>
								</div>
								<div className="bg-success/10 rounded-lg p-3 text-center">
									<div className="text-lg font-bold text-success">1.2ms</div>
								</div>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Counter Caches"
					levelNumber={26}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto">
						{/* Mode Toggle Tabs */}
						<div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1">
							<button
								className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
									activeTab === 'before'
										? 'bg-card text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
								onClick={() => {
									setActiveTab('before');
									if (step === 'after') {
										setVisibleQueries([]);
										setQueryCount(0);
										setSimulationTime(0);
									}
								}}
								type="button"
							>
								<div className="flex items-center justify-center gap-2">
									<Database className="w-4 h-4" />
									Before
								</div>
							</button>
							<button
								className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
									activeTab === 'after'
										? 'bg-card text-foreground shadow-sm'
										: counterCacheEnabled
											? 'text-muted-foreground hover:text-foreground'
											: 'text-muted-foreground/50 cursor-not-allowed'
								}`}
								disabled={!counterCacheEnabled}
								onClick={() => {
									if (!counterCacheEnabled) return;
									setActiveTab('after');
									setVisibleQueries([]);
									setQueryCount(0);
									setSimulationTime(0);
								}}
								type="button"
							>
								<div className="flex items-center justify-center gap-2">
									<Zap className="w-4 h-4" />
									After
									{!counterCacheEnabled && (
										<span className="text-xs opacity-50">(locked)</span>
									)}
								</div>
							</button>
						</div>

						{/* Migration Animation */}
						{step === 'adding' && (
							<div className="bg-card rounded-xl border border-primary overflow-hidden mb-6 animate-in fade-in duration-300">
								<div className="bg-primary/10 px-4 py-3 border-b border-primary/30">
									<div className="flex items-center gap-2 text-primary font-semibold">
										<Hash className="w-4 h-4" />
										Running Migration...
									</div>
								</div>
								<div className="p-6">
									<pre className="text-sm text-muted-foreground bg-secondary p-4 rounded-lg mb-4 overflow-x-auto font-mono">
										<code>
											<span className="text-primary">rails</span> db:migrate
											{'\n\n'}
											<span className="text-success">
												== AddCommentsCountToPosts: migrating ==
											</span>
											{'\n'}
											{'-- '}add_column(:posts, :comments_count, :integer,{'\n'}
											{'   '}default: 0, null: false)
										</code>
									</pre>
									<div className="flex justify-between text-xs text-muted-foreground mb-2">
										<span>Adding column and resetting counters...</span>
										<span>{migrationProgress}%</span>
									</div>
									<div className="h-2 bg-secondary rounded-full overflow-hidden">
										<div
											className="h-full bg-primary transition-all duration-75 rounded-full"
											style={{ width: `${migrationProgress}%` }}
										/>
									</div>
								</div>
							</div>
						)}

						{/* Before Mode */}
						{step !== 'adding' && activeTab === 'before' && (
							<>
								<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
									<div className="bg-secondary px-4 py-3 border-b border-border">
										<div className="text-foreground font-semibold flex items-center gap-2">
											<Database className="w-4 h-4 text-destructive" />
											Without Counter Cache
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Each post.comments.count fires a separate COUNT(*) query
										</div>
									</div>
									<div className="p-4">
										<pre className="bg-secondary p-3 rounded-lg text-sm text-muted-foreground overflow-x-auto">
											<code>
												<span className="text-muted-foreground">
													# app/serializers/post_serializer.rb
												</span>
												{'\n'}
												{'attribute :comment_count do |post|'}
												{'\n'}
												{'  '}
												<span className="text-destructive">
													{'post.comments.count'}
												</span>
												{'\n'}
												{'end'}
											</code>
										</pre>
									</div>
								</div>

								{/* Query Counter + Timer */}
								<div className="grid grid-cols-2 gap-4 mb-6">
									<div className="bg-card rounded-xl border border-border p-4 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Database Queries
										</div>
										<div
											className={`text-4xl font-bold tabular-nums ${qColor(queryCount)}`}
										>
											{queryCount}
										</div>
										{queryCount > 10 && (
											<div className="text-xs text-destructive mt-1 flex items-center justify-center gap-1">
												<ArrowDown className="w-3 h-3" />
												N+1 COUNT explosion
											</div>
										)}
									</div>
									<div className="bg-card rounded-xl border border-border p-4 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Total Time
										</div>
										<div
											className={`text-4xl font-bold tabular-nums ${tColor(simulationTime)}`}
										>
											{simulationTime.toFixed(1)}
										</div>
										<div className="text-xs text-muted-foreground">ms</div>
									</div>
								</div>

								{/* Database Query Log */}
								<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
									<div className="bg-secondary px-4 py-2 border-b border-border flex justify-between items-center">
										<span className="text-muted-foreground text-sm font-semibold flex items-center gap-2">
											<Database className="w-3 h-3" />
											Database Log
										</span>
										<span
											className={`text-xs px-2 py-1 rounded ${queryCount > 2 ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-muted-foreground'}`}
										>
											{queryCount} {queryCount === 1 ? 'query' : 'queries'}
										</span>
									</div>
									<div
										className="p-3 h-56 overflow-y-auto font-mono text-xs space-y-0.5"
										ref={logRef}
									>
										{visibleQueries.length === 0 ? (
											<div className="text-muted-foreground text-center py-8">
												Click "Run Simulation" to see the queries...
											</div>
										) : (
											visibleQueries.map((entry, i) => (
												<div
													className={
														entry.text.includes('COUNT')
															? 'text-destructive/80'
															: 'text-primary'
													}
													key={i}
												>
													{entry.text}
												</div>
											))
										)}
									</div>
								</div>

								{/* Action Button */}
								<div className="flex justify-center">
									{!viewedBefore ? (
										<Button
											disabled={isSimulating}
											onClick={runBeforeSimulation}
											size="lg"
											variant={isSimulating ? 'secondary' : 'default'}
										>
											<Database
												className={`w-4 h-4 mr-2 ${isSimulating ? 'animate-pulse' : ''}`}
											/>
											{isSimulating
												? `Simulating... (${queryCount}/101)`
												: 'Run Simulation'}
										</Button>
									) : (
										<Button
											className="text-base px-8 py-4 h-auto"
											onClick={runMigration}
											size="lg"
										>
											<Zap className="w-5 h-5 mr-2" />
											Add Counter Cache
										</Button>
									)}
								</div>
							</>
						)}

						{/* After Mode */}
						{step === 'after' && activeTab === 'after' && (
							<>
								<div className="bg-card rounded-xl border border-success/30 overflow-hidden mb-6">
									<div className="bg-success/10 px-4 py-3 border-b border-success/20">
										<div className="text-foreground font-semibold flex items-center gap-2">
											<Zap className="w-4 h-4 text-success" />
											With Counter Cache
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											comments_count is stored on the posts table -- zero extra
											queries
										</div>
									</div>
									<div className="p-4">
										<pre className="bg-secondary p-3 rounded-lg text-sm text-muted-foreground overflow-x-auto">
											<code>
												<span className="text-muted-foreground">
													# app/serializers/post_serializer.rb
												</span>
												{'\n'}
												{'attribute :comment_count do |post|'}
												{'\n'}
												{'  '}
												<span className="text-success">
													{'post.comments_count'}
												</span>
												{'\n'}
												{'end'}
											</code>
										</pre>
									</div>
								</div>

								{/* Query Counter + Timer (After) */}
								<div className="grid grid-cols-2 gap-4 mb-6">
									<div className="bg-card rounded-xl border border-success/30 p-4 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Database Queries
										</div>
										<div
											className={`text-4xl font-bold tabular-nums ${queryCount === 0 ? 'text-muted-foreground' : 'text-success'}`}
										>
											{queryCount}
										</div>
										{queryCount === 1 && (
											<div className="text-xs text-success mt-1 flex items-center justify-center gap-1">
												<Check className="w-3 h-3" />
												Just one query
											</div>
										)}
									</div>
									<div className="bg-card rounded-xl border border-success/30 p-4 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Total Time
										</div>
										<div
											className={`text-4xl font-bold tabular-nums ${simulationTime === 0 ? 'text-muted-foreground' : 'text-success'}`}
										>
											{simulationTime.toFixed(1)}
										</div>
										<div className="text-xs text-muted-foreground">ms</div>
									</div>
								</div>

								{/* Database Query Log (After) */}
								<div className="bg-card rounded-xl border border-success/30 overflow-hidden mb-6">
									<div className="bg-success/10 px-4 py-2 border-b border-success/20 flex justify-between items-center">
										<span className="text-muted-foreground text-sm font-semibold flex items-center gap-2">
											<Database className="w-3 h-3" />
											Database Log
										</span>
										<span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
											{queryCount} {queryCount === 1 ? 'query' : 'queries'}
										</span>
									</div>
									<div className="p-3 h-56 overflow-y-auto font-mono text-xs space-y-0.5">
										{visibleQueries.length === 0 ? (
											<div className="text-muted-foreground text-center py-8">
												Click "Run Simulation" to see the optimized query...
											</div>
										) : (
											visibleQueries.map((entry, i) => (
												<div className="text-success" key={i}>
													{entry.text}
												</div>
											))
										)}
										{queryCount === 1 && (
											<div className="text-muted-foreground mt-4 text-center">
												No COUNT(*) queries needed -- the count is already on
												the posts row.
											</div>
										)}
									</div>
								</div>

								{/* Before vs After Comparison Table */}
								<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
									<div className="bg-secondary px-4 py-3 border-b border-border">
										<div className="text-foreground font-semibold flex items-center gap-2">
											<TrendingDown className="w-4 h-4 text-success" />
											Before vs After
										</div>
									</div>
									<div className="grid grid-cols-3 gap-0 divide-x divide-border text-center">
										<div className="p-3">
											<div className="text-xs text-muted-foreground">
												Metric
											</div>
										</div>
										<div className="p-3 bg-destructive/5">
											<div className="text-xs text-destructive">Before</div>
										</div>
										<div className="p-3 bg-success/5">
											<div className="text-xs text-success">After</div>
										</div>

										<div className="p-3 border-t border-border">
											<div className="text-sm text-muted-foreground">
												Queries
											</div>
										</div>
										<div className="p-3 bg-destructive/5 border-t border-border">
											<div className="text-2xl font-bold text-destructive">
												101
											</div>
										</div>
										<div className="p-3 bg-success/5 border-t border-border">
											<div className="text-2xl font-bold text-success">1</div>
										</div>

										<div className="p-3 border-t border-border">
											<div className="text-sm text-muted-foreground">Time</div>
										</div>
										<div className="p-3 bg-destructive/5 border-t border-border">
											<div className="text-2xl font-bold text-destructive">
												{TOTAL_BEFORE_TIME.toFixed(1)}ms
											</div>
										</div>
										<div className="p-3 bg-success/5 border-t border-border">
											<div className="text-2xl font-bold text-success">
												1.2ms
											</div>
										</div>

										<div className="p-3 border-t border-border">
											<div className="text-sm text-muted-foreground">
												Reduction
											</div>
										</div>
										<div className="p-3 bg-destructive/5 border-t border-border">
											<div className="text-sm text-muted-foreground">--</div>
										</div>
										<div className="p-3 bg-success/5 border-t border-border">
											<div className="text-lg font-bold text-success">99%</div>
										</div>
									</div>
								</div>

								{/* Run After Simulation */}
								<div className="flex justify-center">
									<Button
										disabled={isSimulating}
										onClick={runAfterSimulation}
										size="lg"
										variant={queryCount > 0 ? 'secondary' : 'default'}
									>
										<Zap
											className={`w-4 h-4 mr-2 ${isSimulating ? 'animate-pulse' : ''}`}
										/>
										{isSimulating
											? 'Running...'
											: queryCount > 0
												? 'Run Again'
												: 'Run Simulation'}
									</Button>
								</div>
							</>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'db/migrate/add_comments_count_to_posts.rb',
							language: 'ruby',
							highlight: [3, 4],
							code: `class AddCommentsCountToPosts < ActiveRecord::Migration[7.1]\n  def change\n    add_column :posts, :comments_count,\n               :integer, default: 0, null: false\n  end\nend\n\n# Then reset existing counters:\n# Post.find_each do |post|\n#   Post.reset_counters(post.id, :comments)\n# end`,
						},
						{
							filename: 'app/models/comment.rb',
							language: 'ruby',
							highlight: [2],
							code: `class Comment < ApplicationRecord\n  belongs_to :post, counter_cache: true\nend\n\n# Rails automatically:\n# - Increments posts.comments_count on create\n# - Decrements posts.comments_count on destroy\n# - No manual updates needed`,
						},
						{
							filename: 'app/models/post.rb',
							language: 'ruby',
							highlight: [4],
							code: `class Post < ApplicationRecord\n  has_many :comments\n\n  # .size  → uses counter cache (fast)\n  # .count → always runs COUNT(*) (slow)\n  # .length → loads all records (bad)\nend`,
						},
					]}
					learningGoal="Counter caches store association counts on the parent table. Rails auto-increments/decrements on create/destroy -- zero queries to get the count."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<div className="space-y-3 text-xs">
							<div className="flex items-start gap-2">
								<Hash className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										counter_cache: true
									</span>
									<div className="text-muted-foreground">
										Add to belongs_to to auto-track count
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										default: 0, null: false
									</span>
									<div className="text-muted-foreground">
										Always set defaults on the column
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<TrendingDown className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										reset_counters
									</span>
									<div className="text-muted-foreground">
										Fix out-of-sync data after migration
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										.size vs .count vs .length
									</span>
									<div className="text-muted-foreground">
										.size uses cache; .count always queries
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Custom Column Name
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Use a custom column name:\nbelongs_to :post,\n  counter_cache: :total_comments\n\n# Column must match on parent:\nadd_column :posts,\n  :total_comments, :integer,\n  default: 0, null: false`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level26CounterCaches;

/**
 * Level 27: Counter Caches
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Query Waterfall" visualization.
 *   Player fires requests at GET /api/posts and watches COUNT(*) queries
 *   cascade down a waterfall. Clickable query rows reveal details.
 *   Discovery gating controls when "Build the Fix" appears.
 *
 * Phase 2 (HOW - build): 4 steps (1 terminal + 3 OptionCard)
 *   Step 0: Generate migration to add comments_count column (terminal)
 *   Step 1: Add counter_cache: true to belongs_to (OptionCard)
 *   Step 2: Reset existing counters (OptionCard)
 *   Step 3: Update serializer to use .size (OptionCard)
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Counter Cache" button
 * Phase 4 (ADVANTAGE - reward): Interactive before/after comparison.
 *   Player fires requests at different scales (10, 50, 100, 500 posts)
 *   and sees query count stay at 1 with counter cache vs N+1 without.
 *
 * Teaches: counter_cache: true, migration conventions, reset_counters, .size vs .count
 */

import {
	ArrowRight,
	Database,
	Play,
	Search,
	Star,
	Timer,
	TrendingDown,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'count-explosion', label: 'COUNT(*) query explosion on index' },
	{ id: 'per-post-query', label: 'Each post fires a separate COUNT(*)' },
	{ id: 'linear-scaling', label: 'Query count scales linearly with posts' },
];

// ──────────────────────────────────────────────
// Observe phase: query waterfall probes
// ──────────────────────────────────────────────

interface WaterfallProbe {
	id: string;
	label: string;
	postCount: number;
	discoveryIds: string[];
}

const WATERFALL_PROBES: WaterfallProbe[] = [
	{
		id: 'small',
		label: 'GET /api/posts (10 posts)',
		postCount: 10,
		discoveryIds: ['count-explosion'],
	},
	{
		id: 'medium',
		label: 'GET /api/posts (50 posts)',
		postCount: 50,
		discoveryIds: ['per-post-query'],
	},
	{
		id: 'large',
		label: 'GET /api/posts (100 posts)',
		postCount: 100,
		discoveryIds: ['linear-scaling'],
	},
];

function generateQueryLog(postCount: number): string[] {
	const lines: string[] = [
		`Post Load (1.2ms)  SELECT "posts".* FROM "posts" LIMIT ${postCount}`,
	];
	for (let i = 1; i <= postCount; i++) {
		const time = (0.3 + Math.random() * 0.2).toFixed(1);
		lines.push(
			`  (${time}ms)  SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = ${i}`,
		);
	}
	return lines;
}

// ──────────────────────────────────────────────
// Step definitions (build phase)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-migration', title: 'Generate the Migration' },
	{ id: 'add-counter-cache', title: 'Enable counter_cache' },
	{ id: 'reset-counters', title: 'Reset Existing Counters' },
	{ id: 'update-serializer', title: 'Use the Cached Count' },
];

// ──────────────────────────────────────────────
// Terminal step data (step 0)
// ──────────────────────────────────────────────

const MIGRATION_COMMANDS = [
	{
		id: 'add-column-raw',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: false,
		feedback:
			'There is no migration to run yet. You need to generate one first that adds the counter column.',
	},
	{
		id: 'generate-migration',
		label: 'rails generate migration AddCommentsCountToPosts comments_count:integer',
		command:
			'rails generate migration AddCommentsCountToPosts comments_count:integer',
		correct: true,
	},
	{
		id: 'add-index',
		label: 'rails generate migration AddIndexToComments post_id:index',
		command: 'rails generate migration AddIndexToComments post_id:index',
		correct: false,
		feedback:
			'An index on comments.post_id helps query speed, but it does not eliminate the N+1 COUNT queries. You need a column on the parent table.',
	},
];

const MIGRATION_OUTPUT = [
	{ text: 'invoke  active_record', color: 'green' as const },
	{
		text: 'create    db/migrate/20240301_add_comments_count_to_posts.rb',
		color: 'green' as const,
	},
];

// ──────────────────────────────────────────────
// OptionCard step data (steps 1-3)
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const COUNTER_CACHE_OPTIONS: StepOption[] = [
	{
		id: 'has-many-counter',
		label: 'has_many :comments, counter_cache: true',
		correct: false,
		feedback:
			'counter_cache is declared on the belongs_to side, not has_many. The child model owns the relationship declaration.',
	},
	{
		id: 'after-create',
		label: 'after_create { Post.increment_counter(:comments_count, post_id) }',
		correct: false,
		feedback:
			'Manual callbacks are error-prone. You would also need after_destroy, after_update, and handle edge cases. Rails provides a built-in option.',
	},
	{
		id: 'belongs-to-counter',
		label: 'belongs_to :post, counter_cache: true',
		correct: true,
	},
];

const RESET_OPTIONS: StepOption[] = [
	{
		id: 'update-all',
		label: 'Post.update_all(comments_count: Post.joins(:comments).count)',
		correct: false,
		feedback:
			'This sets every post to the same total count, not each post to its own count. Rails provides a method that recalculates per-record.',
	},
	{
		id: 'manual-each',
		label: 'Post.find_each { |p| p.update(comments_count: p.comments.count) }',
		correct: false,
		feedback:
			'This works but fires N+1 queries and skips the counter cache mechanism. Rails has a dedicated method that uses efficient SQL.',
	},
	{
		id: 'reset-counters',
		label: 'Post.find_each { |p| Post.reset_counters(p.id, :comments) }',
		correct: true,
	},
];

const SERIALIZER_OPTIONS: StepOption[] = [
	{
		id: 'comments-count-method',
		label: 'post.comments.count',
		correct: false,
		feedback:
			'This always runs a COUNT(*) query, completely bypassing the counter cache column you just added.',
	},
	{
		id: 'comments-length',
		label: 'post.comments.length',
		correct: false,
		feedback:
			'This loads ALL comment records into memory just to count them. Even worse than COUNT(*) for large collections.',
	},
	{
		id: 'comments-size',
		label: 'post.comments.size',
		correct: true,
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Enable counter_cache',
		description:
			'The migration adds the column. Now tell Rails to automatically increment and decrement it when comments are created or destroyed. Where does this declaration go?',
		options: COUNTER_CACHE_OPTIONS,
	},
	2: {
		title: 'Reset Existing Counters',
		description:
			'The column exists but all values are 0. Existing posts already have comments. How do you sync the cached counts with the real data?',
		options: RESET_OPTIONS,
	},
	3: {
		title: 'Use the Cached Count',
		description:
			'The counter cache is populated. Now update the serializer to read the cached value instead of running a query. Which method uses the counter cache?',
		options: SERIALIZER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Terminal step map for buildTerminalHistory
// ──────────────────────────────────────────────

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: MIGRATION_COMMANDS, outputLines: MIGRATION_OUTPUT },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
];

// ──────────────────────────────────────────────
// Reward phase: scale scenarios
// ──────────────────────────────────────────────

interface ScaleScenario {
	id: string;
	label: string;
	postCount: number;
	description: string;
}

const SCALE_SCENARIOS: ScaleScenario[] = [
	{
		id: 'ten',
		label: '10 posts',
		postCount: 10,
		description: 'Small page load',
	},
	{
		id: 'fifty',
		label: '50 posts',
		postCount: 50,
		description: 'Medium listing',
	},
	{
		id: 'hundred',
		label: '100 posts',
		postCount: 100,
		description: 'Full page',
	},
	{
		id: 'five-hundred',
		label: '500 posts',
		postCount: 500,
		description: 'Admin export',
	},
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/serializers/post_serializer.rb',
				language: 'ruby',
				highlight: [4],
				code: `class PostSerializer
  include JSONAPI::Serializer

  attribute :comment_count do |post|
    post.comments.count  # COUNT(*) every time!
  end
end`,
			},
			{
				filename: 'app/models/comment.rb',
				language: 'ruby',
				code: `class Comment < ApplicationRecord
  belongs_to :post
  belongs_to :user
end`,
			},
		];
	}

	// Build phase: code evolves with each step
	if (furthestStep === 0) {
		return [
			{
				filename: 'app/serializers/post_serializer.rb',
				language: 'ruby',
				highlight: [4, 5],
				code: `class PostSerializer
  include JSONAPI::Serializer

  attribute :comment_count do |post|
    post.comments.count  # N+1 COUNT(*)
  end
end

# Step 1: Generate a migration to add
# the counter cache column to posts`,
			},
		];
	}

	if (furthestStep === 1) {
		return [
			{
				filename: 'db/migrate/add_comments_count_to_posts.rb',
				language: 'ruby',
				highlight: [3, 4],
				code: `class AddCommentsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :comments_count,
               :integer, default: 0, null: false
  end
end`,
			},
			{
				filename: 'app/models/comment.rb',
				language: 'ruby',
				highlight: [2],
				code: `class Comment < ApplicationRecord
  belongs_to :post  # Where does counter_cache go?
  belongs_to :user
end`,
			},
		];
	}

	if (furthestStep === 2) {
		return [
			{
				filename: 'db/migrate/add_comments_count_to_posts.rb',
				language: 'ruby',
				code: `class AddCommentsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :comments_count,
               :integer, default: 0, null: false
  end
end`,
			},
			{
				filename: 'app/models/comment.rb',
				language: 'ruby',
				highlight: [2],
				code: `class Comment < ApplicationRecord
  belongs_to :post, counter_cache: true
  belongs_to :user
end

# Column defaults to 0, but existing posts
# have real comments. How to sync?`,
			},
		];
	}

	if (furthestStep === 3) {
		return [
			{
				filename: 'app/models/comment.rb',
				language: 'ruby',
				highlight: [2],
				code: `class Comment < ApplicationRecord
  belongs_to :post, counter_cache: true
  belongs_to :user
end`,
			},
			{
				filename: 'app/serializers/post_serializer.rb',
				language: 'ruby',
				highlight: [4, 5],
				code: `class PostSerializer
  include JSONAPI::Serializer

  attribute :comment_count do |post|
    post.comments.count  # Still using .count!
  end
end

# .count always runs COUNT(*)
# Which method reads the cached column?`,
			},
		];
	}

	// All steps complete (activate + reward)
	return [
		{
			filename: 'db/migrate/add_comments_count_to_posts.rb',
			language: 'ruby',
			code: `class AddCommentsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :comments_count,
               :integer, default: 0, null: false
  end
end`,
		},
		{
			filename: 'app/models/comment.rb',
			language: 'ruby',
			highlight: [2],
			code: `class Comment < ApplicationRecord
  belongs_to :post, counter_cache: true
  belongs_to :user
end`,
		},
		{
			filename: 'app/serializers/post_serializer.rb',
			language: 'ruby',
			highlight: [4],
			code: `class PostSerializer
  include JSONAPI::Serializer

  attribute :comment_count do |post|
    post.comments.size  # Uses counter cache!
  end
end

# .size  -> reads posts.comments_count (0 queries)
# .count -> always runs COUNT(*) (1 query)
# .length -> loads all records into memory (bad)`,
		},
	];
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level27CounterCaches({ onComplete }: LevelComponentProps) {
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('observe');

	// Observe phase state
	const [firedProbes, setFiredProbes] = useState<Set<string>>(new Set());
	const [activeProbe, setActiveProbe] = useState<string | null>(null);
	const [queryLog, setQueryLog] = useState<string[]>([]);
	const [queryCount, setQueryCount] = useState(0);
	const [visibleQueryIndex, setVisibleQueryIndex] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const logRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<number | null>(null);

	// Reward phase state
	const [firedScenarios, setFiredScenarios] = useState<
		{ id: string; postCount: number; withCache: number; withoutCache: number }[]
	>([]);
	const [lastScenario, setLastScenario] = useState<string | null>(null);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// Auto-scroll query log
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [visibleQueryIndex, queryLog]);

	// Cleanup animation on unmount
	useEffect(() => {
		return () => {
			if (animationRef.current) clearInterval(animationRef.current);
		};
	}, []);

	// ── Observe phase: fire probe ──
	const handleFireProbe = useCallback(
		(probeId: string) => {
			if (isAnimating) return;
			const probe = WATERFALL_PROBES.find((p) => p.id === probeId);
			if (!probe) return;

			setActiveProbe(probeId);
			setFiredProbes((prev) => new Set([...prev, probeId]));

			const lines = generateQueryLog(probe.postCount);
			setQueryLog(lines);
			setVisibleQueryIndex(0);
			setQueryCount(0);
			setIsAnimating(true);

			let idx = 0;
			const iv = setInterval(() => {
				if (idx >= lines.length) {
					clearInterval(iv);
					setIsAnimating(false);
					// Trigger discoveries after animation completes
					for (const did of probe.discoveryIds) {
						discoveryGating.discover(did);
					}
					return;
				}
				idx++;
				setVisibleQueryIndex(idx);
				setQueryCount(idx);
			}, 30);
			animationRef.current = iv as unknown as number;
		},
		[isAnimating, discoveryGating],
	);

	// ── Build phase: OptionCard handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Reward phase: fire scale scenario ──
	const handleFireScenario = useCallback((scenarioId: string) => {
		const scenario = SCALE_SCENARIOS.find((s) => s.id === scenarioId);
		if (!scenario) return;

		setLastScenario(scenarioId);
		setFiredScenarios((prev) => [
			...prev.slice(-9),
			{
				id: scenarioId,
				postCount: scenario.postCount,
				withoutCache: scenario.postCount + 1,
				withCache: 1,
			},
		]);
	}, []);

	// ── Phase transitions ──
	const handleStartBuild = () => setPhase('build');
	const handleActivateReward = () => setPhase('reward');

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all build steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Counter cache eliminates N COUNT queries!' };
	};

	// ── Reward stats ──
	const totalSavedQueries = useMemo(
		() =>
			firedScenarios.reduce(
				(sum, s) => sum + (s.withoutCache - s.withCache),
				0,
			),
		[firedScenarios],
	);

	const lastResult = firedScenarios[firedScenarios.length - 1] ?? null;

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig =
		OPTION_STEP_CONFIG[stepper.currentStep] ?? null;
	const isTerminalStep = stepper.currentStep === 0;

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The posts index shows comment counts.{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								post.comments.count
							</code>{' '}
							fires a separate COUNT(*) query for every post.
							100 posts = 101 queries.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{phase === 'observe'
								? 'Fire requests at different scales to see the query explosion grow linearly.'
								: phase === 'build'
									? 'Add a counter cache column so Rails tracks the count automatically.'
									: phase === 'reward'
										? 'Fire requests at different scales. The counter cache keeps it at 1 query.'
										: 'Your counter cache is ready. See it handle any scale.'}
						</p>
					</div>

					{/* Observe: Discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build: Step progress */}
					{(phase === 'build' || phase === 'activate') && (
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
					)}

					{/* Observe: Query stats */}
					{phase === 'observe' && activeProbe && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Query Stats
							</div>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Database className="w-4 h-4" />
										<span>Queries</span>
									</div>
									<span
										className={`text-sm font-bold tabular-nums ${queryCount > 2 ? 'text-destructive' : 'text-muted-foreground'}`}
									>
										{queryCount}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Timer className="w-4 h-4" />
										<span>Estimated</span>
									</div>
									<span
										className={`text-sm font-bold tabular-nums ${queryCount > 2 ? 'text-destructive' : 'text-muted-foreground'}`}
									>
										{(queryCount * 0.4).toFixed(1)}ms
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Reward: Counters */}
					{phase === 'reward' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Performance
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-success/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										Scenarios fired
									</div>
									<div className="text-2xl font-bold text-success tabular-nums">
										{firedScenarios.length}
									</div>
								</div>
								<div className="bg-success/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										Queries saved
									</div>
									<div className="text-2xl font-bold text-success tabular-nums">
										{totalSavedQueries}
									</div>
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
					levelNumber={27}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Query Waterfall: GET /api/posts
								</div>
								<span className="text-xs font-mono text-destructive font-bold">
									N+1 COUNT(*) explosion
								</span>
							</div>

							{/* Probe buttons */}
							<div className="px-6 py-3">
								<div className="flex gap-2">
									{WATERFALL_PROBES.map((probe) => {
										const fired = firedProbes.has(probe.id);
										return (
											<Button
												className="gap-2 flex-1"
												disabled={
													isAnimating ||
													(fired &&
														activeProbe !== probe.id)
												}
												key={probe.id}
												onClick={() =>
													handleFireProbe(probe.id)
												}
												size="sm"
												variant={
													fired ? 'secondary' : 'outline'
												}
											>
												<Search className="w-3.5 h-3.5" />
												{probe.label}
											</Button>
										);
									})}
								</div>
							</div>

							{/* Query waterfall log */}
							<div className="px-6 flex-1 min-h-0">
								<div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden h-full flex flex-col">
									{/* Terminal header */}
									<div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
										<div className="flex gap-1.5">
											<div className="w-3 h-3 rounded-full bg-red-500" />
											<div className="w-3 h-3 rounded-full bg-yellow-500" />
											<div className="w-3 h-3 rounded-full bg-green-500" />
										</div>
										<Database className="w-3.5 h-3.5 text-zinc-400 ml-1" />
										<span className="text-xs text-zinc-400 font-mono">
											Database Log
										</span>
										{queryCount > 0 && (
											<span
												className={`text-xs font-mono ml-auto px-2 py-0.5 rounded ${
													queryCount > 2
														? 'bg-red-500/20 text-red-400'
														: 'text-zinc-500'
												}`}
											>
												{queryCount}{' '}
												{queryCount === 1
													? 'query'
													: 'queries'}
											</span>
										)}
									</div>

									{/* Log body */}
									<div
										className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-0.5"
										ref={logRef}
									>
										{queryLog.length === 0 ? (
											<div className="text-zinc-500 text-center py-8">
												Fire a request to see the query
												waterfall...
											</div>
										) : (
											queryLog
												.slice(0, visibleQueryIndex)
												.map((line, i) => (
													<div
														className={
															line.includes('COUNT')
																? 'text-red-400/80'
																: 'text-emerald-400'
														}
														key={i}
													>
														{line}
													</div>
												))
										)}
									</div>
								</div>
							</div>

							{/* Build the Fix button (gated) */}
							<div className="p-4 flex justify-center">
								{discoveryGating.isUnlocked && (
									<Button
										className="gap-2 animate-in fade-in duration-500"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: Terminal step */}
								{isTerminalStep && (
									<TerminalChoiceStep
										commands={MIGRATION_COMMANDS}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												You need a{' '}
												<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
													comments_count
												</code>{' '}
												integer column on the posts
												table. Generate the migration.
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() =>
											stepper.completeStep()
										}
										onNext={stepper.nextStep}
										onWrong={(fb) =>
											stepper.recordWrongAttempt(fb)
										}
										outputLines={MIGRATION_OUTPUT}
										stepKey={stepper.currentStep}
										title="Generate the Migration"
									/>
								)}

								{/* Steps 1-3: OptionCard steps */}
								{!isTerminalStep && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{currentOptionConfig.options.map(
													(opt) => (
														<OptionCard
															color="violet"
															disabled={
																!opt.correct
															}
															key={opt.id}
															mono
															name={opt.label}
															selected={
																opt.correct
															}
															size="lg"
														/>
													),
												)}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="violet"
																key={opt.id}
																mono
																name={
																	opt.label
																}
																onClick={() =>
																	handleOptionClick(
																		opt,
																	)
																}
																size="lg"
															/>
														),
													)}
												</div>

												<ErrorFeedback
													message={
														stepper.lastFeedback
													}
													onDismiss={
														stepper.clearFeedback
													}
												/>
											</>
										)}

										{isViewingCompletedStep &&
											hasNextStep && (
												<div className="flex justify-end">
													<Button
														className="gap-2"
														onClick={
															stepper.nextStep
														}
														size="sm"
													>
														Next Step
														<ArrowRight className="w-4 h-4" />
													</Button>
												</div>
											)}
									</>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Activate ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Counter cache is configured. Rails will
									auto-increment and auto-decrement
									comments_count on create and destroy. See
									it handle any scale.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateReward}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Counter Cache
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Scale Test: Counter Cache vs COUNT(*)
								</div>
								<div className="flex items-center gap-2">
									<TrendingDown className="w-4 h-4 text-success" />
									<span className="text-xs font-mono text-success font-bold">
										Always 1 query
									</span>
								</div>
							</div>

							{/* Scenario buttons */}
							<div className="px-6 py-3">
								<div className="text-xs text-muted-foreground mb-2">
									Fire requests at different scales:
								</div>
								<div className="flex gap-2 flex-wrap">
									{SCALE_SCENARIOS.map((scenario) => (
										<Button
											className="gap-2"
											key={scenario.id}
											onClick={() =>
												handleFireScenario(
													scenario.id,
												)
											}
											size="sm"
											variant={
												lastScenario === scenario.id
													? 'default'
													: 'outline'
											}
										>
											<Database className="w-3.5 h-3.5" />
											{scenario.label}
										</Button>
									))}
								</div>
							</div>

							{/* Before/After comparison panel */}
							<div className="px-6 flex-1 min-h-0 pb-4">
								{lastResult ? (
									<div className="space-y-4">
										{/* Comparison grid */}
										<div className="grid grid-cols-2 gap-4">
											{/* Without counter cache */}
											<div className="rounded-lg border border-destructive/30 bg-zinc-900 overflow-hidden">
												<div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20">
													<Database className="w-3.5 h-3.5 text-red-400" />
													<span className="text-xs text-red-400 font-mono font-bold">
														Without Counter Cache
													</span>
												</div>
												<div className="p-4 text-center">
													<div className="text-4xl font-bold text-red-400 tabular-nums">
														{lastResult.withoutCache}
													</div>
													<div className="text-xs text-zinc-500 mt-1">
														queries
													</div>
													<div className="text-xs text-zinc-500 mt-2 font-mono">
														1 + {lastResult.postCount}{' '}
														COUNT(*)
													</div>
													<div className="text-sm text-red-400 font-mono mt-2">
														~
														{(
															lastResult.withoutCache *
															0.4
														).toFixed(0)}
														ms
													</div>
												</div>
											</div>

											{/* With counter cache */}
											<div className="rounded-lg border border-success/30 bg-zinc-900 overflow-hidden">
												<div className="flex items-center gap-2 px-3 py-2 bg-success/10 border-b border-success/20">
													<Zap className="w-3.5 h-3.5 text-emerald-400" />
													<span className="text-xs text-emerald-400 font-mono font-bold">
														With Counter Cache
													</span>
												</div>
												<div className="p-4 text-center">
													<div className="text-4xl font-bold text-emerald-400 tabular-nums">
														{lastResult.withCache}
													</div>
													<div className="text-xs text-zinc-500 mt-1">
														query
													</div>
													<div className="text-xs text-zinc-500 mt-2 font-mono">
														Just SELECT posts.*
													</div>
													<div className="text-sm text-emerald-400 font-mono mt-2">
														~1.2ms
													</div>
												</div>
											</div>
										</div>

										{/* Reduction stat */}
										<div className="rounded-lg border border-border bg-card p-4 text-center">
											<div className="flex items-center justify-center gap-3">
												<div className="text-sm text-muted-foreground">
													Query reduction:
												</div>
												<div className="text-2xl font-bold text-success">
													{Math.round(
														((lastResult.withoutCache -
															lastResult.withCache) /
															lastResult.withoutCache) *
															100,
													)}
													%
												</div>
												<div className="text-sm text-muted-foreground">
													({lastResult.withoutCache -
														lastResult.withCache}{' '}
													fewer queries)
												</div>
											</div>
										</div>

										{/* Results log */}
										<div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
											<div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
												<div className="flex gap-1.5">
													<div className="w-3 h-3 rounded-full bg-red-500" />
													<div className="w-3 h-3 rounded-full bg-yellow-500" />
													<div className="w-3 h-3 rounded-full bg-green-500" />
												</div>
												<TrendingDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
												<span className="text-xs text-zinc-400 font-mono">
													Scale Results
												</span>
											</div>
											<div className="p-3 font-mono text-xs max-h-36 overflow-y-auto space-y-1">
												{firedScenarios.map(
													(result, i) => (
														<div
															className="flex items-center gap-3"
															key={i}
														>
															<span className="text-zinc-500">
																GET /api/posts?limit=
																{
																	result.postCount
																}
															</span>
															<span className="text-red-400">
																{
																	result.withoutCache
																}
																q
															</span>
															<span className="text-zinc-600">
																{'->'}
															</span>
															<span className="text-emerald-400">
																{result.withCache}
																q
															</span>
															<span className="text-emerald-400/60">
																(-
																{result.withoutCache -
																	result.withCache}
																)
															</span>
														</div>
													),
												)}
											</div>
										</div>
									</div>
								) : (
									<div className="flex items-center justify-center h-full">
										<div className="text-center space-y-3">
											<Database className="w-12 h-12 text-muted-foreground/30 mx-auto" />
											<p className="text-sm text-muted-foreground">
												Fire a scenario to compare
												query counts at different
												scales
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal={
						phase === 'observe'
							? 'Each post.comments.count fires a COUNT(*) query. With 100 posts, that is 101 total queries.'
							: 'counter_cache stores the count on the parent table. Rails auto-increments on create, auto-decrements on destroy.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<div className="space-y-3 text-xs">
							<div className="flex items-start gap-2">
								<Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
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
								<Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										.size vs .count vs .length
									</span>
									<div className="text-muted-foreground">
										.size reads the cache; .count always
										queries; .length loads all records
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
										Recalculate cached values for existing
										records after migration
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
							{`# Use a custom column name:
belongs_to :post,
  counter_cache: :total_comments

# Column must match on parent:
add_column :posts,
  :total_comments, :integer,
  default: 0, null: false`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level27CounterCaches;

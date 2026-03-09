/**
 * Level 24: Eager Loading
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration of N+1 queries.
 *   Click pipeline stages to inspect the lazy-loading flow, fire probes
 *   to see query counts explode. Discovery gating controls "Build the Fix".
 * Phase 2 (HOW - build): 3 OptionCard steps picking the right eager loading
 *   strategy for each scenario (basic includes, nested includes, eager_load).
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Optimization" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire query scenarios at the
 *   optimized pipeline and watch query counts stay low.
 *
 * Teaches: includes, preload, eager_load, nested eager loading
 */

import { ArrowRight, Check, Database, Play, Star, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'lazy-loading', label: 'Associations are lazy-loaded by default' },
	{ id: 'n1-basic', label: 'Post.all triggers 101 queries for 100 posts' },
	{ id: 'n1-nested', label: 'Nested associations multiply the problem' },
	{ id: 'no-eager', label: 'No eager loading configured anywhere' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'list-posts',
		label: 'GET /posts (100 posts)',
		command: 'GET /api/v1/posts (100 posts with authors)',
		responseLines: [
			{ text: 'SELECT * FROM posts', color: 'muted' },
			{ text: 'SELECT * FROM users WHERE id = 1  -- post #1', color: 'yellow' },
			{ text: 'SELECT * FROM users WHERE id = 2  -- post #2', color: 'yellow' },
			{ text: 'SELECT * FROM users WHERE id = 3  -- post #3', color: 'yellow' },
			{ text: '... (97 more individual queries)', color: 'red' },
			{ text: 'Total: 101 queries, 850ms', color: 'red' },
		],
	},
	{
		id: 'nested-load',
		label: 'GET /posts with comments',
		command: 'GET /api/v1/posts?include=comments.user (nested associations)',
		responseLines: [
			{ text: 'SELECT * FROM posts', color: 'muted' },
			{ text: 'SELECT * FROM comments WHERE post_id = 1', color: 'yellow' },
			{ text: 'SELECT * FROM users WHERE id = 5  -- comment author', color: 'yellow' },
			{ text: 'SELECT * FROM users WHERE id = 6  -- comment author', color: 'yellow' },
			{ text: '... (1000+ more queries for nested data)', color: 'red' },
			{ text: 'Total: 1,001 queries, 9.5s', color: 'red' },
		],
	},
	{
		id: 'filtered-tags',
		label: 'GET /posts?tag=active',
		command: 'GET /api/v1/posts?tag=active (filtering by association)',
		responseLines: [
			{ text: 'SELECT * FROM posts', color: 'muted' },
			{ text: 'SELECT * FROM tags WHERE post_id = 1', color: 'yellow' },
			{ text: 'SELECT * FROM tags WHERE post_id = 2', color: 'yellow' },
			{ text: '... then Ruby filters in memory (not SQL!)', color: 'red' },
			{ text: 'Total: 101 queries + in-memory filter', color: 'red' },
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'list-posts': 'n1-basic',
	'nested-load': 'n1-nested',
	'filtered-tags': 'no-eager',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ querySublabel: string; dbBadge: string }
> = {
	'list-posts': { querySublabel: '101 queries', dbBadge: '850ms!' },
	'nested-load': { querySublabel: '1001 queries', dbBadge: '9.5s!' },
	'filtered-tags': { querySublabel: '101 + filter', dbBadge: 'SLOW!' },
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	controller: {
		stageId: 'controller',
		title: 'PostsController#index',
		description:
			'The controller calls Post.all. This fires one SELECT for posts, but every time the view accesses post.author, Rails fires another SELECT. One per post.',
		code: `def index
  @posts = Post.all
  # No eager loading!
  # View calls post.author.name → N+1
end`,
	},
	model: {
		stageId: 'model',
		title: 'Post Model (Lazy Loading)',
		description:
			'belongs_to :author is lazy by default. Rails only queries the author when you first access it. For 100 posts, that means 100 separate author queries.',
		code: `class Post < ApplicationRecord
  belongs_to :author  # lazy-loaded
  has_many :comments
  has_many :tags
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database (Overloaded)',
		description:
			'The database receives 101 separate queries instead of 2. Each query has overhead: parsing, planning, network round-trip. Batching with IN() eliminates 99% of this overhead.',
	},
	serializer: {
		stageId: 'serializer',
		title: 'Serializer (Triggers N+1)',
		description:
			'The serializer accesses post.author.name for each post. This is where the N+1 actually fires: each access triggers a lazy load if the author is not already cached.',
		code: `class PostSerializer
  attributes :title, :author_name

  def author_name
    object.author.name  # Triggers lazy load!
  end
end`,
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	model: 'lazy-loading',
	controller: 'no-eager',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'basic-includes',
		label: 'Posts with authors (includes)',
		description: 'Load 100 posts with author names',
		method: 'GET',
		path: '/api/v1/posts',
		actor: 'includes(:author)',
		expectedResult: 'allowed',
	},
	{
		id: 'nested-includes',
		label: 'Posts with nested comments',
		description: 'Load posts with comments and their users',
		method: 'GET',
		path: '/api/v1/posts?include=comments',
		actor: 'includes(comments: :user)',
		expectedResult: 'allowed',
	},
	{
		id: 'filtered-eager',
		label: 'Filtered by active tags',
		description: 'Load posts filtered by association column',
		method: 'GET',
		path: '/api/v1/posts?tag=active',
		actor: 'eager_load(:tags)',
		expectedResult: 'allowed',
	},
	{
		id: 'no-eager-basic',
		label: 'Posts without eager loading',
		description: 'Forgot to add includes, N+1 detected',
		method: 'GET',
		path: '/api/v1/admin/posts',
		actor: 'Post.all (no includes)',
		expectedResult: 'blocked',
	},
	{
		id: 'joins-mistake',
		label: 'Using joins (common mistake)',
		description: 'joins does NOT load associations into memory',
		method: 'GET',
		path: '/api/v1/posts?admin=true',
		actor: 'Post.joins(:author)',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 steps: OptionCard choices)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'basic-includes', title: 'Fix Posts with Authors' },
	{ id: 'nested-includes', title: 'Fix Nested Associations' },
	{ id: 'conditional-eager', title: 'Fix Filtered Query' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Fix Posts with Authors',
		description:
			'Post.all triggers 101 queries for 100 posts. Each post.author.name fires a separate SELECT. Which method batches all author queries into one?',
		options: [
			{
				id: 'joins',
				label: 'Post.joins(:author)',
				correct: false,
				feedback:
					'joins creates an INNER JOIN but does NOT load author records into memory. You will still get N+1 when accessing post.author.',
			},
			{
				id: 'includes',
				label: 'Post.includes(:author)',
				correct: true,
			},
			{
				id: 'find-each',
				label: 'Post.find_each { |p| p.author }',
				correct: false,
				feedback:
					'find_each processes records in batches to save memory, but it still lazy-loads each author individually. The association query pattern does not change.',
			},
		],
	},
	1: {
		title: 'Fix Nested Associations',
		description:
			'Posts have comments, and each comment has a user. Loading post.comments.map(&:user) fires 1000+ queries. How do you eager-load both levels at once?',
		options: [
			{
				id: 'flat-includes',
				label: 'Post.includes(:comments)',
				correct: false,
				feedback:
					'That loads comments but not their users. You will still get N+1 on comment.user. The nested association needs to be specified.',
			},
			{
				id: 'separate',
				label: 'Post.includes(:comments).includes(:users)',
				correct: false,
				feedback:
					'Posts do not have a direct :users association. The users belong to comments, so you need to express that nesting in the includes call.',
			},
			{
				id: 'nested-includes',
				label: 'Post.includes(comments: :user)',
				correct: true,
			},
		],
	},
	2: {
		title: 'Fix Filtered Query',
		description:
			'You need posts WHERE tags.active = true. This filters by an association column. includes auto-switches to a JOIN here, but which method gives you explicit control and the best performance?',
		options: [
			{
				id: 'preload',
				label: 'Post.preload(:tags).where(tags: { active: true })',
				correct: false,
				feedback:
					'preload always uses separate queries, so it cannot apply a WHERE clause on the associated table. Rails will raise an error.',
			},
			{
				id: 'eager-load',
				label: 'Post.eager_load(:tags).where(tags: { active: true })',
				correct: true,
			},
			{
				id: 'includes-where',
				label: 'Post.includes(:tags).where(tags: { active: true })',
				correct: false,
				feedback:
					'includes works here (Rails auto-switches to JOIN), but it is implicit. When you filter on an association, being explicit about the JOIN strategy avoids surprises.',
			},
		],
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'serializer', dots: 'mixed' },
	{ from: 'serializer', to: 'database', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'controller', to: 'eager-load', dots: 'clean' },
	{ from: 'eager-load', to: 'database', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/posts_controller.rb',
			language: 'ruby',
			code: `class PostsController < ApplicationController
  def index
    @posts = Post.all  # No eager loading!
    render json: PostSerializer.new(@posts)
  end
end

# For 100 posts, this triggers:
# 1 query for posts
# + 100 queries for authors (one per post)
# = 101 queries total`,
			highlight: [3],
		});
		return files;
	}

	// Build / activate / reward phases
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/posts_controller.rb',
			language: 'ruby',
			code: `class PostsController < ApplicationController
  def index
    @posts = Post.all  # 101 queries!
    render json: PostSerializer.new(@posts)
  end
end`,
			highlight: [3],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/posts_controller.rb',
			language: 'ruby',
			code: furthestStep >= 3
				? `class PostsController < ApplicationController
  def index
    @posts = Post.includes(:author)
    # 2 queries instead of 101
    render json: PostSerializer.new(@posts)
  end

  def feed
    @posts = Post.includes(comments: :user)
    # 3 queries instead of 1001
    render json: FeedSerializer.new(@posts)
  end

  def tagged
    @posts = Post.eager_load(:tags)
                 .where(tags: { active: true })
    # 1 query with LEFT OUTER JOIN
    render json: PostSerializer.new(@posts)
  end
end`
				: furthestStep >= 2
					? `class PostsController < ApplicationController
  def index
    @posts = Post.includes(:author)
    # 2 queries instead of 101
    render json: PostSerializer.new(@posts)
  end

  def feed
    @posts = Post.includes(comments: :user)
    # 3 queries instead of 1001
    render json: FeedSerializer.new(@posts)
  end
end`
					: `class PostsController < ApplicationController
  def index
    @posts = Post.includes(:author)
    # 2 queries instead of 101
    render json: PostSerializer.new(@posts)
  end
end`,
			highlight: furthestStep >= 3 ? [3, 9, 16, 17] : furthestStep >= 2 ? [3, 9] : [3],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: `class Post < ApplicationRecord
  belongs_to :author, class_name: "User"
  has_many :comments
  has_many :tags

  # strict_loading catches forgotten eager loads
  # Raises error if you access a non-loaded association
  # self.strict_loading_by_default = true
end`,
			highlight: [2, 3, 4],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase)
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Query Status
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Optimized (eager loaded)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">N+1 detected (not eager loaded)</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level24EagerLoading({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] =
		useState<StageInspectorData | null>(null);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId
		? PROBE_PIPELINE_MAP[lastProbeId]
		: null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'controller',
				label: 'Controller',
				sublabel: 'Post.all',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Model',
				sublabel: probeDisplay ? probeDisplay.querySublabel : 'lazy load',
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'serializer',
				label: 'Serializer',
				sublabel: 'post.author.name',
				inspectable: true,
				inspected: inspectedStages.has('serializer'),
			},
			{
				id: 'database',
				label: 'Database',
				badge: probeDisplay ? probeDisplay.dbBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('database'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'controller', label: 'Controller' },
			{
				id: 'eager-load',
				label: 'Eager Load',
				sublabel: wasBlocked ? 'N+1 detected!' : 'includes/eager_load',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'N+1!' : undefined,
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: wasBlocked ? '101 queries' : '2 queries',
			},
		];
	}, [lastResult]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── OptionCard step handler ──
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

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateReward = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
	);

	// ── Completion ──
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
		return { valid: true, message: 'All queries optimized with eager loading!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Level 23 exposed the N+1 problem: Post.all fires 101 queries
							for 100 posts. Every post.author.name triggers a separate
							SELECT.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails provides three eager loading methods to fix this:
							<span className="text-foreground font-medium"> includes</span> (smart default),
							<span className="text-foreground font-medium"> preload</span> (separate queries), and
							<span className="text-foreground font-medium"> eager_load</span> (LEFT OUTER JOIN).
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build / activate phases: step progress */}
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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Optimized</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">N+1 Caught</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Eager Loading"
					levelNumber={24}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="Query Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														color="violet"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{currentOptionConfig.options.map((opt) => (
														<OptionCard
															color="violet"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
															size="lg"
														/>
													))}
												</div>

												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
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

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
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
									Your eager loading strategies are set. Stress-test the
									optimized queries and watch N+1 problems get caught.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateReward}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Optimization
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={stressTest.toggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal="includes is usually right. Use eager_load when filtering on associations. Use preload when you need separate queries."
				>
					{(phase === 'activate' || phase === 'reward') && (
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
										<span className="text-purple-400 dark:text-purple-300">eager_load</span>
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
										<span className="text-primary">Rails Scales!, Ch. 2</span> - Preloading Methods
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

export default Level24EagerLoading;

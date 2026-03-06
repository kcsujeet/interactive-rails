/**
 * Level 19: Query Objects
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Duplicated Query Chains" visualization.
 *   Three consumer zones (Admin Controller, API Controller, CSV Job) each
 *   containing identical inline query chain blocks. Player clicks each
 *   consumer to inspect the duplicated/divergent code, fires probes to
 *   see inconsistent behavior and maintenance burden.
 * Phase 2 (HOW - build): 3 OptionCard steps
 *   Step 0: Choose extraction pattern (PORO query object)
 *   Step 1: Define filter method pattern (return self for chaining)
 *   Step 2: Wire controller to query object (proper instantiation + chaining)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Queries" button
 * Phase 4 (ADVANTAGE - reward): Three-zone layout: all consumers delegate
 *   to shared PostQuery. Stress test fires filter combos showing clean reuse.
 *
 * Visualization approach: Custom zone layout (refactoring concept, duplicated code).
 * Three consumer zones with inline chains, not a PipelineFlow request chain.
 *
 * Teaches: Query objects, composable scopes, returning self for chaining,
 * reuse across controllers/jobs.
 */

import {
	ArrowRight,
	Check,
	Play,
	Search,
	Star,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ScenarioCards, type ScenarioConfig } from '@/components/levels/ScenarioCards';
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
// Consumer zones (each has duplicated query logic)
// ──────────────────────────────────────────────

interface ConsumerZone {
	id: string;
	name: string;
	lines: string;
	queryLines: string[];
}

const CONSUMERS: ConsumerZone[] = [
	{
		id: 'admin-controller',
		name: 'Admin Controller',
		lines: '60 lines',
		queryLines: [
			'.where.not(published_at: nil)',
			'.where(author_id: params[:author_id])',
			'.left_joins(:comments).group(:id)',
			'.having("COUNT(comments.id) >= ?"...)',
			'.joins(:tags).where(tags: ...)',
			'.order(published_at: :desc)',
		],
	},
	{
		id: 'api-controller',
		name: 'API Controller',
		lines: '45 lines',
		queryLines: [
			'.where.not(published_at: nil)',
			'.where(author_id: params[:author_id])',
			'.left_joins(:comments).group(:id)',
			'.having("COUNT(comments.id) >= ?"...)',
			'.joins(:tags).where(tags: ...)',
			'.order(published_at: :desc)',
		],
	},
	{
		id: 'csv-job',
		name: 'CSV Export Job',
		lines: '35 lines',
		queryLines: [
			'.where.not(published_at: nil)',
			'.where(author_id: author_id)',
			'.left_joins(:comments).group(:id)',
			'.having("COUNT(comments.id) >= ?"...)',
			'.joins(:tags).where(tags: ...)',
			'.order(published_at: :desc)',
		],
	},
];

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'fat-controller', label: '60-line controller action' },
	{ id: 'inline-chains', label: 'Inline query chains' },
	{ id: 'duplicated-logic', label: 'Duplicated across 3 files' },
	{ id: 'no-reuse', label: 'No reusable filters' },
];

// ──────────────────────────────────────────────
// Scenario configurations (observe phase)
// ──────────────────────────────────────────────

const SCENARIOS: ScenarioConfig[] = [
	{
		id: 'add-filter',
		title: 'Add a created_at date filter',
		consequence: 'Must update the same query chain in 3 separate files. Miss one and results diverge.',
	},
	{
		id: 'csv-bug',
		title: 'QA reports CSV export has wrong data',
		consequence: 'The CSV job has a subtle bug: uses > instead of >=. Three copies, three chances for bugs.',
	},
	{
		id: 'unit-test',
		title: 'Write a unit test for tag filtering',
		consequence: 'Query logic is inline in controllers. No standalone object to test independently.',
	},
];

// Map scenario IDs to discovery IDs they trigger
const SCENARIO_DISCOVERY_MAP: Record<string, string> = {
	'add-filter': 'inline-chains',
	'csv-bug': 'duplicated-logic',
	'unit-test': 'no-reuse',
};

// Flow messages per scenario: [admin, api, csv]
const OBSERVE_FLOW: Record<string, [string, string, string]> = {
	'add-filter': [
		'Add filter here (60 lines)',
		'Add filter here too (45 lines)',
		'And here (35 lines)',
	],
	'csv-bug': [
		'.where("published_at >= ?"...)',
		'.where("published_at >= ?"...)',
		'.where("published_at > ?"...) BUG!',
	],
	'unit-test': [
		'Inline in controller, untestable',
		'Inline in controller, untestable',
		'Inline in job, untestable',
	],
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	'admin-controller': {
		stageId: 'admin-controller',
		title: 'Admin::PostsController (60 lines!)',
		description:
			'The index action has 60 lines of inline .where().joins().group().order() chains. Every filter combination is built manually with if/end blocks.',
		code: `def index
  @posts = Post.all

  if params[:published].present?
    @posts = @posts.where.not(published_at: nil)
  end

  if params[:author_id].present?
    @posts = @posts.where(author_id: params[:author_id])
  end

  if params[:min_comments].present?
    @posts = @posts.left_joins(:comments)
      .group(:id)
      .having("COUNT(comments.id) >= ?", params[:min_comments])
  end

  if params[:tag].present?
    @posts = @posts.joins(:tags)
      .where(tags: { name: params[:tag] })
  end

  @posts = @posts.order(published_at: :desc)
  render json: @posts
end`,
	},
	'api-controller': {
		stageId: 'api-controller',
		title: 'Api::V1::PostsController (45 lines)',
		description:
			'The API controller has its own copy of the same filtering logic. It was copy-pasted from the admin controller with minor tweaks for the public API.',
		code: `def index
  posts = Post.all

  # Same filtering logic, copy-pasted
  posts = posts.where.not(published_at: nil) if params[:published]
  posts = posts.where(author_id: params[:author_id]) if params[:author_id]
  posts = posts.joins(:tags).where(tags: { name: params[:tag] }) if params[:tag]
  posts = posts.order(published_at: :desc)

  render json: PostSerializer.new(posts)
end`,
	},
	'csv-job': {
		stageId: 'csv-job',
		title: 'CsvExportJob (35 lines)',
		description:
			'The background job has a third copy, but with a subtle bug: it uses ">" instead of ">=" for the date comparison. This inconsistency produces different results than the controllers.',
		code: `def perform(filters)
  posts = Post.all

  # Copy-pasted filtering with a BUG
  if filters[:published]
    posts = posts.where.not(published_at: nil)
  end

  if filters[:since]
    # BUG: uses > instead of >=
    posts = posts.where("published_at > ?", filters[:since])
  end

  posts.find_each { |post| write_csv_row(post) }
end`,
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	'admin-controller': 'fat-controller',
	'api-controller': 'duplicated-logic',
	'csv-job': 'no-reuse',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'published-only',
		label: 'Published posts only',
		description: 'GET with published filter',
		method: 'GET',
		path: '/admin/posts?published=true',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'by-author',
		label: 'Filter by author',
		description: 'GET with author_id filter',
		method: 'GET',
		path: '/admin/posts?author_id=3',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'by-tag',
		label: 'Filter by tag',
		description: 'GET with tag filter via JOIN',
		method: 'GET',
		path: '/admin/posts?tag=rails',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'combined-filters',
		label: 'All filters combined',
		description: 'GET with every filter at once',
		method: 'GET',
		path: '/admin/posts?published=true&author_id=3&tag=rails',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'csv-export-reuse',
		label: 'CSV export (reuse)',
		description: 'Background job reuses PostQuery',
		method: 'JOB',
		path: 'CsvExportJob.perform_later(published: true)',
		actor: 'system',
		expectedResult: 'allowed',
	},
	{
		id: 'api-reuse',
		label: 'API controller (reuse)',
		description: 'Public API uses same PostQuery',
		method: 'GET',
		path: '/api/v1/posts?tag=ruby',
		actor: 'user',
		expectedResult: 'allowed',
	},
];

// Reward flow: [consumers, postQuery]
const REWARD_FLOW: Record<string, [string, string]> = {
	'published-only': ['Delegates to PostQuery', '.published(true).results'],
	'by-author': ['Delegates to PostQuery', '.by_author(3).results'],
	'by-tag': ['Delegates to PostQuery', '.by_tag("rails").results'],
	'combined-filters': ['Delegates to PostQuery', '.published(true).by_author(3).by_tag("rails").results'],
	'csv-export-reuse': ['Same PostQuery!', '.published(true).since(date).results'],
	'api-reuse': ['Same PostQuery!', '.by_tag("ruby").sorted.results'],
};

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'extraction-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'filter-method', title: 'Define Filter Method Pattern' },
	{ id: 'wire-controller', title: 'Wire Controller to Query Object' },
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

const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'model-scope',
		label: 'Add scopes to the Post model for each filter',
		correct: false,
		feedback:
			'Scopes work for single-purpose filters, but 6+ composable filters with JOINs and GROUP BY would bloat the model. A dedicated object composes better for multi-filter scenarios.',
	},
	{
		id: 'query-object',
		label: 'Extract into a PostQuery PORO in app/queries/',
		correct: true,
	},
	{
		id: 'controller-concern',
		label: 'Move the filters into a controller concern',
		correct: false,
		feedback:
			'A concern just moves the code to a different file. It is still tied to the controller and cannot be reused in background jobs or rake tasks.',
	},
	{
		id: 'raw-sql',
		label: 'Replace the chains with a single raw SQL query',
		correct: false,
		feedback:
			'Raw SQL loses composability. You cannot conditionally add or remove filters without string concatenation, which is error-prone and hard to test.',
	},
];

const FILTER_METHOD_OPTIONS: StepOption[] = [
	{
		id: 'return-array',
		label: 'Each method calls .to_a and returns an Array of records',
		correct: false,
		feedback:
			'Returning an Array breaks chaining, pagination, and eager loading. The next filter cannot add more WHERE clauses to a plain Array.',
	},
	{
		id: 'return-new-query',
		label: 'Each method returns a new PostQuery instance with a fresh scope',
		correct: false,
		feedback:
			'Creating a new instance on every call loses the accumulated scope from previous filters. The chain would only reflect the last filter applied.',
	},
	{
		id: 'return-self',
		label: 'Each method mutates @scope and returns self for chaining',
		correct: true,
	},
	{
		id: 'modify-in-place',
		label: 'Each method modifies @scope but returns nil',
		correct: false,
		feedback:
			'Returning nil breaks the chaining pattern. Callers could not write .by_author(3).by_tag("rails").results because the first call returns nil.',
	},
];

const WIRE_OPTIONS: StepOption[] = [
	{
		id: 'pass-params-hash',
		label: 'PostQuery.new(params).results',
		correct: false,
		feedback:
			'Passing the entire params hash to the query object couples it to the controller. Background jobs and rake tasks do not have a params object.',
	},
	{
		id: 'call-class-method',
		label: 'PostQuery.filter(params[:published], params[:author_id])',
		correct: false,
		feedback:
			'A single class method with positional arguments is not composable. Adding a new filter means changing the method signature everywhere it is called.',
	},
	{
		id: 'chain-methods',
		label: 'PostQuery.new.published(params[:published]).by_author(params[:author_id]).sorted.results',
		correct: true,
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Choose Extraction Pattern',
		description:
			'The admin controller has 60 lines of inline .where().joins().group() chains duplicated in three places. What is the best way to extract this query logic?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define Filter Method Pattern',
		description:
			'Each filter method (published, by_author, by_tag, with_min_comments) needs to be chainable so callers can combine any subset of filters. What should each method return?',
		options: FILTER_METHOD_OPTIONS,
	},
	2: {
		title: 'Wire Controller to Query Object',
		description:
			'The PostQuery object is ready with chainable filter methods. How should the controller use it to replace the 60-line inline chain?',
		options: WIRE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/admin/posts_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    @posts = Post.all

    if params[:published].present?
      @posts = @posts.where.not(published_at: nil)
    end

    if params[:author_id].present?
      @posts = @posts.where(author_id: params[:author_id])
    end

    if params[:since].present?
      @posts = @posts.where("published_at >= ?", params[:since])
    end

    if params[:min_comments].present?
      @posts = @posts.left_joins(:comments)
        .group(:id)
        .having("COUNT(comments.id) >= ?",
                params[:min_comments])
    end

    if params[:tag].present?
      @posts = @posts.joins(:tags)
        .where(tags: { name: params[:tag] })
    end

    @posts = @posts.order(published_at: :desc)

    render json: @posts
  end
end

# Same logic copy-pasted in:
# app/controllers/api/v1/posts_controller.rb
# app/jobs/csv_export_job.rb`,
			highlight: [5, 6, 9, 10, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26],
		});
		return files;
	}

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/admin/posts_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    @posts = Post.all

    if params[:published].present?
      @posts = @posts.where.not(published_at: nil)
    end

    if params[:author_id].present?
      @posts = @posts.where(author_id: params[:author_id])
    end

    if params[:min_comments].present?
      @posts = @posts.left_joins(:comments)
        .group(:id)
        .having("COUNT(comments.id) >= ?",
                params[:min_comments])
    end

    # ... 60 lines of inline query chains
    render json: @posts
  end
end

# Duplicated in 2 more files`,
			highlight: [5, 6, 9, 10, 13, 14, 15, 16, 17],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/queries/post_query.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class PostQuery < ApplicationQuery
  def published(flag)
    return self if flag.blank?

    @scope = @scope.where.not(published_at: nil)
    self
  end

  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end

  def since(date)
    return self if date.blank?

    @scope = @scope.where("published_at >= ?", date)
    self
  end

  def with_min_comments(count)
    return self if count.blank?

    @scope = @scope
      .left_joins(:comments)
      .group(:id)
      .having("COUNT(comments.id) >= ?", count)
    self
  end

  def by_tag(tag_name)
    return self if tag_name.blank?

    @scope = @scope.joins(:tags)
      .where(tags: { name: tag_name })
    self
  end

  def sorted(column = :published_at, dir = :desc)
    @scope = @scope.order(column => dir)
    self
  end

  private

  def default_scope
    Post.all
  end
end`
					: furthestStep >= 2
						? `class PostQuery < ApplicationQuery
  def published(flag)
    return self if flag.blank?

    @scope = @scope.where.not(published_at: nil)
    self  # returns self for chaining
  end

  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end

  # Each method: guard blank, mutate @scope, return self
  # ...more filter methods

  private

  def default_scope
    Post.all
  end
end`
						: `class PostQuery < ApplicationQuery
  # What pattern should each filter method follow?
  # How does chaining work?

  private

  def default_scope
    Post.all
  end
end`,
			highlight:
				furthestStep >= 3
					? [2, 6, 9, 14, 44, 49]
					: furthestStep >= 2
						? [5, 6, 7, 14, 15]
						: [2, 3],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/admin/posts_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    posts = PostQuery.new
      .published(params[:published])
      .by_author(params[:author_id])
      .since(params[:since])
      .with_min_comments(params[:min_comments])
      .by_tag(params[:tag])
      .sorted
      .results

    render json: posts
  end
end

# Reuse in API controller:
# PostQuery.new(Post.where.not(published_at: nil))
#   .by_tag(params[:tag]).sorted.results

# Reuse in background job:
# PostQuery.new.published(true).since(date).results`,
			highlight: [3, 4, 5, 6, 7, 8, 9, 10],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Legend (reward phase left panel)
// ──────────────────────────────────────────────

function QueryLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Architecture Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						PostQuery handles all filters (composable, reusable)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Inline chains removed from all consumers
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level19QueryObjects({ onComplete }: LevelComponentProps) {
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
	// ── Flow animation state (observe) ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<[string, string, string]>(['', '', '']);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: [string, string, string]) => {
			clearFlow();
			setFlowMessages(messages);
			setFlowPhase(0);
			const t1 = setTimeout(() => setFlowPhase(1), 800);
			const t2 = setTimeout(() => setFlowPhase(2), 1600);
			const t3 = setTimeout(() => setFlowPhase(-1), 3000);
			flowTimeoutsRef.current.push(t1, t2, t3);
		},
		[clearFlow],
	);

	useEffect(() => clearFlow, [clearFlow]);

	// ── Reward flow animation ──
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardFlowMessages, setRewardFlowMessages] = useState<[string, string]>(['', '']);
	const rewardFlowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearRewardFlow = useCallback(() => {
		for (const t of rewardFlowTimeoutsRef.current) clearTimeout(t);
		rewardFlowTimeoutsRef.current = [];
	}, []);

	const runRewardFlow = useCallback(
		(messages: [string, string]) => {
			clearRewardFlow();
			setRewardFlowMessages(messages);
			setRewardFlowPhase(0);
			const t1 = setTimeout(() => setRewardFlowPhase(1), 600);
			const t2 = setTimeout(() => setRewardFlowPhase(2), 1200);
			const t3 = setTimeout(() => setRewardFlowPhase(-1), 2400);
			rewardFlowTimeoutsRef.current.push(t1, t2, t3);
		},
		[clearRewardFlow],
	);

	useEffect(() => clearRewardFlow, [clearRewardFlow]);

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
			if (flowPhase !== -1) return;

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
		[phase, flowPhase, discoveryGating],
	);

	// ── Scenario handler ──
	const handleScenario = useCallback(
		(scenarioId: string) => {
			const discoveryId = SCENARIO_DISCOVERY_MAP[scenarioId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			const messages = OBSERVE_FLOW[scenarioId];
			if (messages) runFlow(messages);
		},
		[discoveryGating, runFlow],
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

	const handleStartBuild = () => setPhase('build');

	const handleActivateQueries = () => {
		setPhase('reward');
		stressTest.reset();
	};

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runRewardFlow(messages);
		},
		[stressTest, runRewardFlow],
	);

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
		return { valid: true, message: 'Query object extracts all inline chains!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The admin dashboard controller has a 60-line index action
							with inline{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								.where().joins().group().order()
							</code>{' '}
							chains. The same filtering logic is copy-pasted in the API
							controller and CSV export job.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Extract the query logic into a composable PostQuery object
							so every consumer shares one source of truth.
						</p>
					</div>

					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

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

					{phase === 'reward' && (
						<>
							<QueryLegend />
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Handled</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Query Objects"
					levelNumber={19}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							{/* Three consumer zones showing duplicated query logic */}
							<div className="flex-1 flex items-center justify-center px-6 relative">
								<div className="w-full max-w-3xl flex gap-3">
									{CONSUMERS.map((consumer, i) => {
										const isHighlighted = flowPhase === i;
										const flowMsg = flowMessages[i];
										const isInspected = inspectedStages.has(consumer.id);
										const isBuggy = flowMsg?.includes('BUG');

										return (
											<button
												key={consumer.id}
												type="button"
												className={`flex-1 border-2 rounded-lg p-3 text-left transition-all duration-300 cursor-pointer hover:ring-2 hover:ring-ring/30 ${
													isHighlighted
														? isBuggy
															? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
															: 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-destructive/30'
														: 'border-destructive/30 bg-card'
												} ${!isInspected && flowPhase === -1 ? 'ring-1 ring-primary/20' : ''}`}
												disabled={flowPhase !== -1}
												onClick={() => handleStageClick(consumer.id)}
											>
												<div className="flex items-center justify-between mb-2">
													<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
														{consumer.name}
													</span>
													{!isInspected && flowPhase === -1 && (
														<Search className="w-3.5 h-3.5 text-primary animate-pulse" />
													)}
												</div>
												<div className="text-xs font-mono text-destructive mb-2">
													{consumer.lines}
												</div>
												<div className="space-y-1">
													{consumer.queryLines.slice(0, 4).map((line) => (
														<div
															key={line}
															className="text-[10px] font-mono text-destructive/70 bg-destructive/5 dark:bg-destructive/10 rounded px-1.5 py-0.5 border border-destructive/15 truncate"
														>
															{line}
														</div>
													))}
													{consumer.queryLines.length > 4 && (
														<div className="text-[10px] text-muted-foreground">
															+{consumer.queryLines.length - 4} more chains...
														</div>
													)}
												</div>
												{flowMsg && flowPhase >= i && (
													<div
														className={`text-xs font-medium mt-2 ${
															isHighlighted ? 'animate-in fade-in duration-300' : 'opacity-70'
														} ${isBuggy ? 'text-destructive' : 'text-primary'}`}
													>
														{flowMsg}
													</div>
												)}
											</button>
										);
									})}
								</div>

								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							<div className="px-6 pb-2">
								<ScenarioCards
									scenarios={SCENARIOS}
									onSelect={handleScenario}
									disabled={flowPhase !== -1}
								/>
							</div>

							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button className="gap-2" onClick={handleStartBuild} size="lg">
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
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
										<Button className="gap-2" onClick={stepper.nextStep} size="sm">
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
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
									Your PostQuery object is ready. Watch it handle every
									filter combination cleanly, reused across controllers
									and background jobs.
								</p>
								<Button className="gap-2" onClick={handleActivateQueries} size="lg">
									<Play className="w-4 h-4" />
									Visualize Queries
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Consumer zones (clean) -> PostQuery */}
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-3">
								{/* Three consumer zones (now thin) */}
								<div className="w-full max-w-3xl flex gap-3">
									{CONSUMERS.map((consumer) => (
										<div
											key={consumer.id}
											className={`flex-1 border-2 rounded-lg p-3 transition-all duration-300 ${
												rewardFlowPhase === 0
													? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-success/50'
													: 'border-success/30 bg-success/5 dark:bg-success/10'
											}`}
										>
											<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
												{consumer.name}
											</div>
											<pre className="text-[10px] font-mono text-foreground">
												PostQuery.new.&lt;filters&gt;.results
											</pre>
											<div className="mt-1 text-xs text-success font-medium">
												3 lines
											</div>
										</div>
									))}
								</div>

								{/* Flow connectors */}
								<div className="flex gap-3 w-full max-w-3xl">
									{CONSUMERS.map((consumer) => (
										<div key={consumer.id} className="flex-1 flex justify-center">
											<FlowConnector
												active={rewardFlowPhase === 1}
												dotColor="bg-success"
											/>
										</div>
									))}
								</div>

								{/* PostQuery zone */}
								<div
									className={`w-full max-w-3xl border-2 rounded-lg p-4 text-center transition-all duration-300 ${
										rewardFlowPhase === 2
											? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/50 bg-success/5 dark:bg-success/10'
											: 'border-success/30 bg-success/5 dark:bg-success/10'
									}`}
								>
									<div className="flex items-center justify-center gap-2 mb-2">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											PostQuery
										</span>
										<span className="text-xs font-mono text-success font-bold">
											Chainable
										</span>
									</div>
									<div className="flex flex-wrap gap-1.5 justify-center">
										{['.published()', '.by_author()', '.by_tag()', '.with_min_comments()', '.since()', '.sorted()'].map((method) => (
											<div
												key={method}
												className="text-xs font-mono text-success/80 bg-success/5 dark:bg-success/10 rounded px-2 py-1 border border-success/20"
											>
												{method}
											</div>
										))}
									</div>
									{rewardFlowMessages[1] && rewardFlowPhase >= 2 && (
										<div
											className={`text-xs font-medium mt-2 text-success ${
												rewardFlowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'
											}`}
										>
											{rewardFlowMessages[1]}
										</div>
									)}
								</div>

								{/* Consumers message */}
								{rewardFlowMessages[0] && rewardFlowPhase >= 0 && (
									<div
										className={`text-xs font-medium text-primary ${
											rewardFlowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'
										}`}
									>
										{rewardFlowMessages[0]}
									</div>
								)}
							</div>

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
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level19QueryObjects;

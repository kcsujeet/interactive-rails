/**
 * Level 27: Counter Caches
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Query Cascade" visualization.
 *   Two-table layout: posts grid (left) + reviews table (right).
 *   Player fires probes and watches COUNT(*) queries cascade from each product
 *   block to the reviews table, one by one. The blocks turn red sequentially,
 *   showing the N+1 mechanism visually. ProbeTerminal sits below the
 *   visualization and drives it via onProbe callbacks.
 *
 * Phase 2 (HOW - build): 4 steps (1 terminal + 3 OptionCard)
 *   Step 0: Generate migration to add reviews_count column (terminal)
 *   Step 1: Add counter_cache: true to belongs_to (OptionCard)
 *   Step 2: Reset existing counters (OptionCard)
 *   Step 3: Update serializer to use .size (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same visualization, now showing the fix.
 *   Allowed: all blocks appear green instantly (counts embedded in posts.*).
 *   Blocked (.count bypasses): red cascade returns, showing the problem persists.
 *
 * Teaches: counter_cache: true, migration conventions, reset_counters, .size vs .count
 */

import { ArrowRight, Database, TrendingDown, Zap } from 'lucide-react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Visualization state types
// ──────────────────────────────────────────────

type VizMode = 'idle' | 'cascade' | 'cached';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const OBSERVE_POST_COUNT = 20;

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'n-plus-one-counts',
		label: 'Each post fires a separate COUNT(*) to the reviews table',
	},
];

// ──────────────────────────────────────────────
// Observe phase: probes + discovery mapping
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'load-posts',
		label: 'GET /api/posts',
		command: 'GET /api/posts?limit=20',
		responseLines: [
			{
				text: 'Product Load (1.2ms)  SELECT "products".* FROM "products" LIMIT 20',
				color: 'green',
			},
			{
				text: '  Loading review counts for 20 posts...',
				color: 'muted',
			},
			{
				text: '  (0.4ms)  SELECT COUNT(*) FROM "reviews" WHERE "product_id" = 1',
				color: 'red',
			},
			{
				text: '  (0.3ms)  SELECT COUNT(*) FROM "reviews" WHERE "product_id" = 2',
				color: 'red',
			},
			{
				text: '  ... 18 more COUNT(*) queries',
				color: 'red',
			},
			{
				text: '  Total: 21 queries for 20 posts',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'load-posts': ['n-plus-one-counts'],
};

// ──────────────────────────────────────────────
// Step definitions (build phase)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-migration', title: 'Generate the Migration' },
	{ id: 'run-migration', title: 'Run the Migration' },
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
		label:
			'rails generate migration AddReviewsCountToPosts reviews_count:integer',
		command:
			'rails generate migration AddReviewsCountToPosts reviews_count:integer',
		correct: true,
	},
	{
		id: 'add-index',
		label: 'rails generate migration AddIndexToReviews product_id:index',
		command: 'rails generate migration AddIndexToReviews product_id:index',
		correct: false,
		feedback:
			'An index on reviews.product_id helps query speed, but it does not eliminate the N+1 COUNT queries. You need a column on the parent table.',
	},
];

const MIGRATION_OUTPUT = [
	{ text: 'invoke  active_record', color: 'green' as const },
	{
		text: 'create    db/migrate/20240301_add_reviews_count_to_posts.rb',
		color: 'green' as const,
	},
];

// ──────────────────────────────────────────────
// Terminal step data (step 1: run migration)
// ──────────────────────────────────────────────

const RUN_MIGRATION_COMMANDS = [
	{
		id: 'generate-again',
		label: 'rails generate migration AddReviewsCountToPosts',
		command: 'rails generate migration AddReviewsCountToPosts',
		correct: false,
		feedback:
			'The migration file already exists. You need to apply it to the database.',
	},
	{
		id: 'run-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'db-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'This recreates the entire database from schema.rb. You just need to run the pending migration.',
	},
];

const RUN_MIGRATION_OUTPUT = [
	{
		text: '== AddReviewsCountToPosts: migrating ========',
		color: 'green' as const,
	},
	{
		text: '-- add_column(:posts, :reviews_count, :integer, default: 0)',
		color: 'green' as const,
	},
	{
		text: '== AddReviewsCountToPosts: migrated (0.0021s)',
		color: 'green' as const,
	},
];

// ──────────────────────────────────────────────
// OptionCard step data (steps 2-4)
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
		label: 'has_many :reviews, counter_cache: true',
		correct: false,
		feedback:
			'counter_cache is declared on the belongs_to side, not has_many. The child model owns the relationship declaration.',
	},
	{
		id: 'after-create',
		label:
			'after_create { Product.increment_counter(:reviews_count, product_id) }',
		correct: false,
		feedback:
			'Manual callbacks are error-prone. You would also need after_destroy, after_update, and handle edge cases. Rails provides a built-in option.',
	},
	{
		id: 'belongs-to-counter',
		label: 'belongs_to :product, counter_cache: true',
		correct: true,
	},
];

const RESET_OPTIONS: StepOption[] = [
	{
		id: 'update-all',
		label: 'Product.update_all(reviews_count: Product.joins(:reviews).count)',
		correct: false,
		feedback:
			'This sets every product to the same total count, not each product to its own count. Rails provides a method that recalculates per-record.',
	},
	{
		id: 'manual-each',
		label: 'Product.find_each { |p| p.update(reviews_count: p.reviews.count) }',
		correct: false,
		feedback:
			'This works but fires N+1 queries and skips the counter cache mechanism. Rails has a dedicated method that uses efficient SQL.',
	},
	{
		id: 'reset-counters',
		label: 'Product.find_each { |p| Product.reset_counters(p.id, :reviews) }',
		correct: true,
	},
];

const SERIALIZER_OPTIONS: StepOption[] = [
	{
		id: 'reviews-count-method',
		label: 'product.reviews.count',
		correct: false,
		feedback:
			'This always runs a COUNT(*) query, completely bypassing the counter cache column you just added.',
	},
	{
		id: 'reviews-length',
		label: 'product.reviews.length',
		correct: false,
		feedback:
			'This loads ALL review records into memory just to count them. Even worse than COUNT(*) for large collections.',
	},
	{
		id: 'reviews-size',
		label: 'product.reviews.size',
		correct: true,
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	2: {
		title: 'Enable counter_cache',
		description:
			'The column exists in the database. Now tell Rails to automatically increment and decrement it when reviews are created or destroyed. Where does this declaration go?',
		options: COUNTER_CACHE_OPTIONS,
	},
	3: {
		title: 'Reset Existing Counters',
		description:
			'The column exists but all values are 0. Existing products already have reviews. How do you sync the cached counts with the real data?',
		options: RESET_OPTIONS,
	},
	4: {
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
	{ commands: RUN_MIGRATION_COMMANDS, outputLines: RUN_MIGRATION_OUTPUT },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'ten-posts',
		label: '10 posts index',
		description: 'Small page load with counter cache',
		method: 'GET',
		path: '/api/posts?limit=10',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (1.2ms)  SELECT "products".* FROM "products" LIMIT 10',
				color: 'yellow',
			},
			{ text: '  reviews_count read from column (0 queries)', color: 'green' },
			{ text: '  Total: 1 query (was 11)', color: 'green' },
		],
	},
	{
		id: 'fifty-posts',
		label: '50 posts index',
		description: 'Medium listing with counter cache',
		method: 'GET',
		path: '/api/posts?limit=50',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (1.8ms)  SELECT "products".* FROM "products" LIMIT 50',
				color: 'yellow',
			},
			{ text: '  reviews_count read from column (0 queries)', color: 'green' },
			{ text: '  Total: 1 query (was 51)', color: 'green' },
		],
	},
	{
		id: 'hundred-posts',
		label: '100 posts index',
		description: 'Full page with counter cache',
		method: 'GET',
		path: '/api/posts?limit=100',
		actor: 'client',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (2.4ms)  SELECT "products".* FROM "products" LIMIT 100',
				color: 'yellow',
			},
			{ text: '  reviews_count read from column (0 queries)', color: 'green' },
			{ text: '  Total: 1 query (was 101)', color: 'green' },
		],
	},
	{
		id: 'five-hundred-posts',
		label: '500 posts export',
		description: 'Admin export with counter cache',
		method: 'GET',
		path: '/api/posts?limit=500',
		actor: 'admin',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Product Load (5.1ms)  SELECT "products".* FROM "products" LIMIT 500',
				color: 'yellow',
			},
			{ text: '  reviews_count read from column (0 queries)', color: 'green' },
			{ text: '  Total: 1 query (was 501)', color: 'green' },
		],
	},
	{
		id: 'force-count',
		label: '.count bypasses cache',
		description: 'Serializer still using .count instead of .size',
		method: 'GET',
		path: '/api/posts?limit=100&method=count',
		actor: 'client',
		expectedResult: 'blocked',
		responseLines: [
			{
				text: 'Product Load (2.4ms)  SELECT "products".* FROM "products" LIMIT 100',
				color: 'yellow',
			},
			{
				text: '  product.reviews.count -> 100 COUNT(*) queries!',
				color: 'red',
			},
			{
				text: '  .count ALWAYS runs SQL, ignoring the cached column',
				color: 'red',
			},
			{ text: '  Total: 101 queries (counter cache wasted)', color: 'red' },
		],
	},
];

// ──────────────────────────────────────────────
// Visualization helpers
// ──────────────────────────────────────────────

/** Deterministic review count per product for visual consistency */
function getReviewCount(i: number): number {
	return (i * 7 + 3) % 16;
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/post_list.rb',
				language: 'ruby',
				code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
			},
			{
				filename: 'app/serializers/product_serializer.rb',
				language: 'ruby',
				highlight: [4],
				code: `class ProductSerializer
  include JSONAPI::Serializer

  attribute :review_count do |product|
    product.reviews.count  # COUNT(*) every time!
  end
end`,
			},
			{
				filename: 'app/models/review.rb',
				language: 'ruby',
				code: `class Review < ApplicationRecord
  belongs_to :product
  belongs_to :user
end`,
			},
		];
	}

	// Build phase: code evolves with each step
	if (furthestStep === 0) {
		return [
			{
				filename: 'app/controllers/products_controller.rb',
				language: 'ruby',
				code: `class PostsController < ApplicationController
  def index
    result = PostList.call(params)
    render json: ProductSerializer.new(result.posts)
  end
end`,
			},
			{
				filename: 'app/serializers/product_serializer.rb',
				language: 'ruby',
				highlight: [4, 5],
				code: `class ProductSerializer
  include JSONAPI::Serializer

  attribute :review_count do |product|
    product.reviews.count  # N+1 COUNT(*)
  end
end

# Generate a migration to add
# the counter cache column to posts`,
			},
		];
	}

	if (furthestStep === 1) {
		return [
			{
				filename: 'app/services/post_list.rb',
				language: 'ruby',
				code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
			},
			{
				filename: 'db/migrate/add_reviews_count_to_posts.rb',
				language: 'ruby',
				highlight: [3, 4],
				code: `class AddReviewsCountToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :reviews_count,
               :integer, default: 0, null: false
  end
end

# Migration generated. Now apply it.`,
			},
		];
	}

	if (furthestStep === 2) {
		return [
			{
				filename: 'app/services/post_list.rb',
				language: 'ruby',
				code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
			},
			{
				filename: 'app/models/review.rb',
				language: 'ruby',
				highlight: [2],
				code: `class Review < ApplicationRecord
  belongs_to :product  # Where does counter_cache go?
  belongs_to :user
end`,
			},
		];
	}

	if (furthestStep === 3) {
		return [
			{
				filename: 'app/services/post_list.rb',
				language: 'ruby',
				code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
			},
			{
				filename: 'app/models/review.rb',
				language: 'ruby',
				highlight: [2],
				code: `class Review < ApplicationRecord
  belongs_to :product, counter_cache: true
  belongs_to :user
end

# Column defaults to 0, but existing products
# have real reviews. How to sync?`,
			},
		];
	}

	if (furthestStep === 4) {
		return [
			{
				filename: 'app/services/post_list.rb',
				language: 'ruby',
				code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
			},
			{
				filename: 'app/serializers/product_serializer.rb',
				language: 'ruby',
				highlight: [4, 5],
				code: `class ProductSerializer
  include JSONAPI::Serializer

  attribute :review_count do |product|
    product.reviews.count  # Still using .count!
  end
end

# .count always runs COUNT(*)
# Which method reads the cached column?`,
			},
		];
	}

	// All steps complete (reward)
	return [
		{
			filename: 'app/services/post_list.rb',
			language: 'ruby',
			code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call(params)
    contract = ListContract.new.call(params)
    return Result.new(false, [], contract.errors) unless contract.success?

    products = Product.includes(:user).limit(contract[:limit])
    Result.new(true, products, [])
  end
end`,
		},
		{
			filename: 'app/models/review.rb',
			language: 'ruby',
			highlight: [2],
			code: `class Review < ApplicationRecord
  belongs_to :product, counter_cache: true
  belongs_to :user
end`,
		},
		{
			filename: 'app/serializers/product_serializer.rb',
			language: 'ruby',
			highlight: [4],
			code: `class ProductSerializer
  include JSONAPI::Serializer

  attribute :review_count do |product|
    product.reviews.size  # Uses counter cache!
  end
end

# .size  -> reads products.reviews_count (0 queries)
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
		minRequired: 1,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');

	// ── Visualization state (shared between observe and reward) ──
	const [vizMode, setVizMode] = useState<VizMode>('idle');
	const [vizProductCount, setVizPostCount] = useState(0);
	const [cascadeProgress, setCascadeProgress] = useState(0);
	const [vizAnimating, setVizAnimating] = useState(false);
	const cascadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// ── Cascade animation helpers ──
	const clearCascadeTimers = useCallback(() => {
		for (const t of cascadeTimersRef.current) clearTimeout(t);
		cascadeTimersRef.current = [];
	}, []);

	const runCascade = useCallback(
		(postCount: number): number => {
			clearCascadeTimers();
			const displayCount = Math.min(postCount, 100);
			setVizMode('cascade');
			setVizPostCount(displayCount);
			setCascadeProgress(0);
			setVizAnimating(true);

			// Cascade spans one full ANIMATION_DURATION_MS, distributed across all blocks
			const startDelay = Math.round(ANIMATION_DURATION_MS * 0.25);
			const cascadeDuration = ANIMATION_DURATION_MS;
			const perBlockDelay = Math.round(cascadeDuration / displayCount);

			for (let i = 1; i <= displayCount; i++) {
				const timer = setTimeout(
					() => {
						setCascadeProgress(i);
					},
					startDelay + i * perBlockDelay,
				);
				cascadeTimersRef.current.push(timer);
			}

			// Total: start delay + cascade + settle
			const totalDuration =
				startDelay +
				displayCount * perBlockDelay +
				Math.round(ANIMATION_DURATION_MS * 0.25);
			const endTimer = setTimeout(() => {
				setVizAnimating(false);
			}, totalDuration);
			cascadeTimersRef.current.push(endTimer);

			return totalDuration;
		},
		[clearCascadeTimers],
	);

	const runCachedLoad = useCallback(
		(postCount: number) => {
			clearCascadeTimers();
			const displayCount = Math.min(postCount, 100);
			setVizMode('cached');
			setVizPostCount(displayCount);
			setCascadeProgress(displayCount);
			setVizAnimating(true);

			const timer = setTimeout(
				() => setVizAnimating(false),
				ANIMATION_DURATION_MS,
			);
			cascadeTimersRef.current.push(timer);
		},
		[clearCascadeTimers],
	);

	const resetVisualization = useCallback(() => {
		clearCascadeTimers();
		setVizMode('idle');
		setVizPostCount(0);
		setCascadeProgress(0);
		setVizAnimating(false);
	}, [clearCascadeTimers]);

	// Cleanup timers on unmount
	useEffect(() => {
		return () => clearCascadeTimers();
	}, [clearCascadeTimers]);

	// ── Observe phase: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			const duration = runCascade(OBSERVE_POST_COUNT);

			// Trigger discoveries after cascade completes
			setTimeout(() => {
				const discoveryIds = PROBE_DISCOVERY_MAP[probeId];
				if (discoveryIds) {
					for (const did of discoveryIds) {
						discoveryGating.discover(did);
					}
				}
			}, duration);
		},
		[discoveryGating, runCascade],
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

	// ── Reward phase: fire stress scenario ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			const postCount = Number.parseInt(
				scenario.path.match(/limit=(\d+)/)?.[1] ?? '100',
				10,
			);

			if (scenario.expectedResult === 'blocked') {
				runCascade(postCount);
			} else {
				runCachedLoad(postCount);
			}
		},
		[vizAnimating, stressTest, runCascade, runCachedLoad],
	);

	// ── Phase transitions ──
	const handleStartBuild = () => {
		resetVisualization();
		setPhase('build');
	};
	const handleStartReward = () => {
		resetVisualization();
		setPhase('reward');
		stressTest.reset();
	};

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
		return {
			valid: true,
			message: 'Counter cache eliminates N COUNT queries!',
		};
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep] ?? null;
	const isTerminalStep = stepper.currentStep === 0 || stepper.currentStep === 1;

	const lastResult =
		stressTest.results.length > 0
			? stressTest.results[stressTest.results.length - 1]
			: null;
	const lastScenario = lastResult
		? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
		: null;

	// ── Derived viz state ──
	const showCacheColumn = phase === 'reward';
	const isCascading = vizMode === 'cascade' && vizAnimating;
	const isCascadeDone = vizMode === 'cascade' && !vizAnimating;
	const isCached = vizMode === 'cached';

	// Product block grid data
	const productBlocks = useMemo(() => {
		return Array.from({ length: vizProductCount }, (_, i) => ({
			id: i,
			reviewCount: getReviewCount(i),
		}));
	}, [vizProductCount]);

	// ── Visualization render helper ──
	/** Column headers for the products table */
	const productColumns = showCacheColumn
		? ['id', 'title', 'user_id', 'reviews_count']
		: ['id', 'title', 'user_id'];

	const renderQueryCascade = () => (
		<div className="flex gap-3 items-stretch">
			{/* Posts table */}
			<div className="flex-1 rounded-lg border border-border overflow-hidden flex flex-col max-h-64">
				<div className="flex-1 min-h-0 overflow-auto">
					<table className="w-full text-xs font-mono">
						<thead className="sticky top-0 z-10">
							<tr className="bg-muted border-b border-border">
								{productColumns.map((col) => (
									<th
										className={cn(
											'px-2 py-1.5 text-left font-medium',
											col === 'reviews_count'
												? isCached
													? 'text-emerald-600 dark:text-emerald-400'
													: 'text-muted-foreground'
												: 'text-muted-foreground',
										)}
										key={col}
									>
										{col}
									</th>
								))}
							</tr>
						</thead>
						{vizProductCount === 0 ? (
							<tbody>
								<tr>
									<td
										className="text-muted-foreground text-center py-8"
										colSpan={productColumns.length}
									>
										Fire a probe to load posts...
									</td>
								</tr>
							</tbody>
						) : (
							<tbody>
								{productBlocks.map((block) => {
									const isCounted = block.id < cascadeProgress;
									const isCounting =
										block.id === cascadeProgress && isCascading;

									return (
										<tr
											className={cn(
												'border-b border-border/50 transition-colors duration-150',
												isCached
													? 'bg-emerald-50 dark:bg-emerald-950/30'
													: isCounting
														? 'bg-red-100 dark:bg-red-900/40'
														: isCounted
															? 'bg-red-50 dark:bg-red-950/20'
															: '',
											)}
											key={`post-${block.id}`}
										>
											<td className="px-2 py-1 text-muted-foreground">
												{block.id + 1}
											</td>
											<td className="px-2 py-1">Product #{block.id + 1}</td>
											<td className="px-2 py-1 text-muted-foreground">
												{(block.id % 5) + 1}
											</td>
											{showCacheColumn && (
												<td
													className={cn(
														'px-2 py-1 font-bold',
														isCached
															? 'text-emerald-600 dark:text-emerald-400'
															: 'text-muted-foreground',
													)}
												>
													{isCached ? block.reviewCount : ''}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						)}
					</table>
				</div>
			</div>

			{/* Arrow area with FlowConnector + query counter */}
			<div className="w-16 shrink-0 flex flex-col items-center justify-center gap-2">
				<FlowConnector
					active={isCascading}
					direction="horizontal"
					dotColor={
						isCascading
							? 'bg-destructive'
							: isCached
								? 'bg-success'
								: 'bg-muted-foreground'
					}
					dotCount={isCascading ? 3 : 1}
				/>
				{vizProductCount > 0 && (
					<div
						className={cn(
							'text-xs font-mono font-bold px-1.5 py-0.5 rounded tabular-nums',
							isCached
								? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
								: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
						)}
					>
						{isCached ? '0' : cascadeProgress}
						<span className="text-xs font-normal ml-0.5">
							{isCached ? 'queries' : 'COUNT'}
						</span>
					</div>
				)}
			</div>

			{/* Reviews table */}
			<div
				className={cn(
					'w-48 shrink-0 rounded-lg border overflow-hidden flex flex-col transition-colors',
					isCascading ? 'border-red-300 dark:border-red-600' : 'border-border',
				)}
			>
				<table className="w-full text-xs font-mono">
					<thead>
						<tr className="bg-muted border-b border-border">
							<th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
								id
							</th>
							<th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
								product_id
							</th>
							<th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
								body
							</th>
						</tr>
					</thead>
				</table>
				<div className="flex-1 flex flex-col items-center justify-center p-3 gap-1">
					{vizMode === 'idle' && (
						<span className="text-xs text-muted-foreground">
							Waiting for query...
						</span>
					)}
					{isCascading && (
						<div className="text-center space-y-1">
							<Database className="w-5 h-5 text-red-500 dark:text-red-400 animate-pulse mx-auto" />
							<div className="text-xs font-mono text-red-600 dark:text-red-400 font-bold">
								SELECT COUNT(*)
							</div>
							<div className="text-xs font-mono text-red-600 dark:text-red-400">
								WHERE product_id = {cascadeProgress + 1}
							</div>
							<div className="text-sm font-mono font-bold text-red-700 dark:text-red-300 mt-1">
								= {productBlocks[cascadeProgress]?.reviewCount ?? 0}
							</div>
						</div>
					)}
					{isCascadeDone && (
						<div className="text-center space-y-1">
							<Database className="w-5 h-5 text-destructive mx-auto" />
							<span className="text-xs text-destructive font-bold">
								{vizProductCount} COUNT(*)
							</span>
							<div className="text-xs text-muted-foreground">
								queries executed
							</div>
						</div>
					)}
					{isCached && (
						<div className="text-center space-y-1">
							<Database className="w-5 h-5 text-emerald-500 dark:text-emerald-400 mx-auto" />
							<span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
								Not queried
							</span>
							<div className="text-xs text-muted-foreground">
								counts read from products table
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The products index shows review counts.{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								product.reviews.count
							</code>{' '}
							fires a separate COUNT(*) query for every product. 100 posts = 101
							queries.
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
					{phase === 'build' && (
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

					{/* Reward: Counters */}
					{phase === 'reward' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Performance
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-success/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										Allowed
									</div>
									<div className="text-2xl font-bold text-success tabular-nums">
										{stressTest.allowedCount}
									</div>
								</div>
								<div className="bg-destructive/10 rounded-lg p-3 text-center">
									<div className="text-xs text-muted-foreground mb-1">
										Blocked
									</div>
									<div className="text-2xl font-bold text-destructive tabular-nums">
										{stressTest.blockedCount}
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
						<div className="flex-1 flex flex-col min-h-0">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Query Cascade: GET /api/posts
								</div>
								{vizMode !== 'idle' && (
									<span className="text-xs font-mono text-destructive font-bold tabular-nums">
										{cascadeProgress + 1} / {vizProductCount + 1} queries
									</span>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderQueryCascade()}</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
								<ProbeTerminal
									className="flex-1 flex flex-col"
									disabled={vizAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Database Log"
								/>
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
								{/* Steps 0-1: Terminal steps */}
								{isTerminalStep && (
									<TerminalChoiceStep
										commands={
											stepper.currentStep === 0
												? MIGRATION_COMMANDS
												: RUN_MIGRATION_COMMANDS
										}
										completed={isViewingCompletedStep}
										description={
											stepper.currentStep === 0 ? (
												<p className="text-sm text-muted-foreground">
													You need a{' '}
													<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
														reviews_count
													</code>{' '}
													integer column on the products table. Generate the
													migration.
												</p>
											) : (
												<p className="text-sm text-muted-foreground">
													The migration file is ready. Apply it to create the{' '}
													<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
														reviews_count
													</code>{' '}
													column in the database.
												</p>
											)
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={
											stepper.currentStep === 0
												? MIGRATION_OUTPUT
												: RUN_MIGRATION_OUTPUT
										}
										stepKey={stepper.currentStep}
										title={STEP_DEFS[stepper.currentStep].title}
									/>
								)}

								{/* Steps 2-4: OptionCard steps */}
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
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
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

										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={
														hasNextStep ? stepper.nextStep : handleStartReward
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

					{/* ── Phase 3: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col min-h-0">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Counter Cache Active
								</div>
								{vizMode !== 'idle' && (
									<div className="flex items-center gap-2">
										<TrendingDown
											className={cn(
												'w-4 h-4',
												isCached ? 'text-success' : 'text-destructive',
											)}
										/>
										<span
											className={cn(
												'text-xs font-mono font-bold',
												isCached ? 'text-success' : 'text-destructive',
											)}
										>
											{isCached
												? '1 query total'
												: `${vizProductCount + 1} queries (cache bypassed!)`}
										</span>
									</div>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderQueryCascade()}</div>

							{/* Before/after comparison */}
							{lastResult && lastScenario && (
								<div className="px-6 pb-2">
									<div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
										<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-center">
											<div className="text-xs text-muted-foreground">
												Without Cache
											</div>
											<div className="text-lg font-bold text-destructive tabular-nums">
												{Number.parseInt(
													lastScenario.path.match(/limit=(\d+)/)?.[1] ?? '100',
													10,
												) + 1}
											</div>
											<div className="text-xs text-muted-foreground">
												queries
											</div>
										</div>
										<div className="rounded-lg border border-success/30 bg-success/5 p-2 text-center">
											<div className="text-xs text-muted-foreground">
												With Cache
											</div>
											<div className="text-lg font-bold text-success tabular-nums">
												{lastScenario.expectedResult === 'blocked'
													? Number.parseInt(
															lastScenario.path.match(/limit=(\d+)/)?.[1] ??
																'100',
															10,
														) + 1
													: 1}
											</div>
											<div className="text-xs text-muted-foreground">
												{lastScenario.expectedResult === 'blocked'
													? 'queries (.count bypassed!)'
													: 'query'}
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Stress test controls */}
							<div className="px-6 pb-2 flex-1 min-h-0">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={() =>
										stressTest.toggleAutoFire(handleFireScenario)
									}
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
					learningGoal={
						phase === 'observe'
							? 'Each product.reviews.count fires a COUNT(*) query. With 100 posts, that is 101 total queries.'
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
										.size reads the cache; .count always queries; .length loads
										all records
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
										Recalculate cached values for existing records after
										migration
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
belongs_to :product,
  counter_cache: :total_reviews

# Column must match on parent:
add_column :products,
  :total_reviews, :integer,
  default: 0, null: false`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level27CounterCaches;

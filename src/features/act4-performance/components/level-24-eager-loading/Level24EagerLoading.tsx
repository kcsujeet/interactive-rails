/**
 * Level 24: Eager Loading
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): "SQL Timeline" visualization. 4 horizontal lanes
 *   (includes, preload, eager_load, joins) show the actual SQL query pattern
 *   each strategy generates. When a probe fires, all 4 lanes animate to reveal
 *   their query blocks. The `joins` lane floods with 100 tiny red blocks,
 *   making the N+1 trap visually obvious. Click lane labels to inspect each
 *   strategy's SQL pattern via StageInspector.
 * Phase 2 (HOW - build): 3 OptionCard steps picking the right eager loading
 *   strategy for each scenario (basic includes, nested includes, eager_load).
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire query scenarios and see a
 *   result lane showing the applied strategy with its query pattern.
 *
 * Teaches: includes, preload, eager_load, nested eager loading
 */

import { ArrowRight, Check, Info, X } from 'lucide-react';
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
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { cn } from '@/lib/utils';

registerLevelCode('act4-level24-eager-loading', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'joins-trap', label: 'joins does NOT prevent N+1' },
	{ id: 'nested-syntax', label: 'Nested associations need nested includes' },
	{
		id: 'filter-needs-join',
		label: 'Filtering by association requires a JOIN strategy',
	},
	{
		id: 'strategy-diff',
		label: 'Different scenarios need different strategies',
	},
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'basic-users',
		label: 'Load products with users',
		command: 'Product.all + product.user.name (basic N+1)',
		responseLines: [
			{
				text: 'Scenario: 100 products, each needs .user.name',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'includes(:user)   => 2 queries (SELECT products + SELECT users IN(...))',
				color: 'green',
			},
			{
				text: 'preload(:user)    => 2 queries (separate SELECTs)',
				color: 'green',
			},
			{
				text: 'eager_load(:user) => 1 query (LEFT OUTER JOIN)',
				color: 'green',
			},
			{
				text: 'joins(:user)      => 101 queries! (loads nothing into memory)',
				color: 'red',
			},
		],
		story: [
			'The product listing page needs to display each product with its author name.',
			'Four different eager loading strategies are tested against 100 products.',
			'includes, preload, and eager_load all solve the N+1 in different ways.',
			'joins looks like it should work, but it only filters. It loads nothing into memory.',
		],
	},
	{
		id: 'nested-reviews',
		label: 'Load products + reviews + users',
		command: 'Product.all + product.reviews.map(&:user) (nested N+1)',
		responseLines: [
			{
				text: 'Scenario: products -> reviews -> review authors (2 levels deep)',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'includes(reviews: :user) => 3 queries (products + reviews + users)',
				color: 'green',
			},
			{
				text: 'preload(reviews: :user)  => 3 queries (always separate)',
				color: 'green',
			},
			{
				text: 'eager_load(c: :user)      => 1 wide JOIN (high memory)',
				color: 'yellow',
			},
			{
				text: 'includes(:reviews) only  => N+1 on review.user!',
				color: 'red',
			},
		],
		story: [
			'The product detail page shows reviews with reviewer names (two levels deep).',
			'Nested eager loading requires the full chain: includes(reviews: :user).',
			'eager_load uses a single wide JOIN, which can spike memory on large datasets.',
			'Forgetting the nested :user triggers N+1 at the second level.',
		],
	},
	{
		id: 'filtered-assoc',
		label: 'Filter by association column',
		command: 'Product.where(tags: { active: true }) (filter on assoc)',
		responseLines: [
			{
				text: 'Scenario: filter products WHERE tags.active = true',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'eager_load(:tags).where(tags: { active: true }) => 1 JOIN query',
				color: 'green',
			},
			{
				text: 'includes(:tags).where(...)  => works (auto-switches to JOIN)',
				color: 'yellow',
			},
			{
				text: 'preload(:tags).where(...)   => ERROR! Cannot filter with separate queries',
				color: 'red',
			},
			{
				text: 'When filtering on associations, you need a JOIN strategy.',
				color: 'yellow',
			},
		],
		story: [
			'An admin filters products by active tags using a WHERE clause on the tags table.',
			'eager_load works because it uses a JOIN, making the tags columns available.',
			'includes auto-detects the WHERE clause and switches to JOIN mode.',
			'preload crashes because it runs separate queries and cannot filter across them.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'basic-users': 'joins-trap',
	'nested-reviews': 'nested-syntax',
	'filtered-assoc': 'filter-needs-join',
};

// ──────────────────────────────────────────────
// SQL Timeline lane data (observe phase)
// ──────────────────────────────────────────────

interface QueryBlock {
	label: string;
	color: 'green' | 'amber' | 'red';
	wide?: boolean;
}

interface StrategyLaneData {
	id: string;
	name: string;
	method: string;
	blocks: QueryBlock[];
	floodCount?: number;
	totalLabel: string;
	result: 'works' | 'fails' | 'suboptimal' | 'error';
}

const PROBE_LANES: Record<string, StrategyLaneData[]> = {
	'basic-users': [
		{
			id: 'includes',
			name: 'includes',
			method: 'Product.includes(:user)',
			blocks: [
				{ label: 'SELECT products', color: 'green' },
				{ label: 'SELECT users WHERE id IN(...)', color: 'green' },
			],
			totalLabel: '2 queries',
			result: 'works',
		},
		{
			id: 'preload',
			name: 'preload',
			method: 'Product.preload(:user)',
			blocks: [
				{ label: 'SELECT products', color: 'green' },
				{ label: 'SELECT users WHERE id IN(...)', color: 'green' },
			],
			totalLabel: '2 queries',
			result: 'works',
		},
		{
			id: 'eager_load',
			name: 'eager_load',
			method: 'Product.eager_load(:user)',
			blocks: [
				{
					label: 'SELECT products LEFT JOIN users',
					color: 'green',
					wide: true,
				},
			],
			totalLabel: '1 query',
			result: 'works',
		},
		{
			id: 'joins',
			name: 'joins',
			method: 'Product.joins(:user)',
			blocks: [{ label: 'SELECT products JOIN users', color: 'amber' }],
			floodCount: 100,
			totalLabel: '101 queries!',
			result: 'fails',
		},
	],
	'nested-reviews': [
		{
			id: 'includes',
			name: 'includes',
			method: 'Product.includes(reviews: :user)',
			blocks: [
				{ label: 'SELECT products', color: 'green' },
				{ label: 'SELECT reviews IN(...)', color: 'green' },
				{ label: 'SELECT users IN(...)', color: 'green' },
			],
			totalLabel: '3 queries',
			result: 'works',
		},
		{
			id: 'preload',
			name: 'preload',
			method: 'Product.preload(reviews: :user)',
			blocks: [
				{ label: 'SELECT products', color: 'green' },
				{ label: 'SELECT reviews IN(...)', color: 'green' },
				{ label: 'SELECT users IN(...)', color: 'green' },
			],
			totalLabel: '3 queries',
			result: 'works',
		},
		{
			id: 'eager_load',
			name: 'eager_load',
			method: 'Product.eager_load(reviews: :user)',
			blocks: [
				{
					label: 'SELECT products LEFT JOIN reviews, users',
					color: 'amber',
					wide: true,
				},
			],
			totalLabel: '1 query (wide JOIN)',
			result: 'suboptimal',
		},
		{
			id: 'joins',
			name: 'joins',
			method: 'Product.joins(:reviews)',
			blocks: [{ label: 'SELECT products JOIN reviews', color: 'amber' }],
			floodCount: 100,
			totalLabel: '100+ queries!',
			result: 'fails',
		},
	],
	'filtered-assoc': [
		{
			id: 'includes',
			name: 'includes',
			method: 'Product.includes(:tags).where(...)',
			blocks: [
				{
					label: 'SELECT products LEFT JOIN tags WHERE active',
					color: 'amber',
					wide: true,
				},
			],
			totalLabel: '1 query (auto-JOIN)',
			result: 'suboptimal',
		},
		{
			id: 'preload',
			name: 'preload',
			method: 'Product.preload(:tags).where(...)',
			blocks: [
				{
					label: 'ERROR! Cannot filter with separate queries',
					color: 'red',
					wide: true,
				},
			],
			totalLabel: 'ERROR',
			result: 'error',
		},
		{
			id: 'eager_load',
			name: 'eager_load',
			method: 'Product.eager_load(:tags).where(...)',
			blocks: [
				{
					label: 'SELECT products LEFT JOIN tags WHERE active',
					color: 'green',
					wide: true,
				},
			],
			totalLabel: '1 query (JOIN)',
			result: 'works',
		},
		{
			id: 'joins',
			name: 'joins',
			method: 'Product.joins(:tags).where(...)',
			blocks: [
				{ label: 'SELECT products JOIN tags WHERE active', color: 'amber' },
			],
			floodCount: 50,
			totalLabel: '51+ queries!',
			result: 'fails',
		},
	],
};

// ──────────────────────────────────────────────
// Stage inspector data (lane label click)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	includes: {
		stageId: 'includes',
		title: 'includes (Smart Default)',
		description:
			'Rails decides the best strategy: 2 separate queries (IN clause) when no filtering, or LEFT OUTER JOIN when you chain .where on the association. This is the recommended default for most cases.',
		code: `# In your service object:
class ProductList < ApplicationService
  def call
    products = Product.includes(:user)
    # Query 1: SELECT "products".* FROM "products"
    # Query 2: SELECT "users".* FROM "users"
    #           WHERE "users"."id" IN (1, 2, 3...)
    Result.new(success?: true, products: products, errors: [])
  end
end

# With filtering (auto-switches to JOIN):
Product.includes(:user).where(users: { role: 'admin' })
# SELECT "products".* LEFT OUTER JOIN "users" ...`,
	},
	preload: {
		stageId: 'preload',
		title: 'preload (Force Separate Queries)',
		description:
			'Always runs 2 separate queries. Uses less memory than eager_load (148K objects vs 250K). Cannot filter by the associated table. Best when you just need the data without conditions.',
		code: `# In your service object:
class ProductList < ApplicationService
  def call
    products = Product.preload(:user)
    # Always 2 separate queries:
    # Query 1: SELECT "products".* FROM "products"
    # Query 2: SELECT "users".* FROM "users"
    #           WHERE "users"."id" IN (1, 2, 3...)
    Result.new(success?: true, products: products, errors: [])
  end
end

# ERROR if you try to filter:
Product.preload(:user).where(users: { active: true })
# => ActiveRecord::StatementInvalid`,
	},
	eager_load: {
		stageId: 'eager_load',
		title: 'eager_load (Force JOIN)',
		description:
			'Always uses LEFT OUTER JOIN in a single query. Required when you need to filter or sort by association columns. Uses more memory because the JOIN returns wider result rows.',
		code: `# In your service object:
class ProductList < ApplicationService
  def call(filters: {})
    products = Product.eager_load(:tags)
                .where(tags: { active: filters[:tag_active] })
    # Single query with LEFT OUTER JOIN:
    # SELECT "products".*, "tags".*
    #   FROM "products"
    #   LEFT OUTER JOIN "tags"
    #     ON "tags"."product_id" = "products"."id"
    #   WHERE "tags"."active" = true
    Result.new(success?: true, products: products, errors: [])
  end
end`,
	},
	joins: {
		stageId: 'joins',
		title: 'joins (NOT for N+1 prevention!)',
		description:
			'INNER JOINs the table but does NOT load association records into memory. Accessing product.user after joins still triggers a lazy load. This is the most common mistake when trying to fix N+1 queries.',
		code: `# Common mistake in a service:
class ProductList < ApplicationService
  def call
    products = Product.joins(:user)
                .where(users: { role: 'admin' })
    # SQL: SELECT "products".* FROM "products"
    #   INNER JOIN "users" ON ...
    #   WHERE "users"."role" = 'admin'

    # BUT: user data is NOT loaded!
    # products.each { |p| p.user.name }
    # => N+1! Each .user triggers a SELECT
    Result.new(success?: true, products: products, errors: [])
  end
end`,
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	joins: 'joins-trap',
	includes: 'strategy-diff',
	preload: 'strategy-diff',
	eager_load: 'strategy-diff',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'basic-includes',
		label: 'Products with users (includes)',
		description: 'Load 100 products with user names',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'includes(:user)',
		expectedResult: 'allowed',
	},
	{
		id: 'nested-includes',
		label: 'Products with nested reviews',
		description: 'Load products with reviews and their users',
		method: 'GET',
		path: '/api/v1/products?include=reviews',
		actor: 'includes(reviews: :user)',
		expectedResult: 'allowed',
	},
	{
		id: 'filtered-eager',
		label: 'Filtered by active tags',
		description: 'Load products filtered by association column',
		method: 'GET',
		path: '/api/v1/products?tag=active',
		actor: 'eager_load(:tags)',
		expectedResult: 'allowed',
	},
	{
		id: 'no-eager-basic',
		label: 'Products without eager loading',
		description: 'Forgot to add includes, N+1 detected',
		method: 'GET',
		path: '/api/v1/admin/products',
		actor: 'Product.all (no includes)',
		expectedResult: 'blocked',
	},
	{
		id: 'joins-mistake',
		label: 'Using joins (common mistake)',
		description: 'joins does NOT load associations into memory',
		method: 'GET',
		path: '/api/v1/products?admin=true',
		actor: 'Product.joins(:user)',
		expectedResult: 'blocked',
	},
];

// Reward phase: result lane data per stress scenario
const REWARD_LANE_DATA: Record<
	string,
	{
		strategy: string;
		blocks: QueryBlock[];
		floodCount?: number;
		totalLabel: string;
		result: 'works' | 'fails';
	}
> = {
	'basic-includes': {
		strategy: 'includes(:user)',
		blocks: [
			{ label: 'SELECT products', color: 'green' },
			{ label: 'SELECT users WHERE id IN(...)', color: 'green' },
		],
		totalLabel: '2 queries',
		result: 'works',
	},
	'nested-includes': {
		strategy: 'includes(reviews: :user)',
		blocks: [
			{ label: 'SELECT products', color: 'green' },
			{ label: 'SELECT reviews IN(...)', color: 'green' },
			{ label: 'SELECT users IN(...)', color: 'green' },
		],
		totalLabel: '3 queries',
		result: 'works',
	},
	'filtered-eager': {
		strategy: 'eager_load(:tags).where(...)',
		blocks: [
			{
				label: 'SELECT products LEFT JOIN tags WHERE active',
				color: 'green',
				wide: true,
			},
		],
		totalLabel: '1 query (JOIN)',
		result: 'works',
	},
	'no-eager-basic': {
		strategy: 'Product.all (no includes)',
		blocks: [{ label: 'SELECT products', color: 'amber' }],
		floodCount: 100,
		totalLabel: '101 queries!',
		result: 'fails',
	},
	'joins-mistake': {
		strategy: 'Product.joins(:user)',
		blocks: [{ label: 'SELECT products JOIN users', color: 'amber' }],
		floodCount: 100,
		totalLabel: '101 queries!',
		result: 'fails',
	},
};

// ──────────────────────────────────────────────
// Step definitions (3 steps: OptionCard choices)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'basic-includes', title: 'Fix Products with Users' },
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
		title: 'Fix Products with Users',
		description:
			'ProductList service calls Product.all, triggering 101 queries for 100 products. Each product.user.name fires a separate SELECT. Which method should the service use to batch all user queries into one?',
		options: [
			{
				id: 'joins',
				label: 'Product.joins(:user)',
				correct: false,
				feedback:
					'joins creates an INNER JOIN but does NOT load user records into memory. You will still get N+1 when accessing product.user.',
			},
			{
				id: 'includes',
				label: 'Product.includes(:user)',
				correct: true,
			},
			{
				id: 'find-each',
				label: 'Product.find_each { |p| p.user }',
				correct: false,
				feedback:
					'find_each processes records in batches to save memory, but it still lazy-loads each user individually. The association query pattern does not change.',
			},
		],
	},
	1: {
		title: 'Fix Nested Associations',
		description:
			'Products have reviews, and each review has a user. The service loading product.reviews.map(&:user) fires 1000+ queries. Which call should the service use to eager-load both levels at once?',
		options: [
			{
				id: 'flat-includes',
				label: 'Product.includes(:reviews)',
				correct: false,
				feedback:
					'That loads reviews but not their users. You will still get N+1 on review.user. The nested association needs to be specified.',
			},
			{
				id: 'separate',
				label: 'Product.includes(:reviews).includes(:users)',
				correct: false,
				feedback:
					'Products do not have a direct :users association. The users belong to reviews, so you need to express that nesting in the includes call.',
			},
			{
				id: 'nested-includes',
				label: 'Product.includes(reviews: :user)',
				correct: true,
			},
		],
	},
	2: {
		title: 'Fix Filtered Query',
		description:
			'The service needs products WHERE tags.active = true. This filters by an association column. Pick the method that handles this with the least ceremony — idiomatic Rails should do the right thing automatically.',
		options: [
			{
				id: 'preload',
				label: 'Product.preload(:tags).where(tags: { active: true })',
				correct: false,
				feedback:
					'preload always uses separate queries, so it cannot apply a WHERE clause on the associated table. Rails will raise an error.',
			},
			{
				id: 'eager-load',
				label: 'Product.eager_load(:tags).where(tags: { active: true })',
				correct: false,
				feedback:
					'eager_load works, but Rails auto-promotes to LEFT OUTER JOIN whenever you filter on the associated table. Forcing the JOIN strategy explicitly here adds words without changing the SQL.',
			},
			{
				id: 'includes-where',
				label: 'Product.includes(:tags).where(tags: { active: true })',
				correct: true,
			},
		],
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'observe') {
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code: `class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    products = Product.all  # No eager loading!
    Result.new(success?: true, products: products, errors: [])
  end
end

# For 100 products, this triggers:
# 1 query for products
# + 100 queries for users (one per product)
# = 101 queries total`,
			highlight: [5],
		});
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code: `class ProductsController < ApplicationController
  def index
    result = ProductList.call
    render json: ProductSerializer.new(result.products)
  end
end`,
		});
		return files;
	}

	// Build / reward phases
	if (furthestStep === 0) {
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code: `class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    products = Product.all  # 101 queries!
    Result.new(success?: true, products: products, errors: [])
  end
end`,
			highlight: [5],
		});
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code: `class ProductsController < ApplicationController
  def index
    result = ProductList.call
    render json: ProductSerializer.new(result.products)
  end
end`,
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/services/product_list.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call(scope: :index, filters: {})
    products = case scope
    when :index
      Product.includes(:user)
      # 2 queries instead of 101
    when :feed
      Product.includes(reviews: :user)
      # 3 queries instead of 1001
    when :tagged
      Product.eager_load(:tags)
          .where(tags: { active: filters[:tag_active] })
      # 1 query with LEFT OUTER JOIN
    end

    Result.new(success?: true, products: products, errors: [])
  end
end`
					: furthestStep >= 2
						? `class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call(scope: :index)
    products = case scope
    when :index
      Product.includes(:user)
      # 2 queries instead of 101
    when :feed
      Product.includes(reviews: :user)
      # 3 queries instead of 1001
    end

    Result.new(success?: true, products: products, errors: [])
  end
end`
						: `class ProductList < ApplicationService
  Result = Data.define(:success?, :products, :errors)

  def call
    products = Product.includes(:user)
    # 2 queries instead of 101
    Result.new(success?: true, products: products, errors: [])
  end
end`,
			highlight:
				furthestStep >= 3 ? [7, 10, 13, 14] : furthestStep >= 2 ? [7, 10] : [5],
		});
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class ProductsController < ApplicationController
  def index
    result = ProductList.call(scope: :index)
    render json: ProductSerializer.new(result.products)
  end

  def feed
    result = ProductList.call(scope: :feed)
    render json: FeedSerializer.new(result.products)
  end

  def tagged
    result = ProductList.call(
      scope: :tagged, filters: { tag_active: true }
    )
    render json: ProductSerializer.new(result.products)
  end
end`
					: furthestStep >= 2
						? `class ProductsController < ApplicationController
  def index
    result = ProductList.call(scope: :index)
    render json: ProductSerializer.new(result.products)
  end

  def feed
    result = ProductList.call(scope: :feed)
    render json: FeedSerializer.new(result.products)
  end
end`
						: `class ProductsController < ApplicationController
  def index
    result = ProductList.call
    render json: ProductSerializer.new(result.products)
  end
end`,
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews
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
// Block color maps
// ──────────────────────────────────────────────

const BLOCK_COLORS: Record<string, string> = {
	green:
		'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200',
	amber:
		'bg-amber-100 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200',
	red: 'bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200',
};

const RESULT_BADGE: Record<
	string,
	{ icon: typeof Check; label: string; className: string }
> = {
	works: {
		icon: Check,
		label: 'WORKS',
		className: 'text-emerald-700 dark:text-emerald-400',
	},
	fails: {
		icon: X,
		label: 'N+1!',
		className: 'text-red-700 dark:text-red-400',
	},
	suboptimal: {
		icon: Info,
		label: 'OK',
		className: 'text-amber-700 dark:text-amber-400',
	},
	error: {
		icon: X,
		label: 'ERROR',
		className: 'text-red-700 dark:text-red-400',
	},
};

// ──────────────────────────────────────────────
// QueryTimelineLane component (single lane)
// ──────────────────────────────────────────────

function QueryTimelineLane({
	lane,
	visible,
	inspectable,
	inspected,
	onClick,
}: {
	lane: StrategyLaneData;
	visible: boolean;
	inspectable?: boolean;
	inspected?: boolean;
	onClick?: () => void;
}) {
	const badge = RESULT_BADGE[lane.result];
	const BadgeIcon = badge?.icon;
	const isClickable = inspectable && !!onClick;

	return (
		<div
			className={cn(
				'rounded-lg border border-border bg-card/50 transition-all duration-300 overflow-hidden',
				!visible && 'opacity-40',
			)}
		>
			{/* Lane header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
				<button
					className={cn(
						'flex items-center gap-2 text-left',
						isClickable &&
							'cursor-pointer hover:text-primary transition-colors',
					)}
					disabled={!isClickable}
					onClick={isClickable ? onClick : undefined}
					type="button"
				>
					<code className="text-xs font-bold text-foreground">{lane.name}</code>
					{inspectable && !inspected && (
						<span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold animate-pulse">
							?
						</span>
					)}
				</button>
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-mono text-muted-foreground">
						{visible ? lane.method : ''}
					</span>
					{visible && badge && (
						<span
							className={cn(
								'flex items-center gap-0.5 text-[11px] font-semibold',
								badge.className,
							)}
						>
							<BadgeIcon className="w-3 h-3" />
							{badge.label}
						</span>
					)}
				</div>
			</div>

			{/* Query blocks timeline */}
			<div className="px-3 py-2 min-h-[36px]">
				{!visible ? (
					<span className="text-[10px] text-muted-foreground/50 italic">
						Fire a probe to test this strategy
					</span>
				) : (
					<div className="flex flex-wrap items-center gap-1.5">
						{lane.blocks.map((block, i) => (
							<div
								className={cn(
									'flex items-center gap-1.5',
									'animate-in fade-in slide-in-from-left-2 duration-300',
								)}
								key={`${block.label}-${i}`}
							>
								{i > 0 && (
									<span className="text-muted-foreground/40 text-xs">
										{'->'}
									</span>
								)}
								<span
									className={cn(
										'text-[10px] font-mono px-2 py-0.5 rounded border',
										block.wide && 'px-3',
										BLOCK_COLORS[block.color],
									)}
								>
									{block.label}
								</span>
							</div>
						))}

						{/* Flood blocks (N+1 lazy loads) */}
						{lane.floodCount && lane.floodCount > 0 && (
							<>
								<span className="text-muted-foreground/40 text-xs">{'->'}</span>
								<div className="flex flex-wrap gap-[3px] max-w-[280px] animate-in fade-in zoom-in-95 duration-500">
									{Array.from(
										{ length: Math.min(lane.floodCount, 60) },
										(_, i) => (
											<div
												className="w-[5px] h-[5px] rounded-[1px] bg-red-500 dark:bg-red-400"
												key={`flood-${lane.id}-${i}`}
												title={`SELECT user WHERE id=${i + 1}`}
											/>
										),
									)}
									{lane.floodCount > 60 && (
										<span className="text-[9px] text-red-600 dark:text-red-400 font-mono ml-1">
											+{lane.floodCount - 60}
										</span>
									)}
								</div>
							</>
						)}

						{/* Total label */}
						<span
							className={cn(
								'text-[10px] font-semibold ml-auto pl-2',
								lane.result === 'works'
									? 'text-emerald-700 dark:text-emerald-400'
									: lane.result === 'fails' || lane.result === 'error'
										? 'text-red-700 dark:text-red-400'
										: 'text-amber-700 dark:text-amber-400',
							)}
						>
							{lane.totalLabel}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// ResultLane component (reward phase - single lane)
// ──────────────────────────────────────────────

function ResultLane({ data }: { data: (typeof REWARD_LANE_DATA)[string] }) {
	const isAllowed = data.result === 'works';
	return (
		<div
			className={cn(
				'rounded-lg border-2 p-4 transition-all duration-300 animate-in fade-in duration-500',
				isAllowed
					? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10'
					: 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10',
			)}
		>
			{/* Strategy label */}
			<div className="flex items-center justify-between mb-3">
				<code className="text-sm font-bold text-foreground">
					{data.strategy}
				</code>
				<span
					className={cn(
						'flex items-center gap-1 text-xs font-semibold',
						isAllowed
							? 'text-emerald-700 dark:text-emerald-400'
							: 'text-red-700 dark:text-red-400',
					)}
				>
					{isAllowed ? (
						<Check className="w-3.5 h-3.5" />
					) : (
						<X className="w-3.5 h-3.5" />
					)}
					{isAllowed ? 'OPTIMIZED' : 'N+1 DETECTED'}
				</span>
			</div>

			{/* Query blocks */}
			<div className="flex flex-wrap items-center gap-1.5">
				{data.blocks.map((block, i) => (
					<div
						className="flex items-center gap-1.5"
						key={`${block.label}-${i}`}
					>
						{i > 0 && (
							<span className="text-muted-foreground/40 text-xs">{'->'}</span>
						)}
						<span
							className={cn(
								'text-[10px] font-mono px-2 py-0.5 rounded border',
								block.wide && 'px-3',
								BLOCK_COLORS[block.color],
							)}
						>
							{block.label}
						</span>
					</div>
				))}

				{data.floodCount && data.floodCount > 0 && (
					<>
						<span className="text-muted-foreground/40 text-xs">{'->'}</span>
						<div className="flex flex-wrap gap-[3px] max-w-[280px] animate-in fade-in zoom-in-95 duration-500">
							{Array.from({ length: Math.min(data.floodCount, 60) }, (_, i) => (
								<div
									className="w-[5px] h-[5px] rounded-[1px] bg-red-500 dark:bg-red-400"
									key={`reward-flood-${data.strategy}-${i}`}
								/>
							))}
							{data.floodCount > 60 && (
								<span className="text-[9px] text-red-600 dark:text-red-400 font-mono ml-1">
									+{data.floodCount - 60}
								</span>
							)}
						</div>
					</>
				)}

				<span
					className={cn(
						'text-xs font-semibold ml-auto pl-2',
						isAllowed
							? 'text-emerald-700 dark:text-emerald-400'
							: 'text-red-700 dark:text-red-400',
					)}
				>
					{data.totalLabel}
				</span>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Strategy Legend (reward phase)
// ──────────────────────────────────────────────

function StrategyLegend() {
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
					<span className="text-foreground">
						N+1 detected (not eager loaded)
					</span>
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
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	const [isAnimating, setIsAnimating] = useState(false);
	const [firedProbeCount, setFiredProbeCount] = useState(0);
	const [animationPhase, setAnimationPhase] = useState(-1);
	const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Reward phase
	const [lastRewardScenarioId, setLastRewardScenarioId] = useState<
		string | null
	>(null);

	// ── Get current lanes for observe phase ──
	const currentLanes = lastProbeId ? (PROBE_LANES[lastProbeId] ?? null) : null;

	// ── Get current reward lane data ──
	const currentRewardLane = lastRewardScenarioId
		? (REWARD_LANE_DATA[lastRewardScenarioId] ?? null)
		: null;

	// ── Clear all animation timeouts ──
	const clearAnimations = useCallback(() => {
		animationTimeoutsRef.current.forEach(clearTimeout);
		animationTimeoutsRef.current = [];
	}, []);

	// ── Run observe animation (stagger lanes) ──
	const laneCount = 4;
	const runObserveAnimation = useCallback(() => {
		clearAnimations();
		setIsAnimating(true);
		setAnimationPhase(0);

		for (let i = 1; i < laneCount; i++) {
			animationTimeoutsRef.current.push(
				setTimeout(() => setAnimationPhase(i), i * ANIMATION_DURATION_MS),
			);
		}

		// Unlock after last lane + one more duration for settle
		animationTimeoutsRef.current.push(
			setTimeout(() => {
				setIsAnimating(false);
			}, laneCount * ANIMATION_DURATION_MS),
		);
	}, [clearAnimations]);

	// ── Cleanup animation timeouts on unmount ──
	useEffect(() => {
		return () => clearAnimations();
	}, [clearAnimations]);

	// ── Lane label click handler (observe phase) ──
	const handleLaneClick = useCallback(
		(laneId: string) => {
			if (phase !== 'observe' || isAnimating) return;

			const data = STAGE_INSPECTOR_MAP[laneId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(laneId)) return prev;
				const next = new Set(prev);
				next.add(laneId);
				return next;
			});

			const discoveryId = STAGE_DISCOVERY_MAP[laneId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, isAnimating, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			setFiredProbeCount((prev) => prev + 1);

			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}

			runObserveAnimation();
		},
		[discoveryGating, runObserveAnimation],
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

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			setIsAnimating(true);
			setLastRewardScenarioId(scenarioId);
			stressTest.fireRequest(scenarioId);

			clearAnimations();
			animationTimeoutsRef.current.push(
				setTimeout(() => {
					setIsAnimating(false);
				}, ANIMATION_DURATION_MS),
			);
		},
		[stressTest, clearAnimations],
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
		return {
			valid: true,
			message: 'All queries optimized with eager loading!',
		};
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
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Level 23 exposed the N+1 problem. Now you need to choose the right{' '}
							<span className="text-foreground font-medium">strategy</span> to
							fix it. Not all eager loading methods work for every scenario.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Fire probes to test scenarios against four loading strategies.
							Watch the SQL queries each one generates.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>

							{/* Progressive hint */}
							{firedProbeCount >= 2 && !discoveryGating.isUnlocked && (
								<Alert
									className="mt-3 animate-in fade-in duration-500"
									variant="info"
								>
									<Info className="w-4 h-4" />
									<AlertDescription className="text-xs">
										{firedProbeCount >= 3 ? (
											<>
												Click the strategy names with{' '}
												<span className="font-medium">?</span> to inspect their
												SQL patterns and discover why different scenarios need
												different approaches.
											</>
										) : (
											<>
												Click the strategy names with{' '}
												<span className="font-medium">?</span> to inspect each
												loading method.
											</>
										)}
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}

					{/* Build phase: step progress */}
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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<StrategyLegend />

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
										<div className="text-xs text-destructive/70">
											N+1 Caught
										</div>
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
							{/* SQL Timeline lanes */}
							<div className="flex-1 overflow-auto p-4">
								<div className="max-w-3xl mx-auto space-y-2">
									{(
										currentLanes ?? [
											{
												id: 'includes',
												name: 'includes',
												method: '',
												blocks: [],
												totalLabel: '',
												result: 'works' as const,
											},
											{
												id: 'preload',
												name: 'preload',
												method: '',
												blocks: [],
												totalLabel: '',
												result: 'works' as const,
											},
											{
												id: 'eager_load',
												name: 'eager_load',
												method: '',
												blocks: [],
												totalLabel: '',
												result: 'works' as const,
											},
											{
												id: 'joins',
												name: 'joins',
												method: '',
												blocks: [],
												totalLabel: '',
												result: 'works' as const,
											},
										]
									).map((lane, i) => (
										<QueryTimelineLane
											inspectable
											inspected={inspectedStages.has(lane.id)}
											key={lane.id}
											lane={lane}
											onClick={() => handleLaneClick(lane.id)}
											visible={currentLanes !== null && animationPhase >= i}
										/>
									))}
								</div>

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
									disabled={isAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Strategy Tester"
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

										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={
														hasNextStep
															? stepper.nextStep
															: () => {
																	setPhase('reward');
																	stressTest.reset();
																}
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Result lane */}
							<div className="flex-1 flex items-center justify-center p-6">
								<div className="w-full max-w-3xl">
									{currentRewardLane ? (
										<ResultLane
											data={currentRewardLane}
											key={lastRewardScenarioId}
										/>
									) : (
										<div className="text-center text-muted-foreground text-sm">
											Fire a scenario below to see the query pattern
										</div>
									)}
								</div>
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={isAnimating}
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
					{phase === 'reward' && (
						<>
							<div className="p-4 border-t border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Performance Impact (10K records)
								</div>
								<div className="space-y-2 text-xs font-mono">
									<div className="flex justify-between">
										<span className="text-primary">includes</span>
										<span className="text-muted-foreground">
											2 queries, SQL IN clause
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-warning">preload</span>
										<span className="text-muted-foreground">
											2 queries, separate SELECTs
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-purple-400 dark:text-purple-300">
											eager_load
										</span>
										<span className="text-muted-foreground">
											1 query, LEFT JOIN
										</span>
									</div>
									<div className="flex justify-between mt-2 pt-2 border-t border-border">
										<span className="text-destructive">No eager loading</span>
										<span className="text-destructive">10,001 queries</span>
									</div>
								</div>
								<div className="text-xs text-muted-foreground mt-2">
									Memory: 681MB (no eager) to 45MB (with includes) for 10K
									records
								</div>
							</div>

							<div className="p-4 border-t border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
									Further Reading
								</div>
								<ul className="text-xs text-muted-foreground space-y-1">
									<li>
										<span className="text-primary">prosopite gem</span> -
										Auto-detects N+1 and raises in development
									</li>
									<li>
										<span className="text-primary">strict_loading</span> -
										Raises on lazy loads in development
									</li>
									<li>
										<span className="text-primary">Rails Scales!, Ch. 2</span> -
										Preloading Methods
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

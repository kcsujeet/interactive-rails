/**
 * Level 30: Caching
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Cache Waterfall" visualization.
 *   Four horizontal layers stacked vertically: Request -> Cache Store (absent) ->
 *   Service -> Database. Player fires probes and watches every request fall through
 *   the missing cache layer straight to the database. Clickable zones reveal
 *   StageInspector with code. ProbeTerminal drives probes.
 *
 * Phase 2 (HOW - build): 6 steps (3 terminal + 3 OptionCard) implementing Solid Cache
 *   Step 0: bundle add solid_cache (terminal)
 *   Step 1: bin/rails solid_cache:install (terminal)
 *   Step 2: bin/rails db:prepare (terminal)
 *   Step 3: Configure cache store in production.rb (OptionCard)
 *   Step 4: Wrap service query in Rails.cache.fetch (OptionCard)
 *   Step 5: Add touch: true for cache invalidation (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same waterfall layout, now with cache layer active.
 *   Cache hits bounce back from cache layer (green). Misses fall through to DB.
 *   Invalidation scenarios flash the cache layer, then next request is a miss.
 *
 * Teaches: Solid Cache, Rails.cache.fetch, expires_in, touch: true, cache invalidation
 *
 * NOTE: HTTP caching (ETags, stale?, Cache-Control, CDNs) belongs to Level 31.
 * This level focuses on server-side caching only.
 */

import {
	ArrowRight,
	Database,
	Globe,
	HardDrive,
	Info,
	Search,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Alert, AlertDescription } from '@/components/ui/Alert';
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

type VizMode = 'idle' | 'falling' | 'hit' | 'miss' | 'invalidation';

// ──────────────────────────────────────────────
// Layer definitions
// ──────────────────────────────────────────────

interface LayerDef {
	id: string;
	label: string;
	sublabel: string;
	icon: 'globe' | 'harddrive' | 'zap' | 'database';
}

const LAYERS: LayerDef[] = [
	{
		id: 'request',
		label: 'Incoming Request',
		sublabel: 'GET /api/v1/products/trending',
		icon: 'globe',
	},
	{
		id: 'cache',
		label: 'Cache Store',
		sublabel: 'No store configured',
		icon: 'harddrive',
	},
	{
		id: 'service',
		label: 'TrendingProducts Service',
		sublabel: '512ms computation',
		icon: 'zap',
	},
	{
		id: 'database',
		label: 'PostgreSQL',
		sublabel: '50K posts, joins + group + order',
		icon: 'database',
	},
];

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'redundant-computation', label: 'Same query runs 200 times/minute' },
	{ id: 'no-cache-store', label: 'No cache store configured' },
	{ id: 'db-overload', label: 'Database at 170% capacity' },
	{ id: 'service-no-cache', label: 'Service has no caching logic' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'trending-first',
		label: 'GET trending',
		command: 'GET /api/v1/products/trending',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: 'X-Runtime: 0.512', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'TrendingProducts: joins + group + order on 50K rows',
				color: 'muted',
			},
			{ text: 'Execution Time: 512ms. Computed from scratch.', color: 'red' },
		],
		story: [
			'A customer visits the trending products page.',
			'The server runs a complex query: joins, group, and order across 50,000 rows.',
			'The computation takes 512ms, built entirely from scratch.',
			'No cache layer exists to store or reuse the result.',
		],
	},
	{
		id: 'trending-repeat',
		label: 'GET trending (again)',
		command: 'GET /api/v1/products/trending (same request, 5s later)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: 'X-Runtime: 0.508', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Identical query. Identical result. Full recomputation.',
				color: 'red',
			},
			{ text: 'No cache layer intercepted this request.', color: 'red' },
		],
		story: [
			'The same customer refreshes the trending page 5 seconds later.',
			'The data has not changed, but the server runs the exact same query again.',
			'Another 508ms of computation for an identical result.',
			'Without a cache store, every request pays the full cost.',
		],
	},
	{
		id: 'check-db-load',
		label: 'Check DB load',
		command:
			'rails runner "puts ActiveRecord::Base.connection.pool.stat[:busy]"',
		responseLines: [
			{ text: '=> 47 active connections', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: '200 req/min * 512ms = 1,707ms of DB time per second',
				color: 'red',
			},
			{ text: 'Database at 170% of available capacity.', color: 'red' },
		],
		story: [
			'An engineer checks the database connection pool under production load.',
			'200 requests per minute, each taking 512ms of database time.',
			'47 of 50 connections are active, with the pool nearly exhausted.',
			'The database is running at 170% capacity with no caching to reduce load.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'trending-first': 'redundant-computation',
	'trending-repeat': 'no-cache-store',
	'check-db-load': 'db-overload',
};

// ──────────────────────────────────────────────
// Zone inspector data (observe phase)
// ──────────────────────────────────────────────

const ZONE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'200 requests/minute to GET /api/v1/products/trending. Each triggers a full computation cycle through the service and database.',
	},
	cache: {
		stageId: 'cache',
		title: 'Cache Layer (Missing)',
		description:
			'No cache store is configured. Rails defaults to :null_store when no store is set. Every request falls through to the service.',
		code: `# config/environments/production.rb
# config.cache_store = ???
# No cache store configured!
#
# Rails.cache.class
# => ActiveSupport::Cache::NullStore`,
	},
	service: {
		stageId: 'service',
		title: 'TrendingProducts Service',
		description:
			'The service computes trending posts from scratch on every call. No caching wrapper around the expensive query.',
		code: `# app/services/trending_products.rb
class TrendingProducts < ApplicationService
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    products = Product
      .joins(:reviews)
      .where("posts.created_at > ?", 7.days.ago)
      .group("posts.id")
      .select("posts.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    # Recomputed on EVERY call. No caching!
    Result.new(posts: posts, generated_at: Time.current)
  end
end`,
	},
	database: {
		stageId: 'database',
		title: 'PostgreSQL (50K Posts)',
		description:
			'Joins products and reviews, groups, aggregates, sorts. 512ms per execution. Running 200 times/minute.',
		code: `EXPLAIN ANALYZE
SELECT products.*, COUNT(reviews.id) AS score
FROM products
INNER JOIN reviews ON reviews.product_id = products.id
WHERE posts.created_at > NOW() - INTERVAL '7 days'
GROUP BY posts.id
ORDER BY score DESC
LIMIT 20;

-- Planning Time: 0.8ms
-- Execution Time: 512.3ms`,
	},
};

// Map zone IDs to discovery IDs they trigger
const ZONE_DISCOVERY_MAP: Record<string, string> = {
	service: 'service-no-cache',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'cache-miss',
		label: 'GET trending (cold)',
		description: 'First request after cache expiration',
		method: 'GET',
		path: '/api/v1/products/trending',
		actor: 'visitor',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '200 OK  X-Cache: MISS  512ms', color: 'yellow' },
			{
				text: 'Cache miss. Computed and stored for 5 minutes.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'cache-hit',
		label: 'GET trending (cached)',
		description: 'Request served from warm cache',
		method: 'GET',
		path: '/api/v1/products/trending',
		actor: 'visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK  X-Cache: HIT  2ms', color: 'green' },
			{ text: 'Served from Solid Cache. DB not touched.', color: 'green' },
		],
	},
	{
		id: 'cache-hit-2',
		label: 'GET trending (second hit)',
		description: 'Another visitor, same cached result',
		method: 'GET',
		path: '/api/v1/products/trending',
		actor: 'another visitor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK  X-Cache: HIT  2ms', color: 'green' },
			{ text: 'Cache hit. 256x faster than uncached.', color: 'green' },
		],
	},
	{
		id: 'invalidation',
		label: 'POST review (touch)',
		description: 'New review triggers touch: true',
		method: 'POST',
		path: '/api/v1/products/42/reviews',
		actor: 'user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'product.updated_at touched. Cache invalidated.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'post-invalidation',
		label: 'GET trending (after touch)',
		description: 'Request after cache was invalidated',
		method: 'GET',
		path: '/api/v1/products/trending',
		actor: 'visitor',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '200 OK  X-Cache: MISS  512ms', color: 'yellow' },
			{
				text: 'Cache invalidated by touch. Fresh computation.',
				color: 'yellow',
			},
		],
	},
];

// Map scenario IDs to viz behavior
const SCENARIO_VIZ_MAP: Record<string, VizMode> = {
	'cache-miss': 'miss',
	'cache-hit': 'hit',
	'cache-hit-2': 'hit',
	invalidation: 'invalidation',
	'post-invalidation': 'miss',
};

// ──────────────────────────────────────────────
// Step definitions (6 steps: 3 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install Cache Gem' },
	{ id: 'run-installer', title: 'Run Installer' },
	{ id: 'db-prepare', title: 'Prepare Database' },
	{ id: 'configure-store', title: 'Configure Cache Store' },
	{ id: 'cache-fetch', title: 'Add Cache Fetch' },
	{ id: 'touch-invalidation', title: 'Cache Invalidation' },
];

// Step type indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add solid_cache
	'terminal', // 1: bin/rails solid_cache:install
	'terminal', // 2: bin/rails db:prepare
	'option', // 3: configure cache store
	'option', // 4: cache.fetch wrapper
	'option', // 5: touch: true
];

// ──────────────────────────────────────────────
// Terminal step data
// ──────────────────────────────────────────────

const installGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install solid-cache',
		command: 'npm install solid-cache',
		correct: false,
		feedback:
			'Solid Cache is a Ruby gem, not an npm package. Use the Ruby dependency manager.',
	},
	{
		id: 'correct',
		label: 'bundle add solid_cache',
		command: 'bundle add solid_cache',
		correct: true,
	},
	{
		id: 'wrong-gem',
		label: 'gem install solid_cache',
		command: 'gem install solid_cache',
		correct: false,
		feedback:
			'gem install works globally but does not add to your Gemfile. Use bundle add for project dependencies.',
	},
];

const installGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching solid_cache 1.0.6', color: 'cyan' },
	{ text: 'Installing solid_cache 1.0.6', color: 'muted' },
	{ text: 'Bundle complete! 15 Gemfile dependencies.', color: 'green' },
];

const runInstallerCommands: TerminalCommand[] = [
	{
		id: 'wrong-generate',
		label: 'bin/rails generate cache',
		command: 'bin/rails generate cache',
		correct: false,
		feedback:
			'There is no "cache" generator. Solid Cache ships its own installer task.',
	},
	{
		id: 'wrong-setup',
		label: 'bin/rails cache:setup',
		command: 'bin/rails cache:setup',
		correct: false,
		feedback:
			'That task does not exist. Check the gem documentation for the correct install command.',
	},
	{
		id: 'correct',
		label: 'bin/rails solid_cache:install',
		command: 'bin/rails solid_cache:install',
		correct: true,
	},
];

const runInstallerOutput: TerminalOutputLine[] = [
	{ text: 'create  config/cache.yml', color: 'green' },
	{ text: 'create  db/cache_schema.rb', color: 'green' },
	{ text: 'Solid Cache installed successfully.', color: 'green' },
];

const dbPrepareCommands: TerminalCommand[] = [
	{
		id: 'wrong-migrate',
		label: 'bin/rails db:migrate',
		command: 'bin/rails db:migrate',
		correct: false,
		feedback:
			'db:migrate only targets the primary database. Solid Cache uses a separate cache database that needs full setup.',
	},
	{
		id: 'correct',
		label: 'bin/rails db:prepare',
		command: 'bin/rails db:prepare',
		correct: true,
	},
	{
		id: 'wrong-setup',
		label: 'bin/rails db:setup',
		command: 'bin/rails db:setup',
		correct: false,
		feedback:
			'db:setup drops and recreates. db:prepare is safer: it creates only if the database does not exist yet.',
	},
];

const dbPrepareOutput: TerminalOutputLine[] = [
	{ text: "Created database 'blog_cache'", color: 'green' },
	{ text: 'Loaded cache schema', color: 'green' },
];

// Shell step map for buildTerminalHistory
const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: installGemCommands, outputLines: installGemOutput },
	{ commands: runInstallerCommands, outputLines: runInstallerOutput },
	{ commands: dbPrepareCommands, outputLines: dbPrepareOutput },
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step configs
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const CONFIGURE_STORE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-memory',
		label: 'config.cache_store = :memory_store',
		correct: false,
		feedback:
			'Memory store is per-process only. Data is not shared between Puma workers and is lost on restart.',
	},
	{
		id: 'wrong-redis',
		label: 'config.cache_store = :redis_cache_store',
		correct: false,
		feedback:
			'Redis works but requires extra infrastructure. The Rails 8 default is database-backed and requires no additional services.',
	},
	{
		id: 'correct',
		label: 'config.cache_store = :solid_cache_store',
		correct: true,
	},
];

const CACHE_FETCH_OPTIONS: StepOption[] = [
	{
		id: 'wrong-read',
		label: 'Rails.cache.read("trending_products") || compute_trending.to_a',
		correct: false,
		feedback:
			'read + manual write is fragile. You must remember to write on miss. cache.fetch handles both atomically.',
	},
	{
		id: 'wrong-no-expire',
		label: 'Rails.cache.fetch("trending_products") { compute_trending.to_a }',
		correct: false,
		feedback:
			'Missing an expiration. Without expires_in, the cache never refreshes and serves stale data forever.',
	},
	{
		id: 'correct',
		label:
			'Rails.cache.fetch("trending_products", expires_in: 5.minutes) { compute_trending.to_a }',
		correct: true,
	},
];

const TOUCH_OPTIONS: StepOption[] = [
	{
		id: 'wrong-callback',
		label: 'after_save { Rails.cache.delete("trending_products") }',
		correct: false,
		feedback:
			'Manual callbacks are fragile and must be added to every model that affects the cache. touch cascades automatically through associations.',
	},
	{
		id: 'correct',
		label: 'belongs_to :product, touch: true',
		correct: true,
	},
	{
		id: 'wrong-clear',
		label: 'Rails.cache.clear',
		correct: false,
		feedback:
			'Clearing the entire cache is a sledgehammer. It evicts everything, not just the relevant key.',
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
	3: {
		title: 'Configure Cache Store',
		description:
			'The gem is installed and the cache database is ready. Configure which cache store Rails should use in production. You want the Rails 8 default that requires no additional infrastructure.',
		options: CONFIGURE_STORE_OPTIONS,
	},
	4: {
		title: 'Add Cache Fetch',
		description:
			'The trending query runs on every request. Wrap it so the first request computes and stores the result, and subsequent requests read from cache. Make sure results do not go stale forever.',
		options: CACHE_FETCH_OPTIONS,
	},
	5: {
		title: 'Cache Invalidation',
		description:
			'When a new review is posted, the trending rankings change. The Review model needs to signal that its parent product has changed so cache keys that depend on updated_at are invalidated.',
		options: TOUCH_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Contract file (always shown)
	const contractCode = `class TrendingContract < Dry::Validation::Contract
  params do
    # No input params needed for trending
    # (validation is a no-op, but the pattern
    #  is maintained for consistency)
  end
end`;

	if (phase === 'observe') {
		files.push({
			filename: 'app/contracts/trending_contract.rb',
			language: 'ruby',
			code: contractCode,
		});
		files.push({
			filename: 'app/services/trending_products.rb',
			language: 'ruby',
			code: `class TrendingProducts < ApplicationService
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    products = Product
      .joins(:reviews)
      .where("posts.created_at > ?", 7.days.ago)
      .group("posts.id")
      .select("posts.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    # Runs on EVERY request. No caching!
    Result.new(posts: posts, generated_at: Time.current)
  end
end`,
			highlight: [19],
		});
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def trending
    result = TrendingProducts.call
    if result.posts.any?
      render json: ProductSerializer.new(result.posts)
    else
      render json: { data: [] }
    end
  end
end

# 200 req/min * 512ms = 1,707ms DB time/sec
# Database at 170% capacity!`,
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/services/trending_products.rb',
			language: 'ruby',
			code: `class TrendingProducts < ApplicationService
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    products = Product
      .joins(:reviews)
      .where("posts.created_at > ?", 7.days.ago)
      .group("posts.id")
      .select("posts.*, COUNT(reviews.id) AS score")
      .order("score DESC")
      .limit(20)
      .includes(:user)

    # No caching! Runs on every request.
    Result.new(posts: posts, generated_at: Time.current)
  end
end`,
			highlight: [19],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "jsonapi-serializer"
gem "pagy", "~> 43.3"
gem "solid_cache"`,
			highlight: [8],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'config/cache.yml',
			language: 'yaml',
			code: `# Auto-generated by solid_cache:install
production:
  database: cache
  max_age: <%= 1.week.to_i %>
  max_size: 256  # MB`,
		});
	}

	if (furthestStep >= 3) {
		// db:prepare done, show same config
		files.push({
			filename: 'db/cache_schema.rb',
			language: 'ruby',
			code: `# Auto-generated cache schema
ActiveRecord::Schema[8.0].define do
  create_table :solid_cache_entries do |t|
    t.binary :key, null: false, limit: 1024
    t.binary :value, null: false, limit: 536870912
    t.datetime :created_at, null: false
    t.integer :key_hash, null: false, limit: 8
    t.integer :byte_size, null: false

    t.index :byte_size
    t.index :key_hash, unique: true
  end
end`,
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'config/environments/production.rb',
			language: 'ruby',
			code: `Rails.application.configure do
  # ...
  config.cache_store = :solid_cache_store
  # ...
end`,
			highlight: [3],
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'app/services/trending_products.rb',
			language: 'ruby',
			code: `class TrendingProducts < ApplicationService
  Result = Data.define(:posts, :generated_at)

  def call
    validation = TrendingContract.new.call({})
    return Result.new(
      posts: [], generated_at: Time.current
    ) if validation.failure?

    products = Rails.cache.fetch(
      "trending_products",
      expires_in: 5.minutes
    ) do
      Product
        .joins(:reviews)
        .where("posts.created_at > ?", 7.days.ago)
        .group("posts.id")
        .select("posts.*, COUNT(reviews.id) AS score")
        .order("score DESC")
        .limit(20)
        .includes(:user)
        .to_a  # Materialize before caching
    end

    Result.new(posts: posts, generated_at: Time.current)
  end
end`,
			highlight: [10, 11, 12, 23],
		});
	}

	if (furthestStep >= 6) {
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  belongs_to :product, touch: true
  belongs_to :user

  validates :body, presence: true

  # touch: true updates product.updated_at when a
  # review is created, updated, or destroyed.
  # Cache keys that include updated_at are
  # automatically invalidated.
end`,
			highlight: [2],
		});
	}

	// Reward phase: show full picture
	if (furthestStep >= 6) {
		files.push({
			filename: 'app/contracts/trending_contract.rb',
			language: 'ruby',
			code: contractCode,
		});
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def trending
    result = TrendingProducts.call
    if result.posts.any?
      render json: ProductSerializer.new(result.posts)
    else
      render json: { data: [] }
    end
  end
end

# Cache HIT:   2ms   (served from Solid Cache)
# Cache MISS: 512ms  (computed, then cached 5min)`,
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Reward Legend
// ──────────────────────────────────────────────

function CacheLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-6 h-4 rounded-sm bg-emerald-500/20 border border-emerald-500/40 dark:bg-emerald-500/20 dark:border-emerald-400/40" />
					<span className="text-foreground">Cache HIT (2ms)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-6 h-4 rounded-sm bg-amber-500/20 border border-amber-500/40 dark:bg-amber-500/20 dark:border-amber-400/40" />
					<span className="text-foreground">
						Cache MISS (512ms, then cached)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-6 h-4 rounded-sm bg-red-500/20 border border-red-500/40 dark:bg-red-500/20 dark:border-red-400/40" />
					<span className="text-foreground">
						Cache invalidated (touch: true)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Layer icon component
// ──────────────────────────────────────────────

function LayerIcon({
	icon,
	className,
}: {
	icon: LayerDef['icon'];
	className?: string;
}) {
	switch (icon) {
		case 'globe':
			return <Globe className={className} />;
		case 'harddrive':
			return <HardDrive className={className} />;
		case 'zap':
			return <Zap className={className} />;
		case 'database':
			return <Database className={className} />;
	}
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level30Caching({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 4,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedZones, setInspectedZones] = useState<Set<string>>(new Set());
	const [firedProbeCount, setFiredProbeCount] = useState(0);

	// ── Visualization state ──
	const [vizMode, setVizMode] = useState<VizMode>('idle');
	const [activeLayer, setActiveLayer] = useState(-1); // which layer the "dot" is at (-1 = none)
	const [vizAnimating, setVizAnimating] = useState(false);
	const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// ── Animation helpers ──
	const clearTimers = useCallback(() => {
		for (const t of animTimersRef.current) clearTimeout(t);
		animTimersRef.current = [];
	}, []);

	/** Run the "falling through" animation: request drops through all 4 layers */
	const runFalling = useCallback(
		(onDone?: () => void): void => {
			clearTimers();
			setVizMode('falling');
			setActiveLayer(0);
			setVizAnimating(true);

			const perLayer = Math.round(ANIMATION_DURATION_MS / 4);

			// Animate through layers 1, 2, 3
			for (let i = 1; i <= 3; i++) {
				const timer = setTimeout(() => {
					setActiveLayer(i);
				}, i * perLayer);
				animTimersRef.current.push(timer);
			}

			// Done after all 4 layers + settle
			const totalDuration = 4 * perLayer + Math.round(perLayer * 0.5);
			const endTimer = setTimeout(() => {
				setVizAnimating(false);
				onDone?.();
			}, totalDuration);
			animTimersRef.current.push(endTimer);
		},
		[clearTimers],
	);

	/** Run cache HIT animation: dot stops at cache layer (1), bounces green */
	const runHit = useCallback(() => {
		clearTimers();
		setVizMode('hit');
		setActiveLayer(0);
		setVizAnimating(true);

		const perLayer = Math.round(ANIMATION_DURATION_MS / 4);

		// Move to cache layer
		const t1 = setTimeout(() => setActiveLayer(1), perLayer);
		animTimersRef.current.push(t1);

		// Done (dot stays at cache layer showing HIT)
		const endTimer = setTimeout(
			() => {
				setVizAnimating(false);
			},
			2 * perLayer + Math.round(perLayer * 0.5),
		);
		animTimersRef.current.push(endTimer);
	}, [clearTimers]);

	/** Run cache MISS animation: dot falls through all layers */
	const runMiss = useCallback(() => {
		clearTimers();
		setVizMode('miss');
		setActiveLayer(0);
		setVizAnimating(true);

		const perLayer = Math.round(ANIMATION_DURATION_MS / 4);

		for (let i = 1; i <= 3; i++) {
			const timer = setTimeout(() => setActiveLayer(i), i * perLayer);
			animTimersRef.current.push(timer);
		}

		const totalDuration = 4 * perLayer + Math.round(perLayer * 0.5);
		const endTimer = setTimeout(() => {
			setVizAnimating(false);
		}, totalDuration);
		animTimersRef.current.push(endTimer);
	}, [clearTimers]);

	/** Run invalidation animation: cache layer flashes red */
	const runInvalidation = useCallback(() => {
		clearTimers();
		setVizMode('invalidation');
		setActiveLayer(1);
		setVizAnimating(true);

		const endTimer = setTimeout(() => {
			setVizAnimating(false);
		}, ANIMATION_DURATION_MS);
		animTimersRef.current.push(endTimer);
	}, [clearTimers]);

	const resetVisualization = useCallback(() => {
		clearTimers();
		setVizMode('idle');
		setActiveLayer(-1);
		setVizAnimating(false);
	}, [clearTimers]);

	// Cleanup timers on unmount
	useEffect(() => {
		return () => clearTimers();
	}, [clearTimers]);

	// ── Zone click handler (observe phase) ──
	const handleZoneClick = useCallback(
		(zoneId: string) => {
			if (phase !== 'observe') return;

			const data = ZONE_INSPECTOR_MAP[zoneId];
			if (!data) return;

			setInspectorData(data);
			setInspectedZones((prev) => {
				if (prev.has(zoneId)) return prev;
				const next = new Set(prev);
				next.add(zoneId);
				return next;
			});

			const discoveryId = ZONE_DISCOVERY_MAP[zoneId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setFiredProbeCount((c) => c + 1);

			// Run falling animation, trigger discovery after it completes
			runFalling(() => {
				const discoveryId = PROBE_DISCOVERY_MAP[probeId];
				if (discoveryId) {
					discoveryGating.discover(discoveryId);
				}
			});
		},
		[discoveryGating, runFalling],
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

	// ── Reward phase: fire stress scenario ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const mode = SCENARIO_VIZ_MAP[scenarioId] ?? 'miss';
			switch (mode) {
				case 'hit':
					runHit();
					break;
				case 'miss':
					runMiss();
					break;
				case 'invalidation':
					runInvalidation();
					break;
			}
		},
		[vizAnimating, stressTest, runHit, runMiss, runInvalidation],
	);

	// ── Phase transition handlers ──
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
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Caching is live!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Layer state helper ──
	const getLayerState = (
		layerIndex: number,
	): 'neutral' | 'active' | 'danger' | 'success' | 'dim' | 'absent' => {
		const layerId = LAYERS[layerIndex]?.id;

		if (phase === 'observe') {
			// Cache layer is absent (dashed, danger)
			if (layerId === 'cache') return 'absent';
			// During falling animation, highlight the active layer
			if (vizMode === 'falling' && layerIndex <= activeLayer) {
				if (layerId === 'database') return 'danger';
				if (layerId === 'service') return 'active';
				return 'neutral';
			}
			return 'neutral';
		}

		if (phase === 'reward') {
			if (vizMode === 'hit') {
				if (layerId === 'cache' && layerIndex <= activeLayer) return 'success';
				if (layerId === 'request' && activeLayer >= 0) return 'neutral';
				if (layerIndex > 1) return 'dim';
				return 'neutral';
			}
			if (vizMode === 'miss') {
				if (layerIndex <= activeLayer) {
					if (layerId === 'cache') return 'active'; // pass-through
					if (layerId === 'database') return 'danger';
					if (layerId === 'service') return 'active';
					return 'neutral';
				}
				return 'dim';
			}
			if (vizMode === 'invalidation') {
				if (layerId === 'cache') return 'danger';
				return 'dim';
			}
			// idle in reward: cache is success (healthy)
			if (layerId === 'cache') return 'success';
			return 'neutral';
		}

		return 'neutral';
	};

	// ── Timing badge for reward ──
	const getTimingBadge = (): {
		text: string;
		variant: 'success' | 'warning' | 'danger';
	} | null => {
		if (phase !== 'reward' || vizMode === 'idle') return null;
		if (vizMode === 'hit') return { text: '2ms', variant: 'success' };
		if (vizMode === 'miss') return { text: '512ms', variant: 'warning' };
		if (vizMode === 'invalidation')
			return { text: 'invalidated', variant: 'danger' };
		return null;
	};

	// ── Visualization render ──
	const renderCacheWaterfall = () => {
		const isObserve = phase === 'observe';
		const timingBadge = getTimingBadge();

		return (
			<div className="flex flex-col items-center">
				{LAYERS.map((layer, i) => {
					const state = getLayerState(i);
					const isClickable =
						isObserve && ZONE_INSPECTOR_MAP[layer.id] !== undefined;
					const showPulse =
						isObserve && isClickable && !inspectedZones.has(layer.id);

					// In reward phase, update cache sublabel
					let sublabel = layer.sublabel;
					if (phase === 'reward' && layer.id === 'cache') {
						sublabel = 'Solid Cache (DB-backed)';
					}

					return (
						<div className="w-full" key={layer.id}>
							{/* FlowConnector between layers */}
							{i > 0 && (
								<div className="flex justify-center">
									<FlowConnector
										active={
											vizAnimating &&
											activeLayer >= i &&
											vizMode !== 'invalidation'
										}
										direction="vertical"
										dotColor={
											vizMode === 'hit' && i === 1
												? 'bg-success'
												: vizMode === 'falling' || vizMode === 'miss'
													? 'bg-destructive'
													: 'bg-muted-foreground'
										}
										dotCount={vizMode === 'falling' ? 3 : 1}
									/>
								</div>
							)}

							{/* Layer card */}
							<button
								className={cn(
									'w-full rounded-lg border p-3 text-left transition-all duration-200 relative',
									// Base
									'bg-card',
									// State colors
									state === 'neutral' && 'border-border',
									state === 'absent' &&
										'border-dashed border-red-400/60 dark:border-red-500/40 bg-red-500/5 dark:bg-red-500/5',
									state === 'active' &&
										'border-amber-500/60 dark:border-amber-400/40 bg-amber-500/5 dark:bg-amber-500/5',
									state === 'danger' &&
										'border-red-500/60 dark:border-red-400/40 bg-red-500/10 dark:bg-red-500/10',
									state === 'success' &&
										'border-emerald-500/60 dark:border-emerald-400/40 bg-emerald-500/10 dark:bg-emerald-500/10',
									state === 'dim' && 'border-border/50 opacity-50',
									// Clickable
									isClickable && 'cursor-pointer hover:border-primary/50',
								)}
								onClick={() => isClickable && handleZoneClick(layer.id)}
								type="button"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<LayerIcon
											className={cn(
												'w-4 h-4',
												state === 'absent'
													? 'text-red-500 dark:text-red-400'
													: state === 'success'
														? 'text-emerald-600 dark:text-emerald-400'
														: state === 'danger'
															? 'text-red-600 dark:text-red-400'
															: 'text-muted-foreground',
											)}
											icon={layer.icon}
										/>
										<span className="text-xs font-semibold text-foreground">
											{layer.label}
										</span>
										<span
											className={cn(
												'text-xs',
												state === 'absent'
													? 'text-red-500 dark:text-red-400'
													: state === 'success'
														? 'text-emerald-600 dark:text-emerald-400'
														: 'text-muted-foreground',
											)}
										>
											{sublabel}
										</span>
									</div>
									<div className="flex items-center gap-2">
										{/* Timing badge on cache layer during reward */}
										{layer.id === 'cache' && timingBadge && (
											<span
												className={cn(
													'text-xs font-mono font-bold',
													timingBadge.variant === 'success' &&
														'text-emerald-600 dark:text-emerald-400',
													timingBadge.variant === 'warning' &&
														'text-amber-600 dark:text-amber-400',
													timingBadge.variant === 'danger' &&
														'text-red-600 dark:text-red-400',
												)}
											>
												{timingBadge.text}
											</span>
										)}
										{/* Pulsing search icon for undiscovered zones */}
										{showPulse && (
											<span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary animate-pulse">
												<Search className="w-3 h-3" />
											</span>
										)}
									</div>
								</div>
							</button>
						</div>
					);
				})}
			</div>
		);
	};

	// ── Terminal step configs ──
	const terminalStepConfigs: Record<
		number,
		{
			title: string;
			description: React.ReactNode;
			commands: TerminalCommand[];
			outputLines: TerminalOutputLine[];
		}
	> = {
		0: {
			title: 'Install Cache Gem',
			description: (
				<p className="text-sm text-muted-foreground">
					Rails 8 ships with a database-backed cache store that eliminates the
					need for Redis. Install it as a project dependency.
				</p>
			),
			commands: installGemCommands,
			outputLines: installGemOutput,
		},
		1: {
			title: 'Run Installer',
			description: (
				<p className="text-sm text-muted-foreground">
					The gem has an installer that generates configuration files and a
					cache database schema. Run it to set up the cache infrastructure.
				</p>
			),
			commands: runInstallerCommands,
			outputLines: runInstallerOutput,
		},
		2: {
			title: 'Prepare Database',
			description: (
				<p className="text-sm text-muted-foreground">
					The installer created a schema for the cache database, but the
					database itself does not exist yet. Create it and load the schema.
				</p>
			),
			commands: dbPrepareCommands,
			outputLines: dbPrepareOutput,
		},
	};

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
							The trending posts endpoint computes rankings from 50K posts on
							every request. 200 identical computations per minute, each taking
							512ms.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Explore the request layers. Find out why the same expensive query
							runs over and over with no cache intercepting it.
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
							{/* Progressive hint for zone click discovery */}
							{firedProbeCount >= 2 &&
								!discoveryGating.isDiscovered('service-no-cache') && (
									<Alert
										className="mt-3 animate-in fade-in duration-500"
										variant="info"
									>
										<Info className="w-4 h-4" />
										<AlertDescription className="text-xs">
											Click the{' '}
											<span className="font-medium">
												TrendingProducts Service
											</span>{' '}
											layer in the visualization to inspect its code.
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
							<CacheLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/10 rounded-lg p-3 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Cache Hit
										</div>
										<div className="text-2xl font-bold text-success tabular-nums">
											{stressTest.allowedCount}
										</div>
									</div>
									<div className="bg-destructive/10 rounded-lg p-3 text-center">
										<div className="text-xs text-muted-foreground mb-1">
											Miss / Invalidation
										</div>
										<div className="text-2xl font-bold text-destructive tabular-nums">
											{stressTest.blockedCount}
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
					levelName="Caching"
					levelNumber={30}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Cache Waterfall: GET /api/v1/products/trending
								</div>
								{vizMode === 'falling' && (
									<span className="text-xs font-mono font-bold tabular-nums text-destructive">
										No cache, falling through to DB...
									</span>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderCacheWaterfall()}</div>

							{/* StageInspector overlay */}
							{inspectorData && (
								<div className="px-6">
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								</div>
							)}

							{/* Probe terminal */}
							<div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
								<ProbeTerminal
									className="flex-1 flex flex-col"
									disabled={vizAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Performance Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
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
								{/* Terminal steps (0, 1, 2) */}
								{currentStepType === 'terminal' &&
									terminalStepConfigs[stepper.currentStep] && (
										<TerminalChoiceStep
											commands={
												terminalStepConfigs[stepper.currentStep].commands
											}
											completed={isViewingCompletedStep}
											description={
												terminalStepConfigs[stepper.currentStep].description
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={
												terminalStepConfigs[stepper.currentStep].outputLines
											}
											stepKey={stepper.currentStep}
											title={terminalStepConfigs[stepper.currentStep].title}
										/>
									)}

								{/* OptionCard steps (3, 4, 5) */}
								{currentStepType === 'option' && currentOptionConfig && (
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

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									Solid Cache Active
								</div>
								{vizMode !== 'idle' && (
									<div className="flex items-center gap-2">
										<Zap
											className={cn(
												'w-4 h-4',
												vizMode === 'hit'
													? 'text-success'
													: vizMode === 'invalidation'
														? 'text-destructive'
														: 'text-amber-500',
											)}
										/>
										<span
											className={cn(
												'text-xs font-mono font-bold',
												vizMode === 'hit'
													? 'text-success'
													: vizMode === 'invalidation'
														? 'text-destructive'
														: 'text-amber-600 dark:text-amber-400',
											)}
										>
											{vizMode === 'hit'
												? 'CACHE HIT (2ms)'
												: vizMode === 'invalidation'
													? 'CACHE INVALIDATED'
													: 'CACHE MISS (512ms, now cached)'}
										</span>
									</div>
								)}
							</div>

							{/* Visualization */}
							<div className="px-6 pb-2">{renderCacheWaterfall()}</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									className="flex-1 flex flex-col"
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
							? 'TrendingProducts recomputes on every request. No cache store is configured. 200 req/min * 512ms = the database is drowning.'
							: 'Solid Cache stores results in the database. Rails.cache.fetch returns cached data on hit, computes and stores on miss. touch: true invalidates stale data.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<div className="space-y-3 text-xs">
							<div className="flex items-start gap-2">
								<HardDrive className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										Solid Cache
									</span>
									<div className="text-muted-foreground">
										Rails 8 DB-backed cache store. No Redis needed.
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										Rails.cache.fetch(key, expires_in:)
									</span>
									<div className="text-muted-foreground">
										Atomic read-or-compute. Block runs only on miss.
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<div>
									<span className="text-foreground font-medium">
										touch: true
									</span>
									<div className="text-muted-foreground">
										Child changes cascade updated_at, invalidating cache keys.
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Cache Store Comparison
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Solid Cache (Rails 8 default)
# DB-backed, no infra needed
# ~40% slower reads than Redis
# 6x larger cache, 80% cheaper

# Redis
# In-memory, very fast reads
# Requires separate infrastructure
# Best for pub/sub + data structures

# Memory Store
# Per-process only (dev/test)
# Lost on restart, not shared`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level30Caching;

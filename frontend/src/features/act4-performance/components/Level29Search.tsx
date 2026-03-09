/**
 * Level 29: Search
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 *
 * Phase 1 (WHY - observe): Player fires search queries at the LIKE-based
 *   implementation and discovers performance, ranking, and stemming problems.
 *   Pipeline shows Request -> Controller -> Model -> Database with the DB
 *   node going 'danger' on each probe (Seq Scan, 3200ms).
 * Phase 2 (HOW - build): 5 steps building pg_search full-text search:
 *   Step 0: bundle add pg_search (terminal)
 *   Step 1: Generate migration for tsvector + GIN index (terminal)
 *   Step 2: Include PgSearch::Model in Post (OptionCard)
 *   Step 3: Configure pg_search_scope (OptionCard)
 *   Step 4: Wire up the controller search action (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Search" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire search queries and watch
 *   fast GIN index scans vs blocked slow queries.
 *
 * Teaches: tsvector, tsquery, GIN indexes, pg_search gem
 */

import { ArrowRight, Check, Database, Play, Search, Star, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
	{ id: 'seq-scan', label: 'LIKE forces a sequential scan (3,200ms)' },
	{ id: 'no-ranking', label: 'Results have no relevance ranking' },
	{ id: 'no-stemming', label: '"run" does not match "running"' },
	{ id: 'controller-like', label: 'Controller uses raw LIKE query' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'search-rails',
		label: 'Search "rails"',
		command: 'GET /api/posts?q=rails (50K rows)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'Seq Scan on posts (cost=0.00..1250.00)', color: 'red' },
			{ text: 'Filter: (title ~~ \'%rails%\' OR body ~~ \'%rails%\')', color: 'muted' },
			{ text: 'Rows Removed by Filter: 49,500', color: 'muted' },
			{ text: 'Execution Time: 3,200ms', color: 'red' },
		],
	},
	{
		id: 'search-running',
		label: 'Search "running"',
		command: 'GET /api/posts?q=running (stemming test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: '0 results for "running"', color: 'red' },
			{ text: 'Post titled "Running Tests in RSpec" not found.', color: 'muted' },
			{ text: 'LIKE has no stemming: "running" != "run"', color: 'red' },
		],
	},
	{
		id: 'search-database',
		label: 'Search "database"',
		command: 'GET /api/posts?q=database (ranking test)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'Results returned in insertion order, not relevance.', color: 'red' },
			{ text: 'A title match and a body mention are ranked equally.', color: 'muted' },
			{ text: 'No relevance scoring with LIKE queries.', color: 'red' },
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'search-rails': 'seq-scan',
	'search-running': 'no-stemming',
	'search-database': 'no-ranking',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ dbSublabel: string; dbBadge: string }
> = {
	'search-rails': {
		dbSublabel: 'Seq Scan 50K rows',
		dbBadge: '3,200ms',
	},
	'search-running': {
		dbSublabel: 'No stemming',
		dbBadge: '0 hits',
	},
	'search-database': {
		dbSublabel: 'No ranking',
		dbBadge: 'unordered',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Search Request',
		description:
			'Users send GET /api/posts?q=keyword to find posts. The query parameter is passed straight to a LIKE clause in the database.',
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'The controller builds a raw LIKE query with leading wildcards. This forces PostgreSQL into a sequential scan on every search, regardless of indexes.',
		code: `def index
  @posts = Post.where(
    "title LIKE :q OR body LIKE :q",
    q: "%\#{params[:q]}%"
  )
  render json: @posts
end`,
	},
	model: {
		stageId: 'model',
		title: 'Post Model',
		description:
			'The Post model has no search scope or tsvector column. Every search is a raw LIKE pattern match with no ranking, no stemming, and no way to use an index.',
	},
	database: {
		stageId: 'database',
		title: 'Database (Seq Scan)',
		description:
			'PostgreSQL must scan every row in the posts table for each LIKE query. B-tree indexes cannot help when the pattern starts with %. On 50K rows this takes over 3 seconds.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	controller: 'controller-like',
	database: 'seq-scan',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'exact-term',
		label: 'Search exact term',
		description: 'Search for "rails" with GIN index',
		method: 'GET',
		path: '/api/posts?q=rails',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'stemmed-term',
		label: 'Stemmed search',
		description: '"running" matches "run" via stemming',
		method: 'GET',
		path: '/api/posts?q=running',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'ranked-results',
		label: 'Ranked results',
		description: 'Title matches ranked higher than body',
		method: 'GET',
		path: '/api/posts?q=database',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'multi-word',
		label: 'Multi-word query',
		description: '"ruby testing" uses tsquery AND',
		method: 'GET',
		path: '/api/posts?q=ruby+testing',
		actor: 'user',
		expectedResult: 'allowed',
	},
	{
		id: 'empty-query',
		label: 'Empty search blocked',
		description: 'Empty query string rejected',
		method: 'GET',
		path: '/api/posts?q=',
		actor: 'user',
		expectedResult: 'blocked',
	},
	{
		id: 'sql-injection',
		label: 'SQL injection blocked',
		description: 'Malicious query safely parameterized',
		method: 'GET',
		path: "/api/posts?q=' OR 1=1--",
		actor: 'attacker',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (5 steps: 2 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Add pg_search Gem' },
	{ id: 'generate-migration', title: 'Generate Search Migration' },
	{ id: 'include-module', title: 'Include PgSearch in Model' },
	{ id: 'configure-scope', title: 'Configure Search Scope' },
	{ id: 'wire-controller', title: 'Wire Up the Controller' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add pg_search
	'terminal', // 1: rails generate migration
	'option', // 2: include PgSearch::Model
	'option', // 3: pg_search_scope config
	'option', // 4: controller search action
];

// ──────────────────────────────────────────────
// Step 0: Add pg_search Gem (Terminal)
// ──────────────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install pg_search',
		command: 'gem install pg_search',
		correct: false,
		feedback:
			'That installs the gem system-wide, not into your project. You need it in the Gemfile so the app can load it.',
	},
	{
		id: 'correct',
		label: 'bundle add pg_search',
		command: 'bundle add pg_search',
		correct: true,
	},
	{
		id: 'wrong-elasticsearch',
		label: 'bundle add elasticsearch-model',
		command: 'bundle add elasticsearch-model',
		correct: false,
		feedback:
			'Elasticsearch is a separate search engine. PostgreSQL has built-in full-text search that handles most needs without extra infrastructure.',
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching pg_search 2.3.7', color: 'cyan' },
	{ text: 'Installing pg_search 2.3.7', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 1: Generate Migration (Terminal)
// ──────────────────────────────────────────────

const generateMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-model-gen',
		label: 'rails generate model SearchIndex',
		command: 'rails generate model SearchIndex',
		correct: false,
		feedback:
			'Full-text search does not need a separate model. You add a tsvector column and GIN index to the existing posts table via a migration.',
	},
	{
		id: 'wrong-no-gin',
		label: 'rails generate migration AddSearchToPosts searchable:tsvector',
		command: 'rails generate migration AddSearchToPosts searchable:tsvector',
		correct: false,
		feedback:
			'A tsvector column alone is not enough. Without a GIN index, full-text search still does a sequential scan.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddSearchToPosts',
		command: 'rails generate migration AddSearchToPosts',
		correct: true,
	},
];

const generateMigrationOutput: TerminalOutputLine[] = [
	{
		text: '      create  db/migrate/20240101_add_search_to_posts.rb',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addGemCommands, outputLines: addGemOutput },
	{ commands: generateMigrationCommands, outputLines: generateMigrationOutput },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
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

// Step 2: Include PgSearch in Model
const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-concern',
		label: 'include Searchable',
		correct: false,
		feedback:
			'That would require a custom concern you have not defined. The pg_search gem provides its own module to include.',
	},
	{
		id: 'correct',
		label: 'include PgSearch::Model',
		correct: true,
	},
	{
		id: 'wrong-ar',
		label: 'include ActiveRecord::FullTextSearch',
		correct: false,
		feedback:
			'ActiveRecord does not have a built-in FullTextSearch module. pg_search provides the integration layer.',
	},
];

// Step 3: Configure pg_search_scope
const SCOPE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-like-scope',
		label: "scope :search, ->(q) {\n  where(\"title LIKE ?\", \"%#{q}%\")\n}",
		correct: false,
		feedback:
			'That is the same LIKE approach you are replacing. pg_search provides a DSL that uses tsvector under the hood.',
	},
	{
		id: 'wrong-no-weights',
		label: "pg_search_scope :search,\n  against: [:title, :body]",
		correct: false,
		feedback:
			'Passing columns as an array gives them equal weight. Title matches should rank higher than body matches for better relevance.',
	},
	{
		id: 'correct',
		label: "pg_search_scope :search,\n  against: { title: 'A', body: 'B' },\n  using: {\n    tsearch: { dictionary: 'english' }\n  }",
		correct: true,
	},
];

// Step 4: Wire Up Controller
const CONTROLLER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-raw-sql',
		label: "Post.where(\"searchable @@ plainto_tsquery(?)\", q)",
		correct: false,
		feedback:
			'Writing raw SQL defeats the purpose of pg_search. The gem provides a clean scope you already defined.',
	},
	{
		id: 'correct',
		label: 'Post.search(params[:q])',
		correct: true,
	},
	{
		id: 'wrong-like-fallback',
		label: "Post.where(\"title ILIKE ?\", \"%#{params[:q]}%\")",
		correct: false,
		feedback:
			'ILIKE is still a pattern match that cannot use GIN indexes. Use the pg_search scope for full-text search.',
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
	2: {
		title: 'Include PgSearch in Model',
		description:
			'The pg_search gem is installed. Now the Post model needs to load the search module so you can define search scopes.',
		options: INCLUDE_OPTIONS,
	},
	3: {
		title: 'Configure Search Scope',
		description:
			'Define how pg_search indexes your content. Title matches should rank higher than body matches. Use the English dictionary for stemming.',
		options: SCOPE_OPTIONS,
	},
	4: {
		title: 'Wire Up the Controller',
		description:
			'The search scope is ready. How should the controller use it when a query parameter is present?',
		options: CONTROLLER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'clean' },
	{ from: 'model', to: 'database', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the broken LIKE-based code
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def index
    if params[:q].present?
      @posts = Post.where(
        "title LIKE :q OR body LIKE :q",
        q: "%\#{params[:q]}%"
      )
    else
      @posts = Post.all
    end
    render json: @posts
  end
end

# EXPLAIN for LIKE '%rails%':
# Seq Scan on posts  (cost=0.00..1250.00)
#   Filter: (title ~~ '%rails%')
#   Rows Removed by Filter: 49,500
#   Execution Time: 3,200ms`,
			highlight: [4, 5, 6],
		});
		return files;
	}

	// Build / activate / reward phases: evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def index
    @posts = Post.where(
      "title LIKE :q OR body LIKE :q",
      q: "%\#{params[:q]}%"
    )
    render json: @posts
  end
end`,
			highlight: [3, 4, 5],
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
gem "pg_search"`,
			highlight: [6],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'db/migrate/add_search_to_posts.rb',
			language: 'ruby',
			code: `class AddSearchToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :searchable, :tsvector
    add_index :posts, :searchable, using: :gin

    execute <<-SQL
      CREATE TRIGGER posts_search_update
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(
          searchable, 'pg_catalog.english',
          title, body
        );
    SQL
  end
end`,
			highlight: [3, 4],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code:
				furthestStep >= 4
					? `class Post < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search,
    against: { title: 'A', body: 'B' },
    using: {
      tsearch: { dictionary: 'english' }
    }
end`
					: `class Post < ApplicationRecord
  include PgSearch::Model
end`,
			highlight: furthestStep >= 4 ? [4, 5, 6, 7, 8] : [2],
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def index
    @posts = if params[:q].present?
      Post.search(params[:q])
    else
      Post.all
    end
    render json: @posts
  end
end`,
			highlight: [3, 4],
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
				Search Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Fast search (GIN index, ranked results)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Query rejected (empty/invalid input)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level29Search({ onComplete }: LevelComponentProps) {
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
				id: 'request',
				label: 'Request',
				sublabel: 'GET /api/posts?q=...',
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? 'LIKE %query%' : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Post',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: probeDisplay ? probeDisplay.dbSublabel : 'Waiting...',
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
			{ id: 'request', label: 'Request' },
			{ id: 'controller', label: 'Controller' },
			{
				id: 'model',
				label: 'Post',
				sublabel: wasBlocked ? 'rejected' : 'pg_search',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
			},
			{
				id: 'database',
				label: 'Database',
				sublabel: wasBlocked ? 'no query' : 'GIN Scan 2ms',
				badge: wasBlocked ? 'BLOCKED' : undefined,
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
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

			// Trigger discovery if this stage has one
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

	const handleActivateSearch = () => {
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
		return { valid: true, message: 'Full-text search deployed!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Users want to search posts by keyword, but the current
							implementation uses{' '}
							<span className="text-foreground font-medium">
								LIKE &apos;%query%&apos;
							</span>{' '}
							which takes 3 seconds on 50K posts. No relevance ranking, no
							stemming, and no way to use an index.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							PostgreSQL has built-in full-text search using{' '}
							<span className="text-foreground font-medium">tsvector</span> and{' '}
							<span className="text-foreground font-medium">GIN indexes</span>.
							The{' '}
							<span className="text-foreground font-medium">pg_search</span> gem
							wraps this in a clean Rails DSL.
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
										<div className="text-xs text-success/70">Fast Results</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Rejected</div>
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
					levelName="Search"
					levelNumber={29}
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
									title="Search Probe"
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
								{/* Terminal steps (0: gem install, 1: migration) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													pg_search provides a clean Ruby DSL for PostgreSQL
													full-text search. Add it to your project dependencies.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={addGemOutput}
											stepKey={stepper.currentStep}
											title="Add pg_search Gem"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={generateMigrationCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Full-text search needs a tsvector column and a GIN
													index on the posts table. Generate the migration file.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={generateMigrationOutput}
											stepKey={stepper.currentStep}
											title="Generate Search Migration"
										/>
									)}

								{/* OptionCard steps (2, 3, 4) */}
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
									Full-text search with GIN index is ready. Fire search queries
									and watch results return in under 2ms.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateSearch}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Search
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
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level29Search;

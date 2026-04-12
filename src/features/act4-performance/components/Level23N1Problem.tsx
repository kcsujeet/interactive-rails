/**
 * Level 23: The N+1 Problem
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click 3 spatial zones
 *   (Controller, Serializer, Database) in a React Flow canvas. Fire API
 *   probes to watch queries cascade via animated SVG dots along edges.
 *   The Serializer->Database edge floods with red dots. Database node
 *   enters a panic blink state as the query log fills up.
 * Phase 2 (HOW - build): 3 steps setting up N+1 detection with Prosopite
 *   Step 0: bundle add prosopite pg_query (terminal)
 *   Step 1: Configure Prosopite in development.rb (OptionCard)
 *   Step 2: Enable strict_loading on the model (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Same 3-zone React Flow layout
 *   shows the fix. Fire patterns and watch Prosopite detect N+1 vs. safe.
 *
 * Teaches: N+1 query problem, Prosopite gem, pg_query, strict_loading
 */

import { ArrowRight, Check, Info, X } from 'lucide-react';
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
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	QUERY_DOTS_CLEAN,
	QUERY_DOTS_DANGER,
	QUERY_DOTS_FLOOD,
	QUERY_DOTS_NORMAL,
	type QueryZone,
	type QueryZoneEdge,
	QueryZoneFlow,
} from '@/components/levels/QueryZoneFlow';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { registerLevelCode } from '@/features/codebase-viewer/utils/codebase-registry';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

registerLevelCode('act4-level23-n1-problem', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Flow animation: phase thresholds per zone
// ──────────────────────────────────────────────

/** Phase threshold at which each zone highlights */
const ZONE_PHASE_THRESHOLD: Record<string, number> = {
	controller: 0,
	serializer: 2,
	database: 4,
};

// ──────────────────────────────────────────────
// Zone icon mapping (for QueryZoneFlow)
// ──────────────────────────────────────────────

const ZONE_ICON_MAP: Record<string, 'server' | 'search' | 'database'> = {
	controller: 'server',
	serializer: 'search',
	database: 'database',
};

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'n1-pattern', label: 'N+1 query pattern in serializer' },
	{ id: 'query-count', label: '101 queries for 100 posts' },
	{ id: 'no-eager-load', label: 'No eager loading on the query' },
	{ id: 'hidden-in-serializer', label: 'N+1 hides inside the serializer' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-posts-5',
		label: 'GET /posts (5 posts)',
		command: 'GET /api/v1/products (5 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'green' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 6', color: 'yellow' },
			{
				text: '  SELECT * FROM products              (1 query)',
				color: 'muted',
			},
			{ text: '  SELECT * FROM users WHERE id = 1 (+1)', color: 'red' },
			{ text: '  SELECT * FROM users WHERE id = 2 (+1)', color: 'red' },
			{ text: '  SELECT * FROM users WHERE id = 3 (+1)', color: 'red' },
			{ text: '  ... 2 more author queries', color: 'red' },
			{ text: '1 + 5 = 6 queries. That is the N+1 pattern.', color: 'yellow' },
		],
		story: [
			'A customer browses the product listing page with 5 products.',
			'Rails loads all 5 products in one query, then calls product.user for each.',
			'Each .user call fires a separate SELECT to fetch the author.',
			'1 query for products + 5 queries for users = 6 total. That is N+1.',
		],
	},
	{
		id: 'get-posts-100',
		label: 'GET /posts (100 posts)',
		command: 'GET /api/v1/products (100 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (850ms)', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 101', color: 'red' },
			{
				text: '  SELECT * FROM products                (1 query)',
				color: 'muted',
			},
			{ text: '  SELECT * FROM users WHERE id = ... (x100)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '101 queries, 850ms. Each product.user call fires a query.',
				color: 'red',
			},
		],
		story: [
			'The product catalog grows to 100 items.',
			'Same endpoint, same code. Now 101 queries fire on every request.',
			'Response time jumps to 850ms as the database handles 100 individual lookups.',
			'The N+1 pattern scales linearly: more products means more queries.',
		],
	},
	{
		id: 'get-posts-1000',
		label: 'GET /posts (1000 posts)',
		command: 'GET /api/v1/products (1000 posts in DB)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (4873ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'SQL queries executed: 1001', color: 'red' },
			{
				text: '1001 queries, 4.9 seconds. The page is unusable.',
				color: 'red',
			},
			{
				text: 'Memory: 1,564 MB | Objects allocated: 5,301,574',
				color: 'red',
			},
		],
		story: [
			'Production traffic hits the endpoint with 1,000 products in the database.',
			'1,001 queries fire, taking nearly 5 seconds to complete.',
			'Memory spikes to 1.5 GB as Rails allocates millions of objects.',
			'The page is completely unusable. The N+1 problem has become a crisis.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-posts-5': 'n1-pattern',
	'get-posts-100': 'query-count',
	'get-posts-1000': 'no-eager-load',
};

// ──────────────────────────────────────────────
// Probe zone display data (3-zone visualization)
// ──────────────────────────────────────────────

interface ProbeZoneData {
	controllerBadge: string;
	serializerCount: number;
	dbTotalQueries: number;
	dbTime: string;
}

const PROBE_ZONE_MAP: Record<string, ProbeZoneData> = {
	'get-posts-5': {
		controllerBadge: '1 query',
		serializerCount: 5,
		dbTotalQueries: 6,
		dbTime: '~2.4ms',
	},
	'get-posts-100': {
		controllerBadge: '1 query',
		serializerCount: 100,
		dbTotalQueries: 101,
		dbTime: '~850ms',
	},
	'get-posts-1000': {
		controllerBadge: '1 query',
		serializerCount: 1000,
		dbTotalQueries: 1001,
		dbTime: '~4.9s',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	controller: {
		stageId: 'controller',
		title: 'PostsController#index',
		description:
			'The controller delegates to PostList service. The service loads posts with Product.all, firing just 1 query. The problem is not here.',
		code: `# app/controllers/api/v1/products_controller.rb
def index
  result = PostList.call(params:)
  render json: ProductSerializer.new(result.posts)
end

# app/services/post_list.rb
class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    contract = ListContract.new.call(params)
    products = Product.all  # 1 query, no includes
    Result.new(success?: true, posts:, errors: [])
  end
end`,
	},
	serializer: {
		stageId: 'serializer',
		title: 'ProductSerializer (the culprit)',
		description:
			'The serializer accesses product.user.name for every product. Each call triggers a separate SELECT query because the user association was never preloaded.',
		code: `class ProductSerializer < BaseSerializer
  attribute :title
  attribute :author_name do |post|
    product.user.name  # <-- N+1 trigger!
  end
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database (overwhelmed)',
		description:
			'The database receives 1 query for posts, then 1 query per post for the author. With 100 posts that is 101 queries. With 1000 posts, 1001 queries. It scales linearly with data size.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	serializer: 'hidden-in-serializer',
	database: 'no-eager-load',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'posts-no-includes',
		label: 'PostList (no includes)',
		description:
			'Service loads posts without eager loading, serializer accesses .user',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'blocked',
	},
	{
		id: 'posts-with-includes',
		label: 'PostList (with includes)',
		description: 'Service loads posts with eager-loaded users',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'allowed',
	},
	{
		id: 'reviews-no-includes',
		label: 'ProductList + .reviews.count',
		description:
			'Service loads posts, serializer counts reviews without counter cache',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'PostList.call',
		expectedResult: 'blocked',
	},
	{
		id: 'find-each-n1',
		label: 'find_each { |p| p.user }',
		description: 'find_each block accessing association without preloading',
		method: 'TASK',
		path: '/jobs/export_posts',
		actor: 'find_each block',
		expectedResult: 'blocked',
	},
	{
		id: 'preload-scope',
		label: 'policy_scope + preload',
		description: 'Scoped query with preloaded associations',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'scope + preload',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 steps: 1 terminal + 2 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-prosopite', title: 'Add Prosopite Gem' },
	{ id: 'config-prosopite', title: 'Configure Prosopite' },
	{ id: 'strict-loading', title: 'Enable strict_loading' },
];

// Step type: 'terminal' or 'option', indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add prosopite pg_query
	'option', // 1: configure Prosopite
	'option', // 2: enable strict_loading
];

// ──────────────────────────────────────────────
// Step 0: Add Prosopite Gem (Terminal)
// ──────────────────────────────────────────────

const addProsopiteCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install prosopite',
		command: 'gem install prosopite',
		correct: false,
		feedback:
			'That installs system-wide, not into your project. You need it in the Gemfile.',
	},
	{
		id: 'wrong-no-pg-query',
		label: 'bundle add prosopite',
		command: 'bundle add prosopite',
		correct: false,
		feedback:
			'Prosopite needs pg_query for SQL fingerprinting on ProductgreSQL. Without it, Prosopite cannot group similar queries to detect N+1 patterns.',
	},
	{
		id: 'correct',
		label: 'bundle add prosopite pg_query',
		command: 'bundle add prosopite pg_query',
		correct: true,
	},
];

const addProsopiteOutput: TerminalOutputLine[] = [
	{ text: 'Fetching prosopite 1.4.2', color: 'cyan' },
	{ text: 'Fetching pg_query 5.1.0', color: 'cyan' },
	{ text: 'Installing prosopite 1.4.2', color: 'muted' },
	{ text: 'Installing pg_query 5.1.0', color: 'muted' },
	{ text: 'Bundle complete! 15 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// OptionCard step data type
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addProsopiteCommands, outputLines: addProsopiteOutput },
	null, // step 1: OptionCard (configure Prosopite)
	null, // step 2: OptionCard (strict_loading)
];

// ──────────────────────────────────────────────
// Steps 1, 3, 4: OptionCard data
// ──────────────────────────────────────────────

const PROSOPITE_CONFIG_OPTIONS: StepOption[] = [
	{
		id: 'wrong-log-only',
		label: 'config.after_initialize do\n  Prosopite.rails_logger = true\nend',
		correct: false,
		feedback:
			'Logging alone means N+1 warnings get buried in the log. You want it to stop execution so you notice immediately.',
	},
	{
		id: 'correct',
		label:
			'config.after_initialize do\n  Prosopite.rails_logger = true\n  Prosopite.raise = true\nend',
		correct: true,
	},
	{
		id: 'wrong-prod',
		label:
			'config.after_initialize do\n  Prosopite.raise = true\n  Prosopite.prosopite_logger = true\nend',
		correct: false,
		feedback:
			'prosopite_logger writes to a separate file but does not feed into the Rails log. Use rails_logger so N+1 warnings appear alongside your normal log output.',
	},
];

const STRICT_LOADING_OPTIONS: StepOption[] = [
	{
		id: 'wrong-global',
		label:
			'# config/application.rb\nconfig.active_record.strict_loading_by_default = true',
		correct: false,
		feedback:
			'Enabling strict_loading globally on every model in the entire app is too aggressive. It breaks legitimate lazy loading everywhere. Start with the specific model that has the N+1.',
	},
	{
		id: 'correct',
		label:
			'# app/models/product.rb\nclass Product < ApplicationRecord\n  self.strict_loading_by_default = true\nend',
		correct: true,
	},
	{
		id: 'wrong-scope',
		label: '# app/models/product.rb\nscope :safe, -> { strict_loading }',
		correct: false,
		feedback:
			'A scope only applies when explicitly used. Developers will forget to chain it. The default should enforce it.',
	},
];

// Map from step index -> OptionCard data for option-type steps
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Configure Prosopite',
		description:
			'Prosopite is installed. Now configure it in config/environments/development.rb so it raises an error when N+1 queries are detected.',
		options: PROSOPITE_CONFIG_OPTIONS,
	},
	2: {
		title: 'Enable strict_loading on Product',
		description:
			'Rails supports strict_loading, which raises an error when you lazy-load an association that was not eager-loaded. Where should you enable it?',
		options: STRICT_LOADING_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Query line generator for database zone cascade
// ──────────────────────────────────────────────

function generateQueryLines(count: number): string[] {
	const lines: string[] = ['SELECT * FROM products'];
	const show = Math.min(count, 6);
	for (let i = 1; i <= show; i++) {
		lines.push(`SELECT * FROM users WHERE id = ${i}`);
	}
	if (count > show) {
		lines.push(`... ${count - show} more queries`);
	}
	return lines;
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unoptimized controller + service + serializer
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def index
    result = PostList.call(params:)
    render json: ProductSerializer.new(result.posts)
  end
end`,
			highlight: [3],
		});
		files.push({
			filename: 'app/services/post_list.rb',
			language: 'ruby',
			code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    contract = ListContract.new.call(params)
    products = Product.all  # 1 query, no includes!
    Result.new(success?: true, posts:, errors: [])
  end
end`,
			highlight: [6],
		});
		files.push({
			filename: 'app/serializers/product_serializer.rb',
			language: 'ruby',
			code: `class ProductSerializer < BaseSerializer
  attribute :title
  attribute :body

  attribute :author_name do |post|
    product.user.name  # +1 query PER POST!
  end
end`,
			highlight: [6],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/services/post_list.rb',
			language: 'ruby',
			code: `class PostList < ApplicationService
  Result = Data.define(:success?, :posts, :errors)

  def call
    contract = ListContract.new.call(params)
    products = Product.all  # no includes!
    Result.new(success?: true, posts:, errors: [])
  end
end`,
			highlight: [6],
		});
		files.push({
			filename: 'app/serializers/product_serializer.rb',
			language: 'ruby',
			code: `class ProductSerializer < BaseSerializer
  attribute :title
  attribute :body

  attribute :author_name do |post|
    product.user.name  # +1 query PER POST!
  end
end`,
			highlight: [6],
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
gem "prosopite"
gem "pg_query"`,
			highlight: [6, 7],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'config/environments/development.rb',
			language: 'ruby',
			code: `Rails.application.configure do
  # Prosopite: N+1 detection
  config.after_initialize do
    Prosopite.rails_logger = true
    Prosopite.raise = true
  end
end`,
			highlight: [4, 5],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews, dependent: :destroy

  self.strict_loading_by_default = true
end`,
			highlight: [5],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Detection Legend (reward phase)
// ──────────────────────────────────────────────

function DetectionLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Detection Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Safe query (preloaded)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						N+1 detected (Prosopite raises)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level23N1Problem({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 4,
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
	const [firedProbeCount, setFiredProbeCount] = useState(0);

	// ── Flow animation state ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [isAnimating, setIsAnimating] = useState(false);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(() => {
		clearFlow();
		setVisibleQueryCount(0);
		setLoopCounter(0);
		setFlowPhase(0);
		setIsAnimating(true);

		const delays = [0, 600, 1200, 1800, 2400];
		for (let i = 1; i < delays.length; i++) {
			const t = setTimeout(() => setFlowPhase(i), delays[i]);
			flowTimeoutsRef.current.push(t);
		}
		// Re-enable controls after animation completes + cascade buffer
		const t = setTimeout(() => setIsAnimating(false), delays[4] + 1500);
		flowTimeoutsRef.current.push(t);
	}, [clearFlow]);

	useEffect(() => clearFlow, [clearFlow]);

	// ── Query cascade animation (database zone, observe phase) ──
	const [visibleQueryCount, setVisibleQueryCount] = useState(0);

	const queryLines = useMemo(() => {
		if (!lastProbeId) return [];
		const zoneData = PROBE_ZONE_MAP[lastProbeId];
		if (!zoneData) return [];
		return generateQueryLines(zoneData.serializerCount);
	}, [lastProbeId]);

	useEffect(() => {
		if (phase !== 'observe' || flowPhase !== 4 || !lastProbeId) return;
		const zoneData = PROBE_ZONE_MAP[lastProbeId];
		if (!zoneData) return;

		const totalLines = generateQueryLines(zoneData.serializerCount).length;
		const interval = zoneData.serializerCount > 100 ? 30 : 60;
		let count = 0;

		const id = setInterval(() => {
			count++;
			if (count >= totalLines) {
				clearInterval(id);
			}
			setVisibleQueryCount(count);
		}, interval);

		return () => clearInterval(id);
	}, [phase, flowPhase, lastProbeId]);

	// ── Serializer loop counter animation (observe phase) ──
	const [loopCounter, setLoopCounter] = useState(0);

	useEffect(() => {
		if (phase !== 'observe' || flowPhase !== 2 || !lastProbeId) return;
		const zoneData = PROBE_ZONE_MAP[lastProbeId];
		if (!zoneData) return;

		const target = Math.min(zoneData.serializerCount, 8);
		const interval = zoneData.serializerCount > 100 ? 40 : 80;
		let count = 1;
		setLoopCounter(1);

		const id = setInterval(() => {
			count++;
			if (count > target) {
				clearInterval(id);
				return;
			}
			setLoopCounter(count);
		}, interval);

		return () => clearInterval(id);
	}, [phase, flowPhase, lastProbeId]);

	// ── Current probe zone data ──
	const probeZoneData = lastProbeId ? PROBE_ZONE_MAP[lastProbeId] : null;

	// ── Reward phase: last stress test result ──
	const [lastRewardResult, setLastRewardResult] = useState<
		'allowed' | 'blocked' | null
	>(null);

	// ── Build QueryZone[] / QueryZoneEdge[] for observe phase ──
	const observeZones: QueryZone[] = useMemo(() => {
		const zoneIds = ['controller', 'serializer', 'database'] as const;
		return zoneIds.map((zoneId) => {
			const isActive = flowPhase >= ZONE_PHASE_THRESHOLD[zoneId];
			const isPanic = zoneId === 'database' && flowPhase >= 4;

			const zone: QueryZone = {
				id: zoneId,
				label: zoneId.charAt(0).toUpperCase() + zoneId.slice(1),
				icon: ZONE_ICON_MAP[zoneId],
				inspectable: true,
				inspected: inspectedStages.has(zoneId),
			};

			// Highlight state
			if (isPanic) {
				zone.highlighted = true;
				zone.highlightColor = 'red';
				zone.panic = true;
			} else if (isActive) {
				zone.highlighted = true;
				zone.highlightColor = zoneId === 'controller' ? 'green' : 'red';
			}

			// Zone-specific content
			if (zoneId === 'controller') {
				zone.codeLine = 'PostList.call(params:)';
				if (isActive && probeZoneData) {
					zone.badge = { text: probeZoneData.controllerBadge, color: 'green' };
				}
			} else if (zoneId === 'serializer') {
				zone.codeLine = 'product.user.name';
				if (isActive && probeZoneData) {
					zone.loopCounter = {
						current: loopCounter,
						total: probeZoneData.serializerCount,
					};
					zone.badge = {
						text: `x${probeZoneData.serializerCount} queries`,
						color: 'red',
					};
				}
			} else if (zoneId === 'database') {
				if (isActive && probeZoneData) {
					zone.queryLog = {
						lines: queryLines,
						visibleCount: visibleQueryCount,
					};
					zone.badge = {
						text: `${probeZoneData.dbTotalQueries} queries (${probeZoneData.dbTime})`,
						color: probeZoneData.dbTotalQueries > 10 ? 'red' : 'yellow',
					};
				} else {
					zone.waitingText = '(waiting)';
				}
			}

			return zone;
		});
	}, [
		flowPhase,
		inspectedStages,
		probeZoneData,
		loopCounter,
		queryLines,
		visibleQueryCount,
	]);

	const observeEdges: QueryZoneEdge[] = useMemo(() => {
		const fc1Active = flowPhase === 1;
		const fc2Active = flowPhase >= 3 && flowPhase <= 4;
		return [
			{
				from: 'controller',
				to: 'serializer',
				dots: QUERY_DOTS_NORMAL,
				active: fc1Active,
			},
			{
				from: 'serializer',
				to: 'database',
				dots: QUERY_DOTS_FLOOD,
				active: fc2Active,
				danger: true,
			},
		];
	}, [flowPhase]);

	// ── Build QueryZone[] / QueryZoneEdge[] for reward phase ──
	const rewardZones: QueryZone[] = useMemo(() => {
		const zoneIds = ['controller', 'serializer', 'database'] as const;
		return zoneIds.map((zoneId) => {
			const isActive = flowPhase >= ZONE_PHASE_THRESHOLD[zoneId];
			const _isAllowed = lastRewardResult === 'allowed';
			const isBlocked = lastRewardResult === 'blocked';

			const zone: QueryZone = {
				id: zoneId,
				label: zoneId.charAt(0).toUpperCase() + zoneId.slice(1),
				icon: ZONE_ICON_MAP[zoneId],
			};

			// Controller is always green when active
			if (zoneId === 'controller') {
				if (isActive) {
					zone.highlighted = true;
					zone.highlightColor = 'green';
				}
				zone.codeLine = 'PostList.call(params:)';
				if (isActive) {
					zone.badge = { text: '2 queries (eager loaded)', color: 'green' };
				}
			} else if (zoneId === 'serializer') {
				if (isActive && lastRewardResult) {
					zone.highlighted = true;
					zone.highlightColor = isBlocked ? 'red' : 'green';
					zone.statusText = {
						text: isBlocked ? 'N+1 DETECTED!' : 'Prosopite OK',
						color: isBlocked ? 'red' : 'green',
					};
					if (isBlocked) {
						zone.statusBadge = { text: 'RAISE', color: 'red' };
					}
				} else {
					zone.waitingText = 'Monitoring...';
				}
			} else if (zoneId === 'database') {
				if (isActive && lastRewardResult) {
					zone.highlighted = true;
					zone.highlightColor = isBlocked ? 'red' : 'green';
					zone.statusText = {
						text: isBlocked ? 'N+1 pattern' : '2 queries',
						color: isBlocked ? 'red' : 'green',
					};
					zone.statusBadge = {
						text: isBlocked ? 'RAISE!' : 'Optimized',
						color: isBlocked ? 'red' : 'green',
					};
				} else {
					zone.waitingText = '(waiting)';
				}
			}

			return zone;
		});
	}, [flowPhase, lastRewardResult]);

	const rewardEdges: QueryZoneEdge[] = useMemo(() => {
		const isBlocked = lastRewardResult === 'blocked';
		const fc1Active = flowPhase === 1;
		const fc2Active = flowPhase >= 3 && flowPhase <= 4;
		return [
			{
				from: 'controller',
				to: 'serializer',
				dots: QUERY_DOTS_CLEAN,
				active: fc1Active,
			},
			{
				from: 'serializer',
				to: 'database',
				dots: isBlocked ? QUERY_DOTS_DANGER : QUERY_DOTS_CLEAN,
				active: fc2Active,
				danger: isBlocked,
			},
		];
	}, [flowPhase, lastRewardResult]);

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
			setFiredProbeCount((c) => c + 1);
			runFlow();
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
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

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (scenario) {
				setLastRewardResult(scenario.expectedResult);
			}
			stressTest.fireRequest(scenarioId);
			runFlow();
		},
		[stressTest, runFlow],
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
		return { valid: true, message: 'N+1 detection is deployed!' };
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
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your ProductList service loads posts for the API index endpoint.
							Response times have crept above 2 seconds. The database log
							reveals a devastating pattern: 1 query for posts, then 1 query for
							EACH author.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The{' '}
							<span className="text-foreground font-medium">N+1 problem</span>{' '}
							is the most common performance killer in Rails apps. You will set
							up <span className="text-foreground font-medium">Prosopite</span>{' '}
							to detect it automatically and enable{' '}
							<span className="text-foreground font-medium">
								strict_loading
							</span>{' '}
							to prevent it at the model level.
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
							{firedProbeCount >= 2 && !discoveryGating.isUnlocked && (
								<Alert
									className="mt-3 animate-in fade-in duration-500"
									variant="info"
								>
									<Info className="w-4 h-4" />
									<AlertDescription className="text-xs">
										{firedProbeCount >= 3 ? (
											<>
												The probes revealed the query pattern. Now click the{' '}
												<span className="font-medium">Serializer</span> zone to
												see where the N+1 hides.
											</>
										) : (
											<>
												Click the zones with{' '}
												<span className="font-medium">?</span> to inspect their
												code
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
							<DetectionLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Safe</div>
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
					levelName="N+1 Problem"
					levelNumber={23}
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
							{/* Query zone flow with 3 clickable zones */}
							<div className="flex-1 relative">
								<QueryZoneFlow
									edges={observeEdges}
									onZoneClick={handleStageClick}
									zones={observeZones}
								/>

								{/* Stage Inspector overlay */}
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
								{/* Terminal step (0: prosopite) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addProsopiteCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Prosopite monitors SQL patterns to detect N+1 queries,
													including raw SQL and find_each blocks. It needs
													pg_query for SQL fingerprinting on ProductgreSQL.
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
											outputLines={addProsopiteOutput}
											stepKey={stepper.currentStep}
											title="Add the Prosopite Gem"
										/>
									)}

								{/* OptionCard steps (1, 2) */}
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
							{/* Query zone flow showing the fix */}
							<div className="flex-1 relative">
								<QueryZoneFlow edges={rewardEdges} zones={rewardZones} />
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
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level23N1Problem;

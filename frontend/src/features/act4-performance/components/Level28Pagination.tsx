/**
 * Level 28: Pagination
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Performance pipeline visualization. The player
 *   fires API requests against GET /api/posts and sees how the response grows
 *   with the full dataset. Click pipeline stages to inspect code, fire probes
 *   to discover the response size, memory, and mobile crash problems.
 * Phase 2 (HOW - build): 5 steps (2 terminal + 3 OptionCard) implementing Pagy
 *   Step 0: bundle add pagy (terminal)
 *   Step 1: include Pagy::Backend in ApplicationController (OptionCard)
 *   Step 2: Configure pagy initializer items: 25 (OptionCard)
 *   Step 3: Wire up the index action with pagy (OptionCard)
 *   Step 4: Add Link headers for API clients (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Pagination" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire paginated requests and
 *   watch page sizes, response times, and Link headers.
 *
 * Teaches: Pagy gem, include Pagy::Backend, pagy(), pagy_headers_merge
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
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
	{ id: 'huge-response', label: 'Response is 12MB of JSON' },
	{ id: 'no-pagination', label: 'No pagination in controller' },
	{ id: 'memory-spike', label: 'Server loads 50K records into memory' },
	{ id: 'mobile-crash', label: 'Mobile clients crash parsing response' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-all-posts',
		label: 'GET all posts',
		command: 'GET /api/v1/posts',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912  (12MB!)', color: 'yellow' },
			{ text: 'Transfer-Encoding: chunked', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: '[{"id":1,...},{"id":2,...},...,{"id":50000,...}]',
				color: 'muted',
			},
			{
				text: 'All 50,000 posts returned. No pagination.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-mobile',
		label: 'GET from mobile client',
		command: 'GET /api/v1/posts (iPhone, 3G connection)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: 'Content-Length: 12,582,912', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Downloading 12MB on 3G... 45 seconds elapsed',
				color: 'yellow',
			},
			{
				text: 'JSON.parse() on 50K objects: out of memory.',
				color: 'red',
			},
			{ text: 'App crashed.', color: 'red' },
		],
	},
	{
		id: 'check-memory',
		label: 'Check server memory',
		command: 'rails runner "GC.stat[:heap_live_slots]"',
		responseLines: [
			{ text: '=> 2,847,391 live objects', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Post.includes(:user).all loads 50K AR objects + 50K User objects.',
				color: 'muted',
			},
			{
				text: 'Each request allocates ~180MB before serialization.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-all-posts': 'huge-response',
	'get-mobile': 'mobile-crash',
	'check-memory': 'memory-spike',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ responseSublabel: string; responseBadge: string }
> = {
	'get-all-posts': {
		responseSublabel: '12MB JSON',
		responseBadge: '50K rows!',
	},
	'get-mobile': {
		responseSublabel: 'OOM crash',
		responseBadge: 'CRASH',
	},
	'check-memory': {
		responseSublabel: '180MB alloc',
		responseBadge: '100K objs',
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
			'The controller calls Post.includes(:user).all with no limit. Every row in the posts table is loaded into memory and serialized.',
		code: `def index
  @posts = Post.includes(:user).all
  render json: PostSerializer.new(@posts)
end`,
	},
	model: {
		stageId: 'model',
		title: 'Post.all (50,000 rows)',
		description:
			'Active Record instantiates 50,000 Post objects and 50,000 associated User objects. Each object consumes ~1.8KB of heap memory.',
	},
	serializer: {
		stageId: 'serializer',
		title: 'PostSerializer (no limit)',
		description:
			'The serializer converts all 50K objects to JSON. The resulting payload is 12MB. No pagination metadata, no Link headers, no way for the client to request a subset.',
	},
	response: {
		stageId: 'response',
		title: 'Response (12MB)',
		description:
			'A single 12MB JSON array is sent to the client. Mobile clients on slow connections time out or crash trying to parse the payload. There is no way to request "page 2".',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	controller: 'no-pagination',
	response: 'huge-response',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'page-1',
		label: 'GET page 1 (default)',
		description: 'First page of posts, 25 items',
		method: 'GET',
		path: '/api/v1/posts',
		actor: 'web client',
		expectedResult: 'allowed',
	},
	{
		id: 'page-50',
		label: 'GET page 50',
		description: 'Middle of the dataset',
		method: 'GET',
		path: '/api/v1/posts?page=50',
		actor: 'web client',
		expectedResult: 'allowed',
	},
	{
		id: 'page-2000',
		label: 'GET page 2000 (last)',
		description: 'Last page of 50K posts',
		method: 'GET',
		path: '/api/v1/posts?page=2000',
		actor: 'mobile client',
		expectedResult: 'allowed',
	},
	{
		id: 'mobile-page-1',
		label: 'GET page 1 (mobile)',
		description: 'Mobile client gets paginated response',
		method: 'GET',
		path: '/api/v1/posts?page=1',
		actor: 'iPhone (3G)',
		expectedResult: 'allowed',
	},
	{
		id: 'invalid-page',
		label: 'GET page 99999',
		description: 'Page beyond dataset range',
		method: 'GET',
		path: '/api/v1/posts?page=99999',
		actor: 'API client',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (5 steps: 1 terminal + 4 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Add the Pagy Gem' },
	{ id: 'include-backend', title: 'Include Pagy::Backend' },
	{ id: 'configure-items', title: 'Configure Items Per Page' },
	{ id: 'wire-index', title: 'Paginate the Index Action' },
	{ id: 'add-headers', title: 'Add Link Headers' },
];

// Step type: 'terminal' or 'option', indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add pagy
	'option', // 1: include Pagy::Backend
	'option', // 2: configure items
	'option', // 3: wire pagy into index
	'option', // 4: add Link headers
];

// ──────────────────────────────────────────────
// Step 0: Add the Pagy Gem (Terminal)
// ──────────────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-kaminari',
		label: 'bundle add kaminari',
		command: 'bundle add kaminari',
		correct: false,
		feedback:
			'Kaminari works but is significantly slower. The recommended pagination gem is 40x faster with a smaller memory footprint.',
	},
	{
		id: 'wrong-will-paginate',
		label: 'bundle add will_paginate',
		command: 'bundle add will_paginate',
		correct: false,
		feedback:
			'will_paginate is a legacy gem. The modern alternative is faster and supports offset, cursor, and keyset strategies.',
	},
	{
		id: 'correct',
		label: 'bundle add pagy',
		command: 'bundle add pagy',
		correct: true,
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching pagy 9.3.3', color: 'cyan' },
	{ text: 'Installing pagy 9.3.3', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
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
	{ commands: addGemCommands, outputLines: addGemOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step configs
// ──────────────────────────────────────────────

const INCLUDE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-concern',
		label: 'include Pagy::Frontend',
		correct: false,
		feedback:
			'Pagy::Frontend is for view helpers (HTML pagination links). API controllers need the backend module that provides the pagy() method.',
	},
	{
		id: 'correct',
		label: 'include Pagy::Backend',
		correct: true,
	},
	{
		id: 'wrong-kaminari',
		label: 'include Kaminari::PageScopeMethods',
		correct: false,
		feedback:
			'That is from a different pagination gem. You installed Pagy, so use its controller module.',
	},
];

const CONFIGURE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-100',
		label: 'Pagy::DEFAULT[:items] = 100',
		correct: false,
		feedback:
			'100 items per page is still too large for mobile clients. A typical API page size is much smaller.',
	},
	{
		id: 'wrong-limit',
		label: 'Pagy::DEFAULT[:limit] = 25',
		correct: false,
		feedback:
			'Pagy uses :items for the per-page count, not :limit. Check the Pagy configuration API.',
	},
	{
		id: 'correct',
		label: 'Pagy::DEFAULT[:items] = 25',
		correct: true,
	},
];

const WIRE_INDEX_OPTIONS: StepOption[] = [
	{
		id: 'wrong-kaminari-style',
		label: '@posts = Post.includes(:user).page(params[:page]).per(25)',
		correct: false,
		feedback:
			'That is Kaminari syntax. Pagy uses a different API: the pagy() method returns both metadata and the paginated collection.',
	},
	{
		id: 'correct',
		label: '@pagy, @posts = pagy(Post.includes(:user))',
		correct: true,
	},
	{
		id: 'wrong-manual',
		label: '@posts = Post.includes(:user).limit(25).offset(params[:page].to_i * 25)',
		correct: false,
		feedback:
			'Manual LIMIT/OFFSET works but loses pagination metadata (total count, page links). The gem handles this automatically.',
	},
];

const HEADERS_OPTIONS: StepOption[] = [
	{
		id: 'wrong-body',
		label: 'render json: { data: @posts, meta: { page: @pagy.page } }',
		correct: false,
		feedback:
			'Embedding pagination in the JSON body is non-standard. RFC 5988 specifies Link headers so the payload stays clean.',
	},
	{
		id: 'wrong-custom',
		label: 'response.headers["X-Pagination"] = @pagy.to_json',
		correct: false,
		feedback:
			'Custom headers are non-standard. Pagy has built-in support for RFC 5988 Link headers.',
	},
	{
		id: 'correct',
		label: 'pagy_headers_merge(@pagy)',
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
	1: {
		title: 'Include Pagy::Backend',
		description:
			'Pagy is installed. Your ApplicationController needs the module that provides the pagy() pagination method to all controllers.',
		options: INCLUDE_OPTIONS,
	},
	2: {
		title: 'Configure Items Per Page',
		description:
			'Set the default page size in config/initializers/pagy.rb. The current endpoint returns all 50K posts. Choose a reasonable default.',
		options: CONFIGURE_OPTIONS,
	},
	3: {
		title: 'Paginate the Index Action',
		description:
			'Replace Post.includes(:user).all with a paginated query. Pagy returns a tuple: pagination metadata and the scoped collection.',
		options: WIRE_INDEX_OPTIONS,
	},
	4: {
		title: 'Add Link Headers',
		description:
			'API clients need to know how to fetch the next page. RFC 5988 Link headers are the standard way to communicate pagination URLs without polluting the JSON body.',
		options: HEADERS_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'serializer', dots: 'mixed' },
	{ from: 'serializer', to: 'response', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'pagy', dots: 'clean' },
	{ from: 'pagy', to: 'model', dots: 'clean' },
	{ from: 'model', to: 'serializer', dots: 'clean' },
	{ from: 'serializer', to: 'response', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::PostsController < ApplicationController
  def index
    @posts = Post.includes(:user).all  # ALL 50,000 posts!
    render json: PostSerializer.new(@posts)
  end
end

# Response:
# HTTP/1.1 200 OK
# Content-Length: 12,582,912  (12MB!)
#
# [{"id":1,...},...,{"id":50000,...}]
# No pagination. No Link headers. No way to request "page 2".`,
			highlight: [3],
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
    @posts = Post.includes(:user).all  # ALL 50,000 posts!
    render json: PostSerializer.new(@posts)
  end
end`,
			highlight: [3],
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
gem "pagy"`,
			highlight: [7],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code: `class ApplicationController < ActionController::API
  include Pagy::Backend
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'config/initializers/pagy.rb',
			language: 'ruby',
			code: `# frozen_string_literal: true

Pagy::DEFAULT[:items] = 25`,
			highlight: [3],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/v1/posts_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 5
					? `class Api::V1::PostsController < ApplicationController
  def index
    @pagy, @posts = pagy(Post.includes(:user))
    pagy_headers_merge(@pagy)
    render json: PostSerializer.new(@posts)
  end
end

# Response:
# HTTP/1.1 200 OK
# Link: <http://api.example.com/posts?page=2>; rel="next",
#       <http://api.example.com/posts?page=2000>; rel="last"
# X-Total-Count: 50000
# X-Page: 1
# X-Per-Page: 25
# Content-Length: 6,250  (25 items only!)`
					: `class Api::V1::PostsController < ApplicationController
  def index
    @pagy, @posts = pagy(Post.includes(:user))
    render json: PostSerializer.new(@posts)
  end
end`,
			highlight: furthestStep >= 5 ? [3, 4] : [3],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Paginated response (25 items)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Invalid page (empty result)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level28Pagination({ onComplete }: LevelComponentProps) {
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

	// ── Build observe stages dynamically ──
	const probeDisplay = lastProbeId
		? PROBE_PIPELINE_MAP[lastProbeId]
		: null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{ id: 'request', label: 'Request', inspectable: true, inspected: inspectedStages.has('request') },
			{
				id: 'controller',
				label: 'Controller',
				sublabel: 'Post.all',
				variant: 'danger' as const,
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'Post',
				sublabel: '50K rows',
				variant: 'danger' as const,
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'serializer',
				label: 'Serializer',
				sublabel: probeDisplay ? '12MB JSON' : 'serialize all',
				variant: 'danger' as const,
				inspectable: true,
				inspected: inspectedStages.has('serializer'),
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: probeDisplay ? probeDisplay.responseSublabel : '12MB payload',
				badge: probeDisplay ? probeDisplay.responseBadge : undefined,
				variant: 'danger' as const,
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'controller', label: 'Controller' },
			{
				id: 'pagy',
				label: 'Pagy',
				sublabel: wasBlocked ? 'page out of range' : 'page(n), 25 items',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'EMPTY' : '25/page',
			},
			{ id: 'model', label: 'Post' },
			{ id: 'serializer', label: 'Serializer' },
			{
				id: 'response',
				label: 'Response',
				sublabel: wasBlocked ? '[]' : '6KB + Link headers',
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

	const handleActivatePagination = () => {
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
		return { valid: true, message: 'Pagination is live!' };
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
							GET /api/posts returns all 50,000 posts at once. The response
							is 12MB of JSON. Mobile clients crash, and the server allocates
							180MB per request.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							<span className="text-foreground font-medium">Pagy</span> is
							the recommended pagination gem: 40x faster than Kaminari, tiny
							memory footprint, and built-in Link header support for APIs.
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
										<div className="text-xs text-success/70">Paginated</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">
											Out of Range
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
					levelName="Pagination"
					levelNumber={28}
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
									title="Performance Probe"
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
								{/* Terminal step (0: gem install) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addGemCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Pagy is the fastest Ruby pagination gem: 40x faster
													than Kaminari, 70x faster than will_paginate. Add it
													to your project.
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
											title="Add the Pagy Gem"
										/>
									)}

								{/* OptionCard steps (1, 2, 3, 4) */}
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
									Pagy is wired up. See how paginated responses stay small
									regardless of dataset size.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivatePagination}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Pagination
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

export default Level28Pagination;

/**
 * Level 5: Routes & Request Lifecycle
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): HTTP requests hit the router and get 404 because
 *   routes.rb is empty. The player fires probes and inspects stages to discover
 *   that no routes are defined, no namespace exists, and all requests fail.
 * Phase 2 (HOW - build): 4 steps building RESTful routes under /api/v1/
 *   Step 0: Define resources :posts (OptionCard)
 *   Step 1: Add namespace wrapping (OptionCard)
 *   Step 2: View routes with rails routes (TerminalChoiceStep)
 *   Step 3: Trace the request lifecycle (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Routes" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire HTTP requests at the
 *   routed pipeline and watch them resolve to controller actions.
 *
 * Teaches: resources, namespace, rails routes, request lifecycle
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
	{ id: 'no-routes', label: 'Routes file is empty' },
	{ id: 'get-404', label: 'GET requests return 404' },
	{ id: 'post-404', label: 'POST requests return 404' },
	{ id: 'no-namespace', label: 'No API versioning namespace' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-posts',
		label: 'GET /posts',
		command: 'GET /posts',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No route matches [GET] "/posts"',
				color: 'yellow',
			},
			{
				text: 'The router has no entries. Every request is a dead end.',
				color: 'red',
			},
		],
	},
	{
		id: 'post-posts',
		label: 'POST /posts',
		command: 'POST /posts {"title":"Hello"}',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No route matches [POST] "/posts"',
				color: 'yellow',
			},
			{
				text: 'POST fails too. Without routes, no verb can reach the controller.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-api-posts',
		label: 'GET /api/v1/products',
		command: 'GET /api/v1/products',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No route matches [GET] "/api/v1/products"',
				color: 'yellow',
			},
			{
				text: 'Even the versioned API path fails. No namespace is configured.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-posts': 'get-404',
	'post-posts': 'post-404',
	'get-api-posts': 'no-namespace',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ routerSublabel: string; routerBadge: string }
> = {
	'get-posts': {
		routerSublabel: 'GET /posts',
		routerBadge: '404!',
	},
	'post-posts': {
		routerSublabel: 'POST /posts',
		routerBadge: '404!',
	},
	'get-api-posts': {
		routerSublabel: 'GET /api/v1/products',
		routerBadge: '404!',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming HTTP Request',
		description:
			'An HTTP request arrives with a verb (GET, POST, PATCH, DELETE) and a URL path. The router must match this combination to a controller action.',
	},
	router: {
		stageId: 'router',
		title: 'Router (Empty!)',
		description:
			'config/routes.rb is empty. No routes are defined, so every request gets a 404 response. The controller is unreachable.',
		code: `# config/routes.rb
Rails.application.routes.draw do
  # Nothing here...
end`,
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController (Unreachable)',
		description:
			'The controller exists and has all five RESTful actions defined, but without routes, no HTTP request can reach it.',
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			'The Product model works perfectly in the console (Level 3-4). But the outside world cannot trigger it because requests never reach the controller.',
	},
	response: {
		stageId: 'response',
		title: 'Response',
		description:
			'Every response is currently a 404 because no routes exist to dispatch requests to the controller.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	router: 'no-routes',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'get-index',
		label: 'List all products',
		description: 'Fetch the collection of posts',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'post-create',
		label: 'Create a product',
		description: 'Submit a new product',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'get-show',
		label: 'Show one post',
		description: 'Fetch a single post by ID',
		method: 'GET',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'patch-update',
		label: 'Update a product',
		description: 'Modify an existing post',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'delete-destroy',
		label: 'Delete a product',
		description: 'Remove a product by ID',
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 steps: 3 OptionCard + 1 terminal)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'define-resource', title: 'Define Resource' },
	{ id: 'add-namespace', title: 'Add Namespace' },
	{ id: 'view-routes', title: 'View Routes' },
	{ id: 'trace-request', title: 'Trace a Request' },
];

// Step type indexed by step number
const STEP_TYPES: ('terminal' | 'option')[] = [
	'option', // 0: resources :posts
	'option', // 1: namespace wrapping
	'terminal', // 2: rails routes
	'option', // 3: trace request lifecycle
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
// Step 0: Define Resource (OptionCard)
// ──────────────────────────────────────────────

const RESOURCE_OPTIONS: StepOption[] = [
	{
		id: 'get-only',
		label: "get '/posts' => 'posts#index'",
		correct: false,
		feedback:
			'A single GET route only handles one endpoint. You need all 5 RESTful routes generated with one line.',
	},
	{
		id: 'match',
		label: "match '/posts', to: 'posts#index'",
		correct: false,
		feedback:
			'`match` is for custom one-off routes, not for generating a full set of RESTful endpoints.',
	},
	{
		id: 'resources',
		label: 'resources :posts',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 1: Add Namespace (OptionCard)
// ──────────────────────────────────────────────

const NAMESPACE_OPTIONS: StepOption[] = [
	{
		id: 'scope-only',
		label: "scope '/api/v1' do\n  resources :posts\nend",
		correct: false,
		feedback:
			'scope changes only the URL path, not the controller module. Your controller lives in Api::V1, so you need something that maps both.',
	},
	{
		id: 'correct-namespace',
		label: 'namespace :api do\n  namespace :v1 do\n    resources :posts\n  end\nend',
		correct: true,
	},
	{
		id: 'single-namespace',
		label: "namespace 'api/v1' do\n  resources :posts\nend",
		correct: false,
		feedback:
			'Namespace takes a symbol for each segment. Nesting two namespaces produces the correct module path (Api::V1).',
	},
];

// ──────────────────────────────────────────────
// Step 2: View Routes (Terminal)
// ──────────────────────────────────────────────

const viewRoutesCommands: TerminalCommand[] = [
	{
		id: 'wrong-rake',
		label: 'rake routes',
		command: 'rake routes',
		correct: false,
		feedback:
			'"rake routes" is deprecated. Modern Rails has its own CLI for viewing routes.',
	},
	{
		id: 'correct',
		label: 'rails routes',
		command: 'rails routes',
		correct: true,
	},
	{
		id: 'wrong-show',
		label: 'rails routes:show',
		command: 'rails routes:show',
		correct: false,
		feedback:
			'There is no routes:show task. The command is simpler than you think.',
	},
];

const viewRoutesOutput: TerminalOutputLine[] = [
	{
		text: '      Prefix  Verb    URI Pattern                    Controller#Action',
		color: 'muted',
	},
	{
		text: '  api_v1_posts  GET     /api/v1/products(.:format)        api/v1/posts#index',
		color: 'green',
	},
	{
		text: '               POST    /api/v1/products(.:format)        api/v1/posts#create',
		color: 'cyan',
	},
	{
		text: '   api_v1_post  GET     /api/v1/products/:id(.:format)    api/v1/posts#show',
		color: 'green',
	},
	{
		text: '               PATCH   /api/v1/products/:id(.:format)    api/v1/posts#update',
		color: 'yellow',
	},
	{
		text: '               DELETE  /api/v1/products/:id(.:format)    api/v1/posts#destroy',
		color: 'red',
	},
];

// ──────────────────────────────────────────────
// Step 3: Trace a Request (OptionCard)
// ──────────────────────────────────────────────

const TRACE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-model-first',
		label: 'Request -> Model -> Controller -> Router -> Response',
		correct: false,
		feedback:
			'The model does not receive requests directly. HTTP requests must be dispatched by the router before any code runs.',
	},
	{
		id: 'wrong-no-router',
		label: 'Request -> Controller -> Model -> Response',
		correct: false,
		feedback:
			'Skipping the router means the request has no way to find the right controller. The router is the dispatcher.',
	},
	{
		id: 'correct-lifecycle',
		label: 'Request -> Router -> Controller -> Model -> Response',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: OptionCard (define resource)
	null, // step 1: OptionCard (add namespace)
	{ commands: viewRoutesCommands, outputLines: viewRoutesOutput },
	null, // step 3: OptionCard (trace request)
];

// ──────────────────────────────────────────────
// OptionCard step configs
// ──────────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Define Resource',
		description:
			'Which line in config/routes.rb generates all 5 RESTful routes for posts (index, show, create, update, destroy)?',
		options: RESOURCE_OPTIONS,
	},
	1: {
		title: 'Add Namespace',
		description:
			'The resource creates /posts, but your API controller lives at Api::V1::ProductsController. How do you nest routes under /api/v1/?',
		options: NAMESPACE_OPTIONS,
	},
	3: {
		title: 'Trace the Request Lifecycle',
		description:
			'When a client sends GET /api/v1/products, what is the correct order of the request lifecycle?',
		options: TRACE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Hub layout positions (Controller is the hub)
// ──────────────────────────────────────────────

const HUB_POS = {
	model: { x: 500, y: 180 },
	database: { x: 500, y: 360 },
} as const;

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'response', dots: 'mixed' },
	{ from: 'controller', to: 'model', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'mixed' },
	{ from: 'model', to: 'database', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'response', dots: 'clean' },
	{ from: 'controller', to: 'model', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'clean' },
	{ from: 'model', to: 'database', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show empty routes.rb
	if (phase === 'observe') {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  # No routes defined yet...
end`,
			highlight: [2],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  # No routes defined yet...
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  resources :posts
  # But this creates /posts, not /api/v1/products
  # We need namespaces!
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :posts
    end
  end
end`,
			highlight: [2, 3, 4],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'Route Table',
			language: 'ruby',
			code: `# rails routes
#
# GET    /api/v1/products          => api/v1/posts#index
# POST   /api/v1/products          => api/v1/posts#create
# GET    /api/v1/products/:id      => api/v1/posts#show
# PATCH  /api/v1/products/:id      => api/v1/posts#update
# DELETE /api/v1/products/:id      => api/v1/posts#destroy`,
			highlight: [3, 4, 5, 6, 7],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'Request Lifecycle',
			language: 'ruby',
			code: `# GET /api/v1/products
#
# 1. Request arrives (GET /api/v1/products)
# 2. Router matches: Api::V1::ProductsController#index
# 3. Controller calls: @posts = Product.all
# 4. Model queries DB: SELECT * FROM products
# 5. Controller renders: render json: @posts
# 6. Response: 200 OK with JSON body`,
			highlight: [3, 4, 5, 6, 7, 8],
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
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Routed request (200 OK)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Unrouted request (404)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level5Routes({ onComplete }: LevelComponentProps) {
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
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'router',
				label: 'Router',
				sublabel: probeDisplay ? probeDisplay.routerSublabel : '(empty)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				badge: probeDisplay ? probeDisplay.routerBadge : undefined,
				inspectable: true,
				inspected: inspectedStages.has('router'),
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? 'unreachable' : undefined,
				variant: (probeDisplay ? 'inactive' : 'default') as
					| 'inactive'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: probeDisplay ? '404 Not Found' : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				variant: (probeDisplay ? 'inactive' : 'default') as
					| 'inactive'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				position: HUB_POS.database,
				sublabel: probeDisplay ? 'unreachable' : undefined,
				variant: (probeDisplay ? 'inactive' : 'default') as
					| 'inactive'
					| 'default',
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const scenario = lastResult
			? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
			: null;
		const actionMap: Record<string, string> = {
			'get-index': 'posts#index',
			'post-create': 'posts#create',
			'get-show': 'posts#show',
			'patch-update': 'posts#update',
			'delete-destroy': 'posts#destroy',
		};
		const matchedAction = scenario ? actionMap[scenario.id] : null;
		return [
			{ id: 'request', label: 'Request' },
			{
				id: 'router',
				label: 'Router',
				sublabel: matchedAction ?? 'routes.rb',
				variant: 'active' as const,
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: matchedAction ? `${matchedAction.split('#')[1]}` : undefined,
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: lastResult ? '200 OK' : undefined,
				variant: lastResult ? ('active' as const) : ('default' as const),
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
			},
			{
				id: 'database',
				label: 'Database',
				position: HUB_POS.database,
				variant: 'active' as const,
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

	const handleActivateRoutes = () => {
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
		return { valid: true, message: 'Routes are configured!' };
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
							Posts work in the console (Levels 3-4), and Puma is running
							from Level 2. But HTTP requests from the outside world cannot
							reach your app yet.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The{' '}
							<span className="text-foreground font-medium">router</span> maps
							HTTP verbs and URLs to controller actions. Without routes defined
							in{' '}
							<span className="font-mono text-primary">
								config/routes.rb
							</span>
							, every request returns 404.
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
										<div className="text-xs text-success/70">Routed</div>
									</div>
									<div className="bg-muted/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-muted-foreground">
											{stressTest.results.length}
										</div>
										<div className="text-xs text-muted-foreground/70">Total</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Routes & Request Lifecycle"
					levelNumber={5}
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
									title="HTTP Probe"
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
								{/* Terminal step (2: rails routes) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 2 && (
										<TerminalChoiceStep
											commands={viewRoutesCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Your routes are defined and namespaced. Run the
													command to see all generated routes.
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
											outputLines={viewRoutesOutput}
											stepKey={stepper.currentStep}
											title="View Routes"
										/>
									)}

								{/* OptionCard steps (0, 1, 3) */}
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
									Your routes are defined. Watch HTTP requests flow through
									the router to the right controller action.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateRoutes}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Routes
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

export default Level5Routes;

/**
 * Level 7: The Controller
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Routes exist from L6 but the controller class
 *   is missing. Requests match routes successfully, then crash with
 *   "uninitialized constant" at the Controller stage.
 * Phase 2 (HOW - build): 3 steps (2 terminal + 1 custom interactive)
 *   Step 0: Generate the namespaced controller (terminal)
 *   Step 1: Add the 5 RESTful actions (click-to-select)
 *   Step 2: Test the endpoint with curl (terminal)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire 5 HTTP requests at the
 *   working pipeline and see them resolve successfully.
 *
 * Teaches: rails generate controller, RESTful actions, curl
 */

import { ArrowRight, Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
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
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

registerLevelCode('act1-level7-controller', () =>
	getCodeFiles('reward', STEP_DEFS.length, RESTFUL_ACTIONS),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'routes-work', label: 'Routes resolve correctly' },
	{ id: 'no-controller', label: "Controller class doesn't exist" },
	{ id: 'get-fails', label: 'GET requests fail at controller' },
	{ id: 'post-fails', label: 'Write requests also fail' },
	{ id: 'all-actions-dead', label: 'All five REST actions are dead' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-index',
		label: 'GET /api/products',
		story: [
			'A customer opens the storefront and the app fetches the product catalog.',
			'GET /api/products hits the router, which matches it to products#index.',
			'The router tries to load Api::ProductsController to handle it.',
			'The controller file does not exist, so loading the class fails.',
			'Rails answers 404 and logs "uninitialized constant Api::ProductsController". Routes work, but there is nothing behind them.',
		],
		command: 'GET /api/products',
		responseLines: [
			{ text: 'Routing... matched products#index', color: 'green' },
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'server log: uninitialized constant Api::ProductsController',
				color: 'red',
			},
			{
				text: 'Route matched, but the controller class does not exist.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'post-create',
		label: 'POST /api/products',
		story: [
			'A store admin submits a new product through the dashboard.',
			'The form sends a POST with the product data to /api/products.',
			'The router matches it to products#create and tries to load the controller.',
			'Same failure: Api::ProductsController is not defined anywhere.',
			'The product is never saved. POST returns 404 just like GET.',
		],
		command: 'POST /api/products (body: {name: "Laptop Pro"})',
		responseLines: [
			{ text: 'Routing... matched products#create', color: 'green' },
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'server log: uninitialized constant Api::ProductsController',
				color: 'red',
			},
			{
				text: 'POST fails too. Every route points to a missing class.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'delete-destroy',
		label: 'DELETE /api/products/1',
		story: [
			'An admin removes a discontinued product from the catalog.',
			'DELETE /api/products/1 hits the router, which matches products#destroy.',
			'Rails tries to load the controller class to handle the deletion.',
			'Missing class again. The controller does not exist for any action.',
			'All 5 resourceful routes (index, show, create, update, destroy) are broken.',
		],
		command: 'DELETE /api/products/1',
		responseLines: [
			{ text: 'Routing... matched products#destroy', color: 'green' },
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'server log: uninitialized constant Api::ProductsController',
				color: 'red',
			},
			{
				text: 'DELETE fails too. All 5 routes are dead without a controller.',
				color: 'yellow',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	// 1:1 with DISCOVERY_DEFS probe-sourced entries: each probe unlocks
	// exactly one discovery, so the gate cannot clear without every probe.
	// (routes-work and no-controller come from stage clicks, not probes.)
	'get-index': ['get-fails'],
	'post-create': ['post-fails'],
	'delete-destroy': ['all-actions-dead'],
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{
		routerSublabel: string;
		routerBadge: string;
		controllerSublabel: string;
		controllerBadge: string;
	}
> = {
	'get-index': {
		routerSublabel: 'GET -> products#index',
		routerBadge: 'Matched!',
		controllerSublabel: 'NameError!',
		controllerBadge: '404!',
	},
	'post-create': {
		routerSublabel: 'POST -> products#create',
		routerBadge: 'Matched!',
		controllerSublabel: 'NameError!',
		controllerBadge: '404!',
	},
	'delete-destroy': {
		routerSublabel: 'DELETE -> products#destroy',
		routerBadge: 'Matched!',
		controllerSublabel: 'NameError!',
		controllerBadge: '404!',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'HTTP requests arrive with a verb and path. The router matches them to a controller#action pair.',
	},
	router: {
		stageId: 'router',
		title: 'Router (Working)',
		description:
			'Routes are defined! resources :products under namespace :api maps all 5 RESTful routes. But the controller they point to does not exist yet.',
		code: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    resources :products
  end
end`,
	},
	controller: {
		stageId: 'controller',
		title: 'Controller (Missing!)',
		description:
			'uninitialized constant Api::ProductsController. The file app/controllers/api/products_controller.rb does not exist. You need to generate it.',
		code: `# app/controllers/api/products_controller.rb
# File not found!`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			'The Product model is ready (from Level 3). It has name, description, and price columns. But requests never reach the model because the controller is missing.',
	},
	response: {
		stageId: 'response',
		title: 'Response',
		description:
			'Every response is currently a 404 because the controller class is missing. Rails cannot load it, so it treats the matched route as not found (the server log shows the uninitialized-constant reason).',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	controller: 'no-controller',
	router: 'routes-work',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// All "allowed" since this is Act 1 happy path
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'get-index',
		label: 'GET /api/products',
		description: 'List all products',
		method: 'GET',
		path: '/api/products',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'post-create',
		label: 'POST /api/products',
		description: 'Create a new product',
		method: 'POST',
		path: '/api/products',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'get-show',
		label: 'GET /api/products/1',
		description: 'Show a single product',
		method: 'GET',
		path: '/api/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'patch-update',
		label: 'PATCH /api/products/1',
		description: 'Update an existing product',
		method: 'PATCH',
		path: '/api/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'delete-destroy',
		label: 'DELETE /api/products/1',
		description: 'Delete a product',
		method: 'DELETE',
		path: '/api/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (build phase)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-controller', title: 'Generate Controller' },
	{ id: 'add-actions', title: 'Add Actions' },
	{ id: 'test-endpoint', title: 'Test Endpoint' },
];

// ──────────────────────────────────────────────
// Step 0: Generate Controller (Terminal)
// ──────────────────────────────────────────────

const generateCommands: TerminalCommand[] = [
	{
		id: 'wrong-singular',
		label: 'rails generate controller Product',
		command: 'rails generate controller Product',
		correct: false,
		feedback:
			'Controller names are plural and must include the full route namespace, not just a singular model name.',
	},
	{
		id: 'correct',
		label: 'rails generate controller Api::Products',
		command: 'rails generate controller Api::Products',
		correct: true,
	},
	{
		id: 'wrong-no-namespace',
		label: 'rails generate controller Products',
		command: 'rails generate controller Products',
		correct: false,
		feedback:
			'The controller name must include namespaces to match your route structure, not just the resource name alone.',
	},
];

const generateOutput: TerminalOutputLine[] = [
	{
		text: '      create  app/controllers/api/products_controller.rb',
		color: 'green',
	},
	{ text: '      invoke  test_unit', color: 'muted' },
	{
		text: '      create    test/controllers/api/products_controller_test.rb',
		color: 'muted',
	},
];

// ──────────────────────────────────────────────
// Step 2: Test Endpoint (Terminal)
// ──────────────────────────────────────────────

const testCommands: TerminalCommand[] = [
	{
		id: 'wrong-browser',
		label: 'open http://localhost:3000/api/products',
		command: 'open http://localhost:3000/api/products',
		correct: false,
		feedback:
			'Opening in a browser works for viewing HTML, but API endpoints return JSON. Use a command-line HTTP client to see headers and status codes.',
	},
	{
		id: 'correct',
		label: 'curl localhost:3000/api/products',
		command: 'curl localhost:3000/api/products',
		correct: true,
	},
	{
		id: 'wrong-rails-routes',
		label: 'rails routes',
		command: 'rails routes',
		correct: false,
		feedback:
			'That lists route definitions, but does not actually send an HTTP request to test if the endpoint responds.',
	},
];

const testOutput: TerminalOutputLine[] = [
	{ text: 'HTTP/1.1 200 OK', color: 'green' },
	{ text: 'Content-Type: application/json', color: 'muted' },
	{ text: '', color: 'muted' },
	{ text: '[]', color: 'cyan' },
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateCommands, outputLines: generateOutput },
	null, // step 1: Add Actions (click-to-select)
	{ commands: testCommands, outputLines: testOutput },
];

// ──────────────────────────────────────────────
// Step 1: Add Actions data
// ──────────────────────────────────────────────

const RESTFUL_ACTIONS = ['index', 'show', 'create', 'update', 'destroy'];
const DISTRACTOR_ACTIONS = ['list', 'get', 'add', 'remove', 'new', 'edit'];

const WRONG_ACTION_FEEDBACK: Record<string, string> = {
	list: '"list" is not a Rails convention. There is a standard RESTful name for listing records.',
	get: '"get" is not a Rails action. There is a standard RESTful name for displaying a single record.',
	add: '"add" is not a Rails action. There is a standard RESTful name for saving a new record.',
	remove:
		'"remove" is not a Rails action. There is a standard RESTful name for deleting a record.',
	new: '"new" renders a form in full-stack Rails. API controllers do not need it.',
	edit: '"edit" renders a form in full-stack Rails. API controllers do not need it.',
};

// ──────────────────────────────────────────────
// Hub layout positions (Controller is the hub)
// ──────────────────────────────────────────────

const HUB_POS = {
	model: { x: 500, y: 180 },
	database: { x: 500, y: 360 },
} as const;

// ──────────────────────────────────────────────
// Pipeline connections
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'response', dots: 'mixed' },
	{
		from: 'controller',
		to: 'model',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'mixed',
	},
	{
		from: 'model',
		to: 'database',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'mixed',
	},
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'response', dots: 'clean' },
	{
		from: 'controller',
		to: 'model',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'clean',
	},
	{
		from: 'model',
		to: 'database',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'clean',
	},
];

// Per-probe / per-scenario edge activation. Default to [] (dormant)
// so the visualization does NOT animate before any probe fires.
// Each entry lists the connection keys (`${from}-${to}`) that should
// flash a single dot pulse when the probe / scenario fires.
// Observe: every probe matches a route (request -> router) and tries to
// reach the controller (router -> controller) where it crashes with a
// NameError. Downstream edges (controller -> model, model -> database,
// controller -> response) stay dormant because the controller never runs.
const PROBE_OBSERVE_CONNECTIONS = ['request-router', 'router-controller'];

const PROBE_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'get-index': PROBE_OBSERVE_CONNECTIONS,
	'post-create': PROBE_OBSERVE_CONNECTIONS,
	'delete-destroy': PROBE_OBSERVE_CONNECTIONS,
};

// Reward: every action successfully traverses the full pipeline.
const FULL_PIPELINE_CONNECTIONS = [
	'request-router',
	'router-controller',
	'controller-response',
	'controller-model',
	'model-database',
];

const SCENARIO_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'get-index': FULL_PIPELINE_CONNECTIONS,
	'post-create': FULL_PIPELINE_CONNECTIONS,
	'get-show': FULL_PIPELINE_CONNECTIONS,
	'patch-update': FULL_PIPELINE_CONNECTIONS,
	'delete-destroy': FULL_PIPELINE_CONNECTIONS,
};

// ──────────────────────────────────────────────
// Action body helper
// ──────────────────────────────────────────────

function getActionBody(action: string): string {
	switch (action) {
		case 'index':
			return 'render json: Product.all';
		case 'show':
			return 'render json: Product.find(params[:id])';
		case 'create':
			return 'product = Product.new(params[:product].to_unsafe_h)\n      if product.save\n        render json: product, status: :created\n      else\n        render json: { errors: product.errors }, status: :unprocessable_entity\n      end';
		case 'update':
			return 'product = Product.find(params[:id])\n      if product.update(params[:product].to_unsafe_h)\n        render json: product\n      else\n        render json: { errors: product.errors }, status: :unprocessable_entity\n      end';
		case 'destroy':
			return 'Product.find(params[:id]).destroy\n      head :no_content';
		default:
			return '# ...';
	}
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(
	phase: Phase,
	completedStep: number,
	placedActions: string[],
) {
	const files = [];

	// Observe phase: show routes.rb (working) and missing controller
	if (phase === 'observe') {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    resources :products
  end
end`,
			highlight: [2, 3],
		});
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `# File not found!
# uninitialized constant Api::ProductsController
#
# The router maps routes to this controller,
# but the file does not exist yet.`,
			highlight: [1, 2],
		});
		return files;
	}

	// Build / reward: evolving code preview
	if (completedStep === 0) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `# Generate the controller first...`,
			highlight: [],
		});
	}

	if (completedStep >= 1) {
		const actionCode =
			placedActions.length > 0
				? placedActions
						.map((a) => {
							const body = getActionBody(a);
							return `  def ${a}\n    ${body}\n  end`;
						})
						.join('\n\n')
				: '  # Add actions here...';

		// L7 uses params[:product].to_unsafe_h (the naive Rails 8 shortcut that
		// bypasses strong-params filtering). L13 reveals this as a mass-assignment
		// vulnerability and replaces it with params.expect.
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
${actionCode}
end`,
			highlight: placedActions.map((_, i) => i * 3 + 2),
		});
	}

	if (completedStep >= 3) {
		files.push({
			filename: 'Test Results',
			language: 'ruby',
			code: `# curl localhost:3000/api/products
# => 200 OK
# []
#
# Controller is responding!`,
			highlight: [2, 3],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Reward status code map
// ──────────────────────────────────────────────

const SCENARIO_STATUS_MAP: Record<string, { action: string; status: string }> =
	{
		'get-index': { action: 'index', status: '200' },
		'post-create': { action: 'create', status: '201' },
		'get-show': { action: 'show', status: '200' },
		'patch-update': { action: 'update', status: '200' },
		'delete-destroy': { action: 'destroy', status: '204' },
	};

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
					<span className="text-foreground">Request handled successfully</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level7Controller({ onComplete }: LevelComponentProps) {
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

	// Step 1: placed actions
	const [placedActions, setPlacedActions] = useState<string[]>([]);

	// ── Build observe stages dynamically ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
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
				sublabel: probeDisplay ? probeDisplay.routerSublabel : 'routes.rb',
				variant: 'active' as const,
				badge: probeDisplay ? probeDisplay.routerBadge : undefined,
				inspectable: true,
				inspected: inspectedStages.has('router'),
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? probeDisplay.controllerSublabel : 'Missing!',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				badge: probeDisplay ? probeDisplay.controllerBadge : undefined,
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: probeDisplay ? '404 Not Found' : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				sublabel: probeDisplay ? 'unreachable' : undefined,
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

	// Per-probe edge activation. Default to [] so edges are dormant until
	// the player fires a probe; firing a probe lights only that probe's
	// connections in single-pass mode.
	const observeActiveConnections = useMemo(
		() => (lastProbeId ? (PROBE_ACTIVE_CONNECTIONS[lastProbeId] ?? []) : []),
		[lastProbeId],
	);

	// ── Build reward stages dynamically ──
	const lastResult = stressTest.results[stressTest.results.length - 1];

	// Per-scenario edge activation. Default to [] so the reward pipeline
	// is dormant until the player fires a stress scenario.
	const rewardActiveConnections = useMemo(
		() =>
			lastResult
				? (SCENARIO_ACTIVE_CONNECTIONS[lastResult.scenarioId] ?? [])
				: [],
		[lastResult],
	);
	const rewardStages: PipelineStage[] = useMemo(() => {
		const scenarioInfo = lastResult
			? SCENARIO_STATUS_MAP[lastResult.scenarioId]
			: null;
		return [
			{ id: 'request', label: 'Request' },
			{
				id: 'router',
				label: 'Router',
				variant: 'active' as const,
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: scenarioInfo ? `#${scenarioInfo.action}` : 'Ready',
				variant: 'active' as const,
				badge: scenarioInfo ? scenarioInfo.status : undefined,
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: scenarioInfo ? `${scenarioInfo.status} OK` : undefined,
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
			const discoveryIds = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryIds) {
				for (const id of discoveryIds) {
					discoveryGating.discover(id);
				}
			}
		},
		[discoveryGating],
	);

	// ── Step 1: Action handling ──
	const handleAddAction = useCallback(
		(action: string) => {
			if (RESTFUL_ACTIONS.includes(action)) {
				if (!placedActions.includes(action)) {
					const newPlaced = [...placedActions, action];
					setPlacedActions(newPlaced);

					if (newPlaced.length === RESTFUL_ACTIONS.length) {
						stepper.completeStep();
					}
				}
			} else {
				const fb =
					WRONG_ACTION_FEEDBACK[action] ||
					`"${action}" is not a standard RESTful action.`;
				stepper.recordWrongAttempt(fb);
			}
		},
		[placedActions, stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleStartReward = () => {
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
		return { valid: true, message: 'Controller is ready!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const allActions = [...RESTFUL_ACTIONS, ...DISTRACTOR_ACTIONS].sort();

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
							In L6, you mapped 5 RESTful routes under /api/products. But
							hitting any of those URLs returns a 404 because the controller
							class does not exist yet (the server log shows why).
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The router knows WHERE to send requests, but the controller (the
							code that handles them) is missing. You need to generate it, add
							the 5 RESTful actions, and test the endpoint.
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
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Successful</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Failed</div>
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
					levelName="The Controller"
					levelNumber={7}
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
									activeConnections={observeActiveConnections}
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
							<div className="px-6 pb-4">
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
								{/* Step 0: Generate Controller (Terminal) */}
								{stepper.currentStep === 0 && (
									<TerminalChoiceStep
										commands={generateCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												Your routes live under{' '}
												<span className="font-mono text-primary">
													namespace :api / :v1
												</span>{' '}
												from L6. Generate a controller that matches the
												namespace structure.
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
										outputLines={generateOutput}
										stepKey={stepper.currentStep}
										title="Generate Controller"
									/>
								)}

								{/* Step 1: Add Actions (click-to-select) */}
								{stepper.currentStep === 1 && (
									<div className="space-y-4">
										<h3 className="text-lg font-semibold text-foreground">
											Add Actions
										</h3>
										<p className="text-sm text-muted-foreground">
											Click the 5 standard RESTful actions for an API
											controller. Watch out for distractors that belong to
											full-stack Rails or are not standard conventions.
										</p>

										{/* Action buttons */}
										<div>
											<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
												Actions ({placedActions.length} /{' '}
												{RESTFUL_ACTIONS.length})
											</div>
											<div className="flex flex-wrap gap-1.5">
												{allActions.map((action) => {
													const isPlaced = placedActions.includes(action);
													return (
														<Button
															className={`font-mono text-xs ${
																isPlaced ? 'opacity-50 cursor-not-allowed' : ''
															}`}
															disabled={isPlaced || isViewingCompletedStep}
															key={action}
															onClick={() => handleAddAction(action)}
															size="sm"
															variant={isPlaced ? 'secondary' : 'outline'}
														>
															{action}
														</Button>
													);
												})}
											</div>
										</div>

										{/* Controller skeleton */}
										<div className="bg-card rounded-lg p-4 font-mono text-sm">
											<div className="text-zinc-400">
												class Api::ProductsController {'<'}{' '}
												ApplicationController
											</div>
											{placedActions.map((action) => (
												<div className="ml-4 text-emerald-400" key={action}>
													def {action}
													<div className="ml-4 text-zinc-500">
														{getActionBody(action)}
													</div>
													end
												</div>
											))}
											{placedActions.length < RESTFUL_ACTIONS.length && (
												<div className="ml-4 text-zinc-600 animate-pulse">
													# click actions above...
												</div>
											)}
											<div className="text-zinc-400">end</div>
										</div>

										<ErrorFeedback
											message={stepper.lastFeedback}
											onDismiss={stepper.clearFeedback}
										/>
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
									</div>
								)}

								{/* Step 2: Test Endpoint (Terminal, last step) */}
								{stepper.currentStep === 2 && (
									<TerminalChoiceStep
										commands={testCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												You booted Puma in Level 2, but had no routes or
												controller back then. Now both exist. Hit the endpoint
												to verify it responds.
											</p>
										}
										hasNext
										initialHistory={buildTerminalHistory(
											SHELL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={handleStartReward}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={testOutput}
										stepKey={stepper.currentStep}
										title="Test Endpoint"
									/>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									activeConnections={rewardActiveConnections}
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-4">
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
					files={getCodeFiles(
						phase,
						stepper.isCurrentStepCompleted
							? stepper.currentStep
							: stepper.currentStep - 1,
						placedActions,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Controller;

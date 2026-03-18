/**
 * Level 7: Serializers
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire API probes to discover the raw JSON dump problem.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 5 steps building a jsonapi-serializer setup
 *   Step 0: Choose Gem (OptionCard)
 *   Step 1: Install Gem (TerminalChoiceStep)
 *   Step 2: Base Serializer (OptionCard)
 *   Step 3: Define Attributes (click-to-select)
 *   Step 4: Update Controller (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Serializer" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire request scenarios at the
 *   serialized pipeline and watch clean JSON:API responses.
 *
 * Teaches: jsonapi-serializer gem, BaseSerializer, attribute selection,
 *   serializable_hash, JSON:API format
 */

import { ArrowRight, Check, Play, Star } from 'lucide-react';
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
	{ id: 'raw-dump', label: 'Controller dumps raw model data' },
	{ id: 'no-serializer', label: 'No serialization layer exists' },
	{ id: 'timestamps-exposed', label: 'Bookkeeping columns are exposed' },
	{ id: 'no-jsonapi', label: 'Response is flat JSON, not JSON:API' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-single',
		label: 'GET /api/v1/products/1',
		command: 'GET /api/v1/products/1',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{ text: '{"id":1,"title":"Hello","body":"World",', color: 'muted' },
			{ text: ' "published_at":"2024-01-01T00:00:00.000Z",', color: 'muted' },
			{ text: ' "created_at":"2024-01-01T00:00:00.000Z",', color: 'yellow' },
			{ text: ' "updated_at":"2024-01-01T12:30:00.000Z"}', color: 'yellow' },
			{
				text: 'All 6 columns dumped as flat JSON. No structure, no filtering.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-collection',
		label: 'GET /api/v1/products',
		command: 'GET /api/v1/products',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '[{"id":1,"title":"Hello","body":"World","published_at":...,',
				color: 'muted',
			},
			{
				text: '  "created_at":"...","updated_at":"..."},',
				color: 'yellow',
			},
			{
				text: ' {"id":2,"title":"Second","body":"Product","published_at":...,',
				color: 'muted',
			},
			{ text: '  "created_at":"...","updated_at":"..."}]', color: 'yellow' },
			{
				text: 'Every record exposes all columns including timestamps.',
				color: 'red',
			},
		],
	},
	{
		id: 'get-mobile',
		label: 'GET /posts/1 (mobile)',
		command: 'GET /api/v1/products/1 (mobile client)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{"id":1,"title":"Hello","body":"World",',
				color: 'muted',
			},
			{
				text: ' "published_at":"2024-01-01T00:00:00.000Z",',
				color: 'muted',
			},
			{
				text: ' "created_at":"2024-01-01T00:00:00.000Z",',
				color: 'yellow',
			},
			{ text: ' "updated_at":"2024-01-01T12:30:00.000Z"}', color: 'yellow' },
			{
				text: 'Same bloated response. Mobile downloads unnecessary data on every request.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-single': 'raw-dump',
	'get-collection': 'timestamps-exposed',
	'get-mobile': 'no-jsonapi',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ serializerSublabel: string; responseBadge: string }
> = {
	'get-single': {
		serializerSublabel: 'Bypassed!',
		responseBadge: '6 cols',
	},
	'get-collection': {
		serializerSublabel: 'Bypassed!',
		responseBadge: 'raw[]',
	},
	'get-mobile': {
		serializerSublabel: 'Bypassed!',
		responseBadge: 'bloat!',
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
			'HTTP GET request for a product resource. The client expects clean, structured JSON.',
	},
	router: {
		stageId: 'router',
		title: 'Router (from Level 5)',
		description:
			'Routes match correctly. GET /api/v1/products/1 maps to posts#show. This stage works as expected.',
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'The show action calls `render json: post`. This dumps the entire model as flat JSON with no filtering or structure.',
		code: `def show
  post = Product.find(params[:id])
  render json: post  # Dumps everything!
end`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model (from Level 3)',
		description:
			'The Product model stores title, body, and published_at. It works correctly. The problem is not the model itself, but how the controller renders it: every column is dumped without filtering.',
	},
	serializer: {
		stageId: 'serializer',
		title: 'Serializer (Missing!)',
		description:
			'No serializer exists. Without a serialization layer, `render json: post` calls `.to_json` on the model, which serializes every column including internal timestamps and IDs.',
	},
	response: {
		stageId: 'response',
		title: 'Response (Raw Dump)',
		description:
			'The response is a flat JSON object with all model columns. No JSON:API structure, no attribute filtering. Clients receive bookkeeping fields they do not need.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	serializer: 'no-serializer',
	response: 'timestamps-exposed',
	controller: 'raw-dump',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'get-show',
		label: 'GET single post',
		description: 'Fetch a single post resource',
		method: 'GET',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'get-index',
		label: 'GET collection',
		description: 'Fetch all products as a collection',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'post-create',
		label: 'POST create',
		description: 'Create a new product resource',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'author',
		expectedResult: 'allowed',
	},
	{
		id: 'patch-update',
		label: 'PATCH update',
		description: 'Update an existing post',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'author',
		expectedResult: 'allowed',
	},
	{
		id: 'get-raw-test',
		label: 'GET raw check',
		description: 'Verify no timestamps leak through',
		method: 'GET',
		path: '/api/v1/products/1',
		actor: 'auditor',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (5 steps: 1 terminal + 4 custom)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-gem', title: 'Choose Gem' },
	{ id: 'install-gem', title: 'Install Gem' },
	{ id: 'base-serializer', title: 'Base Serializer' },
	{ id: 'define-attributes', title: 'Define Attributes' },
	{ id: 'update-controller', title: 'Update Controller' },
];

// Step type: 'option' | 'terminal' | 'attributes', indexed by step number
const STEP_TYPES: ('option' | 'terminal' | 'attributes')[] = [
	'option', // 0: Choose Gem
	'terminal', // 1: Install Gem
	'option', // 2: Base Serializer
	'attributes', // 3: Define Attributes
	'option', // 4: Update Controller
];

// ──────────────────────────────────────────────
// Step 0: Choose Gem (OptionCard)
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	description?: string;
	correct: boolean;
	feedback?: string;
}

const GEM_OPTIONS: StepOption[] = [
	{
		id: 'ams',
		label: 'ActiveModelSerializers',
		description: 'Classic Rails serializer',
		correct: false,
		feedback:
			'ActiveModelSerializers is unmaintained and significantly slower. The community has moved on to faster alternatives.',
	},
	{
		id: 'jbuilder',
		label: 'Jbuilder',
		description: 'Template-based JSON builder',
		correct: false,
		feedback:
			'Jbuilder uses view templates for JSON. It adds rendering overhead and is not well-suited for a pure REST API.',
	},
	{
		id: 'jsonapi-serializer',
		label: 'jsonapi-serializer',
		description: 'Fast JSON:API serializer',
		correct: true,
	},
	{
		id: 'blueprinter',
		label: 'Blueprinter',
		description: 'Simple flat JSON serializer',
		correct: false,
		feedback:
			'Blueprinter produces flat JSON, not the JSON:API standard. For public APIs, a standards-compliant format is preferred.',
	},
];

// ──────────────────────────────────────────────
// Step 1: Install Gem (TerminalChoiceStep)
// ──────────────────────────────────────────────

const installCommands: TerminalCommand[] = [
	{
		id: 'gem-install',
		label: 'gem install jsonapi-serializer',
		command: 'gem install jsonapi-serializer',
		correct: false,
		feedback:
			'That installs the gem system-wide, not in your project. Bundler manages per-project dependencies.',
	},
	{
		id: 'generate',
		label: 'rails generate serializer Product',
		command: 'rails generate serializer Product',
		correct: false,
		feedback:
			'No generator is available yet. The gem must be installed first.',
	},
	{
		id: 'bundle-add',
		label: 'bundle add jsonapi-serializer',
		command: 'bundle add jsonapi-serializer',
		correct: true,
	},
];

const installOutput: TerminalOutputLine[] = [
	{
		text: 'Fetching gem metadata from https://rubygems.org/...',
		color: 'muted',
	},
	{ text: 'Resolving dependencies...', color: 'muted' },
	{ text: 'Installing jsonapi-serializer 2.2.0', color: 'green' },
	{
		text: 'Bundle complete! 42 Gemfile dependencies, 78 gems now installed.',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Step 2: Base Serializer (OptionCard)
// ──────────────────────────────────────────────

const BASE_SERIALIZER_OPTIONS: StepOption[] = [
	{
		id: 'legacy-ams',
		label: 'class BaseSerializer < ActiveModel::Serializer\nend',
		correct: false,
		feedback:
			'ActiveModel::Serializer is from a different gem (AMS). The jsonapi-serializer gem uses a module-based approach.',
	},
	{
		id: 'jsonapi-include',
		label: 'class BaseSerializer\n  include JSONAPI::Serializer\nend',
		correct: true,
	},
	{
		id: 'app-serializer',
		label: 'class BaseSerializer < ApplicationSerializer\nend',
		correct: false,
		feedback:
			'ApplicationSerializer does not exist. You need to create the base class yourself using the gem module.',
	},
];

// ──────────────────────────────────────────────
// Step 3: Attribute selection
// ──────────────────────────────────────────────

interface AttributeOption {
	id: string;
	name: string;
	safe: boolean;
	feedback: string;
}

const ATTRIBUTES: AttributeOption[] = [
	{ id: 'title', name: 'title', safe: true, feedback: '' },
	{
		id: 'created_at',
		name: 'created_at',
		safe: false,
		feedback:
			'Serializers are about choosing what your API exposes. created_at is bookkeeping, not domain data clients need.',
	},
	{ id: 'body', name: 'body', safe: true, feedback: '' },
	{
		id: 'updated_at',
		name: 'updated_at',
		safe: false,
		feedback:
			'updated_at tracks internal record changes. Expose domain-relevant fields instead.',
	},
	{ id: 'published_at', name: 'published_at', safe: true, feedback: '' },
	{
		id: 'id',
		name: 'id',
		safe: false,
		feedback:
			'JSON:API puts the id in the top-level data object, not inside attributes. The serializer handles this automatically.',
	},
];

const SAFE_ATTRIBUTES = ATTRIBUTES.filter((a) => a.safe).map((a) => a.id);

// ──────────────────────────────────────────────
// Step 4: Update Controller (OptionCard)
// ──────────────────────────────────────────────

const RENDER_OPTIONS: StepOption[] = [
	{
		id: 'raw-json',
		label: 'render json: post',
		correct: false,
		feedback:
			'That renders the raw model as flat JSON. Every column is dumped with no structure or formatting.',
	},
	{
		id: 'to-json',
		label: 'render json: post.to_json',
		correct: false,
		feedback:
			'to_json also dumps all model attributes. You need to route through the serializer to control the output.',
	},
	{
		id: 'serializer',
		label: 'render json: ProductSerializer.new(product)\n  .serializable_hash.to_json',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: Choose Gem (OptionCard)
	{ commands: installCommands, outputLines: installOutput },
	null, // step 2: Base Serializer (OptionCard)
	null, // step 3: Define Attributes (click-to-select)
	null, // step 4: Update Controller (OptionCard)
];

// ──────────────────────────────────────────────
// OptionCard step config map
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
		title: 'Choose Serializer Gem',
		description:
			'Your API needs a serialization layer. Pick the gem that gives you JSON:API compliance, speed, and active maintenance.',
		options: GEM_OPTIONS,
	},
	2: {
		title: 'Create Base Serializer',
		description:
			'The gem is installed. Now create a BaseSerializer class that all your serializers will inherit from. How do you include the JSON:API serialization module?',
		options: BASE_SERIALIZER_OPTIONS,
	},
	4: {
		title: 'Update Controller',
		description:
			'Replace the raw `render json: post` call in your controller. Route the response through the serializer.',
		options: RENDER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Hub layout positions (Controller is the hub)
// ──────────────────────────────────────────────

const HUB_POS = {
	serializer: { x: 500, y: -180 },
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
	{ from: 'controller', to: 'serializer', sourceHandle: 'top', targetHandle: 'bottom', bidirectional: true, dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'response', dots: 'clean' },
	{ from: 'controller', to: 'model', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'clean' },
	{ from: 'model', to: 'database', sourceHandle: 'bottom', targetHandle: 'top', bidirectional: true, dots: 'clean' },
	{ from: 'controller', to: 'serializer', sourceHandle: 'top', targetHandle: 'bottom', bidirectional: true, dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(
	phase: Phase,
	furthestStep: number,
	selectedAttrs: string[],
) {
	const files = [];

	// Observe phase: show the broken controller
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    product = Product.find(params[:id])
    render json: post  # Dumps everything!
  end

  def index
    products = Product.all
    render json: posts  # Raw array dump
  end
end`,
			highlight: [4, 9],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    product = Product.find(params[:id])
    render json: post  # Dumps everything!
  end
end`,
			highlight: [4],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "pg"
gem "puma"
gem "jsonapi-serializer"`,
			highlight: [6],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "pg"
gem "puma"
gem "jsonapi-serializer"`,
			highlight: [6],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/serializers/base_serializer.rb',
			language: 'ruby',
			code: `class BaseSerializer
  include JSONAPI::Serializer
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 4) {
		const attrLines =
			selectedAttrs.length > 0
				? selectedAttrs
						.map((a) => {
							if (a === 'published_at') {
								return `  attribute :published_at do |post|\n    product.listed_at&.strftime("%B %d, %Y")\n  end`;
							}
							return `  attribute :${a}`;
						})
						.join('\n')
				: '  # attributes...';

		files.push({
			filename: 'app/serializers/product_serializer.rb',
			language: 'ruby',
			code: `class ProductSerializer < BaseSerializer
${attrLines}
end`,
			highlight: selectedAttrs.map((_, i) => i + 2),
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    product = Product.find(params[:id])
    render json: ProductSerializer.new(product)
                   .serializable_hash.to_json
  end

  def index
    products = Product.all
    render json: ProductSerializer.new(products)
                   .serializable_hash.to_json
  end
end`,
			highlight: [4, 5, 10, 11],
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
					<span className="text-foreground">
						Serialized response (JSON:API)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40" />
					<span className="text-foreground">
						Only domain attributes included
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level7Serializers({ onComplete }: LevelComponentProps) {
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

	// Step 3: selected attributes
	const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);

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
				variant: 'active' as const,
				inspectable: true,
				inspected: inspectedStages.has('router'),
			},
			{
				id: 'controller',
				label: 'Controller',
				variant: 'active' as const,
				sublabel: probeDisplay ? 'render json: post' : undefined,
				badge: probeDisplay ? 'raw!' : undefined,
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'response',
				label: 'Response',
				badge: probeDisplay ? probeDisplay.responseBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
			{
				id: 'serializer',
				label: 'Serializer',
				position: HUB_POS.serializer,
				sublabel: probeDisplay
					? probeDisplay.serializerSublabel
					: 'Missing!',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('serializer'),
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				variant: 'active' as const,
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				position: HUB_POS.database,
				variant: 'active' as const,
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const hasFired = !!lastResult;
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'router', label: 'Router', variant: 'active' as const },
			{
				id: 'controller',
				label: 'Controller',
				variant: 'active' as const,
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: hasFired ? 'Clean output' : undefined,
				variant: hasFired ? ('active' as const) : ('default' as const),
			},
			{
				id: 'serializer',
				label: 'Serializer',
				position: HUB_POS.serializer,
				sublabel: hasFired ? 'JSON:API' : 'Ready',
				variant: 'active' as const,
				badge: hasFired ? '3 attrs' : undefined,
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				variant: 'active' as const,
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

	// ── Attribute selection handler (Step 3) ──
	const handleToggleAttr = useCallback(
		(attr: AttributeOption) => {
			if (stepper.isCurrentStepCompleted) return;

			if (attr.safe) {
				if (!selectedAttrs.includes(attr.id)) {
					const newAttrs = [...selectedAttrs, attr.id];
					setSelectedAttrs(newAttrs);

					// Check if all safe attributes are selected
					if (SAFE_ATTRIBUTES.every((id) => newAttrs.includes(id))) {
						stepper.completeStep();
					}
				}
			} else {
				stepper.recordWrongAttempt(attr.feedback);
			}
		},
		[selectedAttrs, stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateSerializer = () => {
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
		return { valid: true, message: 'Serializer is ready!' };
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
							In Level 6, your controller returns{' '}
							<span className="font-mono text-primary">
								render json: post
							</span>
							, which dumps every column as flat JSON. Timestamps,
							internal IDs, everything.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							A serializer sits between the controller and the response,
							shaping the output into the JSON:API standard with only
							domain-relevant attributes.
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
										<div className="text-xs text-success/70">
											Serialized
										</div>
									</div>
									<div className="bg-blue-500/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-blue-400">
											{stressTest.results.length}
										</div>
										<div className="text-xs text-blue-400/70">
											Total Requests
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
					actNumber={1}
					levelName="Serializers"
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
									title="API Probe"
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
								{/* Step 0: Choose Gem (OptionCard) */}
								{currentStepType === 'option' &&
									currentOptionConfig &&
									stepper.currentStep !== 4 &&
									stepper.currentStep !== 2 && (
										<>
											<h3 className="text-lg font-semibold text-foreground">
												{currentOptionConfig.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												{currentOptionConfig.description}
											</p>

											{isViewingCompletedStep ? (
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="blue"
																description={
																	opt.description
																}
																disabled={!opt.correct}
																key={opt.id}
																mono={!opt.description}
																name={opt.label}
																selected={opt.correct}
																size="lg"
															/>
														),
													)}
												</div>
											) : (
												<>
													<div className="space-y-2">
														{currentOptionConfig.options.map(
															(opt) => (
																<OptionCard
																	color="blue"
																	description={
																		opt.description
																	}
																	key={opt.id}
																	mono={
																		!opt.description
																	}
																	name={opt.label}
																	onClick={() =>
																		handleOptionClick(
																			opt,
																		)
																	}
																	size="lg"
																/>
															),
														)}
													</div>

													<ErrorFeedback
														message={
															stepper.lastFeedback
														}
														onDismiss={
															stepper.clearFeedback
														}
													/>
												</>
											)}

											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
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

								{/* Step 1: Install Gem (TerminalChoiceStep) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={installCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													The gem is in your Gemfile.
													Now install it so it is
													available in your Rails app.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() =>
												stepper.completeStep()
											}
											onNext={stepper.nextStep}
											onWrong={(fb) =>
												stepper.recordWrongAttempt(fb)
											}
											outputLines={installOutput}
											stepKey={stepper.currentStep}
											title="Install the Gem"
										/>
									)}

								{/* Step 2: Base Serializer (OptionCard) */}
								{currentStepType === 'option' &&
									stepper.currentStep === 2 &&
									currentOptionConfig && (
										<>
											<h3 className="text-lg font-semibold text-foreground">
												{currentOptionConfig.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												{currentOptionConfig.description}
											</p>

											{isViewingCompletedStep ? (
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="blue"
																disabled={
																	!opt.correct
																}
																key={opt.id}
																mono
																name={opt.label}
																selected={
																	opt.correct
																}
																size="lg"
															/>
														),
													)}
												</div>
											) : (
												<>
													<div className="space-y-2">
														{currentOptionConfig.options.map(
															(opt) => (
																<OptionCard
																	color="blue"
																	key={opt.id}
																	mono
																	name={
																		opt.label
																	}
																	onClick={() =>
																		handleOptionClick(
																			opt,
																		)
																	}
																	size="lg"
																/>
															),
														)}
													</div>

													<ErrorFeedback
														message={
															stepper.lastFeedback
														}
														onDismiss={
															stepper.clearFeedback
														}
													/>
												</>
											)}

											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
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

								{/* Step 3: Define Attributes (click-to-select) */}
								{currentStepType === 'attributes' &&
									stepper.currentStep === 3 && (
										<div className="space-y-4">
											<h3 className="text-lg font-semibold text-foreground">
												Define Attributes
											</h3>
											<p className="text-sm text-muted-foreground">
												Your Product model has{' '}
												{ATTRIBUTES.length} columns.
												Pick the domain attributes
												clients need. Skip bookkeeping
												columns and anything JSON:API
												handles automatically.
											</p>

											{/* Attribute grid */}
											<div className="grid grid-cols-2 gap-2">
												{ATTRIBUTES.map((attr) => {
													const isSelected =
														selectedAttrs.includes(
															attr.id,
														);
													return (
														<Button
															className={`flex items-center justify-start gap-2 px-3 py-2.5 rounded-lg border text-sm font-mono transition-all ${
																isSelected
																	? 'border-emerald-500/60 dark:border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
																	: 'border-border bg-card hover:border-blue-500/40 text-foreground'
															} ${isViewingCompletedStep ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
															disabled={
																isSelected ||
																isViewingCompletedStep
															}
															key={attr.id}
															onClick={() =>
																handleToggleAttr(
																	attr,
																)
															}
														>
															{isSelected ? (
																<Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
															) : (
																<div className="w-4 h-4 rounded border border-muted-foreground/30 shrink-0" />
															)}
															{attr.name}
														</Button>
													);
												})}
											</div>

											{/* Live serializer preview */}
											<div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 font-mono text-sm">
												<div className="text-zinc-500 dark:text-zinc-400">
													class ProductSerializer {'<'}{' '}
													BaseSerializer
												</div>
												<div className="mt-2">
													{selectedAttrs.length >
													0 ? (
														selectedAttrs.map(
															(attrId) => (
																<div
																	className="ml-4 text-emerald-700 dark:text-emerald-400"
																	key={attrId}
																>
																	attribute :
																	{attrId}
																</div>
															),
														)
													) : (
														<div className="ml-4 text-zinc-400 dark:text-zinc-600 animate-pulse">
															# select attributes
															above...
														</div>
													)}
												</div>
												<div className="text-zinc-500 dark:text-zinc-400">
													end
												</div>
											</div>

											<div className="text-xs text-muted-foreground">
												{selectedAttrs.length} /{' '}
												{SAFE_ATTRIBUTES.length} domain
												attributes selected
											</div>

											<ErrorFeedback
												message={stepper.lastFeedback}
												onDismiss={
													stepper.clearFeedback
												}
											/>
											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
															}
															size="sm"
														>
															Next Step
															<ArrowRight className="w-4 h-4" />
														</Button>
													</div>
												)}
										</div>
									)}

								{/* Step 4: Update Controller (OptionCard) */}
								{currentStepType === 'option' &&
									stepper.currentStep === 4 &&
									currentOptionConfig && (
										<>
											<h3 className="text-lg font-semibold text-foreground">
												{currentOptionConfig.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												{currentOptionConfig.description}
											</p>

											{isViewingCompletedStep ? (
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="blue"
																disabled={
																	!opt.correct
																}
																key={opt.id}
																mono
																name={opt.label}
																selected={
																	opt.correct
																}
																size="lg"
															/>
														),
													)}
												</div>
											) : (
												<>
													<div className="space-y-2">
														{currentOptionConfig.options.map(
															(opt) => (
																<OptionCard
																	color="blue"
																	key={opt.id}
																	mono
																	name={
																		opt.label
																	}
																	onClick={() =>
																		handleOptionClick(
																			opt,
																		)
																	}
																	size="lg"
																/>
															),
														)}
													</div>

													<ErrorFeedback
														message={
															stepper.lastFeedback
														}
														onDismiss={
															stepper.clearFeedback
														}
													/>
												</>
											)}

											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
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
									Your serializer is ready. See the clean
									JSON:API output replace the raw dump.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateSerializer}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Serializer
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
									onToggleAutoFire={
										stressTest.toggleAutoFire
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
					files={getCodeFiles(
						phase,
						stepper.furthestStep,
						selectedAttrs,
					)}
				>
					{phase === 'reward' && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
								JSON:API Standard
							</div>
							<div className="text-xs text-muted-foreground space-y-1">
								<div>
									<span className="text-emerald-700 dark:text-emerald-400 font-mono">
										data
									</span>
									: Resource envelope
								</div>
								<div>
									<span className="text-emerald-700 dark:text-emerald-400 font-mono">
										type
									</span>
									: Resource name (plural)
								</div>
								<div>
									<span className="text-blue-600 dark:text-blue-400 font-mono">
										attributes
									</span>
									: Only safe fields
								</div>
								<div>
									<span className="text-amber-600 dark:text-amber-400 font-mono">
										relationships
									</span>
									: Linked resources
								</div>
							</div>
						</div>
					)}
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Serializers;

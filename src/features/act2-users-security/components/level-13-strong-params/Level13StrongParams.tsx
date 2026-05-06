/**
 * Level 13: Strong Params
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   discover that the controller passes raw request params directly to the
 *   model with no filtering. Fire API probes to inject user_id and admin.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 3 OptionCard steps introducing params.expect
 *   Step 0: Introduce params.expect (choose the right filtering method)
 *   Step 1: Define the Whitelist (choose which fields to allow)
 *   Step 2: Set Ownership Safely (current_user association)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire param payloads at the
 *   tightened filter and watch allowed/blocked results.
 *
 * Introduces params.expect as the solution to mass assignment.
 * Teaches: parameter filtering, whitelist definition, ownership via association
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act2-level13-strong-params', () =>
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
	{ id: 'no-filter', label: 'No centralized parameter filter' },
	{
		id: 'user-id-injection',
		label: 'user_id slips through if added to the field list',
	},
	{
		id: 'shape-attack',
		label: 'Malformed body shape produces silent empty records',
	},
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'duplicate-field-list',
		label: 'Inspect the controller',
		command: 'cat app/controllers/api/products_controller.rb',
		responseLines: [
			{
				text: '# create  -> name:, description:, price: (3 lines)',
				color: 'cyan',
			},
			{
				text: '# update  -> name:, description:, price: (3 lines)',
				color: 'cyan',
			},
			{
				text: 'The same field list is hardcoded in two places.',
				color: 'yellow',
			},
			{
				text: 'No central whitelist. Adding a 4th field means editing both create and update.',
				color: 'red',
			},
		],
		story: [
			'You inspect the controller. create and update each list the allowed fields by hand.',
			'The whitelist is duplicated. Adding a new field means editing both methods.',
			'A reviewer auditing "what fields can users set?" has to read every action.',
			'There is no single source of truth for the per-controller whitelist.',
		],
	},
	{
		id: 'inject-user-id-via-edit',
		label: 'Imagine adding user_id to the list',
		command: 'POST /api/products  body: { name: "Hi", user_id: 42 }',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{
				text: '{ "id": 5, "name": "Hi", "user_id": 42 }   # ownership stolen',
				color: 'muted',
			},
			{
				text: 'If anyone adds user_id: params[:user_id] to the create action,',
				color: 'yellow',
			},
			{
				text: 'the field list IS the security boundary. A typo there is a CVE.',
				color: 'red',
			},
		],
		story: [
			'Right now the controller does NOT read params[:user_id], so user_id is safe.',
			'But the field list is the only thing protecting ownership from mass-assignment.',
			'A future developer adding user_id: params[:user_id] (e.g., for an admin feature) silently breaks the security boundary.',
			'Centralized whitelists make this kind of regression visible: one method to audit, one method to forbid.',
		],
	},
	{
		id: 'malformed-shape',
		label: 'POST with malformed body',
		command: 'POST /api/products?product=hacked',
		responseLines: [
			{ text: 'HTTP/1.1 422 Unprocessable Entity', color: 'red' },
			{
				text: '{ "errors": ["Name can\'t be blank", "Description can\'t be blank", ...] }',
				color: 'muted',
			},
			{
				text: 'params[:name] returned nil. Product saved with all-nil fields, then validates rejected it.',
				color: 'yellow',
			},
			{
				text: 'No clear "your shape is wrong" signal. The client sees validation noise instead of a 400.',
				color: 'red',
			},
		],
		story: [
			'Attacker sends `?product=hacked` — the body is a string, not a hash.',
			'Each params[:name] / params[:description] / params[:price] returns nil.',
			'Product is built with all-nil attributes and fails validation, returning 422.',
			'The client gets validation errors instead of a clean "wrong request shape" 400. The shape mismatch is invisible.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger.
// Pedagogy rule: each probe unlocks exactly one distinct discovery,
// each discovery is unlocked by exactly one probe. The combined-attack
// probe owns `raw-params`; clicking the model stage no longer
// duplicate-unlocks it.
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'duplicate-field-list': 'no-filter',
	'inject-user-id-via-edit': 'user-id-injection',
	'malformed-shape': 'shape-attack',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ filterSublabel: string; modelBadge: string }
> = {
	'duplicate-field-list': {
		filterSublabel: 'duplicated in 2 actions',
		modelBadge: 'OK',
	},
	'inject-user-id-via-edit': {
		filterSublabel: 'one-typo away',
		modelBadge: '201!',
	},
	'malformed-shape': {
		filterSublabel: 'shape unchecked',
		modelBadge: '422',
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
			'POST and PATCH requests include a JSON body. The body can contain any keys the attacker chooses. The controller has to decide which keys to actually read and which to ignore.',
	},
	controller: {
		stageId: 'controller',
		title: 'ProductsController',
		description:
			'The controller pulls each allowed field out of params by name. create and update both repeat the same field list. Ownership is set via Current.user.products, so a user_id sent in the body is currently ignored — but only because no one has added user_id: params[:user_id] to the field list.',
		code: `def create
  product = Current.user.products.new(
    name: params[:name],
    description: params[:description],
    price: params[:price]
  )
  authorize product
  if product.save
    render json: product, status: :created
  else
    render json: { errors: product.errors.full_messages },
           status: :unprocessable_entity
  end
end`,
	},
	filter: {
		stageId: 'filter',
		title: 'Parameter Filter (decentralized)',
		description:
			'There is no centralized filter. Each action lists allowed fields inline. Adding a field requires editing every action that builds a Product. The whitelist is duplicated; the security boundary lives across multiple methods.',
		code: `# create says:
name: params[:name], description: params[:description], price: params[:price]

# update says (same list, separate place):
name: params[:name], description: params[:description], price: params[:price]

# Two copies of the whitelist. One source of truth would be safer.`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			'The model receives whatever the controller chose to pass. validates :name / :description / :price catches blank or malformed values. But the controller decides which keys to forward — that is the security boundary the model cannot enforce.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	// All discoveries are probe-driven now. Stage clicks open inspector
	// cards but don't unlock discoveries (the duplicate-field-list probe
	// covers `no-filter` already).
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'duplicate-field-list',
		label: 'POST routes through product_params',
		description:
			'product_params lives in one place; create and update both call it. The whitelist is centralized.',
		method: 'POST',
		path: '/api/products',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
	{
		id: 'inject-user-id-via-edit',
		label: 'POST with user_id (now ignored)',
		description:
			'Attacker sends user_id: 42. The filter does not include user_id, so it is dropped silently. Ownership is set via Current.user.products.',
		method: 'POST',
		path: '/api/products',
		actor: 'attacker',
		expectedResult: 'allowed',
	},
	{
		id: 'malformed-shape',
		label: 'POST with malformed body',
		description:
			'Attacker sends product as a string instead of a hash. params.expect catches the wrong shape and raises ParameterMissing -> 400 Bad Request.',
		method: 'POST',
		path: '/api/products',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'clean-create',
		label: 'Create with valid body',
		description:
			'POST with a properly-shaped product hash. Filter accepts the listed keys.',
		method: 'POST',
		path: '/api/products',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
	{
		id: 'clean-update',
		label: 'Update with valid body',
		description: 'PATCH with a properly-shaped product hash.',
		method: 'PATCH',
		path: '/api/products/1',
		actor: 'owner (user_3)',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-filtering', title: 'Add Parameter Filtering' },
	{ id: 'define-whitelist', title: 'Define the Whitelist' },
	{ id: 'set-ownership', title: 'Set Ownership Safely' },
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

// Step 0: Add Parameter Filtering.
// Rails 8's production-safe default is `params.expect`. The older
// `params.require(:product).permit(...)` pattern still works but
// has subtle shape-checking gaps; it appears here only as a
// wrong-option foil with feedback that points at expect.
const FILTERING_OPTIONS: StepOption[] = [
	{
		id: 'permit-all',
		label: 'params.permit!',
		correct: false,
		feedback:
			'permit! allows EVERYTHING through, which is the same as no filtering at all.',
	},
	{
		id: 'require-permit',
		label: 'params.require(:product).permit(:name, :description, :price)',
		correct: false,
		feedback:
			'That is the older Rails pattern. It checks the keys but not the SHAPE of the value at :product. Rails 8 ships a stricter alternative built specifically to close that gap.',
	},
	{
		id: 'params-expect',
		label: 'params.expect(product: [:name, :description, :price])',
		correct: true,
	},
];

// Step 1: Define the Whitelist
const WHITELIST_OPTIONS: StepOption[] = [
	{
		id: 'with-user-id',
		label: 'params.expect(product: [:name, :description, :price, :user_id])',
		correct: false,
		feedback:
			'user_id controls product ownership. If users can set it through request params, they can impersonate other sellers. Ownership belongs to the association, not the request body.',
	},
	{
		id: 'with-id',
		label: 'params.expect(product: [:id, :name, :description, :price])',
		correct: false,
		feedback:
			"id is server-managed. Letting users set it would let an attacker overwrite an existing product by submitting that product's id with new content.",
	},
	{
		id: 'safe-only',
		label: 'params.expect(product: [:name, :description, :price])',
		correct: true,
	},
];

// Step 2: Set Ownership Safely
const OWNERSHIP_OPTIONS: StepOption[] = [
	{
		id: 'merge-params',
		label: 'Product.create!(product_params.merge(user_id: params[:user_id]))',
		correct: false,
		feedback:
			'That still reads user_id from the request body. An attacker can send any user_id they want.',
	},
	{
		id: 'no-user',
		label: 'Product.create!(product_params)',
		correct: false,
		feedback:
			'That does not set user_id at all. The product will not be associated with any user.',
	},
	{
		id: 'current-user',
		label: 'Current.user.products.create!(product_params)',
		correct: true,
	},
];

// Map from step index -> OptionCard config
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Add Parameter Filtering',
		description:
			'The controller passes raw params directly to the model. Any key an attacker sends gets saved. How should Rails filter incoming parameters?',
		options: FILTERING_OPTIONS,
	},
	1: {
		title: 'Define the Whitelist',
		description:
			'params.expect filters the request body to only the keys you allow. Which fields should users be able to set on a Product?',
		options: WHITELIST_OPTIONS,
	},
	2: {
		title: 'Set Ownership Safely',
		description:
			'user_id is not in the whitelist, but products still need an owner. How should the create action associate the product with the current user?',
		options: OWNERSHIP_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'filter', dots: 'mixed' },
	{ from: 'filter', to: 'model', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'filter', dots: 'mixed' },
	{ from: 'filter', to: 'model', dots: 'clean' },
];

// Per-probe / per-scenario edge activation. Default to [] (dormant)
// so the visualization does NOT animate before any probe fires.
// Each entry lists the connection keys (`${from}-${to}`) that should
// flash a single dot pulse when the probe / scenario fires.
const PROBE_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'duplicate-field-list': ['request-controller', 'controller-filter'],
	'inject-user-id-via-edit': [
		'request-controller',
		'controller-filter',
		'filter-model',
	],
	'malformed-shape': ['request-controller', 'controller-filter'],
};

const SCENARIO_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'duplicate-field-list': [
		'request-controller',
		'controller-filter',
		'filter-model',
	],
	'inject-user-id-via-edit': ['request-controller', 'controller-filter'],
	'malformed-shape': ['request-controller', 'controller-filter'],
	'clean-create': ['request-controller', 'controller-filter', 'filter-model'],
	'clean-update': ['request-controller', 'controller-filter', 'filter-model'],
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// L13's "before" state matches real myapp at level-12:
	//   - Current.user.products.new (L11 ownership)
	//   - authorize product (L11 Pundit)
	//   - explicit field-by-field params (no centralized filter yet)
	//   - validates / errors.full_messages (L12 validations)
	// L13's job: introduce centralized parameter filtering via params.expect.
	const observeCode = `class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(
      name: params[:name],
      description: params[:description],
      price: params[:price]
    )
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
    end
  end
end`;

	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: observeCode,
			highlight: [4, 5, 6],
		});
		return files;
	}

	// Build phase: still showing "before" until step 0 (params.expect) lands.
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: observeCode,
			highlight: [4, 5, 6],
		});
	}

	// Step 0 done (filter introduced) → step 2 done (whitelist confirmed) →
	// step 3 done (ownership confirmed). Only one final "after" state to show
	// since L13's pedagogy is the single switch from explicit-fields to a
	// centralized expect.
	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(product_params)
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def product_params
    params.expect(product: [:name, :description, :price])
  end
end`,
			highlight: [3, 13, 14, 15],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase left panel)
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
						Safe params (whitelisted, passes through)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Dangerous params (stripped by filter)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level13StrongParams({ onComplete }: LevelComponentProps) {
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

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
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
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'filter',
				label: 'Params Filter',
				sublabel: probeDisplay
					? probeDisplay.filterSublabel
					: 'inline per action',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('filter'),
			},
			{
				id: 'model',
				label: 'Product Model',
				badge: probeDisplay ? probeDisplay.modelBadge : 'SAVES ALL',
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('model'),
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

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
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
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'controller', label: 'Controller' },
			{
				id: 'filter',
				label: 'params.expect',
				sublabel: wasBlocked ? 'STRIPPED' : '[:name, :description]',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'BLOCKED' : undefined,
			},
			{ id: 'model', label: 'Product Model' },
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
		return { valid: true, message: 'Strong params are locked down!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

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
							Your controller passes raw request params directly to the model
							with no filtering. A malicious user can send any field they want,
							including{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								user_id
							</code>{' '}
							and{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								admin
							</code>
							, and it gets saved to the database.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							You need to add parameter filtering to prevent mass assignment
							attacks and keep sensitive fields out of user control.
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
										<div className="text-xs text-success/70">Allowed</div>
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
					actNumber={2}
					levelName="Strong Params"
					levelNumber={13}
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
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="Param Injection Probe"
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
										{shuffledOptions.map((opt) => (
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
											{shuffledOptions.map((opt) => (
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

								{isViewingCompletedStep && !hasNextStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={handleStartReward}
											size="sm"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
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
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward'
							? STEP_DEFS.length - 1
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level13StrongParams;

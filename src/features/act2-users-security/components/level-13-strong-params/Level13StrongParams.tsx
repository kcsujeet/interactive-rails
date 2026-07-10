/**
 * Level 13: Strong Params
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Pre-state (carries forward from L7-L12): controllers call
 *   params[:product].to_unsafe_h, the documented Rails escape hatch that
 *   returns "an unsafe, unfiltered representation of the parameters." Every
 *   key the request includes reaches the model. Marketing has just added a
 *   `featured` boolean column to Product (admin-only homepage flag); the
 *   to_unsafe_h shortcut lets any logged-in user mass-assign featured.
 *
 * Phase 1 (WHY - observe): Three probes demonstrate mass-assignment exploits:
 *   - self-promote-create: POST with featured: true -> product saved featured.
 *   - self-promote-update: PATCH with featured: true -> existing product flipped.
 *   - compound-frame: PATCH with featured + user_id -> featured AND transferred.
 * Phase 2 (HOW - build): 3 OptionCard steps that replace to_unsafe_h:
 *   Step 0: Replace to_unsafe_h with params.expect (the real filter).
 *   Step 1: Define the Whitelist (exclude featured + user_id).
 *   Step 2: Set Ownership Safely (Current.user association, not request body).
 * Phase 3 (ADVANTAGE - reward): the same three exploits are now blocked;
 *   clean create/update still pass cleanly.
 *
 * Canonical purpose per the Rails Action Controller guide: strong params
 * prevent mass assignment. Sources cited inline in feedback strings.
 * Teaches: mass-assignment vulnerability, params.expect, whitelist design,
 *   ownership via association.
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
	{
		id: 'self-promote-create',
		label: 'Any user can self-promote to featured on create',
	},
	{
		id: 'self-promote-update',
		label: 'Existing products can be flipped to featured on update',
	},
	{
		id: 'compound-frame',
		label: 'Multiple sensitive fields can be injected together',
	},
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'self-promote-create',
		label: 'POST with featured: true (self-promote)',
		command:
			'POST /api/products  body: { product: { name: "Buy crypto!", description: "limited offer", price: 1, featured: true } }',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{
				text: '{ "id": 9, "name": "Buy crypto!", "featured": true }   # promoted to homepage',
				color: 'muted',
			},
			{
				text: 'to_unsafe_h passed every field through, including featured.',
				color: 'yellow',
			},
			{
				text: 'A spam product is now pinned to the homepage alongside admin picks.',
				color: 'red',
			},
		],
		story: [
			'A user sends a POST with featured: true in the body, alongside the legitimate fields.',
			'The controller calls params[:product].to_unsafe_h, which returns the raw hash with NO filtering.',
			'Product.new(...) accepts every field, including featured. The product is saved as featured: true.',
			'The user just promoted their own product to the homepage without admin approval.',
		],
	},
	{
		id: 'self-promote-update',
		label: 'PATCH your product to featured',
		command: 'PATCH /api/products/3  body: { product: { featured: true } }',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{ "id": 3, "name": "Mug", "featured": true }   # self-flipped',
				color: 'muted',
			},
			{
				text: 'product.update mass-assigned featured. No audit trail, no admin gate.',
				color: 'yellow',
			},
			{
				text: 'Anyone who owns a product can promote it at will.',
				color: 'red',
			},
		],
		story: [
			'The owner of product 3 sends a PATCH with only { featured: true } in the body.',
			'product.update(params[:product].to_unsafe_h) writes the field directly to the row.',
			'The existing product flips to featured. No admin saw it. No audit log.',
			'Self-promotion is a one-line request, available to every authenticated user.',
		],
	},
	{
		id: 'compound-frame',
		label: 'PATCH with featured + user_id (frame attack)',
		command:
			'PATCH /api/products/3  body: { product: { featured: true, user_id: 99 } }',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{ "id": 3, "user_id": 99, "featured": true }   # transferred + featured',
				color: 'muted',
			},
			{
				text: 'BOTH sensitive fields were mass-assigned in one request.',
				color: 'yellow',
			},
			{
				text: 'Spam product is now featured AND attributed to user 99.',
				color: 'red',
			},
		],
		story: [
			'The attacker stacks two injections in one PATCH: featured: true + user_id: 99.',
			'to_unsafe_h hands the entire hash to product.update. update() writes both columns.',
			'The product is now pinned to the homepage AND owned by user 99 (the victim).',
			'The vulnerability is general: ANY field present in params reaches the model. The protection is not in the code anywhere.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger.
// Pedagogy rule: each probe unlocks exactly one distinct discovery,
// each discovery is unlocked by exactly one probe.
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'self-promote-create': 'self-promote-create',
	'self-promote-update': 'self-promote-update',
	'compound-frame': 'compound-frame',
};

// Map probe IDs to pipeline node display during observe.
// Every probe routes through the (bypassed) filter and reaches the model
// with extra fields intact, so all three show the model accepting the
// injection. Sublabels and badges differ to keep probes visually distinct.
const PROBE_PIPELINE_MAP: Record<
	string,
	{ filterSublabel: string; modelBadge: string }
> = {
	'self-promote-create': {
		filterSublabel: 'bypassed (to_unsafe_h)',
		modelBadge: 'featured!',
	},
	'self-promote-update': {
		filterSublabel: 'bypassed (to_unsafe_h)',
		modelBadge: 'flipped',
	},
	'compound-frame': {
		filterSublabel: 'bypassed (to_unsafe_h)',
		modelBadge: 'owned + featured',
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
			'POST and PATCH requests include a JSON body. The body can contain ANY keys the attacker chooses, including admin-only fields (featured) and auto-managed fields (user_id, id). The controller has to decide which keys to actually accept and which to drop.',
	},
	controller: {
		stageId: 'controller',
		title: 'ProductsController (uses to_unsafe_h)',
		description:
			'The controller calls .to_unsafe_h on params[:product]. Per Rails docs, to_unsafe_h returns "an unsafe, unfiltered representation of the parameters", every key the attacker sent reaches the model. The controller is doing zero filtering.',
		code: `def create
  product = Current.user.products.new(params[:product].to_unsafe_h)
  authorize product
  if product.save
    render json: product, status: :created
  else
    render json: { errors: product.errors.full_messages },
           status: :unprocessable_entity
  end
end

def update
  product = Product.find(params[:id])
  authorize product
  if product.update(params[:product].to_unsafe_h)
    render json: product
  else
    render json: { errors: product.errors.full_messages },
           status: :unprocessable_entity
  end
end`,
	},
	filter: {
		stageId: 'filter',
		title: 'Parameter Filter (bypassed)',
		description:
			'There is no parameter filter. to_unsafe_h is a documented escape hatch on ActionController::Parameters that returns the raw hash with no permission checks. The security boundary that strong params would enforce is missing entirely.',
		code: `# Current code:
params[:product].to_unsafe_h
# => returns ALL keys: name, description, price, featured, user_id, id, ...
# => no whitelist, no shape check, no protection.
# => whatever keys the request includes reach the model.`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			"The model has a featured boolean column (admin-curated homepage flag). Validations cover blank/malformed values on user-settable fields, but Active Record will mass-assign ANY column the controller hands it. The model cannot tell which fields are user-settable and which are admin-only, that is the controller's job.",
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
		id: 'self-promote-create',
		label: 'POST with featured: true (now blocked)',
		description:
			'Attacker sends featured: true with the legitimate fields. params.expect drops featured (not in whitelist). Product is created with featured: false. Self-promotion attempt fails silently.',
		method: 'POST',
		path: '/api/products',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'self-promote-update',
		label: 'PATCH with featured: true (now blocked)',
		description:
			'Owner sends only { featured: true } in the body. params.expect filters featured out of the whitelist and returns an empty hash. update({}) is a no-op; the product stays unchanged. Self-promotion attempt fails silently.',
		method: 'PATCH',
		path: '/api/products/3',
		actor: 'owner (user_3)',
		expectedResult: 'blocked',
	},
	{
		id: 'compound-frame',
		label: 'PATCH with featured + user_id (now blocked)',
		description:
			'Attacker stacks featured and user_id in one PATCH. params.expect drops both (neither is in the whitelist). Product stays unchanged: still owned by the original user, still not featured.',
		method: 'PATCH',
		path: '/api/products/3',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'clean-create',
		label: 'Create with valid body',
		description:
			'POST with only the whitelisted fields (name, description, price). params.expect accepts the call and the product is saved normally.',
		method: 'POST',
		path: '/api/products',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
	{
		id: 'clean-update',
		label: 'Update with valid body',
		description:
			'PATCH with only the whitelisted fields. params.expect accepts the call and the product is updated normally.',
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
	{ id: 'add-filtering', title: 'Replace to_unsafe_h with a Real Filter' },
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

// Step 0: Replace the to_unsafe_h call with a real filter.
// Rails 8's production-safe default is `params.expect`. The naive
// `to_unsafe_h` (the status quo from L7-L12) and `permit!` are both
// wrong-option foils, neither filters anything.
const FILTERING_OPTIONS: StepOption[] = [
	{
		id: 'unsafe-h',
		label: 'params[:product].to_unsafe_h',
		correct: false,
		feedback:
			'That is what the controller already does. The Rails docs literally call it "an unsafe, unfiltered representation", extra fields like featured and user_id pass straight through.',
	},
	{
		id: 'permit-all',
		label: 'params[:product].permit!',
		correct: false,
		feedback:
			'permit! marks every key as permitted. It silences the ForbiddenAttributesError but lets every field through, including the ones an attacker injects. Same outcome as to_unsafe_h.',
	},
	{
		id: 'params-expect',
		label: 'params.expect(product: [:name, :description, :price])',
		correct: true,
	},
];

// Step 1: Define the Whitelist (which fields users can set vs which are admin-only / server-managed)
const WHITELIST_OPTIONS: StepOption[] = [
	{
		id: 'with-featured',
		label: 'params.expect(product: [:name, :description, :price, :featured])',
		correct: false,
		feedback:
			'featured is the admin-curated homepage flag. If users can set it through request params, they can self-promote, exactly the attack you just observed. Admin-only columns belong out of the whitelist.',
	},
	{
		id: 'with-user-id',
		label: 'params.expect(product: [:name, :description, :price, :user_id])',
		correct: false,
		feedback:
			'user_id controls product ownership. If users can set it through request params, they can transfer products to victims (frame attack). Ownership belongs to the association, not the request body.',
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
		title: 'Replace to_unsafe_h with a Real Filter',
		description:
			'The controller has been calling params[:product].to_unsafe_h since L7, which lets every field through. Pick the Rails 8 filter that declares which keys reach the model.',
		options: FILTERING_OPTIONS,
	},
	1: {
		title: 'Define the Whitelist',
		description:
			'params.expect drops every key not in the whitelist. Which fields should logged-in users be allowed to set on a Product? (The schema has name, description, price, user_id, and the new featured boolean.)',
		options: WHITELIST_OPTIONS,
	},
	2: {
		title: 'Set Ownership Safely',
		description:
			'user_id is excluded from the whitelist, but products still need an owner. How should the create action associate the product with the current user without trusting the request body?',
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
// Observe: every probe shows the request reaching the model with extras
// intact (filter is bypassed, so dots flow all the way through).
const PROBE_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'self-promote-create': [
		'request-controller',
		'controller-filter',
		'filter-model',
	],
	'self-promote-update': [
		'request-controller',
		'controller-filter',
		'filter-model',
	],
	'compound-frame': ['request-controller', 'controller-filter', 'filter-model'],
};

// Reward: blocked attacks stop at the filter; clean requests reach the model.
const SCENARIO_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'self-promote-create': ['request-controller', 'controller-filter'],
	'self-promote-update': ['request-controller', 'controller-filter'],
	'compound-frame': ['request-controller', 'controller-filter'],
	'clean-create': ['request-controller', 'controller-filter', 'filter-model'],
	'clean-update': ['request-controller', 'controller-filter', 'filter-model'],
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// L13's "before" state inherits from L7-L12:
	//   - Current.user.products.new (L11 ownership)
	//   - authorize product (L11 Pundit)
	//   - params[:product].to_unsafe_h (the naive Rails 8 shortcut from L7)
	//   - validates / errors.full_messages (L12 validations)
	// L13's setup: marketing already added a `featured` boolean column to
	// Product (admin-only, default false). The to_unsafe_h call lets users
	// mass-assign featured (and any other column).
	// L13's job: replace to_unsafe_h with params.expect (a real whitelist).
	const observeCode = `class Api::ProductsController < ApplicationController
  def create
    product = Current.user.products.new(params[:product].to_unsafe_h)
    authorize product
    if product.save
      render json: product, status: :created
    else
      render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    product = Product.find(params[:id])
    authorize product
    if product.update(params[:product].to_unsafe_h)
      render json: product
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
			highlight: [3, 13],
		});
		return files;
	}

	// Build phase: still showing "before" until step 0 (params.expect) lands.
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: observeCode,
			highlight: [3, 13],
		});
	}

	// After step 0 (filter introduced), the controller centralizes the
	// whitelist into product_params and both create and update call it.
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

  def update
    product = Product.find(params[:id])
    authorize product
    if product.update(product_params)
      render json: product
    else
      render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def product_params
    params.expect(product: [:name, :description, :price])
  end
end`,
			highlight: [3, 14, 23, 24, 25],
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
				sublabel: probeDisplay ? probeDisplay.filterSublabel : 'no whitelist',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('filter'),
			},
			{
				id: 'model',
				label: 'Product Model',
				badge: probeDisplay ? probeDisplay.modelBadge : undefined,
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
				sublabel: wasBlocked ? 'STRIPPED' : '[:name, :description, :price]',
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
							Your controller calls{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								params[:product].to_unsafe_h
							</code>
							, which hands every field in the request body straight to the
							model. A malicious user can include sensitive fields like{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								featured
							</code>{' '}
							(admin-curated homepage flag) or{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								user_id
							</code>{' '}
							(ownership) and the columns get written.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Replace the unsafe shortcut with a real whitelist that lists only
							the fields users are allowed to set, so admin-only and
							server-managed columns stay out of user control.
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
							<div className="px-6 pb-4">
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

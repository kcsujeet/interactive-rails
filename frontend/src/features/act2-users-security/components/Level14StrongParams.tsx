/**
 * Level 14: Strong Params
 *
 * Sequential phase flow: observe -> build -> activate -> reward
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
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Filtering" button
 * Phase 4 (ADVANTAGE - reward): Stress test. Fire param payloads at the
 *   tightened filter and watch allowed/blocked results.
 *
 * Introduces params.expect as the solution to mass assignment.
 * Teaches: parameter filtering, whitelist definition, ownership via association
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
	{ id: 'no-filtering', label: 'No parameter filtering at all' },
	{ id: 'user-id-injection', label: 'user_id can be set via request body' },
	{ id: 'admin-escalation', label: 'admin flag can be set via request body' },
	{ id: 'raw-params', label: 'Controller passes raw params to model' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'inject-user-id',
		label: 'POST with user_id',
		command: 'POST /api/v1/products {title: "Hi", user_id: 42}',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{
				text: '{"id":5,"title":"Hi","user_id":42,"admin":false}',
				color: 'muted',
			},
			{
				text: 'user_id accepted! Product created as user 42, not the real author.',
				color: 'yellow',
			},
			{
				text: 'No parameter filtering. user_id passes straight through to the model.',
				color: 'red',
			},
		],
	},
	{
		id: 'escalate-admin',
		label: 'POST with admin: true',
		command: 'POST /api/v1/products {title: "Exploit", admin: true}',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{
				text: '{"id":6,"title":"Exploit","admin":true}',
				color: 'muted',
			},
			{
				text: 'admin: true accepted! Privilege escalation succeeded.',
				color: 'yellow',
			},
			{
				text: 'No parameter filtering. admin: true passes straight through to the model.',
				color: 'red',
			},
		],
	},
	{
		id: 'inject-both',
		label: 'PATCH with both fields',
		command: 'PATCH /api/v1/products/1 {user_id: 99, admin: true}',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'red' },
			{
				text: '{"id":1,"user_id":99,"admin":true}',
				color: 'muted',
			},
			{
				text: 'Both fields accepted. Ownership stolen AND admin escalated.',
				color: 'yellow',
			},
			{
				text: 'No filtering at all. Every param the attacker sends gets saved.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'inject-user-id': 'user-id-injection',
	'escalate-admin': 'admin-escalation',
	'inject-both': 'user-id-injection',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ filterSublabel: string; modelBadge: string }
> = {
	'inject-user-id': {
		filterSublabel: 'NO FILTER',
		modelBadge: '201!',
	},
	'escalate-admin': {
		filterSublabel: 'NO FILTER',
		modelBadge: '201!',
	},
	'inject-both': {
		filterSublabel: 'NO FILTER',
		modelBadge: '200!',
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
			'POST and PATCH requests include a JSON body. The body can contain ANY key the attacker chooses, including user_id and admin, alongside legitimate fields like title and body.',
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'The controller reads request params directly with no filtering layer. Any key the attacker sends in the JSON body can be passed to the model.',
		code: `def create
  post = Product.create!(title: params[:title], body: params[:body])
  render json: post, status: :created
end`,
	},
	filter: {
		stageId: 'filter',
		title: 'Parameter Filtering (Missing!)',
		description:
			'There is no parameter filtering. The controller reads params directly and passes them to the model. Any key the attacker includes in the request body gets saved to the database.',
		code: `def create
  post = Product.create!(title: params[:title], body: params[:body],
                      user_id: params[:user_id], admin: params[:admin])
  # Every param gets through!
end`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model',
		description:
			'The model receives ALL params and saves them to the database. With no filtering, every value the attacker sends gets persisted, including user_id and admin.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	filter: 'no-filtering',
	model: 'raw-params',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'clean-create',
		label: 'Create with safe params',
		description: 'POST with only title and body',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
	{
		id: 'inject-user-id',
		label: 'POST with user_id',
		description: 'Try to set ownership via params',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'inject-admin',
		label: 'POST with admin: true',
		description: 'Try to escalate privileges via params',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'clean-update',
		label: 'Update with safe params',
		description: 'PATCH with only title and body',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'owner (user_3)',
		expectedResult: 'allowed',
	},
	{
		id: 'inject-both',
		label: 'PATCH with user_id + admin',
		description: 'Try to steal ownership and escalate',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'attacker',
		expectedResult: 'blocked',
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

// Step 0: Add Parameter Filtering
const FILTERING_OPTIONS: StepOption[] = [
	{
		id: 'manual-check',
		label: 'Check each param manually with if/else',
		correct: false,
		feedback:
			'Manual checks are error-prone and verbose. Rails provides a built-in, declarative way to filter parameters.',
	},
	{
		id: 'permit-all',
		label: 'params.permit!',
		correct: false,
		feedback:
			'permit! allows EVERYTHING through, which is the same as no filtering at all.',
	},
	{
		id: 'params-expect',
		label: 'params.expect(product: [:title, :body])',
		correct: true,
	},
];

// Step 1: Define the Whitelist
const WHITELIST_OPTIONS: StepOption[] = [
	{
		id: 'everything',
		label: 'params.expect(product: [:title, :body, :user_id, :admin])',
		correct: false,
		feedback:
			'user_id and admin are sensitive fields. Users should never set their own ownership or privilege level through request params.',
	},
	{
		id: 'with-user-id',
		label: 'params.expect(product: [:title, :body, :user_id])',
		correct: false,
		feedback:
			'user_id controls post ownership. If users can set it, they can impersonate other authors.',
	},
	{
		id: 'safe-only',
		label: 'params.expect(product: [:title, :body])',
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
			'That does not set user_id at all. The post will not be associated with any user.',
	},
	{
		id: 'current-user',
		label: 'current_user.posts.create!(product_params)',
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
			'user_id is not in the whitelist, but posts still need an owner. How should the create action associate the product with the current user?',
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

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show controller with raw params (no filtering)
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(
      title: params[:title],
      body: params[:body],
      user_id: params[:user_id],  # Attacker-controlled!
      admin: params[:admin]        # Attacker-controlled!
    )
    render json: post, status: :created
  end

  def update
    product = Product.find(params[:id])
    product.update!(title: params[:title], body: params[:body])
    render json: post
  end

  # No parameter filtering at all!
end`,
			highlight: [6, 7],
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	if (furthestStep === 0) {
		// Step 0: same as observe (player is choosing the filtering method)
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(
      title: params[:title],
      body: params[:body],
      user_id: params[:user_id],  # Attacker-controlled!
      admin: params[:admin]        # Attacker-controlled!
    )
    render json: post, status: :created
  end

  def update
    product = Product.find(params[:id])
    product.update!(title: params[:title], body: params[:body])
    render json: post
  end

  # No parameter filtering at all!
end`,
			highlight: [6, 7],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class Api::V1::ProductsController < ApplicationController
  def create
    product = current_user.posts.create!(product_params)
    render json: post, status: :created
  end

  def update
    product = Product.find(params[:id])
    product.update!(product_params)
    render json: post
  end

  private

  def product_params
    params.expect(product: [:title, :body])
    # user_id and admin removed!
    # Ownership set via current_user.posts association
  end
end`
					: furthestStep >= 2
						? `class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(product_params)
    render json: post, status: :created
  end

  def update
    product = Product.find(params[:id])
    product.update!(product_params)
    render json: post
  end

  private

  def product_params
    params.expect(product: [:title, :body])
    # user_id and admin removed!
    # But how does user_id get set now?
  end
end`
						: `class Api::V1::ProductsController < ApplicationController
  def create
    product = Product.create!(product_params)
    render json: post, status: :created
  end

  def update
    product = Product.find(params[:id])
    product.update!(product_params)
    render json: post
  end

  private

  def product_params
    params.expect(product: [...])
    # Which fields should be allowed?
  end
end`,
			highlight:
				furthestStep >= 3
					? [3, 16, 17, 18]
					: furthestStep >= 2
						? [16, 17]
						: [16],
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

export function Level14StrongParams({ onComplete }: LevelComponentProps) {
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
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'filter',
				label: 'Params Filter',
				sublabel: probeDisplay ? probeDisplay.filterSublabel : '(missing!)',
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
				variant: (probeDisplay ? 'danger' : 'default') as
					| 'danger'
					| 'default',
				inspectable: true,
				inspected: inspectedStages.has('model'),
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
				id: 'filter',
				label: 'params.expect',
				sublabel: wasBlocked
					? 'STRIPPED'
					: '[:title, :body]',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'BLOCKED' : undefined,
			},
			{ id: 'model', label: 'Product Model' },
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

	const handleActivateFilter = () => {
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

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your controller passes raw request params directly to the
							model with no filtering. A malicious user can send any field
							they want, including{' '}
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
					levelNumber={14}
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
									Your params filter is locked down. Watch dangerous params
									like user_id and admin get stripped at the gate.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateFilter}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Filtering
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

export default Level14StrongParams;

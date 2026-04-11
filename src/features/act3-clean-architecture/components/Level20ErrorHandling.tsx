/**
 * Level 20: Error Handling
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   discover that the API returns raw 500s with stack traces, plain text 404s,
 *   and inconsistent JSON error shapes. Fire API probes to trigger different
 *   error types and see the inconsistency firsthand.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 3 OptionCard steps introducing rescue_from
 *   Step 0: Choose where to handle errors (rescue_from in ApplicationController)
 *   Step 1: Map exceptions to status codes (RecordNotFound->404, RecordInvalid->422, ParameterMissing->400)
 *   Step 2: Define the error response shape ({ error: { code, message, details } })
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire error-triggering requests at
 *   the centralized handler and watch consistent JSON responses.
 *
 * Introduces rescue_from as the solution to scattered error handling.
 * Teaches: centralized exception handling, HTTP status mapping, consistent error shape
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
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { shuffleOptions } from '@/lib/shuffleOptions';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'raw-500-stacktrace', label: 'Raw 500 with stack trace' },
	{ id: 'plain-text-404', label: 'Plain text 404' },
	{ id: 'inconsistent-shapes', label: 'Inconsistent JSON shapes' },
	{ id: 'no-centralized-handling', label: 'No centralized handling' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'missing-post',
		label: 'GET /api/v1/products/999',
		command: 'GET /api/v1/products/999',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{ text: 'Content-Type: text/html', color: 'muted' },
			{
				text: '<h1>ActiveRecord::RecordNotFound</h1>',
				color: 'yellow',
			},
			{
				text: "app/controllers/api/v1/products_controller.rb:4:in 'show'",
				color: 'muted',
			},
			{
				text: 'Raw stack trace exposed! 500 for a missing resource.',
				color: 'red',
			},
		],
	},
	{
		id: 'bad-params',
		label: 'POST /api/v1/products (bad params)',
		command: 'POST /api/v1/products {}',
		responseLines: [
			{ text: 'HTTP/1.1 400 Bad Request', color: 'red' },
			{ text: 'Content-Type: application/json', color: 'muted' },
			{
				text: '{"message":"param is missing or the value is empty: post"}',
				color: 'yellow',
			},
			{
				text: 'Different error shape! { message: "..." } instead of a consistent structure.',
				color: 'red',
			},
		],
	},
	{
		id: 'missing-user',
		label: 'GET /api/v1/users/999',
		command: 'GET /api/v1/users/999',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: 'Content-Type: text/plain', color: 'muted' },
			{ text: 'Not found', color: 'yellow' },
			{
				text: 'Plain text response! No JSON, no error code, no details.',
				color: 'red',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'missing-post': 'raw-500-stacktrace',
	'bad-params': 'inconsistent-shapes',
	'missing-user': 'plain-text-404',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ handlerSublabel: string; responseBadge: string }
> = {
	'missing-post': {
		handlerSublabel: 'NO HANDLER',
		responseBadge: '500!',
	},
	'bad-params': {
		handlerSublabel: 'NO HANDLER',
		responseBadge: '400!',
	},
	'missing-user': {
		handlerSublabel: 'NO HANDLER',
		responseBadge: '404!',
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
			'API requests come in from web and mobile clients. They expect consistent JSON responses for both success and error cases. Right now, errors come back in three different formats depending on which controller handles them.',
	},
	controller: {
		stageId: 'controller',
		title: 'PostsController',
		description:
			'Each controller action has its own begin/rescue block. Some return JSON, some return plain text, some let exceptions bubble up as raw 500s with stack traces.',
		code: `def show
  begin
    @product = Product.find(params[:id])
    render json: @post
  rescue ActiveRecord::RecordNotFound
    render plain: "Not found", status: 500
  end
end

def create
  begin
    @product = Product.create!(product_params)
    render json: @post, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { msg: e.message }, status: 400
  end
end`,
	},
	'error-handler': {
		stageId: 'error-handler',
		title: 'Error Handler (Missing!)',
		description:
			'There is no centralized error handling. Each controller action catches exceptions independently with different rescue blocks. The result: three different error formats across endpoints. Clients cannot parse errors reliably.',
	},
	response: {
		stageId: 'response',
		title: 'API Response',
		description:
			'Responses are inconsistent. GET /posts/999 returns an HTML stack trace. POST with bad params returns { "message": "..." }. GET /users/999 returns plain text "Not found". Three endpoints, three formats.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	'error-handler': 'no-centralized-handling',
	controller: 'inconsistent-shapes',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'missing-post',
		label: 'GET /api/v1/products/999',
		description: 'Request a product that does not exist (was raw 500)',
		method: 'GET',
		path: '/api/v1/products/999',
		actor: 'user_3',
		expectedResult: 'blocked',
	},
	{
		id: 'bad-params',
		label: 'POST /api/v1/products (bad params)',
		description: 'POST with missing product key (was inconsistent JSON)',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'missing-user',
		label: 'GET /api/v1/users/999',
		description: 'Request a user that does not exist (was plain text)',
		method: 'GET',
		path: '/api/v1/users/999',
		actor: 'user_3',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-create',
		label: 'Create a product',
		description: 'POST with valid title and body',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
	{
		id: 'invalid-record',
		label: '422 Unprocessable',
		description: 'POST with blank title (validation fails)',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'user_3',
		expectedResult: 'blocked',
	},
	{
		id: 'unauthorized',
		label: '403 Forbidden',
		description: "DELETE another user's post",
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-show',
		label: 'Show a product',
		description: 'GET an existing post',
		method: 'GET',
		path: '/api/v1/products/1',
		actor: 'user_3',
		expectedResult: 'allowed',
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-strategy', title: 'Choose Error Handling Strategy' },
	{ id: 'map-exceptions', title: 'Map Exceptions to Status Codes' },
	{ id: 'define-shape', title: 'Define Error Response Shape' },
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

// Step 0: Choose Error Handling Strategy
const STRATEGY_OPTIONS: StepOption[] = [
	{
		id: 'per-action',
		label: 'begin/rescue in each controller action',
		correct: false,
		feedback:
			'Duplicating rescue blocks in every action is what caused the inconsistency in the first place. You need a single place to handle all exceptions.',
	},
	{
		id: 'middleware',
		label: 'Rack middleware error handler',
		correct: false,
		feedback:
			'Middleware catches errors before Rails processes the request. You lose access to controller context, params, and error details.',
	},
	{
		id: 'rescue-from',
		label: 'rescue_from in ApplicationController',
		correct: true,
	},
	{
		id: 'exception-gem',
		label: 'exception_notification gem',
		correct: false,
		feedback:
			'That gem sends error notifications (email, Slack). It does not format error responses for API clients.',
	},
];

// Step 1: Map Exceptions to Status Codes
const MAPPING_OPTIONS: StepOption[] = [
	{
		id: 'all-500',
		label:
			'RecordNotFound -> 500, RecordInvalid -> 500, ParameterMissing -> 500',
		correct: false,
		feedback:
			'Returning 500 for everything tells clients nothing. A missing resource, a validation failure, and a malformed request are three different problems with three different status codes.',
	},
	{
		id: 'wrong-codes',
		label:
			'RecordNotFound -> 400, RecordInvalid -> 404, ParameterMissing -> 422',
		correct: false,
		feedback:
			'Those status codes are mismatched. A missing resource is not a bad request, and a validation failure is not a missing resource.',
	},
	{
		id: 'correct-codes',
		label:
			'RecordNotFound -> 404, RecordInvalid -> 422, ParameterMissing -> 400',
		correct: true,
	},
];

// Step 2: Define Error Response Shape
const SHAPE_OPTIONS: StepOption[] = [
	{
		id: 'flat-hash',
		label: '{ message: "Not found", status: 404 }',
		correct: false,
		feedback:
			'A flat hash with no machine-readable code forces clients to parse the message string. Nest errors under an error key with structured fields.',
	},
	{
		id: 'array',
		label: '{ errors: ["Not found"] }',
		correct: false,
		feedback:
			'An array of strings has no structure. Clients need a code to switch on, a message to display, and details for validation errors.',
	},
	{
		id: 'structured',
		label:
			'{ error: { code: "not_found", message: "Product not found", details: {} } }',
		correct: true,
	},
	{
		id: 'bare-string',
		label: '"Not found"',
		correct: false,
		feedback:
			'A bare string response has no structure at all. Clients cannot reliably detect error vs. success or extract any metadata.',
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
		title: 'Choose Error Handling Strategy',
		description:
			'Every controller action has its own begin/rescue with different error formats. How should you centralize error handling so all exceptions are handled in one place?',
		options: STRATEGY_OPTIONS,
	},
	1: {
		title: 'Map Exceptions to Status Codes',
		description:
			'rescue_from catches exceptions globally. Each exception type should return the correct HTTP status code. Which mapping is correct?',
		options: MAPPING_OPTIONS,
	},
	2: {
		title: 'Define Error Response Shape',
		description:
			'All error handlers need to render a consistent JSON structure. Which shape lets clients parse every error programmatically?',
		options: SHAPE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'error-handler', dots: 'mixed' },
	{ from: 'error-handler', to: 'response', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'error-handler', dots: 'mixed' },
	{ from: 'error-handler', to: 'response', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show scattered error handling
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    begin
      @product = Product.find(params[:id])
      render json: @post
    rescue ActiveRecord::RecordNotFound
      render plain: "Not found", status: 500
    end
  end

  def create
    begin
      @product = Product.create!(product_params)
      render json: @post, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { msg: e.message }, status: 400
    end
  end

  # Every action has its own begin/rescue!
  # 3 different error formats across endpoints
end`,
			highlight: [3, 6, 7, 12, 15, 16],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		// Step 0: same as observe (player is choosing the strategy)
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    begin
      @product = Product.find(params[:id])
      render json: @post
    rescue ActiveRecord::RecordNotFound
      render plain: "Not found", status: 500
    end
  end

  def create
    begin
      @product = Product.create!(product_params)
      render json: @post, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { msg: e.message }, status: 400
    end
  end
end`,
			highlight: [3, 6, 7, 12, 15, 16],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from ActionController::ParameterMissing,
              with: :handle_bad_request
  rescue_from Pundit::NotAuthorizedError,
              with: :handle_forbidden

  private

  def handle_not_found(exception)
    render json: {
      error: {
        code: "not_found",
        message: exception.message,
        details: {}
      }
    }, status: :not_found
  end

  def handle_unprocessable(exception)
    render json: {
      error: {
        code: "unprocessable_entity",
        message: exception.message,
        details: exception.record.errors.to_hash
      }
    }, status: :unprocessable_entity
  end

  def handle_bad_request(exception)
    render json: {
      error: {
        code: "bad_request",
        message: exception.message,
        details: {}
      }
    }, status: :bad_request
  end

  def handle_forbidden(_exception)
    render json: {
      error: {
        code: "forbidden",
        message: "You are not authorized to perform this action",
        details: {}
      }
    }, status: :forbidden
  end
end`
					: furthestStep >= 2
						? `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from ActionController::ParameterMissing,
              with: :handle_bad_request
  rescue_from Pundit::NotAuthorizedError,
              with: :handle_forbidden

  private

  def handle_not_found(exception)
    render json: { error: "..." }, status: :not_found
  end

  def handle_unprocessable(exception)
    render json: { error: "..." }, status: :unprocessable_entity
  end

  def handle_bad_request(exception)
    render json: { error: "..." }, status: :bad_request
  end

  def handle_forbidden(_exception)
    render json: { error: "..." }, status: :forbidden
  end

  # What should the error shape look like?
end`
						: `class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound,
              with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,
              with: :handle_unprocessable
  rescue_from ActionController::ParameterMissing,
              with: :handle_bad_request
  rescue_from Pundit::NotAuthorizedError,
              with: :handle_forbidden

  private

  # Which status codes should each exception map to?
end`,
			highlight:
				furthestStep >= 3
					? [14, 15, 16, 17, 25, 26, 27, 35, 36]
					: furthestStep >= 2
						? [14, 18, 22, 26]
						: [2, 3, 4, 5, 6, 7, 8, 9],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def show
    @product = Product.find(params[:id])
    render json: @post
  end

  def create
    @product = Product.create!(product_params)
    render json: @post, status: :created
  end

  # No begin/rescue needed!
  # rescue_from in ApplicationController handles all errors
end`,
			highlight: [3, 4, 8, 9],
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
						Successful request (passes through)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Error caught, clean JSON returned
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level20ErrorHandling({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
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
				id: 'router',
				label: 'Router',
			},
			{
				id: 'controller',
				label: 'Controller',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'error-handler',
				label: 'Error Handler',
				sublabel: probeDisplay ? probeDisplay.handlerSublabel : '(missing!)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('error-handler'),
			},
			{
				id: 'response',
				label: 'Response',
				badge: probeDisplay ? probeDisplay.responseBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		const wasAllowed = lastResult?.result === 'allowed';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'router', label: 'Router' },
			{ id: 'controller', label: 'Controller' },
			{
				id: 'error-handler',
				label: 'rescue_from',
				sublabel: wasBlocked
					? 'caught!'
					: wasAllowed
						? 'no error'
						: 'rescue_from',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'HANDLED' : undefined,
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: wasBlocked
					? 'clean JSON error'
					: wasAllowed
						? '200 OK'
						: undefined,
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
		return { valid: true, message: 'Error handling is centralized!' };
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
							Your API returns raw 500 errors with stack traces, plain text
							404s, and inconsistent JSON shapes. Every controller has its own
							begin/rescue block with a different error format. Clients cannot
							parse errors reliably.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							You need to centralize error handling so every exception returns a
							consistent, structured JSON response.
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
										<div className="text-xs text-destructive/70">Handled</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Error Handling"
					levelNumber={20}
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
									title="Error Response Probe"
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
										{shuffleOptions(
											currentOptionConfig.options,
											stepper.currentStep,
										).map((opt) => (
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
											{shuffleOptions(
												currentOptionConfig.options,
												stepper.currentStep,
											).map((opt) => (
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
												hasNextStep ? stepper.nextStep : handleStartReward
											}
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

export default Level20ErrorHandling;

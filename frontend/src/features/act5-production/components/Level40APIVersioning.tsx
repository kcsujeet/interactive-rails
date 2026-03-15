/**
 * Level 40: API Versioning
 *
 * Three-phase flow: observe -> build -> activate -> reward
 *
 * Phase 1 (observe): "Version Router" visualization.
 *   Fork layout: v1 Client and v2 Client on left -> single unversioned Controller -> single response.
 *   Probes show v1 clients getting broken responses after a format change,
 *   no deprecation warnings, and no migration path.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Add v2 namespace to routes (terminal)
 *   Step 1: Generate v2 controller (terminal)
 *   Step 2: Create v2 serializer with new response shape (option)
 *   Step 3: Add deprecation headers to v1 (option)
 *   Step 4: Add Sunset header (option)
 *   Step 5: Wire v1 controller to use service delegation (option)
 *
 * Phase 3 (reward): Same visualization, now with router splitting traffic.
 *   v1 gets cents format with deprecation headers. v2 gets object format.
 *   Both coexist. Unknown versions get 404.
 */

import {
	ArrowRight,
	GitBranch,
	Globe,
	Monitor,
	Server,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';

// ─── Discovery definitions ─────────────────────────────────────────────
const DISCOVERY_DEFS = [
	{ id: 'single-controller', label: 'One controller serves all API versions' },
	{
		id: 'breaking-change',
		label: 'Response shape change breaks v1 clients',
	},
	{ id: 'no-deprecation', label: 'No deprecation warning for v1 consumers' },
	{ id: 'no-migration-path', label: 'No migration path from v1 to v2' },
] as const;

// ─── Probe definitions ────────────────────────────────────────────────
const PROBES = [
	{
		id: 'v1-expects-cents',
		label: 'GET /api/orders/42 (v1 client)',
		command: 'curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'green' as const },
			{ text: '{ "id": 42, "total": 1999 }', color: 'green' as const },
			{
				text: '# v1 client expects "total" as integer cents',
				color: 'cyan' as const,
			},
			{
				text: '# No deprecation header. Client has no idea v2 exists.',
				color: 'amber' as const,
			},
		],
	},
	{
		id: 'v2-wants-object',
		label: 'GET /api/orders/42 (v2 client)',
		command: 'curl localhost:3000/api/orders/42 -H "Accept: application/json"',
		responseLines: [
			{ text: '200 OK', color: 'green' as const },
			{ text: '{ "id": 42, "total": 1999 }', color: 'amber' as const },
			{
				text: '# v2 client expects { "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'red' as const,
			},
			{
				text: '# Gets integer cents instead. No versioned endpoint exists.',
				color: 'red' as const,
			},
		],
	},
	{
		id: 'breaking-deploy',
		label: 'GET /api/orders/42 (after format change)',
		command:
			'# Deploy new response format, then: curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'amber' as const },
			{
				text: '{ "id": 42, "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'amber' as const,
			},
			{
				text: '# 200 partners parse response["total"] as integer',
				color: 'red' as const,
			},
			{
				text: '# Their apps crash: "undefined method `/' + '\' for Hash"',
				color: 'red' as const,
			},
			{
				text: '# No way to serve BOTH formats from one controller',
				color: 'red' as const,
			},
		],
	},
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'v1-expects-cents': ['no-deprecation', 'no-migration-path'],
	'v2-wants-object': ['single-controller'],
	'breaking-deploy': ['breaking-change'],
};

// ─── Build step definitions ────────────────────────────────────────────
const STEP_DEFS = [
	{ id: 'add-v2-routes', label: 'Add Version Namespace' },
	{ id: 'generate-v2-controller', label: 'Generate V2 Controller' },
	{ id: 'create-v2-serializer', label: 'Create V2 Serializer' },
	{ id: 'add-deprecation', label: 'Add Deprecation Headers' },
	{ id: 'add-sunset', label: 'Add Sunset Header' },
	{ id: 'wire-v1-service', label: 'Wire V1 Controller' },
] as const;

const ADD_V2_ROUTES_COMMANDS = [
	{
		id: 'wrong-single-namespace',
		label: 'namespace :api do; resources :orders; end',
		command: 'cat config/routes.rb # namespace :api do; resources :orders; end',
		correct: false,
		feedback:
			'A single namespace serves one version. You need nested version namespaces so v1 and v2 can coexist under /api/v1/ and /api/v2/.',
	},
	{
		id: 'correct',
		label:
			'namespace :api do; namespace :v1 do; ... end; namespace :v2 do; ... end; end',
		command:
			'cat config/routes.rb # namespace :api do; namespace :v1 do; resources :orders; end; namespace :v2 do; resources :orders; end; end',
		correct: true,
	},
	{
		id: 'wrong-scope',
		label: 'scope "/v2" do; resources :orders; end',
		command: 'cat config/routes.rb # scope "/v2" do; resources :orders; end',
		correct: false,
		feedback:
			'scope changes the URL but not the controller lookup path. The controller would still be OrdersController, not Api::V2::OrdersController. Use namespace instead.',
	},
];

const GENERATE_V2_CONTROLLER_COMMANDS = [
	{
		id: 'wrong-no-namespace',
		label: 'rails g controller Orders show --no-helper',
		command: 'rails g controller Orders show --no-helper',
		correct: false,
		feedback:
			'This generates OrdersController in the root namespace. You need a controller nested under Api::V2:: to match the versioned route namespace.',
	},
	{
		id: 'wrong-v1',
		label: 'rails g controller api/v1/orders show --no-helper',
		command: 'rails g controller api/v1/orders show --no-helper',
		correct: false,
		feedback:
			'This generates the v1 controller, which already exists. You need the v2 controller for the new response format.',
	},
	{
		id: 'correct',
		label: 'rails g controller api/v2/orders show --no-helper',
		command: 'rails g controller api/v2/orders show --no-helper',
		correct: true,
	},
];

const CREATE_V2_SERIALIZER_OPTIONS = [
	{
		id: 'wrong-modify-v1',
		label: 'Modify existing v1 serializer to return object format',
		code: `# app/serializers/api/v1/order_serializer.rb
module Api::V1
  class OrderSerializer < BaseSerializer
    attribute :total do |order|
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    end
  end
end`,
		correct: false,
		feedback:
			'Modifying the v1 serializer changes the response for all v1 clients. The whole point of versioning is that v1 stays frozen. Create a new v2 serializer instead.',
	},
	{
		id: 'correct',
		label: 'New v2 serializer with object format, v1 stays frozen',
		code: `# app/serializers/api/v2/order_serializer.rb
module Api::V2
  class OrderSerializer < BaseSerializer
    attribute :total do |order|
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    end
    attribute :status
    attribute :line_items do |order|
      order.line_items.map { |li|
        { product_id: li.product_id, quantity: li.quantity }
      }
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-conditional',
		label: 'One serializer with version parameter',
		code: `class OrderSerializer < BaseSerializer
  def initialize(order, version: :v1)
    @version = version
    super(order)
  end

  attribute :total do |order|
    if @version == :v2
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    else
      order.total_cents
    end
  end
end`,
		correct: false,
		feedback:
			'Conditional logic in a shared serializer makes it fragile. Adding v3 means more branches. Separate serializers per version are simpler and independently testable.',
	},
];

const ADD_DEPRECATION_OPTIONS = [
	{
		id: 'wrong-no-headers',
		label: 'Log deprecation but send no headers',
		code: `# app/controllers/api/v1/base_controller.rb
module Api::V1
  class BaseController < Api::BaseController
    after_action :log_v1_usage

    private

    def log_v1_usage
      Rails.logger.warn("[DEPRECATED] v1 API called: #{request.path}")
    end
  end
end`,
		correct: false,
		feedback:
			'Server-side logging does not help API consumers. Clients need HTTP headers to detect deprecation programmatically and trigger migration alerts.',
	},
	{
		id: 'correct',
		label: 'Deprecation + Link headers in before_action',
		code: `# app/controllers/api/v1/base_controller.rb
module Api::V1
  class BaseController < Api::BaseController
    before_action :add_deprecation_headers

    private

    def add_deprecation_headers
      response.headers['Deprecation'] = 'true'
      response.headers['Link'] =
        '</api/v2/docs>; rel="successor-version"'
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-body-warning',
		label: 'Add deprecation warning in response body',
		code: `# app/controllers/api/v1/orders_controller.rb
module Api::V1
  class OrdersController < Api::BaseController
    def show
      order = Order.find(params[:id])
      render json: {
        _warning: "v1 is deprecated, migrate to v2",
        id: order.id,
        total: order.total_cents
      }
    end
  end
end`,
		correct: false,
		feedback:
			'Adding fields to the response body changes the contract and may break clients that strictly parse the schema. Use HTTP headers for metadata.',
	},
];

const ADD_SUNSET_OPTIONS = [
	{
		id: 'wrong-no-date',
		label: 'Sunset header with no specific date',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] = 'soon'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: false,
		feedback:
			'The Sunset header must contain an HTTP-date (RFC 7231) so clients can programmatically schedule their migration. "soon" is not parseable.',
	},
	{
		id: 'wrong-past-date',
		label: 'Sunset header with past date',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] = 'Sat, 01 Jan 2025 00:00:00 GMT'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: false,
		feedback:
			'A past date implies the endpoint should already be removed. Clients may interpret this as "already retired" and stop calling. Use a future date.',
	},
	{
		id: 'correct',
		label: 'Sunset header with future date (RFC 7231 format)',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] =
    'Sat, 01 Jun 2027 00:00:00 GMT'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: true,
	},
];

const WIRE_V1_SERVICE_OPTIONS = [
	{
		id: 'wrong-direct-render',
		label: 'Render JSON hash directly in controller',
		code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      order = Order.find(params[:id])
      render json: {
        id: order.id, total: order.total_cents
      }
    end
  end
end`,
		correct: false,
		feedback:
			'Rendering raw hashes in controllers bypasses serializers and the service layer. The controller should delegate to a service that returns a Result, then render via the versioned serializer.',
	},
	{
		id: 'correct',
		label: 'Controller delegates to service, renders via v1 serializer',
		code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      if result.success?
        render json: Api::V1::OrderSerializer
          .new(result.order).serializable_hash
      else
        render json: { error: { code: "NOT_FOUND",
          message: result.errors[:id]&.first } },
          status: :not_found
      end
    end
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-serializer',
		label: 'Service returns data, controller renders without serializer',
		code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      if result.success?
        render json: result.order.as_json(
          only: [:id, :total_cents])
      else
        render json: { error: result.errors },
          status: :not_found
      end
    end
  end
end`,
		correct: false,
		feedback:
			'as_json bypasses the serializer, making the response shape implicit and hard to test. Use the versioned serializer to ensure the contract is explicit and locked.',
	},
];

const TERMINAL_STEP_MAP: ({
	commands:
		| typeof ADD_V2_ROUTES_COMMANDS
		| typeof GENERATE_V2_CONTROLLER_COMMANDS;
	outputLines: { text: string; color: 'green' | 'cyan' }[];
} | null)[] = [
	{
		commands: ADD_V2_ROUTES_COMMANDS,
		outputLines: [
			{
				text: 'Routes updated: /api/v1/orders, /api/v2/orders',
				color: 'green' as const,
			},
		],
	},
	{
		commands: GENERATE_V2_CONTROLLER_COMMANDS,
		outputLines: [
			{
				text: 'create  app/controllers/api/v2/orders_controller.rb',
				color: 'green' as const,
			},
			{
				text: 'create  spec/requests/api/v2/orders_spec.rb',
				color: 'cyan' as const,
			},
		],
	},
	null, // create-v2-serializer: OptionCard
	null, // add-deprecation: OptionCard
	null, // add-sunset: OptionCard
	null, // wire-v1-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────
const STRESS_SCENARIOS = [
	{
		id: 'v1-cents',
		label: 'GET /api/v1/orders/42 (v1 client)',
		description: 'v1 client gets integer cents format with deprecation headers',
		method: 'GET' as const,
		path: '/api/v1/orders/42',
		actor: 'partner-a',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'v2-object',
		label: 'GET /api/v2/orders/42 (v2 client)',
		description: 'v2 client gets object format with amount and currency',
		method: 'GET' as const,
		path: '/api/v2/orders/42',
		actor: 'partner-b',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'v1-deprecated',
		label: 'GET /api/v1/orders (deprecated)',
		description: 'v1 response includes Deprecation and Sunset headers',
		method: 'GET' as const,
		path: '/api/v1/orders',
		actor: 'partner-a',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'v3-not-found',
		label: 'GET /api/v3/orders/42 (unknown)',
		description: 'v3 does not exist, returns 404',
		method: 'GET' as const,
		path: '/api/v3/orders/42',
		actor: 'unknown',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'v2-line-items',
		label: 'GET /api/v2/orders/42 (with line_items)',
		description: 'v2 includes line_items field not available in v1',
		method: 'GET' as const,
		path: '/api/v2/orders/42',
		actor: 'partner-b',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'no-version',
		label: 'GET /api/orders/42 (unversioned)',
		description: 'No version in path, returns 404 (must specify v1 or v2)',
		method: 'GET' as const,
		path: '/api/orders/42',
		actor: 'unknown',
		expectedResult: 'blocked' as const,
	},
];

// ─── Visualization types ───────────────────────────────────────────────
interface RouterState {
	v1Path: 'inactive' | 'active' | 'deprecated';
	v2Path: 'inactive' | 'active' | 'new';
	routerMode: 'single' | 'split';
}

// ─── Code preview builder ──────────────────────────────────────────────
function getCodeFiles(
	phase: 'observe' | 'build' | 'activate' | 'reward',
	furthestStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `# No versioning! One namespace, one set of controllers
Rails.application.routes.draw do
  namespace :api do
    resources :orders, only: [:index, :show, :create]
    # All clients hit the same controller
    # Changing the response breaks everyone
  end
end`,
			},
			{
				filename: 'app/controllers/api/orders_controller.rb',
				language: 'ruby',
				code: `# Single controller for all versions
class Api::OrdersController < ApplicationController
  def show
    result = FetchOrder.call(id: params[:id])
    if result.success?
      render json: {
        id: result.order.id,
        total: result.order.total_cents  # Integer cents
        # Change this to an object = break 200 partners
      }
    else
      render json: { error: { code: "NOT_FOUND",
        message: "Order not found" } },
        status: :not_found
    end
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (furthestStep >= 0) {
			files.push({
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :orders, only: [:index, :show, :create]
    end
    namespace :v2 do
      resources :orders, only: [:index, :show, :create]
    end
  end
end`,
			});
		}

		if (furthestStep >= 1) {
			files.push({
				filename: 'app/controllers/api/v2/orders_controller.rb',
				language: 'ruby',
				code: `module Api::V2
  class OrdersController < Api::BaseController
    def show
      # TODO: Use v2 serializer with object format
    end
  end
end`,
			});
		}

		if (furthestStep >= 2) {
			files.push({
				filename: 'app/serializers/api/v2/order_serializer.rb',
				language: 'ruby',
				code: `module Api::V2
  class OrderSerializer < BaseSerializer
    attribute :total do |order|
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    end
    attribute :status
    attribute :line_items do |order|
      order.line_items.map { |li|
        { product_id: li.product_id, quantity: li.quantity }
      }
    end
  end
end`,
			});
		}

		if (furthestStep >= 3) {
			files.push({
				filename: 'app/controllers/api/v1/base_controller.rb',
				language: 'ruby',
				code: `module Api::V1
  class BaseController < Api::BaseController
    before_action :add_deprecation_headers

    private

    def add_deprecation_headers
      response.headers['Deprecation'] = 'true'
      response.headers['Link'] =
        '</api/v2/docs>; rel="successor-version"'${
					furthestStep >= 4
						? `
      response.headers['Sunset'] =
        'Sat, 01 Jun 2027 00:00:00 GMT'`
						: ''
				}
    end
  end
end`,
			});
		}

		if (furthestStep >= 5) {
			files.push({
				filename: 'app/controllers/api/v1/orders_controller.rb',
				language: 'ruby',
				code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      if result.success?
        render json: Api::V1::OrderSerializer
          .new(result.order).serializable_hash
      else
        render json: { error: { code: "NOT_FOUND",
          message: result.errors[:id]&.first } },
          status: :not_found
      end
    end
  end
end`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'config/routes.rb',
				language: 'ruby',
				code: '# Step 1: Add version namespaces to routes...',
			});
		}

		return files;
	}

	// activate + reward: full solution
	return [
		{
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :orders, only: [:index, :show, :create]
    end
    namespace :v2 do
      resources :orders, only: [:index, :show, :create]
    end
  end

  namespace :webhooks do
    post 'stripe', to: 'stripe#create'
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/orders_controller.rb',
			language: 'ruby',
			code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      if result.success?
        render json: Api::V1::OrderSerializer
          .new(result.order).serializable_hash
      else
        render json: { error: { code: "NOT_FOUND",
          message: result.errors[:id]&.first } },
          status: :not_found
      end
    end
  end
end`,
		},
		{
			filename: 'app/controllers/api/v2/orders_controller.rb',
			language: 'ruby',
			code: `module Api::V2
  class OrdersController < Api::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      if result.success?
        render json: Api::V2::OrderSerializer
          .new(result.order).serializable_hash
      else
        render json: { error: { code: "NOT_FOUND",
          message: result.errors[:id]&.first } },
          status: :not_found
      end
    end
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/base_controller.rb',
			language: 'ruby',
			code: `module Api::V1
  class BaseController < Api::BaseController
    before_action :add_deprecation_headers

    private

    def add_deprecation_headers
      response.headers['Deprecation'] = 'true'
      response.headers['Sunset'] =
        'Sat, 01 Jun 2027 00:00:00 GMT'
      response.headers['Link'] =
        '</api/v2/docs>; rel="successor-version"'
    end
  end
end`,
		},
	];
}

// ─── Main component ────────────────────────────────────────────────────
export function Level40APIVersioning(_props: LevelComponentProps) {
	const [phase, setPhase] = useState<
		'observe' | 'build' | 'activate' | 'reward'
	>('observe');

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const [flowPhase, setFlowPhase] = useState(-1);
	const [routerState, setRouterState] = useState<RouterState>({
		v1Path: 'inactive',
		v2Path: 'inactive',
		routerMode: 'single',
	});
	const flowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleProbe = useCallback(
		(probeId: string) => {
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			setFlowPhase(0);

			// Observe: single controller, no versioning
			setRouterState({
				v1Path: 'active',
				v2Path: 'inactive',
				routerMode: 'single',
			});

			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
			flowTimerRef.current = setTimeout(() => {
				setFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 3);
		},
		[discoveryGating],
	);

	useEffect(() => {
		return () => {
			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
		};
	}, []);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	useEffect(() => {
		if (stepper.isComplete && phase === 'build') {
			setPhase('activate');
		}
	}, [stepper.isComplete, phase]);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardRouterState, setRewardRouterState] = useState<RouterState>({
		v1Path: 'deprecated',
		v2Path: 'new',
		routerMode: 'split',
	});
	const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleStressFire = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			setRewardFlowPhase(0);

			if (scenarioId === 'v1-cents' || scenarioId === 'v1-deprecated') {
				setRewardRouterState({
					v1Path: 'deprecated',
					v2Path: 'new',
					routerMode: 'split',
				});
			} else if (scenarioId === 'v2-object' || scenarioId === 'v2-line-items') {
				setRewardRouterState({
					v1Path: 'deprecated',
					v2Path: 'active',
					routerMode: 'split',
				});
			} else {
				// v3 or unversioned: show split but both dim
				setRewardRouterState({
					v1Path: 'inactive',
					v2Path: 'inactive',
					routerMode: 'split',
				});
			}

			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
			rewardTimerRef.current = setTimeout(() => {
				setRewardFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 2);
		},
		[stressTest],
	);

	useEffect(() => {
		return () => {
			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
		};
	}, []);

	// ── Render: Version Router visualization ──
	const renderVersionRouter = (isReward: boolean) => {
		const probeActive = isReward ? rewardFlowPhase !== -1 : flowPhase !== -1;
		const state = isReward ? rewardRouterState : routerState;

		const pathColor = (pathState: string) => {
			if (pathState === 'inactive')
				return 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50';
			if (pathState === 'deprecated')
				return 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30';
			if (pathState === 'new' || pathState === 'active')
				return 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
			return 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50';
		};

		const pathTextColor = (pathState: string) => {
			if (pathState === 'inactive') return 'text-muted-foreground';
			if (pathState === 'deprecated')
				return 'text-amber-600 dark:text-amber-400';
			return 'text-emerald-600 dark:text-emerald-400';
		};

		return (
			<div className="flex items-center gap-3 h-full px-4">
				{/* Clients */}
				<div className="flex flex-col gap-4 shrink-0">
					<div className="flex flex-col items-center gap-1">
						<div className="w-14 h-12 rounded-lg border-2 border-border bg-card flex items-center justify-center">
							<Monitor className="w-5 h-5 text-foreground" />
						</div>
						<span className="text-[10px] text-muted-foreground font-medium">
							v1 Client
						</span>
					</div>
					<div className="flex flex-col items-center gap-1">
						<div className="w-14 h-12 rounded-lg border-2 border-border bg-card flex items-center justify-center">
							<Globe className="w-5 h-5 text-foreground" />
						</div>
						<span className="text-[10px] text-muted-foreground font-medium">
							v2 Client
						</span>
					</div>
				</div>

				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Router */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div
						className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center ${
							isReward
								? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
								: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
						}`}
					>
						<GitBranch
							className={`w-6 h-6 ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						/>
						<span
							className={`text-[10px] font-semibold ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						>
							{state.routerMode === 'single' ? 'No Split' : 'Router'}
						</span>
					</div>
				</div>

				{/* Branching paths */}
				<div className="flex flex-col gap-3 shrink-0">
					{/* V1 path */}
					<div className="flex items-center gap-2">
						<FlowConnector
							active={probeActive && state.v1Path !== 'inactive'}
							direction="right"
							variant={state.v1Path === 'deprecated' ? 'warning' : 'muted'}
						/>
						<div
							className={`w-44 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${pathColor(state.v1Path)}`}
						>
							<span
								className={`text-xs font-semibold ${pathTextColor(state.v1Path)}`}
							>
								Api::V1::Orders
							</span>
							<span className={`text-[10px] ${pathTextColor(state.v1Path)}`}>
								{state.v1Path === 'deprecated'
									? 'Deprecated + Sunset'
									: state.v1Path === 'active'
										? '{ "total": 1999 }'
										: 'Not versioned'}
							</span>
						</div>
						{state.v1Path === 'deprecated' && (
							<Badge
								className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
								variant="outline"
							>
								Sunset
							</Badge>
						)}
					</div>

					{/* V2 path */}
					<div className="flex items-center gap-2">
						<FlowConnector
							active={
								probeActive &&
								state.v2Path !== 'inactive' &&
								state.routerMode === 'split'
							}
							direction="right"
							variant={state.v2Path === 'inactive' ? 'muted' : 'success'}
						/>
						<div
							className={`w-44 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${
								state.routerMode === 'single'
									? 'border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30'
									: pathColor(state.v2Path)
							}`}
						>
							<span
								className={`text-xs font-semibold ${
									state.routerMode === 'single'
										? 'text-muted-foreground'
										: pathTextColor(state.v2Path)
								}`}
							>
								{state.routerMode === 'single'
									? '(does not exist)'
									: 'Api::V2::Orders'}
							</span>
							<span
								className={`text-[10px] ${
									state.routerMode === 'single'
										? 'text-muted-foreground'
										: pathTextColor(state.v2Path)
								}`}
							>
								{state.routerMode === 'split' && state.v2Path !== 'inactive'
									? '{ "total": { ... } }'
									: state.routerMode === 'split'
										? '404 Not Found'
										: 'No v2 route'}
							</span>
						</div>
						{state.routerMode === 'split' && state.v2Path !== 'inactive' && (
							<Badge
								className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
								variant="outline"
							>
								Current
							</Badge>
						)}
					</div>
				</div>

				{/* Response */}
				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div className="w-14 h-12 rounded-lg border-2 border-border bg-card flex items-center justify-center">
						<Server className="w-5 h-5 text-foreground" />
					</div>
					<span className="text-[10px] text-muted-foreground font-medium">
						Response
					</span>
				</div>
			</div>
		);
	};

	// ── Build phase: current step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 0)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[0] };
		if (idx === 1)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[1] };
		if (idx === 2)
			return {
				type: 'option' as const,
				options: CREATE_V2_SERIALIZER_OPTIONS,
			};
		if (idx === 3)
			return {
				type: 'option' as const,
				options: ADD_DEPRECATION_OPTIONS,
			};
		if (idx === 4)
			return { type: 'option' as const, options: ADD_SUNSET_OPTIONS };
		if (idx === 5)
			return {
				type: 'option' as const,
				options: WIRE_V1_SERVICE_OPTIONS,
			};
		return null;
	}, [stepper.currentStep]);

	// ── Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							Your API returns order totals as integer cents:{' '}
							{`{ "total": 1999 }`}. Product wants v2 to return{' '}
							{`{ "total": { "amount": "19.99", "currency": "USD" } }`}. 200
							partners use v1. Changing the shape breaks all of them.
						</p>
					</div>
					<DiscoveryChecklist
						discoveries={DISCOVERY_DEFS.map((d) => ({
							id: d.id,
							label: d.label,
							found: discoveryGating.isDiscovered(d.id),
						}))}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Implement URL path versioning with namespaced controllers and
							serializers. Add deprecation headers to v1.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						furthestStep={stepper.furthestStep}
						steps={STEP_DEFS.map((s) => s.label)}
					/>
				</div>
			);
		}

		if (phase === 'activate') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Solution Complete
						</h3>
						<p className="text-sm text-muted-foreground">
							API versioned with namespaced routes, separate controllers and
							serializers, deprecation headers, and Sunset date.
						</p>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">
								Correctly versioned response
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">
								Deprecated version (with headers)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Unknown version (404)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Served</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Not Found</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleStressFire)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
			</div>
		);
	};

	// ── Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0 flex items-center justify-center">
						{renderVersionRouter(false)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={flowPhase !== -1}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build' && currentStepConfig) {
			if (currentStepConfig.type === 'terminal' && currentStepConfig.commands) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Set up versioned route namespaces so v1 and v2 requests map to separate controllers.'}
									{stepper.currentStep === 1 &&
										'Generate the v2 controller under the Api::V2 module namespace.'}
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].label}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option') {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].label}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'How should the v2 serializer differ from v1? Remember: v1 must stay frozen.'}
								{stepper.currentStep === 3 &&
									'How should v1 clients learn that the version is deprecated?'}
								{stepper.currentStep === 4 &&
									'What should the Sunset header value be?'}
								{stepper.currentStep === 5 &&
									'How should the v1 controller render its response?'}
							</p>
						</div>
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									code={opt.code}
									correct={opt.correct}
									key={opt.id}
									label={opt.label}
									onSelect={() => {
										if (opt.correct) {
											stepper.completeStep();
										} else if (opt.feedback) {
											stepper.recordWrongAttempt(opt.feedback);
										}
									}}
								/>
							))}
						</div>
						{stepper.lastFeedback && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button onClick={stepper.nextStep} variant="outline">
									Next Step <ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							)}
					</div>
				);
			}
		}

		if (phase === 'activate') {
			return (
				<div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
					<div className="flex items-center gap-1">
						{[1, 2, 3].map((star) => (
							<Zap
								className="w-8 h-8 text-amber-400 fill-amber-400"
								key={star}
							/>
						))}
					</div>
					<Button onClick={() => setPhase('reward')} size="lg">
						Visualize API Versions <ArrowRight className="w-4 h-4 ml-2" />
					</Button>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0 flex items-center justify-center">
					{renderVersionRouter(true)}
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						disabled={rewardFlowPhase !== -1}
						onFire={handleStressFire}
						scenarios={STRESS_SCENARIOS}
						stressTest={stressTest}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>{renderCenterPanel()}</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? stepper.furthestStep : 0,
					)}
					learningGoal="URL path versioning with namespaced controllers lets v1 and v2 coexist. Deprecation and Sunset headers guide client migration."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level40APIVersioning;

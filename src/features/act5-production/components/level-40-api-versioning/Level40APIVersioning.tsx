/**
 * Level 40: API Versioning
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 3-node fork visualization.
 *   Left: v1 Partner (top), v2 Partner (bottom). Right: Rails App (large, with internal routing).
 *   Probes show v1 clients breaking on format changes, missing deprecation headers,
 *   and v2 routes not existing.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Add v2 namespace to routes (terminal)
 *   Step 1: Generate v2 controller (terminal)
 *   Step 2: Create v2 serializer with new response shape (option)
 *   Step 3: Add deprecation headers to v1 (option)
 *   Step 4: Add Sunset header (option)
 *   Step 5: Freeze v1 controller with dedicated serializer (option)
 *
 * Phase 3 (reward): Same 3 nodes, but App shows v1|v2 split internally.
 *   v1 gets cents format with deprecation headers. v2 gets object format.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, Server, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	AnimatedDots,
	type DotConfig,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act5-level40-api-versioning', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface PartnerVizState {
	label: string;
	flash: ZoneFlash;
	responseJson: string | null;
}

interface AppVizState {
	label: string;
	flash: ZoneFlash;
	badge: string | null;
	// Internal routing panels (reward only)
	v1Label: string | null;
	v1Flash: ZoneFlash;
	v2Label: string | null;
	v2Flash: ZoneFlash;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	v1Partner?: Partial<PartnerVizState>;
	v2Partner?: Partial<PartnerVizState>;
	app?: Partial<AppVizState>;
	/** v1 Partner <-> App edge */
	edge1?: Partial<EdgeVizState>;
	/** v2 Partner <-> App edge */
	edge2?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_V1: PartnerVizState = {
	label: 'Idle',
	flash: 'idle',
	responseJson: null,
};

const DEFAULT_V2: PartnerVizState = {
	label: 'Idle',
	flash: 'idle',
	responseJson: null,
};

const DEFAULT_APP: AppVizState = {
	label: 'Single Controller',
	flash: 'idle',
	badge: null,
	v1Label: null,
	v1Flash: 'idle',
	v2Label: null,
	v2Flash: 'idle',
};

const DEFAULT_APP_REWARD: AppVizState = {
	label: 'Version Router',
	flash: 'idle',
	badge: null,
	v1Label: 'v1: cents',
	v1Flash: 'green',
	v2Label: 'v2: object',
	v2Flash: 'green',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'single-controller', label: 'One controller serves all API versions' },
	{ id: 'breaking-change', label: 'Response shape change breaks v1 clients' },
	{ id: 'no-deprecation', label: 'No deprecation warning for v1 consumers' },
	{ id: 'no-migration-path', label: 'No v2 endpoint exists for new clients' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'v1-format-break',
		label: 'v1 partner fetches order (format changed)',
		command: 'curl localhost:3000/api/orders/42',
		responseLines: [
			{ text: '200 OK', color: 'green' as const },
			{
				text: '{ "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'yellow' as const,
			},
			{
				text: '# v1 partner expects total as integer (1999 cents)',
				color: 'red' as const,
			},
			{
				text: '# Their code: order.total / 100 -> NaN (got object)',
				color: 'red' as const,
			},
		],
		story: [
			'A v1 partner integration fetches order #42.',
			'They expect { "total": 1999 } (integer cents).',
			'But product deployed the v2 format: total is now a money object.',
			'Since there is only one controller, all clients get the new format.',
			'The partner code does total / 100 and gets NaN.',
		],
	},
	{
		id: 'no-deprecation',
		label: 'v1 partner checks for deprecation notice',
		command:
			'curl -I localhost:3000/api/orders/42 | grep -i "deprecation\\|sunset"',
		responseLines: [
			{ text: '# Checking response headers...', color: 'cyan' as const },
			{
				text: '# No Deprecation header found',
				color: 'red' as const,
			},
			{
				text: '# No Sunset header found',
				color: 'red' as const,
			},
			{
				text: '# Partner has no idea changes are coming',
				color: 'red' as const,
			},
		],
		story: [
			'A v1 partner developer checks the response headers.',
			'They look for Deprecation, Sunset, and Link headers.',
			'None exist. No warning that v1 is being replaced.',
			'No migration path. No timeline. No successor version link.',
			'When you deploy v2, they will be blindsided.',
		],
	},
	{
		id: 'v2-404',
		label: 'v2 partner wants money object format',
		command: 'curl localhost:3000/api/v2/orders/42',
		responseLines: [
			{
				text: '404 Not Found',
				color: 'red' as const,
			},
			{
				text: '{ "error": { "code": "NOT_FOUND", "message": "No route matches /api/v2/*" } }',
				color: 'red' as const,
			},
			{
				text: '# No /api/v2 namespace exists',
				color: 'red' as const,
			},
		],
		story: [
			'A new partner building an integration wants the structured money object.',
			'They try GET /api/v2/orders/42.',
			'The route does not exist. There is no v2 namespace.',
			'They get 404. No way to get the new format.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'v1-format-break': ['single-controller', 'breaking-change'],
	'no-deprecation': ['no-deprecation'],
	'v2-404': ['no-migration-path'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'v1-format-break': [
		{
			v1Partner: {
				label: 'GET /api/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /api/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing...', flash: 'idle', badge: null },
		},
		{
			edge1: { active: false },
			app: { label: 'New format deployed!', flash: 'amber', badge: 'CHANGED' },
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK (v2 format)',
				dotColor: 'bg-amber-500',
			},
			app: { label: 'Returns money object', flash: 'amber' },
			v1Partner: { label: 'Parsing response...' },
		},
		{
			edge1: { active: false },
			v1Partner: {
				label: 'total / 100 = NaN!',
				flash: 'red',
				responseJson: '{ "total": { "amount": "19.99" } }',
			},
			app: {
				label: 'One controller, no versions',
				flash: 'red',
				badge: 'BREAKING',
			},
		},
	],
	'no-deprecation': [
		{
			v1Partner: {
				label: 'Checking headers...',
				flash: 'idle',
				responseJson: null,
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /api/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing...', flash: 'idle', badge: null },
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'No deprecation headers', flash: 'amber' },
		},
		{
			edge1: { active: false },
			v1Partner: {
				label: 'No Deprecation header',
				flash: 'amber',
				responseJson: null,
			},
			app: { label: 'No Sunset, no Link', flash: 'red', badge: 'NO HEADERS' },
		},
		{
			v1Partner: {
				label: 'No warning. Blindsided!',
				flash: 'red',
				responseJson: null,
			},
		},
	],
	'v2-404': [
		{
			v2Partner: {
				label: 'GET /api/v2/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /api/v2/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Route lookup...', flash: 'idle', badge: null },
		},
		{
			edge2: { active: false },
			app: { label: 'No route matches!', flash: 'red', badge: '404' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '404 Not Found',
				dotColor: 'bg-red-500',
			},
			v2Partner: { label: 'Receiving error...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			v2Partner: {
				label: 'v2 does not exist!',
				flash: 'red',
				responseJson: '404: No route /api/v2/*',
			},
			app: { label: 'No v2 namespace', flash: 'red' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'v1-format-break': [
		// Same start: v1 partner fetches order
		{
			v1Partner: {
				label: 'GET /api/v1/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /api/v1/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: {
				label: 'Version Router',
				flash: 'idle',
				badge: null,
				v1Label: 'v1: routing...',
				v1Flash: 'amber',
			},
		},
		// Divergence: v1 controller returns frozen cents format
		{
			edge1: { active: false },
			app: {
				label: 'v1 Controller',
				flash: 'green',
				v1Label: 'v1: cents format',
				v1Flash: 'green',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '200 OK + Deprecation',
				dotColor: 'bg-emerald-500',
			},
			v1Partner: { label: 'Parsing response...' },
		},
		{
			edge1: { active: false },
			v1Partner: {
				label: 'total: 1999 (works!)',
				flash: 'green',
				responseJson: '{ "total": 1999 } + Sunset header',
			},
			app: { label: 'Served v1 format', flash: 'green' },
		},
	],
	'no-deprecation': [
		// Same start: v1 partner checks headers
		{
			v1Partner: {
				label: 'Checking headers...',
				flash: 'idle',
				responseJson: null,
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /api/v1/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: {
				label: 'Version Router',
				flash: 'idle',
				badge: null,
				v1Label: 'v1: adding headers',
				v1Flash: 'amber',
			},
		},
		// Divergence: v1 controller adds deprecation headers
		{
			edge1: {
				active: true,
				reverse: true,
				label: '200 + Deprecation + Sunset',
				dotColor: 'bg-emerald-500',
			},
			app: { label: 'Headers added', flash: 'green', badge: 'DEPRECATED' },
		},
		{
			edge1: { active: false },
			v1Partner: {
				label: 'Deprecation: true',
				flash: 'green',
				responseJson: 'Sunset: 2027-06-01, Link: /api/v2',
			},
			app: { label: 'Migration path provided', flash: 'green' },
		},
	],
	'v2-404': [
		// Same start: v2 partner tries v2 endpoint
		{
			v2Partner: {
				label: 'GET /api/v2/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /api/v2/orders/42',
				dotColor: 'bg-cyan-500',
			},
			app: {
				label: 'Version Router',
				flash: 'idle',
				badge: null,
				v2Label: 'v2: routing...',
				v2Flash: 'amber',
			},
		},
		// Divergence: v2 controller returns money object
		{
			edge2: { active: false },
			app: {
				label: 'v2 Controller',
				flash: 'green',
				v2Label: 'v2: object format',
				v2Flash: 'green',
			},
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '200 OK (v2 format)',
				dotColor: 'bg-emerald-500',
			},
			v2Partner: { label: 'Parsing response...' },
		},
		{
			edge2: { active: false },
			v2Partner: {
				label: 'Got money object!',
				flash: 'green',
				responseJson: '{ "total": { "amount": "19.99" } }',
			},
			app: { label: 'Served v2 format', flash: 'green' },
		},
	],
	'v1-v2-coexist': [
		// Both partners request simultaneously
		{
			v1Partner: {
				label: 'GET /api/v1/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			v2Partner: {
				label: 'GET /api/v2/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge1: {
				active: true,
				reverse: false,
				label: 'GET /api/v1/...',
				dotColor: 'bg-cyan-500',
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /api/v2/...',
				dotColor: 'bg-cyan-500',
			},
			app: {
				label: 'Version Router',
				flash: 'idle',
				badge: null,
				v1Label: 'v1: routing',
				v1Flash: 'amber',
				v2Label: 'v2: routing',
				v2Flash: 'amber',
			},
		},
		{
			edge1: { active: false },
			edge2: { active: false },
			app: {
				label: 'Both versions active',
				flash: 'green',
				v1Label: 'v1: cents + headers',
				v1Flash: 'green',
				v2Label: 'v2: money object',
				v2Flash: 'green',
			},
		},
		{
			edge1: {
				active: true,
				reverse: true,
				label: '{ total: 1999 }',
				dotColor: 'bg-emerald-500',
			},
			edge2: {
				active: true,
				reverse: true,
				label: '{ total: { ... } }',
				dotColor: 'bg-emerald-500',
			},
		},
		{
			edge1: { active: false },
			edge2: { active: false },
			v1Partner: {
				label: 'Cents format (works!)',
				flash: 'green',
				responseJson: '{ "total": 1999 } + Deprecation',
			},
			v2Partner: {
				label: 'Object format (works!)',
				flash: 'green',
				responseJson: '{ "total": { "amount": "19.99" } }',
			},
			app: { label: 'Both coexist!', flash: 'green', badge: 'VERSIONED' },
		},
	],
	'v3-not-found': [
		{
			v2Partner: {
				label: 'GET /api/v3/orders/42',
				flash: 'idle',
				responseJson: null,
			},
			edge2: {
				active: true,
				reverse: false,
				label: 'GET /api/v3/orders/42',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Version Router', flash: 'idle', badge: null },
		},
		{
			edge2: { active: false },
			app: { label: 'No v3 namespace', flash: 'amber', badge: '404' },
		},
		{
			edge2: {
				active: true,
				reverse: true,
				label: '404 Not Found',
				dotColor: 'bg-red-500',
			},
			v2Partner: {
				label: '404: v3 does not exist',
				flash: 'red',
				responseJson: null,
			},
			app: { label: 'Only v1 and v2', flash: 'idle' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'add-v2-routes', title: 'Add Version Namespace' },
	{ id: 'generate-v2-controller', title: 'Generate V2 Controller' },
	{ id: 'create-v2-serializer', title: 'Create V2 Serializer' },
	{ id: 'add-deprecation', title: 'Add Deprecation Headers' },
	{ id: 'add-sunset', title: 'Add Sunset Header' },
	{ id: 'freeze-v1', title: 'Freeze V1 Controller' },
];

const ADD_V2_ROUTES_COMMANDS = [
	{
		id: 'wrong-single-namespace',
		label: 'namespace :api do; resources :orders; end',
		command:
			'echo "namespace :api do; resources :orders; end" >> config/routes.rb',
		correct: false,
		feedback:
			'A single namespace cannot serve two formats. You need separate v1 and v2 namespaces so each version gets its own controllers.',
	},
	{
		id: 'wrong-scope',
		label: 'scope "/api/v2" do; resources :orders; end',
		command:
			'echo "scope \\"/api/v2\\" do; resources :orders; end" >> config/routes.rb',
		correct: false,
		feedback:
			'scope only changes the URL path, not the controller namespace. Routes would still hit Api::OrdersController instead of Api::V2::OrdersController.',
	},
	{
		id: 'correct',
		label:
			'namespace :api do; namespace :v1 do; ...; namespace :v2 do; ...; end',
		command:
			"cat > config/routes.rb << 'ROUTES'\nRails.application.routes.draw do\n  namespace :api do\n    namespace :v1 do\n      resources :orders\n    end\n    namespace :v2 do\n      resources :orders\n    end\n  end\nend\nROUTES",
		correct: true,
	},
];

const GENERATE_V2_COMMANDS = [
	{
		id: 'wrong-no-namespace',
		label: 'rails g controller Orders show index',
		command: 'rails g controller Orders show index',
		correct: false,
		feedback:
			'This generates an unnamespaced controller. You need Api::V2::OrdersController to match the v2 route namespace.',
	},
	{
		id: 'correct',
		label: 'rails g controller api/v2/orders show index',
		command: 'rails g controller api/v2/orders show index',
		correct: true,
	},
	{
		id: 'wrong-v1',
		label: 'rails g controller api/v1/orders show index',
		command: 'rails g controller api/v1/orders show index',
		correct: false,
		feedback:
			'V1 already exists. You need to generate the V2 controller alongside it.',
	},
];

const V2_SERIALIZER_OPTIONS = [
	{
		id: 'wrong-modify-v1',
		label: 'Modify existing Api::V1::OrderSerializer',
		code: `# Modify the existing serializer to return both formats
class Api::V1::OrderSerializer < BaseSerializer
  attribute :total do |order|
    { amount: (order.total_cents / 100.0).to_s,
      currency: order.currency }
  end
end`,
		correct: false,
		feedback:
			'Modifying v1 serializer changes the response for existing partners. Each version needs its own serializer so changes are isolated.',
	},
	{
		id: 'wrong-conditional',
		label: 'Conditional serializer based on version header',
		code: `class Api::OrderSerializer < BaseSerializer
  attribute :total do |order, params|
    if params[:version] == 'v2'
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    else
      order.total_cents
    end
  end
end`,
		correct: false,
		feedback:
			'A shared serializer with conditionals couples versions together. Adding v3 logic later makes this unmanageable. Separate serializers per version.',
	},
	{
		id: 'correct',
		label: 'New Api::V2::OrderSerializer with money object',
		code: `module Api::V2
  class OrderSerializer < BaseSerializer
    attribute :total do |order|
      { amount: (order.total_cents / 100.0).to_s,
        currency: order.currency }
    end
    attribute :status
    attribute :line_items do |order|
      order.line_items.map { |li|
        { product_id: li.product_id,
          quantity: li.quantity } }
    end
  end
end`,
		correct: true,
	},
];

const DEPRECATION_OPTIONS = [
	{
		id: 'wrong-no-headers',
		label: 'No deprecation signal (just update docs)',
		code: `# Update the API docs page to say "v1 is deprecated"
# No headers, no code changes
# Partners will read the docs... eventually`,
		correct: false,
		feedback:
			'Documentation alone is not enough. Partners parse response headers programmatically. Without Deprecation headers, automated migration tools cannot detect the change.',
	},
	{
		id: 'correct',
		label: 'Add Deprecation and Link headers to v1',
		code: `module Api::V1
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
		code: `def show
  result = FetchOrder.call(id: params[:id])
  render json: {
    warning: "v1 is deprecated, use v2",
    data: Api::V1::OrderSerializer
      .new(result.order).serializable_hash
  }
end`,
		correct: false,
		feedback:
			'Adding a warning field to the response body changes the response shape, which is itself a breaking change. Deprecation signals belong in HTTP headers, not the body.',
	},
];

const SUNSET_OPTIONS = [
	{
		id: 'wrong-no-date',
		label: 'Sunset header with no date',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] = 'soon'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: false,
		feedback:
			'The Sunset header (RFC 8594) requires an HTTP-date value. "soon" is not a valid date. Partners need a concrete deadline to plan their migration.',
	},
	{
		id: 'wrong-past-date',
		label: 'Sunset date in the past',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] = 'Mon, 01 Jan 2024 00:00:00 GMT'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: false,
		feedback:
			'A sunset date in the past implies v1 should already be gone. Partners need 6-12 months of notice. Set a future date.',
	},
	{
		id: 'correct',
		label: 'Sunset header with future date (12 months)',
		code: `def add_deprecation_headers
  response.headers['Deprecation'] = 'true'
  response.headers['Sunset'] =
    'Sun, 01 Jun 2027 00:00:00 GMT'
  response.headers['Link'] =
    '</api/v2/docs>; rel="successor-version"'
end`,
		correct: true,
	},
];

const FREEZE_V1_OPTIONS = [
	{
		id: 'wrong-direct-render',
		label: 'Render JSON directly in v1 controller',
		code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      order = Order.find(params[:id])
      render json: { id: order.id,
        total: order.total_cents }
    end
  end
end`,
		correct: false,
		feedback:
			'Inline JSON in the controller bypasses the service object pattern (L16+). The controller should delegate to a service and use a dedicated v1 serializer.',
	},
	{
		id: 'wrong-shared-serializer',
		label: 'Use the shared (unversioned) serializer',
		code: `module Api::V1
  class OrdersController < Api::V1::BaseController
    def show
      result = FetchOrder.call(id: params[:id])
      render json: OrderSerializer
        .new(result.order).serializable_hash
    end
  end
end`,
		correct: false,
		feedback:
			'Using the shared serializer means v1 output changes whenever the shared serializer is updated. V1 needs its own frozen serializer to guarantee stability.',
	},
	{
		id: 'correct',
		label: 'Dedicated v1 serializer via service',
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
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: ADD_V2_ROUTES_COMMANDS,
		outputLines: [
			{
				text: 'Routes updated: /api/v1/* and /api/v2/*',
				color: 'green' as const,
			},
		],
	},
	{
		commands: GENERATE_V2_COMMANDS,
		outputLines: [
			{
				text: 'create  app/controllers/api/v2/orders_controller.rb',
				color: 'green' as const,
			},
		],
	},
	null, // create-v2-serializer: OptionCard
	null, // add-deprecation: OptionCard
	null, // add-sunset: OptionCard
	null, // freeze-v1: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'v1-format-break',
		label: 'v1 partner fetches order (versioned)',
		description: 'v1 Partner gets cents format with deprecation headers',
		method: 'GET' as const,
		path: '/api/v1/orders/42',
		actor: 'v1-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '{ "total": 1999 }', color: 'green' },
			{ text: 'Deprecation: true, Sunset: 2027-06-01', color: 'yellow' },
		],
		story: [
			'Same v1 partner, same request.',
			'But now /api/v1/orders routes to the v1 controller.',
			'Response returns cents format (1999) with Deprecation headers.',
			'Partner code works. They have 12 months to migrate.',
		],
	},
	{
		id: 'no-deprecation',
		label: 'v1 partner checks deprecation (with headers)',
		description: 'Deprecation + Sunset + Link headers present',
		method: 'GET' as const,
		path: '/api/v1/orders/42',
		actor: 'v1-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'Deprecation: true', color: 'yellow' },
			{ text: 'Sunset: Sun, 01 Jun 2027 00:00:00 GMT', color: 'yellow' },
			{ text: 'Link: </api/v2/docs>; rel="successor-version"', color: 'green' },
		],
		story: [
			'Same partner developer checking headers.',
			'Now they see: Deprecation: true.',
			'Sunset date: June 2027 (12 months of notice).',
			'Link header points to v2 docs for migration.',
		],
	},
	{
		id: 'v2-404',
		label: 'v2 partner gets money object (versioned)',
		description: 'v2 endpoint exists with structured format',
		method: 'GET' as const,
		path: '/api/v2/orders/42',
		actor: 'v2-partner',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '{ "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'green',
			},
		],
		story: [
			'Same new partner, same request.',
			'But now /api/v2/orders exists.',
			'Response returns money object format.',
			'Partner gets what they need.',
		],
	},
	{
		id: 'v1-v2-coexist',
		label: 'v1 and v2 coexist simultaneously',
		description: 'Both versions serve correct format at the same time',
		method: 'GET' as const,
		path: '/api/v1 + /api/v2',
		actor: 'both',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'v1: { "total": 1999 } + Deprecation headers', color: 'yellow' },
			{
				text: 'v2: { "total": { "amount": "19.99", "currency": "USD" } }',
				color: 'green',
			},
			{ text: 'Both versions active, zero conflicts', color: 'green' },
		],
		story: [
			'Both v1 and v2 partners make requests at the same time.',
			'v1 gets cents format with deprecation headers.',
			'v2 gets money object format.',
			'Both work. Zero conflicts. This is the goal.',
		],
	},
	{
		id: 'v3-not-found',
		label: 'GET /api/v3/orders (unknown version)',
		description: 'Unknown version returns 404',
		method: 'GET' as const,
		path: '/api/v3/orders/42',
		actor: 'unknown',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '404 Not Found', color: 'red' },
			{ text: 'No /api/v3 namespace configured', color: 'muted' },
		],
		story: [
			'Someone tries a version that does not exist.',
			'Only v1 and v2 are configured.',
			'Clean 404 error. No ambiguity.',
		],
	},
];

// ─── Code preview builder ──────────────────────────────────────────────

function getCodeFiles(
	phase: 'observe' | 'build' | 'reward',
	completedStep: number,
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
				code: `# Single controller, one serializer for all clients
class Api::OrdersController < ApplicationController
  def show
    result = FetchOrder.call(id: params[:id])
    if result.success?
      render json: OrderSerializer
        .new(result.order).serializable_hash
    else
      render json: { error: { code: "NOT_FOUND",
        message: "Order not found" } },
        status: :not_found
    end
  end
end`,
			},
			{
				filename: 'app/serializers/order_serializer.rb',
				language: 'ruby',
				code: `# One serializer shared by all clients
class OrderSerializer < BaseSerializer
  attributes :id, :status
  attribute :total do |order|
    order.total_cents  # Integer cents (1999)
    # Changing this to a money object breaks
    # every partner parsing this response
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
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

		if (completedStep >= 1) {
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

		if (completedStep >= 2) {
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
        { product_id: li.product_id,
          quantity: li.quantity } }
    end
  end
end`,
			});
		}

		if (completedStep >= 3) {
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
					completedStep >= 4
						? `
      response.headers['Sunset'] =
        'Sun, 01 Jun 2027 00:00:00 GMT'`
						: '\n      # Next: Add Sunset header...'
				}
    end
  end
end`,
			});
		}

		if (completedStep >= 5) {
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

	// reward: full solution
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
        'Sun, 01 Jun 2027 00:00:00 GMT'
      response.headers['Link'] =
        '</api/v2/docs>; rel="successor-version"'
    end
  end
end`,
		},
	];
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

const FLASH_BORDER: Record<ZoneFlash, string> = {
	idle: 'border-border',
	red: 'border-red-500 dark:border-red-400',
	green: 'border-emerald-500 dark:border-emerald-400',
	amber: 'border-amber-500 dark:border-amber-400',
};

const FLASH_BG: Record<ZoneFlash, string> = {
	idle: 'bg-card',
	red: 'bg-red-50 dark:bg-red-950/30',
	green: 'bg-emerald-50 dark:bg-emerald-950/30',
	amber: 'bg-amber-50 dark:bg-amber-950/30',
};

// ── Partner node (used for both v1 and v2) ──

interface PartnerNodeData extends PartnerVizState {
	version: string;
	[key: string]: unknown;
}

const PartnerNode = memo(({ data }: { data: PartnerNodeData }) => {
	const d = data as PartnerNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-40 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Users className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">
					{d.version} Partner
				</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
			{d.responseJson && (
				<div className="text-xs font-mono mt-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate">
					{d.responseJson}
				</div>
			)}
		</div>
	);
});

// ── App node (with optional v1/v2 sub-panels for reward) ──

interface AppNodeData extends AppVizState {
	[key: string]: unknown;
}

const VersionAppNode = memo(({ data }: { data: AppNodeData }) => {
	const d = data as AppNodeData;
	const showPanels = d.v1Label || d.v2Label;

	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 ${showPanels ? 'w-56' : 'w-48'} p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Server className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Rails App</span>
				{d.badge && (
					<Badge
						className={`text-xs ml-auto ${
							d.badge === 'VERSIONED' || d.badge === 'DEPRECATED'
								? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
								: 'text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
						}`}
						variant="outline"
					>
						{d.badge}
					</Badge>
				)}
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>

			{showPanels && (
				<div className="flex gap-1 mt-2 pt-2 border-t border-border">
					{d.v1Label && (
						<div
							className={`flex-1 rounded border ${FLASH_BORDER[d.v1Flash]} ${FLASH_BG[d.v1Flash]} p-1 text-center transition-colors duration-300`}
						>
							<div className="text-xs font-semibold text-foreground truncate">
								{d.v1Label}
							</div>
						</div>
					)}
					{d.v2Label && (
						<div
							className={`flex-1 rounded border ${FLASH_BORDER[d.v2Flash]} ${FLASH_BG[d.v2Flash]} p-1 text-center transition-colors duration-300`}
						>
							<div className="text-xs font-semibold text-foreground truncate">
								{d.v2Label}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
});

// ── Custom edge (same pattern as L38/L39) ──

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface VersionEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const VersionEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as VersionEdgeData;
		const [edgePath, labelX, labelY] = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
		});

		const fill = toDotFill(d.dotColor);
		const dotPath = d.reverse ? reversePath(edgePath) : edgePath;

		const dots: DotConfig[] = d.active
			? [0, 1, 2].map((i) => ({
					id: `${id}-d${i}`,
					color: fill,
					r: 5,
					dur: '1.2s',
					begin: i === 0 ? '0s' : `-${i * 0.4}s`,
				}))
			: [];

		return (
			<>
				<BaseEdge
					id={id}
					path={edgePath}
					style={{
						stroke: d.active ? fill : '#a1a1aa',
						strokeWidth: 2,
						strokeDasharray: '6 4',
					}}
				/>
				{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
				{d.label && (
					<EdgeLabelRenderer>
						<div
							className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
							style={{
								transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)`,
							}}
						>
							{d.label}
						</div>
					</EdgeLabelRenderer>
				)}
			</>
		);
	},
);

// ── Node and edge type registries ──

const versionNodeTypes = {
	partner: PartnerNode,
	app: VersionAppNode,
};
const versionEdgeTypes = { version: VersionEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level40APIVersioning({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [v1State, setV1State] = useState<PartnerVizState>(DEFAULT_V1);
	const [v2State, setV2State] = useState<PartnerVizState>(DEFAULT_V2);
	const [appState, setAppState] = useState<AppVizState>(DEFAULT_APP);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setV1State(DEFAULT_V1);
		setV2State(DEFAULT_V2);
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.v1Partner)
			setV1State((prev) => ({ ...prev, ...frame.v1Partner }));
		if (frame.v2Partner)
			setV2State((prev) => ({ ...prev, ...frame.v2Partner }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.edge1) setEdge1State((prev) => ({ ...prev, ...frame.edge1 }));
		if (frame.edge2) setEdge2State((prev) => ({ ...prev, ...frame.edge2 }));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void, frameDelay?: number) => {
			const delay = frameDelay ?? ANIMATION_DURATION_MS;
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			resetViz();
			setVizAnimating(true);

			const newTimers: ReturnType<typeof setTimeout>[] = [];
			for (let i = 0; i < frames.length; i++) {
				const t = setTimeout(() => applyFrame(frames[i]), i * delay);
				newTimers.push(t);
			}
			const tCleanup = setTimeout(() => {
				setEdge1State((prev) => ({ ...prev, active: false }));
				setEdge2State((prev) => ({ ...prev, active: false }));
			}, frames.length * delay);
			newTimers.push(tCleanup);
			const tEnd = setTimeout(
				() => {
					setVizAnimating(false);
					onDone?.();
				},
				frames.length * delay + 100,
			);
			newTimers.push(tEnd);
			timersRef.current = newTimers;
		},
		[resetViz, applyFrame],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof V2_SERIALIZER_OPTIONS> = {
				2: V2_SERIALIZER_OPTIONS,
				3: DEPRECATION_OPTIONS,
				4: SUNSET_OPTIONS,
				5: FREEZE_V1_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else {
				stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
			}
		},
		[stepper],
	);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAMES[scenarioId];
			if (frames) {
				setV1State(DEFAULT_V1);
				setV2State(DEFAULT_V2);
				setAppState(DEFAULT_APP_REWARD);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 2);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── Header handlers ──
	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward') {
			return { valid: false, message: 'Complete all phases first.' };
		}
		if (stressTest.results.length < 3) {
			return {
				valid: false,
				message: 'Fire at least 3 stress test scenarios.',
			};
		}
		return { valid: true, message: 'API versioning is working!' };
	}, [phase, stressTest.results.length]);

	const handleComplete = useCallback(() => {
		onComplete?.({ stars: stepper.starRating });
	}, [onComplete, stepper.starRating]);

	const handleReset = useCallback(() => {
		setPhase('observe');
		setVizAnimating(false);
		resetViz();
		stressTest.reset();
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];
	}, [resetViz, stressTest]);

	// ── Flow nodes & edges ──
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'v1-partner',
				type: 'partner',
				position: { x: 0, y: 0 },
				data: { ...v1State, version: 'v1' } satisfies PartnerNodeData,
			},
			{
				id: 'v2-partner',
				type: 'partner',
				position: { x: 0, y: 130 },
				data: { ...v2State, version: 'v2' } satisfies PartnerNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 320, y: 30 },
				data: { ...appState } satisfies AppNodeData,
			},
		],
		[v1State, v2State, appState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-v1-app',
				source: 'v1-partner',
				target: 'app',
				type: 'version',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge1State } satisfies VersionEdgeData,
			},
			{
				id: 'e-v2-app',
				source: 'v2-partner',
				target: 'app',
				type: 'version',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies VersionEdgeData,
			},
		],
		[edge1State, edge2State],
	);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx <= 1) {
			const termData = TERMINAL_STEP_MAP[idx];
			return {
				type: 'terminal' as const,
				commands: termData?.commands
					? shuffleOptions(termData.commands, idx)
					: undefined,
				outputLines: termData?.outputLines,
			};
		}
		const stepOptions: Record<number, typeof V2_SERIALIZER_OPTIONS> = {
			2: V2_SERIALIZER_OPTIONS,
			3: DEPRECATION_OPTIONS,
			4: SUNSET_OPTIONS,
			5: FREEZE_V1_OPTIONS,
		};
		return {
			type: 'option' as const,
			options: shuffleOptions(stepOptions[idx], idx),
		};
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render: Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground mb-2">
							Since Level 5, your API has lived under /api/v1. 200 partners
							integrated with this format. Product now needs to change the order
							total from integer cents (1999) to a structured money object.
						</p>
						<p className="text-sm text-muted-foreground">
							But there is only one controller serving all clients. Changing the
							response shape breaks every partner at once. How do you evolve the
							API without breaking existing integrations?
						</p>
					</div>
					<DiscoveryChecklist
						discoveredCount={discoveryGating.discoveredCount}
						discoveries={discoveryGating.discoveries}
						minRequired={discoveryGating.minRequired}
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
							Add v2 namespace with separate controllers and serializers.
							Deprecate v1 with Sunset headers so partners have a migration
							path.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						steps={stepper.steps}
					/>
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
								Correct format served
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">
								Deprecated (with headers)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Blocked (unknown version)
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
						<div className="text-xs text-muted-foreground">Rejected</div>
					</div>
				</div>
			</div>
		);
	};

	// ── Render: Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={versionEdgeTypes}
							nodes={flowNodes}
							nodeTypes={versionNodeTypes}
						/>
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build') {
			if (
				currentStepConfig.type === 'terminal' &&
				currentStepConfig.commands &&
				currentStepConfig.outputLines
			) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Add v1 and v2 namespaces to routes so each version gets its own controller namespace.'}
									{stepper.currentStep === 1 &&
										'Generate the v2 orders controller under the Api::V2 namespace.'}
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
							title={STEP_DEFS[stepper.currentStep].title}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option' && currentStepConfig.options) {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].title}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'How should the v2 serializer return the order total?'}
								{stepper.currentStep === 3 &&
									'How should v1 signal that it is being replaced?'}
								{stepper.currentStep === 4 && 'When should v1 be retired?'}
								{stepper.currentStep === 5 &&
									'How should the v1 controller render its response?'}
							</p>
						</div>
						{stepper.lastFeedback && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									disabled={stepper.isCurrentStepCompleted}
									key={opt.id}
									mono
									name={opt.label}
									onClick={() => handleOptionSelect(opt.id)}
									selected={stepper.isCurrentStepCompleted && opt.correct}
								/>
							))}
						</div>
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button className="gap-2" onClick={stepper.nextStep} size="sm">
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep === STEP_DEFS.length - 1 && (
								<Button
									className="gap-2"
									onClick={() => {
										stressTest.reset();
										setPhase('reward');
									}}
									size="sm"
								>
									Next Step <ArrowRight className="w-4 h-4" />
								</Button>
							)}
					</div>
				);
			}
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={versionEdgeTypes}
						nodes={flowNodes}
						nodeTypes={versionNodeTypes}
					/>
				</div>
				<div className="flex-1 min-h-0 flex flex-col px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						className="flex-1 flex flex-col"
						disabled={vizAnimating}
						isAutoFiring={stressTest.isAutoFiring}
						onFire={handleFireScenario}
						onToggleAutoFire={stressTest.toggleAutoFire}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>
			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="API Versioning"
					levelNumber={40}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? buildCodePreviewStep : 0,
					)}
					learningGoal="URL path versioning with namespaced controllers lets v1 and v2 coexist. Deprecation and Sunset headers guide client migration."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level40APIVersioning;

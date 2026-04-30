/**
 * Level 56: The Architect (Capstone)
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom visualization showing Order monolith coupled
 *   to 5 services (Stripe, Email, Inventory, Analytics, Loyalty). All calls
 *   synchronous. Probes reveal sync blocking, missing state guards, deploy
 *   entanglement, and cascade failures.
 *
 * Phase 2 (HOW - build): 7 steps (1 terminal + 6 OptionCard)
 *   Step 0: bin/packwerk init (Terminal)
 *   Step 1: AASM state machine on Payment (OptionCard)
 *   Step 2: Domain events with Wisper (OptionCard)
 *   Step 3: Billing service with own DB via connects_to (OptionCard)
 *   Step 4: API gateway proxy controller (OptionCard)
 *   Step 5: Observability with OpenTelemetry + Lograge (OptionCard)
 *   Step 6: Gradual rollout with Flipper feature flags (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Topology transforms to
 *   Client -> API Gateway -> Billing Service (AASM, own DB) -> Event Bus ->
 *   4 subscriber services (Email, Inventory, Analytics, Loyalty).
 *   8 stress scenarios test the extracted architecture.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import {
	ArrowRight,
	Database,
	Eye,
	Flag,
	Globe,
	Radio,
	ShieldCheck,
} from 'lucide-react';
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
	type TerminalCommand,
	type TerminalOutputLine,
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
import { FlowNode, type FlowNodeData } from '@/components/levels/FlowNode';
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
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act7-level58-architect', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface OrderVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
}

interface ServiceVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
}

interface GatewayVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
}

interface BillingVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	hasStateMachine: boolean;
}

interface EventBusVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
}

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	order?: Partial<OrderVizState>;
	stripe?: Partial<ServiceVizState>;
	email?: Partial<ServiceVizState>;
	inventory?: Partial<ServiceVizState>;
	analytics?: Partial<ServiceVizState>;
	loyalty?: Partial<ServiceVizState>;
	gateway?: Partial<GatewayVizState>;
	billing?: Partial<BillingVizState>;
	eventBus?: Partial<EventBusVizState>;
	edgeStripe?: Partial<EdgeVizState>;
	edgeEmail?: Partial<EdgeVizState>;
	edgeInventory?: Partial<EdgeVizState>;
	edgeAnalytics?: Partial<EdgeVizState>;
	edgeLoyalty?: Partial<EdgeVizState>;
	edgeGwBilling?: Partial<EdgeVizState>;
	edgeBillingBus?: Partial<EdgeVizState>;
	edgeBusEmail?: Partial<EdgeVizState>;
	edgeBusInventory?: Partial<EdgeVizState>;
	edgeBusAnalytics?: Partial<EdgeVizState>;
	edgeBusLoyalty?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_ORDER: OrderVizState = {
	label: 'Order#charge!',
	flash: 'red',
	sublabel: 'Synchronous calls',
	badge: '4.5s total',
};

const DEFAULT_SERVICE: ServiceVizState = {
	label: '',
	flash: 'idle',
	sublabel: null,
	badge: null,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

// Reward defaults
const DEFAULT_GATEWAY_REWARD: GatewayVizState = {
	label: 'API Gateway',
	flash: 'green',
	sublabel: 'Auth at edge',
	badge: null,
};

const DEFAULT_BILLING_REWARD: BillingVizState = {
	label: 'Billing Service',
	flash: 'green',
	sublabel: 'AASM + own DB',
	badge: null,
	hasStateMachine: true,
};

const DEFAULT_EVENT_BUS_REWARD: EventBusVizState = {
	label: 'Event Bus',
	flash: 'idle',
	sublabel: 'Wisper broadcast',
};

const DEFAULT_SUB_EMAIL: ServiceVizState = {
	label: 'EmailSubscriber',
	flash: 'idle',
	sublabel: 'Async listener',
	badge: null,
};

const DEFAULT_SUB_INVENTORY: ServiceVizState = {
	label: 'InventorySubscriber',
	flash: 'idle',
	sublabel: 'Async listener',
	badge: null,
};

const DEFAULT_SUB_ANALYTICS: ServiceVizState = {
	label: 'AnalyticsSubscriber',
	flash: 'idle',
	sublabel: 'Async listener',
	badge: null,
};

const DEFAULT_SUB_LOYALTY: ServiceVizState = {
	label: 'LoyaltySubscriber',
	flash: 'idle',
	sublabel: 'Async listener',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'sync-coupling', label: 'All calls are synchronous and blocking' },
	{ id: 'no-state-machine', label: 'No state machine guards transitions' },
	{ id: 'deploy-entangled', label: 'Changes require full monolith deploy' },
	{ id: 'cascade-failure', label: 'Service failure cascades to payment' },
];

// ─── Probe definitions ───────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'sync-blocking',
		label: 'Time a full payment flow',
		command: 'curl -w "%{time_total}s" -X POST /api/v1/orders/42/charge',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (4.5s)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Stripe charge: 1.2s, Email receipt: 0.8s, Inventory update: 1.0s',
				color: 'red',
			},
			{ text: 'Analytics track: 0.7s, Loyalty credit: 0.8s', color: 'red' },
			{
				text: 'All 5 service calls run synchronously in sequence.',
				color: 'yellow',
			},
		],
		story: [
			'Customer clicks "Pay Now" on their order.',
			'Order#charge! calls Stripe, waits 1.2s for the charge.',
			'Then sends an email receipt, waits 0.8s.',
			'Then updates inventory, waits 1.0s.',
			'Then tracks analytics (0.7s) and credits loyalty (0.8s).',
			'Total: 4.5 seconds of synchronous blocking.',
		],
	},
	{
		id: 'no-state-guard',
		label: 'Replay a completed payment',
		command:
			'rails runner "Order.find(42).update!(status: :pending); Order.find(42).charge!"',
		responseLines: [
			{ text: 'Order #42 status changed: completed -> pending', color: 'red' },
			{ text: 'Stripe charge processed AGAIN for $149.99', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No state machine. Status can be set to anything.',
				color: 'yellow',
			},
			{ text: 'Customer double-charged. Refund required.', color: 'red' },
		],
		story: [
			'A bug sets an already-completed order back to pending.',
			'Without a state machine, the status column is a plain string.',
			'Any code can write any value: completed -> pending.',
			'Order#charge! runs again on the "pending" order.',
			'The customer is charged twice. A refund ticket is created.',
		],
	},
	{
		id: 'deploy-coupling',
		label: 'Deploy a billing hotfix',
		command: 'git log --oneline billing-hotfix..HEAD | wc -l',
		responseLines: [
			{ text: '47 commits since billing-hotfix branch', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Billing code lives in the monolith. A one-line fix requires deploying all 47 commits.',
				color: 'red',
			},
			{
				text: 'Full deploy pipeline: 45 min CI + 30 min staging + 45 min canary.',
				color: 'red',
			},
			{ text: 'Total: ~2 hours for a billing bugfix.', color: 'yellow' },
		],
		story: [
			'A billing rounding error is found in production.',
			'The fix is a one-line change to a currency helper.',
			'But billing code lives in the main Rails monolith.',
			'Deploying means shipping 47 unrelated commits too.',
			'CI, staging, canary: 2 hours for a one-line fix.',
		],
	},
	{
		id: 'email-blocks-payment',
		label: 'Simulate email service outage',
		command:
			'curl -X POST /api/v1/orders/43/charge # email service returning 503',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Stripe charge succeeded ($89.99 captured).',
				color: 'green',
			},
			{
				text: 'EmailService#send_receipt raised Net::ReadTimeout after 30s.',
				color: 'red',
			},
			{
				text: 'Entire transaction rolled back. Customer charged but order not saved.',
				color: 'red',
			},
		],
		story: [
			'Customer places an order during an email service outage.',
			'Stripe charge succeeds: $89.99 captured from their card.',
			'Order#charge! then calls EmailService#send_receipt.',
			'The email service is down. The call times out after 30 seconds.',
			'The exception rolls back the transaction. Money taken, no order.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'sync-blocking': ['sync-coupling'],
	'no-state-guard': ['no-state-machine'],
	'deploy-coupling': ['deploy-entangled'],
	'email-blocks-payment': ['cascade-failure'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 6 nodes (Order, Stripe, Email, Inventory, Analytics, Loyalty)
// Edges: edgeStripe, edgeEmail, edgeInventory, edgeAnalytics, edgeLoyalty
// Frame playthrough:
//   sync-blocking: Order calls each service in sequence, showing cumulative time
//   no-state-guard: Order status forced back to pending, double charge
//   deploy-coupling: Monolith shows all services waiting for deploy
//   email-blocks-payment: Stripe succeeds, email fails, transaction rolls back

const SYNC_FRAMES: AnimFrame[] = [
	{
		order: {
			label: 'Order#charge!',
			flash: 'amber',
			sublabel: 'Calling Stripe...',
			badge: '0s',
		},
		stripe: { flash: 'amber', sublabel: 'Processing...', badge: '1.2s' },
		edgeStripe: {
			active: true,
			reverse: false,
			label: 'Stripe.charge!',
			dotColor: '#ef4444',
		},
	},
	{
		order: {
			label: 'Order#charge!',
			flash: 'amber',
			sublabel: 'Calling Email...',
			badge: '1.2s',
		},
		stripe: { flash: 'green', sublabel: 'Done', badge: '1.2s' },
		edgeStripe: { active: false, label: '' },
		email: { flash: 'amber', sublabel: 'Sending...', badge: '0.8s' },
		edgeEmail: {
			active: true,
			reverse: false,
			label: 'send_receipt',
			dotColor: '#ef4444',
		},
	},
	{
		order: {
			label: 'Order#charge!',
			flash: 'amber',
			sublabel: 'Calling Inventory...',
			badge: '2.0s',
		},
		email: { flash: 'green', sublabel: 'Done', badge: '0.8s' },
		edgeEmail: { active: false, label: '' },
		inventory: { flash: 'amber', sublabel: 'Updating...', badge: '1.0s' },
		edgeInventory: {
			active: true,
			reverse: false,
			label: 'decrement_stock',
			dotColor: '#ef4444',
		},
	},
	{
		order: {
			label: 'Order#charge!',
			flash: 'red',
			sublabel: '4.5s total!',
			badge: '4.5s',
		},
		inventory: { flash: 'green', sublabel: 'Done', badge: '1.0s' },
		edgeInventory: { active: false, label: '' },
		analytics: { flash: 'amber', sublabel: 'Tracking...', badge: '0.7s' },
		loyalty: { flash: 'amber', sublabel: 'Crediting...', badge: '0.8s' },
		edgeAnalytics: {
			active: true,
			reverse: false,
			label: 'track_purchase',
			dotColor: '#ef4444',
		},
		edgeLoyalty: {
			active: true,
			reverse: false,
			label: 'credit_points',
			dotColor: '#ef4444',
		},
	},
];

const STATE_GUARD_FRAMES: AnimFrame[] = [
	{
		order: {
			label: 'Order#42',
			flash: 'green',
			sublabel: 'status: completed',
			badge: 'PAID',
		},
	},
	{
		order: {
			label: 'Order#42',
			flash: 'red',
			sublabel: 'status: pending (forced!)',
			badge: 'NO GUARD',
		},
	},
	{
		order: {
			label: 'Order#42.charge!',
			flash: 'red',
			sublabel: 'DOUBLE CHARGE!',
			badge: '$149.99 AGAIN',
		},
		stripe: {
			flash: 'red',
			sublabel: 'Charged again!',
			badge: '$149.99',
		},
		edgeStripe: {
			active: true,
			reverse: false,
			label: 'duplicate charge!',
			dotColor: '#ef4444',
		},
	},
];

const DEPLOY_FRAMES: AnimFrame[] = [
	{
		order: {
			label: 'Monolith',
			flash: 'amber',
			sublabel: '47 commits queued',
			badge: 'CI running',
		},
	},
	{
		order: {
			label: 'Monolith',
			flash: 'amber',
			sublabel: 'Full deploy pipeline',
			badge: '~2 hours',
		},
		stripe: { flash: 'amber', sublabel: 'Waiting...' },
		email: { flash: 'amber', sublabel: 'Waiting...' },
		inventory: { flash: 'amber', sublabel: 'Waiting...' },
		analytics: { flash: 'amber', sublabel: 'Waiting...' },
		loyalty: { flash: 'amber', sublabel: 'Waiting...' },
	},
	{
		order: {
			label: 'Monolith',
			flash: 'red',
			sublabel: '1-line fix, 2-hour deploy',
			badge: 'COUPLED',
		},
	},
];

const CASCADE_FRAMES: AnimFrame[] = [
	{
		order: {
			label: 'Order#charge!',
			flash: 'amber',
			sublabel: 'Charging...',
			badge: null,
		},
		stripe: { flash: 'green', sublabel: 'Charged $89.99', badge: 'OK' },
		edgeStripe: {
			active: true,
			reverse: true,
			label: 'charge OK',
			dotColor: '#22c55e',
		},
	},
	{
		order: {
			label: 'Order#charge!',
			flash: 'amber',
			sublabel: 'Sending receipt...',
			badge: null,
		},
		edgeStripe: { active: false, label: '' },
		email: { flash: 'red', sublabel: '503 Service Down!', badge: 'TIMEOUT' },
		edgeEmail: {
			active: true,
			reverse: false,
			label: 'send_receipt -> TIMEOUT',
			dotColor: '#ef4444',
		},
	},
	{
		order: {
			label: 'ROLLBACK!',
			flash: 'red',
			sublabel: 'Money taken, no order!',
			badge: '500 ERROR',
		},
		stripe: {
			flash: 'red',
			sublabel: '$89.99 captured',
			badge: 'NOT REFUNDED',
		},
		email: { flash: 'red', sublabel: 'Service down', badge: '503' },
		edgeEmail: { active: false, label: '' },
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'sync-blocking': SYNC_FRAMES,
	'no-state-guard': STATE_GUARD_FRAMES,
	'deploy-coupling': DEPLOY_FRAMES,
	'email-blocks-payment': CASCADE_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward topology: Gateway -> Billing -> EventBus -> 4 subscribers
// Frame playthrough per scenario:
//   normal-payment: Gateway auth -> Billing AASM -> EventBus broadcast -> all 4 subscribers
//   payment-failed: Gateway -> Billing fails -> EventBus broadcasts failure -> email notifies
//   email-down: Gateway -> Billing succeeds -> EventBus -> email fails independently
//   gateway-auth: Gateway verifies JWT -> forwards to billing
//   direct-billing-access: Gateway blocks direct access
//   invalid-transition: AASM blocks completed->pending
//   tenant-isolation: acts_as_tenant blocks cross-tenant
//   gradual-rollout: Flipper routes 5% to new service

const REWARD_NORMAL_FRAMES: AnimFrame[] = [
	{
		gateway: {
			label: 'API Gateway',
			flash: 'green',
			sublabel: 'Auth verified',
			badge: null,
		},
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'POST /billing/charge',
			dotColor: '#22c55e',
		},
	},
	{
		billing: {
			label: 'Billing Service',
			flash: 'green',
			sublabel: 'pending -> processing -> completed',
			badge: 'AASM',
			hasStateMachine: true,
		},
		edgeGwBilling: { active: false, label: '' },
		edgeBillingBus: {
			active: true,
			reverse: false,
			label: 'payment.completed',
			dotColor: '#22c55e',
		},
	},
	{
		eventBus: { flash: 'green', sublabel: 'Broadcasting...' },
		edgeBillingBus: { active: false, label: '' },
		email: { flash: 'green', sublabel: 'Receipt sent', badge: null },
		inventory: { flash: 'green', sublabel: 'Stock updated', badge: null },
		analytics: { flash: 'green', sublabel: 'Tracked', badge: null },
		loyalty: { flash: 'green', sublabel: 'Points credited', badge: null },
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
		edgeBusLoyalty: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_FAILED_FRAMES: AnimFrame[] = [
	{
		gateway: { flash: 'green', sublabel: 'Auth verified' },
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'POST /billing/charge',
			dotColor: '#f59e0b',
		},
	},
	{
		billing: {
			label: 'Billing Service',
			flash: 'amber',
			sublabel: 'pending -> processing -> failed',
			badge: 'AASM',
			hasStateMachine: true,
		},
		edgeGwBilling: { active: false, label: '' },
		edgeBillingBus: {
			active: true,
			reverse: false,
			label: 'payment.failed',
			dotColor: '#f59e0b',
		},
	},
	{
		eventBus: { flash: 'amber', sublabel: 'Broadcasting failure...' },
		edgeBillingBus: { active: false, label: '' },
		email: { flash: 'amber', sublabel: 'Failure notice sent', badge: null },
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#f59e0b',
		},
	},
];

const REWARD_EMAIL_DOWN_FRAMES: AnimFrame[] = [
	{
		gateway: { flash: 'green', sublabel: 'Auth verified' },
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'POST /billing/charge',
			dotColor: '#22c55e',
		},
	},
	{
		billing: {
			flash: 'green',
			sublabel: 'completed (decoupled!)',
			badge: 'AASM',
			hasStateMachine: true,
		},
		edgeGwBilling: { active: false, label: '' },
		edgeBillingBus: {
			active: true,
			reverse: false,
			label: 'payment.completed',
			dotColor: '#22c55e',
		},
	},
	{
		eventBus: { flash: 'amber', sublabel: 'Broadcasting...' },
		edgeBillingBus: { active: false, label: '' },
		email: { flash: 'red', sublabel: '503 (retries later)', badge: 'DOWN' },
		inventory: { flash: 'green', sublabel: 'Stock updated', badge: null },
		analytics: { flash: 'green', sublabel: 'Tracked', badge: null },
		loyalty: { flash: 'green', sublabel: 'Points credited', badge: null },
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: 'retry queued',
			dotColor: '#ef4444',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
		edgeBusLoyalty: {
			active: true,
			reverse: false,
			label: 'async',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_GATEWAY_AUTH_FRAMES: AnimFrame[] = [
	{
		gateway: {
			flash: 'green',
			sublabel: 'JWT verified at edge',
			badge: 'AUTH OK',
		},
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'Authenticated request',
			dotColor: '#22c55e',
		},
	},
	{
		billing: { flash: 'green', sublabel: 'Processing...' },
		edgeGwBilling: { active: false, label: '' },
	},
];

const REWARD_DIRECT_ACCESS_FRAMES: AnimFrame[] = [
	{
		gateway: {
			flash: 'red',
			sublabel: 'Direct access attempt!',
			badge: 'BLOCKED',
		},
		billing: { flash: 'idle', sublabel: 'Never reached' },
	},
];

const REWARD_INVALID_TRANSITION_FRAMES: AnimFrame[] = [
	{
		billing: {
			flash: 'red',
			sublabel: 'completed -> pending',
			badge: 'AASM BLOCKED',
			hasStateMachine: true,
		},
		gateway: { flash: 'green', sublabel: 'Request forwarded' },
		edgeGwBilling: {
			active: true,
			reverse: true,
			label: '422 Invalid transition',
			dotColor: '#ef4444',
		},
	},
];

const REWARD_TENANT_ISOLATION_FRAMES: AnimFrame[] = [
	{
		gateway: { flash: 'green', sublabel: 'Auth OK (Tenant A)' },
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'GET /billing?tenant=B',
			dotColor: '#ef4444',
		},
	},
	{
		billing: {
			flash: 'red',
			sublabel: 'acts_as_tenant blocks cross-tenant access',
			badge: '403',
			hasStateMachine: true,
		},
		edgeGwBilling: {
			active: true,
			reverse: true,
			label: '403 Forbidden',
			dotColor: '#ef4444',
		},
	},
];

const REWARD_ROLLOUT_FRAMES: AnimFrame[] = [
	{
		gateway: {
			flash: 'green',
			sublabel: 'Flipper: billing_v2 = 5%',
			badge: 'FLAG ON',
		},
		edgeGwBilling: {
			active: true,
			reverse: false,
			label: 'Routed to new service',
			dotColor: '#22c55e',
		},
	},
	{
		billing: {
			flash: 'green',
			sublabel: 'New service handling 5%',
			badge: 'CANARY',
			hasStateMachine: true,
		},
		edgeGwBilling: { active: false, label: '' },
		edgeBillingBus: {
			active: true,
			reverse: false,
			label: 'payment.completed',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'normal-payment': REWARD_NORMAL_FRAMES,
	'payment-failed': REWARD_FAILED_FRAMES,
	'email-down': REWARD_EMAIL_DOWN_FRAMES,
	'gateway-auth': REWARD_GATEWAY_AUTH_FRAMES,
	'direct-billing-access': REWARD_DIRECT_ACCESS_FRAMES,
	'invalid-transition': REWARD_INVALID_TRANSITION_FRAMES,
	'tenant-isolation': REWARD_TENANT_ISOLATION_FRAMES,
	'gradual-rollout': REWARD_ROLLOUT_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	order: {
		stageId: 'order',
		title: 'Order Model (Monolith)',
		description:
			'The Order model calls 5 services synchronously in its charge! method. Stripe, email, inventory, analytics, and loyalty are all called in sequence. Total time: 4.5 seconds per charge.',
		code: `class Order < ApplicationRecord
  def charge!
    Stripe::Charge.create(amount: total)
    EmailService.send_receipt(self)
    InventoryService.decrement(line_items)
    AnalyticsService.track(:purchase, self)
    LoyaltyService.credit_points(user, total)
  end
end`,
	},
	stripe: {
		stageId: 'stripe',
		title: 'Stripe Service',
		description:
			'Payment processing via Stripe API. Takes 1.2 seconds on average. Called synchronously from Order#charge!, blocking the thread until Stripe responds.',
	},
	email: {
		stageId: 'email',
		title: 'Email Service',
		description:
			'Sends receipt emails. Takes 0.8 seconds per call. If the email service is down, the entire charge! transaction fails and rolls back, even though the Stripe charge already succeeded.',
	},
	inventory: {
		stageId: 'inventory',
		title: 'Inventory Service',
		description:
			'Decrements stock counts for purchased items. Takes 1.0 second. Called after email, so it waits for both Stripe and email to complete before it can start.',
	},
	analytics: {
		stageId: 'analytics',
		title: 'Analytics Service',
		description:
			'Tracks purchase events for reporting. Takes 0.7 seconds. Not critical for the order, but still blocks the response because it runs synchronously.',
	},
	loyalty: {
		stageId: 'loyalty',
		title: 'Loyalty Service',
		description:
			'Credits loyalty points to the customer. Takes 0.8 seconds. The last service in the chain. If this fails, the entire 4.5-second transaction rolls back.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	order: 'sync-coupling',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'normal-payment',
		label: 'Process a normal payment',
		description: 'Full flow through extracted billing service',
		method: 'POST',
		path: '/api/v1/billing/charge',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'payment-failed',
		label: 'Handle payment failure',
		description: 'State machine guards transition, event published',
		method: 'POST',
		path: '/api/v1/billing/charge (card declined)',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'email-down',
		label: 'Payment with email service down',
		description: 'Email subscriber fails independently, payment succeeds',
		method: 'POST',
		path: '/api/v1/billing/charge (email 503)',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'gateway-auth',
		label: 'Authenticated request via gateway',
		description: 'Unified auth at edge before billing',
		method: 'POST',
		path: '/api/v1/billing/charge (JWT)',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'direct-billing-access',
		label: 'Bypass gateway to billing service',
		description: 'Direct access without gateway auth blocked',
		method: 'POST',
		path: 'billing-service:3001/charge (direct)',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'invalid-transition',
		label: 'Force completed -> pending transition',
		description: 'AASM blocks invalid state transition',
		method: 'PATCH',
		path: '/api/v1/billing/payments/42 (status: pending)',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'tenant-isolation',
		label: 'Access another tenant billing data',
		description: 'acts_as_tenant blocks cross-tenant read',
		method: 'GET',
		path: '/api/v1/billing/payments?tenant=other',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'gradual-rollout',
		label: 'Gradual rollout (5% canary)',
		description: 'Flipper routes 5% of traffic to new service',
		method: 'POST',
		path: '/api/v1/billing/charge (flagged)',
		actor: 'customer',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'packwerk-init', title: 'Initialize Bounded Contexts' },
	{ id: 'aasm-state-machine', title: 'Add AASM State Machine' },
	{ id: 'domain-events', title: 'Replace Sync with Domain Events' },
	{ id: 'billing-database', title: 'Create Billing Database' },
	{ id: 'api-gateway', title: 'Route Through API Gateway' },
	{ id: 'observability', title: 'Add Observability' },
	{ id: 'feature-flags', title: 'Set Up Gradual Rollout' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: packwerk init
	'option', // 1: AASM
	'option', // 2: Wisper events
	'option', // 3: connects_to
	'option', // 4: gateway
	'option', // 5: observability
	'option', // 6: Flipper
];

// ─── Step 0: packwerk init (Terminal) ─────────────────────────────────

const packwerkCommands: TerminalCommand[] = [
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold BillingService',
		command: 'rails generate scaffold BillingService',
		correct: false,
		feedback:
			'Scaffolding creates CRUD resources, not bounded contexts. You need a tool that enforces package boundaries within the monolith.',
	},
	{
		id: 'wrong-engine',
		label: 'rails plugin new billing --mountable',
		command: 'rails plugin new billing --mountable',
		correct: false,
		feedback:
			'A mountable engine is heavier than needed for internal boundaries. Start with package-level enforcement before extracting to a separate engine.',
	},
	{
		id: 'correct',
		label: 'bin/packwerk init',
		command: 'bin/packwerk init',
		correct: true,
	},
];

const packwerkOutput: TerminalOutputLine[] = [
	{
		text: 'Created packwerk.yml with default configuration',
		color: 'green',
	},
	{ text: 'Created packs/billing/package.yml', color: 'green' },
	{ text: 'Bounded context "billing" initialized.', color: 'cyan' },
];

// ─── Step 1: AASM state machine (OptionCard) ─────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const AASM_OPTIONS: StepOption[] = [
	{
		id: 'enum-only',
		name: 'enum :status, { pending: 0, completed: 1, failed: 2 }',
		correct: false,
		feedback:
			'An enum defines valid values but does not enforce transition rules. Any code can set status to any value. You need a state machine that guards which transitions are allowed.',
	},
	{
		id: 'correct',
		name: `include AASM

aasm column: :status do
  state :pending, initial: true
  state :processing, :completed, :failed

  event :process do
    transitions from: :pending, to: :processing
  end
  event :complete do
    transitions from: :processing, to: :completed
  end
  event :fail do
    transitions from: :processing, to: :failed
  end
end`,
		correct: true,
	},
	{
		id: 'before-save',
		name: `before_save :validate_transition

def validate_transition
  raise "Invalid" unless valid_transition?
end`,
		correct: false,
		feedback:
			'Hand-rolled validation misses edge cases and does not provide a declarative DSL. A state machine gem gives you events, guards, callbacks, and automatic validation out of the box.',
	},
];

// ─── Step 2: Domain events with Wisper (OptionCard) ──────────────────

const WISPER_OPTIONS: StepOption[] = [
	{
		id: 'after-commit',
		name: `after_commit :send_receipt
after_commit :update_inventory
after_commit :track_analytics
after_commit :credit_loyalty`,
		correct: false,
		feedback:
			'after_commit callbacks still couple the model to every subscriber. Adding a new side effect means editing the Payment model. You need a publish/subscribe pattern where the model broadcasts and subscribers register independently.',
	},
	{
		id: 'wrong-activesupport',
		name: `ActiveSupport::Notifications.instrument(
  "payment.completed", payment: self
)`,
		correct: false,
		feedback:
			'ActiveSupport::Notifications is for instrumentation and monitoring, not domain events. It lacks subscriber lifecycle management and is not designed for business logic.',
	},
	{
		id: 'correct',
		name: `include Wisper::Publisher

event :complete do
  transitions from: :processing,
              to: :completed,
              after: -> { broadcast(:payment_completed, self) }
end`,
		correct: true,
	},
];

// ─── Step 3: Billing database (OptionCard) ───────────────────────────

const BILLING_DB_OPTIONS: StepOption[] = [
	{
		id: 'establish',
		name: `establish_connection(
  adapter: "postgresql",
  database: "billing_production"
)`,
		correct: false,
		feedback:
			'establish_connection is for one-off manual connections. For a permanent database mapping with role-based routing, Rails provides a declarative method in ApplicationRecord.',
	},
	{
		id: 'correct',
		name: `class BillingRecord < ApplicationRecord
  self.abstract_class = true

  connects_to database: {
    writing: :billing,
    reading: :billing_replica
  }
end`,
		correct: true,
	},
	{
		id: 'separate-app',
		name: `# billing-service/config/database.yml
production:
  adapter: postgresql
  database: billing_production`,
		correct: false,
		feedback:
			'A completely separate Rails app is the end state, not the first step. Start by isolating the database connection within the monolith, then extract later.',
	},
];

// ─── Step 4: API Gateway (OptionCard) ────────────────────────────────

const GATEWAY_OPTIONS: StepOption[] = [
	{
		id: 'wrong-direct',
		name: `# config/routes.rb
namespace :billing do
  resources :payments
  resources :charges
end`,
		correct: false,
		feedback:
			'Direct routes expose billing endpoints without a unified auth layer. You need a single entry point that handles authentication, rate limiting, and request forwarding.',
	},
	{
		id: 'correct',
		name: `class BillingGatewayController < ApplicationController
  before_action :authenticate_api_client!
  before_action :rate_limit!

  def proxy
    response = BillingClient.forward(
      method: request.method,
      path: billing_path,
      headers: authorized_headers
    )
    render json: response.body,
           status: response.status
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-rack',
		name: `# config/application.rb
config.middleware.use BillingProxy`,
		correct: false,
		feedback:
			'Rack middleware runs on every request, not just billing requests. A controller-based approach gives you Rails routing, authentication, and action callbacks for billing-specific traffic only.',
	},
];

// ─── Step 5: Observability (OptionCard) ──────────────────────────────

const OBSERVABILITY_OPTIONS: StepOption[] = [
	{
		id: 'wrong-puts',
		name: `def charge!
  puts "Starting charge for order #{id}"
  # ... charge logic
  puts "Charge completed in #{elapsed}ms"
end`,
		correct: false,
		feedback:
			'puts output is unstructured, has no trace correlation, and disappears in production log aggregation. You need structured logging with distributed tracing.',
	},
	{
		id: 'correct',
		name: `# Gemfile
gem "opentelemetry-sdk"
gem "opentelemetry-instrumentation-rails"
gem "lograge"

# config/initializers/opentelemetry.rb
OpenTelemetry::SDK.configure do |c|
  c.use "OpenTelemetry::Instrumentation::Rails"
end

# config/environments/production.rb
config.lograge.enabled = true
config.lograge.custom_payload do |controller|
  { trace_id: OpenTelemetry::Trace.current_span
      .context.hex_trace_id }
end`,
		correct: true,
	},
	{
		id: 'wrong-custom',
		name: `class BillingLogger
  def self.log(event, data)
    File.write("log/billing.log",
      "#{Time.now}: #{event} #{data}\\n",
      mode: "a")
  end
end`,
		correct: false,
		feedback:
			'Custom file logging has no trace correlation, no structured format, and does not integrate with log aggregation services. You need industry-standard observability tooling.',
	},
];

// ─── Step 6: Feature flags (OptionCard) ──────────────────────────────

const FLIPPER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-env',
		name: `if ENV["USE_NEW_BILLING"] == "true"
  BillingService.charge(order)
else
  order.charge!
end`,
		correct: false,
		feedback:
			'Environment variables require a deploy to change and apply to 100% of traffic immediately. You need percentage-based rollout that can be toggled without deploying.',
	},
	{
		id: 'wrong-random',
		name: `if rand(100) < 5
  BillingService.charge(order)
else
  order.charge!
end`,
		correct: false,
		feedback:
			'rand() is not deterministic per user and cannot be monitored or toggled. A feature flag library gives you consistent bucketing, a dashboard, and instant rollback.',
	},
	{
		id: 'correct',
		name: `# Gemfile
gem "flipper"
gem "flipper-active_record"

# config/initializers/flipper.rb
Flipper.register(:billing_beta) do |actor|
  actor.respond_to?(:beta_tester?) &&
    actor.beta_tester?
end

# Gateway controller
if Flipper.enabled?(:billing_v2, current_user)
  BillingClient.forward(request)
else
  legacy_charge(order)
end`,
		correct: true,
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Add State Machine to Payment',
		description:
			'The payment status is a plain string column that any code can overwrite. You need to enforce a strict lifecycle: pending -> processing -> completed or failed. Which approach prevents invalid transitions?',
		options: AASM_OPTIONS,
	},
	2: {
		title: 'Replace Synchronous Side Effects',
		description:
			'Order#charge! calls 5 services synchronously. If any fails, everything rolls back. Replace direct calls with a publish/subscribe pattern where the payment model broadcasts events and subscribers react independently.',
		options: WISPER_OPTIONS,
	},
	3: {
		title: 'Create Billing Database',
		description:
			'Billing data needs its own database so the billing service can scale independently. Rails supports multiple databases natively. Which approach isolates billing data within the monolith?',
		options: BILLING_DB_OPTIONS,
	},
	4: {
		title: 'Route Through API Gateway',
		description:
			'External clients should not access the billing service directly. All billing traffic needs to pass through a single entry point that handles authentication, rate limiting, and request forwarding.',
		options: GATEWAY_OPTIONS,
	},
	5: {
		title: 'Add Observability',
		description:
			'The extracted billing service needs structured logging with distributed tracing so you can follow a payment request across services. Which setup provides production-grade observability?',
		options: OBSERVABILITY_OPTIONS,
	},
	6: {
		title: 'Set Up Gradual Rollout',
		description:
			'You cannot switch 100% of traffic to the new billing service at once. You need percentage-based rollout that can be toggled without deploying. Which approach enables safe, gradual migration?',
		options: FLIPPER_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: packwerkCommands, outputLines: packwerkOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
	null, // step 6: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/models/order.rb',
				language: 'ruby',
				code: `class Order < ApplicationRecord
  belongs_to :user
  belongs_to :company

  def charge!
    Stripe::Charge.create(amount: total)
    EmailService.send_receipt(self)
    InventoryService.decrement(line_items)
    AnalyticsService.track(:purchase, self)
    LoyaltyService.credit_points(user, total)
  end
end`,
				highlight: [6, 7, 8, 9, 10],
			},
		];
	}

	const files = [];

	// Step 0 complete: packwerk initialized
	if (completedStep >= 0) {
		files.push({
			filename: 'packs/billing/package.yml',
			language: 'yaml',
			code: `# packs/billing/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - packs/core`,
			highlight: [2, 3],
		});
	}

	// Step 1 complete: AASM state machine
	// Step 2 adds Wisper::Publisher + broadcast
	// Step 3 switches to BillingRecord base class (defined in that step)
	if (completedStep >= 1) {
		const baseClass =
			completedStep >= 3 ? 'BillingRecord' : 'ApplicationRecord';
		const hasWisper = completedStep >= 2;
		files.push({
			filename: 'packs/billing/app/models/payment.rb',
			language: 'ruby',
			code: hasWisper
				? `class Payment < ${baseClass}
  include AASM
  include Wisper::Publisher
  acts_as_tenant :company

  aasm column: :status do
    state :pending, initial: true
    state :processing, :completed, :failed

    event :process do
      transitions from: :pending, to: :processing
    end
    event :complete do
      transitions from: :processing,
                  to: :completed,
                  after: -> { broadcast(:payment_completed, self) }
    end
    event :fail do
      transitions from: :processing, to: :failed
    end
  end
end

# Subscribers enqueue Solid Queue jobs (L22+)
Wisper.subscribe(ReceiptSubscriber.new)

class ReceiptSubscriber
  def payment_completed(payment)
    SendReceiptJob.perform_later(payment.id)
  end
end`
				: `class Payment < ApplicationRecord
  include AASM
  acts_as_tenant :company

  aasm column: :status do
    state :pending, initial: true
    state :processing, :completed, :failed

    event :process do
      transitions from: :pending, to: :processing
    end
    event :complete do
      transitions from: :processing, to: :completed
    end
    event :fail do
      transitions from: :processing, to: :failed
    end
  end
end`,
			highlight: hasWisper ? [2, 3, 14, 15, 16, 26, 30] : [2, 5, 6, 7],
		});
	}

	// Step 3 complete: BillingRecord with connects_to
	if (completedStep >= 3) {
		files.push({
			filename: 'packs/billing/app/models/billing_record.rb',
			language: 'ruby',
			code: `class BillingRecord < ApplicationRecord
  self.abstract_class = true

  connects_to database: {
    writing: :billing,
    reading: :billing_replica
  }
end`,
			highlight: [4, 5, 6],
		});
	}

	// Step 4 complete: API Gateway controller
	if (completedStep >= 4) {
		files.push({
			filename: 'app/controllers/billing_gateway_controller.rb',
			language: 'ruby',
			code:
				completedStep >= 6
					? `class BillingGatewayController < ApplicationController
  before_action :authenticate_api_client!
  before_action :rate_limit!

  def proxy
    if Flipper.enabled?(:billing_v2, current_user)
      response = BillingClient.forward(
        method: request.method,
        path: billing_path,
        headers: authorized_headers
      )
      render json: response.body, status: response.status
    else
      legacy_charge(params[:order_id])
    end
  end
end`
					: `class BillingGatewayController < ApplicationController
  before_action :authenticate_api_client!
  before_action :rate_limit!

  def proxy
    response = BillingClient.forward(
      method: request.method,
      path: billing_path,
      headers: authorized_headers
    )
    render json: response.body, status: response.status
  end
end`,
			highlight: completedStep >= 6 ? [2, 3, 6] : [2, 3],
		});
	}

	// Step 5 complete: Observability
	if (completedStep >= 5) {
		files.push({
			filename: 'config/initializers/opentelemetry.rb',
			language: 'ruby',
			code: `# config/initializers/opentelemetry.rb
require "opentelemetry/sdk"
require "opentelemetry/instrumentation/rails"

OpenTelemetry::SDK.configure do |c|
  c.use "OpenTelemetry::Instrumentation::Rails"
  c.service_name = "billing-service"
end

# config/environments/production.rb
config.lograge.enabled = true
config.lograge.custom_payload do |controller|
  { trace_id: OpenTelemetry::Trace.current_span
      .context.hex_trace_id }
end`,
			highlight: [5, 6, 7, 11, 12, 13, 14],
		});
	}

	// Step 6 complete: Flipper feature flags
	if (completedStep >= 6) {
		files.push({
			filename: 'config/initializers/flipper.rb',
			language: 'ruby',
			code: `# config/initializers/flipper.rb
Flipper.register(:billing_beta) do |actor|
  actor.respond_to?(:beta_tester?) &&
    actor.beta_tester?
end

# Enable for 5% of traffic
Flipper.enable_percentage_of_actors(
  :billing_v2, 5
)`,
			highlight: [2, 3, 4, 8, 9],
		});
	}

	// If nothing completed yet, show TODO
	if (files.length === 0) {
		files.push({
			filename: 'app/models/order.rb',
			language: 'ruby',
			code: `class Order < ApplicationRecord
  # TODO: extract billing into bounded context
  def charge!
    Stripe::Charge.create(amount: total)
    EmailService.send_receipt(self)
    InventoryService.decrement(line_items)
    AnalyticsService.track(:purchase, self)
    LoyaltyService.credit_points(user, total)
  end
end`,
			highlight: [2],
		});
	}

	return files;
}

// ─── Flash to FlowNode status mapping ────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	switch (flash) {
		case 'green':
			return 'active';
		case 'red':
			return 'error';
		case 'amber':
			return 'warning';
		default:
			return 'idle';
	}
}

const SERVICE_ICON_CODE: Record<string, string> = {
	Stripe: 'ST',
	EmailService: 'EM',
	InventoryService: 'IN',
	AnalyticsService: 'AN',
	LoyaltyService: 'LY',
	EmailSubscriber: 'EM',
	InventorySubscriber: 'IN',
	AnalyticsSubscriber: 'AN',
	LoyaltySubscriber: 'LY',
};

const SERVICE_COLOR: Record<string, string> = {
	Stripe: '#6366f1',
	EmailService: '#3b82f6',
	InventoryService: '#f59e0b',
	AnalyticsService: '#8b5cf6',
	LoyaltyService: '#ec4899',
	EmailSubscriber: '#3b82f6',
	InventorySubscriber: '#f59e0b',
	AnalyticsSubscriber: '#8b5cf6',
	LoyaltySubscriber: '#ec4899',
};

// ─── Custom React Flow nodes ──────────────────────────────────────────

const OrderNode = memo(function OrderNode({ data }: { data: OrderVizState }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'OR',
		color: '#f59e0b',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-mono">
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const ServiceNode = memo(function ServiceNode({
	data,
}: {
	data: ServiceVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: SERVICE_ICON_CODE[data.label] ?? 'SV',
		color: SERVICE_COLOR[data.label] ?? '#71717a',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-mono">
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const GatewayNode = memo(function GatewayNode({
	data,
}: {
	data: GatewayVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'GW',
		color: '#6366f1',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-mono">
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const BillingNode = memo(function BillingNode({
	data,
}: {
	data: BillingVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'BL',
		color: '#6366f1',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
					{data.badge}
				</div>
			)}
			{data.hasStateMachine && (
				<div className="mt-1 flex items-center justify-center gap-1 text-xs text-primary">
					<ShieldCheck className="w-3 h-3" />
					AASM
				</div>
			)}
		</FlowNode>
	);
});

const EventBusNode = memo(function EventBusNode({
	data,
}: {
	data: EventBusVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'EB',
		color: '#22c55e',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const ArchEdge = memo(function ArchEdge(props: EdgeProps) {
	const { id, sourceX, sourceY, targetX, targetY, data } = props;
	const d = (data ?? DEFAULT_EDGE) as EdgeVizState;

	const [edgePath, labelX, labelY] = getStraightPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
	});

	const dotPath = d.reverse ? reversePath(edgePath) : edgePath;
	const fill = d.dotColor || '#ef4444';

	const dots: DotConfig[] = d.active
		? Array.from({ length: 3 }, (_, i) => ({
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
					strokeDasharray: d.active ? undefined : '6 4',
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 20}px)`,
						}}
					>
						{d.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const observeNodeTypes = {
	order: OrderNode,
	service: ServiceNode,
};

const rewardNodeTypes = {
	gateway: GatewayNode,
	billing: BillingNode,
	eventBus: EventBusNode,
	service: ServiceNode,
};

const archEdgeTypes = { arch: ArchEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level58Architect({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [orderState, setOrderState] = useState<OrderVizState>(DEFAULT_ORDER);
	const [stripeState, setStripeState] = useState<ServiceVizState>({
		...DEFAULT_SERVICE,
		label: 'Stripe',
	});
	const [emailState, setEmailState] = useState<ServiceVizState>({
		...DEFAULT_SERVICE,
		label: 'EmailService',
	});
	const [inventoryState, setInventoryState] = useState<ServiceVizState>({
		...DEFAULT_SERVICE,
		label: 'InventoryService',
	});
	const [analyticsState, setAnalyticsState] = useState<ServiceVizState>({
		...DEFAULT_SERVICE,
		label: 'AnalyticsService',
	});
	const [loyaltyState, setLoyaltyState] = useState<ServiceVizState>({
		...DEFAULT_SERVICE,
		label: 'LoyaltyService',
	});
	const [gatewayState, setGatewayState] = useState<GatewayVizState>(
		DEFAULT_GATEWAY_REWARD,
	);
	const [billingState, setBillingState] = useState<BillingVizState>(
		DEFAULT_BILLING_REWARD,
	);
	const [eventBusState, setEventBusState] = useState<EventBusVizState>(
		DEFAULT_EVENT_BUS_REWARD,
	);

	// Observe edges
	const [edgeStripeState, setEdgeStripeState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeEmailState, setEdgeEmailState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeInventoryState, setEdgeInventoryState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeAnalyticsState, setEdgeAnalyticsState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeLoyaltyState, setEdgeLoyaltyState] =
		useState<EdgeVizState>(DEFAULT_EDGE);

	// Reward edges
	const [edgeGwBillingState, setEdgeGwBillingState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBillingBusState, setEdgeBillingBusState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusEmailState, setEdgeBusEmailState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusInventoryState, setEdgeBusInventoryState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusAnalyticsState, setEdgeBusAnalyticsState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusLoyaltyState, setEdgeBusLoyaltyState] =
		useState<EdgeVizState>(DEFAULT_EDGE);

	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		if (isReward) {
			setGatewayState(DEFAULT_GATEWAY_REWARD);
			setBillingState(DEFAULT_BILLING_REWARD);
			setEventBusState(DEFAULT_EVENT_BUS_REWARD);
			setEmailState(DEFAULT_SUB_EMAIL);
			setInventoryState(DEFAULT_SUB_INVENTORY);
			setAnalyticsState(DEFAULT_SUB_ANALYTICS);
			setLoyaltyState(DEFAULT_SUB_LOYALTY);
			setEdgeGwBillingState(DEFAULT_EDGE);
			setEdgeBillingBusState(DEFAULT_EDGE);
			setEdgeBusEmailState(DEFAULT_EDGE);
			setEdgeBusInventoryState(DEFAULT_EDGE);
			setEdgeBusAnalyticsState(DEFAULT_EDGE);
			setEdgeBusLoyaltyState(DEFAULT_EDGE);
		} else {
			setOrderState(DEFAULT_ORDER);
			setStripeState({ ...DEFAULT_SERVICE, label: 'Stripe' });
			setEmailState({ ...DEFAULT_SERVICE, label: 'EmailService' });
			setInventoryState({ ...DEFAULT_SERVICE, label: 'InventoryService' });
			setAnalyticsState({ ...DEFAULT_SERVICE, label: 'AnalyticsService' });
			setLoyaltyState({ ...DEFAULT_SERVICE, label: 'LoyaltyService' });
			setEdgeStripeState(DEFAULT_EDGE);
			setEdgeEmailState(DEFAULT_EDGE);
			setEdgeInventoryState(DEFAULT_EDGE);
			setEdgeAnalyticsState(DEFAULT_EDGE);
			setEdgeLoyaltyState(DEFAULT_EDGE);
		}
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.order) setOrderState((prev) => ({ ...prev, ...frame.order }));
		if (frame.stripe) setStripeState((prev) => ({ ...prev, ...frame.stripe }));
		if (frame.email) setEmailState((prev) => ({ ...prev, ...frame.email }));
		if (frame.inventory)
			setInventoryState((prev) => ({ ...prev, ...frame.inventory }));
		if (frame.analytics)
			setAnalyticsState((prev) => ({ ...prev, ...frame.analytics }));
		if (frame.loyalty)
			setLoyaltyState((prev) => ({ ...prev, ...frame.loyalty }));
		if (frame.gateway)
			setGatewayState((prev) => ({ ...prev, ...frame.gateway }));
		if (frame.billing)
			setBillingState((prev) => ({ ...prev, ...frame.billing }));
		if (frame.eventBus)
			setEventBusState((prev) => ({ ...prev, ...frame.eventBus }));
		if (frame.edgeStripe)
			setEdgeStripeState((prev) => ({ ...prev, ...frame.edgeStripe }));
		if (frame.edgeEmail)
			setEdgeEmailState((prev) => ({ ...prev, ...frame.edgeEmail }));
		if (frame.edgeInventory)
			setEdgeInventoryState((prev) => ({ ...prev, ...frame.edgeInventory }));
		if (frame.edgeAnalytics)
			setEdgeAnalyticsState((prev) => ({ ...prev, ...frame.edgeAnalytics }));
		if (frame.edgeLoyalty)
			setEdgeLoyaltyState((prev) => ({ ...prev, ...frame.edgeLoyalty }));
		if (frame.edgeGwBilling)
			setEdgeGwBillingState((prev) => ({ ...prev, ...frame.edgeGwBilling }));
		if (frame.edgeBillingBus)
			setEdgeBillingBusState((prev) => ({
				...prev,
				...frame.edgeBillingBus,
			}));
		if (frame.edgeBusEmail)
			setEdgeBusEmailState((prev) => ({ ...prev, ...frame.edgeBusEmail }));
		if (frame.edgeBusInventory)
			setEdgeBusInventoryState((prev) => ({
				...prev,
				...frame.edgeBusInventory,
			}));
		if (frame.edgeBusAnalytics)
			setEdgeBusAnalyticsState((prev) => ({
				...prev,
				...frame.edgeBusAnalytics,
			}));
		if (frame.edgeBusLoyalty)
			setEdgeBusLoyaltyState((prev) => ({
				...prev,
				...frame.edgeBusLoyalty,
			}));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setVizAnimating(false);
							onDone?.();
						}, ANIMATION_DURATION_MS);
						timersRef.current.push(cleanup);
					}
				}, i * ANIMATION_DURATION_MS);
				timersRef.current.push(t);
			}
		},
		[applyFrame, resetViz],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Hooks ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// ── Inspector ──
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// ── Flow nodes/edges ──
	const flowNodes: Node[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'gateway',
					type: 'gateway',
					position: { x: 250, y: 10 },
					data: gatewayState,
				},
				{
					id: 'billing',
					type: 'billing',
					position: { x: 250, y: 140 },
					data: billingState,
				},
				{
					id: 'eventBus',
					type: 'eventBus',
					position: { x: 250, y: 280 },
					data: eventBusState,
				},
				{
					id: 'email',
					type: 'service',
					position: { x: 20, y: 400 },
					data: emailState,
				},
				{
					id: 'inventory',
					type: 'service',
					position: { x: 180, y: 400 },
					data: inventoryState,
				},
				{
					id: 'analytics',
					type: 'service',
					position: { x: 340, y: 400 },
					data: analyticsState,
				},
				{
					id: 'loyalty',
					type: 'service',
					position: { x: 500, y: 400 },
					data: loyaltyState,
				},
			];
		}
		// Observe: star topology with Order at center-top
		return [
			{
				id: 'order',
				type: 'order',
				position: { x: 230, y: 10 },
				data: orderState,
			},
			{
				id: 'stripe',
				type: 'service',
				position: { x: 20, y: 180 },
				data: stripeState,
			},
			{
				id: 'email',
				type: 'service',
				position: { x: 160, y: 180 },
				data: emailState,
			},
			{
				id: 'inventory',
				type: 'service',
				position: { x: 300, y: 180 },
				data: inventoryState,
			},
			{
				id: 'analytics',
				type: 'service',
				position: { x: 120, y: 310 },
				data: analyticsState,
			},
			{
				id: 'loyalty',
				type: 'service',
				position: { x: 320, y: 310 },
				data: loyaltyState,
			},
		];
	}, [
		isReward,
		orderState,
		stripeState,
		emailState,
		inventoryState,
		analyticsState,
		loyaltyState,
		gatewayState,
		billingState,
		eventBusState,
	]);

	const flowEdges: Edge[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'edgeGwBilling',
					source: 'gateway',
					target: 'billing',
					type: 'arch',
					data: edgeGwBillingState,
				},
				{
					id: 'edgeBillingBus',
					source: 'billing',
					target: 'eventBus',
					type: 'arch',
					data: edgeBillingBusState,
				},
				{
					id: 'edgeBusEmail',
					source: 'eventBus',
					target: 'email',
					type: 'arch',
					data: edgeBusEmailState,
				},
				{
					id: 'edgeBusInventory',
					source: 'eventBus',
					target: 'inventory',
					type: 'arch',
					data: edgeBusInventoryState,
				},
				{
					id: 'edgeBusAnalytics',
					source: 'eventBus',
					target: 'analytics',
					type: 'arch',
					data: edgeBusAnalyticsState,
				},
				{
					id: 'edgeBusLoyalty',
					source: 'eventBus',
					target: 'loyalty',
					type: 'arch',
					data: edgeBusLoyaltyState,
				},
			];
		}
		// Observe: star topology
		return [
			{
				id: 'edgeStripe',
				source: 'order',
				target: 'stripe',
				type: 'arch',
				data: edgeStripeState,
			},
			{
				id: 'edgeEmail',
				source: 'order',
				target: 'email',
				type: 'arch',
				data: edgeEmailState,
			},
			{
				id: 'edgeInventory',
				source: 'order',
				target: 'inventory',
				type: 'arch',
				data: edgeInventoryState,
			},
			{
				id: 'edgeAnalytics',
				source: 'order',
				target: 'analytics',
				type: 'arch',
				data: edgeAnalyticsState,
			},
			{
				id: 'edgeLoyalty',
				source: 'order',
				target: 'loyalty',
				type: 'arch',
				data: edgeLoyaltyState,
			},
		];
	}, [
		isReward,
		edgeStripeState,
		edgeEmailState,
		edgeInventoryState,
		edgeAnalyticsState,
		edgeLoyaltyState,
		edgeGwBillingState,
		edgeBillingBusState,
		edgeBusEmailState,
		edgeBusInventoryState,
		edgeBusAnalyticsState,
		edgeBusLoyaltyState,
	]);

	// ── Handlers ──
	const handleNodeClick = useCallback(
		(nodeId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[nodeId];
			if (!data) return;
			setInspectorData(data);
			const discoveryId = STAGE_DISCOVERY_MAP[nodeId];
			if (discoveryId) discoveryGating.discover(discoveryId);
		},
		[phase, discoveryGating],
	);

	const handleProbe = useCallback(
		(probeId: string) => {
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = OBSERVE_PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames);
		},
		[discoveryGating, runAnimation],
	);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_PROBE_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[stressTest, runAnimation],
	);

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const config = OPTION_STEP_CONFIG[stepper.currentStep];
			if (!config) return;
			const option = config.options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all build steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message:
				'Architecture complete! Billing extracted with state machines, domain events, API gateway, observability, and feature flags.',
		};
	};

	// ── Code preview index ──
	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Center panel content ──
	function renderCenter() {
		// Observe phase
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={archEdgeTypes}
							nodes={flowNodes}
							nodeTypes={observeNodeTypes}
							onNodeClick={handleNodeClick}
						/>
						{inspectorData && (
							<StageInspector
								data={inspectorData}
								onClose={() => setInspectorData(null)}
							/>
						)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Architecture Probe"
						/>
					</div>
					{discoveryGating.isUnlocked && (
						<div className="p-4 flex justify-center animate-in fade-in duration-500">
							<Button
								className="gap-2"
								onClick={() => setPhase('build')}
								size="lg"
							>
								Build the Fix
								<ArrowRight className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		// Build phase
		if (phase === 'build') {
			return (
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-2xl mx-auto space-y-4">
						{/* Step 0: Terminal */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={packwerkCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Before extracting billing, define package boundaries within
										the monolith. This enforces that billing code does not leak
										dependencies to unrelated packages.
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
								outputLines={packwerkOutput}
								stepKey={stepper.currentStep}
								title="Initialize Bounded Contexts"
							/>
						)}

						{/* OptionCard steps (1-6) */}
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
										{shuffleOptions(
											currentOptionConfig.options,
											stepper.currentStep,
										).map((opt) => (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.name}
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
													name={opt.name}
													onClick={() => handleOptionSelect(opt.id)}
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
												hasNextStep
													? stepper.nextStep
													: () => setPhase('reward')
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
			);
		}

		// Reward phase
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={archEdgeTypes}
						nodes={flowNodes}
						nodeTypes={rewardNodeTypes}
					/>
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
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
	}

	return (
		<LevelLayout>
			<LeftPanel>
				<div className="flex flex-col h-full overflow-y-auto">
					{/* Scenario text */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The Order model calls 5 services synchronously in its charge!
							method. Payment, email, inventory, analytics, and loyalty are all
							coupled together. A failure in any service rolls back the entire
							transaction.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Extract billing into a clean, independent service using every
							architecture pattern you have learned: state machines, domain
							events, API gateway, multi-database, observability, tenant
							isolation, and feature flags.
						</p>
					</div>

					{/* Observe: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Build Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward: architecture legend + counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Architecture Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Globe className="w-4 h-4 text-success" />
										<span className="text-foreground">
											API Gateway (auth at edge)
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Database className="w-4 h-4 text-primary" />
										<span className="text-foreground">
											Billing Service (AASM + own DB)
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Radio className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											Event Bus (Wisper broadcast)
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Eye className="w-4 h-4 text-muted-foreground" />
										<span className="text-foreground">
											OpenTelemetry tracing
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Flag className="w-4 h-4 text-muted-foreground" />
										<span className="text-foreground">
											Flipper feature flag routing
										</span>
									</div>
								</div>
							</div>
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
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={8}
					levelName="The Architect"
					levelNumber={56}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{renderCenter()}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build'
							? codePreviewStep
							: phase === 'reward'
								? STEP_DEFS.length - 1
								: -1,
					)}
					learningGoal="The capstone level brings together every architecture pattern: AASM state machines guard payment transitions, Wisper broadcasts domain events to async subscribers, connects_to isolates the billing database, an API gateway handles auth at the edge, OpenTelemetry provides distributed tracing, and Flipper enables gradual rollout."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level58Architect;

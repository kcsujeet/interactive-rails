/**
 * Level 56: Domain Events & Decoupling
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom chain visualization. CheckoutService at top,
 *   sequential arrows down through EmailService -> InventoryService ->
 *   AnalyticsService -> ShippingService. Shows waterfall/chain of synchronous calls.
 *   Probes show sequential bottleneck, cascade failure, tight coupling, no isolation.
 *
 * Phase 2 (HOW - build): 6 steps (1 terminal + 5 OptionCard)
 *   Step 0: Install wisper gem (TerminalChoice)
 *   Step 1: Define OrderCompleted event class (OptionCard)
 *   Step 2: Publish event from CheckoutService (OptionCard)
 *   Step 3: Subscribe EmailService as listener (OptionCard)
 *   Step 4: Subscribe remaining services (OptionCard)
 *   Step 5: Add async processing via background jobs (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Fan-out visualization. CheckoutService at top,
 *   Event Bus node in middle (green), 4 service nodes at bottom arranged horizontally.
 *   Stress test fires scenarios; all "allowed" since events always succeed at publish.
 *   Counters track "Processed" (green) / "Retrying" (amber).
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, Bell, Zap } from 'lucide-react';
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

registerLevelCode('act7-level56-domain-events', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface CheckoutVizState {
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
	checkout?: Partial<CheckoutVizState>;
	email?: Partial<ServiceVizState>;
	inventory?: Partial<ServiceVizState>;
	analytics?: Partial<ServiceVizState>;
	shipping?: Partial<ServiceVizState>;
	eventBus?: Partial<EventBusVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
	edgeD?: Partial<EdgeVizState>;
	edgeBusIn?: Partial<EdgeVizState>;
	edgeBusEmail?: Partial<EdgeVizState>;
	edgeBusInventory?: Partial<EdgeVizState>;
	edgeBusAnalytics?: Partial<EdgeVizState>;
	edgeBusShipping?: Partial<EdgeVizState>;
}

// ─── Defaults (observe: chain topology) ──────────────────────────────

const DEFAULT_CHECKOUT: CheckoutVizState = {
	label: 'CheckoutService',
	flash: 'idle',
	sublabel: 'Direct method calls',
	badge: null,
};

const DEFAULT_EMAIL: ServiceVizState = {
	label: 'EmailService',
	flash: 'idle',
	sublabel: 'Waiting for call',
	badge: null,
};

const DEFAULT_INVENTORY: ServiceVizState = {
	label: 'InventoryService',
	flash: 'idle',
	sublabel: 'Waiting for call',
	badge: null,
};

const DEFAULT_ANALYTICS: ServiceVizState = {
	label: 'AnalyticsService',
	flash: 'idle',
	sublabel: 'Waiting for call',
	badge: null,
};

const DEFAULT_SHIPPING: ServiceVizState = {
	label: 'ShippingService',
	flash: 'idle',
	sublabel: 'Waiting for call',
	badge: null,
};

const DEFAULT_EVENTBUS: EventBusVizState = {
	label: 'Event Bus',
	flash: 'green',
	sublabel: 'Wisper pub/sub',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

// ─── Reward defaults ─────────────────────────────────────────────────

const DEFAULT_CHECKOUT_REWARD: CheckoutVizState = {
	label: 'CheckoutService',
	flash: 'green',
	sublabel: 'broadcast(:order_completed)',
	badge: null,
};

const DEFAULT_EMAIL_REWARD: ServiceVizState = {
	label: 'EmailService',
	flash: 'green',
	sublabel: 'Subscribed',
	badge: null,
};

const DEFAULT_INVENTORY_REWARD: ServiceVizState = {
	label: 'InventoryService',
	flash: 'green',
	sublabel: 'Subscribed',
	badge: null,
};

const DEFAULT_ANALYTICS_REWARD: ServiceVizState = {
	label: 'AnalyticsService',
	flash: 'green',
	sublabel: 'Subscribed',
	badge: null,
};

const DEFAULT_SHIPPING_REWARD: ServiceVizState = {
	label: 'ShippingService',
	flash: 'green',
	sublabel: 'Subscribed',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'sequential-bottleneck',
		label: 'Sequential calls create a bottleneck',
	},
	{
		id: 'cascade-failure',
		label: 'One failure cascades to all downstream services',
	},
	{
		id: 'tight-coupling',
		label: 'Adding services requires modifying CheckoutService',
	},
	{
		id: 'no-isolation',
		label: 'Cannot retry individual services independently',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'email-slow',
		label: 'Checkout with slow email (3s)',
		command: 'POST /checkout {order_id: 42, email_delay: 3000}',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (4200ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'EmailService.send_confirmation took 3000ms.', color: 'red' },
			{
				text: 'InventoryService.reserve waited 3000ms to start.',
				color: 'yellow',
			},
			{
				text: 'Total checkout: 4200ms (email + inventory + analytics + shipping).',
				color: 'red',
			},
		],
		story: [
			'Customer completes checkout for order #42.',
			'CheckoutService calls EmailService.send_confirmation first.',
			'Email server is slow today, taking 3 full seconds.',
			'Inventory, analytics, and shipping all wait in line.',
			'Customer stares at a spinner for 4.2 seconds.',
		],
	},
	{
		id: 'email-down',
		label: 'Checkout with email service down',
		command: 'POST /checkout {order_id: 43, email_service: "down"}',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'EmailService::ConnectionError: SMTP server unreachable.',
				color: 'red',
			},
			{ text: 'InventoryService.reserve: NEVER CALLED.', color: 'red' },
			{
				text: 'Order #43 stuck: items not reserved, no tracking created.',
				color: 'red',
			},
		],
		story: [
			'Customer completes checkout for order #43.',
			'CheckoutService calls EmailService first in the chain.',
			'The SMTP server is unreachable. EmailService raises an error.',
			'The exception propagates up. Inventory never reserves stock.',
			'Analytics and shipping never run. The entire order fails.',
		],
	},
	{
		id: 'add-loyalty',
		label: 'Add LoyaltyService to checkout',
		command: 'rails generate service Loyalty',
		responseLines: [
			{ text: 'create  app/services/loyalty_service.rb', color: 'cyan' },
			{ text: '', color: 'muted' },
			{
				text: 'Now edit CheckoutService to add LoyaltyService.award_points call.',
				color: 'yellow',
			},
			{ text: 'Must decide WHERE in the chain to insert it.', color: 'yellow' },
			{
				text: 'Existing tests for CheckoutService must be updated.',
				color: 'red',
			},
		],
		story: [
			'Product wants to add loyalty points on checkout.',
			'You create LoyaltyService with an award_points method.',
			'Now you must open CheckoutService and add the call manually.',
			'Should it go before or after shipping? Order matters in a chain.',
			'Every new service means modifying and retesting CheckoutService.',
		],
	},
	{
		id: 'partial-failure-retry',
		label: 'Retry failed analytics only',
		command: 'rails runner "CheckoutService.retry_analytics(order: 44)"',
		responseLines: [
			{
				text: "NoMethodError: undefined method `retry_analytics'",
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: 'CheckoutService has no granular retry. It is all or nothing.',
				color: 'red',
			},
			{
				text: 'Retrying means re-sending email, re-reserving inventory...',
				color: 'yellow',
			},
			{
				text: 'No way to isolate and retry just the failed step.',
				color: 'red',
			},
		],
		story: [
			'Order #44 completed but analytics tracking failed silently.',
			'You want to retry just the analytics step.',
			'CheckoutService.call runs ALL steps sequentially.',
			'Retrying means re-sending the confirmation email (duplicate!).',
			'No isolation between services means no granular retry.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'email-slow': ['sequential-bottleneck'],
	'email-down': ['cascade-failure'],
	'add-loyalty': ['tight-coupling'],
	'partial-failure-retry': ['no-isolation'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: chain topology. edgeA = checkout->email, edgeB = email->inventory,
// edgeC = inventory->analytics, edgeD = analytics->shipping

const EMAIL_SLOW_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'Calling EmailService...',
			badge: null,
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Sending email...',
			badge: '3000ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'send_confirmation',
			dotColor: '#ef4444',
		},
	},
	{
		checkout: {
			label: 'Blocked...',
			flash: 'red',
			sublabel: 'Waiting on email (3s)',
			badge: '3000ms',
		},
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'Still sending...',
			badge: '3000ms',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'idle',
			sublabel: 'Queued behind email',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'idle',
			sublabel: 'Queued behind email',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'idle',
			sublabel: 'Queued behind email',
			badge: null,
		},
	},
	{
		checkout: {
			label: '200 OK (4200ms)',
			flash: 'red',
			sublabel: 'Sequential total: 4.2s',
			badge: '4200ms',
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Done (3000ms)',
			badge: null,
		},
		inventory: {
			label: 'InventoryService',
			flash: 'amber',
			sublabel: 'Done (400ms)',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'amber',
			sublabel: 'Done (500ms)',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'amber',
			sublabel: 'Done (300ms)',
			badge: null,
		},
		edgeA: { active: false, label: '' },
	},
];

const EMAIL_DOWN_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'Calling EmailService...',
			badge: null,
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Connecting to SMTP...',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'send_confirmation',
			dotColor: '#ef4444',
		},
	},
	{
		checkout: {
			label: 'Error propagating!',
			flash: 'red',
			sublabel: 'ConnectionError raised',
			badge: '500',
		},
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'SMTP unreachable!',
			badge: 'ERROR',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'red',
			sublabel: 'NEVER CALLED',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'red',
			sublabel: 'NEVER CALLED',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'red',
			sublabel: 'NEVER CALLED',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'ConnectionError!',
			dotColor: '#ef4444',
		},
	},
	{
		checkout: {
			label: '500 Error',
			flash: 'red',
			sublabel: 'Order failed completely',
			badge: '500',
		},
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'SMTP unreachable!',
			badge: 'ERROR',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'red',
			sublabel: 'Stock not reserved',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'red',
			sublabel: 'Not tracked',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'red',
			sublabel: 'No label created',
			badge: null,
		},
	},
];

const ADD_LOYALTY_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'CheckoutService',
			flash: 'amber',
			sublabel: 'Must edit to add LoyaltyService',
			badge: null,
		},
		email: {
			label: 'EmailService',
			flash: 'idle',
			sublabel: 'Position 1 in chain',
			badge: null,
		},
		inventory: {
			label: 'InventoryService',
			flash: 'idle',
			sublabel: 'Position 2 in chain',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'idle',
			sublabel: 'Position 3 in chain',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'idle',
			sublabel: 'Position 4 in chain',
			badge: null,
		},
	},
	{
		checkout: {
			label: 'CheckoutService',
			flash: 'red',
			sublabel: '5 direct dependencies now',
			badge: '5 deps',
		},
		email: {
			label: 'EmailService',
			flash: 'idle',
			sublabel: 'Position 1',
			badge: null,
		},
		inventory: {
			label: 'InventoryService',
			flash: 'idle',
			sublabel: 'Position 2',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'idle',
			sublabel: 'Position 3',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'idle',
			sublabel: 'Position 4',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Growing dependency list',
			dotColor: '#ef4444',
		},
	},
];

const RETRY_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'Retry analytics?',
			flash: 'amber',
			sublabel: 'No granular retry available',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'red',
			sublabel: 'Failed on order #44',
			badge: 'FAILED',
		},
	},
	{
		checkout: {
			label: 'Must retry ALL',
			flash: 'red',
			sublabel: 'Re-runs entire chain',
			badge: null,
		},
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'Duplicate email sent!',
			badge: 'DUPLICATE',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'red',
			sublabel: 'Double-reserved!',
			badge: 'DUPLICATE',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'amber',
			sublabel: 'Retrying...',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'red',
			sublabel: 'Duplicate label!',
			badge: 'DUPLICATE',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Re-running everything',
			dotColor: '#ef4444',
		},
		edgeB: { active: true, reverse: false, label: '', dotColor: '#ef4444' },
		edgeC: { active: true, reverse: false, label: '', dotColor: '#ef4444' },
		edgeD: { active: true, reverse: false, label: '', dotColor: '#ef4444' },
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'email-slow': EMAIL_SLOW_FRAMES,
	'email-down': EMAIL_DOWN_FRAMES,
	'add-loyalty': ADD_LOYALTY_FRAMES,
	'partial-failure-retry': RETRY_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: fan-out topology. checkout -> eventBus -> 4 services in parallel.
// edgeBusIn = checkout->eventBus
// edgeBusEmail = eventBus->email, edgeBusInventory = eventBus->inventory,
// edgeBusAnalytics = eventBus->analytics, edgeBusShipping = eventBus->shipping

const REWARD_NORMAL_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'green',
			sublabel: 'Processing...',
			badge: '30ms',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Processing...',
			badge: '40ms',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Processing...',
			badge: '25ms',
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Processing...',
			badge: '35ms',
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: '200 OK (120ms)',
			flash: 'green',
			sublabel: 'Checkout complete',
			badge: '120ms',
		},
		email: {
			label: 'EmailService',
			flash: 'green',
			sublabel: 'Done',
			badge: null,
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Done',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Done',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Done',
			badge: null,
		},
	},
];

const REWARD_EMAIL_SLOW_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Slow (3s)...',
			badge: '3000ms',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '40ms',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '25ms',
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '35ms',
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#f59e0b',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: '200 OK (120ms)',
			flash: 'green',
			sublabel: 'Unaffected by email',
			badge: '120ms',
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Still processing (async)',
			badge: '3000ms',
		},
	},
];

const REWARD_EMAIL_DOWN_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'SMTP down, retrying...',
			badge: 'RETRY',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '40ms',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '25ms',
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '35ms',
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#ef4444',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: '200 OK (120ms)',
			flash: 'green',
			sublabel: 'No cascade failure',
			badge: '120ms',
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Solid Queue retry in 30s',
			badge: 'RETRY',
		},
	},
];

const REWARD_ANALYTICS_FAIL_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '30ms',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '40ms',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'red',
			sublabel: 'API error, retrying...',
			badge: 'RETRY',
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '35ms',
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#ef4444',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: '200 OK (120ms)',
			flash: 'green',
			sublabel: 'Unaffected by analytics',
			badge: '120ms',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'amber',
			sublabel: 'Solid Queue retry in 30s',
			badge: 'RETRY',
		},
	},
];

const REWARD_ADD_LOYALTY_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast (unchanged)',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'green',
			sublabel: 'Subscribed',
			badge: null,
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Subscribed',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Subscribed',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Subscribed',
			badge: null,
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: 'CheckoutService',
			flash: 'green',
			sublabel: 'Zero changes needed!',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: '+LoyaltyService.subscribe',
		},
	},
];

const REWARD_RETRY_EMAIL_FRAMES: AnimFrame[] = [
	{
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'Failed on order #43',
			badge: 'FAILED',
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'idle',
			sublabel: 'Solid Queue retry',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Retrying via Solid Queue...',
			badge: 'RETRY',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'green',
			sublabel: 'Not affected',
			badge: null,
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Not affected',
			badge: null,
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Not affected',
			badge: null,
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: 'retry',
			dotColor: '#f59e0b',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'green',
			sublabel: 'Retry succeeded!',
			badge: 'OK',
		},
	},
];

const REWARD_CASCADE_FRAMES: AnimFrame[] = [
	{
		checkout: {
			label: 'POST /checkout',
			flash: 'idle',
			sublabel: 'broadcast(:order_completed)',
			badge: null,
		},
		eventBus: {
			label: 'Event Bus',
			flash: 'green',
			sublabel: 'OrderCompleted published',
		},
		edgeBusIn: {
			active: true,
			reverse: false,
			label: 'broadcast',
			dotColor: '#22c55e',
		},
	},
	{
		email: {
			label: 'EmailService',
			flash: 'red',
			sublabel: 'Failed! Retrying...',
			badge: 'RETRY',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'red',
			sublabel: 'Failed! Retrying...',
			badge: 'RETRY',
		},
		analytics: {
			label: 'AnalyticsService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '25ms',
		},
		shipping: {
			label: 'ShippingService',
			flash: 'green',
			sublabel: 'Done!',
			badge: '35ms',
		},
		edgeBusEmail: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#ef4444',
		},
		edgeBusInventory: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#ef4444',
		},
		edgeBusAnalytics: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
		edgeBusShipping: {
			active: true,
			reverse: false,
			label: '',
			dotColor: '#22c55e',
		},
	},
	{
		checkout: {
			label: '200 OK (120ms)',
			flash: 'green',
			sublabel: 'Checkout succeeded',
			badge: '120ms',
		},
		email: {
			label: 'EmailService',
			flash: 'amber',
			sublabel: 'Retry independently',
			badge: 'RETRY',
		},
		inventory: {
			label: 'InventoryService',
			flash: 'amber',
			sublabel: 'Retry independently',
			badge: 'RETRY',
		},
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'normal-checkout': REWARD_NORMAL_FRAMES,
	'email-slow': REWARD_EMAIL_SLOW_FRAMES,
	'email-down': REWARD_EMAIL_DOWN_FRAMES,
	'analytics-fail': REWARD_ANALYTICS_FAIL_FRAMES,
	'add-loyalty': REWARD_ADD_LOYALTY_FRAMES,
	'partial-failure-retry': REWARD_RETRY_EMAIL_FRAMES,
	'cascade-attempt': REWARD_CASCADE_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	checkout: {
		stageId: 'checkout',
		title: 'CheckoutService',
		description:
			'Orchestrates the entire checkout flow by calling each downstream service directly, in sequence. If any service is slow or fails, the whole checkout blocks or fails.',
		code: `class CheckoutService < ApplicationService
  def call(order)
    order.complete!
    EmailService.send_confirmation(order)
    InventoryService.reserve(order)
    AnalyticsService.track(order)
    ShippingService.create_label(order)
  end
end`,
	},
	email: {
		stageId: 'email',
		title: 'EmailService',
		description:
			'Sends order confirmation emails. Called first in the chain, so any delay or failure blocks all downstream services.',
	},
	inventory: {
		stageId: 'inventory',
		title: 'InventoryService',
		description:
			'Reserves stock for order items. Called second in the chain, after email completes. Cannot run until email finishes.',
	},
	analytics: {
		stageId: 'analytics',
		title: 'AnalyticsService',
		description:
			'Tracks order metrics for reporting. Called third, after inventory. A non-critical service that blocks critical ones if it fails.',
	},
	shipping: {
		stageId: 'shipping',
		title: 'ShippingService',
		description:
			'Creates shipping labels and initiates fulfillment. Called last in the chain. Must wait for email, inventory, and analytics to complete first.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	checkout: 'tight-coupling',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'normal-checkout',
		label: 'Normal checkout (all services healthy)',
		description: 'All subscribers process in parallel via event bus',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'email-slow',
		label: 'Checkout with slow email (3s)',
		description: 'Other services unaffected, checkout fast',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'email-down',
		label: 'Checkout with email service down',
		description: 'Inventory/analytics/shipping still process',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'analytics-fail',
		label: 'Checkout with analytics failure',
		description: 'Non-critical failure, others still process',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'add-loyalty',
		label: 'Add LoyaltyService subscriber',
		description: 'New subscriber, zero checkout changes',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'partial-failure-retry',
		label: 'Retry failed email via Solid Queue',
		description: 'Granular retry for individual service',
		method: 'POST',
		path: '/checkout/retry',
		actor: 'system',
		expectedResult: 'allowed',
	},
	{
		id: 'cascade-attempt',
		label: 'Multiple failures at once',
		description: 'Each service retries independently',
		method: 'POST',
		path: '/checkout',
		actor: 'customer',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-wisper', title: 'Install Wisper Gem' },
	{ id: 'define-event', title: 'Define OrderCompleted Event' },
	{ id: 'publish-event', title: 'Publish Event from Checkout' },
	{ id: 'subscribe-email', title: 'Subscribe EmailService' },
	{ id: 'subscribe-remaining', title: 'Subscribe Remaining Services' },
	{ id: 'async-processing', title: 'Add Async Processing' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: install wisper
	'option', // 1: define event
	'option', // 2: publish event
	'option', // 3: subscribe email
	'option', // 4: subscribe remaining
	'option', // 5: async processing
];

// ─── Step 0: Install wisper (Terminal) ────────────────────────────────

const installWisperCommands: TerminalCommand[] = [
	{
		id: 'wrong-activesupport',
		label: 'rails generate events:install',
		command: 'rails generate events:install',
		correct: false,
		feedback:
			'Rails does not have a built-in event system generator. You need a gem that provides pub/sub event broadcasting.',
	},
	{
		id: 'wrong-kafka',
		label: 'bundle add ruby-kafka',
		command: 'bundle add ruby-kafka',
		correct: false,
		feedback:
			'Kafka is infrastructure-level messaging for distributed systems. For in-process domain events within a Rails app, a lightweight pub/sub library is more appropriate.',
	},
	{
		id: 'correct',
		label: 'bundle add wisper',
		command: 'bundle add wisper',
		correct: true,
	},
];

const installWisperOutput: TerminalOutputLine[] = [
	{ text: 'Fetching wisper 2.0.1', color: 'cyan' },
	{ text: 'Installing wisper 2.0.1', color: 'green' },
	{ text: 'Bundle complete! 1 Gemfile dependency added.', color: 'green' },
];

// ─── Step 1: Define OrderCompleted event (OptionCard) ─────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const DEFINE_EVENT_OPTIONS: StepOption[] = [
	{
		id: 'active-model',
		name: 'class OrderCompleted < ActiveModel::Event\n  attribute :order\nend',
		correct: false,
		feedback:
			'ActiveModel::Event does not exist in Rails. Wisper provides its own Publisher module for broadcasting domain events.',
	},
	{
		id: 'callback',
		name: 'class OrderCompleted\n  include ActiveRecord::Callbacks\n  after_create :notify\nend',
		correct: false,
		feedback:
			'ActiveRecord callbacks are tied to model lifecycle, not domain events. Domain events should be explicit, not hidden in model hooks.',
	},
	{
		id: 'correct',
		name: 'class OrderCompleted\n  include Wisper::Publisher\n\n  def call(order)\n    broadcast(:order_completed, order)\n  end\nend',
		correct: true,
	},
];

// ─── Step 2: Publish event from CheckoutService (OptionCard) ──────────

const PUBLISH_EVENT_OPTIONS: StepOption[] = [
	{
		id: 'direct-still',
		name: 'class CheckoutService < ApplicationService\n  def call(order)\n    order.complete!\n    OrderCompleted.new.call(order)\n    EmailService.send_confirmation(order)\n  end\nend',
		correct: false,
		feedback:
			'You are still calling EmailService directly after the event. The event should replace all direct service calls, not sit alongside them.',
	},
	{
		id: 'correct',
		name: 'class CheckoutService < ApplicationService\n  def call(order)\n    order.complete!\n    OrderCompleted.new.call(order)\n    # No more direct service calls!\n  end\nend',
		correct: true,
	},
	{
		id: 'notify-all',
		name: 'class CheckoutService < ApplicationService\n  def call(order)\n    order.complete!\n    ActiveSupport::Notifications.instrument("order.completed", order: order)\n  end\nend',
		correct: false,
		feedback:
			'ActiveSupport::Notifications is for instrumentation and monitoring, not domain events. Use the Wisper event class you just created.',
	},
];

// ─── Step 3: Subscribe EmailService (OptionCard) ──────────────────────

const SUBSCRIBE_EMAIL_OPTIONS: StepOption[] = [
	{
		id: 'wrong-observe',
		name: 'EmailService.observe(OrderCompleted)',
		correct: false,
		feedback:
			'Wisper does not use an observe method. Listeners subscribe to publishers, and the listener class must define a method matching the broadcast event name.',
	},
	{
		id: 'wrong-callback',
		name: 'OrderCompleted.after_broadcast :send_email',
		correct: false,
		feedback:
			'Wisper does not have after_broadcast callbacks. Subscribers listen for the event by defining a method with the same name as the broadcast.',
	},
	{
		id: 'correct',
		name: 'class EmailListener\n  def order_completed(order)\n    EmailService.send_confirmation(order)\n  end\nend\n\n# In initializer:\nWisper.subscribe(EmailListener.new)',
		correct: true,
	},
];

// ─── Step 4: Subscribe remaining services (OptionCard) ────────────────

const SUBSCRIBE_REMAINING_OPTIONS: StepOption[] = [
	{
		id: 'wrong-single',
		name: 'Wisper.subscribe(AllServicesListener.new)',
		correct: false,
		feedback:
			'Combining all services into one listener class defeats the purpose of decoupling. Each service should have its own listener for independent operation.',
	},
	{
		id: 'correct',
		name: 'Wisper.subscribe(InventoryListener.new)\nWisper.subscribe(AnalyticsListener.new)\nWisper.subscribe(ShippingListener.new)',
		correct: true,
	},
	{
		id: 'wrong-array',
		name: 'Wisper.subscribe_all(\n  [InventoryListener, AnalyticsListener, ShippingListener]\n)',
		correct: false,
		feedback:
			'Wisper does not have a subscribe_all method. Each listener subscribes individually, which is intentional for independent lifecycle management.',
	},
];

// ─── Step 5: Add async processing (OptionCard) ───────────────────────

const ASYNC_OPTIONS: StepOption[] = [
	{
		id: 'wrong-thread',
		name: 'Wisper.subscribe(EmailListener.new, async: true)',
		correct: false,
		feedback:
			'The async: true option spawns threads, which is unreliable in Rails. Background jobs via Solid Queue give you retries, persistence, and monitoring.',
	},
	{
		id: 'correct',
		name: 'class EmailListener\n  def order_completed(order)\n    EmailJob.perform_later(order.id)\n  end\nend\n\n# Each listener delegates to its own job\n# Solid Queue handles retries independently',
		correct: true,
	},
	{
		id: 'wrong-sidekiq',
		name: 'class EmailListener\n  include Sidekiq::Worker\n  def perform(order_id)\n    EmailService.send_confirmation(Order.find(order_id))\n  end\nend',
		correct: false,
		feedback:
			'The listener and the job are separate concerns. The listener receives the event and enqueues the job. Mixing them couples the event handling to a specific job backend.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Define the Domain Event',
		description:
			'Create an event class that represents "an order was completed." This class will broadcast the event to any registered listeners without knowing who they are.',
		options: DEFINE_EVENT_OPTIONS,
	},
	2: {
		title: 'Replace Direct Calls with Event',
		description:
			'CheckoutService currently calls four services directly. Replace all those calls with a single event broadcast. The checkout should only know about completing the order and publishing the event.',
		options: PUBLISH_EVENT_OPTIONS,
	},
	3: {
		title: 'Subscribe EmailService',
		description:
			'Create a listener that subscribes to the OrderCompleted event and delegates to EmailService. The listener method name must match the broadcast event name.',
		options: SUBSCRIBE_EMAIL_OPTIONS,
	},
	4: {
		title: 'Subscribe Remaining Services',
		description:
			'Inventory, analytics, and shipping each need their own listener. Each subscribes independently so they can be managed, deployed, and retried separately.',
		options: SUBSCRIBE_REMAINING_OPTIONS,
	},
	5: {
		title: 'Add Async Processing',
		description:
			'Synchronous listeners still block. Wrap each listener in a background job so services process independently. Failed jobs retry without affecting other services.',
		options: ASYNC_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: installWisperCommands, outputLines: installWisperOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/checkout_service.rb',
				language: 'ruby',
				code: `class CheckoutService < ApplicationService
  Result = Data.define(:order, :success, :error)

  def call(order)
    order.complete!

    # Sequential direct calls (tightly coupled)
    EmailService.send_confirmation(order)
    InventoryService.reserve(order)
    AnalyticsService.track(order)
    ShippingService.create_label(order)
    Result.new(order: order, success: true, error: nil)
  end
end`,
				highlight: [5, 6, 7, 8, 9],
			},
		];
	}

	const files = [];

	// Step 0 complete: Gemfile updated
	if (completedStep >= 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "wisper", "~> 2.0"  # Domain events`,
			highlight: [3],
		});
	} else {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
# TODO: add event system gem`,
			highlight: [3],
		});
	}

	// Step 1 complete: Event class defined
	if (completedStep >= 1) {
		files.push({
			filename: 'app/events/order_completed.rb',
			language: 'ruby',
			code: `class OrderCompleted
  include Wisper::Publisher

  def call(order)
    broadcast(:order_completed, order)
  end
end`,
			highlight: [2, 5],
		});
	}

	// Step 2 complete: CheckoutService uses event
	if (completedStep >= 2) {
		files.push({
			filename: 'app/services/checkout_service.rb',
			language: 'ruby',
			code: `class CheckoutService < ApplicationService
  def call(order)
    order.complete!
    OrderCompleted.new.call(order)
    # No more direct service calls!
  end
end`,
			highlight: [4, 5],
		});
	}

	// Step 3 complete: EmailListener
	if (completedStep >= 3) {
		files.push({
			filename: 'app/listeners/email_listener.rb',
			language: 'ruby',
			code:
				completedStep >= 5
					? `class EmailListener
  def order_completed(order)
    EmailJob.perform_later(order.id)
  end
end`
					: `class EmailListener
  def order_completed(order)
    EmailService.send_confirmation(order)
  end
end`,
			highlight: completedStep >= 5 ? [3] : [3],
		});
	}

	// Step 4 complete: All listeners + initializer
	if (completedStep >= 4) {
		files.push({
			filename: 'config/initializers/wisper.rb',
			language: 'ruby',
			code: `# config/initializers/wisper.rb
Wisper.subscribe(EmailListener.new)
Wisper.subscribe(InventoryListener.new)
Wisper.subscribe(AnalyticsListener.new)
Wisper.subscribe(ShippingListener.new)`,
			highlight: [2, 3, 4, 5],
		});
	}

	// Step 5 complete: async jobs
	if (completedStep >= 5) {
		files.push({
			filename: 'app/jobs/email_job.rb',
			language: 'ruby',
			code: `class EmailJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer

  def perform(order_id)
    order = Order.find(order_id)
    EmailService.send_confirmation(order)
  end
end

# Each service has its own job with independent retries
# InventoryJob, AnalyticsJob, ShippingJob follow the same pattern`,
			highlight: [3, 5, 6, 7],
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

const SERVICE_ICON_MAP: Record<string, string> = {
	EmailService: 'EM',
	InventoryService: 'IN',
	AnalyticsService: 'AN',
	ShippingService: 'SH',
};

const SERVICE_COLOR_MAP: Record<string, string> = {
	EmailService: '#3b82f6',
	InventoryService: '#f59e0b',
	AnalyticsService: '#8b5cf6',
	ShippingService: '#06b6d4',
};

// ─── Custom React Flow nodes ──────────────────────────────────────────

const CheckoutNode = memo(function CheckoutNode({
	data,
}: {
	data: CheckoutVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'CK',
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
				<div
					className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono ${
						data.flash === 'green'
							? 'bg-success/20 text-success'
							: data.flash === 'red'
								? 'bg-destructive/20 text-destructive'
								: data.flash === 'amber'
									? 'bg-warning/20 text-warning'
									: 'bg-muted text-muted-foreground'
					}`}
				>
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
		icon: SERVICE_ICON_MAP[data.label] ?? 'SV',
		color: SERVICE_COLOR_MAP[data.label] ?? '#71717a',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div
					className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono ${
						data.flash === 'green'
							? 'bg-success/20 text-success'
							: data.flash === 'red'
								? 'bg-destructive/20 text-destructive'
								: data.flash === 'amber'
									? 'bg-warning/20 text-warning'
									: 'bg-muted text-muted-foreground'
					}`}
				>
					{data.badge}
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

const EventEdge = memo(function EventEdge(props: EdgeProps) {
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

const eventNodeTypes = {
	checkout: CheckoutNode,
	service: ServiceNode,
	eventBus: EventBusNode,
};
const eventEdgeTypes = { event: EventEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level56DomainEvents({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [checkoutState, setCheckoutState] =
		useState<CheckoutVizState>(DEFAULT_CHECKOUT);
	const [emailState, setEmailState] = useState<ServiceVizState>(DEFAULT_EMAIL);
	const [inventoryState, setInventoryState] =
		useState<ServiceVizState>(DEFAULT_INVENTORY);
	const [analyticsState, setAnalyticsState] =
		useState<ServiceVizState>(DEFAULT_ANALYTICS);
	const [shippingState, setShippingState] =
		useState<ServiceVizState>(DEFAULT_SHIPPING);
	const [eventBusState, setEventBusState] =
		useState<EventBusVizState>(DEFAULT_EVENTBUS);

	// Edges: observe chain (A=checkout->email, B=email->inventory, C=inventory->analytics, D=analytics->shipping)
	// Edges: reward fan-out (busIn=checkout->eventBus, busEmail, busInventory, busAnalytics, busShipping)
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeDState, setEdgeDState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusInState, setEdgeBusInState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusEmailState, setEdgeBusEmailState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusInventoryState, setEdgeBusInventoryState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusAnalyticsState, setEdgeBusAnalyticsState] =
		useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBusShippingState, setEdgeBusShippingState] =
		useState<EdgeVizState>(DEFAULT_EDGE);

	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setCheckoutState(isReward ? DEFAULT_CHECKOUT_REWARD : DEFAULT_CHECKOUT);
		setEmailState(isReward ? DEFAULT_EMAIL_REWARD : DEFAULT_EMAIL);
		setInventoryState(isReward ? DEFAULT_INVENTORY_REWARD : DEFAULT_INVENTORY);
		setAnalyticsState(isReward ? DEFAULT_ANALYTICS_REWARD : DEFAULT_ANALYTICS);
		setShippingState(isReward ? DEFAULT_SHIPPING_REWARD : DEFAULT_SHIPPING);
		setEventBusState(DEFAULT_EVENTBUS);
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
		setEdgeCState(DEFAULT_EDGE);
		setEdgeDState(DEFAULT_EDGE);
		setEdgeBusInState(DEFAULT_EDGE);
		setEdgeBusEmailState(DEFAULT_EDGE);
		setEdgeBusInventoryState(DEFAULT_EDGE);
		setEdgeBusAnalyticsState(DEFAULT_EDGE);
		setEdgeBusShippingState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.checkout)
			setCheckoutState((prev) => ({ ...prev, ...frame.checkout }));
		if (frame.email) setEmailState((prev) => ({ ...prev, ...frame.email }));
		if (frame.inventory)
			setInventoryState((prev) => ({ ...prev, ...frame.inventory }));
		if (frame.analytics)
			setAnalyticsState((prev) => ({ ...prev, ...frame.analytics }));
		if (frame.shipping)
			setShippingState((prev) => ({ ...prev, ...frame.shipping }));
		if (frame.eventBus)
			setEventBusState((prev) => ({ ...prev, ...frame.eventBus }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
		if (frame.edgeD) setEdgeDState((prev) => ({ ...prev, ...frame.edgeD }));
		if (frame.edgeBusIn)
			setEdgeBusInState((prev) => ({ ...prev, ...frame.edgeBusIn }));
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
		if (frame.edgeBusShipping)
			setEdgeBusShippingState((prev) => ({
				...prev,
				...frame.edgeBusShipping,
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
			// Fan-out: checkout -> event bus -> 4 services horizontal
			return [
				{
					id: 'checkout',
					type: 'checkout',
					position: { x: 220, y: 20 },
					data: checkoutState,
				},
				{
					id: 'eventBus',
					type: 'eventBus',
					position: { x: 220, y: 150 },
					data: eventBusState,
				},
				{
					id: 'email',
					type: 'service',
					position: { x: 0, y: 300 },
					data: emailState,
				},
				{
					id: 'inventory',
					type: 'service',
					position: { x: 160, y: 300 },
					data: inventoryState,
				},
				{
					id: 'analytics',
					type: 'service',
					position: { x: 320, y: 300 },
					data: analyticsState,
				},
				{
					id: 'shipping',
					type: 'service',
					position: { x: 480, y: 300 },
					data: shippingState,
				},
			];
		}
		// Observe: vertical chain
		return [
			{
				id: 'checkout',
				type: 'checkout',
				position: { x: 220, y: 0 },
				data: checkoutState,
			},
			{
				id: 'email',
				type: 'service',
				position: { x: 230, y: 110 },
				data: emailState,
			},
			{
				id: 'inventory',
				type: 'service',
				position: { x: 230, y: 210 },
				data: inventoryState,
			},
			{
				id: 'analytics',
				type: 'service',
				position: { x: 230, y: 310 },
				data: analyticsState,
			},
			{
				id: 'shipping',
				type: 'service',
				position: { x: 230, y: 410 },
				data: shippingState,
			},
		];
	}, [
		checkoutState,
		emailState,
		inventoryState,
		analyticsState,
		shippingState,
		eventBusState,
		isReward,
	]);

	const flowEdges: Edge[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'edgeBusIn',
					source: 'checkout',
					target: 'eventBus',
					type: 'event',
					data: edgeBusInState,
				},
				{
					id: 'edgeBusEmail',
					source: 'eventBus',
					target: 'email',
					type: 'event',
					data: edgeBusEmailState,
				},
				{
					id: 'edgeBusInventory',
					source: 'eventBus',
					target: 'inventory',
					type: 'event',
					data: edgeBusInventoryState,
				},
				{
					id: 'edgeBusAnalytics',
					source: 'eventBus',
					target: 'analytics',
					type: 'event',
					data: edgeBusAnalyticsState,
				},
				{
					id: 'edgeBusShipping',
					source: 'eventBus',
					target: 'shipping',
					type: 'event',
					data: edgeBusShippingState,
				},
			];
		}
		// Observe: chain edges
		return [
			{
				id: 'edgeA',
				source: 'checkout',
				target: 'email',
				type: 'event',
				data: edgeAState,
			},
			{
				id: 'edgeB',
				source: 'email',
				target: 'inventory',
				type: 'event',
				data: edgeBState,
			},
			{
				id: 'edgeC',
				source: 'inventory',
				target: 'analytics',
				type: 'event',
				data: edgeCState,
			},
			{
				id: 'edgeD',
				source: 'analytics',
				target: 'shipping',
				type: 'event',
				data: edgeDState,
			},
		];
	}, [
		edgeAState,
		edgeBState,
		edgeCState,
		edgeDState,
		edgeBusInState,
		edgeBusEmailState,
		edgeBusInventoryState,
		edgeBusAnalyticsState,
		edgeBusShippingState,
		isReward,
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
			message: 'Domain events configured! Services are decoupled via pub/sub.',
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
							edgeTypes={eventEdgeTypes}
							nodes={flowNodes}
							nodeTypes={eventNodeTypes}
							onNodeClick={handleNodeClick}
						/>
						{inspectorData && (
							<StageInspector
								data={inspectorData}
								onClose={() => setInspectorData(null)}
							/>
						)}
					</div>
					<div className="px-6 pb-4">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Service Probe"
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
								commands={installWisperCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										CheckoutService directly calls four downstream services in
										sequence. Install a lightweight pub/sub gem that will let
										you broadcast domain events instead.
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
								outputLines={installWisperOutput}
								stepKey={stepper.currentStep}
								title="Install Event System"
							/>
						)}

						{/* OptionCard steps (1-5) */}
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
						edgeTypes={eventEdgeTypes}
						nodes={flowNodes}
						nodeTypes={eventNodeTypes}
					/>
				</div>
				<div className="px-6 pb-4">
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
							CheckoutService directly calls EmailService, InventoryService,
							AnalyticsService, and ShippingService in sequence. Each must
							finish before the next starts.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							If email is slow, everything waits. If email is down, nothing else
							runs. Adding a new service means editing CheckoutService.
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

					{/* Reward: event counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Event Bus Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Bell className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Event published, subscribers process in parallel
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Zap className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											Failed subscriber retries independently via Solid Queue
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
										<div className="text-xs text-success/70">Processed</div>
									</div>
									<div className="bg-warning/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-warning">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-warning/70">Retrying</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Domain Events"
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
					learningGoal="Domain events decouple services via pub/sub. Publishers broadcast events without knowing who listens. Each subscriber operates independently with its own retry logic, so failures and slowdowns in one service never cascade to others."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level56DomainEvents;

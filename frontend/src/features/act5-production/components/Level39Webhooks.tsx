/**
 * Level 39: Webhooks & Idempotency
 *
 * Three-phase flow: observe -> build -> reward
 *
 * Phase 1 (observe): 6-node visualization.
 *   Left column: Customer, Attacker, Stripe. Center: App Server. Right: Database, Job Queue.
 *   Probes show the full causal chain (Customer pays -> App -> Stripe -> webhook callback)
 *   and expose: forged events accepted, duplicates double-credited, sync processing timeout.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Generate webhook_events migration (terminal)
 *   Step 1: Run the migration (terminal)
 *   Step 2: Configure signature verification (option)
 *   Step 3: Configure idempotency check (option)
 *   Step 4: Configure async job processing (option)
 *   Step 5: Build the webhook handler service (option)
 *
 * Phase 3 (reward): Same 6 nodes, now with active gates.
 *   Signature gate rejects forged events. Idempotency gate catches duplicates.
 *   Valid events enqueued to background job. Fast 200 response.
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
	Globe,
	ListTodo,
	Server,
	ShieldAlert,
	User,
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
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { shuffleOptions } from '@/lib/shuffleOptions';

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface SimpleNodeState {
	label: string;
	flash: ZoneFlash;
}

interface AppVizState {
	label: string;
	flash: ZoneFlash;
	badge: string | null;
}

interface DbVizState {
	label: string;
	flash: ZoneFlash;
	rows: { text: string; color: 'default' | 'red' | 'green' }[];
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	customer?: Partial<SimpleNodeState>;
	attacker?: Partial<SimpleNodeState>;
	stripe?: Partial<SimpleNodeState>;
	app?: Partial<AppVizState>;
	db?: Partial<DbVizState>;
	queue?: Partial<SimpleNodeState>;
	/** Customer <-> App edge */
	edgeC?: Partial<EdgeVizState>;
	/** Attacker <-> App edge */
	edge0?: Partial<EdgeVizState>;
	/** Stripe <-> App edge (outbound payment + inbound webhook) */
	edge1?: Partial<EdgeVizState>;
	/** App <-> Database edge */
	edge2?: Partial<EdgeVizState>;
	/** App <-> Job Queue edge */
	edge3?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CUSTOMER: SimpleNodeState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_ATTACKER: SimpleNodeState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_STRIPE: SimpleNodeState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_APP: AppVizState = {
	label: 'Idle',
	flash: 'idle',
	badge: null,
};

const DEFAULT_DB: DbVizState = {
	label: 'Credits Table',
	flash: 'idle',
	rows: [],
};

const DEFAULT_QUEUE: SimpleNodeState = {
	label: 'No webhook jobs',
	flash: 'idle',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

const DEFAULT_DB_REWARD: DbVizState = {
	label: 'webhook_events',
	flash: 'idle',
	rows: [],
};

const DEFAULT_QUEUE_REWARD: SimpleNodeState = {
	label: 'Solid Queue',
	flash: 'idle',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'no-signature', label: 'No signature verification on webhooks' },
	{ id: 'duplicate-credit', label: 'Duplicate webhook doubles user credit' },
	{ id: 'sync-timeout', label: 'Synchronous processing risks timeout' },
	{ id: 'no-dedup', label: 'No event deduplication (event_id not tracked)' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES = [
	{
		id: 'forged-webhook',
		label: 'Attacker forges payment webhook',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "payment_intent.succeeded", "amount": 1000000}\'',
		responseLines: [
			{ text: '200 OK', color: 'yellow' as const },
			{ text: '# No Stripe-Signature header checked!', color: 'red' as const },
			{
				text: '# Anyone can POST fake events to this endpoint',
				color: 'red' as const,
			},
			{ text: '# Attacker credits themselves $10,000', color: 'red' as const },
		],
		story: [
			'A bad actor discovers the /webhooks/stripe endpoint URL.',
			'They craft a fake payment.succeeded event for $10,000.',
			'They POST it directly with curl, with no Stripe-Signature header.',
			'The naive handler accepts it and credits $10,000 to the attacker.',
		],
	},
	{
		id: 'duplicate-event',
		label: 'Stripe retries payment event (network hiccup)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"id": "evt_123", "type": "payment_intent.succeeded"}\'',
		responseLines: [
			{
				text: '# Stripe retries evt_123 (network hiccup)',
				color: 'yellow' as const,
			},
			{ text: '200 OK', color: 'yellow' as const },
			{
				text: '# User credited AGAIN for the same payment!',
				color: 'red' as const,
			},
			{
				text: '# $50 payment = $100 credit. No dedup check.',
				color: 'red' as const,
			},
		],
		story: [
			'Customer pays $50 for an order. Stripe sends payment.succeeded (evt_123).',
			'The handler processes it: credits $50 to the customer.',
			'But the 200 OK response is lost due to a network blip.',
			'Stripe thinks delivery failed and retries the same evt_123.',
			'The handler processes it AGAIN: another $50 credit.',
			'Customer now has $100 instead of $50.',
		],
	},
	{
		id: 'slow-processing',
		label: 'Monthly invoice webhook (slow handler)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "invoice.paid"}\' --max-time 25',
		responseLines: [
			{
				text: '# Processing synchronously: query user, update 12 line items, send email...',
				color: 'yellow' as const,
			},
			{
				text: '# 15 seconds elapsed... Stripe timeout is 20 seconds',
				color: 'red' as const,
			},
			{
				text: '# Stripe marks delivery failed, will retry in 1 hour',
				color: 'red' as const,
			},
			{
				text: '# Same event processed again on retry = double credit',
				color: 'red' as const,
			},
		],
		story: [
			'A business customer is invoiced monthly. Stripe sends invoice.paid.',
			'The handler processes synchronously: queries user, updates 12 line items, sends email.',
			'15 seconds pass. Stripe timeout is 20 seconds.',
			'If the handler does not respond in time, Stripe marks delivery as failed.',
			'Stripe will retry in 1 hour, risking duplicate processing.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'forged-webhook': ['no-signature'],
	'duplicate-event': ['duplicate-credit', 'no-dedup'],
	'slow-processing': ['sync-timeout'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Layout: Customer(top-left), Attacker(mid-left), Stripe(bot-left) -> App(center) -> DB(top-right), Queue(bot-right)
// Edges: edgeC=Customer<->App, edge0=Attacker<->App, edge1=App<->Stripe, edge2=App<->DB, edge3=App<->Queue

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'forged-webhook': [
		// Attacker discovers the endpoint and sends a fake event. Customer and Stripe are not involved.
		{
			attacker: { label: 'Sending forged event', flash: 'red' },
			edge0: {
				active: true,
				reverse: false,
				label: 'POST (no signature)',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Received POST...', flash: 'idle', badge: null },
			db: { label: 'Credits Table', flash: 'idle', rows: [] },
		},
		{
			app: { label: 'No signature check!', flash: 'red' },
			edge0: { active: false },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT credit $10,000',
				dotColor: 'bg-red-500',
			},
			db: { label: 'Processing...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			db: {
				label: 'Credits Table',
				flash: 'red',
				rows: [{ text: '+$10,000 (FORGED)', color: 'red' as const }],
			},
			app: { label: '200 OK', flash: 'red', badge: 'NO VERIFICATION' },
		},
		{
			attacker: { label: 'Forged event accepted!' },
			db: {
				rows: [{ text: '+$10,000 STOLEN', color: 'red' as const }],
			},
		},
	],
	'duplicate-event': [
		// Full flow: Customer pays -> App -> Stripe -> webhook callback -> double credit
		{
			customer: { label: 'Pays $50 for order', flash: 'idle' },
			edgeC: {
				active: true,
				reverse: false,
				label: 'POST /api/v1/payments',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing payment...', flash: 'idle', badge: null },
			db: { label: 'Credits Table', flash: 'idle', rows: [] },
		},
		{
			edgeC: { active: false },
			app: { label: 'Forwarding to Stripe...' },
			edge1: {
				active: true,
				reverse: false,
				label: 'POST /v1/charges ($50)',
				dotColor: 'bg-cyan-500',
			},
			stripe: { label: 'Processing charge...', flash: 'amber' },
		},
		{
			edge1: { active: false },
			stripe: { label: 'Charge succeeded', flash: 'green' },
			customer: { label: 'Waiting for confirmation...' },
			app: { label: 'Awaiting webhook...' },
		},
		{
			stripe: { label: 'Sending evt_123', flash: 'idle' },
			edge1: {
				active: true,
				reverse: true,
				label: 'payment.succeeded',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Webhook received', flash: 'idle' },
		},
		{
			edge1: { active: false },
			app: { label: 'Crediting user...', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT credit $50',
				dotColor: 'bg-cyan-500',
			},
			db: { label: 'Updating...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			db: {
				label: 'Credits Table',
				flash: 'green',
				rows: [{ text: 'credit: +$50', color: 'green' as const }],
			},
			app: { label: 'Done. Sending 200...', flash: 'green' },
		},
		// Network hiccup: 200 never reaches Stripe
		{
			stripe: { label: 'No 200 received...', flash: 'amber' },
			app: { label: '200 OK sent', flash: 'idle' },
		},
		{
			stripe: { label: 'Retrying evt_123...', flash: 'amber' },
			edge1: {
				active: true,
				reverse: true,
				label: 'payment.succeeded (RETRY)',
				dotColor: 'bg-amber-500',
			},
			app: { label: 'Webhook received again', flash: 'amber', badge: null },
		},
		{
			edge1: { active: false },
			app: { label: 'Crediting user AGAIN!', flash: 'red' },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT credit $50',
				dotColor: 'bg-red-500',
			},
			db: { label: 'Updating...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			db: {
				label: 'DOUBLE CREDIT',
				flash: 'red',
				rows: [
					{ text: 'credit: +$50', color: 'green' as const },
					{ text: 'credit: +$50 (DUPLICATE)', color: 'red' as const },
				],
			},
			app: { label: '200 OK (duplicate)', flash: 'red', badge: 'NO DEDUP' },
			customer: { label: '$100 credit instead of $50!', flash: 'red' },
		},
	],
	'slow-processing': [
		// Full flow: Customer subscribes -> App -> Stripe -> webhook callback -> slow sync processing
		{
			customer: { label: 'Subscribes to plan', flash: 'idle' },
			edgeC: {
				active: true,
				reverse: false,
				label: 'POST /api/v1/subscriptions',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Creating subscription...', flash: 'idle', badge: null },
			db: { label: 'Credits Table', flash: 'idle', rows: [] },
		},
		{
			edgeC: { active: false },
			app: { label: 'Forwarding to Stripe...' },
			edge1: {
				active: true,
				reverse: false,
				label: 'Create subscription',
				dotColor: 'bg-cyan-500',
			},
			stripe: { label: 'Processing...', flash: 'amber' },
		},
		{
			stripe: { label: 'Invoice finalized', flash: 'idle' },
			edge1: {
				active: true,
				reverse: true,
				label: 'invoice.paid (12 items)',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Webhook received', flash: 'idle' },
		},
		{
			edge1: { active: false },
			app: { label: 'Processing sync... 0s', flash: 'amber' },
			edge2: {
				active: true,
				reverse: false,
				label: 'UPDATE items * 12',
				dotColor: 'bg-amber-500',
			},
			db: { label: 'Updating 12 rows...', flash: 'amber' },
		},
		{
			app: { label: 'Sending email... 5s', flash: 'amber', badge: '5s' },
			edge2: { active: false },
			db: { label: '12 rows updated', flash: 'green', rows: [] },
		},
		{
			app: { label: 'Still processing... 10s', flash: 'amber', badge: '10s' },
			stripe: { label: 'Waiting for 200...' },
		},
		{
			app: { label: '15s elapsed...', flash: 'red', badge: 'TIMEOUT RISK' },
			stripe: { label: 'No response yet...' },
			customer: { label: 'Waiting...' },
		},
		{
			app: { label: 'Done! 200 OK (18s)', flash: 'red', badge: '18s' },
			stripe: { label: 'Close call! (timeout: 20s)', flash: 'amber' },
		},
	],
};

// ─── Reward animation frames ──────────────────────────────────────────

const REWARD_FRAMES: Record<string, AnimFrame[]> = {
	'forged-webhook': [
		// Same start: attacker sends forged event
		{
			attacker: { label: 'Sending forged event', flash: 'red' },
			edge0: {
				active: true,
				reverse: false,
				label: 'POST (no signature)',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Received POST...', flash: 'idle', badge: null },
		},
		// Divergence: signature check rejects
		{
			edge0: { active: false },
			app: {
				label: 'Verifying signature... INVALID!',
				flash: 'amber',
				badge: 'REJECTED',
			},
		},
		{
			edge0: {
				active: true,
				reverse: true,
				label: '401 Unauthorized',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Blocked at signature', flash: 'green' },
			attacker: { label: 'Rejected!' },
			db: { label: 'No changes', flash: 'idle', rows: [] },
			queue: { label: 'Solid Queue', flash: 'idle' },
		},
	],
	'duplicate-event': [
		// Same start: Customer pays, App forwards to Stripe
		{
			customer: { label: 'Pays $50 for order', flash: 'idle' },
			edgeC: {
				active: true,
				reverse: false,
				label: 'POST /api/v1/payments',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Processing payment...', flash: 'idle', badge: null },
		},
		{
			edgeC: { active: false },
			app: { label: 'Forwarding to Stripe...' },
			edge1: {
				active: true,
				reverse: false,
				label: 'POST /v1/charges ($50)',
				dotColor: 'bg-cyan-500',
			},
			stripe: { label: 'Processing charge...', flash: 'amber' },
		},
		{
			stripe: { label: 'Sending evt_123', flash: 'idle' },
			edge1: {
				active: true,
				reverse: true,
				label: 'payment.succeeded',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Signature verified', flash: 'green' },
		},
		// Divergence: dedup check + async processing
		{
			edge1: { active: false },
			app: { label: 'Checking dedup...' },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT evt_123 (new)',
				dotColor: 'bg-emerald-500',
			},
			db: { label: 'webhook_events', flash: 'amber', rows: [] },
		},
		{
			edge2: { active: false },
			db: {
				label: 'webhook_events',
				flash: 'green',
				rows: [{ text: 'evt_123: pending', color: 'green' as const }],
			},
			app: { label: 'Enqueueing job', flash: 'green' },
			edge3: {
				active: true,
				reverse: false,
				label: 'perform_later',
				dotColor: 'bg-emerald-500',
			},
			queue: { label: 'Enqueued', flash: 'green' },
		},
		{
			edge3: { active: false },
			app: { label: '200 OK (<50ms)', flash: 'green', badge: '<50ms' },
			stripe: { label: 'No 200 received...', flash: 'amber' },
		},
		// Stripe retries - dedup catches it
		{
			stripe: { label: 'Retrying evt_123...', flash: 'amber' },
			edge1: {
				active: true,
				reverse: true,
				label: 'payment.succeeded (RETRY)',
				dotColor: 'bg-amber-500',
			},
			app: { label: 'Signature verified', flash: 'green', badge: null },
		},
		{
			edge1: { active: false },
			app: { label: 'Checking dedup...' },
			edge2: {
				active: true,
				reverse: false,
				label: 'SELECT evt_123',
				dotColor: 'bg-amber-500',
			},
			db: { label: 'Checking...', flash: 'amber' },
		},
		{
			edge2: { active: false },
			db: {
				label: 'webhook_events',
				flash: 'green',
				rows: [{ text: 'evt_123: completed (skip!)', color: 'green' as const }],
			},
			app: {
				label: 'Already processed! 200 OK',
				flash: 'green',
				badge: 'DEDUP',
			},
			stripe: { label: 'Retry acknowledged', flash: 'green' },
			customer: { label: 'Exactly $50 credit', flash: 'green' },
		},
	],
	'slow-processing': [
		// Same start: Customer subscribes, App forwards to Stripe
		{
			customer: { label: 'Subscribes to plan', flash: 'idle' },
			edgeC: {
				active: true,
				reverse: false,
				label: 'POST /api/v1/subscriptions',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Creating subscription...', flash: 'idle', badge: null },
		},
		{
			edgeC: { active: false },
			app: { label: 'Forwarding to Stripe...' },
			edge1: {
				active: true,
				reverse: false,
				label: 'Create subscription',
				dotColor: 'bg-cyan-500',
			},
			stripe: { label: 'Processing...', flash: 'amber' },
		},
		{
			stripe: { label: 'Invoice finalized', flash: 'idle' },
			edge1: {
				active: true,
				reverse: true,
				label: 'invoice.paid (12 items)',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Signature verified', flash: 'green' },
		},
		// Divergence: async processing instead of sync
		{
			edge1: { active: false },
			app: { label: 'Event stored' },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT webhook_event',
				dotColor: 'bg-emerald-500',
			},
			db: {
				label: 'webhook_events',
				flash: 'amber',
				rows: [],
			},
		},
		{
			edge2: { active: false },
			db: {
				flash: 'green',
				rows: [{ text: 'evt_789: pending', color: 'green' as const }],
			},
			app: { label: 'Enqueueing job', flash: 'green' },
			edge3: {
				active: true,
				reverse: false,
				label: 'perform_later',
				dotColor: 'bg-emerald-500',
			},
			queue: { label: 'Processing 12 items...', flash: 'green' },
		},
		{
			edge3: { active: false },
			app: { label: '200 OK (<50ms!)', flash: 'green', badge: '<50ms' },
			stripe: { label: 'Acknowledged instantly', flash: 'green' },
			customer: { label: 'Subscription active', flash: 'green' },
		},
		{
			queue: { label: 'Completed', flash: 'green' },
			db: {
				rows: [{ text: 'evt_789: completed', color: 'green' as const }],
			},
		},
	],
	'valid-subscription': [
		{
			stripe: { label: 'subscription.created', flash: 'idle' },
			edge1: {
				active: true,
				reverse: true,
				label: 'subscription.created',
				dotColor: 'bg-cyan-500',
			},
			app: { label: 'Signature verified', flash: 'green', badge: null },
		},
		{
			edge1: { active: false },
			app: { label: 'New event' },
			edge2: {
				active: true,
				reverse: false,
				label: 'INSERT evt_456',
				dotColor: 'bg-emerald-500',
			},
			db: {
				label: 'webhook_events',
				flash: 'amber',
				rows: [],
			},
		},
		{
			edge2: { active: false },
			db: {
				flash: 'green',
				rows: [{ text: 'evt_456: pending', color: 'green' as const }],
			},
			edge3: {
				active: true,
				reverse: false,
				label: 'perform_later',
				dotColor: 'bg-emerald-500',
			},
			queue: { label: 'Enqueued', flash: 'green' },
			app: { label: '200 OK', flash: 'green' },
		},
	],
	'bad-payload': [
		{
			attacker: { label: 'Garbled payload', flash: 'red' },
			edge0: {
				active: true,
				reverse: false,
				label: 'POST (malformed JSON)',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Parsing...', flash: 'idle', badge: null },
		},
		{
			edge0: { active: false },
			app: {
				label: 'JSON::ParserError!',
				flash: 'red',
				badge: 'BAD REQUEST',
			},
		},
		{
			edge0: {
				active: true,
				reverse: true,
				label: '400 Bad Request',
				dotColor: 'bg-red-500',
			},
			app: { label: 'Blocked at parse', flash: 'green' },
			attacker: { label: 'Rejected' },
			db: { label: 'No changes', flash: 'idle', rows: [] },
			queue: { label: 'Solid Queue', flash: 'idle' },
		},
	],
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'generate-migration', title: 'Generate Events Table' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'configure-signature', title: 'Verify Signature' },
	{ id: 'configure-idempotency', title: 'Check Idempotency' },
	{ id: 'configure-async', title: 'Process Asynchronously' },
	{ id: 'build-service', title: 'Build Webhook Service' },
];

const GENERATE_MIGRATION_COMMANDS = [
	{
		id: 'wrong-no-index',
		label: 'rails g migration CreateWebhookEvents provider event_id event_type',
		command:
			'rails g migration CreateWebhookEvents provider event_id event_type',
		correct: false,
		feedback:
			'Without a unique index on [provider, event_id], race conditions between concurrent webhooks can insert duplicates before your code checks.',
	},
	{
		id: 'correct',
		label:
			'rails g migration CreateWebhookEvents provider:string event_id:string event_type:string payload:jsonb status:string processed_at:datetime',
		command:
			'rails g migration CreateWebhookEvents provider:string event_id:string event_type:string payload:jsonb status:string processed_at:datetime',
		correct: true,
	},
	{
		id: 'wrong-wrong-columns',
		label: 'rails g migration CreateWebhookLogs url method response_code',
		command: 'rails g migration CreateWebhookLogs url method response_code',
		correct: false,
		feedback:
			'This tracks outgoing HTTP requests, not incoming webhook events. You need to store the event ID from the provider for deduplication.',
	},
];

const RUN_MIGRATION_COMMANDS = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed loads seed data. The migration file still needs to be applied to create the webhook_events table.',
	},
	{
		id: 'wrong-reset',
		label: 'rails db:reset',
		command: 'rails db:reset',
		correct: false,
		feedback:
			'db:reset drops and recreates the entire database. You only need to apply the new migration, not destroy existing data.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const CONFIGURE_SIGNATURE_OPTIONS = [
	{
		id: 'wrong-json-parse',
		label: 'Parse JSON body directly (no verification)',
		code: `def create
  event = JSON.parse(request.body.read)
  # Trust the payload as-is
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'Without signature verification, anyone can POST fake webhook events. The payload must be verified against a cryptographic signature before processing.',
	},
	{
		id: 'wrong-manual-hmac',
		label: 'Compare raw HMAC manually',
		code: `def create
  payload = request.body.read
  expected = OpenSSL::HMAC.hexdigest(
    'sha256', ENV['STRIPE_SECRET'], payload)
  if request.headers['Stripe-Signature'] != expected
    return head :unauthorized
  end
  event = JSON.parse(payload)
end`,
		correct: false,
		feedback:
			'Stripe signatures use a timestamp-based scheme (t=...,v1=...) to prevent replay attacks. Manual HMAC comparison misses the timestamp check and is vulnerable to replay.',
	},
	{
		id: 'correct',
		label: 'Verify HMAC signature via Stripe gem',
		code: `def create
  payload = request.body.read
  sig_header = request.headers['Stripe-Signature']

  begin
    event = Stripe::Webhook.construct_event(
      payload, sig_header,
      Rails.application.credentials.stripe[:webhook_secret]
    )
  rescue JSON::ParserError
    return head :bad_request
  rescue Stripe::SignatureVerificationError
    return head :unauthorized
  end
  # event is now verified authentic
end`,
		correct: true,
	},
];

const CONFIGURE_IDEMPOTENCY_OPTIONS = [
	{
		id: 'wrong-memory-set',
		label: 'Track event IDs in a Set (in memory)',
		code: `@@processed_ids = Set.new

def create
  # ...signature verification...
  return head :ok if @@processed_ids.include?(event.id)
  @@processed_ids.add(event.id)
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'In-memory sets are lost on restart and not shared across processes. Multiple Puma workers would each have their own set, missing duplicates handled by other workers.',
	},
	{
		id: 'wrong-find-by',
		label: 'Check with find_by before creating',
		code: `def create
  # ...signature verification...
  return head :ok if WebhookEvent.find_by(
    provider: 'stripe', event_id: event.id)

  WebhookEvent.create!(
    provider: 'stripe', event_id: event.id,
    event_type: event.type, payload: event.data.to_h,
    status: 'pending')
  process_event(event)
  head :ok
end`,
		correct: false,
		feedback:
			'find_by + create has a race condition. Two concurrent requests can both pass the find_by check before either inserts. You need an atomic operation backed by a database constraint.',
	},
	{
		id: 'correct',
		label: 'Atomic find_or_create_by with unique index',
		code: `def create
  # ...signature verification...
  webhook_event = WebhookEvent.create_with(
    event_type: event.type,
    payload: event.data.to_h,
    status: 'pending'
  ).find_or_create_by!(
    provider: 'stripe', event_id: event.id
  )

  # Already processed? Tell Stripe to stop retrying
  return head :ok if webhook_event.completed?
end`,
		correct: true,
	},
];

const CONFIGURE_ASYNC_OPTIONS = [
	{
		id: 'wrong-sync',
		label: 'Process synchronously in the controller',
		code: `# After idempotency check:
case webhook_event.event_type
when 'payment_intent.succeeded'
  payment = Payment.find_by!(stripe_id: data['id'])
  payment.update!(status: 'completed')
  payment.user.credits.create!(amount: data['amount'])
  UserMailer.payment_confirmed(payment).deliver_now
end
webhook_event.update!(status: 'completed')
head :ok`,
		correct: false,
		feedback:
			'Synchronous processing (DB queries, email sending) can take 10-20 seconds. Stripe times out at 20 seconds and retries, causing duplicate processing.',
	},
	{
		id: 'correct',
		label: 'Enqueue background job, return 200 immediately',
		code: `# After idempotency check:
ProcessStripeWebhookJob.perform_later(webhook_event.id)
head :ok

# Job handles the heavy lifting:
# - Update payment status
# - Create credits (idempotent with key)
# - Send confirmation email
# - Mark webhook_event as completed`,
		correct: true,
	},
	{
		id: 'wrong-thread',
		label: 'Spawn a thread for processing',
		code: `# After idempotency check:
Thread.new do
  process_webhook_event(webhook_event)
end
head :ok`,
		correct: false,
		feedback:
			'Raw threads have no retry logic, no error tracking, no persistence. If the thread crashes, the event is lost. Background jobs (Solid Queue) handle all of this.',
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-controller-logic',
		label: 'All logic in the controller action',
		code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      payload = request.body.read
      sig = request.headers['Stripe-Signature']
      event = Stripe::Webhook.construct_event(
        payload, sig, credentials[:webhook_secret])
      webhook_event = WebhookEvent.create_with(
        event_type: event.type, payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe', event_id: event.id)
      return head :ok if webhook_event.completed?
      ProcessStripeWebhookJob.perform_later(webhook_event.id)
      head :ok
    rescue Stripe::SignatureVerificationError
      head :unauthorized
    end
  end
end`,
		correct: false,
		feedback:
			'Keeping all webhook logic in the controller violates the pattern established in earlier levels. Complex multi-step operations belong in a dedicated object.',
	},
	{
		id: 'correct',
		label: 'Service with contract, dedup, and async dispatch',
		code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-dedup-service',
		label: 'Service without idempotency check',
		code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])

    webhook_event = WebhookEvent.create!(
      provider: 'stripe', event_id: event.id,
      event_type: event.type, payload: event.data.to_h)

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  end
end`,
		correct: false,
		feedback:
			'create! raises an exception on duplicate event_id (unique index constraint), but does not gracefully handle already-processed events. You need an atomic upsert pattern instead.',
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: GENERATE_MIGRATION_COMMANDS,
		outputLines: [
			{
				text: 'create  db/migrate/20260315_create_webhook_events.rb',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RUN_MIGRATION_COMMANDS,
		outputLines: [
			{
				text: '== CreateWebhookEvents: migrating ============================',
				color: 'cyan' as const,
			},
			{
				text: '-- create_table(:webhook_events)',
				color: 'green' as const,
			},
			{
				text: '== CreateWebhookEvents: migrated (0.0042s) ===================',
				color: 'green' as const,
			},
		],
	},
	null, // configure-signature: OptionCard
	null, // configure-idempotency: OptionCard
	null, // configure-async: OptionCard
	null, // build-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'forged-webhook',
		label: 'Attacker forges payment webhook (with verification)',
		description: 'No valid Stripe-Signature header, rejected at signature gate',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '401 Unauthorized', color: 'red' },
			{ text: '# Stripe-Signature missing or invalid', color: 'red' },
			{ text: '# Blocked at HMAC verification', color: 'muted' },
		],
		story: [
			'Same attacker sends the same forged payment.succeeded event.',
			'But now the handler verifies the HMAC-SHA256 signature first.',
			'No valid Stripe-Signature header found.',
			'Handler returns 401 Unauthorized immediately. Nothing processed.',
		],
	},
	{
		id: 'duplicate-event',
		label: 'Stripe retries payment event (with dedup)',
		description: 'Same event_id already processed, returns 200 and skips',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '# evt_123: already in webhook_events (completed)',
				color: 'muted',
			},
			{ text: '# Duplicate skipped. No reprocessing.', color: 'green' },
		],
		story: [
			'Same customer, same $50 payment, same network hiccup.',
			'First delivery: evt_123 verified, stored in webhook_events, job enqueued.',
			'Stripe retries evt_123 after the network blip.',
			'Handler checks webhook_events: evt_123 already exists, status: completed.',
			'Returns 200 OK immediately. No duplicate processing.',
		],
	},
	{
		id: 'slow-processing',
		label: 'Monthly invoice webhook (with async)',
		description: 'Event verified, stored, and enqueued in <50ms',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK (47ms)', color: 'green' },
			{
				text: '# Signature verified, event stored, job enqueued',
				color: 'muted',
			},
			{ text: '# 12 line items processed in background', color: 'green' },
		],
		story: [
			'Same monthly invoice, same 12 line items.',
			'But now the handler verifies, stores the event, and enqueues a job.',
			'Returns 200 OK in under 50 milliseconds.',
			'The background job processes the 12 line items at its own pace.',
			'If the job fails, it retries automatically. Stripe never needs to retry.',
		],
	},
	{
		id: 'valid-subscription',
		label: 'Valid subscription webhook (new event)',
		description: 'Authentic webhook, new event, full pipeline',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: '# subscription.created verified and enqueued', color: 'green' },
		],
		story: [
			'A new customer subscribes to a plan.',
			'Stripe sends a subscription.created webhook.',
			'Signature verified, new event stored, job enqueued.',
			'Full pipeline working as designed.',
		],
	},
	{
		id: 'bad-payload',
		label: 'Malformed JSON payload (rejected)',
		description: 'Garbled payload fails JSON parsing, 400 Bad Request',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '400 Bad Request', color: 'red' },
			{ text: '# JSON::ParserError raised', color: 'red' },
			{ text: '# Blocked before signature verification', color: 'muted' },
		],
		story: [
			'A garbled payload arrives at the webhook endpoint.',
			'JSON parsing fails before signature verification even begins.',
			'Handler returns 400 Bad Request. Nothing processed.',
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
				filename: 'app/controllers/webhooks_controller.rb',
				language: 'ruby',
				code: `class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    result = HandleStripeWebhook.call(
      payload: request.body.read)

    head :ok
  end
end`,
			},
			{
				filename: 'app/services/handle_stripe_webhook.rb',
				language: 'ruby',
				code: `class HandleStripeWebhook < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def initialize(payload:)
    @payload = payload
  end

  def call
    event = JSON.parse(@payload)
    # No signature verification! Anyone can spoof!

    case event['type']
    when 'payment_intent.succeeded'
      payment = Payment.find_by(
        stripe_id: event['data']['object']['id'])
      payment.mark_completed!
      payment.user.credits.create!(
        amount: payment.amount)
      # Duplicate webhook = duplicate credit!
    end

    Result.new(success?: true, resource: nil, errors: {})
    # No idempotency check, no async processing
    # Stripe times out at 20s, retries up to 7 times
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'db/migrate/create_webhook_events.rb',
				language: 'ruby',
				code: `class CreateWebhookEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :webhook_events do |t|
      t.string :provider, null: false
      t.string :event_id, null: false
      t.string :event_type, null: false
      t.jsonb :payload
      t.string :status, default: 'pending'
      t.datetime :processed_at
      t.timestamps
    end

    add_index :webhook_events,
      [:provider, :event_id], unique: true
  end
end${completedStep >= 1 ? '\n# Migration applied. Table created.' : ''}`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'app/controllers/webhooks/stripe_controller.rb',
				language: 'ruby',
				code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      payload = request.body.read
      sig_header = request.headers['Stripe-Signature']

      event = Stripe::Webhook.construct_event(
        payload, sig_header,
        Rails.application.credentials.stripe[:webhook_secret]
      )
      # Signature verified!${
				completedStep >= 3
					? `

      webhook_event = WebhookEvent.create_with(
        event_type: event.type,
        payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe', event_id: event.id)

      return head :ok if webhook_event.completed?`
					: '\n      # Next: idempotency check...'
			}${
				completedStep >= 4
					? `

      ProcessStripeWebhookJob.perform_later(
        webhook_event.id)
      head :ok`
					: completedStep >= 3
						? '\n      # Next: async processing...'
						: ''
			}
    rescue JSON::ParserError
      head :bad_request
    rescue Stripe::SignatureVerificationError
      head :unauthorized
    end
  end
end`,
			});
		}

		if (completedStep >= 5) {
			files.push({
				filename: 'app/services/ingest_stripe_webhook.rb',
				language: 'ruby',
				code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'db/migrate/create_webhook_events.rb',
				language: 'ruby',
				code: '# Step 1: Generate the webhook_events migration...',
			});
		}

		return files;
	}

	// reward: full solution
	return [
		{
			filename: 'app/services/ingest_stripe_webhook.rb',
			language: 'ruby',
			code: `class IngestStripeWebhook < ApplicationService
  Result = Data.define(:success?, :webhook_event, :errors)

  def initialize(payload:, signature:)
    @payload = payload
    @signature = signature
  end

  def call
    event = verify_signature!
    webhook_event = deduplicate!(event)
    return Result.new(success?: true,
      webhook_event:, errors: []) if webhook_event.completed?

    ProcessStripeWebhookJob.perform_later(webhook_event.id)
    Result.new(success?: true, webhook_event:, errors: [])
  rescue Stripe::SignatureVerificationError
    Result.new(success?: false, webhook_event: nil,
      errors: { signature: ["Invalid signature"] })
  rescue JSON::ParserError
    Result.new(success?: false, webhook_event: nil,
      errors: { payload: ["Malformed JSON"] })
  end

  private

  def verify_signature!
    Stripe::Webhook.construct_event(
      @payload, @signature,
      Rails.application.credentials.stripe[:webhook_secret])
  end

  def deduplicate!(event)
    WebhookEvent.create_with(
      event_type: event.type,
      payload: event.data.to_h,
      status: 'pending'
    ).find_or_create_by!(
      provider: 'stripe', event_id: event.id)
  end
end`,
		},
		{
			filename: 'app/controllers/webhooks/stripe_controller.rb',
			language: 'ruby',
			code: `module Webhooks
  class StripeController < ApplicationController
    skip_before_action :verify_authenticity_token

    def create
      result = IngestStripeWebhook.call(
        payload: request.body.read,
        signature: request.headers['Stripe-Signature']
      )

      if result.success?
        head :ok
      else
        head :unauthorized
      end
    end
  end
end`,
		},
		{
			filename: 'app/jobs/process_stripe_webhook_job.rb',
			language: 'ruby',
			code: `class ProcessStripeWebhookJob < ApplicationJob
  queue_as :webhooks
  retry_on StandardError,
    wait: :polynomially_longer, attempts: 5

  def perform(webhook_event_id)
    webhook_event = WebhookEvent.find(webhook_event_id)
    return if webhook_event.completed?

    webhook_event.update!(status: 'processing')

    case webhook_event.event_type
    when 'payment_intent.succeeded'
      handle_payment_succeeded(webhook_event)
    when 'customer.subscription.created'
      handle_subscription_created(webhook_event)
    when 'charge.refunded'
      handle_refund(webhook_event)
    end

    webhook_event.update!(
      status: 'completed', processed_at: Time.current)
  rescue => e
    webhook_event.update!(status: 'failed')
    raise  # Re-raise so job retries
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

// ── Customer node ──

interface CustomerNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const WebhookCustomerNode = memo(({ data }: { data: CustomerNodeData }) => {
	const d = data as CustomerNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-36 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<User className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Customer</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

// ── Attacker node ──

interface AttackerNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const WebhookAttackerNode = memo(({ data }: { data: AttackerNodeData }) => {
	const d = data as AttackerNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-36 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
				<span className="text-xs font-semibold text-foreground">Attacker</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

// ── Stripe node ──

interface StripeNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const WebhookStripeNode = memo(({ data }: { data: StripeNodeData }) => {
	const d = data as StripeNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-36 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Globe className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Stripe</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

// ── App Server node ──

interface AppNodeData extends AppVizState {
	[key: string]: unknown;
}

const WebhookAppNode = memo(({ data }: { data: AppNodeData }) => {
	const d = data as AppNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-48 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Server className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Rails App</span>
				{d.badge && (
					<Badge
						className={`text-xs ml-auto ${
							d.badge === '<50ms' || d.badge === 'DEDUP'
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
		</div>
	);
});

// ── Database node ──

interface DbNodeData extends DbVizState {
	[key: string]: unknown;
}

const WebhookDbNode = memo(({ data }: { data: DbNodeData }) => {
	const d = data as DbNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-44 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Database className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground truncate">
					{d.label}
				</span>
			</div>
			{d.rows.length > 0 && (
				<div className="space-y-0.5 mt-1">
					{d.rows.map((row, i) => (
						<div
							className={`text-xs font-mono px-1.5 py-0.5 rounded ${
								row.color === 'red'
									? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
									: row.color === 'green'
										? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
										: 'bg-muted text-muted-foreground'
							}`}
							key={`${row.text}-${i}`}
						>
							{row.text}
						</div>
					))}
				</div>
			)}
		</div>
	);
});

// ── Job Queue node ──

interface QueueNodeData extends SimpleNodeState {
	[key: string]: unknown;
}

const WebhookQueueNode = memo(({ data }: { data: QueueNodeData }) => {
	const d = data as QueueNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-40 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<ListTodo className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Job Queue</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

// ── Custom edge ──

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface WebhookEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const WebhookEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as WebhookEdgeData;
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

// ── Node and edge type registries (stable module-scope references) ──

const webhookNodeTypes = {
	customer: WebhookCustomerNode,
	attacker: WebhookAttackerNode,
	stripe: WebhookStripeNode,
	app: WebhookAppNode,
	db: WebhookDbNode,
	queue: WebhookQueueNode,
};
const webhookEdgeTypes = { webhook: WebhookEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level39Webhooks({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Visualization state ──
	const [customerState, setCustomerState] =
		useState<SimpleNodeState>(DEFAULT_CUSTOMER);
	const [attackerState, setAttackerState] =
		useState<SimpleNodeState>(DEFAULT_ATTACKER);
	const [stripeState, setStripeState] =
		useState<SimpleNodeState>(DEFAULT_STRIPE);
	const [appState, setAppState] = useState<AppVizState>(DEFAULT_APP);
	const [dbState, setDbState] = useState<DbVizState>(DEFAULT_DB);
	const [queueState, setQueueState] = useState<SimpleNodeState>(DEFAULT_QUEUE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge0State, setEdge0State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge1State, setEdge1State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge2State, setEdge2State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edge3State, setEdge3State] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setCustomerState(DEFAULT_CUSTOMER);
		setAttackerState(DEFAULT_ATTACKER);
		setStripeState(DEFAULT_STRIPE);
		setAppState(DEFAULT_APP);
		setDbState(isReward ? DEFAULT_DB_REWARD : DEFAULT_DB);
		setQueueState(isReward ? DEFAULT_QUEUE_REWARD : DEFAULT_QUEUE);
		setEdgeCState(DEFAULT_EDGE);
		setEdge0State(DEFAULT_EDGE);
		setEdge1State(DEFAULT_EDGE);
		setEdge2State(DEFAULT_EDGE);
		setEdge3State(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.customer)
			setCustomerState((prev) => ({ ...prev, ...frame.customer }));
		if (frame.attacker)
			setAttackerState((prev) => ({ ...prev, ...frame.attacker }));
		if (frame.stripe) setStripeState((prev) => ({ ...prev, ...frame.stripe }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.db) setDbState((prev) => ({ ...prev, ...frame.db }));
		if (frame.queue) setQueueState((prev) => ({ ...prev, ...frame.queue }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
		if (frame.edge0) setEdge0State((prev) => ({ ...prev, ...frame.edge0 }));
		if (frame.edge1) setEdge1State((prev) => ({ ...prev, ...frame.edge1 }));
		if (frame.edge2) setEdge2State((prev) => ({ ...prev, ...frame.edge2 }));
		if (frame.edge3) setEdge3State((prev) => ({ ...prev, ...frame.edge3 }));
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
			// Stop all edge dots after last frame
			const tCleanup = setTimeout(() => {
				setEdgeCState((prev) => ({ ...prev, active: false }));
				setEdge0State((prev) => ({ ...prev, active: false }));
				setEdge1State((prev) => ({ ...prev, active: false }));
				setEdge2State((prev) => ({ ...prev, active: false }));
				setEdge3State((prev) => ({ ...prev, active: false }));
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
			// 6 nodes + 5 edges. Use 2.5x speed. Duplicate probe has most frames (3x).
			const delay =
				probeId === 'duplicate-event'
					? ANIMATION_DURATION_MS * 3
					: ANIMATION_DURATION_MS * 2.5;
			if (frames) runAnimation(frames, undefined, delay);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof CONFIGURE_SIGNATURE_OPTIONS> = {
				2: CONFIGURE_SIGNATURE_OPTIONS,
				3: CONFIGURE_IDEMPOTENCY_OPTIONS,
				4: CONFIGURE_ASYNC_OPTIONS,
				5: BUILD_SERVICE_OPTIONS,
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
				setCustomerState(DEFAULT_CUSTOMER);
				setAttackerState(DEFAULT_ATTACKER);
				setStripeState(DEFAULT_STRIPE);
				setAppState(DEFAULT_APP);
				setDbState(DEFAULT_DB_REWARD);
				setQueueState(DEFAULT_QUEUE_REWARD);
				setEdgeCState(DEFAULT_EDGE);
				setEdge0State(DEFAULT_EDGE);
				setEdge1State(DEFAULT_EDGE);
				setEdge2State(DEFAULT_EDGE);
				setEdge3State(DEFAULT_EDGE);
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
		return {
			valid: true,
			message: 'Webhook handler is secure and idempotent!',
		};
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
	// Layout: 6 nodes
	// Left column: Customer(top), Attacker(mid), Stripe(bottom)
	// Center: App Server
	// Right column: Database(top), Job Queue(bottom)
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'customer',
				type: 'customer',
				position: { x: 0, y: 0 },
				data: { ...customerState } satisfies CustomerNodeData,
			},
			{
				id: 'attacker',
				type: 'attacker',
				position: { x: 0, y: 80 },
				data: { ...attackerState } satisfies AttackerNodeData,
			},
			{
				id: 'stripe',
				type: 'stripe',
				position: { x: 0, y: 160 },
				data: { ...stripeState } satisfies StripeNodeData,
			},
			{
				id: 'app',
				type: 'app',
				position: { x: 260, y: 60 },
				data: { ...appState } satisfies AppNodeData,
			},
			{
				id: 'db',
				type: 'db',
				position: { x: 530, y: 10 },
				data: { ...dbState } satisfies DbNodeData,
			},
			{
				id: 'queue',
				type: 'queue',
				position: { x: 530, y: 140 },
				data: { ...queueState } satisfies QueueNodeData,
			},
		],
		[customerState, attackerState, stripeState, appState, dbState, queueState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-customer-app',
				source: 'customer',
				target: 'app',
				type: 'webhook',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edgeCState } satisfies WebhookEdgeData,
			},
			{
				id: 'e-attacker-app',
				source: 'attacker',
				target: 'app',
				type: 'webhook',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge0State } satisfies WebhookEdgeData,
			},
			{
				id: 'e-app-stripe',
				source: 'app',
				target: 'stripe',
				type: 'webhook',
				sourceHandle: 'left-source',
				targetHandle: 'right-target',
				data: { ...edge1State } satisfies WebhookEdgeData,
			},
			{
				id: 'e-app-db',
				source: 'app',
				target: 'db',
				type: 'webhook',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edge2State } satisfies WebhookEdgeData,
			},
			{
				id: 'e-app-queue',
				source: 'app',
				target: 'queue',
				type: 'webhook',
				sourceHandle: 'bottom-source',
				targetHandle: 'left-target',
				data: { ...edge3State } satisfies WebhookEdgeData,
			},
		],
		[edgeCState, edge0State, edge1State, edge2State, edge3State],
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
		const stepOptions: Record<number, typeof CONFIGURE_SIGNATURE_OPTIONS> = {
			2: CONFIGURE_SIGNATURE_OPTIONS,
			3: CONFIGURE_IDEMPOTENCY_OPTIONS,
			4: CONFIGURE_ASYNC_OPTIONS,
			5: BUILD_SERVICE_OPTIONS,
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
							In Level 38, your app learned to call Stripe reliably. But
							payments are asynchronous: Stripe processes the charge and then
							notifies your app by sending an HTTP POST to your /webhooks/stripe
							endpoint. This inbound callback is called a webhook.
						</p>
						<p className="text-sm text-muted-foreground">
							A naive webhook handler was added to receive these events. Stripe
							fired a payment.succeeded webhook and your handler credited the
							user $50. A network hiccup caused Stripe to retry the same event.
							Your handler credited another $50. User now has $100 instead of
							$50.
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
							Build a secure, idempotent webhook handler: verify signatures,
							deduplicate events, and process asynchronously.
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
								Verified and processed
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-amber-500" />
							<span className="text-muted-foreground">
								Deduplicated (skipped)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">
								Blocked (forged/malformed)
							</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Processed</div>
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
							edgeTypes={webhookEdgeTypes}
							nodes={flowNodes}
							nodeTypes={webhookNodeTypes}
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
										'Create a table to store webhook event IDs for deduplication. Include a unique index on [provider, event_id] to prevent race conditions.'}
									{stepper.currentStep === 1 &&
										'Apply the migration to create the webhook_events table in the database.'}
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
									'How should the controller verify that a webhook is authentically from Stripe?'}
								{stepper.currentStep === 3 &&
									'How should the handler prevent processing the same event twice?'}
								{stepper.currentStep === 4 &&
									'How should the handler process the webhook payload after verification and dedup?'}
								{stepper.currentStep === 5 &&
									'Where should the webhook ingestion logic live?'}
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
						edgeTypes={webhookEdgeTypes}
						nodes={flowNodes}
						nodesDraggable={false}
						nodeTypes={webhookNodeTypes}
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
					levelName="Webhooks & Idempotency"
					levelNumber={39}
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
					learningGoal="Webhooks need signature verification (HMAC), idempotency (event dedup), and async processing (background jobs)."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level39Webhooks;

/**
 * Level 38: External APIs (Resilient Integration)
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): "Thread Pool Drain" React Flow visualization.
 *   AppServerNode (large, left) with thread pool bars + StripeNode (compact, right).
 *   Probes show requests hanging, 503 errors, and cascade failure.
 *   The thread pool visually drains as requests block.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Install Faraday, install Stoplight, configure timeout, retry, circuit breaker,
 *   build the payment service.
 *
 * Phase 3 (ADVANTAGE - reward): Same 2 nodes, but App node expands with
 *   middleware sub-panels (timeout, retry, circuit breaker) inside it.
 *   Stress test replays observe flows with fix applied.
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
	Globe,
	Monitor,
	RefreshCw,
	Server,
	Timer,
	Unplug,
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

// ─── Types ────────────────────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface ClientVizState {
	label: string;
	flash: ZoneFlash;
}

interface AppServerVizState {
	label: string;
	flash: ZoneFlash;
	threads: ('available' | 'blocked' | 'freed')[];
	queueLabel: string | null;
	// Middleware sub-panels (reward only)
	timeoutLabel: string | null;
	timeoutFlash: ZoneFlash;
	retryLabel: string | null;
	retryFlash: ZoneFlash;
	circuitLabel: string | null;
	circuitFlash: ZoneFlash;
}

interface StripeVizState {
	label: string;
	flash: ZoneFlash;
	status: string;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	client?: Partial<ClientVizState>;
	app?: Partial<AppServerVizState>;
	stripe?: Partial<StripeVizState>;
	/** Client <-> App edge */
	edge?: Partial<EdgeVizState>;
	/** App <-> Stripe edge */
	edgeB?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const THREAD_KEYS = ['t1', 't2', 't3', 't4', 't5'];

const DEFAULT_THREADS: AppServerVizState['threads'] = [
	'available',
	'available',
	'available',
	'available',
	'available',
];

const DEFAULT_CLIENT: ClientVizState = {
	label: 'Idle',
	flash: 'idle',
};

const DEFAULT_APP: AppServerVizState = {
	label: 'Idle',
	flash: 'idle',
	threads: [...DEFAULT_THREADS],
	queueLabel: null,
	timeoutLabel: null,
	timeoutFlash: 'idle',
	retryLabel: null,
	retryFlash: 'idle',
	circuitLabel: null,
	circuitFlash: 'idle',
};

const DEFAULT_STRIPE: StripeVizState = {
	label: 'Idle',
	flash: 'idle',
	status: 'Healthy',
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-cyan-500',
};

const DEFAULT_APP_REWARD: AppServerVizState = {
	...DEFAULT_APP,
	timeoutLabel: '10s limit',
	timeoutFlash: 'green',
	retryLabel: '3x backoff',
	retryFlash: 'green',
	circuitLabel: 'CLOSED',
	circuitFlash: 'green',
};

// ─── Discovery definitions ─────────────────────────────────────────────

const DISCOVERY_DEFS = [
	{ id: 'no-timeout', label: 'No timeout on HTTP requests' },
	{ id: 'thread-blocking', label: 'Slow API blocks Puma threads' },
	{ id: 'no-retry', label: 'Transient errors not retried' },
	{ id: 'cascade-failure', label: 'One failing API takes down entire app' },
];

// ─── Probe definitions ─────────────────────────────────────────────────

const PROBES = [
	{
		id: 'slow-stripe',
		label: 'POST create payment (slow response)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 5000}\'',
		responseLines: [
			{ text: '# Waiting... 10s... 20s... 30s...', color: 'yellow' as const },
			{
				text: '# Thread blocked. No timeout configured.',
				color: 'red' as const,
			},
			{ text: '504 Gateway Timeout (after 30 seconds)', color: 'red' as const },
			{
				text: '# Puma thread wasted for 30 seconds on a single request',
				color: 'red' as const,
			},
		],
		story: [
			'Customer clicks "Pay Now" for a $50.00 Laptop Pro.',
			'Stripe is running slow today, taking 15+ seconds to respond.',
			'No timeout is configured, so the Puma thread just waits.',
			'One of your 5 threads is blocked for 30 seconds on a single request.',
			'Customer sees a loading spinner the whole time, then a 504 error.',
		],
	},
	{
		id: 'stripe-503',
		label: 'GET check payment status (Stripe 503)',
		command: 'curl localhost:3000/api/v1/payments/ch_abc/status',
		responseLines: [
			{ text: '503 Service Unavailable', color: 'red' as const },
			{
				text: '{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Stripe temporarily unavailable" } }',
				color: 'red' as const,
			},
			{
				text: '# No retry attempted. Request fails immediately.',
				color: 'yellow' as const,
			},
			{
				text: '# A simple retry would likely succeed (transient error)',
				color: 'yellow' as const,
			},
		],
		story: [
			'Customer paid earlier, now checking if the charge went through.',
			'Stripe returns 503, a temporary server hiccup.',
			'This is a transient error that would succeed if retried.',
			'But the app gives up immediately, shows "Unable to check status".',
			'Customer panics: "Did my payment go through or not?"',
		],
	},
	{
		id: 'stripe-down',
		label: 'Black Friday traffic (Stripe outage)',
		command:
			'for i in {1..50}; do curl -X POST localhost:3000/api/v1/payments; done',
		responseLines: [
			{
				text: '# 50 concurrent checkout requests during Stripe outage',
				color: 'yellow' as const,
			},
			{
				text: '# Each request hangs for 30 seconds (no timeout)',
				color: 'red' as const,
			},
			{
				text: '# 50 threads x 30s = all Puma threads blocked',
				color: 'red' as const,
			},
			{
				text: '# GET /products, GET /search... nothing works!',
				color: 'red' as const,
			},
			{
				text: '# No circuit breaker to stop hammering a dead service',
				color: 'red' as const,
			},
		],
		story: [
			'Black Friday. 50 customers checking out simultaneously.',
			'Stripe is completely down, not responding at all.',
			'Each checkout blocks a Puma thread waiting for Stripe.',
			'Within seconds, all 5 threads are consumed.',
			'A customer trying to browse products cannot even load the homepage.',
			'The entire app is dead, not just payments.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'slow-stripe': ['no-timeout', 'thread-blocking'],
	'stripe-503': ['no-retry'],
	'stripe-down': ['cascade-failure'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// edge = Client<->App, edgeB = App<->Stripe

const SLOW_STRIPE_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Clicking "Pay Now"...', flash: 'idle' },
		app: {
			label: 'Processing checkout...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
		},
		edge: {
			active: true,
			reverse: false,
			label: 'POST /api/v1/payments',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'POST /v1/charges',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Responding slowly...', flash: 'amber', status: 'Slow' },
	},
	{
		client: { label: 'Waiting...', flash: 'amber' },
		app: {
			label: 'Thread blocked...',
			flash: 'amber',
			threads: ['available', 'available', 'available', 'available', 'blocked'],
		},
		edge: { active: false, label: '' },
		edgeB: { active: false, label: 'Waiting... 5s' },
		stripe: { label: 'Still processing...', flash: 'amber' },
	},
	{
		client: { label: 'Still waiting (15s)...', flash: 'red' },
		app: { label: 'Thread blocked 15s...', flash: 'red' },
		edgeB: { label: 'Waiting... 15s...' },
	},
	{
		client: { label: 'Loading spinner (30s)...', flash: 'red' },
		app: { label: 'Thread blocked 30s!', flash: 'red' },
		edgeB: { label: '30s... no timeout!' },
	},
	{
		client: { label: '504 error. Payment failed.', flash: 'red' },
		app: {
			label: '504 Gateway Timeout',
			flash: 'red',
			threads: [...DEFAULT_THREADS],
		},
		edge: {
			active: true,
			reverse: true,
			label: '504 Timeout',
			dotColor: 'bg-red-500',
		},
		edgeB: { active: false, label: '30s wasted' },
		stripe: { label: 'Response wasted', flash: 'idle', status: 'Healthy' },
	},
];

const STRIPE_503_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Checking payment...', flash: 'idle' },
		app: {
			label: 'Forwarding to Stripe...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
		},
		edge: {
			active: true,
			reverse: false,
			label: 'GET /api/v1/payments/status',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET /v1/charges/ch_abc',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Temporary error', flash: 'amber', status: '503' },
	},
	{
		client: { label: 'Waiting for response...', flash: 'idle' },
		app: { label: 'Error received', flash: 'amber' },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: true,
			label: '503 Unavailable',
			dotColor: 'bg-red-500',
		},
		stripe: { label: '503 Service Unavailable', flash: 'red' },
	},
	{
		client: { label: 'Waiting...', flash: 'amber' },
		app: { label: 'No retry attempted', flash: 'red' },
		edgeB: { active: false, label: 'Gave up after 1 try' },
		stripe: {
			label: 'Would succeed on retry...',
			flash: 'idle',
			status: 'Recovering',
		},
	},
	{
		client: { label: '"Did my payment go through?"', flash: 'red' },
		app: { label: 'Returning error to client', flash: 'red' },
		edge: {
			active: true,
			reverse: true,
			label: 'Error: check failed',
			dotColor: 'bg-red-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Back to healthy', flash: 'idle', status: 'Healthy' },
	},
];

const STRIPE_DOWN_FRAMES: AnimFrame[] = [
	{
		client: { label: '50 customers checking out', flash: 'idle' },
		app: {
			label: 'Black Friday load',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
		},
		edge: {
			active: true,
			reverse: false,
			label: '50 checkout requests',
			dotColor: 'bg-red-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: '50x POST /v1/charges',
			dotColor: 'bg-red-500',
		},
		stripe: { label: 'COMPLETE OUTAGE', flash: 'red', status: 'Down' },
	},
	{
		client: { label: 'Everyone waiting...', flash: 'amber' },
		app: {
			label: 'Threads draining...',
			flash: 'amber',
			threads: ['available', 'available', 'available', 'blocked', 'blocked'],
		},
		edge: { active: false, label: '' },
		edgeB: { active: true, label: 'All requests hanging...' },
		stripe: { label: 'No response', flash: 'red' },
	},
	{
		client: { label: 'Pages not loading...', flash: 'red' },
		app: {
			label: '1 thread left!',
			flash: 'red',
			threads: ['available', 'blocked', 'blocked', 'blocked', 'blocked'],
			queueLabel: '45 waiting',
		},
		edgeB: { label: 'Still no response...' },
	},
	{
		client: { label: 'Nothing works!', flash: 'red' },
		app: {
			label: 'ALL THREADS BLOCKED',
			flash: 'red',
			threads: ['blocked', 'blocked', 'blocked', 'blocked', 'blocked'],
			queueLabel: 'GET /products blocked!',
		},
		edge: {
			active: true,
			reverse: false,
			label: 'GET /products',
			dotColor: 'bg-red-500',
		},
		edgeB: { active: false, label: '' },
	},
	{
		client: { label: 'Site is down!', flash: 'red' },
		app: {
			label: 'Entire app unresponsive',
			flash: 'red',
			queueLabel: 'No threads available',
		},
		edge: { active: false, label: 'No response' },
		edgeB: { label: 'No circuit breaker' },
		stripe: { label: 'No response', flash: 'red' },
	},
];

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'slow-stripe': SLOW_STRIPE_FRAMES,
	'stripe-503': STRIPE_503_FRAMES,
	'stripe-down': STRIPE_DOWN_FRAMES,
};

// ─── Reward animation frames ──────────────────────────────────────────

const MW_DEFAULTS = {
	timeoutLabel: '10s limit',
	timeoutFlash: 'green' as const,
	retryLabel: '3x backoff',
	retryFlash: 'green' as const,
	circuitLabel: 'CLOSED',
	circuitFlash: 'green' as const,
};

const REWARD_SLOW_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Clicking "Pay Now"...', flash: 'idle' },
		app: {
			label: 'Processing checkout...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
			...MW_DEFAULTS,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'POST /api/v1/payments',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'POST /v1/charges',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Responding slowly...', flash: 'amber', status: 'Slow' },
	},
	{
		client: { label: 'Waiting...', flash: 'amber' },
		app: {
			label: 'Waiting for Stripe...',
			flash: 'amber',
			threads: ['available', 'available', 'available', 'available', 'blocked'],
		},
		edge: { active: false, label: '' },
		edgeB: { active: false, label: 'Waiting... 5s' },
		stripe: { label: 'Still processing...', flash: 'amber' },
	},
	{
		client: { label: 'Waiting...', flash: 'amber' },
		app: {
			label: 'Timeout triggered!',
			flash: 'amber',
			timeoutLabel: 'TIMEOUT!',
			timeoutFlash: 'amber',
			threads: [...DEFAULT_THREADS],
		},
		edgeB: {
			active: true,
			reverse: true,
			label: 'TimeoutError',
			dotColor: 'bg-amber-500',
		},
		stripe: { label: 'Still processing...', flash: 'amber' },
	},
	{
		client: { label: 'Try again later', flash: 'amber' },
		app: {
			label: 'Thread freed in 10s',
			flash: 'green',
			timeoutLabel: '10s limit',
			timeoutFlash: 'green',
		},
		edge: {
			active: true,
			reverse: true,
			label: 'Please try again',
			dotColor: 'bg-amber-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Never finished', flash: 'idle', status: 'Slow' },
	},
];

const REWARD_503_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Checking payment...', flash: 'idle' },
		app: {
			label: 'Forwarding to Stripe...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
			...MW_DEFAULTS,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'GET /api/v1/payments/status',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET /v1/charges/ch_abc',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Temporary error', flash: 'amber', status: '503' },
	},
	{
		client: { label: 'Waiting for response...', flash: 'idle' },
		app: { label: 'Error received', flash: 'amber' },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: true,
			label: '503 Unavailable',
			dotColor: 'bg-red-500',
		},
		stripe: { label: '503 Service Unavailable', flash: 'red' },
	},
	{
		client: { label: 'Waiting...', flash: 'idle' },
		app: {
			label: 'Retrying...',
			flash: 'amber',
			retryLabel: 'RETRYING (1/3)',
			retryFlash: 'amber',
		},
		edgeB: { active: false, label: 'Backing off 0.5s...' },
		stripe: { label: 'Recovering...', flash: 'amber' },
	},
	{
		client: { label: 'Waiting...', flash: 'idle' },
		app: {
			label: 'Retry sent',
			flash: 'idle',
			retryLabel: '3x backoff',
			retryFlash: 'green',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET /v1/charges (retry)',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Back to healthy', flash: 'idle', status: 'Healthy' },
	},
	{
		client: { label: 'Waiting...', flash: 'idle' },
		app: { label: 'Status retrieved!', flash: 'green' },
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: 'bg-emerald-500',
		},
		stripe: { label: '200 OK', flash: 'green' },
	},
	{
		client: { label: 'Payment confirmed!', flash: 'green' },
		app: { label: 'Returning to client', flash: 'green' },
		edge: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: 'bg-emerald-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Healthy', flash: 'idle', status: 'Healthy' },
	},
];

const REWARD_CIRCUIT_FRAMES: AnimFrame[] = [
	{
		client: { label: '50 customers checking out', flash: 'idle' },
		app: {
			label: 'Black Friday load',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
			...MW_DEFAULTS,
		},
		edge: {
			active: true,
			reverse: false,
			label: '50 checkout requests',
			dotColor: 'bg-red-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: '50x POST /v1/charges',
			dotColor: 'bg-red-500',
		},
		stripe: { label: 'COMPLETE OUTAGE', flash: 'red', status: 'Down' },
	},
	{
		client: { label: 'Everyone waiting...', flash: 'amber' },
		app: {
			label: '5 failures counted...',
			flash: 'amber',
			threads: ['available', 'available', 'available', 'blocked', 'blocked'],
			circuitLabel: '3/5 failures',
			circuitFlash: 'amber',
		},
		edge: { active: false, label: '' },
		edgeB: { active: true, label: 'Requests failing...' },
		stripe: { label: 'No response', flash: 'red' },
	},
	{
		client: { label: 'Waiting...', flash: 'amber' },
		app: {
			label: 'Circuit breaker OPEN!',
			flash: 'amber',
			threads: [...DEFAULT_THREADS],
			circuitLabel: 'OPEN (5 failures)',
			circuitFlash: 'red',
		},
		edgeB: { active: false, label: 'Stripe bypassed' },
		stripe: { label: 'Not contacted', flash: 'idle', status: 'Down' },
	},
	{
		client: { label: 'Got "try again later"', flash: 'amber' },
		app: {
			label: 'Fail-fast: 2ms each',
			flash: 'green',
			queueLabel: '45 handled instantly',
			circuitLabel: 'OPEN',
			circuitFlash: 'red',
		},
		edge: {
			active: true,
			reverse: true,
			label: 'Try again later',
			dotColor: 'bg-amber-500',
		},
	},
	{
		client: { label: 'Browsing products (works!)', flash: 'green' },
		app: {
			label: 'App healthy!',
			flash: 'green',
			threads: [...DEFAULT_THREADS],
			queueLabel: 'Only payments degraded',
		},
		edge: {
			active: true,
			reverse: false,
			label: 'GET /api/v1/products',
			dotColor: 'bg-emerald-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Not contacted', flash: 'idle' },
	},
];

const REWARD_FAST_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Clicking "Pay Now"...', flash: 'idle' },
		app: {
			label: 'Processing checkout...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
			...MW_DEFAULTS,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'POST /api/v1/payments',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'POST /v1/charges',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Processing...', flash: 'idle', status: 'Healthy' },
	},
	{
		client: { label: 'Waiting...', flash: 'idle' },
		app: { label: 'Response in 200ms', flash: 'green' },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: 'bg-emerald-500',
		},
		stripe: { label: '200 OK', flash: 'green' },
	},
	{
		client: { label: 'Payment confirmed!', flash: 'green' },
		app: { label: 'Payment created!', flash: 'green' },
		edge: {
			active: true,
			reverse: true,
			label: '200 Created',
			dotColor: 'bg-emerald-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Healthy', flash: 'idle', status: 'Healthy' },
	},
];

const REWARD_400_FRAMES: AnimFrame[] = [
	{
		client: { label: 'Submitting bad data...', flash: 'idle' },
		app: {
			label: 'Forwarding to Stripe...',
			flash: 'idle',
			threads: [...DEFAULT_THREADS],
			...MW_DEFAULTS,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'POST /api/v1/payments',
			dotColor: 'bg-cyan-500',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'POST /v1/charges',
			dotColor: 'bg-cyan-500',
		},
		stripe: { label: 'Validating...', flash: 'idle', status: 'Healthy' },
	},
	{
		client: { label: 'Waiting...', flash: 'idle' },
		app: { label: 'Client error received', flash: 'amber' },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: true,
			label: '400 Bad Request',
			dotColor: 'bg-red-500',
		},
		stripe: { label: '400 Bad Request', flash: 'amber' },
	},
	{
		client: { label: 'Fix your input', flash: 'amber' },
		app: {
			label: 'Circuit: NOT counted',
			flash: 'idle',
			circuitLabel: 'CLOSED (4xx filtered)',
			circuitFlash: 'green',
		},
		edge: {
			active: true,
			reverse: true,
			label: '422 Validation error',
			dotColor: 'bg-red-500',
		},
		edgeB: { active: false, label: '' },
		stripe: { label: 'Healthy', flash: 'idle', status: 'Healthy' },
	},
];

const REWARD_FRAME_MAP: Record<string, AnimFrame[]> = {
	'slow-timeout': REWARD_SLOW_FRAMES,
	'retry-503': REWARD_503_FRAMES,
	'circuit-open': REWARD_CIRCUIT_FRAMES,
	'fast-charge': REWARD_FAST_FRAMES,
	'client-error': REWARD_400_FRAMES,
};

// ─── Build step definitions ────────────────────────────────────────────

const STEP_DEFS = [
	{ id: 'install-faraday', title: 'Install HTTP Client' },
	{ id: 'install-stoplight', title: 'Install Circuit Breaker' },
	{ id: 'configure-timeout', title: 'Configure Timeout' },
	{ id: 'configure-retry', title: 'Configure Retry' },
	{ id: 'configure-circuit', title: 'Configure Circuit Breaker' },
	{ id: 'build-service', title: 'Build Payment Service' },
];

const INSTALL_FARADAY_COMMANDS = [
	{
		id: 'wrong-httparty',
		label: 'bundle add httparty',
		command: 'bundle add httparty',
		correct: false,
		feedback:
			'HTTParty lacks middleware support. You need an HTTP client with a composable middleware stack for timeouts, retries, and instrumentation.',
	},
	{
		id: 'correct',
		label: 'bundle add faraday',
		command: 'bundle add faraday',
		correct: true,
	},
	{
		id: 'wrong-rest-client',
		label: 'bundle add rest-client',
		command: 'bundle add rest-client',
		correct: false,
		feedback:
			'RestClient does not support middleware. You need pluggable middleware for retry, instrumentation, and circuit breaking.',
	},
];

const INSTALL_STOPLIGHT_COMMANDS = [
	{
		id: 'wrong-circuitbox',
		label: 'bundle add circuitbox',
		command: 'bundle add circuitbox',
		correct: false,
		feedback:
			'Circuitbox is an older gem. The modern, actively maintained option integrates cleanly with any code block.',
	},
	{
		id: 'wrong-semian',
		label: 'bundle add semian',
		command: 'bundle add semian',
		correct: false,
		feedback:
			'Semian is Shopify-specific infrastructure. A standalone circuit breaker gem is simpler and more widely applicable.',
	},
	{
		id: 'correct',
		label: 'bundle add stoplight',
		command: 'bundle add stoplight',
		correct: true,
	},
];

const CONFIGURE_TIMEOUT_OPTIONS = [
	{
		id: 'wrong-no-timeout',
		label: 'No timeout (use defaults)',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  # Use Ruby/OS default timeouts (60-120 seconds)
end`,
		correct: false,
		feedback:
			'Default timeouts are 60+ seconds. A stuck request blocks a thread that long, exhausting your thread pool under load.',
	},
	{
		id: 'wrong-too-long',
		label: 'Set timeout to 60 seconds',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  f.options.timeout = 60  # Allow up to 60s
end`,
		correct: false,
		feedback:
			'60 seconds is far too long. Under load, slow requests pile up and exhaust your thread pool. Keep timeouts under 15 seconds.',
	},
	{
		id: 'correct',
		label: 'Set open_timeout and timeout',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  f.options.open_timeout = 3   # 3s to connect
  f.options.timeout = 10       # 10s total response
end`,
		correct: true,
	},
];

const CONFIGURE_RETRY_OPTIONS = [
	{
		id: 'wrong-retry-all',
		label: 'Retry all HTTP methods',
		code: `f.request :retry, {
  max: 3,
  interval: 0.5,
  backoff_factor: 2,
  retry_statuses: [429, 500, 502, 503, 504]
}`,
		correct: false,
		feedback:
			'Retrying POST requests without idempotency is dangerous. A successful charge that timed out would be charged again on retry.',
	},
	{
		id: 'wrong-no-backoff',
		label: 'Retry immediately (no backoff)',
		code: `f.request :retry, {
  max: 3,
  interval: 0,
  retry_statuses: [429, 500, 502, 503, 504],
  methods: [:get, :put, :delete]
}`,
		correct: false,
		feedback:
			'Retrying immediately creates a thundering herd. All clients retry at the same time, overwhelming the recovering service.',
	},
	{
		id: 'correct',
		label: 'Retry with backoff, skip non-idempotent',
		code: `f.request :retry, {
  max: 3,
  interval: 0.5,
  interval_randomness: 0.5,
  backoff_factor: 2,
  retry_statuses: [429, 500, 502, 503, 504],
  methods: [:get, :head, :options, :put, :delete]
  # POST excluded: not safe without idempotency key
}`,
		correct: true,
	},
];

const CONFIGURE_CIRCUIT_OPTIONS = [
	{
		id: 'wrong-high-threshold',
		label: 'Open after 50 failures',
		code: `Stoplight('stripe-api')
  .with_threshold(50)
  .with_cool_off_time(300)
  .run { stripe_client.create_charge(params) }`,
		correct: false,
		feedback:
			'50 failures means 50 wasted requests and blocked threads before protection kicks in. The circuit should open much sooner.',
	},
	{
		id: 'wrong-no-error-filter',
		label: 'Trip on all errors including 4xx',
		code: `Stoplight('stripe-api')
  .with_threshold(5)
  .with_cool_off_time(30)
  .run { stripe_client.create_charge(params) }`,
		correct: false,
		feedback:
			'This trips the circuit on client errors (400, 422) which are never transient. The circuit should only track server-side failures.',
	},
	{
		id: 'correct',
		label: 'Threshold 5, filter client errors',
		code: `Stoplight('stripe-api')
  .with_threshold(5)
  .with_cool_off_time(30)
  .with_error_handler do |error, handle|
    raise error if error.is_a?(Faraday::ClientError)
    handle.call(error)  # Only track 5xx / timeouts
  end
  .run { stripe_client.create_charge(params) }`,
		correct: true,
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-no-service',
		label: 'Call Stripe directly in controller',
		code: `class Api::V1::PaymentsController < ApplicationController
  def create
    response = Faraday.post('https://api.stripe.com/v1/charges',
      { amount: params[:amount] })
    if response.success?
      render json: { payment: response.body }, status: :created
    else
      render json: { error: { code: "PAYMENT_FAILED",
        message: response.body } }, status: :bad_gateway
    end
  end
end`,
		correct: false,
		feedback:
			'HTTP calls in controllers violate the service object pattern. Business logic and external integrations belong in services.',
	},
	{
		id: 'wrong-no-circuit',
		label: 'Service without circuit breaker',
		code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = stripe_client.create_charge(@params)
    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		correct: false,
		feedback:
			'This service has no circuit breaker. During an outage, every request still hits the failing API, wasting threads and amplifying the problem.',
	},
	{
		id: 'correct',
		label: 'Service with contract, circuit breaker, and Result',
		code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end

  private

  def stripe_client
    @stripe_client ||= StripeClient.new
  end
end`,
		correct: true,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: INSTALL_FARADAY_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	{
		commands: INSTALL_STOPLIGHT_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	null, // configure-timeout: OptionCard
	null, // configure-retry: OptionCard
	null, // configure-circuit: OptionCard
	null, // build-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────

const STRESS_SCENARIOS = [
	{
		id: 'slow-timeout',
		label: 'POST create payment (with timeout)',
		description: 'Same slow Stripe, but timeout kills it at 10s',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Timeout: 10s limit reached!', color: 'yellow' },
			{ text: 'Thread freed after 10s (was 30s before)', color: 'green' },
			{ text: '503 - { "error": { "code": "TIMEOUT" } }', color: 'red' },
		],
		story: [
			'Same customer, same slow Stripe.',
			'But now the 10-second timeout catches it.',
			'Thread freed after 10s instead of 30s.',
			'Customer gets a clean error: "Please try again."',
			'4 out of 5 threads stayed available the entire time.',
		],
	},
	{
		id: 'retry-503',
		label: 'GET check payment status (with retry)',
		description: 'Same 503, but retry middleware handles it',
		method: 'GET',
		path: '/api/v1/payments/ch_abc/status',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{
				text: 'GET /api/v1/payments/ch_abc/status -> Stripe API',
				color: 'cyan',
			},
			{ text: 'Attempt 1: 503 Service Unavailable', color: 'yellow' },
			{ text: 'Retry middleware: backing off 0.5s...', color: 'yellow' },
			{ text: 'Attempt 2: 200 OK', color: 'green' },
		],
		story: [
			'Same customer checking the same payment.',
			'Same 503 from Stripe on the first attempt.',
			'But now retry middleware catches it, waits 0.5s, retries.',
			'Second attempt succeeds.',
			'Customer sees their payment status without ever knowing anything went wrong.',
		],
	},
	{
		id: 'circuit-open',
		label: 'Black Friday traffic (with circuit breaker)',
		description: 'Same outage, but circuit breaker protects the app',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Circuit breaker', color: 'cyan' },
			{ text: 'Stoplight: circuit OPEN (5 failures)', color: 'red' },
			{ text: 'Fail-fast: 2ms (was 30s before!)', color: 'green' },
			{ text: '503 - { "error": { "code": "CIRCUIT_OPEN" } }', color: 'red' },
		],
		story: [
			'Same Black Friday, same Stripe outage, same 50 customers.',
			'First 5 requests fail (circuit breaker counting: 1, 2, 3, 4, 5).',
			'After 5 failures, circuit breaker opens.',
			'Requests 6-50 fail instantly in milliseconds, never reaching Stripe.',
			'All threads stay free. Homepage, search, everything still works.',
			'Only payments are degraded. The rest of the app is fine.',
		],
	},
	{
		id: 'fast-charge',
		label: 'POST charge (fast response)',
		description: 'Stripe responds in 200ms, all middleware passes through',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Timeout: 200ms (within 10s limit)', color: 'green' },
			{ text: 'Circuit breaker: CLOSED (healthy)', color: 'green' },
			{ text: '200 OK - Payment ch_abc123 created', color: 'green' },
		],
		story: [
			'Normal day, Stripe is healthy.',
			'Customer pays, response in 200ms.',
			'All three middleware layers pass through without triggering.',
			'Resilience adds no overhead when things work.',
		],
	},
	{
		id: 'client-error',
		label: 'POST charge (400 bad params)',
		description: 'Client error, circuit breaker ignores it',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: 'POST /api/v1/payments -> Stripe API', color: 'cyan' },
			{ text: 'Stripe: 400 Bad Request (missing amount)', color: 'red' },
			{ text: 'Circuit breaker: NOT counted (client error)', color: 'green' },
			{ text: '400 - { "error": { "code": "VALIDATION" } }', color: 'red' },
		],
		story: [
			'Customer submits invalid payment data (missing amount).',
			'Stripe returns 400 Bad Request.',
			'Circuit breaker does NOT count this failure.',
			'Only server errors (5xx) and timeouts trip the breaker.',
			'Bad user input will not accidentally open the circuit.',
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
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    # No timeout! Blocks thread for 30+ seconds
    response = HTTParty.post(
      'https://api.stripe.com/v1/charges',
      body: { amount: @params[:amount] }
    )
    # No retry on transient errors
    # No circuit breaker for outages

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (completedStep >= 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `gem "faraday"${completedStep >= 1 ? '\ngem "stoplight"' : ''}`,
			});
		}

		if (completedStep >= 2) {
			files.push({
				filename: 'app/clients/stripe_client.rb',
				language: 'ruby',
				code: `class StripeClient
  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer',
        Rails.application.credentials.stripe[:secret_key]
      f.request :json
      f.response :json
      f.options.open_timeout = 3
      f.options.timeout = 10${
				completedStep >= 3
					? `
      f.request :retry, {
        max: 3,
        interval: 0.5,
        interval_randomness: 0.5,
        backoff_factor: 2,
        retry_statuses: [429, 500, 502, 503, 504],
        methods: [:get, :head, :options, :put, :delete]
      }`
					: ''
			}
    end
  end

  def create_charge(params)
    @connection.post('/v1/charges', params)
  end
end`,
			});
		}

		if (completedStep >= 5) {
			files.push({
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end

  private

  def stripe_client
    @stripe_client ||= StripeClient.new
  end
end`,
			});
		}

		if (files.length === 0) {
			return [
				{
					filename: 'app/services/process_payment.rb',
					language: 'ruby',
					code: `class ProcessPayment < ApplicationService
  # Currently using HTTParty with no resilience...
  # Step 1: Install an HTTP client with middleware support
end`,
				},
			];
		}

		return files;
	}

	// reward
	return [
		{
			filename: 'app/clients/stripe_client.rb',
			language: 'ruby',
			code: `class StripeClient
  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer',
        Rails.application.credentials.stripe[:secret_key]
      f.request :json
      f.request :retry, {
        max: 3,
        interval: 0.5,
        interval_randomness: 0.5,
        backoff_factor: 2,
        retry_statuses: [429, 500, 502, 503, 504],
        methods: [:get, :head, :options, :put, :delete]
      }
      f.response :json
      f.options.open_timeout = 3
      f.options.timeout = 10
    end
  end

  def create_charge(params)
    @connection.post('/v1/charges', params)
  end
end`,
		},
		{
			filename: 'app/services/process_payment.rb',
			language: 'ruby',
			code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end

  private

  def stripe_client
    @stripe_client ||= StripeClient.new
  end
end`,
		},
		{
			filename: 'app/contracts/payment_contract.rb',
			language: 'ruby',
			code: `class PaymentContract < Dry::Validation::Contract
  params do
    required(:amount).filled(:integer, gt?: 0)
    optional(:currency).filled(:string)
  end

  rule(:amount) do
    key.failure('must be at least 50 cents') if value < 50
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

interface ClientNodeData extends ClientVizState {
	[key: string]: unknown;
}

const ClientNode = memo(({ data }: { data: ClientNodeData }) => {
	const d = data as ClientNodeData;
	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-36 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-1.5">
				<Monitor className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">Client</span>
			</div>
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
		</div>
	);
});

interface AppServerNodeData extends AppServerVizState {
	isReward: boolean;
	[key: string]: unknown;
}

const AppServerNode = memo(({ data }: { data: AppServerNodeData }) => {
	const d = data as AppServerNodeData;
	const showMiddleware = d.isReward && d.timeoutLabel;

	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 ${showMiddleware ? 'w-64' : 'w-48'} p-2.5`}
		>
			<FlowHandles />
			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<Server className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">
					Rails App (Puma)
				</span>
			</div>

			{/* Thread pool */}
			<div className="mb-2">
				<div className="text-[10px] text-muted-foreground mb-1">
					Thread Pool
				</div>
				<div className="flex gap-1">
					{THREAD_KEYS.map((key, idx) => {
						const t = d.threads[idx] ?? 'available';
						return (
							<div
								className={`h-5 flex-1 rounded text-[9px] font-mono flex items-center justify-center transition-colors duration-300 ${
									t === 'available'
										? 'bg-emerald-200 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300'
										: t === 'freed'
											? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
											: 'bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300'
								}`}
								key={key}
							>
								T{idx + 1}
							</div>
						);
					})}
				</div>
			</div>

			{/* Status */}
			<div className="text-xs text-foreground font-medium truncate">
				{d.label}
			</div>
			{d.queueLabel && (
				<div className="text-[10px] text-muted-foreground mt-0.5 truncate">
					{d.queueLabel}
				</div>
			)}

			{/* Middleware sub-panels (reward only) */}
			{showMiddleware && (
				<div className="flex gap-1 mt-2 pt-2 border-t border-border">
					{[
						{
							icon: Timer,
							label: 'Timeout',
							value: d.timeoutLabel,
							flash: d.timeoutFlash,
						},
						{
							icon: RefreshCw,
							label: 'Retry',
							value: d.retryLabel,
							flash: d.retryFlash,
						},
						{
							icon: Unplug,
							label: 'Circuit',
							value: d.circuitLabel,
							flash: d.circuitFlash,
						},
					].map((mw) => (
						<div
							className={`flex-1 rounded border ${FLASH_BORDER[mw.flash]} ${FLASH_BG[mw.flash]} p-1 text-center transition-colors duration-300`}
							key={mw.label}
						>
							<mw.icon className="w-3 h-3 mx-auto text-muted-foreground" />
							<div className="text-[8px] text-muted-foreground">{mw.label}</div>
							<div className="text-[9px] font-semibold text-foreground truncate">
								{mw.value}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
});

interface StripeNodeData extends StripeVizState {
	[key: string]: unknown;
}

const StripeNode = memo(({ data }: { data: StripeNodeData }) => {
	const d = data as StripeNodeData;

	return (
		<div
			className={`rounded-xl border-2 ${FLASH_BORDER[d.flash]} ${FLASH_BG[d.flash]} transition-colors duration-300 w-36 p-2.5`}
		>
			<FlowHandles />
			<div className="flex items-center gap-2 mb-2">
				<Globe className="w-4 h-4 text-foreground shrink-0" />
				<span className="text-xs font-semibold text-foreground">
					Stripe API
				</span>
			</div>
			<Badge
				className={`text-[10px] ${
					d.status === 'Healthy'
						? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
						: d.status === 'Down' || d.status === '503'
							? 'text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
							: 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
				}`}
				variant="outline"
			>
				{d.status}
			</Badge>
			<div className="text-xs text-foreground font-medium mt-2 truncate">
				{d.label}
			</div>
		</div>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

function toDotFill(twClass: string): string {
	if (twClass.includes('emerald')) return '#10b981';
	if (twClass.includes('red')) return '#ef4444';
	if (twClass.includes('amber')) return '#f59e0b';
	if (twClass.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

interface ApiEdgeData extends EdgeVizState {
	[key: string]: unknown;
}

const ApiEdge = memo(
	({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
		const d = (data ?? DEFAULT_EDGE) as ApiEdgeData;
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
							className="nodrag nopan pointer-events-none absolute text-[10px] font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
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
	},
);

const apiNodeTypes = {
	client: ClientNode,
	appServer: AppServerNode,
	stripe: StripeNode,
};
const apiEdgeTypes = { api: ApiEdge };

// ─── Main component ────────────────────────────────────────────────────

export function Level38ExternalAPIs({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<'observe' | 'build' | 'reward'>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [clientState, setClientState] =
		useState<ClientVizState>(DEFAULT_CLIENT);
	const [appState, setAppState] = useState<AppServerVizState>(DEFAULT_APP);
	const [stripeState, setStripeState] =
		useState<StripeVizState>(DEFAULT_STRIPE);
	const [edgeState, setEdgeState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setClientState(DEFAULT_CLIENT);
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setStripeState(DEFAULT_STRIPE);
		setEdgeState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.client) setClientState((prev) => ({ ...prev, ...frame.client }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.stripe) setStripeState((prev) => ({ ...prev, ...frame.stripe }));
		if (frame.edge) setEdgeState((prev) => ({ ...prev, ...frame.edge }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
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
			// Stop all dots after last frame so animations don't loop indefinitely
			const tCleanup = setTimeout(() => {
				setEdgeState((prev) => ({ ...prev, active: false }));
				setEdgeBState((prev) => ({ ...prev, active: false }));
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
			// 3 nodes + 2 edges = lots to read per frame, so slow down
			const delay =
				probeId === 'stripe-down'
					? ANIMATION_DURATION_MS * 2
					: ANIMATION_DURATION_MS * 1.5;
			if (frames) runAnimation(frames, undefined, delay);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const allOptions: Record<number, typeof CONFIGURE_TIMEOUT_OPTIONS> = {
				2: CONFIGURE_TIMEOUT_OPTIONS,
				3: CONFIGURE_RETRY_OPTIONS,
				4: CONFIGURE_CIRCUIT_OPTIONS,
				5: BUILD_SERVICE_OPTIONS,
			};
			const options = allOptions[stepper.currentStep];
			if (!options) return;
			const option = options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				setWrongFeedback(null);
				stepper.completeStep();
			} else {
				setWrongFeedback(option.feedback ?? 'Not quite right.');
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
			const frames = REWARD_FRAME_MAP[scenarioId];
			if (frames) {
				setClientState(DEFAULT_CLIENT);
				setAppState(DEFAULT_APP_REWARD);
				setStripeState(DEFAULT_STRIPE);
				setEdgeState(DEFAULT_EDGE);
				setEdgeBState(DEFAULT_EDGE);
				runAnimation(frames, undefined, ANIMATION_DURATION_MS * 1.5);
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
			message: 'External API integration is resilient!',
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
	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'client',
				type: 'client',
				position: { x: 0, y: 30 },
				data: { ...clientState } satisfies ClientNodeData,
			},
			{
				id: 'appServer',
				type: 'appServer',
				position: { x: 260, y: 0 },
				data: { ...appState, isReward } satisfies AppServerNodeData,
			},
			{
				id: 'stripe',
				type: 'stripe',
				position: { x: isReward ? 600 : 550, y: 30 },
				data: { ...stripeState } satisfies StripeNodeData,
			},
		],
		[clientState, appState, stripeState, isReward],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-client-app',
				source: 'client',
				target: 'appServer',
				type: 'api',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edgeState } satisfies ApiEdgeData,
			},
			{
				id: 'e-app-stripe',
				source: 'appServer',
				target: 'stripe',
				type: 'api',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: { ...edgeBState } satisfies ApiEdgeData,
			},
		],
		[edgeState, edgeBState],
	);

	// ── Build step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx <= 1)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[idx] };
		const stepOptions: Record<number, typeof CONFIGURE_TIMEOUT_OPTIONS> = {
			2: CONFIGURE_TIMEOUT_OPTIONS,
			3: CONFIGURE_RETRY_OPTIONS,
			4: CONFIGURE_CIRCUIT_OPTIONS,
			5: BUILD_SERVICE_OPTIONS,
		};
		return { type: 'option' as const, options: stepOptions[idx] };
	}, [stepper.currentStep]);

	const buildCodePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							Stripe API returned HTTP 503 for 5 minutes. Every checkout request
							waited 30 seconds, consumed a Puma thread, and timed out. All
							threads blocked. Entire app unresponsive.
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
							Add resilience layers: timeout, retry with backoff, and circuit
							breaker.
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
							<span className="text-muted-foreground">Request handled</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">Failed gracefully</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Succeeded</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Handled</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleFireScenario)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
			</div>
		);
	};

	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={apiEdgeTypes}
							nodes={flowNodes}
							nodeTypes={apiNodeTypes}
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

		if (phase === 'build' && currentStepConfig) {
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
										'Install an HTTP client with composable middleware for timeouts, retries, and instrumentation.'}
									{stepper.currentStep === 1 &&
										'Install a circuit breaker gem that wraps external calls and fails fast during outages.'}
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
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto min-h-0">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].title}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'Set connection and response timeouts to prevent thread blocking.'}
								{stepper.currentStep === 3 &&
									'Configure retry middleware with exponential backoff for transient errors.'}
								{stepper.currentStep === 4 &&
									'Wrap external calls in a circuit breaker that fails fast during outages.'}
								{stepper.currentStep === 5 &&
									'Build the payment service with all resilience patterns integrated.'}
							</p>
						</div>
						{wrongFeedback && !stepper.isCurrentStepCompleted && (
							<ErrorFeedback message={wrongFeedback} />
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
						{stepper.isCurrentStepCompleted && (
							<Button
								className="w-fit gap-2"
								onClick={
									stepper.currentStep < STEP_DEFS.length - 1
										? () => {
												setWrongFeedback(null);
												stepper.nextStep();
											}
										: () => setPhase('reward')
								}
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
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={apiEdgeTypes}
						nodes={flowNodes}
						nodeTypes={apiNodeTypes}
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
					levelName="External APIs"
					levelNumber={38}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, buildCodePreviewStep)}
					learningGoal="Every external API call needs timeouts, retries with backoff, and a circuit breaker."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level38ExternalAPIs;

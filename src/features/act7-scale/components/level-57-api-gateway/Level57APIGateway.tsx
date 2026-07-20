/**
 * Level 57: API Gateway
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom FlowDiagram visualization.
 *   The mobile app stitches every screen from six sequential calls to
 *   endpoint groups of the SAME Rails app (the modular monolith). Probes
 *   reveal round-trip latency, overfetched payloads, no per-section
 *   resilience, and shipped apps welded to internal paths.
 *
 * Phase 2 (HOW - build): 6 steps (1 terminal + 5 OptionCard)
 *   Step 0: Generate gateway controller (TerminalChoice)
 *   Step 1: Authenticate once at the edge (OptionCard)
 *   Step 2: Map sections to package readers, L55 public APIs (OptionCard)
 *   Step 3: Shape one payload for the screen (OptionCard)
 *   Step 4: Per-section fallbacks (OptionCard)
 *   Step 5: Rate limit the entry point (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Client -> Gateway -> package readers
 *   (in-process). One round trip per screen, shaped payload, graceful
 *   degradation, one rate limit; the backend is free to reorganize
 *   behind the stable URL (the seam the capstone's extraction relies on).
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, Shield, Zap } from 'lucide-react';
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

registerLevelCode('act7-level57-api-gateway', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface ClientVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
}

interface GatewayVizState {
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

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	client?: Partial<ClientVizState>;
	gateway?: Partial<GatewayVizState>;
	svcA?: Partial<ServiceVizState>;
	svcB?: Partial<ServiceVizState>;
	svcC?: Partial<ServiceVizState>;
	edgeIn?: Partial<EdgeVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CLIENT: ClientVizState = {
	label: 'Mobile App',
	flash: 'idle',
	sublabel: 'Stitches 6 calls per screen',
};

const DEFAULT_SVC_A: ServiceVizState = {
	label: 'Account + Orders endpoints',
	flash: 'red',
	sublabel: '/users/me + /orders (same app)',
	badge: null,
};

const DEFAULT_SVC_B: ServiceVizState = {
	label: 'Inventory + Notifications endpoints',
	flash: 'red',
	sublabel: '/stock + /notifications (same app)',
	badge: null,
};

const DEFAULT_SVC_C: ServiceVizState = {
	label: 'Billing + Analytics endpoints',
	flash: 'red',
	sublabel: '/billing/summary + /metrics (same app)',
	badge: null,
};

const DEFAULT_GATEWAY: GatewayVizState = {
	label: 'Dashboard Gateway',
	flash: 'green',
	sublabel: 'One request per screen',
	badge: null,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

// Reward defaults
const DEFAULT_CLIENT_REWARD: ClientVizState = {
	label: 'Mobile App',
	flash: 'green',
	sublabel: 'One request per screen',
};

const DEFAULT_GATEWAY_REWARD: GatewayVizState = {
	label: 'Dashboard Gateway',
	flash: 'green',
	sublabel: 'Auth once + shape the payload',
	badge: null,
};

const DEFAULT_SVC_A_REWARD: ServiceVizState = {
	label: 'Orders package',
	flash: 'idle',
	sublabel: 'in-process reader',
	badge: null,
};

const DEFAULT_SVC_B_REWARD: ServiceVizState = {
	label: 'Inventory + Notifications packages',
	flash: 'idle',
	sublabel: 'in-process readers',
	badge: null,
};

const DEFAULT_SVC_C_REWARD: ServiceVizState = {
	label: 'Billing + Analytics packages',
	flash: 'idle',
	sublabel: 'in-process readers',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'sequential-latency',
		label: 'Six round trips repeat auth and setup the client cannot avoid',
	},
	{
		id: 'payload-overfetch',
		label: 'Endpoints send whole resources; the screen needs slivers',
	},
	{
		id: 'no-resilience',
		label: 'One failing section blanks the whole dashboard',
	},
	{
		id: 'topology-coupling',
		label: 'Shipped apps are welded to six internal paths',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────

export const PROBES: ProbeConfig[] = [
	{
		id: 'latency-compound',
		label: 'Open the dashboard on 4G',
		command:
			'GET /users/me, /orders, /stock, /notifications, /billing/summary, /metrics',
		responseLines: [
			{ text: 'GET /users/me          -> 200 OK (390ms)', color: 'yellow' },
			{ text: 'GET /orders            -> 200 OK (410ms)', color: 'yellow' },
			{ text: 'GET /stock             -> 200 OK (380ms)', color: 'yellow' },
			{ text: 'GET /notifications     -> 200 OK (350ms)', color: 'yellow' },
			{ text: 'GET /billing/summary   -> 200 OK (430ms)', color: 'red' },
			{ text: 'GET /metrics           -> 200 OK (440ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Six requests: six auth checks, six connections to open.',
				color: 'yellow',
			},
			{
				text: 'Even fired in parallel, the screen waits on the slowest (440ms)',
				color: 'yellow',
			},
			{
				text: 'and every one re-runs the same session lookup and setup.',
				color: 'red',
			},
		],
		story: [
			'A customer opens the dashboard on a 4G connection.',
			'The app fetches six endpoints. A smart client can fire them in parallel, so the wall-clock wait is closer to the slowest call than to their sum.',
			'But each of the six still opens its own connection and re-runs the same authentication, work that repeats six times for one screen.',
			'And parallel or not, the client is the piece you cannot redeploy: it owns the stitching, the payload sizes, and the six paths.',
			'One request to one entry point removes the repeated auth and setup, and moves the stitching to the server.',
		],
	},
	{
		id: 'payload-overfetch',
		label: 'Load the dashboard on a metered connection',
		command: 'GET all six endpoints and sum the response sizes',
		responseLines: [
			{
				text: '/orders          -> 120KB (full order objects)',
				color: 'yellow',
			},
			{ text: '/users/me        -> 44KB  (full profile)', color: 'yellow' },
			{ text: '/stock           -> 96KB  (every stock row)', color: 'yellow' },
			{
				text: '/notifications   -> 52KB  (full notifications)',
				color: 'yellow',
			},
			{ text: '/billing/summary -> 88KB  (line items included)', color: 'red' },
			{ text: '/metrics         -> 80KB  (every datapoint)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Downloaded: 480KB. The screen displays about 6KB.',
				color: 'red',
			},
		],
		story: [
			'A customer on a metered data plan opens the same dashboard.',
			'Each endpoint returns its complete resource, built for full detail pages.',
			'The dashboard shows a handful of fields from each: a count, a total, a top-three list.',
			'480KB comes down the wire so the screen can render 6KB.',
			'Nobody shaped a response for this screen; the app gets six wholesale answers.',
		],
	},
	{
		id: 'section-down',
		label: 'Open the dashboard while analytics is erroring',
		command: 'GET /metrics -> 500 (analytics query bug)',
		responseLines: [
			{ text: 'GET /users/me        -> 200 OK', color: 'green' },
			{ text: 'GET /orders          -> 200 OK', color: 'green' },
			{
				text: 'GET /metrics         -> 500 Internal Server Error',
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{ text: 'The app has no per-section fallback.', color: 'red' },
			{
				text: 'One failed call out of six: the whole dashboard shows an error screen.',
				color: 'red',
			},
		],
		story: [
			'A bug in the analytics query starts returning 500s.',
			'Five of the six dashboard calls still succeed.',
			'The shipped app was never written to render a partial screen.',
			'Customers see a blank dashboard with a generic error, even though orders, billing, and inventory are all fine.',
			'One optional section took the whole screen down with it.',
		],
	},
	{
		id: 'route-moved',
		label: 'Move the billing summary to a new path',
		command:
			'deploy: rename GET /api/v1/billing/summary -> /api/v1/billing/overview',
		responseLines: [
			{ text: 'Server: route renamed, deploy complete.', color: 'cyan' },
			{ text: '', color: 'muted' },
			{
				text: 'App v2.13 (shipped): GET /billing/summary -> 404',
				color: 'red',
			},
			{
				text: 'Every installed app version still calls the old path.',
				color: 'red',
			},
			{
				text: 'Fix requires an app-store release and weeks of stragglers.',
				color: 'yellow',
			},
		],
		story: [
			'The backend team renames one billing route in a refactor.',
			'The server deploy takes minutes; then support tickets start.',
			'Every shipped app version has the old path baked in and now gets 404s.',
			'The fix is an app-store release, review time, and weeks of users on old versions.',
			'Six hardcoded paths in the client means the backend cannot reorganize anything.',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'latency-compound': ['sequential-latency'],
	'payload-overfetch': ['payload-overfetch'],
	'section-down': ['no-resilience'],
	'route-moved': ['topology-coupling'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 4 nodes (Client + 3 endpoint groups of the SAME app). No gateway
// node exists yet. edgeA/B/C = Client <-> endpoint groups.

const LATENCY_FRAMES: AnimFrame[] = [
	{
		client: { label: 'GET /users/me', flash: 'idle', sublabel: 'Call 1/6...' },
		svcA: {
			flash: 'amber',
			sublabel: 'Calls 1-2 processing...',
			badge: '800ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: '2 round trips (~800ms)',
			dotColor: '#ef4444',
		},
	},
	{
		client: { label: 'GET /stock', flash: 'amber', sublabel: 'Call 3/6...' },
		svcA: { flash: 'idle', sublabel: 'Done', badge: null },
		svcB: {
			flash: 'amber',
			sublabel: 'Calls 3-4 processing...',
			badge: '730ms',
		},
		edgeA: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: '2 round trips (~730ms)',
			dotColor: '#ef4444',
		},
	},
	{
		client: { label: 'GET /metrics', flash: 'amber', sublabel: 'Call 5/6...' },
		svcB: { flash: 'idle', sublabel: 'Done', badge: null },
		svcC: {
			flash: 'amber',
			sublabel: 'Calls 5-6 processing...',
			badge: '870ms',
		},
		edgeB: { active: false, label: '' },
		edgeC: {
			active: true,
			reverse: false,
			label: '2 round trips (~870ms)',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'red',
			sublabel: '6 auth checks, 6 connections',
		},
		svcC: {
			flash: 'red',
			sublabel: 'waits on the slowest call',
			badge: '440ms+',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: 'repeated auth + setup, x6',
			dotColor: '#ef4444',
		},
	},
];

const OVERFETCH_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'Downloading...',
			flash: 'idle',
			sublabel: 'Metered connection',
		},
		svcA: {
			flash: 'amber',
			sublabel: 'Full resources returned',
			badge: '164KB',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'whole order objects',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: 'Downloading...',
			flash: 'amber',
			sublabel: '260KB so far',
		},
		svcA: { flash: 'idle', badge: null },
		svcB: {
			flash: 'amber',
			sublabel: 'Every stock row returned',
			badge: '148KB',
		},
		edgeA: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: true,
			label: 'full inventory payload',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: '480KB downloaded',
			flash: 'red',
			sublabel: 'Screen shows ~6KB of it',
		},
		svcB: { flash: 'idle', badge: null },
		svcC: {
			flash: 'red',
			sublabel: 'Line items + every datapoint',
			badge: '168KB',
		},
		edgeB: { active: false, label: '' },
		edgeC: {
			active: true,
			reverse: true,
			label: '480KB for one screen',
			dotColor: '#ef4444',
		},
	},
];

const SECTION_DOWN_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /users/me, /orders...',
			flash: 'idle',
			sublabel: 'Fetching sections...',
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: 'OK' },
		edgeA: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'GET /metrics',
			flash: 'amber',
			sublabel: 'Last section...',
		},
		svcC: { flash: 'red', sublabel: 'Analytics query raises', badge: '500' },
		edgeA: { active: false, label: '' },
		edgeC: {
			active: true,
			reverse: false,
			label: '/metrics -> 500',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Dashboard FAILED',
			flash: 'red',
			sublabel: 'Blank screen, generic error',
		},
		svcA: { flash: 'idle', sublabel: '5 sections were fine' },
		svcC: {
			flash: 'red',
			sublabel: 'One section, whole screen down',
			badge: '500',
		},
		edgeC: { active: false, label: '' },
	},
];

const ROUTE_MOVED_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'App v2.13 (shipped)',
			flash: 'idle',
			sublabel: '6 paths baked in',
		},
		svcC: {
			flash: 'amber',
			sublabel: 'billing/summary renamed on server',
			badge: 'RENAMED',
		},
	},
	{
		client: {
			label: 'GET /billing/summary',
			flash: 'amber',
			sublabel: 'Old path from shipped app',
		},
		svcC: { flash: 'red', sublabel: 'No route matches', badge: '404' },
		edgeC: {
			active: true,
			reverse: false,
			label: 'old path -> 404',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Dashboard broken',
			flash: 'red',
			sublabel: 'Until an app-store release ships',
		},
		svcC: {
			flash: 'red',
			sublabel: 'Backend cannot rename anything',
			badge: '404',
		},
		edgeC: { active: false, label: '' },
	},
];

export const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'latency-compound': LATENCY_FRAMES,
	'payload-overfetch': OVERFETCH_FRAMES,
	'section-down': SECTION_DOWN_FRAMES,
	'route-moved': ROUTE_MOVED_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: 5 nodes (Client, Gateway, 3 package groups). edgeIn = Client <->
// Gateway (the only network hop); edgeA/B/C = in-process reader calls.

const REWARD_LATENCY_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'One request...',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Auth once, building sections...',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'session verified once',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'green',
			sublabel: 'Section readers (in-process)',
			badge: null,
		},
		svcA: { flash: 'green', sublabel: 'reader returned', badge: '12ms' },
		svcB: { flash: 'green', sublabel: 'readers returned', badge: '9ms' },
		svcC: { flash: 'green', sublabel: 'readers returned', badge: '14ms' },
		edgeA: {
			active: true,
			reverse: true,
			label: 'method call',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: 'method call',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: 'method call',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: 'one round trip, one auth check',
		},
		gateway: {
			flash: 'green',
			sublabel: '1 connection instead of 6',
			badge: '400ms',
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK, one trip',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const REWARD_OVERFETCH_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'Metered connection',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Shaping payload for the screen...',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'one request',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'green',
			sublabel: 'Counts, totals, top-3 lists only',
			badge: '6KB',
		},
		svcA: { flash: 'green', sublabel: 'sliver, not the resource', badge: null },
		svcB: { flash: 'green', sublabel: 'sliver, not the resource', badge: null },
		svcC: { flash: 'green', sublabel: 'sliver, not the resource', badge: null },
		edgeA: {
			active: true,
			reverse: true,
			label: 'shaped',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: 'shaped',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: 'shaped',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: '6KB (was 480KB)',
		},
		gateway: {
			flash: 'green',
			sublabel: 'The screen defines the payload',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '6KB response',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const REWARD_SECTION_DOWN_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'One request...',
		},
		gateway: { flash: 'amber', sublabel: 'Building sections...', badge: null },
		edgeIn: {
			active: true,
			reverse: false,
			label: 'session verified once',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'amber',
			sublabel: 'Analytics raised -> fallback',
			badge: 'fallback',
		},
		svcA: { flash: 'green', sublabel: 'reader returned', badge: 'OK' },
		svcB: { flash: 'green', sublabel: 'readers returned', badge: 'OK' },
		svcC: { flash: 'red', sublabel: 'Analytics raised', badge: 'rescued' },
		edgeA: { active: true, reverse: true, label: 'ok', dotColor: '#22c55e' },
		edgeB: { active: true, reverse: true, label: 'ok', dotColor: '#22c55e' },
		edgeC: {
			active: true,
			reverse: true,
			label: 'unavailable marker',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: 'Metrics tile says "unavailable"',
		},
		gateway: {
			flash: 'green',
			sublabel: '5 sections live, 1 degraded',
			badge: '200 OK',
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK (partial)',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const REWARD_ROUTE_MOVED_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'App v2.13 (unchanged)',
			flash: 'idle',
			sublabel: 'Still calls /api/v1/dashboard',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Billing reader moved internally',
			badge: 'remapped',
		},
		svcC: { flash: 'amber', sublabel: 'New internal shape', badge: null },
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: 'No app release needed',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Clients see one stable URL',
			badge: '200 OK',
		},
		svcC: {
			flash: 'green',
			sublabel: 'Backend free to reorganize',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK, same as ever',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_RATE_LIMIT_FRAMES: AnimFrame[] = [
	{
		client: {
			label: '100 requests in a minute',
			flash: 'amber',
			sublabel: 'Bot burst...',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'One limit at the door: 60/min',
			badge: 'counting',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'burst traffic',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: '429 Too Many Requests',
			flash: 'red',
			sublabel: 'Stopped at the entry point',
		},
		gateway: { flash: 'red', sublabel: 'Limit exceeded', badge: '429' },
		svcA: { flash: 'idle', sublabel: 'never touched' },
		svcB: { flash: 'idle', sublabel: 'never touched' },
		svcC: { flash: 'idle', sublabel: 'never touched' },
		edgeIn: {
			active: true,
			reverse: true,
			label: '429 Too Many Requests',
			dotColor: '#ef4444',
		},
	},
];

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'latency-compound': REWARD_LATENCY_FRAMES,
	'payload-overfetch': REWARD_OVERFETCH_FRAMES,
	'section-down': REWARD_SECTION_DOWN_FRAMES,
	'route-moved': REWARD_ROUTE_MOVED_FRAMES,
	'rate-limit-burst': REWARD_RATE_LIMIT_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	client: {
		stageId: 'client',
		title: 'Mobile App',
		description:
			'The shipped app stitches every screen together itself: six hardcoded paths for the dashboard alone, called one after another. Any change to those paths breaks every installed version until an app-store release lands.',
	},
	svcA: {
		stageId: 'svcA',
		title: 'Account + Orders endpoints',
		description:
			'Two endpoints of the same Rails app. Each call runs the full request cycle, verifies the session again, and returns the complete resource its detail page needs, far more than the dashboard shows.',
		code: `# Same app, one of six separate calls per screen
class Api::V1::OrdersController < ApplicationController
  def index
    orders = Current.user.orders.recent
    render json: OrderSerializer.new(orders)
    # full order objects: the dashboard shows a count
    # and the last three order totals
  end
end`,
	},
	svcB: {
		stageId: 'svcB',
		title: 'Inventory + Notifications endpoints',
		description:
			'Two more endpoints of the same app. The dashboard needs a low-stock count and an unread badge; these return every stock row and every notification.',
	},
	svcC: {
		stageId: 'svcC',
		title: 'Billing + Analytics endpoints',
		description:
			'The heaviest two calls: full billing line items and every analytics datapoint, for a screen that shows one monthly total and a top-3 list.',
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ─── Stress test scenarios (reward) ───────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'latency-compound',
		label: 'Open the dashboard on 4G',
		description: 'One request: one auth, one connection, one round trip',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'Same customer, same 4G connection, same dashboard.',
			'The app now makes ONE request to /api/v1/dashboard.',
			'The gateway authenticates once and gathers all five sections in-process (method calls, not network hops).',
			'One connection, one session check, one round trip: the repeated per-call auth and setup are gone.',
		],
	},
	{
		id: 'payload-overfetch',
		label: 'Load the dashboard on a metered connection',
		description: 'Gateway shapes a 6KB payload (was 480KB)',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'Same customer on the same metered data plan.',
			'The gateway asks each package reader for exactly what the screen shows.',
			'Counts, totals, and top-three lists come back: about 6KB.',
			'The 480KB of wholesale resources stays on the server where it belongs.',
		],
	},
	{
		id: 'section-down',
		label: 'Open the dashboard while analytics is erroring',
		description: 'Analytics falls back; the other sections render',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'Same analytics bug, same 500 from the metrics query.',
			'The gateway rescues that one section and reports the error.',
			'The response carries an "unavailable" marker for metrics only.',
			'The customer sees a full dashboard with one greyed-out tile instead of a blank screen.',
		],
	},
	{
		id: 'route-moved',
		label: 'Move the billing summary to a new path',
		description: 'Gateway remaps internally; shipped apps unaffected',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
		story: [
			'Same refactor: the billing route moves internally.',
			'The gateway keeps serving /api/v1/dashboard unchanged.',
			'Shipped app v2.13 never notices; no app-store release needed.',
			'The backend is free to reorganize behind the stable URL.',
		],
	},
	{
		id: 'rate-limit-burst',
		label: 'Bot bursts 100 requests in a minute',
		description: 'One rate limit at the single entry point: 429',
		method: 'GET',
		path: '/api/v1/dashboard (x100)',
		actor: 'bot',
		expectedResult: 'blocked',
		story: [
			'A bot fires 100 dashboard requests inside a minute.',
			'The single entry point counts them all against one limit.',
			'Request 61 receives 429 Too Many Requests before any section work runs.',
			'Everything behind the door is protected by one declaration.',
		],
	},
];

// ─── Build step definitions ───────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'generate-gateway', title: 'Generate Gateway Controller' },
	{ id: 'edge-auth', title: 'Authenticate Once at the Edge' },
	{ id: 'section-routing', title: 'Map Sections to Package Readers' },
	{ id: 'response-shaping', title: 'Shape One Payload for the Screen' },
	{ id: 'section-fallbacks', title: 'Per-Section Fallbacks' },
	{ id: 'rate-limiting', title: 'Rate Limit the Entry Point' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'option',
	'option',
	'option',
	'option',
	'option',
];

// ─── Step 0: Generate gateway controller (Terminal) ──────────────────

export const generateGatewayCommands: TerminalCommand[] = [
	{
		id: 'wrong-scaffold',
		label: 'bin/rails generate scaffold Gateway',
		command: 'bin/rails generate scaffold Gateway',
		correct: false,
		feedback:
			'A scaffold generates a database-backed CRUD resource: model, migration, the works. The dashboard entry point stores nothing; it assembles data that other parts of the app already own.',
	},
	{
		id: 'wrong-middleware',
		label: 'bin/rails generate middleware ApiGateway',
		command: 'bin/rails generate middleware ApiGateway',
		correct: false,
		feedback:
			'Rails has no middleware generator. A Rack layer also sits below routing, params, and rendering; this entry point needs the full request cycle.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate controller Api::V1::Gateway dashboard',
		command: 'bin/rails generate controller Api::V1::Gateway dashboard',
		correct: true,
	},
];

const generateGatewayOutput: TerminalOutputLine[] = [
	{
		text: 'create  app/controllers/api/v1/gateway_controller.rb',
		color: 'green',
	},
	{ text: 'route   get "api/v1/gateway/dashboard"', color: 'cyan' },
	{
		text: '# Generated path nests under gateway/. You will point the',
		color: 'muted',
	},
	{
		text: '# route at "api/v1/dashboard" when you wire up the sections.',
		color: 'muted',
	},
];

// ─── Steps 1-5 (OptionCard) ───────────────────────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const AUTH_OPTIONS: StepOption[] = [
	{
		id: 'per-section-auth',
		name: 'class Api::V1::GatewayController < ApplicationController\n  allow_unauthenticated_access\n  # each section reader verifies the user itself\nend',
		correct: false,
		feedback:
			'Six sections re-checking identity is the same repeated edge work the six client calls suffered. Identity belongs at the entry point, established once, then passed down.',
	},
	{
		id: 'correct',
		name: 'class Api::V1::GatewayController < ApplicationController\n  # Authentication concern (built in L9) already runs\n  # require_authentication before every action.\n  # Current.user is set once for the whole request;\n  # every section reader receives it as an argument.\nend',
		correct: true,
	},
	{
		id: 'revalidate-per-reader',
		name: 'def section(key)\n  revalidate_session!  # check the token again\n  SECTIONS.fetch(key).call(user: Current.user)\nend',
		correct: false,
		feedback:
			'The session was already verified when the request entered the app. Re-validating inside every reader multiplies the work by six and adds nothing: nobody new joined the request.',
	},
];

const ROUTING_OPTIONS: StepOption[] = [
	{
		id: 'http-to-self',
		name: 'SECTIONS = {\n  orders: "http://localhost:3000/api/v1/orders",\n  billing: "http://localhost:3000/api/v1/billing/summary",\n}\n\ndef section(key)\n  Net::HTTP.get(URI(SECTIONS.fetch(key)))\nend',
		correct: false,
		feedback:
			'Calling your own app over HTTP adds a full network round trip and request cycle per section. That recreates, inside the data center, the exact overhead the client suffered on 4G.',
	},
	{
		id: 'reach-into-internals',
		name: 'def section(key)\n  case key\n  when :billing\n    Billing::LedgerEntry.where(user: Current.user).sum(:amount)\n  when :orders\n    Order.where(user: Current.user).limit(3)\n  end\nend',
		correct: false,
		feedback:
			'This reaches past the package boundaries straight into another package’s private models. The boundary check in CI fails, and every internal refactor of those packages now breaks the dashboard.',
	},
	{
		id: 'correct',
		name: 'SECTIONS = {\n  orders: Orders::Public::DashboardSummary,\n  inventory: Inventory::Public::LowStock,\n  notifications: Notifications::Public::UnreadCount,\n  billing: Billing::Public::MonthSummary,\n  analytics: Analytics::Public::TopProducts,\n}\n\ndef section(key)\n  SECTIONS.fetch(key).call(user: Current.user)\nend',
		correct: true,
	},
];

const SHAPING_OPTIONS: StepOption[] = [
	{
		id: 'full-serializers',
		name: 'def dashboard\n  render json: {\n    orders: OrderSerializer.new(Current.user.orders),\n    billing: BillingSerializer.new(Current.user.invoices),\n    # ...full resources for all six sections\n  }\nend',
		correct: false,
		feedback:
			'This ships the same 480KB the six calls did, just inside one envelope. The screen needs a count, a total, and a top-three list per section, not whole resources.',
	},
	{
		id: 'correct',
		name: 'def dashboard\n  render json: {\n    orders: section(:orders),\n    inventory: section(:inventory),\n    notifications: section(:notifications),\n    billing: section(:billing),\n    analytics: section(:analytics),\n  }\nend\n# each reader returns exactly the fields the screen shows',
		correct: true,
	},
	{
		id: 'links-only',
		name: 'def dashboard\n  render json: {\n    links: SECTIONS.keys.map { |k| "/api/v1/#{k}" }\n  }\nend',
		correct: false,
		feedback:
			'Handing back six links keeps the client stitching sections over the network. The latency, the payload, and the coupling to internal paths all stay exactly as they were.',
	},
];

const FALLBACK_OPTIONS: StepOption[] = [
	{
		id: 'let-it-bubble',
		name: 'def section(key)\n  SECTIONS.fetch(key).call(user: Current.user)\nend\n# exceptions bubble up -> rescue_from renders 500',
		correct: false,
		feedback:
			'One section raising turns the entire dashboard into an error response. That is the same blank screen the customer had before; the gateway exists to render the sections that worked.',
	},
	{
		id: 'swallow-nil',
		name: 'def section(key)\n  SECTIONS.fetch(key).call(user: Current.user)\nrescue StandardError\n  nil\nend',
		correct: false,
		feedback:
			'A silent nil hands the problem to the client: every consumer must nil-check every section, and nobody ever hears the section failed. Report it, and return something the screen can render.',
	},
	{
		id: 'correct',
		name: 'def section(key)\n  SECTIONS.fetch(key).call(user: Current.user)\nrescue StandardError => e\n  Rails.error.report(e)\n  { status: "unavailable" }\nend',
		correct: true,
	},
];

const RATE_LIMIT_OPTIONS: StepOption[] = [
	{
		id: 'no-limit',
		name: 'class Api::V1::GatewayController < ApplicationController\n  # no limit here: each section endpoint\n  # already has its own rate limit\nend',
		correct: false,
		feedback:
			'The dashboard flow no longer touches those six endpoints; traffic arrives at one door now. Leave that door unmetered and a burst does six sections of work per request, unchecked.',
	},
	{
		id: 'hand-rolled-counter',
		name: 'before_action :check_rate\n\ndef check_rate\n  count = Rails.cache.increment(\n    "rate:#{request.remote_ip}", 1, expires_in: 1.minute)\n  head :too_many_requests if count > 60\nend',
		correct: false,
		feedback:
			'This re-implements counting, expiry, and the 429 by hand, and silently skips the response body and Retry-After details. The framework ships this exact behavior as one declaration.',
	},
	{
		id: 'correct',
		name: 'class Api::V1::GatewayController < ApplicationController\n  rate_limit to: 60, within: 1.minute,\n    by: -> { request.remote_ip },\n    with: -> {\n      render json: { error: "Rate limit exceeded" },\n        status: :too_many_requests\n    }\nend',
		correct: true,
	},
];

// ─── Option step config map ───────────────────────────────────────────

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Authenticate Once at the Edge',
		description:
			'Six separate calls meant six session checks per screen. The gateway is one entry point: where should identity be established?',
		options: AUTH_OPTIONS,
	},
	2: {
		title: 'Map Sections to Package Readers',
		description:
			'The dashboard data lives inside the packages you drew boundaries around. How should the gateway reach each section?',
		options: ROUTING_OPTIONS,
	},
	3: {
		title: 'Shape One Payload for the Screen',
		description:
			'The six endpoints returned 480KB of whole resources for a 6KB screen. What should the gateway respond with?',
		options: SHAPING_OPTIONS,
	},
	4: {
		title: 'Per-Section Fallbacks',
		description:
			'When analytics raised, the whole dashboard went blank. How should the gateway handle one section failing?',
		options: FALLBACK_OPTIONS,
	},
	5: {
		title: 'Rate Limit the Entry Point',
		description:
			'All dashboard traffic now arrives through one door. How should bursts be handled?',
		options: RATE_LIMIT_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateGatewayCommands, outputLines: generateGatewayOutput },
	null,
	null,
	null,
	null,
	null,
];

// ─── Code preview per phase/step ──────────────────────────────────────

const GATEWAY_SKELETON = `class Api::V1::GatewayController < ApplicationController
  def dashboard
    # TODO: serve the whole screen from here
  end
end`;

const GATEWAY_AUTH = `class Api::V1::GatewayController < ApplicationController
  # Authentication concern (L9) already runs
  # require_authentication before every action.
  # Current.user is available to every section reader.

  def dashboard
    # TODO: gather the sections
  end
end`;

const GATEWAY_SECTIONS = `class Api::V1::GatewayController < ApplicationController
  SECTIONS = {
    orders: Orders::Public::DashboardSummary,
    inventory: Inventory::Public::LowStock,
    notifications: Notifications::Public::UnreadCount,
    billing: Billing::Public::MonthSummary,
    analytics: Analytics::Public::TopProducts,
  }

  def dashboard
    # TODO: build the response from the sections
  end

  private

  def section(key)
    SECTIONS.fetch(key).call(user: Current.user)
  end
end`;

const GATEWAY_SHAPED = `class Api::V1::GatewayController < ApplicationController
  SECTIONS = {
    orders: Orders::Public::DashboardSummary,
    inventory: Inventory::Public::LowStock,
    notifications: Notifications::Public::UnreadCount,
    billing: Billing::Public::MonthSummary,
    analytics: Analytics::Public::TopProducts,
  }

  def dashboard
    render json: {
      orders: section(:orders),
      inventory: section(:inventory),
      notifications: section(:notifications),
      billing: section(:billing),
      analytics: section(:analytics),
    }
  end

  private

  def section(key)
    SECTIONS.fetch(key).call(user: Current.user)
  end
end`;

const GATEWAY_FALLBACKS = `class Api::V1::GatewayController < ApplicationController
  SECTIONS = {
    orders: Orders::Public::DashboardSummary,
    inventory: Inventory::Public::LowStock,
    notifications: Notifications::Public::UnreadCount,
    billing: Billing::Public::MonthSummary,
    analytics: Analytics::Public::TopProducts,
  }

  def dashboard
    render json: {
      orders: section(:orders),
      inventory: section(:inventory),
      notifications: section(:notifications),
      billing: section(:billing),
      analytics: section(:analytics),
    }
  end

  private

  def section(key)
    SECTIONS.fetch(key).call(user: Current.user)
  rescue StandardError => e
    Rails.error.report(e)
    { status: "unavailable" }
  end
end`;

const GATEWAY_FINAL = `class Api::V1::GatewayController < ApplicationController
  rate_limit to: 60, within: 1.minute,
    by: -> { request.remote_ip },
    with: -> {
      render json: { error: "Rate limit exceeded" },
        status: :too_many_requests
    }

  SECTIONS = {
    orders: Orders::Public::DashboardSummary,
    inventory: Inventory::Public::LowStock,
    notifications: Notifications::Public::UnreadCount,
    billing: Billing::Public::MonthSummary,
    analytics: Analytics::Public::TopProducts,
  }

  def dashboard
    render json: {
      orders: section(:orders),
      inventory: section(:inventory),
      notifications: section(:notifications),
      billing: section(:billing),
      analytics: section(:analytics),
    }
  end

  private

  def section(key)
    SECTIONS.fetch(key).call(user: Current.user)
  rescue StandardError => e
    Rails.error.report(e)
    { status: "unavailable" }
  end
end`;

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'config/routes.rb',
				language: 'ruby',
				code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      # The dashboard screen stitches together SIX of these:
      get "users/me", to: "users#me"
      resources :orders, only: [:index]
      get "stock", to: "inventory#index"
      resources :notifications, only: [:index]
      get "billing/summary", to: "billing#summary"
      get "metrics", to: "analytics#metrics"
    end
  end
end`,
				highlight: [4, 5, 6, 7, 8, 9, 10],
			},
			{
				filename: 'docs/mobile_dashboard_calls.md',
				language: 'markdown',
				code: `# How the shipped app builds the dashboard

One call at a time, six paths hardcoded in the binary:

    data.users         = GET /api/v1/users/me
    data.orders        = GET /api/v1/orders
    data.stock         = GET /api/v1/stock
    data.notifications = GET /api/v1/notifications
    data.billing       = GET /api/v1/billing/summary
    data.metrics       = GET /api/v1/metrics

Every call: one 4G round trip, one session check,
one full resource downloaded. If any call fails,
the screen shows a generic error.`,
			},
		];
	}

	const files = [];

	if (completedStep >= 0) {
		files.push({
			filename: 'app/controllers/api/v1/gateway_controller.rb',
			language: 'ruby',
			code:
				completedStep >= 5
					? GATEWAY_FINAL
					: completedStep >= 4
						? GATEWAY_FALLBACKS
						: completedStep >= 3
							? GATEWAY_SHAPED
							: completedStep >= 2
								? GATEWAY_SECTIONS
								: completedStep >= 1
									? GATEWAY_AUTH
									: GATEWAY_SKELETON,
		});
	} else {
		files.push({
			filename: 'app/controllers/api/v1/gateway_controller.rb',
			language: 'ruby',
			code: `# TODO: generate the gateway controller`,
		});
	}

	if (completedStep >= 2) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      # Replace the generated "gateway/dashboard" path with one
      # stable, screen-named entry point for the dashboard:
      get "dashboard", to: "gateway#dashboard"

      # The six section routes still exist for older
      # app versions; new releases call only the gateway.
    end
  end
end`,
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

// ─── Custom React Flow nodes ──────────────────────────────────────────

const ClientNode = memo(function ClientNode({
	data,
}: {
	data: ClientVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'CL',
		color: '#6366f1',
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
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
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
		icon: 'SV',
		color: '#71717a',
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
								: 'bg-muted text-muted-foreground'
					}`}
				>
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const GatewayEdge = memo(function GatewayEdge(props: EdgeProps) {
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

const gwNodeTypes = {
	client: ClientNode,
	gateway: GatewayNode,
	svcA: ServiceNode,
	svcB: ServiceNode,
	svcC: ServiceNode,
};
const gwEdgeTypes = { gw: GatewayEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level57APIGateway({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [clientState, setClientState] =
		useState<ClientVizState>(DEFAULT_CLIENT);
	const [gatewayState, setGatewayState] =
		useState<GatewayVizState>(DEFAULT_GATEWAY);
	const [svcAState, setSvcAState] = useState<ServiceVizState>(DEFAULT_SVC_A);
	const [svcBState, setSvcBState] = useState<ServiceVizState>(DEFAULT_SVC_B);
	const [svcCState, setSvcCState] = useState<ServiceVizState>(DEFAULT_SVC_C);
	const [edgeInState, setEdgeInState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setClientState(isReward ? DEFAULT_CLIENT_REWARD : DEFAULT_CLIENT);
		setGatewayState(isReward ? DEFAULT_GATEWAY_REWARD : DEFAULT_GATEWAY);
		setSvcAState(isReward ? DEFAULT_SVC_A_REWARD : DEFAULT_SVC_A);
		setSvcBState(isReward ? DEFAULT_SVC_B_REWARD : DEFAULT_SVC_B);
		setSvcCState(isReward ? DEFAULT_SVC_C_REWARD : DEFAULT_SVC_C);
		setEdgeInState(DEFAULT_EDGE);
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
		setEdgeCState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.client) setClientState((prev) => ({ ...prev, ...frame.client }));
		if (frame.gateway)
			setGatewayState((prev) => ({ ...prev, ...frame.gateway }));
		if (frame.svcA) setSvcAState((prev) => ({ ...prev, ...frame.svcA }));
		if (frame.svcB) setSvcBState((prev) => ({ ...prev, ...frame.svcB }));
		if (frame.svcC) setSvcCState((prev) => ({ ...prev, ...frame.svcC }));
		if (frame.edgeIn) setEdgeInState((prev) => ({ ...prev, ...frame.edgeIn }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
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
			// Reward: Client -> Gateway -> 3 services (fan-out)
			return [
				{
					id: 'client',
					type: 'client',
					position: { x: 250, y: 10 },
					data: clientState,
				},
				{
					id: 'gateway',
					type: 'gateway',
					position: { x: 225, y: 160 },
					data: gatewayState,
				},
				{
					id: 'svcA',
					type: 'svcA',
					position: { x: 30, y: 330 },
					data: svcAState,
				},
				{
					id: 'svcB',
					type: 'svcB',
					position: { x: 225, y: 330 },
					data: svcBState,
				},
				{
					id: 'svcC',
					type: 'svcC',
					position: { x: 430, y: 330 },
					data: svcCState,
				},
			];
		}
		// Observe: Client on left, 3 services on right (no gateway)
		return [
			{
				id: 'client',
				type: 'client',
				position: { x: 30, y: 140 },
				data: clientState,
			},
			{
				id: 'svcA',
				type: 'svcA',
				position: { x: 400, y: 10 },
				data: svcAState,
			},
			{
				id: 'svcB',
				type: 'svcB',
				position: { x: 400, y: 150 },
				data: svcBState,
			},
			{
				id: 'svcC',
				type: 'svcC',
				position: { x: 400, y: 290 },
				data: svcCState,
			},
		];
	}, [clientState, gatewayState, svcAState, svcBState, svcCState, isReward]);

	const flowEdges: Edge[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'edgeIn',
					source: 'client',
					target: 'gateway',
					type: 'gw',
					data: edgeInState,
				},
				{
					id: 'edgeA',
					source: 'gateway',
					target: 'svcA',
					type: 'gw',
					data: edgeAState,
				},
				{
					id: 'edgeB',
					source: 'gateway',
					target: 'svcB',
					type: 'gw',
					data: edgeBState,
				},
				{
					id: 'edgeC',
					source: 'gateway',
					target: 'svcC',
					type: 'gw',
					data: edgeCState,
				},
			];
		}
		// Observe: Client -> each service directly
		return [
			{
				id: 'edgeA',
				source: 'client',
				target: 'svcA',
				type: 'gw',
				data: edgeAState,
			},
			{
				id: 'edgeB',
				source: 'client',
				target: 'svcB',
				type: 'gw',
				data: edgeBState,
			},
			{
				id: 'edgeC',
				source: 'client',
				target: 'svcC',
				type: 'gw',
				data: edgeCState,
			},
		];
	}, [edgeInState, edgeAState, edgeBState, edgeCState, isReward]);

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
				'Gateway endpoint live! One authenticated request per screen, sections shaped for the client, per-section fallbacks, and one rate limit at the door.',
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
							edgeTypes={gwEdgeTypes}
							nodes={flowNodes}
							nodeTypes={gwNodeTypes}
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
							title="Gateway Probe"
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
								commands={generateGatewayCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										The dashboard data lives in five packages of the same app,
										behind six separate endpoints. Create the controller that
										will serve the whole screen from a single endpoint.
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
								outputLines={generateGatewayOutput}
								stepKey={stepper.currentStep}
								title="Generate Gateway Controller"
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
						edgeTypes={gwEdgeTypes}
						nodes={flowNodes}
						nodeTypes={gwNodeTypes}
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
							Your mobile app builds the dashboard from six sequential API calls
							to the same Rails app. Each round trip costs ~400ms on 4G,
							downloads a whole resource for a sliver of screen, and the six
							paths are baked into every shipped app version.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Build a gateway endpoint: one authenticated request per screen, a
							payload shaped for the screen, per-section fallbacks, and one
							stable URL that leaves the backend free to reorganize.
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

					{/* Reward: routing legend + counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Gateway Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Auth verified at gateway edge
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Zap className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											Section fallback / rate limit active
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
					actNumber={7}
					levelName="API Gateway"
					levelNumber={57}
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
					learningGoal="An API gateway gives clients one stable entry point per screen. The backend authenticates once, gathers each section from the packages that own the data, shapes the payload to what the screen shows, and stays free to reorganize internals without breaking shipped apps."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level57APIGateway;

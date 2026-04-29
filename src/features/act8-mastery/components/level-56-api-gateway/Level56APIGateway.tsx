/**
 * Level 54: API Gateway
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom FlowDiagram visualization.
 *   Mobile Client connects to 3 service host groups via 6 sequential round-trip
 *   arrows with different auth labels. Probes reveal latency, auth chaos,
 *   resilience gaps, and topology exposure.
 *
 * Phase 2 (HOW - build): 6 steps (1 terminal + 5 OptionCard)
 *   Step 0: Generate gateway controller (TerminalChoice)
 *   Step 1: Implement edge authentication (OptionCard)
 *   Step 2: Add request routing (OptionCard)
 *   Step 3: Add response aggregation (OptionCard)
 *   Step 4: Add circuit breakers (OptionCard)
 *   Step 5: Add rate limiting (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Gateway topology. Client -> Gateway -> 3 services.
 *   Stress test fires scenarios showing unified auth, parallel calls, circuit
 *   breakers, rate limiting, and topology hiding.
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

registerLevelCode('act8-level56-api-gateway', () =>
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
	label: 'Mobile Client',
	flash: 'idle',
	sublabel: 'Direct service calls',
};

const DEFAULT_SVC_A: ServiceVizState = {
	label: 'Users + Orders',
	flash: 'red',
	sublabel: 'JWT auth, port 3001',
	badge: null,
};

const DEFAULT_SVC_B: ServiceVizState = {
	label: 'Inventory + Notifications',
	flash: 'red',
	sublabel: 'API key auth, port 3002',
	badge: null,
};

const DEFAULT_SVC_C: ServiceVizState = {
	label: 'Billing + Analytics',
	flash: 'red',
	sublabel: 'Basic auth, port 3003',
	badge: null,
};

const DEFAULT_GATEWAY: GatewayVizState = {
	label: 'API Gateway',
	flash: 'green',
	sublabel: 'Unified entry point',
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
	label: 'Mobile Client',
	flash: 'green',
	sublabel: 'Single endpoint',
};

const DEFAULT_GATEWAY_REWARD: GatewayVizState = {
	label: 'API Gateway',
	flash: 'green',
	sublabel: 'Auth + Route + Aggregate',
	badge: null,
};

const DEFAULT_SVC_A_REWARD: ServiceVizState = {
	label: 'Users + Orders',
	flash: 'idle',
	sublabel: 'Internal only',
	badge: null,
};

const DEFAULT_SVC_B_REWARD: ServiceVizState = {
	label: 'Inventory + Notifications',
	flash: 'idle',
	sublabel: 'Internal only',
	badge: null,
};

const DEFAULT_SVC_C_REWARD: ServiceVizState = {
	label: 'Billing + Analytics',
	flash: 'idle',
	sublabel: 'Internal only',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'sequential-latency',
		label: 'Sequential calls cause compounding latency',
	},
	{ id: 'auth-chaos', label: 'Each service uses different auth mechanisms' },
	{
		id: 'no-resilience',
		label: 'One service failure cascades to entire dashboard',
	},
	{
		id: 'topology-leak',
		label: 'Client knows internal service hosts and ports',
	},
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'latency-compound',
		label: 'Load dashboard (6 sequential calls)',
		command:
			'GET /dashboard (users:3001 + orders:3001 + inventory:3002 + notifications:3002 + billing:3003 + analytics:3003)',
		responseLines: [
			{ text: 'users:3001      -> 200 OK (380ms)', color: 'yellow' },
			{ text: 'orders:3001     -> 200 OK (420ms)', color: 'yellow' },
			{ text: 'inventory:3002  -> 200 OK (350ms)', color: 'yellow' },
			{ text: 'notifications:3002 -> 200 OK (290ms)', color: 'yellow' },
			{ text: 'billing:3003    -> 200 OK (480ms)', color: 'red' },
			{ text: 'analytics:3003  -> 200 OK (480ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Total: 2400ms (6 sequential round trips)', color: 'red' },
			{
				text: 'Each call waits for the previous one to complete.',
				color: 'yellow',
			},
		],
		story: [
			'Customer opens the dashboard on their phone.',
			'The app makes 6 HTTP calls, one after another.',
			'Each call goes to a different host and port.',
			'Total wait time: 2400ms (sum of all calls).',
			'The customer stares at a spinner for 2.4 seconds.',
		],
	},
	{
		id: 'auth-inconsistency',
		label: 'Inspect auth mechanisms',
		command:
			'curl -v users:3001 && curl -v inventory:3002 && curl -v billing:3003',
		responseLines: [
			{ text: 'users:3001     -> Authorization: Bearer <jwt>', color: 'cyan' },
			{ text: 'inventory:3002 -> X-API-Key: sk_live_abc123', color: 'cyan' },
			{
				text: 'billing:3003   -> Authorization: Basic dXNlcjpwYXNz',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Three different auth mechanisms across three hosts.',
				color: 'red',
			},
			{
				text: 'Client must manage JWT, API key, and Basic auth.',
				color: 'yellow',
			},
		],
		story: [
			'You inspect the auth headers each service expects.',
			'Users service: JWT Bearer tokens.',
			'Inventory service: API key in X-API-Key header.',
			'Billing service: HTTP Basic authentication.',
			'The mobile client stores three sets of credentials.',
		],
	},
	{
		id: 'service-down',
		label: 'Orders service goes down',
		command: 'GET /dashboard (orders:3001 -> connection refused)',
		responseLines: [
			{ text: 'users:3001      -> 200 OK (380ms)', color: 'green' },
			{ text: 'orders:3001     -> CONNECTION REFUSED', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Dashboard render aborted. Entire page fails.', color: 'red' },
			{
				text: 'No circuit breaker. No fallback. No partial response.',
				color: 'yellow',
			},
		],
		story: [
			'The Orders service crashes during a deploy.',
			'Users service responds fine, but orders:3001 refuses connections.',
			'The client has no fallback logic.',
			'The entire dashboard fails, not just the orders section.',
			'One broken service takes down the whole experience.',
		],
	},
	{
		id: 'topology-exposed',
		label: 'Inspect client network config',
		command: 'cat mobile_app/config/services.yml',
		responseLines: [
			{ text: 'services:', color: 'cyan' },
			{ text: '  users:   host: users.internal:3001', color: 'cyan' },
			{ text: '  orders:  host: orders.internal:3001', color: 'cyan' },
			{ text: '  inventory: host: inventory.internal:3002', color: 'cyan' },
			{ text: '  billing: host: billing.internal:3003', color: 'cyan' },
			{ text: '', color: 'muted' },
			{ text: 'Internal hostnames and ports exposed to client.', color: 'red' },
			{
				text: 'Any service move requires a client app update.',
				color: 'yellow',
			},
		],
		story: [
			'You check the mobile app config for service endpoints.',
			'Every internal hostname and port is hardcoded.',
			'If you move billing to a new host, every client breaks.',
			'Attackers who decompile the app see your internal topology.',
			'Service discovery should be server-side, not client-side.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'latency-compound': ['sequential-latency'],
	'auth-inconsistency': ['auth-chaos'],
	'service-down': ['no-resilience'],
	'topology-exposed': ['topology-leak'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 4 nodes (Client, SvcA, SvcB, SvcC). No gateway node.
// edgeA = Client <-> SvcA, edgeB = Client <-> SvcB, edgeC = Client <-> SvcC

const LATENCY_FRAMES: AnimFrame[] = [
	{
		client: { label: 'GET /dashboard', flash: 'idle', sublabel: 'Call 1/6...' },
		svcA: {
			label: 'Users + Orders',
			flash: 'amber',
			sublabel: 'Processing...',
			badge: '800ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'JWT: users:3001',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'GET /dashboard',
			flash: 'amber',
			sublabel: 'Call 3/6...',
		},
		svcA: { flash: 'idle', sublabel: 'Done', badge: null },
		svcB: {
			label: 'Inventory + Notifications',
			flash: 'amber',
			sublabel: 'Processing...',
			badge: '640ms',
		},
		edgeA: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'API-Key: inventory:3002',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'GET /dashboard',
			flash: 'amber',
			sublabel: 'Call 5/6...',
		},
		svcB: { flash: 'idle', sublabel: 'Done', badge: null },
		svcC: {
			label: 'Billing + Analytics',
			flash: 'amber',
			sublabel: 'Processing...',
			badge: '960ms',
		},
		edgeB: { active: false, label: '' },
		edgeC: {
			active: true,
			reverse: false,
			label: 'Basic: billing:3003',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'red',
			sublabel: '2400ms total',
		},
		svcC: { flash: 'red', sublabel: '6 sequential calls', badge: '2400ms' },
		edgeC: {
			active: true,
			reverse: true,
			label: '2400ms total',
			dotColor: '#ef4444',
		},
	},
];

const AUTH_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'Auth check',
			flash: 'idle',
			sublabel: 'JWT for users...',
		},
		svcA: { flash: 'amber', sublabel: 'Bearer <jwt>', badge: 'JWT' },
		edgeA: {
			active: true,
			reverse: false,
			label: 'Authorization: Bearer',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: 'Auth check',
			flash: 'amber',
			sublabel: 'API key for inventory...',
		},
		svcA: { flash: 'idle', sublabel: 'JWT auth', badge: null },
		svcB: {
			flash: 'amber',
			sublabel: 'X-API-Key: sk_live_...',
			badge: 'API Key',
		},
		edgeA: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'X-API-Key: sk_live_...',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: 'Auth check',
			flash: 'red',
			sublabel: '3 different auth schemes',
		},
		svcB: { flash: 'idle', sublabel: 'API key auth', badge: null },
		svcC: { flash: 'amber', sublabel: 'Basic dXNlcjpwYXNz', badge: 'Basic' },
		edgeB: { active: false, label: '' },
		edgeC: {
			active: true,
			reverse: false,
			label: 'Authorization: Basic',
			dotColor: '#f59e0b',
		},
	},
];

const SERVICE_DOWN_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /dashboard',
			flash: 'idle',
			sublabel: 'Fetching users...',
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: '380ms' },
		edgeA: {
			active: true,
			reverse: true,
			label: 'users:3001 -> 200 OK',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'GET /dashboard',
			flash: 'amber',
			sublabel: 'Fetching orders...',
		},
		svcA: { flash: 'red', sublabel: 'CONNECTION REFUSED', badge: 'DOWN' },
		edgeA: {
			active: true,
			reverse: false,
			label: 'orders:3001 -> REFUSED',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Dashboard FAILED',
			flash: 'red',
			sublabel: 'No fallback',
		},
		svcA: { flash: 'red', sublabel: 'Service down', badge: 'DOWN' },
		svcB: { flash: 'idle', sublabel: 'Never reached' },
		svcC: { flash: 'idle', sublabel: 'Never reached' },
		edgeA: { active: false, label: '' },
	},
];

const TOPOLOGY_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'Mobile App Config',
			flash: 'red',
			sublabel: 'Internal hosts exposed',
		},
		svcA: { flash: 'red', sublabel: 'users.internal:3001', badge: 'EXPOSED' },
		svcB: {
			flash: 'red',
			sublabel: 'inventory.internal:3002',
			badge: 'EXPOSED',
		},
		svcC: { flash: 'red', sublabel: 'billing.internal:3003', badge: 'EXPOSED' },
		edgeA: {
			active: true,
			reverse: false,
			label: 'users.internal:3001',
			dotColor: '#ef4444',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'inventory.internal:3002',
			dotColor: '#ef4444',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'billing.internal:3003',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: 'Decompiled APK',
			flash: 'red',
			sublabel: 'Attacker sees topology',
		},
		svcA: {
			flash: 'red',
			sublabel: 'Direct access possible',
			badge: 'EXPOSED',
		},
		svcB: {
			flash: 'red',
			sublabel: 'Direct access possible',
			badge: 'EXPOSED',
		},
		svcC: {
			flash: 'red',
			sublabel: 'Direct access possible',
			badge: 'EXPOSED',
		},
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'latency-compound': LATENCY_FRAMES,
	'auth-inconsistency': AUTH_FRAMES,
	'service-down': SERVICE_DOWN_FRAMES,
	'topology-exposed': TOPOLOGY_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: 5 nodes (Client, Gateway, SvcA, SvcB, SvcC).
// edgeIn = Client <-> Gateway, edgeA = Gateway <-> SvcA,
// edgeB = Gateway <-> SvcB, edgeC = Gateway <-> SvcC

const REWARD_DASHBOARD_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'Single request...',
		},
		gateway: {
			label: 'API Gateway',
			flash: 'amber',
			sublabel: 'Aggregating...',
			badge: 'parallel',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'JWT verified at edge',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'green',
			sublabel: 'Fan-out to 3 services',
			badge: 'parallel',
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: '120ms' },
		svcB: { flash: 'green', sublabel: '200 OK', badge: '95ms' },
		svcC: { flash: 'green', sublabel: '200 OK', badge: '130ms' },
		edgeA: {
			active: true,
			reverse: true,
			label: 'users + orders',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: 'inventory + notifications',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: 'billing + analytics',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: '150ms (was 2400ms)',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Aggregated response',
			badge: '150ms',
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK (150ms)',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const REWARD_AUTH_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/users',
			flash: 'idle',
			sublabel: 'Sending JWT...',
		},
		gateway: {
			label: 'API Gateway',
			flash: 'amber',
			sublabel: 'Verifying JWT...',
			badge: 'auth',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'Bearer <jwt>',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: { flash: 'green', sublabel: 'JWT valid, routing...', badge: null },
		svcA: { flash: 'green', sublabel: '200 OK', badge: '45ms' },
		edgeA: {
			active: true,
			reverse: true,
			label: 'internal (no auth needed)',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Response received',
			flash: 'green',
			sublabel: 'One auth mechanism',
		},
		gateway: { flash: 'green', sublabel: 'Unified JWT at edge', badge: null },
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK (45ms)',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
	},
];

const REWARD_SERVICE_DOWN_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'Single request...',
		},
		gateway: {
			label: 'API Gateway',
			flash: 'amber',
			sublabel: 'Routing to services...',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'JWT verified',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'amber',
			sublabel: 'Circuit breaker: orders open',
			badge: 'fallback',
		},
		svcA: { flash: 'red', sublabel: 'Orders DOWN', badge: 'CIRCUIT OPEN' },
		svcB: { flash: 'green', sublabel: '200 OK', badge: '95ms' },
		svcC: { flash: 'green', sublabel: '200 OK', badge: '130ms' },
		edgeA: {
			active: true,
			reverse: false,
			label: 'circuit open -> fallback',
			dotColor: '#f59e0b',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Partial dashboard',
			flash: 'green',
			sublabel: 'Degraded gracefully',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Fallback for orders',
			badge: '150ms',
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

const REWARD_SLOW_SERVICE_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'Single request...',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Routing to services...',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'JWT verified',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'amber',
			sublabel: 'Billing timeout (500ms)',
			badge: 'timeout',
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: '120ms' },
		svcB: { flash: 'green', sublabel: '200 OK', badge: '95ms' },
		svcC: { flash: 'red', sublabel: 'TIMEOUT 500ms', badge: 'SLOW' },
		edgeA: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'timeout -> fallback',
			dotColor: '#f59e0b',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: 'Billing used fallback',
		},
		gateway: { flash: 'green', sublabel: 'Timeout + fallback', badge: '150ms' },
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

const REWARD_DIRECT_ACCESS_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET users.internal:3001',
			flash: 'red',
			sublabel: 'Trying direct access...',
		},
		svcA: { flash: 'idle', sublabel: 'Internal only' },
		edgeIn: { active: false, label: '' },
	},
	{
		client: {
			label: 'CONNECTION REFUSED',
			flash: 'red',
			sublabel: 'Firewall blocked',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Only entry point',
			badge: 'firewall',
		},
		svcA: { flash: 'idle', sublabel: 'Not directly accessible' },
	},
];

const REWARD_RATE_LIMITED_FRAMES: AnimFrame[] = [
	{
		client: {
			label: '100 requests/sec',
			flash: 'amber',
			sublabel: 'Burst traffic...',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Rate limit: 60/min',
			badge: 'checking',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: '100 req/sec burst',
			dotColor: '#ef4444',
		},
	},
	{
		client: {
			label: '429 Too Many Requests',
			flash: 'red',
			sublabel: 'Rate limited at gateway',
		},
		gateway: { flash: 'red', sublabel: 'Exceeded 60/min', badge: '429' },
		svcA: { flash: 'idle', sublabel: 'Protected' },
		svcB: { flash: 'idle', sublabel: 'Protected' },
		svcC: { flash: 'idle', sublabel: 'Protected' },
		edgeIn: {
			active: true,
			reverse: true,
			label: '429 Too Many Requests',
			dotColor: '#ef4444',
		},
	},
];

const REWARD_LATENCY_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/dashboard',
			flash: 'idle',
			sublabel: 'Single request...',
		},
		gateway: {
			flash: 'amber',
			sublabel: 'Parallel fan-out...',
			badge: 'aggregating',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'JWT verified',
			dotColor: '#22c55e',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'parallel',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'parallel',
			dotColor: '#22c55e',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'parallel',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Dashboard loaded',
			flash: 'green',
			sublabel: '150ms (was 2400ms)',
		},
		gateway: {
			flash: 'green',
			sublabel: '1 request, 150ms',
			badge: '16x faster',
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: '120ms' },
		svcB: { flash: 'green', sublabel: '200 OK', badge: '95ms' },
		svcC: { flash: 'green', sublabel: '200 OK', badge: '130ms' },
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK (150ms)',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const REWARD_AUTH_INCONSISTENCY_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET /api/v1/users',
			flash: 'idle',
			sublabel: 'Sending JWT...',
		},
		gateway: {
			label: 'API Gateway',
			flash: 'amber',
			sublabel: 'Verifying JWT...',
			badge: 'unified auth',
		},
		edgeIn: {
			active: true,
			reverse: false,
			label: 'Bearer <jwt>',
			dotColor: '#22c55e',
		},
	},
	{
		gateway: {
			flash: 'green',
			sublabel: 'JWT valid, routing...',
			badge: null,
		},
		svcA: { flash: 'green', sublabel: '200 OK', badge: '45ms' },
		svcB: { flash: 'idle', sublabel: 'Internal only' },
		svcC: { flash: 'idle', sublabel: 'Internal only' },
		edgeA: {
			active: true,
			reverse: true,
			label: 'internal (no auth needed)',
			dotColor: '#22c55e',
		},
	},
	{
		client: {
			label: 'Response received',
			flash: 'green',
			sublabel: 'Unified JWT at gateway edge',
		},
		gateway: {
			flash: 'green',
			sublabel: 'All services use same token',
			badge: null,
		},
		edgeIn: {
			active: true,
			reverse: true,
			label: '200 OK',
			dotColor: '#22c55e',
		},
		edgeA: { active: false, label: '' },
	},
];

const REWARD_TOPOLOGY_EXPOSED_FRAMES: AnimFrame[] = [
	{
		client: {
			label: 'GET users.internal:3001',
			flash: 'red',
			sublabel: 'Trying direct access...',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Only entry point',
			badge: 'firewall',
		},
		svcA: { flash: 'idle', sublabel: 'Internal only' },
	},
	{
		client: {
			label: 'CONNECTION REFUSED',
			flash: 'red',
			sublabel: 'Internal hosts hidden',
		},
		gateway: {
			flash: 'green',
			sublabel: 'Client only knows gateway URL',
			badge: 'topology hidden',
		},
		svcA: { flash: 'idle', sublabel: 'Not directly accessible' },
		svcB: { flash: 'idle', sublabel: 'Not directly accessible' },
		svcC: { flash: 'idle', sublabel: 'Not directly accessible' },
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'dashboard-load': REWARD_DASHBOARD_FRAMES,
	'auth-at-edge': REWARD_AUTH_FRAMES,
	'auth-inconsistency': REWARD_AUTH_INCONSISTENCY_FRAMES,
	'service-down': REWARD_SERVICE_DOWN_FRAMES,
	'slow-service': REWARD_SLOW_SERVICE_FRAMES,
	'direct-access': REWARD_DIRECT_ACCESS_FRAMES,
	'topology-exposed': REWARD_TOPOLOGY_EXPOSED_FRAMES,
	'rate-exceeded': REWARD_RATE_LIMITED_FRAMES,
	'latency-compound': REWARD_LATENCY_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	client: {
		stageId: 'client',
		title: 'Mobile Client',
		description:
			'The mobile app connects directly to each backend service. It stores internal hostnames, ports, and three different auth credential sets. Any service topology change requires an app update and redeployment.',
	},
	svcA: {
		stageId: 'svcA',
		title: 'Users + Orders Service',
		description:
			'Handles user profiles and order management. Uses JWT Bearer token authentication. Runs on port 3001. No rate limiting, no circuit breakers.',
		code: `# Users + Orders service (port 3001)
class ApplicationController < ActionController::API
  before_action :authenticate_jwt!

  private

  def authenticate_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end
end`,
	},
	svcB: {
		stageId: 'svcB',
		title: 'Inventory + Notifications Service',
		description:
			'Manages stock levels and push notifications. Uses API key authentication via X-API-Key header. Runs on port 3002. No shared auth with other services.',
		code: `# Inventory + Notifications service (port 3002)
class ApplicationController < ActionController::API
  before_action :authenticate_api_key!

  private

  def authenticate_api_key!
    key = request.headers["X-API-Key"]
    unless ApiKey.active.exists?(token: key)
      render json: { error: "Invalid API key" }, status: :forbidden
    end
  end
end`,
	},
	svcC: {
		stageId: 'svcC',
		title: 'Billing + Analytics Service',
		description:
			'Processes payments and tracks metrics. Uses HTTP Basic authentication. Runs on port 3003. Credentials hardcoded in mobile app config.',
		code: `# Billing + Analytics service (port 3003)
class ApplicationController < ActionController::API
  include ActionController::HttpAuthentication::Basic::ControllerMethods
  before_action :authenticate_basic!

  private

  def authenticate_basic!
    authenticate_or_request_with_http_basic do |user, pass|
      user == "billing_client" && pass == "s3cret"
    end
  end
end`,
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	client: 'topology-leak',
	svcA: 'auth-chaos',
	svcC: 'auth-chaos',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'dashboard-load',
		label: 'Aggregated dashboard load',
		description: '1 request, parallel fan-out, 150ms',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'auth-at-edge',
		label: 'Single JWT at gateway',
		description: 'Unified auth, no per-service credentials',
		method: 'GET',
		path: '/api/v1/users',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'auth-inconsistency',
		label: 'Unified JWT at gateway edge',
		description: 'All services use same token, no per-service credentials',
		method: 'GET',
		path: '/api/v1/users',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'topology-exposed',
		label: 'Direct internal service access (topology hidden)',
		description: 'Client only knows gateway URL, internal hosts hidden',
		method: 'GET',
		path: 'users.internal:3001/api/v1/users',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'service-down',
		label: 'Orders service down (circuit breaker)',
		description: 'Circuit breaker returns fallback data',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'slow-service',
		label: 'Billing slow (timeout + fallback)',
		description: 'Gateway times out, returns cached data',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'direct-access',
		label: 'Direct internal service access',
		description: 'Client tries to bypass gateway',
		method: 'GET',
		path: 'users.internal:3001/api/v1/users',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'rate-exceeded',
		label: 'Burst traffic (100 req/sec)',
		description: 'Rate limited at gateway edge',
		method: 'GET',
		path: '/api/v1/products (x100)',
		actor: 'bot',
		expectedResult: 'blocked',
	},
	{
		id: 'latency-compound',
		label: 'Dashboard load (was 2400ms)',
		description: 'Now 150ms via parallel aggregation',
		method: 'GET',
		path: '/api/v1/dashboard',
		actor: 'customer',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-gateway', title: 'Generate Gateway Controller' },
	{ id: 'edge-auth', title: 'Edge Authentication' },
	{ id: 'request-routing', title: 'Request Routing' },
	{ id: 'response-aggregation', title: 'Response Aggregation' },
	{ id: 'circuit-breakers', title: 'Circuit Breakers' },
	{ id: 'rate-limiting', title: 'Rate Limiting' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: generate gateway
	'option', // 1: edge auth
	'option', // 2: request routing
	'option', // 3: response aggregation
	'option', // 4: circuit breakers
	'option', // 5: rate limiting
];

// ─── Step 0: Generate gateway controller (Terminal) ──────────────────

const generateGatewayCommands: TerminalCommand[] = [
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold Gateway',
		command: 'rails generate scaffold Gateway',
		correct: false,
		feedback:
			'A scaffold generates a full CRUD resource with model, migration, and views. The gateway is a routing controller, not a database-backed resource.',
	},
	{
		id: 'wrong-middleware',
		label: 'rails generate middleware ApiGateway',
		command: 'rails generate middleware ApiGateway',
		correct: false,
		feedback:
			'Rails does not have a middleware generator. The gateway needs to be a controller that handles routing, auth, and aggregation within the request cycle.',
	},
	{
		id: 'correct',
		label: 'rails generate controller Api::Gateway dashboard',
		command: 'rails generate controller Api::Gateway dashboard',
		correct: true,
	},
];

const generateGatewayOutput: TerminalOutputLine[] = [
	{ text: 'create  app/controllers/api/gateway_controller.rb', color: 'green' },
	{ text: 'route   get "api/gateway/dashboard"', color: 'cyan' },
];

// ─── Step 1: Edge authentication (OptionCard) ─────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const AUTH_OPTIONS: StepOption[] = [
	{
		id: 'per-service',
		name: 'before_action :forward_credentials\n\ndef forward_credentials\n  # Pass client credentials to each service\n  @headers = request.headers.to_h\nend',
		correct: false,
		feedback:
			'Forwarding raw client credentials defeats the purpose of a gateway. The gateway should verify identity once, then make internal calls with trusted service credentials.',
	},
	{
		id: 'correct',
		name: 'before_action :verify_jwt!\n\ndef verify_jwt!\n  token = request.headers["Authorization"]&.split(" ")&.last\n  @current_user = JWT.decode(token, Rails.application.secret_key_base)\nrescue JWT::DecodeError\n  render json: { error: "Unauthorized" }, status: :unauthorized\nend',
		correct: true,
	},
	{
		id: 'no-auth',
		name: 'skip_before_action :verify_authenticity_token\n\n# Services handle their own auth\n# Gateway is just a proxy',
		correct: false,
		feedback:
			'Skipping auth at the gateway means every internal service must implement its own auth. That is exactly the inconsistent auth problem you discovered in the observe phase.',
	},
];

// ─── Step 2: Request routing (OptionCard) ─────────────────────────────

const ROUTING_OPTIONS: StepOption[] = [
	{
		id: 'hardcoded',
		name: 'SERVICE_URLS = {\n  users: "http://users.internal:3001",\n  orders: "http://orders.internal:3001",\n}\n\ndef route_request\n  url = SERVICE_URLS[params[:service]]\n  HTTParty.get(url + request.path)',
		correct: false,
		feedback:
			'Hardcoded URLs and a raw HTTP library provide no connection pooling, no timeouts, and no middleware. The gateway needs a resilient HTTP client with configurable adapters.',
	},
	{
		id: 'correct',
		name: 'SERVICES = {\n  users: "http://users.internal:3001",\n  orders: "http://orders.internal:3001",\n  inventory: "http://inventory.internal:3002",\n  billing: "http://billing.internal:3003",\n}\n\ndef route_to(service, path)\n  conn = Faraday.new(url: SERVICES[service]) do |f|\n    f.request :json\n    f.response :json\n    f.adapter Faraday.default_adapter\n  end\n  conn.get(path)\nend',
		correct: true,
	},
	{
		id: 'dns-only',
		name: 'def route_request\n  # Use DNS service discovery\n  redirect_to "http://#{params[:service]}.internal/#{request.path}"\nend',
		correct: false,
		feedback:
			'Redirecting the client to internal service URLs exposes your topology. The gateway must proxy requests, not redirect. The client should never know about internal hosts.',
	},
];

// ─── Step 3: Response aggregation (OptionCard) ────────────────────────

const AGGREGATION_OPTIONS: StepOption[] = [
	{
		id: 'sequential',
		name: 'def dashboard\n  users = route_to(:users, "/api/v1/users/me")\n  orders = route_to(:orders, "/api/v1/orders")\n  inventory = route_to(:inventory, "/api/v1/stock")\n  render json: { users: users.body, orders: orders.body, inventory: inventory.body }\nend',
		correct: false,
		feedback:
			'Sequential calls still produce compounding latency. Three 100ms calls take 300ms total. The gateway should make parallel calls so total time equals the slowest single call.',
	},
	{
		id: 'wrong-no-fallback',
		name: 'def dashboard\n  threads = {\n    users: Thread.new { route_to(:users, "/api/v1/users/me") },\n    orders: Thread.new { route_to(:orders, "/api/v1/orders") },\n  }\n  render json: threads.transform_values { |t| t.value.body }\nend',
		correct: false,
		feedback:
			'Raw threads with no error handling means one failed service crashes the entire request. The gateway needs fetch_or_default to return fallback data when a service is unavailable.',
	},
	{
		id: 'correct',
		name: 'def dashboard\n  results = {}\n  threads = DASHBOARD_SERVICES.map do |key, path|\n    Thread.new { results[key] = fetch_or_default(key, path) }\n  end\n  threads.each(&:join)\n  render json: results\nend\n\ndef fetch_or_default(service, path)\n  route_to(service, path).body\nrescue Faraday::Error\n  { error: "unavailable", cached: true }\nend',
		correct: true,
	},
];

// ─── Step 4: Circuit breakers (OptionCard) ────────────────────────────

const CIRCUIT_OPTIONS: StepOption[] = [
	{
		id: 'retry-loop',
		name: 'def route_to(service, path)\n  3.times do |attempt|\n    response = Faraday.get(SERVICES[service] + path)\n    return response if response.success?\n    sleep(attempt * 2)\n  end\nend',
		correct: false,
		feedback:
			'Retry loops with sleep keep hammering a failing service and block the request thread. A circuit breaker detects failure patterns and stops sending requests entirely until the service recovers.',
	},
	{
		id: 'correct',
		name: 'def route_to(service, path)\n  Stoplight("gateway:#{service}")\n    .with_cool_off_time(30)\n    .with_threshold(3)\n    .run { Faraday.get(SERVICES[service] + path) }\n    .fallback { |_e| OpenStruct.new(body: { error: "unavailable" }) }\nend',
		correct: true,
	},
	{
		id: 'ignore-errors',
		name: 'def route_to(service, path)\n  Faraday.get(SERVICES[service] + path)\nrescue StandardError\n  nil\nend',
		correct: false,
		feedback:
			'Silently returning nil means downstream code must handle nil everywhere. A circuit breaker pattern returns structured fallback data and prevents cascading failures by stopping calls to a known-broken service.',
	},
];

// ─── Step 5: Rate limiting (OptionCard) ───────────────────────────────

const RATE_LIMIT_OPTIONS: StepOption[] = [
	{
		id: 'no-limit',
		name: 'class Api::GatewayController < ApplicationController\n  # No rate limiting needed,\n  # services handle their own limits\nend',
		correct: false,
		feedback:
			'Without gateway-level rate limiting, a burst of traffic passes straight through to all backend services. Rate limiting at the edge protects every service behind the gateway at once.',
	},
	{
		id: 'correct',
		name: 'class Api::GatewayController < ApplicationController\n  rate_limit to: 60, within: 1.minute, by: -> { request.remote_ip },\n    with: -> { render json: { error: "Rate limit exceeded" }, status: :too_many_requests }\nend',
		correct: true,
	},
	{
		id: 'custom-counter',
		name: 'class Api::GatewayController < ApplicationController\n  before_action :check_rate_limit\n\n  def check_rate_limit\n    count = $redis.incr("rate:#{request.ip}")\n    $redis.expire("rate:#{request.ip}", 60) if count == 1\n    head :too_many_requests if count > 60\n  end\nend',
		correct: false,
		feedback:
			'A custom Redis counter works but duplicates what Rails 8 provides natively. The built-in rate limiting macro handles counting, expiry, and response rendering with less code and no external dependency.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Implement Edge Authentication',
		description:
			'The gateway is the single entry point. It must verify identity before routing to any backend service. How should the gateway handle authentication?',
		options: AUTH_OPTIONS,
	},
	2: {
		title: 'Add Request Routing',
		description:
			'With auth verified, the gateway must route requests to the correct internal service. The client sends requests to the gateway; the gateway proxies them to internal services. How should routing work?',
		options: ROUTING_OPTIONS,
	},
	3: {
		title: 'Add Response Aggregation',
		description:
			'The dashboard needs data from multiple services. Instead of making 6 sequential calls, the gateway should aggregate responses in a single request. How should the dashboard endpoint work?',
		options: AGGREGATION_OPTIONS,
	},
	4: {
		title: 'Add Circuit Breakers',
		description:
			'Backend services can fail or slow down. The gateway needs to detect failures and stop sending traffic to broken services. How should the gateway handle downstream failures?',
		options: CIRCUIT_OPTIONS,
	},
	5: {
		title: 'Add Rate Limiting',
		description:
			'The gateway is the single entry point for all traffic. A burst of requests could overwhelm backend services. How should the gateway limit request rates?',
		options: RATE_LIMIT_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateGatewayCommands, outputLines: generateGatewayOutput },
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
				filename: 'mobile_app/config/services.yml',
				language: 'yaml',
				code: `# Mobile app service configuration
services:
  users:
    host: users.internal:3001
    auth: jwt_bearer
  orders:
    host: orders.internal:3001
    auth: jwt_bearer
  inventory:
    host: inventory.internal:3002
    auth: api_key
  notifications:
    host: notifications.internal:3002
    auth: api_key
  billing:
    host: billing.internal:3003
    auth: basic
  analytics:
    host: analytics.internal:3003
    auth: hmac`,
				highlight: [4, 5, 9, 10, 14, 15],
			},
			{
				filename: 'app/controllers/dashboard_controller.rb',
				language: 'ruby',
				code: `class DashboardController < ApplicationController
  def show
    # 6 sequential calls to 3 different hosts
    users = HTTP.auth("Bearer #{jwt}").get("users.internal:3001/me")
    orders = HTTP.auth("Bearer #{jwt}").get("orders.internal:3001/list")
    inventory = HTTP.headers("X-API-Key" => api_key).get("inventory.internal:3002/stock")
    notifications = HTTP.headers("X-API-Key" => api_key).get("notifications.internal:3002/unread")
    billing = HTTP.basic_auth("client", "s3cret").get("billing.internal:3003/summary")
    analytics = HTTP.headers("X-HMAC" => hmac).get("analytics.internal:3003/metrics")

    render json: { users:, orders:, inventory:, notifications:, billing:, analytics: }
  end
end`,
				highlight: [4, 5, 6, 7, 8, 9],
			},
		];
	}

	const files = [];

	// Step 0 complete: gateway controller generated
	if (completedStep >= 0) {
		files.push({
			filename: 'app/controllers/api/gateway_controller.rb',
			language: 'ruby',
			code:
				completedStep >= 1
					? completedStep >= 2
						? completedStep >= 3
							? completedStep >= 4
								? completedStep >= 5
									? `class Api::GatewayController < ApplicationController
  rate_limit to: 60, within: 1.minute, by: -> { request.remote_ip },
    with: -> { render json: { error: "Rate limit exceeded" }, status: :too_many_requests }

  before_action :verify_jwt!

  SERVICES = {
    users: "http://users.internal:3001",
    orders: "http://orders.internal:3001",
    inventory: "http://inventory.internal:3002",
    billing: "http://billing.internal:3003",
  }

  DASHBOARD_SERVICES = {
    users: "/api/v1/users/me",
    orders: "/api/v1/orders",
    inventory: "/api/v1/stock",
    billing: "/api/v1/billing/summary",
  }

  def dashboard
    results = {}
    threads = DASHBOARD_SERVICES.map do |key, path|
      Thread.new { results[key] = fetch_or_default(key, path) }
    end
    threads.each(&:join)
    render json: results
  end

  private

  def verify_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    @current_user = JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def route_to(service, path)
    Stoplight("gateway:#{service}")
      .with_cool_off_time(30)
      .with_threshold(3)
      .run { Faraday.get(SERVICES[service] + path) }
      .fallback { |_e| OpenStruct.new(body: { error: "unavailable" }) }
  end

  def fetch_or_default(service, path)
    route_to(service, path).body
  rescue Faraday::Error
    { error: "unavailable", cached: true }
  end
end`
									: `class Api::GatewayController < ApplicationController
  before_action :verify_jwt!

  SERVICES = {
    users: "http://users.internal:3001",
    orders: "http://orders.internal:3001",
    inventory: "http://inventory.internal:3002",
    billing: "http://billing.internal:3003",
  }

  DASHBOARD_SERVICES = {
    users: "/api/v1/users/me",
    orders: "/api/v1/orders",
    inventory: "/api/v1/stock",
    billing: "/api/v1/billing/summary",
  }

  def dashboard
    results = {}
    threads = DASHBOARD_SERVICES.map do |key, path|
      Thread.new { results[key] = fetch_or_default(key, path) }
    end
    threads.each(&:join)
    render json: results
  end

  private

  def verify_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    @current_user = JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def route_to(service, path)
    Stoplight("gateway:#{service}")
      .with_cool_off_time(30)
      .with_threshold(3)
      .run { Faraday.get(SERVICES[service] + path) }
      .fallback { |_e| OpenStruct.new(body: { error: "unavailable" }) }
  end

  def fetch_or_default(service, path)
    route_to(service, path).body
  rescue Faraday::Error
    { error: "unavailable", cached: true }
  end
end`
								: `class Api::GatewayController < ApplicationController
  before_action :verify_jwt!

  SERVICES = {
    users: "http://users.internal:3001",
    orders: "http://orders.internal:3001",
    inventory: "http://inventory.internal:3002",
    billing: "http://billing.internal:3003",
  }

  DASHBOARD_SERVICES = {
    users: "/api/v1/users/me",
    orders: "/api/v1/orders",
    inventory: "/api/v1/stock",
    billing: "/api/v1/billing/summary",
  }

  def dashboard
    results = {}
    threads = DASHBOARD_SERVICES.map do |key, path|
      Thread.new { results[key] = fetch_or_default(key, path) }
    end
    threads.each(&:join)
    render json: results
  end

  private

  def verify_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    @current_user = JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def route_to(service, path)
    conn = Faraday.new(url: SERVICES[service]) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
    conn.get(path)
  end

  def fetch_or_default(service, path)
    route_to(service, path).body
  rescue Faraday::Error
    { error: "unavailable", cached: true }
  end
end`
							: `class Api::GatewayController < ApplicationController
  before_action :verify_jwt!

  SERVICES = {
    users: "http://users.internal:3001",
    orders: "http://orders.internal:3001",
    inventory: "http://inventory.internal:3002",
    billing: "http://billing.internal:3003",
  }

  def dashboard
    # TODO: aggregate responses from services
  end

  private

  def verify_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    @current_user = JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def route_to(service, path)
    conn = Faraday.new(url: SERVICES[service]) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
    conn.get(path)
  end
end`
						: `class Api::GatewayController < ApplicationController
  before_action :verify_jwt!

  def dashboard
    # TODO: add routing and aggregation
  end

  private

  def verify_jwt!
    token = request.headers["Authorization"]&.split(" ")&.last
    @current_user = JWT.decode(token, Rails.application.secret_key_base)
  rescue JWT::DecodeError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end
end`
					: `class Api::GatewayController < ApplicationController
  def dashboard
    # TODO: implement gateway logic
  end
end`,
		});
	} else {
		files.push({
			filename: 'app/controllers/api/gateway_controller.rb',
			language: 'ruby',
			code: `# TODO: generate gateway controller`,
		});
	}

	// Step 2+: routes file showing gateway routing
	if (completedStep >= 2) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "dashboard", to: "gateway#dashboard"
      # All external requests go through the gateway
      # Internal services are not exposed in routes
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

export function Level56APIGateway({ onComplete }: LevelComponentProps) {
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
				'API Gateway configured! Unified entry point with auth, routing, aggregation, circuit breakers, and rate limiting.',
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
					<div className="px-6 pb-2">
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
										Your microservices are exposed directly to clients. Create a
										gateway controller that will centralize authentication,
										routing, and response aggregation behind a single endpoint.
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
							Your mobile app calls 6 microservice endpoints directly across 3
							different hosts. Each uses a different auth mechanism (JWT, API
							key, Basic). Loading the dashboard takes 2400ms because every call
							is sequential.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Build an API Gateway to centralize authentication, route requests,
							aggregate responses, and protect services with circuit breakers
							and rate limiting.
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
											Circuit breaker / rate limit active
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
					levelName="API Gateway"
					levelNumber={54}
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
					learningGoal="An API Gateway is the single entry point for all client requests. It centralizes cross-cutting concerns: authentication, routing, response aggregation, circuit breaking, and rate limiting. Clients never see internal service topology."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level56APIGateway;

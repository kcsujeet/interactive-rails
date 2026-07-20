/**
 * Level 51: Multi-Database
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom 2-node visualization (Rails App, Primary DB).
 *   All traffic (reads + writes) hits one database. Probes show latency spikes,
 *   pool exhaustion, and peak failures from read/write contention.
 *
 * Phase 2 (HOW - build): 5 steps (2 terminal + 3 OptionCard)
 *   Step 0: Add replica entry to database.yml (TerminalChoice)
 *   Step 1: Set replica: true (OptionCard)
 *   Step 2: Add connects_to declaration (OptionCard)
 *   Step 3: Configure database_selector middleware (OptionCard)
 *   Step 4: Handle replication delay (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): 3-node visualization (Rails App, Primary, Replica).
 *   Stress test fires GET/POST/PUT requests, visualization shows routing decisions.
 *   Counters track "To Replica" vs "To Primary" instead of Allowed/Blocked.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, Copy, Database, Zap } from 'lucide-react';
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

registerLevelCode('act7-level51-multi-database', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface AppVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
}

interface DbVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	isOverloaded: boolean;
}

interface ReplicaVizState {
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
	app?: Partial<AppVizState>;
	primary?: Partial<DbVizState>;
	replica?: Partial<ReplicaVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_APP: AppVizState = {
	label: 'Rails App',
	flash: 'idle',
	sublabel: 'Single connection',
};

const DEFAULT_PRIMARY: DbVizState = {
	label: 'Primary DB',
	flash: 'red',
	sublabel: 'ALL traffic',
	badge: null,
	isOverloaded: true,
};

const DEFAULT_REPLICA: ReplicaVizState = {
	label: 'Read Replica',
	flash: 'idle',
	sublabel: 'Not connected',
	badge: null,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

const DEFAULT_APP_REWARD: AppVizState = {
	label: 'Rails App',
	flash: 'green',
	sublabel: 'database_selector active',
};

const DEFAULT_PRIMARY_REWARD: DbVizState = {
	label: 'Primary DB',
	flash: 'amber',
	sublabel: 'Writes only',
	badge: null,
	isOverloaded: false,
};

const DEFAULT_REPLICA_REWARD: ReplicaVizState = {
	label: 'Read Replica',
	flash: 'green',
	sublabel: 'Reads routed here',
	badge: null,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'reads-compete', label: 'Reads compete with writes for connections' },
	{ id: 'writes-blocked', label: 'Writes blocked by read contention' },
	{ id: 'peak-failure', label: 'Peak traffic causes timeouts' },
	{ id: 'pool-exhausted', label: 'Connection pool exhausted' },
];

// ─── Probe definitions ────────────────────────────────────────────────

export const PROBES: ProbeConfig[] = [
	{
		id: 'browse-products',
		label: 'Browse products (single DB)',
		command: 'GET /api/v1/products?page=1',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK (342ms)', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: '7 concurrent read queries competing with 3 active writes.',
				color: 'red',
			},
			{ text: 'Connection pool: 23/25 used.', color: 'red' },
			{
				text: 'Read latency inflated by write lock contention.',
				color: 'yellow',
			},
		],
		story: [
			'Customer browses the product catalog.',
			'7 other read queries are already running.',
			'3 write queries (order placement) hold row locks.',
			'Reads wait for writes to release connections.',
			'Customer sees a 342ms page load instead of 45ms.',
		],
	},
	{
		id: 'place-order',
		label: 'Place order during peak reads',
		command: 'POST /api/v1/orders {items: [{sku: "RAIL-001", qty: 2}]}',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created (890ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Write queued 650ms behind browse queries for a connection.',
				color: 'red',
			},
			{ text: 'Connection pool and CPU saturated by reads.', color: 'yellow' },
			{ text: 'Customer checkout took 890ms instead of 120ms.', color: 'red' },
		],
		story: [
			'Customer clicks "Place Order" during peak browse traffic.',
			'Reads never block writes in PostgreSQL, but they compete for the same connections, CPU, and disk.',
			'20+ heavy browse queries have every connection and core busy.',
			'The INSERT queues 650ms just waiting for its turn on the box.',
			'Checkout feels sluggish. Cart abandonment increases.',
		],
	},
	{
		id: 'peak-traffic',
		label: 'Simulate peak traffic (100 requests)',
		command: 'ab -n 100 -c 50 localhost:3000/api/v1/products',
		responseLines: [
			{ text: '66 of 100 requests completed (200 OK)', color: 'yellow' },
			{ text: '34 of 100 requests failed (504 Gateway Timeout)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Primary DB CPU at 98%. All connections exhausted.',
				color: 'red',
			},
			{
				text: '34% of customers saw an error page during peak traffic.',
				color: 'red',
			},
		],
		story: [
			'Flash sale starts. 100 concurrent requests hit the API.',
			'All 25 connections in the pool are busy.',
			'34 requests queue up waiting for a free connection.',
			'After 5 seconds, they time out with 504 Gateway Timeout.',
			'34% of customers see an error page. Revenue lost.',
		],
	},
	{
		id: 'check-pool',
		label: 'Check connection pool status',
		command: 'rails runner "pp ActiveRecord::Base.connection_pool.stat"',
		responseLines: [
			{
				text: '{size: 25, connections: 25, busy: 24, idle: 1, waiting: 12}',
				color: 'cyan',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Pool exhausted. 12 requests queued for a connection.',
				color: 'red',
			},
			{
				text: 'Reads (90% of traffic) starve writes of connections.',
				color: 'yellow',
			},
			{ text: 'Scaling the pool only delays the problem.', color: 'muted' },
		],
		story: [
			'You check the connection pool stats during peak hours.',
			'25 connections configured, 24 busy, 1 idle, 12 waiting.',
			'Reads consume 90% of connections but only 10% are critical.',
			'Writes (orders, payments) compete for the remaining connections.',
			'Increasing pool size just lets more reads starve writes.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'browse-products': ['reads-compete'],
	'place-order': ['writes-blocked'],
	'peak-traffic': ['peak-failure'],
	'check-pool': ['pool-exhausted'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 2 nodes (App, Primary). edgeA = App <-> Primary.

const BROWSE_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'GET /products',
			flash: 'idle',
			sublabel: 'Routing to DB...',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: '7 reads + 3 writes',
			badge: '342ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'GET /products',
			dotColor: '#ef4444',
		},
	},
	{
		app: {
			label: 'Waiting for DB...',
			flash: 'amber',
			sublabel: 'Connection contention',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'Read/write contention',
			badge: '342ms',
			isOverloaded: true,
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '200 OK (342ms)',
			dotColor: '#f59e0b',
		},
	},
	{
		app: {
			label: 'Response sent',
			flash: 'idle',
			sublabel: 'Single connection',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'ALL traffic',
			badge: null,
			isOverloaded: true,
		},
		edgeA: { active: false, label: '' },
	},
];

const ORDER_FRAMES: AnimFrame[] = [
	{
		app: { label: 'POST /orders', flash: 'idle', sublabel: 'Write query...' },
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: '20 reads using every connection',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT INTO orders',
			dotColor: '#ef4444',
		},
	},
	{
		app: {
			label: 'Write waiting...',
			flash: 'red',
			sublabel: '650ms waiting for a connection',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'Pool + CPU saturated!',
			badge: '890ms',
			isOverloaded: true,
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '201 Created (890ms)',
			dotColor: '#ef4444',
		},
	},
	{
		app: {
			label: 'Response sent',
			flash: 'idle',
			sublabel: 'Single connection',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'ALL traffic',
			badge: null,
			isOverloaded: true,
		},
		edgeA: { active: false, label: '' },
	},
];

const PEAK_FRAMES: AnimFrame[] = [
	{
		app: {
			label: '100 concurrent requests',
			flash: 'amber',
			sublabel: 'Requesting connections...',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Pool: 25/25 busy',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: '100x GET /products',
			dotColor: '#ef4444',
		},
	},
	{
		app: {
			label: '34 requests queued',
			flash: 'red',
			sublabel: 'No free connections',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'CPU 98%!',
			badge: '34 timeouts',
			isOverloaded: true,
		},
	},
	{
		app: {
			label: '34 x 504 Timeout',
			flash: 'red',
			sublabel: '34% failure rate',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'ALL traffic',
			badge: null,
			isOverloaded: true,
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '34x 504 Gateway Timeout',
			dotColor: '#ef4444',
		},
	},
];

const POOL_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'Checking pool...',
			flash: 'idle',
			sublabel: 'ActiveRecord::Base.connection_pool.stat',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Processing...',
			badge: null,
		},
	},
	{
		app: {
			label: 'Pool stats received',
			flash: 'amber',
			sublabel: 'size: 25, busy: 24, waiting: 12',
		},
		primary: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'Pool exhausted',
			badge: '12 queued',
			isOverloaded: true,
		},
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'browse-products': BROWSE_FRAMES,
	'place-order': ORDER_FRAMES,
	'peak-traffic': PEAK_FRAMES,
	'check-pool': POOL_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: 3 nodes (App, Primary, Replica).
// edgeA = App -> Primary (writes), edgeB = App -> Replica (reads)

const REWARD_BROWSE_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'GET /products',
			flash: 'idle',
			sublabel: 'database_selector: reading role',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: 'Processing read...',
			badge: '45ms',
		},
		primary: {
			label: 'Primary DB',
			flash: 'idle',
			sublabel: 'Idle (writes only)',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET -> replica',
			dotColor: '#22c55e',
		},
	},
	{
		app: {
			label: 'Response from replica',
			flash: 'green',
			sublabel: '45ms (was 342ms)',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: 'Reads routed here',
			badge: '45ms',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK (45ms)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_ORDER_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'POST /orders',
			flash: 'idle',
			sublabel: 'database_selector: writing role',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Processing write...',
			badge: '120ms',
		},
		replica: {
			label: 'Read Replica',
			flash: 'idle',
			sublabel: 'Reads routed here',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT -> primary',
			dotColor: '#f59e0b',
		},
	},
	{
		app: {
			label: 'Write committed',
			flash: 'green',
			sublabel: '120ms (was 890ms)',
		},
		primary: {
			label: 'Primary DB',
			flash: 'green',
			sublabel: 'No read contention!',
			badge: '120ms',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '201 Created (120ms)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_HISTORY_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'GET /orders',
			flash: 'idle',
			sublabel: 'database_selector: reading role',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: 'Processing read...',
			badge: '38ms',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET -> replica',
			dotColor: '#22c55e',
		},
	},
	{
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: 'Reads routed here',
			badge: '38ms',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '200 OK (38ms)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_INVENTORY_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'PUT /products/42',
			flash: 'idle',
			sublabel: 'database_selector: writing role',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Processing write...',
			badge: '95ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'UPDATE -> primary',
			dotColor: '#f59e0b',
		},
	},
	{
		primary: {
			label: 'Primary DB',
			flash: 'green',
			sublabel: 'Writes only',
			badge: '95ms',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '200 OK (95ms)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_POST_THEN_READ_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'POST /orders (write)',
			flash: 'idle',
			sublabel: 'Writing to primary...',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Processing write...',
			badge: '120ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT -> primary',
			dotColor: '#f59e0b',
		},
	},
	{
		app: {
			label: 'GET /orders (within 2s)',
			flash: 'amber',
			sublabel: 'delay: 2.seconds active',
		},
		primary: {
			label: 'Primary DB',
			flash: 'green',
			sublabel: 'Stale-read prevented',
			badge: 'delay active',
		},
		replica: {
			label: 'Read Replica',
			flash: 'idle',
			sublabel: 'Bypassed (within delay)',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'READ -> primary (delay)',
			dotColor: '#f59e0b',
		},
	},
	{
		app: {
			label: 'Fresh data returned',
			flash: 'green',
			sublabel: 'Stale-read prevented',
		},
		primary: {
			label: 'Primary DB',
			flash: 'green',
			sublabel: 'Writes only',
			badge: null,
		},
	},
];

const REWARD_PEAK_FRAMES: AnimFrame[] = [
	{
		app: {
			label: '100 concurrent GETs',
			flash: 'idle',
			sublabel: 'All routed to replica...',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: '100 reads processing',
			badge: '0 timeouts',
		},
		primary: {
			label: 'Primary DB',
			flash: 'idle',
			sublabel: 'Idle (no reads)',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: '100x GET -> replica',
			dotColor: '#22c55e',
		},
	},
	{
		app: {
			label: '100/100 succeeded',
			flash: 'green',
			sublabel: '0 timeouts (was 34)',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: '100% success',
			badge: '52ms avg',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '100x 200 OK',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_POOL_FRAMES: AnimFrame[] = [
	{
		app: {
			label: 'Checking pool stats',
			flash: 'idle',
			sublabel: 'Querying both pools...',
		},
		primary: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Pool: 5/25 busy',
			badge: 'writes only',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: 'Pool: 18/25 busy',
			badge: 'reads here',
		},
	},
	{
		app: {
			label: 'Pool stats healthy',
			flash: 'green',
			sublabel: 'No queued requests',
		},
		primary: {
			label: 'Primary DB',
			flash: 'green',
			sublabel: '0 waiting (was 12)',
			badge: 'healthy',
		},
		replica: {
			label: 'Read Replica',
			flash: 'green',
			sublabel: '0 waiting',
			badge: 'healthy',
		},
	},
];

export const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'browse-products': REWARD_BROWSE_FRAMES,
	'place-order': REWARD_ORDER_FRAMES,
	'view-order-history': REWARD_HISTORY_FRAMES,
	'update-inventory': REWARD_INVENTORY_FRAMES,
	'post-then-read': REWARD_POST_THEN_READ_FRAMES,
	'peak-traffic': REWARD_PEAK_FRAMES,
	'check-pool': REWARD_POOL_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	app: {
		stageId: 'app',
		title: 'Rails Application',
		description:
			'All database queries go through a single connection to one PostgreSQL instance. No read/write splitting configured. Every request competes for the same 25-connection pool.',
	},
	primary: {
		stageId: 'primary',
		title: 'Primary Database',
		description:
			'Handles 100% of traffic: reads (90%) and writes (10%). During peak hours, read queries starve write queries of connections. p99 latency: 800ms.',
		code: `# config/database.yml (current)
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 25
    # No replica configured
    # All reads + writes hit this one server`,
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	primary: 'reads-compete',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'browse-products',
		label: 'Browse product catalog',
		description: 'GET request routed to read replica',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'place-order',
		label: 'Place new order',
		description: 'POST request routed to primary',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'view-order-history',
		label: 'View order history',
		description: 'GET request routed to read replica',
		method: 'GET',
		path: '/api/v1/orders',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'update-inventory',
		label: 'Update inventory count',
		description: 'PUT request routed to primary',
		method: 'PUT',
		path: '/api/v1/products/42',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'post-then-read',
		label: 'Read right after write',
		description: 'GET stays on primary within delay window',
		method: 'GET',
		path: '/api/v1/orders (after POST)',
		actor: 'customer',
		expectedResult: 'allowed',
	},
	{
		id: 'peak-traffic',
		label: '100 concurrent requests (peak)',
		description: 'All reads routed to replica, 0 timeouts',
		method: 'GET',
		path: '/api/v1/products (x100 peak)',
		actor: 'customers',
		expectedResult: 'allowed',
	},
	{
		id: 'check-pool',
		label: 'Check connection pool stats',
		description: 'Healthy distribution across primary and replica pools',
		method: 'GET',
		path: '/pool/stats',
		actor: 'admin',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-replica-entry', title: 'Add Replica to database.yml' },
	{ id: 'set-replica-flag', title: 'Set replica: true' },
	{ id: 'add-connects-to', title: 'Add connects_to Declaration' },
	{ id: 'configure-selector', title: 'Configure database_selector' },
	{ id: 'handle-delay', title: 'Handle Replication Delay' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: add replica entry
	'option', // 1: set replica: true
	'option', // 2: connects_to
	'option', // 3: database_selector
	'option', // 4: replication delay
];

// ─── Step 0: Add replica entry (Terminal) ─────────────────────────────

const addReplicaCommands: TerminalCommand[] = [
	{
		id: 'wrong-second-app',
		label: 'rails new ecommerce-reader --api',
		command: 'rails new ecommerce-reader --api',
		correct: false,
		feedback:
			'You do not need a separate Rails app for reads. Rails supports multiple databases natively in a single application.',
	},
	{
		id: 'wrong-redis',
		label: 'bundle add redis',
		command: 'bundle add redis',
		correct: false,
		feedback:
			'Redis caching helps but does not solve the read/write contention problem. You need to split the database connections themselves.',
	},
	{
		id: 'correct',
		label: 'Add primary_replica under production: in config/database.yml',
		command:
			'$EDITOR config/database.yml\n# nest primary_replica as a sibling of primary, inside production:\n#   production:\n#     primary:\n#       ...\n#     primary_replica:\n#       adapter: postgresql\n#       host: replica-db.example.com\n#       database: app_production',
		correct: true,
	},
];

const addReplicaOutput: TerminalOutputLine[] = [
	{
		text: 'Added primary_replica configuration to database.yml',
		color: 'green',
	},
	{ text: 'Replica host: replica-db.example.com', color: 'cyan' },
];

// ─── Step 1: Set replica: true (OptionCard) ───────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const REPLICA_FLAG_OPTIONS: StepOption[] = [
	{
		id: 'readonly',
		name: 'readonly: true',
		correct: false,
		feedback:
			'That is not the flag Rails looks for. Rails needs a specific marker that tells it this database serves read traffic and must never run migrations.',
	},
	{
		id: 'correct',
		name: 'replica: true',
		correct: true,
	},
	{
		id: 'primary-false',
		name: 'primary: false',
		correct: false,
		feedback:
			'There is no `primary: false` flag. The replica needs its own explicit marker so Rails knows not to send writes or migrations there.',
	},
];

// ─── Step 2: connects_to (OptionCard) ─────────────────────────────────

const CONNECTS_TO_OPTIONS: StepOption[] = [
	{
		id: 'wrong-keys',
		name: 'connects_to database: {\n  primary: :write,\n  replica: :read\n}',
		correct: false,
		feedback:
			'The keys are role names (writing/reading), not database names. Rails uses these roles to route queries automatically.',
	},
	{
		id: 'correct',
		name: 'connects_to database: {\n  writing: :primary,\n  reading: :primary_replica\n}',
		correct: true,
	},
	{
		id: 'establish',
		name: 'establish_connection :primary_replica',
		correct: false,
		feedback:
			'establish_connection is for manual one-off connections. connects_to declares the permanent role mapping for automatic routing.',
	},
];

// ─── Step 3: database_selector (OptionCard) ───────────────────────────

const SELECTOR_OPTIONS: StepOption[] = [
	{
		id: 'wrong-middleware',
		name: 'config.middleware.use DatabaseRouter',
		correct: false,
		feedback:
			'Hand-rolling this as custom middleware re-implements request routing Rails already ships. The framework has a configuration setting for exactly this job.',
	},
	{
		id: 'wrong-role',
		name: 'config.active_record.reading_role = :replica',
		correct: false,
		feedback:
			'This just renames the role; nothing routes requests anywhere. Renaming a label does not decide which database a GET should hit.',
	},
	{
		id: 'correct',
		name: 'config.active_record.database_selector = {\n  delay: 2.seconds\n}',
		correct: true,
	},
];

// ─── Step 4: Replication delay (OptionCard) ───────────────────────────

const DELAY_OPTIONS: StepOption[] = [
	{
		id: 'zero-delay',
		name: 'delay: 0',
		correct: false,
		feedback:
			'Zero delay means reads could hit the replica before it replicates a write. A customer would place an order and not see it in their order list.',
	},
	{
		id: 'correct',
		name: 'delay: 2.seconds',
		correct: true,
	},
	{
		id: 'long-delay',
		name: 'delay: 60.seconds',
		correct: false,
		feedback:
			'60 seconds means reads stay on primary for a full minute after any write. That defeats the purpose of replicas for most users.',
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Mark as Read-Only Replica',
		description:
			'The replica entry exists in database.yml. Now Rails needs to know this database should never receive writes or run migrations. Which flag marks a database as read-only?',
		options: REPLICA_FLAG_OPTIONS,
	},
	2: {
		title: 'Declare Role Mapping',
		description:
			'Rails needs to know which database handles which role. The role mapping goes in ApplicationRecord so all models inherit it. Which declaration maps the writing and reading roles?',
		options: CONNECTS_TO_OPTIONS,
	},
	3: {
		title: 'Enable Automatic Routing',
		description:
			'With roles declared, Rails needs middleware to automatically route requests by HTTP method: GET requests to the reading role, POST/PUT/DELETE to the writing role. Which configuration enables this?',
		options: SELECTOR_OPTIONS,
	},
	4: {
		title: 'Configure Replication Delay',
		description:
			'Replicas lag behind the primary by a fraction of a second. After a write, reads must stay on primary briefly to avoid returning stale data. What delay prevents stale reads without defeating the purpose of replicas?',
		options: DELAY_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addReplicaCommands, outputLines: addReplicaOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'config/database.yml',
				language: 'yaml',
				code: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 25
    # No replica configured
    # All reads + writes hit this server`,
				highlight: [8, 9],
			},
			{
				filename: 'app/models/application_record.rb',
				language: 'ruby',
				code: `class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  # No connects_to configured
  # Single database connection for everything
end`,
				highlight: [4, 5],
			},
		];
	}

	const files = [];

	// Step 0 complete: database.yml now has replica entry
	if (completedStep >= 0) {
		files.push({
			filename: 'config/database.yml',
			language: 'yaml',
			code:
				completedStep >= 1
					? `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 25
  primary_replica:
    adapter: postgresql
    host: replica-db.example.com
    database: app_production
    replica: true`
					: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 25
  primary_replica:
    adapter: postgresql
    host: replica-db.example.com
    database: app_production
    # TODO: mark as replica`,
			highlight: completedStep >= 1 ? [8, 9, 10, 11, 12] : [8, 9, 10, 11],
		});
	} else {
		files.push({
			filename: 'config/database.yml',
			language: 'yaml',
			code: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 25
    # TODO: add replica entry`,
			highlight: [8],
		});
	}

	// Step 2 complete: ApplicationRecord has connects_to
	if (completedStep >= 2) {
		files.push({
			filename: 'app/models/application_record.rb',
			language: 'ruby',
			code: `class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end`,
			highlight: [4, 5, 6],
		});
	} else if (completedStep >= 1) {
		files.push({
			filename: 'app/models/application_record.rb',
			language: 'ruby',
			code: `class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  # TODO: add connects_to for role switching
end`,
			highlight: [4],
		});
	}

	// Step 3 complete: application.rb has database_selector
	if (completedStep >= 3) {
		files.push({
			filename: 'config/application.rb',
			language: 'ruby',
			code:
				completedStep >= 4
					? `# config/application.rb
config.active_record.database_selector = {
  delay: 2.seconds
}
config.active_record.database_resolver =
  ActiveRecord::Middleware::DatabaseSelector::Resolver
config.active_record.database_resolver_context =
  ActiveRecord::Middleware::DatabaseSelector::Resolver::Session

# Automatic routing:
# GET requests  -> reading role (replica)
# POST/PUT/DELETE -> writing role (primary)
# After a write, reads stay on primary for 2s`
					: `# config/application.rb
config.active_record.database_selector = {
  delay: 2.seconds
}
config.active_record.database_resolver =
  ActiveRecord::Middleware::DatabaseSelector::Resolver
config.active_record.database_resolver_context =
  ActiveRecord::Middleware::DatabaseSelector::Resolver::Session

# TODO: verify replication delay is appropriate`,
			highlight: completedStep >= 4 ? [2, 3] : [2, 3],
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

const AppNode = memo(function AppNode({ data }: { data: AppVizState }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'SV',
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

const PrimaryDbNode = memo(function PrimaryDbNode({
	data,
}: {
	data: DbVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'DB',
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
			{data.isOverloaded && (
				<div className="mt-1 flex items-center justify-center gap-1 text-xs text-destructive">
					<Zap className="w-3 h-3" />
					Overloaded
				</div>
			)}
		</FlowNode>
	);
});

const ReplicaDbNode = memo(function ReplicaDbNode({
	data,
}: {
	data: ReplicaVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'RP',
		color: '#22c55e',
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

// ─── Custom edge ──────────────────────────────────────────────────────

const DbEdge = memo(function DbEdge(props: EdgeProps) {
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
});

const dbNodeTypes = {
	app: AppNode,
	primary: PrimaryDbNode,
	replica: ReplicaDbNode,
};
const dbEdgeTypes = { db: DbEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level51MultiDatabase({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [appState, setAppState] = useState<AppVizState>(DEFAULT_APP);
	const [primaryState, setPrimaryState] = useState<DbVizState>(DEFAULT_PRIMARY);
	const [replicaState, setReplicaState] =
		useState<ReplicaVizState>(DEFAULT_REPLICA);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setAppState(isReward ? DEFAULT_APP_REWARD : DEFAULT_APP);
		setPrimaryState(isReward ? DEFAULT_PRIMARY_REWARD : DEFAULT_PRIMARY);
		setReplicaState(isReward ? DEFAULT_REPLICA_REWARD : DEFAULT_REPLICA);
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.primary)
			setPrimaryState((prev) => ({ ...prev, ...frame.primary }));
		if (frame.replica)
			setReplicaState((prev) => ({ ...prev, ...frame.replica }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
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
		const nodes: Node[] = [
			{
				id: 'app',
				type: 'app',
				position: { x: 250, y: 20 },
				data: appState,
			},
			{
				id: 'primary',
				type: 'primary',
				position: isReward ? { x: 400, y: 220 } : { x: 250, y: 220 },
				data: primaryState,
			},
		];
		if (isReward) {
			nodes.push({
				id: 'replica',
				type: 'replica',
				position: { x: 80, y: 220 },
				data: replicaState,
			});
		}
		return nodes;
	}, [appState, primaryState, replicaState, isReward]);

	const flowEdges: Edge[] = useMemo(() => {
		const edges: Edge[] = [
			{
				id: 'edgeA',
				source: 'app',
				target: 'primary',
				type: 'db',
				data: edgeAState,
			},
		];
		if (isReward) {
			edges.push({
				id: 'edgeB',
				source: 'app',
				target: 'replica',
				type: 'db',
				data: edgeBState,
			});
		}
		return edges;
	}, [edgeAState, edgeBState, isReward]);

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
			const frames = isReward
				? REWARD_PROBE_FRAMES[probeId]
				: OBSERVE_PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames);
		},
		[discoveryGating, runAnimation, isReward],
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
			message: 'Multi-database configured! Read traffic offloaded to replicas.',
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
							edgeTypes={dbEdgeTypes}
							nodes={flowNodes}
							nodeTypes={dbNodeTypes}
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
							title="Database Probe"
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
								commands={addReplicaCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										The primary database handles 100% of traffic. Add a read
										replica entry to your database configuration so Rails knows
										about a second database.
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
								outputLines={addReplicaOutput}
								stepKey={stepper.currentStep}
								title="Add Read Replica Entry"
							/>
						)}

						{/* OptionCard steps (1-4) */}
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
						edgeTypes={dbEdgeTypes}
						nodes={flowNodes}
						nodeTypes={dbNodeTypes}
					/>
				</div>
				<div className="px-6 pb-4">
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
							Reads are 90% of traffic, all hitting a single database. During
							peak hours, read queries compete with writes for the same
							connection pool. p99 latency spikes to 800ms and 34% of requests
							time out.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails supports multiple databases natively. Split reads to a
							replica so writes get dedicated resources on the primary.
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

					{/* Reward: routing counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Routing Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Copy className="w-4 h-4 text-success" />
										<span className="text-foreground">
											GET requests routed to replica
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Database className="w-4 h-4 text-warning" />
										<span className="text-foreground">
											POST/PUT/DELETE routed to primary
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
										<div className="text-xs text-success/70">Routed</div>
									</div>
									<div className="bg-warning/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-warning">
											{stressTest.results.length}
										</div>
										<div className="text-xs text-warning/70">Total Fired</div>
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
					levelName="Multi-Database"
					levelNumber={51}
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
					learningGoal="Rails multi-database support routes reads to replicas and writes to the primary. The database_selector middleware handles this automatically based on HTTP method, with a configurable replication delay to prevent stale reads."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level51MultiDatabase;

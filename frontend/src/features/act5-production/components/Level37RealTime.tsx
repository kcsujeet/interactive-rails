/**
 * Level 37: Real-Time with Action Cable + Solid Cable
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): "Server Under Siege" React Flow visualization.
 *   ClientNode and ServerNode connected by a ConnectionEdge.
 *   Animated dots travel along the edge showing polling traffic.
 *   Server node has CPU gauge, connection pool, request queue.
 *   Probes: polling waste, server overload, stuck notification.
 *
 * Phase 2 (HOW - build): 6 steps (3 terminal + 3 OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same nodes, now with WebSocket edge.
 *   Green dots push messages instantly. Blocked scenarios show rejection.
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
	Bell,
	Globe,
	Server as ServerIcon,
	Wifi,
	Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
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
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	AnimatedDots,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Visualization state types
// ──────────────────────────────────────────────

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface ClientVizState {
	label: string;
	flash: ZoneFlash;
	waitingClock: number | null;
}

interface ServerVizState {
	label: string;
	flash: ZoneFlash;
	cpu: number;
	connections: string;
	poolExhausted: boolean;
	queueSize: number;
	status503: boolean;
	stuckNotification: boolean;
	requestCount: string | null;
	rewardLabel: string | null;
	rewardBlocked: boolean;
}

interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface ProcessorVizState {
	label: string;
	flash: ZoneFlash;
}

interface AnimFrame {
	client?: Partial<ClientVizState>;
	server?: Partial<ServerVizState>;
	edge?: Partial<EdgeVizState>;
	processor?: Partial<ProcessorVizState>;
	edgeB?: Partial<EdgeVizState>;
}

const DEFAULT_CLIENT: ClientVizState = {
	label: '',
	flash: 'idle',
	waitingClock: null,
};
const DEFAULT_SERVER: ServerVizState = {
	label: '',
	flash: 'idle',
	cpu: 40,
	connections: '200',
	poolExhausted: false,
	queueSize: 0,
	status503: false,
	stuckNotification: false,
	requestCount: null,
	rewardLabel: null,
	rewardBlocked: false,
};
const DEFAULT_PROCESSOR: ProcessorVizState = {
	label: '',
	flash: 'idle',
};
const DEFAULT_EDGE_B: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-zinc-400',
};
const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-zinc-400',
};

// ──────────────────────────────────────────────
// Custom React Flow nodes
// ──────────────────────────────────────────────

const FLASH_BORDER: Record<ZoneFlash, string> = {
	idle: 'border-border',
	red: 'border-red-400 dark:border-red-600',
	green: 'border-emerald-400 dark:border-emerald-600',
	amber: 'border-amber-400 dark:border-amber-600',
};
const FLASH_BG: Record<ZoneFlash, string> = {
	idle: 'bg-card',
	red: 'bg-red-50 dark:bg-red-900/20',
	green: 'bg-emerald-50 dark:bg-emerald-900/20',
	amber: 'bg-amber-50 dark:bg-amber-900/20',
};

interface ClientNodeData {
	label: string;
	flash: ZoneFlash;
	waitingClock: number | null;
	[key: string]: unknown;
}

const ClientNode = memo(function ClientNode({
	data,
}: {
	data: ClientNodeData;
}) {
	return (
		<div
			className={cn(
				'rounded-xl border-2 p-3 text-center transition-colors duration-300 w-32',
				FLASH_BORDER[data.flash],
				FLASH_BG[data.flash],
			)}
		>
			<Globe className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
			<div className="text-xs font-semibold text-foreground">Client</div>
			<div className="text-xs text-muted-foreground">50K users polling</div>
			{data.label && (
				<div
					className={cn(
						'mt-1.5 text-xs font-mono animate-in fade-in duration-300',
						data.flash === 'red'
							? 'text-red-600 dark:text-red-400'
							: data.flash === 'green'
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-foreground',
					)}
				>
					{data.label}
				</div>
			)}
			{data.waitingClock !== null && (
				<div className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-mono font-bold animate-pulse">
					Waiting... {data.waitingClock.toFixed(1)}s
				</div>
			)}
			<FlowHandles />
		</div>
	);
});

interface ServerNodeData {
	label: string;
	flash: ZoneFlash;
	cpu: number;
	connections: string;
	poolExhausted: boolean;
	queueSize: number;
	status503: boolean;
	stuckNotification: boolean;
	requestCount: string | null;
	isReward: boolean;
	rewardLabel: string | null;
	rewardBlocked: boolean;
	[key: string]: unknown;
}

const ServerNode = memo(function ServerNode({
	data,
}: {
	data: ServerNodeData;
}) {
	const cpuDanger = data.cpu > 80;
	return (
		<div
			className={cn(
				'rounded-xl border-2 p-3 transition-colors duration-300 w-44',
				FLASH_BORDER[data.flash],
				FLASH_BG[data.flash],
			)}
		>
			<div className="flex items-center gap-1 mb-2">
				<ServerIcon
					className={cn(
						'w-4 h-4',
						cpuDanger
							? 'text-red-600 dark:text-red-400'
							: data.isReward
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-muted-foreground',
					)}
				/>
				<span className="text-xs font-semibold text-foreground">Server</span>
				{data.status503 && (
					<Badge
						className="ml-auto text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
						variant="outline"
					>
						503
					</Badge>
				)}
				{data.isReward && !data.rewardBlocked && (
					<Badge
						className="ml-auto text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
						variant="outline"
					>
						<Wifi className="w-3 h-3 mr-1" />
						WS
					</Badge>
				)}
			</div>

			{/* CPU gauge */}
			<div className="mb-1.5">
				<div className="flex justify-between text-xs mb-0.5">
					<span className="text-muted-foreground">CPU</span>
					<span
						className={cn(
							'font-mono font-bold',
							cpuDanger
								? 'text-red-600 dark:text-red-400'
								: data.isReward
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-foreground',
						)}
					>
						{data.cpu}%
					</span>
				</div>
				<div className="h-1.5 bg-muted rounded-full overflow-hidden">
					<div
						className={cn(
							'h-full rounded-full transition-all duration-300',
							cpuDanger
								? 'bg-red-500'
								: data.isReward
									? 'bg-emerald-500'
									: 'bg-primary',
						)}
						style={{ width: `${data.cpu}%` }}
					/>
				</div>
			</div>

			{/* Connections */}
			<div className="flex justify-between text-xs mb-1">
				<span className="text-muted-foreground">Conn</span>
				<span
					className={cn(
						'font-mono',
						data.poolExhausted
							? 'text-red-600 dark:text-red-400 font-bold'
							: 'text-foreground',
					)}
				>
					{data.connections}
					{data.poolExhausted ? ' FULL' : ''}
				</span>
			</div>

			{/* Queue */}
			{data.queueSize > 0 && !data.isReward && (
				<div className="flex gap-0.5 mb-1">
					{Array.from(
						{ length: Math.min(data.queueSize, 10) },
						(_, i) => `q-${data.queueSize}-${i}`,
					).map((key, i) => (
						<div
							className={cn(
								'h-1.5 flex-1 rounded-sm',
								i >= 8 ? 'bg-red-500' : 'bg-amber-500',
							)}
							key={key}
						/>
					))}
				</div>
			)}

			{/* Work pipeline */}
			{data.label && !data.isReward && (
				<div className="text-xs font-mono text-amber-600 dark:text-amber-400 truncate animate-in fade-in duration-200">
					{data.label}
				</div>
			)}

			{/* Request count */}
			{data.requestCount && !data.isReward && (
				<div className="text-xs font-mono text-red-600 dark:text-red-400 font-bold">
					{data.requestCount}
				</div>
			)}

			{/* Stuck notification */}
			{data.stuckNotification && !data.isReward && (
				<div className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400 animate-pulse">
					<Bell className="w-3 h-3" />
					<span className="font-mono">Notification stuck!</span>
				</div>
			)}

			{/* Reward label */}
			{data.rewardLabel && data.isReward && (
				<div
					className={cn(
						'mt-1 text-xs font-mono truncate animate-in fade-in duration-200',
						data.rewardBlocked
							? 'text-red-600 dark:text-red-400'
							: 'text-emerald-600 dark:text-emerald-400',
					)}
				>
					{data.rewardLabel}
				</div>
			)}

			<FlowHandles />
		</div>
	);
});

interface ProcessorNodeData {
	label: string;
	flash: ZoneFlash;
	[key: string]: unknown;
}

const ProcessorNode = memo(function ProcessorNode({
	data,
}: {
	data: ProcessorNodeData;
}) {
	return (
		<div
			className={cn(
				'rounded-xl border-2 p-3 text-center transition-colors duration-300 w-32',
				FLASH_BORDER[data.flash],
				FLASH_BG[data.flash],
			)}
		>
			<Zap className="w-5 h-5 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
			<div className="text-xs font-semibold text-foreground">
				Payment Processor
			</div>
			<div className="text-xs text-muted-foreground">Stripe</div>
			{data.label && (
				<div
					className={cn(
						'mt-1.5 text-xs font-mono animate-in fade-in duration-300',
						data.flash === 'green'
							? 'text-emerald-600 dark:text-emerald-400'
							: data.flash === 'red'
								? 'text-red-600 dark:text-red-400'
								: 'text-amber-600 dark:text-amber-400',
					)}
				>
					{data.label}
				</div>
			)}
			<FlowHandles />
		</div>
	);
});

const realtimeNodeTypes = {
	client: ClientNode,
	server: ServerNode,
	processor: ProcessorNode,
};

// ──────────────────────────────────────────────
// Custom React Flow edge
// ──────────────────────────────────────────────

interface ConnectionEdgeData {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
	isWebSocket: boolean;
	[key: string]: unknown;
}

function toDotFill(dotColor: string): string {
	if (dotColor.includes('emerald')) return '#10b981';
	if (dotColor.includes('red')) return '#ef4444';
	if (dotColor.includes('amber')) return '#f59e0b';
	if (dotColor.includes('cyan')) return '#06b6d4';
	return '#a1a1aa';
}

const ConnectionEdge = memo(function ConnectionEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition: _sp,
	targetPosition: _tp,
	data,
}: EdgeProps) {
	const d = data as ConnectionEdgeData;
	const fill = toDotFill(d.dotColor);
	const wsColor = '#10b981';

	const result = getStraightPath({ sourceX, sourceY, targetX, targetY });
	const edgePath = result[0];
	const labelX = result[1];
	const labelY = result[2];

	const dotPath = d.reverse ? reversePath(edgePath) : edgePath;
	const dir = d.reverse ? 'rev' : 'fwd';
	const dots = d.active
		? [0, 1, 2].map((i) => ({
				id: `${id}-${dir}-d${i}`,
				color: fill,
				r: 5,
				dur: '1.2s',
				begin: `${i === 0 ? '0s' : `-${i * 0.4}s`}`,
			}))
		: [];

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: d.isWebSocket ? wsColor : d.active ? fill : undefined,
					strokeWidth: d.isWebSocket ? 2.5 : undefined,
					strokeDasharray: d.isWebSocket ? undefined : '6 4',
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none"
						style={{
							position: 'absolute',
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 20}px)`,
						}}
					>
						<span
							className={cn(
								'text-xs font-mono px-2 py-0.5 rounded',
								d.isWebSocket
									? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
									: 'bg-background/80 text-muted-foreground',
							)}
						>
							{d.label}
						</span>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const realtimeEdgeTypes = { connection: ConnectionEdge };

// ──────────────────────────────────────────────
// Probe animation frames
// ──────────────────────────────────────────────

// Each poll = 2 frames: request (Client->Server) + response (Server->Client).
// The label changes per phase so the player sees the round-trip.
// Request count shows why CPU is spiking (50K users doing this simultaneously).
const POLLING_FRAMES: AnimFrame[] = [
	// Poll 1: request
	{
		client: { label: 'Polling...' },
		server: {
			requestCount: '1 of 25K req/sec',
			label: 'auth -> query -> serialize',
			cpu: 45,
			connections: '280',
			queueSize: 1,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Any notifications?',
			dotColor: 'bg-amber-500',
		},
	},
	// Poll 1: response (empty)
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: 'No new notifications',
			dotColor: 'bg-red-500',
		},
	},
	// Poll 2: request
	{
		server: {
			requestCount: '3,500 of 25K req/sec',
			label: 'auth -> query -> serialize',
			cpu: 55,
			connections: '400',
			queueSize: 2,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Any notifications?',
			dotColor: 'bg-amber-500',
		},
	},
	// Poll 2: response (empty)
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: 'No new notifications',
			dotColor: 'bg-red-500',
		},
	},
	// Poll 3: request
	{
		server: {
			requestCount: '10K of 25K req/sec',
			label: 'auth -> query -> serialize',
			cpu: 70,
			connections: '560',
			queueSize: 4,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Any notifications?',
			dotColor: 'bg-amber-500',
		},
	},
	// Poll 3: response (empty)
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: 'No new notifications',
			dotColor: 'bg-red-500',
		},
	},
	// Poll 4: request
	{
		server: {
			requestCount: '20K of 25K req/sec',
			label: 'auth -> query -> serialize',
			cpu: 85,
			connections: '720',
			queueSize: 6,
			flash: 'amber' as const,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Any notifications?',
			dotColor: 'bg-amber-500',
		},
	},
	// Poll 4: response (empty)
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: 'No new notifications',
			dotColor: 'bg-red-500',
		},
	},
	// Poll 5: request (server at max)
	{
		server: {
			requestCount: '25K req/sec (99% wasted)',
			label: 'auth -> query -> serialize',
			cpu: 95,
			connections: '847',
			queueSize: 8,
			flash: 'red' as const,
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Any notifications?',
			dotColor: 'bg-amber-500',
		},
	},
	// Poll 5: response (finally has data!)
	{
		client: { label: '' },
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: '1 notification (finally!)',
			dotColor: 'bg-amber-500',
		},
	},
	// Cleanup: stop dots
	{ edge: { active: false } },
];

// Each frame: ask "which direction is data flowing?" and set reverse accordingly.
// Client->Server (request) = reverse: false. Server->Client (response) = reverse: true.
const OVERLOAD_FRAMES: AnimFrame[] = [
	// Requests flood in (Client -> Server)
	{
		server: {
			flash: 'red' as const,
			cpu: 95,
			connections: '847',
			poolExhausted: true,
			queueSize: 2,
			requestCount: '25K req/sec from 50K users',
		},
		edge: {
			active: true,
			reverse: false,
			label: 'Requests flooding in...',
			dotColor: 'bg-amber-500',
		},
	},
	// Server tries to respond but pool is full
	{
		server: { queueSize: 4 },
		edge: { reverse: true, label: 'All 850 DB connections used' },
	},
	// More requests pile up (Client -> Server)
	{
		server: { queueSize: 6 },
		edge: { reverse: false, label: 'More requests queuing...' },
	},
	// Queue full
	{
		server: { queueSize: 8 },
		edge: { reverse: true, label: 'Queue full! Cannot process.' },
	},
	// Server drops requests, sends 503 (Server -> Client)
	{
		server: {
			status503: true,
			queueSize: 10,
			requestCount: "25K req/sec (server can't keep up)",
		},
		edge: { reverse: true, label: 'DROPPED: 503', dotColor: 'bg-red-500' },
	},
	// Client receives timeout (Server -> Client)
	{
		client: { label: 'Timeout...', flash: 'red' as const },
		edge: {
			active: false,
			reverse: true,
			label: '503 Service Unavailable',
			dotColor: 'bg-red-500',
		},
	},
];

// Scenario: User initiates payment. Server sends to Stripe for async processing.
// Stripe confirms back to server. Notification created. But no push to client.
// Uses 3 nodes: Client -- Server -- Payment Processor (Stripe)
const PAYMENT_FRAMES: AnimFrame[] = [
	// Client sends payment (Client -> Server)
	{
		edge: {
			active: true,
			reverse: false,
			label: 'POST /payments',
			dotColor: 'bg-cyan-500',
		},
	},
	// Server forwards to Stripe (Server -> Processor via edgeB)
	{
		server: { label: 'Forwarding to Stripe', flash: 'amber' as const },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'Charge $99.99',
			dotColor: 'bg-amber-500',
		},
	},
	// Server responds 202 to client (Server -> Client) while Stripe processes
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: '202 Accepted (processing...)',
			dotColor: 'bg-amber-500',
		},
		edgeB: { active: false, label: '' },
		processor: { label: 'Processing...', flash: 'amber' as const },
	},
	// Client waits. Stripe still processing.
	{
		client: { label: 'Waiting for confirmation...' },
		edge: { active: false, label: '' },
	},
	// Stripe confirms! (Processor -> Server via edgeB)
	{
		processor: { label: 'Confirmed!', flash: 'green' as const },
		edgeB: {
			active: true,
			reverse: true,
			label: 'Payment succeeded',
			dotColor: 'bg-green-500',
		},
	},
	// Notification created on server, stuck. No push to client.
	{
		server: { flash: 'green' as const, stuckNotification: true },
		processor: { label: '' },
		edgeB: { active: false, label: '' },
		edge: { label: 'Notification ready, but no push!' },
	},
	// Clock starts -- client polling cycle hasn't fired yet
	{ client: { waitingClock: 0 } },
	{ client: { waitingClock: 0.5 } },
	{ client: { waitingClock: 1.0 } },
	{ client: { waitingClock: 1.5 } },
	// Poll fires (Client -> Server)
	{
		client: { waitingClock: 2.0, flash: 'red' as const },
		server: { stuckNotification: false, flash: 'idle' as const },
		edge: {
			active: true,
			reverse: false,
			label: 'GET /notifications (2s later)',
			dotColor: 'bg-red-500',
		},
	},
	// Server responds (Server -> Client)
	{
		server: { label: 'Sending notification...' },
		edge: {
			active: true,
			reverse: true,
			label: 'Payment confirmed! (2s late)',
			dotColor: 'bg-amber-500',
		},
	},
	// Done
	{
		client: {
			waitingClock: null,
			label: 'Confirmed (2s late!)',
			flash: 'red' as const,
		},
		server: { label: '' },
		edge: { active: false, label: '2s delay because no server push' },
	},
];

const PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'check-polling': POLLING_FRAMES,
	'check-cpu': OVERLOAD_FRAMES,
	'trigger-event': PAYMENT_FRAMES,
};

// ──────────────────────────────────────────────
// Reward animation frames
// ──────────────────────────────────────────────
// Each reward scenario replays the SAME flow as its observe probe,
// but with WebSocket push replacing the broken part.
// Same story, different ending.

// Mirrors: POST create payment probe
// Same: Client -> Server -> Stripe -> Server. Stripe confirms.
// Different: Server pushes instantly via WebSocket instead of notification stuck + 2s poll delay.
const REWARD_PAYMENT_FRAMES: AnimFrame[] = [
	// Client sends payment (Client -> Server) -- same as observe
	{
		edge: {
			active: true,
			reverse: false,
			label: 'POST /payments',
			dotColor: 'bg-cyan-500',
		},
	},
	// Server forwards to Stripe (Server -> Processor) -- same as observe
	{
		server: { label: 'Forwarding to Stripe', flash: 'amber' as const },
		edge: { active: false, label: '' },
		edgeB: {
			active: true,
			reverse: false,
			label: 'Charge $99.99',
			dotColor: 'bg-amber-500',
		},
	},
	// Server responds 202 (Server -> Client) -- same as observe
	{
		server: { label: '' },
		edge: {
			active: true,
			reverse: true,
			label: '202 Accepted (processing...)',
			dotColor: 'bg-amber-500',
		},
		edgeB: { active: false, label: '' },
		processor: { label: 'Processing...', flash: 'amber' as const },
	},
	// Client waits -- same as observe
	{
		client: { label: 'Waiting for confirmation...' },
		edge: { active: false, label: '' },
	},
	// Stripe confirms (Processor -> Server) -- same as observe
	{
		processor: { label: 'Confirmed!', flash: 'green' as const },
		edgeB: {
			active: true,
			reverse: true,
			label: 'Payment succeeded',
			dotColor: 'bg-green-500',
		},
	},
	// DIFFERENT: Server pushes instantly via WebSocket (no stuck notification, no clock)
	{
		server: {
			flash: 'green' as const,
			rewardLabel: 'after_create_commit -> broadcast',
		},
		edgeB: { active: false, label: '' },
		edge: {
			active: true,
			reverse: true,
			label: 'PUSH: Payment confirmed!',
			dotColor: 'bg-emerald-500',
		},
	},
	// Client receives instantly (no 2s delay!)
	{
		client: { label: 'Confirmed instantly!', flash: 'green' as const },
		processor: { label: '', flash: 'idle' as const },
		server: { rewardLabel: '' },
		edge: { active: false, label: '<15ms (was 2s with polling)' },
	},
];

// Mirrors: GET notifications (poll) probe
// Same: Client asks server for notifications.
// Different: Instead of 5 wasted round-trips, server pushes only when an event happens.
const REWARD_POLLING_FRAMES: AnimFrame[] = [
	// Server sits idle, no polling requests coming in (contrast with observe's flood)
	{
		server: {
			flash: 'green' as const,
			cpu: 3,
			requestCount: '0 req/sec (was 25K)',
			rewardLabel: 'No polling endpoint hit',
		},
		edge: { active: false, label: 'No polling needed' },
	},
	// An event happens: server pushes it instantly (Server -> Client)
	{
		server: { rewardLabel: 'after_create_commit -> broadcast' },
		edge: {
			active: true,
			reverse: true,
			label: 'PUSH: New notification',
			dotColor: 'bg-emerald-500',
		},
	},
	// Client receives instantly -- no wasted round-trips
	{
		client: { label: 'Received instantly!', flash: 'green' as const },
		server: { rewardLabel: '0% wasted (was 99%)' },
		edge: { active: false, label: 'Push only when events happen' },
	},
];

// Mirrors: GET server health probe
// Same: Check server stats.
// Different: CPU 3%, pool healthy, no 503s. Then demonstrate it handles load.
const REWARD_HEALTH_FRAMES: AnimFrame[] = [
	// Server healthy (contrast with observe's 95% CPU, pool exhausted, 503s)
	{
		server: {
			flash: 'green' as const,
			cpu: 3,
			connections: '50K',
			poolExhausted: false,
			queueSize: 0,
			status503: false,
			requestCount: '0 polling overhead',
			rewardLabel: 'Pool: 50/850 (healthy)',
		},
	},
	// Push to all 50K users to show it handles load
	{
		server: { rewardLabel: 'Broadcasting to 50K users...' },
		edge: {
			active: true,
			reverse: true,
			label: 'PUSH to 50K connections',
			dotColor: 'bg-emerald-500',
		},
	},
	// Server stays healthy after push
	{
		client: { label: '50K delivered, CPU still 3%', flash: 'green' as const },
		server: { rewardLabel: 'CPU 3% (was 95%)' },
		edge: { active: false, label: 'WebSocket = no polling overhead' },
	},
];

// Resolves: build step (authenticate connection)
const REWARD_BLOCKED_FRAMES: AnimFrame[] = [
	{
		client: { flash: 'red' as const },
		edge: {
			active: true,
			reverse: false,
			label: 'Connect attempt (no cookies)',
			dotColor: 'bg-red-500',
		},
	},
	{
		server: {
			flash: 'red' as const,
			rewardLabel: 'reject_unauthorized_connection',
			rewardBlocked: true,
		},
		client: { label: 'Connection refused' },
		edge: { active: false, label: 'Rejected: no auth' },
	},
];

// Resolves: build step (channel scoping)
const REWARD_WRONG_USER_FRAMES: AnimFrame[] = [
	{
		edge: {
			active: true,
			reverse: false,
			label: 'Subscribe to user_42',
			dotColor: 'bg-amber-500',
		},
	},
	{
		server: {
			flash: 'red' as const,
			rewardLabel: 'stream_for current_user only',
			rewardBlocked: true,
		},
		edge: { active: false, label: 'Rejected: wrong user' },
	},
];

const REWARD_FRAME_MAP: Record<string, AnimFrame[]> = {
	'payment-push': REWARD_PAYMENT_FRAMES,
	'zero-polling': REWARD_POLLING_FRAMES,
	'server-healthy': REWARD_HEALTH_FRAMES,
	unauthenticated: REWARD_BLOCKED_FRAMES,
	'wrong-user': REWARD_WRONG_USER_FRAMES,
};

// ──────────────────────────────────────────────
// Discovery definitions
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'no-push', label: 'No server-push mechanism exists' },
	{ id: 'latency-delay', label: 'Notifications delayed by poll interval' },
	{ id: 'polling-waste', label: 'Polling returns 99% empty responses' },
	{ id: 'cpu-spike', label: '25K req/sec exhausts server CPU' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'check-polling': ['polling-waste'],
	'check-cpu': ['cpu-spike'],
	'trigger-event': ['no-push', 'latency-delay'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'trigger-event',
		label: 'POST create payment',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 99.99}\'',
		responseLines: [
			{ text: '202 Accepted (processing asynchronously)', color: 'cyan' },
			{ text: '# Stripe confirms payment on the server side.', color: 'green' },
			{
				text: '# Notification created. But no push mechanism!',
				color: 'yellow',
			},
			{
				text: '# Client waits up to 2 seconds for next poll to find out.',
				color: 'red',
			},
		],
	},
	{
		id: 'check-polling',
		label: 'GET notifications (poll)',
		command: 'curl -s localhost:3000/api/v1/notifications | jq',
		responseLines: [
			{ text: '200 OK', color: 'cyan' },
			{ text: '{ "data": [] }', color: 'yellow' },
			{
				text: '# No new notifications. 99% of polls return nothing.',
				color: 'red',
			},
			{
				text: '# Server still ran: auth -> query -> serialize -> respond',
				color: 'red',
			},
		],
	},
	{
		id: 'check-cpu',
		label: 'GET server health',
		command: 'curl -s localhost:3000/api/v1/health | jq .server',
		responseLines: [
			{
				text: '{ "cpu": "95%", "connections": 847, "pool_exhausted": true }',
				color: 'red',
			},
			{ text: '# Connection pool exhausted from polling load', color: 'red' },
			{
				text: '# 25,000 req/sec. Each one hits the full pipeline.',
				color: 'yellow',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-cable', title: 'Install Cable Adapter' },
	{ id: 'run-install', title: 'Run Installer' },
	{ id: 'configure-adapter', title: 'Configure Adapter' },
	{ id: 'generate-channel', title: 'Generate Channel' },
	{ id: 'authenticate-connection', title: 'Authenticate Connection' },
	{ id: 'build-broadcast-service', title: 'Build Broadcast Service' },
];

const INSTALL_CABLE_COMMANDS = [
	{
		id: 'wrong-redis',
		label: 'bundle add redis',
		command: 'bundle add redis',
		correct: false,
		feedback:
			'Redis is an external dependency. Rails 8 has a built-in adapter backed by the database.',
	},
	{
		id: 'wrong-anycable',
		label: 'bundle add anycable',
		command: 'bundle add anycable',
		correct: false,
		feedback:
			'AnyCable is a third-party alternative. Rails 8 ships with a zero-dependency adapter out of the box.',
	},
	{
		id: 'correct',
		label: 'bundle add solid_cable',
		command: 'bundle add solid_cable',
		correct: true,
	},
];

const RUN_INSTALL_COMMANDS = [
	{
		id: 'wrong-migrate',
		label: 'bin/rails db:migrate',
		command: 'bin/rails db:migrate',
		correct: false,
		feedback:
			'Migrations need to exist first. The gem provides an installer that sets up the database table and config.',
	},
	{
		id: 'correct',
		label: 'bin/rails solid_cable:install',
		command: 'bin/rails solid_cable:install',
		correct: true,
	},
	{
		id: 'wrong-generate',
		label: 'bin/rails generate solid_cable',
		command: 'bin/rails generate solid_cable',
		correct: false,
		feedback: 'Solid Cable uses a Rake task for installation, not a generator.',
	},
];

const CONFIGURE_ADAPTER_OPTIONS = [
	{
		id: 'wrong-redis-adapter',
		label: `# config/cable.yml\nproduction:\n  adapter: redis\n  url: redis://localhost:6379/1`,
		correct: false,
		feedback:
			'This requires a running Redis instance. The whole point is to eliminate external dependencies.',
	},
	{
		id: 'wrong-async',
		label: `# config/cable.yml\nproduction:\n  adapter: async`,
		correct: false,
		feedback:
			'The async adapter is for development only. It does not persist messages or work across processes.',
	},
	{
		id: 'correct',
		label: `# config/cable.yml\nproduction:\n  adapter: solid_cable\n  polling_interval: 0.1.seconds\n  message_retention: 1.day`,
		correct: true,
	},
];

const GENERATE_CHANNEL_COMMANDS = [
	{
		id: 'wrong-model',
		label: 'bin/rails generate model Notification',
		command: 'bin/rails generate model Notification',
		correct: false,
		feedback:
			'A model stores data in the database. You need a channel for real-time WebSocket communication.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate channel Notifications',
		command: 'bin/rails generate channel Notifications',
		correct: true,
	},
	{
		id: 'wrong-controller',
		label: 'bin/rails generate controller Notifications',
		command: 'bin/rails generate controller Notifications',
		correct: false,
		feedback:
			'A controller handles HTTP requests. WebSocket channels are a different layer entirely.',
	},
];

const AUTHENTICATE_CONNECTION_OPTIONS = [
	{
		id: 'wrong-no-auth',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    # No authentication needed\n  end\nend`,
		correct: false,
		feedback:
			'Unauthenticated WebSocket connections let anyone subscribe to private channels. Every connection must verify the user.',
	},
	{
		id: 'correct',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = find_verified_user\n    end\n\n    private\n\n    def find_verified_user\n      verified = User.find_by(id: cookies.encrypted[:user_id])\n      verified || reject_unauthorized_connection\n    end\n  end\nend`,
		correct: true,
	},
	{
		id: 'wrong-session',
		label: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = User.find(session[:user_id])\n    end\n  end\nend`,
		correct: false,
		feedback:
			'WebSocket connections do not have direct access to the session store. You need a different mechanism that persists across requests.',
	},
];

const BROADCAST_SERVICE_OPTIONS = [
	{
		id: 'wrong-inline',
		label: `class Api::V1::PaymentsController < ApplicationController\n  def create\n    result = ProcessPayment.call(user: Current.user, params:)\n    if result.success?\n      NotificationsChannel.broadcast_to(\n        Current.user, { type: "payment" })\n      render json: result.payment, status: :created\n    end\n  end\nend`,
		correct: false,
		feedback:
			'Broadcasting in the request cycle blocks the response. Notifications should be triggered by model callbacks or background jobs.',
	},
	{
		id: 'correct',
		label: `class BroadcastNotification < ApplicationService\n  Result = Data.define(:success?, :notification, :errors)\n\n  def initialize(user:, title:, body:)\n    @user = user; @title = title; @body = body\n  end\n\n  def call\n    v = NotificationContract.new.call(title: @title, body: @body)\n    return Result.new(success?: false, notification: nil,\n      errors: v.errors.to_h) if v.failure?\n    notification = @user.notifications.create!(\n      title: @title, body: @body)\n    # after_create_commit broadcasts automatically\n    Result.new(success?: true, notification:, errors: {})\n  end\nend`,
		correct: true,
	},
	{
		id: 'wrong-direct',
		label: `class BroadcastNotification < ApplicationService\n  Result = Data.define(:success?, :notification, :errors)\n\n  def initialize(user:, title:, body:)\n    @user = user; @title = title; @body = body\n  end\n\n  def call\n    NotificationsChannel.broadcast_to(\n      @user, { title: @title, body: @body })\n    Result.new(success?: true, notification: nil, errors: {})\n  end\nend`,
		correct: false,
		feedback:
			'This skips persistence entirely. No notification record is created. Use model callbacks to broadcast after the record is saved.',
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{
		commands: INSTALL_CABLE_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	{
		commands: RUN_INSTALL_COMMANDS,
		outputLines: [
			{
				text: 'create  db/cable_migrate/create_solid_cable_messages.rb',
				color: 'cyan' as const,
			},
			{ text: 'create  config/cable.yml', color: 'cyan' as const },
			{ text: 'Solid Cable installed successfully.', color: 'green' as const },
		],
	},
	null,
	{
		commands: GENERATE_CHANNEL_COMMANDS,
		outputLines: [
			{
				text: 'create  app/channels/notifications_channel.rb',
				color: 'cyan' as const,
			},
			{
				text: 'create  test/channels/notifications_channel_test.rb',
				color: 'cyan' as const,
			},
		],
	},
	null,
	null,
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: {
			id: string;
			label: string;
			correct: boolean;
			feedback?: string;
		}[];
	}
> = {
	2: {
		title: 'Configure Adapter',
		description: 'Configure the Action Cable adapter for production.',
		options: CONFIGURE_ADAPTER_OPTIONS,
	},
	4: {
		title: 'Authenticate Connection',
		description:
			'Authenticate WebSocket connections to prevent unauthorized access.',
		options: AUTHENTICATE_CONNECTION_OPTIONS,
	},
	5: {
		title: 'Build Broadcast Service',
		description:
			'Build a service that creates notifications and broadcasts them via the channel.',
		options: BROADCAST_SERVICE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios
// ──────────────────────────────────────────────

// Scenarios ordered to match observe probes first, then build-phase concepts:
// 1. payment-push resolves "POST create payment" probe
// 2. zero-polling resolves "GET notifications (poll)" probe
// 3. server-healthy resolves "GET server health" probe
// 4-5. auth scenarios resolve build steps
const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'payment-push',
		label: 'POST create payment (with push)',
		description: 'Same flow as observe, but server pushes instantly',
		method: 'WS' as 'GET',
		path: '/cable -> NotificationsChannel',
		actor: 'server',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Stripe -> after_create_commit -> broadcast_to_user',
				color: 'cyan',
			},
			{ text: 'Delivered in <15ms (was 2s with polling)', color: 'green' },
		],
	},
	{
		id: 'zero-polling',
		label: 'GET notifications (no polling)',
		description: '50K users, zero polling requests, push only',
		method: 'WS' as 'GET',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '50K WebSocket connections active', color: 'cyan' },
			{ text: '0 polling requests/sec (was 25K)', color: 'green' },
			{ text: '0% wasted work (was 99%)', color: 'green' },
		],
	},
	{
		id: 'server-healthy',
		label: 'GET server health (with WebSocket)',
		description: 'Same check, but polling replaced by WebSocket',
		method: 'WS' as 'GET',
		path: '/cable',
		actor: 'server',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'CPU: 3% (was 95%)', color: 'green' },
			{
				text: 'Connection pool: 50/850 (was 847/850 EXHAUSTED)',
				color: 'green',
			},
			{ text: 'Zero 503 errors', color: 'green' },
		],
	},
	{
		id: 'unauthenticated',
		label: 'Anonymous connect',
		description: 'No authentication cookies',
		method: 'WS' as 'GET',
		path: '/cable',
		actor: 'anonymous',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'find_verified_user -> nil', color: 'red' },
			{ text: 'reject_unauthorized_connection', color: 'red' },
		],
	},
	{
		id: 'wrong-user',
		label: 'Subscribe to other user',
		description: 'Try to eavesdrop on another channel',
		method: 'WS' as 'GET',
		path: '/cable',
		actor: 'attacker',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'stream_for current_user (not target)', color: 'yellow' },
			{ text: 'Cannot subscribe to another user', color: 'red' },
		],
	},
];

// ──────────────────────────────────────────────
// Code preview
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/controllers/api/v1/notifications_controller.rb',
				language: 'ruby',
				code: `class Api::V1::NotificationsController < ApplicationController\n  # Client polls this every 2 seconds\n  # 50K users = 25K requests/sec\n  def index\n    notifications = Current.user\n      .notifications\n      .where(read_at: nil)\n      .order(created_at: :desc)\n    render json: NotificationSerializer.new(notifications)\n  end\nend`,
			},
			{
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService\n  Result = Data.define(:success?, :payment, :errors)\n\n  def initialize(user:, params:)\n    @user = user\n    @params = params\n  end\n\n  def call\n    validation = PaymentContract.new.call(@params)\n    if validation.failure?\n      return Result.new(success?: false, payment: nil,\n        errors: validation.errors.to_h)\n    end\n\n    payment = @user.payments.create!(\n      amount: @params[:amount], status: :completed\n    )\n    # No way to notify the user in real-time!\n    Result.new(success?: true, payment:, errors: {})\n  end\nend`,
			},
		];
	}

	if (phase === 'build') {
		if (completedStep < 0)
			return [
				{
					filename: 'app/services/process_payment.rb',
					language: 'ruby',
					code: `class ProcessPayment < ApplicationService\n  Result = Data.define(:success?, :payment, :errors)\n  # Payment completes but no real-time push...\nend`,
				},
			];
		if (completedStep < 2)
			return [
				{
					filename: 'Gemfile',
					language: 'ruby',
					code: `# Gemfile\ngem "solid_cable"\n# Installed + solid_cable:install run`,
				},
			];
		if (completedStep < 3)
			return [
				{
					filename: 'config/cable.yml',
					language: 'yaml',
					code: `production:\n  adapter: solid_cable\n  polling_interval: 0.1.seconds\n  message_retention: 1.day`,
				},
			];
		if (completedStep < 4)
			return [
				{
					filename: 'app/channels/notifications_channel.rb',
					language: 'ruby',
					code: `class NotificationsChannel < ApplicationCable::Channel\n  def subscribed\n    stream_for current_user\n  end\nend`,
				},
				{
					filename: 'config/cable.yml',
					language: 'yaml',
					code: `production:\n  adapter: solid_cable\n  polling_interval: 0.1.seconds\n  message_retention: 1.day`,
				},
			];
		if (completedStep < 5)
			return [
				{
					filename: 'app/channels/application_cable/connection.rb',
					language: 'ruby',
					code: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = find_verified_user\n    end\n\n    private\n\n    def find_verified_user\n      verified = User.find_by(id: cookies.encrypted[:user_id])\n      verified || reject_unauthorized_connection\n    end\n  end\nend`,
				},
				{
					filename: 'app/channels/notifications_channel.rb',
					language: 'ruby',
					code: `class NotificationsChannel < ApplicationCable::Channel\n  def subscribed\n    stream_for current_user\n  end\nend`,
				},
			];
	}

	// reward or build complete
	return [
		{
			filename: 'app/services/broadcast_notification.rb',
			language: 'ruby',
			code: `class BroadcastNotification < ApplicationService\n  Result = Data.define(:success?, :notification, :errors)\n\n  def initialize(user:, title:, body:)\n    @user = user; @title = title; @body = body\n  end\n\n  def call\n    v = NotificationContract.new.call(title: @title, body: @body)\n    if v.failure?\n      return Result.new(success?: false, notification: nil,\n        errors: v.errors.to_h)\n    end\n    notification = @user.notifications.create!(\n      title: @title, body: @body)\n    Result.new(success?: true, notification:, errors: {})\n  end\nend`,
		},
		{
			filename: 'app/models/notification.rb',
			language: 'ruby',
			code: `class Notification < ApplicationRecord\n  belongs_to :user\n  validates :title, :body, presence: true\n\n  after_create_commit :broadcast_to_user\n\n  private\n\n  def broadcast_to_user\n    NotificationsChannel.broadcast_to(\n      user,\n      NotificationSerializer.new(self).serializable_hash\n    )\n  end\nend`,
		},
		{
			filename: 'app/channels/application_cable/connection.rb',
			language: 'ruby',
			code: `module ApplicationCable\n  class Connection < ActionCable::Connection::Base\n    identified_by :current_user\n\n    def connect\n      self.current_user = find_verified_user\n    end\n\n    private\n\n    def find_verified_user\n      verified = User.find_by(id: cookies.encrypted[:user_id])\n      verified || reject_unauthorized_connection\n    end\n  end\nend`,
		},
	];
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level37RealTime({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('reward');
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Viz state
	const [clientState, setClientState] =
		useState<ClientVizState>(DEFAULT_CLIENT);
	const [serverVizState, setServerVizState] =
		useState<ServerVizState>(DEFAULT_SERVER);
	const [edgeState, setEdgeState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [processorState, setProcessorState] =
		useState<ProcessorVizState>(DEFAULT_PROCESSOR);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE_B);

	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Animation helpers ──
	const resetViz = useCallback(() => {
		setClientState(DEFAULT_CLIENT);
		setServerVizState(DEFAULT_SERVER);
		setEdgeState(DEFAULT_EDGE);
		setProcessorState(DEFAULT_PROCESSOR);
		setEdgeBState(DEFAULT_EDGE_B);
	}, []);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.client) setClientState((prev) => ({ ...prev, ...frame.client }));
		if (frame.server)
			setServerVizState((prev) => ({ ...prev, ...frame.server }));
		if (frame.edge) setEdgeState((prev) => ({ ...prev, ...frame.edge }));
		if (frame.processor)
			setProcessorState((prev) => ({ ...prev, ...frame.processor }));
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
			const tEnd = setTimeout(() => {
				setVizAnimating(false);
				onDone?.();
			}, frames.length * delay);
			newTimers.push(tEnd);
			timersRef.current = newTimers;
		},
		[resetViz, applyFrame],
	);

	// ── Probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = PROBE_FRAMES[probeId];
			// Slower frame delay for polling probe (10 frames of round-trips need time)
			const delay =
				probeId === 'check-polling'
					? ANIMATION_DURATION_MS * 1.5
					: ANIMATION_DURATION_MS;
			if (frames) runAnimation(frames, undefined, delay);
		},
		[vizAnimating, discoveryGating, runAnimation],
	);

	// ── Build: option handler ──
	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const config = OPTION_STEP_CONFIG[stepper.currentStep];
			if (!config) return;
			const option = config.options.find((o) => o.id === optionId);
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

	// ── Reward: fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_FRAME_MAP[scenarioId];
			if (frames) {
				// Reset to reward baseline before each scenario
				setClientState(DEFAULT_CLIENT);
				setServerVizState({ ...DEFAULT_SERVER, cpu: 3, connections: '50K' });
				setEdgeState(DEFAULT_EDGE);
				setProcessorState(DEFAULT_PROCESSOR);
				setEdgeBState(DEFAULT_EDGE_B);
				runAnimation(frames);
			}
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── Validation ──
	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward')
			return {
				valid: false,
				message: 'Complete all phases',
				details: ['Finish observe, build, and reward phases'],
			};
		return {
			valid: true,
			message: 'Real-time notifications with Action Cable deployed!',
		};
	}, [phase]);

	const handleComplete = useCallback(() => {
		onComplete({ stars: stepper.starRating });
	}, [onComplete, stepper.starRating]);

	// ── Flow diagram data ──
	const isReward = phase === 'reward';

	const flowNodes = useMemo(
		(): Node[] => [
			{
				id: 'client',
				type: 'client',
				position: { x: 0, y: 50 },
				data: { ...clientState } satisfies ClientNodeData,
			},
			{
				id: 'server',
				type: 'server',
				position: { x: 350, y: 0 },
				data: { ...serverVizState, isReward } satisfies ServerNodeData,
			},
			{
				id: 'processor',
				type: 'processor',
				position: { x: 700, y: 50 },
				data: { ...processorState } satisfies ProcessorNodeData,
			},
		],
		[clientState, serverVizState, isReward, processorState],
	);

	const flowEdges = useMemo(
		(): Edge[] => [
			{
				id: 'e-conn',
				source: 'client',
				target: 'server',
				type: 'connection',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: {
					...edgeState,
					isWebSocket: isReward,
				} satisfies ConnectionEdgeData,
			},
			{
				id: 'e-connB',
				source: 'server',
				target: 'processor',
				type: 'connection',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: {
					...edgeBState,
					isWebSocket: false,
				} satisfies ConnectionEdgeData,
			},
		],
		[edgeState, edgeBState, isReward],
	);

	// ── Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<InstructionPanel
					goal="Discover why HTTP polling is killing the server."
					instructions={[
						'Fire probes to see polling traffic hit the server.',
						'Watch the CPU and connection pool as requests flood in.',
						'Try creating a payment and see how long the user waits.',
					]}
					scenario="50,000 users poll GET /notifications every 2 seconds. That is 25,000 requests per second, and 99% return nothing. Server CPU is at 95%."
				>
					<div className="p-4 border-t border-border">
						<DiscoveryChecklist
							discoveredCount={discoveryGating.discoveredCount}
							discoveries={discoveryGating.discoveries}
							minRequired={discoveryGating.minRequired}
						/>
					</div>
				</InstructionPanel>
			);
		}
		if (phase === 'build') {
			return (
				<InstructionPanel
					goal="Replace HTTP polling with WebSocket push."
					instructions={[
						'Install Solid Cable (no Redis needed).',
						'Run the installer and configure the adapter.',
						'Generate a channel and authenticate connections.',
						'Build a broadcast service with after_create_commit.',
					]}
					scenario="Rails 8 uses Solid Cable as the default Action Cable adapter."
				>
					<div className="p-4 border-t border-border">
						<StepProgress
							currentStep={stepper.currentStep}
							steps={stepper.steps}
						/>
					</div>
				</InstructionPanel>
			);
		}
		return (
			<InstructionPanel
				goal="Stress-test the WebSocket push system."
				instructions={[
					'Fire scenarios to see instant push delivery.',
					'Try unauthorized connections and see them rejected.',
					'Compare: 0 polling requests, 3% CPU.',
				]}
				scenario="Action Cable with Solid Cable is live. Server pushes notifications instantly via WebSocket."
			>
				<div className="p-4 border-t border-border">
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Legend
					</div>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
							<span className="text-foreground">Push delivered</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
							<span className="text-foreground">Connection rejected</span>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-3">
						<div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
								{stressTest.allowedCount}
							</div>
							<div className="text-xs text-emerald-600 dark:text-emerald-400">
								Delivered
							</div>
						</div>
						<div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-red-700 dark:text-red-400">
								{stressTest.blockedCount}
							</div>
							<div className="text-xs text-red-600 dark:text-red-400">
								Rejected
							</div>
						</div>
					</div>
				</div>
			</InstructionPanel>
		);
	};

	// ── Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={realtimeEdgeTypes}
							nodes={flowNodes}
							nodeTypes={realtimeNodeTypes}
						/>
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
					{discoveryGating.isUnlocked && (
						<div className="p-4 flex justify-center animate-in fade-in duration-500">
							<Button onClick={() => setPhase('build')}>
								<Zap className="w-4 h-4 mr-2" />
								Build the Fix
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			const currentStep = stepper.currentStep;
			const terminalData = TERMINAL_STEP_MAP[currentStep];
			if (terminalData) {
				return (
					<div className="flex-1 flex flex-col p-6">
						<TerminalChoiceStep
							commands={terminalData.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{currentStep === 0 &&
										'Install the database-backed WebSocket adapter for Rails 8.'}
									{currentStep === 1 &&
										'Run the installer to create the cable message table and configuration.'}
									{currentStep === 3 &&
										'Generate a channel class for real-time notification delivery.'}
								</p>
							}
							hasNext={currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb: string) => stepper.recordWrongAttempt(fb)}
							outputLines={terminalData.outputLines ?? []}
							stepKey={currentStep}
							title={STEP_DEFS[currentStep].title}
						/>
					</div>
				);
			}
			const config = OPTION_STEP_CONFIG[currentStep];
			if (!config) return null;
			return (
				<div className="flex-1 flex flex-col p-6 overflow-y-auto">
					<div className="mb-4">
						<h3 className="text-lg font-semibold text-foreground">
							{config.title}
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							{config.description}
						</p>
					</div>
					{wrongFeedback && (
						<div className="mb-4">
							<ErrorFeedback
								message={wrongFeedback}
								onDismiss={() => setWrongFeedback(null)}
							/>
						</div>
					)}
					<div className="space-y-3">
						{config.options.map((opt) => (
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
						currentStep < STEP_DEFS.length - 1 && (
							<div className="mt-4 flex justify-end">
								<Button
									className="gap-2"
									onClick={() => {
										setWrongFeedback(null);
										stepper.nextStep();
									}}
									size="sm"
								>
									Next Step
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						)}
					{stepper.isCurrentStepCompleted &&
						currentStep === STEP_DEFS.length - 1 && (
							<div className="mt-4 flex justify-end">
								<Button
									className="gap-2"
									onClick={() => {
										setWrongFeedback(null);
										setPhase('reward');
									}}
									size="sm"
								>
									Next Step
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						)}
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={realtimeEdgeTypes}
						nodes={flowNodes}
						nodeTypes={realtimeNodeTypes}
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
						onToggleAutoFire={() =>
							stressTest.toggleAutoFire(handleFireScenario)
						}
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
					levelName="Real-Time"
					levelNumber={37}
					onComplete={handleComplete}
					onReset={() => {
						setPhase('observe');
						setWrongFeedback(null);
						setVizAnimating(false);
						resetViz();
						stressTest.reset();
						for (const t of timersRef.current) clearTimeout(t);
						timersRef.current = [];
					}}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						stepper.isCurrentStepCompleted
							? stepper.currentStep
							: stepper.currentStep - 1,
					)}
					learningGoal={
						phase === 'observe'
							? 'HTTP polling wastes 99% of requests. The server does full work for empty responses.'
							: phase === 'build'
								? 'Replace polling with WebSocket push using Action Cable + Solid Cable.'
								: 'Real-time push via WebSocket. No polling. CPU drops from 95% to 3%.'
					}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level37RealTime;

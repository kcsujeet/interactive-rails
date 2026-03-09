/**
 * QueryZoneFlow: Reusable horizontal zone visualization with animated edge dots.
 *
 * Uses React Flow to render clickable zones connected by edges with SVG
 * animateMotion dots. Designed for performance/database levels where the
 * concept is about data flowing between architectural zones (not MVC
 * pipeline stages). Each zone renders structured content slots (code line,
 * badges, status text, loop counters, query logs).
 *
 * Auto-layouts zones horizontally, 350px apart.
 */

import {
	BaseEdge,
	getSmoothStepPath,
	Handle,
	Position,
	ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Edge, EdgeProps, Node, ReactFlowInstance } from '@xyflow/react';
import { Database, type LucideIcon, Search, Server } from 'lucide-react';
import { memo, useMemo } from 'react';

import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export interface QueryZone {
	id: string;
	label: string;
	icon: 'server' | 'search' | 'database';
	/** Whether this zone is visually highlighted */
	highlighted?: boolean;
	/** Color of the highlight border/background */
	highlightColor?: 'green' | 'red';
	/** Panic mode: blinks border + glow (database overwhelmed) */
	panic?: boolean;
	/** Shows pulsing ? indicator until inspected */
	inspectable?: boolean;
	inspected?: boolean;
	// ── Content slots (all optional, rendered in order) ──
	/** Mono code line, e.g. "Post.all" */
	codeLine?: string;
	/** Small colored badge pill, e.g. { text: "1 query", color: "green" } */
	badge?: { text: string; color: 'green' | 'red' | 'yellow' };
	/** Bold status text, e.g. { text: "N+1 DETECTED!", color: "red" } */
	statusText?: { text: string; color: 'green' | 'red' };
	/** Small badge below status text */
	statusBadge?: { text: string; color: 'green' | 'red' };
	/** Serializer-style loop counter */
	loopCounter?: { current: number; total: number };
	/** Cascading query log with line-by-line reveal */
	queryLog?: { lines: string[]; visibleCount: number };
	/** Muted placeholder text when zone has no active content */
	waitingText?: string;
}

export interface QueryZoneDot {
	color: string;
	dur: string;
	begin: string;
	r: number;
}

export interface QueryZoneEdge {
	from: string;
	to: string;
	dots: QueryZoneDot[];
	active: boolean;
	/** When true, edge stroke turns red and thicker */
	danger?: boolean;
}

export interface QueryZoneFlowProps {
	zones: QueryZone[];
	edges: QueryZoneEdge[];
	/** Called when a zone node is clicked */
	onZoneClick?: (zoneId: string) => void;
	className?: string;
}

// ──────────────────────────────────────────────
// Dot presets
// ──────────────────────────────────────────────

/** Single green dot, normal speed */
export const QUERY_DOTS_NORMAL: QueryZoneDot[] = [
	{ color: '#22c55e', dur: '1.2s', begin: '0s', r: 4 },
];

/** 12 red dots flooding the edge (fast, tightly staggered) */
export const QUERY_DOTS_FLOOD: QueryZoneDot[] = Array.from(
	{ length: 12 },
	(_, i) => ({
		color: '#ef4444',
		dur: '0.5s',
		begin: `${(-i * 0.5) / 12}s`,
		r: 5,
	}),
);

/** 2 green dots, gentle flow */
export const QUERY_DOTS_CLEAN: QueryZoneDot[] = [
	{ color: '#22c55e', dur: '1.5s', begin: '0s', r: 4 },
	{ color: '#22c55e', dur: '1.5s', begin: '-0.75s', r: 4 },
];

/** 6 red dots, fast danger flow */
export const QUERY_DOTS_DANGER: QueryZoneDot[] = Array.from(
	{ length: 6 },
	(_, i) => ({
		color: '#ef4444',
		dur: '0.7s',
		begin: `${(-i * 0.7) / 6}s`,
		r: 5,
	}),
);

// ──────────────────────────────────────────────
// Icon map
// ──────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
	server: Server,
	search: Search,
	database: Database,
};

// ──────────────────────────────────────────────
// Badge color map
// ──────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
	green: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
	red: 'bg-red-500/20 text-red-700 dark:text-red-400',
	yellow: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
};

const STATUS_COLORS: Record<string, string> = {
	green: 'text-emerald-700 dark:text-emerald-400',
	red: 'text-red-700 dark:text-red-400',
};

// ──────────────────────────────────────────────
// Custom node
// ──────────────────────────────────────────────

interface ZoneNodeData {
	zone: QueryZone;
	clickable: boolean;
	[key: string]: unknown;
}

const QueryZoneNode = memo(function QueryZoneNode({
	data,
}: {
	data: ZoneNodeData;
}) {
	const { zone, clickable } = data;
	const Icon = ICON_MAP[zone.icon] ?? Server;
	const showIndicator = zone.inspectable && !zone.inspected;

	const isGreen = zone.highlighted && zone.highlightColor === 'green';
	const isRed = zone.highlighted && zone.highlightColor === 'red';

	return (
		<div
			className={cn(
				'rounded-xl border-2 p-4 min-w-[200px] text-left transition-all duration-300 relative',
				clickable && 'cursor-pointer hover:ring-2 hover:ring-primary/50',
				isGreen && !zone.panic && 'border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40',
				isRed && !zone.panic && 'border-red-500 bg-red-100 dark:bg-red-900/40',
				zone.panic && 'animate-db-panic border-red-500 bg-red-200 dark:bg-red-950',
				!zone.highlighted && 'border-border bg-card',
			)}
		>
			{showIndicator && (
				<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center animate-pulse z-10">
					<span className="text-xs font-bold text-zinc-900">?</span>
				</div>
			)}

			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<Icon className="w-4 h-4 text-muted-foreground" />
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{zone.label}
				</span>
			</div>

			{/* Code line */}
			{zone.codeLine && (
				<div className="text-sm font-mono text-foreground">
					{zone.codeLine}
				</div>
			)}

			{/* Loop counter */}
			{zone.loopCounter && (
				<div className="mt-2 space-y-1 animate-in fade-in duration-300">
					<div className="text-xs font-mono text-red-700 dark:text-red-400">
						Iterating post {zone.loopCounter.current} of{' '}
						{zone.loopCounter.total}...
					</div>
				</div>
			)}

			{/* Badge */}
			{zone.badge && (
				<div className="mt-2 animate-in fade-in duration-300">
					<span
						className={cn(
							'text-xs px-2 py-0.5 rounded-full font-medium',
							BADGE_COLORS[zone.badge.color],
						)}
					>
						{zone.badge.text}
					</span>
				</div>
			)}

			{/* Query log */}
			{zone.queryLog && zone.queryLog.visibleCount > 0 && (
				<div className="animate-in fade-in duration-300">
					<div className="font-mono text-[10px] leading-tight space-y-px mb-2 rounded bg-zinc-900 dark:bg-zinc-950 p-2">
						{zone.queryLog.lines
							.slice(0, zone.queryLog.visibleCount)
							.map((line, i) => (
								<div
									className={
										i === 0
											? 'text-emerald-400'
											: 'text-red-400'
									}
									key={i}
								>
									{line}
								</div>
							))}
					</div>
				</div>
			)}

			{/* Status text */}
			{zone.statusText && (
				<div className="animate-in fade-in duration-300">
					<div
						className={cn(
							'text-sm font-mono font-semibold',
							STATUS_COLORS[zone.statusText.color],
						)}
					>
						{zone.statusText.text}
					</div>
				</div>
			)}

			{/* Status badge */}
			{zone.statusBadge && (
				<span
					className={cn(
						'mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium',
						BADGE_COLORS[zone.statusBadge.color],
					)}
				>
					{zone.statusBadge.text}
				</span>
			)}

			{/* Waiting text */}
			{zone.waitingText && (
				<div className="text-sm text-muted-foreground">
					{zone.waitingText}
				</div>
			)}

			{/* Handles */}
			<Handle
				className="opacity-0! w-0! h-0!"
				id="left-target"
				position={Position.Left}
				type="target"
			/>
			<Handle
				className="opacity-0! w-0! h-0!"
				id="right-source"
				position={Position.Right}
				type="source"
			/>
		</div>
	);
});

// ──────────────────────────────────────────────
// Custom edge
// ──────────────────────────────────────────────

interface InternalEdgeData {
	dots: Array<{ id: string } & QueryZoneDot>;
	active: boolean;
	danger: boolean;
	[key: string]: unknown;
}

function QueryZoneFlowEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
}: EdgeProps) {
	const { dots = [], active = false, danger = false } = (data ?? {}) as InternalEdgeData;

	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	return (
		<>
			{danger && active ? (
				<path
					className="fill-none"
					d={edgePath}
					stroke="#ef4444"
					strokeOpacity={0.6}
					strokeWidth={3}
				/>
			) : (
				<BaseEdge id={id} path={edgePath} />
			)}
			{active &&
				dots.map((dot) => (
					<circle fill={dot.color} key={dot.id} r={dot.r}>
						<animateMotion
							begin={dot.begin}
							dur={dot.dur}
							fill="freeze"
							path={edgePath}
							repeatCount="indefinite"
						/>
					</circle>
				))}
		</>
	);
}

// ──────────────────────────────────────────────
// Type registries (module-scope, stable references)
// ──────────────────────────────────────────────

const zoneNodeTypes = { queryZone: QueryZoneNode };
const zoneEdgeTypes = { queryZoneFlow: QueryZoneFlowEdge };

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ZONE_SPACING = 350;

function buildZoneNodes(
	zones: QueryZone[],
	clickable: boolean,
): Node[] {
	return zones.map((zone, i) => ({
		id: zone.id,
		type: 'queryZone',
		position: { x: i * ZONE_SPACING, y: 0 },
		data: { zone, clickable } satisfies ZoneNodeData,
	}));
}

function buildZoneEdges(edges: QueryZoneEdge[]): Edge[] {
	return edges.map((edge, i) => ({
		id: `e-${edge.from}-${edge.to}`,
		source: edge.from,
		target: edge.to,
		type: 'queryZoneFlow',
		sourceHandle: 'right-source',
		targetHandle: 'left-target',
		data: {
			dots: edge.dots.map((d, j) => ({ ...d, id: `e${i}-d${j}` })),
			active: edge.active,
			danger: edge.danger ?? false,
		} satisfies InternalEdgeData,
	}));
}

function handleInit(instance: ReactFlowInstance) {
	requestAnimationFrame(() => instance.fitView({ padding: 0.2 }));
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function QueryZoneFlow({
	zones,
	edges,
	onZoneClick,
	className,
}: QueryZoneFlowProps) {
	const isClickable = !!onZoneClick;
	const nodes = useMemo(
		() => buildZoneNodes(zones, isClickable),
		[zones, isClickable],
	);
	const flowEdges = useMemo(() => buildZoneEdges(edges), [edges]);

	const handleNodeClick = useMemo(() => {
		if (!onZoneClick) return undefined;
		return (_event: React.MouseEvent, node: Node) => {
			onZoneClick(node.id);
		};
	}, [onZoneClick]);

	return (
		<ReactFlow
			className={className}
			edges={flowEdges}
			edgeTypes={zoneEdgeTypes}
			elementsSelectable={isClickable}
			nodes={nodes}
			nodesConnectable={false}
			nodesDraggable={false}
			nodesFocusable={false}
			nodeTypes={zoneNodeTypes}
			onInit={handleInit}
			onNodeClick={handleNodeClick}
			proOptions={{ hideAttribution: true }}
		/>
	);
}

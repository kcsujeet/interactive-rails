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

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, getSmoothStepPath } from '@xyflow/react';
import { memo, useMemo } from 'react';
import {
	AnimatedDots,
	FlowDiagram,
	FlowHandles,
} from '@/components/levels/FlowDiagram';
import { FlowNode } from '@/components/levels/FlowNode';
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
	/** Mono code line, e.g. "Product.all" */
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

/** Map zone icon to 2-letter code for FlowNode */
const ZONE_ICON_CODES: Record<string, string> = {
	server: 'SV',
	search: 'SR',
	database: 'DB',
};

/** Map zone highlight state to a hex color for the FlowNode header */
const ZONE_COLORS: Record<string, string> = {
	green: '#10b981',
	red: '#ef4444',
	default: '#a1a1aa',
};

const QueryZoneNode = memo(function QueryZoneNode({
	data,
}: {
	data: ZoneNodeData;
}) {
	const { zone, clickable } = data;
	const showIndicator = zone.inspectable && !zone.inspected;

	const isGreen = zone.highlighted && zone.highlightColor === 'green';
	const isRed = zone.highlighted && zone.highlightColor === 'red';

	const color = isGreen
		? ZONE_COLORS.green
		: isRed
			? ZONE_COLORS.red
			: ZONE_COLORS.default;

	const status: 'idle' | 'active' | 'warning' | 'error' = isGreen
		? 'active'
		: isRed || zone.panic
			? 'error'
			: 'idle';

	return (
		<div
			className={cn(
				'relative',
				zone.panic && 'animate-db-panic',
				clickable && 'cursor-pointer',
			)}
		>
			{showIndicator && (
				<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center animate-pulse z-10">
					<span className="text-xs font-bold text-zinc-900">?</span>
				</div>
			)}
			<FlowNode
				data={{
					label: zone.label,
					icon: ZONE_ICON_CODES[zone.icon] ?? 'ZN',
					color,
					status,
					showTarget: false,
					showSource: false,
				}}
			>
				{zone.codeLine && (
					<div className="text-sm font-mono text-foreground">
						{zone.codeLine}
					</div>
				)}

				{zone.loopCounter && (
					<div className="text-xs font-mono text-red-700 dark:text-red-400 animate-in fade-in duration-300">
						Iterating post {zone.loopCounter.current} of{' '}
						{zone.loopCounter.total}...
					</div>
				)}

				{zone.badge && (
					<div className="animate-in fade-in duration-300">
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

				{zone.queryLog && zone.queryLog.visibleCount > 0 && (
					<div className="animate-in fade-in duration-300">
						<div className="font-mono text-[10px] leading-tight space-y-px rounded bg-muted p-2">
							{zone.queryLog.lines
								.slice(0, zone.queryLog.visibleCount)
								.map((line, i) => (
									<div
										className={
											i === 0
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-red-600 dark:text-red-400'
										}
										key={`${i}-${line}`}
									>
										{line}
									</div>
								))}
						</div>
					</div>
				)}

				{zone.statusText && (
					<div
						className={cn(
							'text-sm font-mono font-semibold animate-in fade-in duration-300',
							STATUS_COLORS[zone.statusText.color],
						)}
					>
						{zone.statusText.text}
					</div>
				)}

				{zone.statusBadge && (
					<span
						className={cn(
							'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
							BADGE_COLORS[zone.statusBadge.color],
						)}
					>
						{zone.statusBadge.text}
					</span>
				)}

				{zone.waitingText && (
					<div className="text-sm text-muted-foreground">
						{zone.waitingText}
					</div>
				)}
			</FlowNode>
			<FlowHandles />
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
	const {
		dots = [],
		active = false,
		danger = false,
	} = (data ?? {}) as InternalEdgeData;

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
			{active && dots.length > 0 && (
				<AnimatedDots
					dots={dots.map((dot) => ({
						...dot,
						r: dot.r,
					}))}
					path={edgePath}
				/>
			)}
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

function buildZoneNodes(zones: QueryZone[], clickable: boolean): Node[] {
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

	return (
		<FlowDiagram
			className={className}
			edges={flowEdges}
			edgeTypes={zoneEdgeTypes}
			fitViewPadding={0.2}
			nodes={nodes}
			nodeTypes={zoneNodeTypes}
			onNodeClick={onZoneClick}
		/>
	);
}

/**
 * PipelineFlow: Reusable horizontal pipeline visualization with animated flowing dots.
 *
 * Uses React Flow to render stages connected by edges with SVG animateMotion dots.
 * Auto-layouts stages in a horizontal row, 250px apart.
 */

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, getSmoothStepPath, Position } from '@xyflow/react';
import { memo, useMemo } from 'react';

import {
	AnimatedDots,
	type DotConfig,
	FlowDiagram,
	FlowHandles,
} from '@/components/levels/FlowDiagram';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export interface PipelineStage {
	id: string;
	label: string;
	sublabel?: string;
	/** 'default' = zinc, 'active' = emerald, 'danger' = red, 'inactive' = dashed + dimmed */
	variant?: 'default' | 'active' | 'danger' | 'inactive';
	/** Pulsing badge text (e.g. "500!", "FAIL") */
	badge?: string;
	/** Whether this stage can be clicked to inspect (shows pulsing ? indicator) */
	inspectable?: boolean;
	/** Whether this stage has been inspected (hides the ? indicator) */
	inspected?: boolean;
	/** Explicit position. If omitted, auto-positioned in horizontal chain. */
	position?: { x: number; y: number };
}

export interface PipelineDot {
	color: string;
	dur?: string;
	begin?: string;
}

export interface PipelineConnection {
	from: string;
	to: string;
	/** Custom dot array, a preset name, or undefined for no dots */
	dots?: PipelineDot[] | 'mixed' | 'clean';
	/** Which side of the source node the edge leaves from. Default: 'right' */
	sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
	/** Which side of the target node the edge enters. Default: 'left' */
	targetHandle?: 'top' | 'right' | 'bottom' | 'left';
	/** If true, a return edge (target -> source) is also created */
	bidirectional?: boolean;
}

export interface PipelineFlowProps {
	stages: PipelineStage[];
	connections: PipelineConnection[];
	/** Called when a stage node is clicked. Enables interactive pipeline. */
	onNodeClick?: (stageId: string) => void;
	className?: string;
	/**
	 * Controls which edges animate.
	 * - undefined: all edges show idle animation (backward compat default)
	 * - []: fully dormant, no dots
	 * - ['request-router', ...]: only listed edges animate (single-pass)
	 */
	activeConnections?: string[];
}

// ──────────────────────────────────────────────
// Dot presets
// ──────────────────────────────────────────────

/** 4 dots (3 green + 1 red), staggered so they appear distributed on mount */
export const PIPELINE_DOTS_MIXED: PipelineDot[] = [
	{ color: '#22c55e', dur: '3.5s', begin: '0s' },
	{ color: '#ef4444', dur: '3.5s', begin: '-0.9s' },
	{ color: '#22c55e', dur: '3.5s', begin: '-1.8s' },
	{ color: '#22c55e', dur: '3.5s', begin: '-2.7s' },
];

/** 3 dots (all green), staggered */
export const PIPELINE_DOTS_CLEAN: PipelineDot[] = [
	{ color: '#22c55e', dur: '3.5s', begin: '0s' },
	{ color: '#22c55e', dur: '3.5s', begin: '-1.2s' },
	{ color: '#22c55e', dur: '3.5s', begin: '-2.4s' },
];

// ──────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────

/** Edge animation mode: idle = subtle always-on, active = single-pass, dormant = no dots */
type EdgeMode = 'idle' | 'active' | 'dormant';

interface PipelineEdgeData {
	dots?: DotConfig[];
	mode: EdgeMode;
	/** True for return edges (dashed line, shifted right/down) */
	isReturn?: boolean;
	/** True for forward edges that have a bidirectional counterpart (shifted left/up) */
	isBidirectional?: boolean;
	[key: string]: unknown;
}

interface StageNodeData {
	label: string;
	sublabel?: string;
	variant: 'default' | 'active' | 'danger' | 'inactive';
	badge?: string;
	clickable?: boolean;
	inspectable?: boolean;
	inspected?: boolean;
	[key: string]: unknown;
}

// ──────────────────────────────────────────────
// Custom node
// ──────────────────────────────────────────────

const PipelineStageNode = memo(function PipelineStageNode({
	data,
}: {
	data: StageNodeData;
}) {
	const isActive = data.variant === 'active';
	const isDanger = data.variant === 'danger';
	const isInactive = data.variant === 'inactive';
	const isDefault = !isActive && !isDanger && !isInactive;
	const showIndicator = data.inspectable && !data.inspected;

	return (
		<div
			className={cn(
				'px-6 py-4 rounded-lg border-2 min-w-[120px] text-center relative transition-colors',
				isActive && 'bg-emerald-900/60 border-emerald-500',
				isDanger && 'bg-red-900/60 border-red-500',
				isInactive && 'bg-zinc-900/40 border-zinc-600 border-dashed opacity-60',
				isDefault && 'bg-zinc-800 border-zinc-600',
				data.clickable &&
					'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow',
			)}
		>
			{/* Pulsing ? indicator for uninspected clickable stages */}
			{showIndicator && (
				<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
					<span className="text-xs font-bold text-zinc-900">?</span>
				</div>
			)}
			<div
				className={cn(
					'text-sm font-medium',
					(isActive || isDanger) && 'text-white',
					isInactive && 'text-zinc-500',
					isDefault && 'text-zinc-300',
				)}
			>
				{data.label}
			</div>
			{data.sublabel && (
				<div
					className={cn(
						'text-xs mt-1',
						isActive && 'text-emerald-300',
						isDanger && 'text-red-300',
						isInactive && 'text-zinc-600',
						isDefault && 'text-zinc-500',
					)}
				>
					{data.sublabel}
				</div>
			)}
			{data.badge && (
				<div className="text-xs font-bold mt-1.5 animate-pulse text-red-400">
					{data.badge}
				</div>
			)}
			<FlowHandles />
		</div>
	);
});

// ──────────────────────────────────────────────
// Custom edge
// ──────────────────────────────────────────────

/**
 * Half-offset for symmetric parallel lanes.
 * Forward edge shifts -LANE_OFFSET, return edge shifts +LANE_OFFSET.
 */
const LANE_OFFSET = 14;

function PipelineFlowEdge({
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
		dots,
		mode = 'idle',
		isReturn = false,
		isBidirectional = false,
	} = (data ?? {}) as PipelineEdgeData;

	// Only offset edges that are part of a bidirectional pair
	const needsOffset = isReturn || isBidirectional;
	const isVertical =
		sourcePosition === Position.Top || sourcePosition === Position.Bottom;
	const sign = isReturn ? 1 : -1;

	const offset = needsOffset ? sign * LANE_OFFSET : 0;
	const adjSourceX = sourceX + (isVertical ? offset : 0);
	const adjSourceY = sourceY + (isVertical ? 0 : offset);
	const adjTargetX = targetX + (isVertical ? offset : 0);
	const adjTargetY = targetY + (isVertical ? 0 : offset);

	const [edgePath] = getSmoothStepPath({
		sourceX: adjSourceX,
		sourceY: adjSourceY,
		sourcePosition,
		targetX: adjTargetX,
		targetY: adjTargetY,
		targetPosition,
	});

	return (
		<>
			{isReturn ? (
				<path
					className="fill-none stroke-zinc-600 dark:stroke-zinc-700"
					d={edgePath}
					strokeDasharray="4 4"
					strokeWidth={1}
				/>
			) : (
				<BaseEdge id={id} path={edgePath} />
			)}
			{mode !== 'dormant' && dots && (
				<AnimatedDots
					dots={dots.map((dot) => ({
						...dot,
						r: 8,
						dur: mode === 'active' ? '0.8s' : dot.dur,
						repeatCount: mode === 'active' ? '1' : 'indefinite',
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

const pipelineNodeTypes = { pipelineStage: PipelineStageNode };
const pipelineEdgeTypes = { pipelineFlow: PipelineFlowEdge };

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resolveDots(
	dots: PipelineDot[] | 'mixed' | 'clean' | undefined,
	edgeIndex: number,
): DotConfig[] | undefined {
	if (!dots) return undefined;

	let resolved: PipelineDot[];
	if (dots === 'mixed') resolved = PIPELINE_DOTS_MIXED;
	else if (dots === 'clean') resolved = PIPELINE_DOTS_CLEAN;
	else resolved = dots;

	return resolved.map((d, i) => ({
		id: `e${edgeIndex}-d${i}`,
		color: d.color,
		dur: d.dur ?? '3.5s',
		begin: d.begin ?? '0s',
	}));
}

function buildNodes(stages: PipelineStage[], clickable: boolean): Node[] {
	let autoX = 0;
	return stages.map((stage) => {
		const pos = stage.position ?? { x: autoX, y: 0 };
		if (!stage.position) autoX += 250;
		return {
			id: stage.id,
			type: 'pipelineStage',
			position: pos,
			data: {
				label: stage.label,
				sublabel: stage.sublabel,
				variant: stage.variant ?? 'default',
				badge: stage.badge,
				clickable,
				inspectable: stage.inspectable,
				inspected: stage.inspected,
			} satisfies StageNodeData,
		};
	});
}

function buildEdges(
	connections: PipelineConnection[],
	activeConnectionIds?: string[],
): Edge[] {
	const edges: Edge[] = [];
	let edgeIndex = 0;

	for (const conn of connections) {
		const connKey = `${conn.from}-${conn.to}`;
		const mode: EdgeMode =
			activeConnectionIds === undefined
				? 'idle'
				: activeConnectionIds.includes(connKey)
					? 'active'
					: 'dormant';

		edges.push({
			id: `e-${connKey}`,
			source: conn.from,
			target: conn.to,
			type: 'pipelineFlow',
			sourceHandle: conn.sourceHandle
				? `${conn.sourceHandle}-source`
				: 'right-source',
			targetHandle: conn.targetHandle
				? `${conn.targetHandle}-target`
				: 'left-target',
			data: {
				dots: resolveDots(conn.dots, edgeIndex),
				mode,
				isBidirectional: conn.bidirectional ?? false,
			} satisfies PipelineEdgeData,
		});
		edgeIndex++;

		if (conn.bidirectional) {
			const returnKey = `${conn.to}-${conn.from}`;
			const returnMode: EdgeMode =
				activeConnectionIds === undefined
					? 'idle'
					: activeConnectionIds.includes(returnKey)
						? 'active'
						: 'dormant';

			edges.push({
				id: `e-${returnKey}`,
				source: conn.to,
				target: conn.from,
				type: 'pipelineFlow',
				sourceHandle: conn.targetHandle
					? `${conn.targetHandle}-source`
					: 'left-source',
				targetHandle: conn.sourceHandle
					? `${conn.sourceHandle}-target`
					: 'right-target',
				data: {
					dots: resolveDots(conn.dots, edgeIndex),
					isReturn: true,
					mode: returnMode,
				} satisfies PipelineEdgeData,
			});
			edgeIndex++;
		}
	}

	return edges;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function PipelineFlow({
	stages,
	connections,
	onNodeClick,
	className,
	activeConnections,
}: PipelineFlowProps) {
	const isClickable = !!onNodeClick;
	const nodes = useMemo(
		() => buildNodes(stages, isClickable),
		[stages, isClickable],
	);
	const edges = useMemo(
		() => buildEdges(connections, activeConnections),
		[connections, activeConnections],
	);

	return (
		<FlowDiagram
			className={className}
			edges={edges}
			edgeTypes={pipelineEdgeTypes}
			nodes={nodes}
			nodeTypes={pipelineNodeTypes}
			onNodeClick={onNodeClick}
		/>
	);
}

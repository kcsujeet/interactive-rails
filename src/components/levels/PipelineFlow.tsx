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
import { FlowNode } from '@/components/levels/FlowNode';
import { getNodeStyle } from '@/lib/node-styles';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export interface PipelineStage {
	id: string;
	label: string;
	sublabel?: string;
	/** 'default' = zinc, 'active' = emerald, 'danger' = red, 'critical' = whole-card red pulse, 'inactive' = dashed + dimmed */
	variant?: 'default' | 'active' | 'danger' | 'critical' | 'inactive';
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
	dots?: PipelineDot[] | 'mixed' | 'clean' | 'danger';
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
	/**
	 * Optional tick. Mixed into dot ids so re-firing the same probe (which
	 * keeps `activeConnections` identical) still remounts the SVG circles
	 * and restarts the single-pass `<animateMotion>` element. Without this,
	 * a second fire of the same probe is silent because React keeps the
	 * existing circles mounted and SVG animations with `repeatCount: '1'`
	 * have already completed.
	 */
	animationTick?: number;
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

/** 4 dots (all red), staggered. Use for actively-broken pipelines. */
export const PIPELINE_DOTS_DANGER: PipelineDot[] = [
	{ color: '#ef4444', dur: '3.5s', begin: '0s' },
	{ color: '#ef4444', dur: '3.5s', begin: '-0.9s' },
	{ color: '#ef4444', dur: '3.5s', begin: '-1.8s' },
	{ color: '#ef4444', dur: '3.5s', begin: '-2.7s' },
];

// ──────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────

/** Edge animation mode: idle = subtle always-on, active = single-pass, dormant = no dots */
type EdgeMode = 'idle' | 'active' | 'dormant';

interface PipelineEdgeData {
	dots?: DotConfig[];
	mode: EdgeMode;
	/** When set, the edge passes this through to AnimatedDots as `restartTick` so the SMIL animation is re-fired imperatively on each tick. Used in active mode. */
	animationTick?: number;
	/** True for return edges (dashed line, shifted right/down) */
	isReturn?: boolean;
	/** True for forward edges that have a bidirectional counterpart (shifted left/up) */
	isBidirectional?: boolean;
	[key: string]: unknown;
}

interface StageNodeData {
	label: string;
	sublabel?: string;
	variant: 'default' | 'active' | 'danger' | 'critical' | 'inactive';
	badge?: string;
	clickable?: boolean;
	inspectable?: boolean;
	inspected?: boolean;
	[key: string]: unknown;
}

// ──────────────────────────────────────────────
// Custom node
// ──────────────────────────────────────────────

/** Variant overrides: active/danger/critical override the label color */
const VARIANT_OVERRIDE_COLORS: Record<string, string> = {
	active: '#10b981',
	danger: '#ef4444',
	critical: '#ef4444',
	inactive: '#71717a',
};

const PipelineStageNode = memo(function PipelineStageNode({
	data,
}: {
	data: StageNodeData;
}) {
	const variant = data.variant || 'default';
	const isInactive = variant === 'inactive';
	const showIndicator = data.inspectable && !data.inspected;
	const nodeStyle = getNodeStyle(data.label);
	// Active/danger/inactive override the label's natural color
	const color = VARIANT_OVERRIDE_COLORS[variant] ?? nodeStyle.color;

	const status =
		variant === 'active'
			? 'active'
			: variant === 'critical'
				? 'critical'
				: variant === 'danger'
					? 'error'
					: ('idle' as const);

	return (
		<div
			className={cn(
				'relative',
				isInactive && 'opacity-60',
				data.clickable && 'cursor-pointer',
			)}
		>
			{showIndicator && (
				<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center animate-pulse z-10">
					<span className="text-xs font-bold text-zinc-900">?</span>
				</div>
			)}
			<FlowNode
				data={{
					label: data.label,
					icon: nodeStyle.icon,
					color,
					description: data.sublabel || nodeStyle.description,
					status,
					showTarget: false,
					showSource: false,
				}}
			>
				{data.badge && (
					<div className="text-xs font-bold animate-pulse text-destructive">
						{data.badge}
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
		animationTick,
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
					dots={dots.map((dot, dotIndex) => ({
						...dot,
						r: 8,
						dur: mode === 'active' ? '0.8s' : dot.dur,
						repeatCount: mode === 'active' ? '1' : 'indefinite',
						// In `active` mode the animation is single-pass:
						// AnimatedDots ignores this `begin` (uses
						// "indefinite" + beginElement()) but still parses
						// it as the per-dot stagger delay. In `idle` mode
						// the literal value drives the SVG timeline.
						begin: mode === 'active' ? `${dotIndex * 0.15}s` : dot.begin,
					}))}
					path={edgePath}
					// Only pass restartTick in active (single-pass) mode.
					// In idle (indefinite-loop) mode the staggered negative
					// `begin` values produce the desired ambient cascade
					// and need no programmatic restart.
					restartTick={mode === 'active' ? animationTick : undefined}
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
	dots: PipelineDot[] | 'mixed' | 'clean' | 'danger' | undefined,
	edgeIndex: number,
): DotConfig[] | undefined {
	if (!dots) return undefined;

	let resolved: PipelineDot[];
	if (dots === 'mixed') resolved = PIPELINE_DOTS_MIXED;
	else if (dots === 'clean') resolved = PIPELINE_DOTS_CLEAN;
	else if (dots === 'danger') resolved = PIPELINE_DOTS_DANGER;
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
	activeConnectionIds: string[] | undefined,
	animationTick: number | undefined,
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
				animationTick,
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
					animationTick,
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
	animationTick,
}: PipelineFlowProps) {
	const isClickable = !!onNodeClick;
	const nodes = useMemo(
		() => buildNodes(stages, isClickable),
		[stages, isClickable],
	);
	const edges = useMemo(
		() => buildEdges(connections, activeConnections, animationTick),
		[connections, activeConnections, animationTick],
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

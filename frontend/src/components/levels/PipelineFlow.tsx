/**
 * PipelineFlow: Reusable horizontal pipeline visualization with animated flowing dots.
 *
 * Uses React Flow to render stages connected by edges with SVG animateMotion dots.
 * Auto-layouts stages in a horizontal row, 250px apart.
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
import { memo, useMemo } from 'react';

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
}

export interface PipelineFlowProps {
	stages: PipelineStage[];
	connections: PipelineConnection[];
	/** Called when a stage node is clicked. Enables interactive pipeline. */
	onNodeClick?: (stageId: string) => void;
	className?: string;
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

interface InternalDotConfig {
	id: string;
	color: string;
	dur: string;
	begin: string;
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
			<Handle
				className="opacity-0! w-0! h-0!"
				position={Position.Left}
				type="target"
			/>
			<Handle
				className="opacity-0! w-0! h-0!"
				position={Position.Right}
				type="source"
			/>
		</div>
	);
});

// ──────────────────────────────────────────────
// Custom edge
// ──────────────────────────────────────────────

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
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	const dots = (data as { dots?: InternalDotConfig[] } | undefined)?.dots;

	return (
		<>
			<BaseEdge id={id} path={edgePath} />
			{dots?.map((dot) => (
				<circle fill={dot.color} key={dot.id} r="8">
					<animateMotion
						begin={dot.begin}
						dur={dot.dur}
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

const pipelineNodeTypes = { pipelineStage: PipelineStageNode };
const pipelineEdgeTypes = { pipelineFlow: PipelineFlowEdge };

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resolveDots(
	dots: PipelineDot[] | 'mixed' | 'clean' | undefined,
	edgeIndex: number,
): InternalDotConfig[] | undefined {
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

function buildNodes(
	stages: PipelineStage[],
	clickable: boolean,
): Node[] {
	return stages.map((stage, i) => ({
		id: stage.id,
		type: 'pipelineStage',
		position: { x: i * 250, y: 0 },
		data: {
			label: stage.label,
			sublabel: stage.sublabel,
			variant: stage.variant ?? 'default',
			badge: stage.badge,
			clickable,
			inspectable: stage.inspectable,
			inspected: stage.inspected,
		} satisfies StageNodeData,
	}));
}

function buildEdges(connections: PipelineConnection[]): Edge[] {
	return connections.map((conn, i) => ({
		id: `e-${conn.from}-${conn.to}`,
		source: conn.from,
		target: conn.to,
		type: 'pipelineFlow',
		data: { dots: resolveDots(conn.dots, i) },
	}));
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

function handleInit(instance: ReactFlowInstance) {
	requestAnimationFrame(() => instance.fitView());
}

export function PipelineFlow({
	stages,
	connections,
	onNodeClick,
	className,
}: PipelineFlowProps) {
	const isClickable = !!onNodeClick;
	const nodes = useMemo(
		() => buildNodes(stages, isClickable),
		[stages, isClickable],
	);
	const edges = useMemo(() => buildEdges(connections), [connections]);

	const handleNodeClick = useMemo(() => {
		if (!onNodeClick) return undefined;
		return (_event: MouseEvent, node: Node) => {
			onNodeClick(node.id);
		};
	}, [onNodeClick]);

	return (
		<ReactFlow
			className={className}
			edges={edges}
			edgeTypes={pipelineEdgeTypes}
			elementsSelectable={isClickable}
			nodes={nodes}
			nodesConnectable={false}
			nodesFocusable={false}
			nodeTypes={pipelineNodeTypes}
			onInit={handleInit}
			onNodeClick={handleNodeClick}
			proOptions={{ hideAttribution: true }}
		/>
	);
}

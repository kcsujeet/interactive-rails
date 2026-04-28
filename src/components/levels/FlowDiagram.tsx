/**
 * FlowDiagram: Reusable React Flow wrapper that handles all shared boilerplate.
 *
 * Provides:
 * - FlowDiagram: thin wrapper around ReactFlow with sensible defaults
 * - FlowHandles: invisible handle set (8 handles: all 4 positions, source + target)
 * - AnimatedDots: SVG animateMotion dots that travel along an edge path
 * - DotConfig: type for configuring individual dots
 * - reversePath: utility to reverse an SVG path for reverse-direction dot animation
 *
 * Usage:
 *   import { FlowDiagram, FlowHandles, AnimatedDots } from '@/components/levels/FlowDiagram';
 *
 *   // Define custom node/edge at module scope (stable references)
 *   const MyNode = memo(({ data }) => (
 *     <div>...<FlowHandles /></div>
 *   ));
 *   const myNodeTypes = { custom: MyNode };
 *   const myEdgeTypes = { custom: MyEdge };
 *
 *   // In component:
 *   <FlowDiagram nodes={nodes} edges={edges} nodeTypes={myNodeTypes} edgeTypes={myEdgeTypes} />
 */

import {
	applyNodeChanges,
	Handle,
	type NodeChange,
	Position,
	ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
	Edge,
	EdgeTypes,
	Node,
	NodeTypes,
	ReactFlowInstance,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ──────────────────────────────────────────────
// FlowDiagram props
// ──────────────────────────────────────────────

export interface FlowDiagramProps {
	nodes: Node[];
	edges: Edge[];
	/** Custom node type registry. Must be a module-scope stable reference. */
	nodeTypes: NodeTypes;
	/** Custom edge type registry. Must be a module-scope stable reference. */
	edgeTypes: EdgeTypes;
	/** Called when a node is clicked, with the node ID. */
	onNodeClick?: (nodeId: string) => void;
	className?: string;
	/** fitView padding (default: 0.15) */
	fitViewPadding?: number;
	/** Allow node dragging (default: true) */
	nodesDraggable?: boolean;
}

// ──────────────────────────────────────────────
// FlowDiagram component
// ──────────────────────────────────────────────

function createInitHandler(padding: number) {
	return (instance: ReactFlowInstance) => {
		requestAnimationFrame(() => instance.fitView({ padding }));
	};
}

export function FlowDiagram({
	nodes,
	edges,
	nodeTypes,
	edgeTypes,
	onNodeClick,
	className,
	fitViewPadding = 0.15,
	nodesDraggable = true,
}: FlowDiagramProps) {
	const isClickable = !!onNodeClick;

	// Internal node state: syncs data/type from parent, preserves drag positions.
	// When parent updates nodes (animation frames), we merge new data onto
	// the current positions so user drag offsets are not lost.
	const [internalNodes, setInternalNodes] = useState<Node[]>(nodes);
	const prevNodesRef = useRef(nodes);

	// Sync parent prop changes into internal state, preserving drag positions
	if (nodes !== prevNodesRef.current) {
		prevNodesRef.current = nodes;
		setInternalNodes((prev) => {
			const posMap = new Map(prev.map((n) => [n.id, n.position]));
			return nodes.map((n) => ({
				...n,
				// Keep dragged position if user moved this node, otherwise use parent position
				position: posMap.get(n.id) ?? n.position,
			}));
		});
	}

	// Apply React Flow changes (drag, select, etc.) to internal state
	const handleNodesChange = useCallback((changes: NodeChange[]) => {
		setInternalNodes((nds) => applyNodeChanges(changes, nds));
	}, []);

	const handleNodeClick = useMemo(() => {
		if (!onNodeClick) return undefined;
		return (_event: React.MouseEvent, node: Node) => {
			onNodeClick(node.id);
		};
	}, [onNodeClick]);

	const handleInit = useMemo(
		() => createInitHandler(fitViewPadding),
		[fitViewPadding],
	);

	return (
		<ReactFlow
			className={className}
			edges={edges}
			edgeTypes={edgeTypes}
			elementsSelectable={isClickable}
			nodes={internalNodes}
			nodesConnectable={false}
			nodesDraggable={nodesDraggable}
			nodesFocusable={false}
			nodeTypes={nodeTypes}
			onInit={handleInit}
			onNodeClick={handleNodeClick}
			onNodesChange={handleNodesChange}
			proOptions={{ hideAttribution: true }}
		/>
	);
}

// ──────────────────────────────────────────────
// FlowHandles: invisible handles for custom nodes
// ──────────────────────────────────────────────

const HANDLE_CLASS = 'opacity-0! w-0! h-0!';

/**
 * Renders 8 invisible handles (left/right/top/bottom, each as both source and target).
 * Place this inside any custom node component to enable edge connections from all directions.
 */
export function FlowHandles() {
	return (
		<>
			<Handle
				className={HANDLE_CLASS}
				id="left-target"
				position={Position.Left}
				type="target"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="left-source"
				position={Position.Left}
				type="source"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="right-source"
				position={Position.Right}
				type="source"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="right-target"
				position={Position.Right}
				type="target"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="top-target"
				position={Position.Top}
				type="target"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="top-source"
				position={Position.Top}
				type="source"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="bottom-source"
				position={Position.Bottom}
				type="source"
			/>
			<Handle
				className={HANDLE_CLASS}
				id="bottom-target"
				position={Position.Bottom}
				type="target"
			/>
		</>
	);
}

// ──────────────────────────────────────────────
// AnimatedDots: SVG dot animation along a path
// ──────────────────────────────────────────────

export interface DotConfig {
	id: string;
	/** SVG fill color (hex string, e.g. '#22c55e') */
	color: string;
	/** Dot radius (default: 4) */
	r?: number;
	/** Animation duration (e.g. '1.5s') */
	dur: string;
	/** Animation begin offset (e.g. '0s', '-0.5s') */
	begin: string;
	/** Animation repeat count (default: 'indefinite') */
	repeatCount?: string;
}

interface AnimatedDotsProps {
	dots: DotConfig[];
	/** SVG path string for the dots to travel along */
	path: string;
	/**
	 * When provided, the dots use SMIL's imperative restart API: each
	 * `<animateMotion>` is rendered with `begin="indefinite"` and is
	 * triggered by calling `beginElement()` on the element via a ref.
	 * Whenever this value changes, every dot is re-fired from t=0, with
	 * a stagger derived from the dot's `begin` offset.
	 *
	 * This is the proper way to restart finite-duration SVG animations
	 * (per the SMIL spec / SVGAnimationElement.beginElement on MDN). React
	 * key changes and parent unmount-remount do NOT reliably restart the
	 * animation when React Flow's edge memoization keeps the inner SVG
	 * subtree alive across data updates.
	 *
	 * Leave undefined for indefinite-loop dots (idle mode); the dots will
	 * use `dot.begin` literally and loop forever, which is the intended
	 * behaviour for ambient continuous animation.
	 */
	restartTick?: number;
}

/**
 * Renders animated SVG circles that travel along a given path using SVG animateMotion.
 * Place this inside a custom edge component's SVG return.
 *
 * For single-pass animations that need to be re-triggered (e.g. on probe
 * fire), pass `restartTick` and bump it on each fire. The component will
 * call `beginElement()` on the underlying `<animateMotion>` elements,
 * which is the standard SMIL way to restart a completed animation.
 */
export function AnimatedDots({ dots, path, restartTick }: AnimatedDotsProps) {
	// `beginElement()` lives on SVGAnimationElement (parent of
	// SVGAnimateMotionElement). React's SVG types narrow ref callbacks to
	// SVGElement, so we use `instanceof` to recover the typed reference
	// without an unsafe cast.
	const animateRefs = useRef<Map<string, SVGAnimationElement>>(new Map());
	const restartable = restartTick !== undefined;

	// On every restartTick change, re-fire each dot via beginElement(),
	// staggered by parsing each dot's `begin` value as a delay.
	useEffect(() => {
		if (!restartable) return;
		const timeouts: ReturnType<typeof setTimeout>[] = [];
		for (const dot of dots) {
			const el = animateRefs.current.get(dot.id);
			if (!el) continue;
			const delayMs = parseBeginToMs(dot.begin);
			if (delayMs <= 0) {
				// beginElement is synchronous; no setTimeout needed.
				el.beginElement();
			} else {
				timeouts.push(setTimeout(() => el.beginElement(), delayMs));
			}
		}
		return () => {
			for (const t of timeouts) clearTimeout(t);
		};
	}, [restartTick, dots, restartable]);

	return (
		<>
			{dots.map((dot) => (
				<circle fill={dot.color} key={dot.id} r={dot.r ?? 4}>
					<animateMotion
						begin={restartable ? 'indefinite' : dot.begin}
						dur={dot.dur}
						fill="freeze"
						path={path}
						ref={(el) => {
							if (el instanceof SVGAnimationElement) {
								animateRefs.current.set(dot.id, el);
							} else {
								animateRefs.current.delete(dot.id);
							}
						}}
						repeatCount={dot.repeatCount ?? 'indefinite'}
					/>
				</circle>
			))}
		</>
	);
}

// Parse SMIL begin attribute values like "0s", "0.15s", "-0.9s" into ms.
// Negative values map to 0 because in restartable (single-pass) mode we
// fire the animation now, not in the past.
function parseBeginToMs(begin: string): number {
	const match = begin.trim().match(/^(-?\d*\.?\d+)s$/);
	if (!match) return 0;
	const seconds = Number.parseFloat(match[1]);
	return Math.max(0, seconds * 1000);
}

// ──────────────────────────────────────────────
// reversePath: reverse an SVG path for reverse-direction dots
// ──────────────────────────────────────────────

/**
 * Reverses an SVG path so dots travel in the opposite direction.
 * Supports:
 * - Straight lines: "M x1 y1 L x2 y2" -> "M x2 y2 L x1 y1"
 * - Quadratic beziers: "M x1 y1 Q cx cy x2 y2" -> "M x2 y2 Q cx cy x1 y1"
 */
export function reversePath(path: string): string {
	const trimmed = path.trim();

	// Quadratic bezier: M sx sy Q cx cy ex ey
	const qMatch = trimmed.match(
		/^M\s+([\d.-]+)\s+([\d.-]+)\s+Q\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)$/,
	);
	if (qMatch) {
		const [, sx, sy, cx, cy, ex, ey] = qMatch;
		return `M ${ex} ${ey} Q ${cx} ${cy} ${sx} ${sy}`;
	}

	// Straight line: M sx sy L ex ey (handles both "M x y L x y" and "M x,yL x,y")
	const lMatch = trimmed.match(
		/^M\s*([\d.-]+)[,\s]+([\d.-]+)\s*L\s*([\d.-]+)[,\s]+([\d.-]+)$/,
	);
	if (lMatch) {
		const [, sx, sy, ex, ey] = lMatch;
		return `M ${ex},${ey}L ${sx},${sy}`;
	}

	// Fallback: return as-is (caller should handle complex paths manually)
	return path;
}

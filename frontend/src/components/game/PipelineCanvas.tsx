/**
 * Pipeline Canvas Component
 * Main canvas with nodes, connections, and particles
 */

import type { DragEvent, MouseEvent, RefObject } from 'react';
import { getNodeInfo, isValidConnection } from './data';
import { PipelineNode } from './PipelineNode';
import type {
	Connection,
	PendingConnection,
	PlacedNode,
	QueryParticle,
} from './types';

interface PipelineCanvasProps {
	canvasRef: RefObject<HTMLDivElement | null>;
	placedNodes: PlacedNode[];
	connections: Connection[];
	pendingConnection: PendingConnection | null;
	queryParticles: QueryParticle[];
	selectedNodeId: string | null;
	draggingNodeId: string | null;
	draggedNodeType: string | null;
	isPipelineBroken: boolean;
	simulationRunning: boolean;
	showValidation: boolean;
	onDragOver: (e: DragEvent<HTMLDivElement>) => void;
	onDrop: (e: DragEvent<HTMLDivElement>) => void;
	onMouseMove: (e: MouseEvent) => void;
	onMouseUp: () => void;
	onClick: (e: MouseEvent) => void;
	onNodeMouseDown: (e: MouseEvent, nodeId: string) => void;
	onStartConnection: (e: MouseEvent, nodeId: string) => void;
	onCompleteConnection: (e: MouseEvent, nodeId: string) => void;
	onDeleteConnection: (connectionId: string) => void;
	onDeleteNode: () => void;
}

export function PipelineCanvas({
	canvasRef,
	placedNodes,
	connections,
	pendingConnection,
	queryParticles,
	selectedNodeId,
	draggingNodeId,
	draggedNodeType,
	isPipelineBroken,
	simulationRunning,
	showValidation,
	onDragOver,
	onDrop,
	onMouseMove,
	onMouseUp,
	onClick,
	onNodeMouseDown,
	onStartConnection,
	onCompleteConnection,
	onDeleteConnection,
	onDeleteNode,
}: PipelineCanvasProps) {
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Canvas uses mouse interactions
		<div
			className={`flex-1 bg-background relative overflow-hidden ${
				draggedNodeType ? 'ring-2 ring-primary ring-inset' : ''
			} ${pendingConnection ? 'cursor-crosshair' : ''}`}
			data-canvas-bg
			onClick={onClick}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onMouseLeave={onMouseUp}
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
			ref={canvasRef}
		>
			{/* Grid pattern - subtle dots */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage:
						'radial-gradient(circle, rgba(56,189,248,0.12) 1px, transparent 1px)',
					backgroundSize: '24px 24px',
				}}
			/>

			{/* SVG layer for connections */}
			<svg
				aria-hidden="true"
				className="absolute inset-0 w-full h-full pointer-events-none"
				style={{ zIndex: 1 }}
			>
				{/* Existing connections */}
				{connections.map((conn) => {
					const sourceNode = placedNodes.find(
						(n) => n.id === conn.sourceNodeId,
					);
					const targetNode = placedNodes.find(
						(n) => n.id === conn.targetNodeId,
					);
					if (!sourceNode || !targetNode) return null;

					const isValid = isValidConnection(sourceNode.type, targetNode.type);
					const showInvalid = showValidation && !isValid;
					const strokeColor = showInvalid
						? '#ef4444'
						: getNodeInfo(sourceNode.type).color;
					const dx = targetNode.x - sourceNode.x;
					const cx = Math.abs(dx) * 0.5;

					return (
						<g key={conn.id}>
							<path
								aria-label="Delete connection"
								className="pointer-events-auto cursor-pointer hover:stroke-opacity-100"
								d={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${targetNode.x - cx} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`}
								fill="none"
								onClick={(e) => {
									e.stopPropagation();
									onDeleteConnection(conn.id);
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.stopPropagation();
										onDeleteConnection(conn.id);
									}
								}}
								role="button"
								stroke={strokeColor}
								strokeDasharray={showInvalid ? '8 4' : undefined}
								strokeOpacity={showInvalid ? 0.8 : 0.6}
								strokeWidth="3"
								tabIndex={0}
							/>
							{showInvalid && (
								<g
									transform={`translate(${(sourceNode.x + targetNode.x) / 2}, ${(sourceNode.y + targetNode.y) / 2})`}
								>
									<circle fill="#ef4444" r="12" />
									<text
										dominantBaseline="central"
										fill="white"
										fontSize="14"
										fontWeight="bold"
										textAnchor="middle"
									>
										✗
									</text>
								</g>
							)}
							<circle fill={strokeColor} r="4">
								<animateMotion
									dur="2s"
									path={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${targetNode.x - cx} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`}
									repeatCount="indefinite"
								/>
							</circle>
						</g>
					);
				})}

				{/* Query particles */}
				{queryParticles.map((particle) => (
					<circle
						cx={particle.x}
						cy={particle.y}
						fill="#7dd3fc"
						key={particle.id}
						opacity={1 - particle.progress}
						r={3}
					>
						<animate
							attributeName="r"
							dur="0.3s"
							repeatCount="indefinite"
							values="3;5;3"
						/>
					</circle>
				))}

				{/* Pending connection line */}
				{pendingConnection &&
					(() => {
						const sourceNode = placedNodes.find(
							(n) => n.id === pendingConnection.sourceNodeId,
						);
						if (!sourceNode) return null;

						const sourceColor = getNodeInfo(sourceNode.type).color;
						const dx = pendingConnection.mouseX - sourceNode.x;
						const cx = Math.abs(dx) * 0.5;

						return (
							<path
								d={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${pendingConnection.mouseX - cx} ${pendingConnection.mouseY}, ${pendingConnection.mouseX} ${pendingConnection.mouseY}`}
								fill="none"
								stroke={sourceColor}
								strokeDasharray="8 4"
								strokeOpacity="0.8"
								strokeWidth="3"
							/>
						);
					})()}
			</svg>

			{/* Placed nodes */}
			{placedNodes.map((node) => (
				<PipelineNode
					connections={connections}
					isDragging={node.id === draggingNodeId}
					isPipelineBroken={isPipelineBroken}
					isSelected={node.id === selectedNodeId}
					key={node.id}
					node={node}
					onCompleteConnection={onCompleteConnection}
					onDelete={node.id === selectedNodeId ? onDeleteNode : undefined}
					onMouseDown={onNodeMouseDown}
					onStartConnection={onStartConnection}
					pendingConnection={pendingConnection}
					simulationRunning={simulationRunning}
				/>
			))}

			{/* Empty state */}
			{placedNodes.length === 0 && !draggedNodeType && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="text-center max-w-sm">
						<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-card border border-border mb-4">
							<svg
								className="w-6 h-6 text-muted-foreground"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
								/>
							</svg>
						</div>
						<p className="text-foreground font-medium mb-2">Blueprint Canvas</p>
						<p className="text-muted-foreground text-sm">
							Drag nodes from the palette to build your pipeline, then connect
							them.
						</p>
					</div>
				</div>
			)}

			{/* Drop indicator */}
			{draggedNodeType && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="text-center bg-primary/20 px-8 py-5 rounded-lg border border-primary/50">
						<p className="text-primary font-medium">Drop here to place node</p>
					</div>
				</div>
			)}
		</div>
	);
}

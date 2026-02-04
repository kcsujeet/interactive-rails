/**
 * PipelineCanvas Component
 *
 * Main React Flow-based visual pipeline editor.
 * Handles node rendering, connections, selection, and drag-drop from palette.
 */

import {
	Background,
	BackgroundVariant,
	type Connection,
	Controls,
	MiniMap,
	Panel,
	ReactFlow,
	useReactFlow,
} from '@xyflow/react';
import { type DragEvent, useCallback, useRef } from 'react';
import '@xyflow/react/dist/style.css';

import clsx from 'clsx';
import {
	type NodeType,
	selectCanRedo,
	selectCanUndo,
	usePipelineStore,
} from '../../stores';
import { Button } from '../ui/Button';
import { edgeTypes } from './DataFlowEdge';
import { nodeTypes } from './nodes';

interface PipelineCanvasProps {
	className?: string;
	isReadOnly?: boolean;
}

// Node colors for minimap
const nodeColor = (node: { type?: string }) => {
	const colors: Record<string, string> = {
		request: '#3b82f6',
		router: '#a78bfa',
		controller: '#10b981',
		model: '#f59e0b',
		database: '#ef4444',
		cache: '#06b6d4',
		view: '#a855f7',
		response: '#22c55e',
		background_job: '#9333ea',
	};
	return colors[node.type || ''] || '#4a4a6a';
};

export default function PipelineCanvas({
	className,
	isReadOnly = false,
}: PipelineCanvasProps) {
	const reactFlowWrapper = useRef<HTMLDivElement>(null);
	const { screenToFlowPosition } = useReactFlow();

	// Store state and actions
	const nodes = usePipelineStore((state) => state.nodes);
	const edges = usePipelineStore((state) => state.edges);
	const onNodesChange = usePipelineStore((state) => state.onNodesChange);
	const onEdgesChange = usePipelineStore((state) => state.onEdgesChange);
	const onConnect = usePipelineStore((state) => state.onConnect);
	const addNode = usePipelineStore((state) => state.addNode);
	const selectNode = usePipelineStore((state) => state.selectNode);
	const undo = usePipelineStore((state) => state.undo);
	const redo = usePipelineStore((state) => state.redo);
	const canUndo = usePipelineStore(selectCanUndo);
	const canRedo = usePipelineStore(selectCanRedo);
	const isValid = usePipelineStore((state) => state.isValid);
	const validationErrors = usePipelineStore((state) => state.validationErrors);

	// Handle connection
	const handleConnect = useCallback(
		(connection: Connection) => {
			if (!isReadOnly) {
				onConnect(connection);
			}
		},
		[isReadOnly, onConnect],
	);

	// Handle drop from node palette
	const handleDragOver = useCallback((event: DragEvent) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
	}, []);

	const handleDrop = useCallback(
		(event: DragEvent) => {
			event.preventDefault();

			if (isReadOnly) return;

			const type = event.dataTransfer.getData('application/reactflow');
			if (!type || !reactFlowWrapper.current) return;

			const position = screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			});

			addNode(type as NodeType, position);
		},
		[isReadOnly, screenToFlowPosition, addNode],
	);

	// Handle node click
	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: { id: string }) => {
			selectNode(node.id);
		},
		[selectNode],
	);

	// Handle pane click (deselect)
	const handlePaneClick = useCallback(() => {
		selectNode(null);
	}, [selectNode]);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (isReadOnly) return;

			// Undo: Cmd/Ctrl + Z
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key === 'z' &&
				!event.shiftKey
			) {
				event.preventDefault();
				if (canUndo) undo();
			}

			// Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
			if (
				((event.metaKey || event.ctrlKey) &&
					event.shiftKey &&
					event.key === 'z') ||
				((event.metaKey || event.ctrlKey) && event.key === 'y')
			) {
				event.preventDefault();
				if (canRedo) redo();
			}
		},
		[isReadOnly, canUndo, canRedo, undo, redo],
	);

	return (
		<div
			className={clsx('w-full h-full', className)}
			onKeyDown={handleKeyDown}
			ref={reactFlowWrapper}
			tabIndex={0}
		>
			<ReactFlow
				className="bg-game-bg"
				defaultEdgeOptions={{
					type: 'smoothstep',
					animated: true,
				}}
				edges={edges}
				edgeTypes={edgeTypes}
				elementsSelectable={!isReadOnly}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				maxZoom={2}
				minZoom={0.25}
				nodes={nodes}
				nodesConnectable={!isReadOnly}
				nodesDraggable={!isReadOnly}
				nodeTypes={nodeTypes}
				onConnect={handleConnect}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				onEdgesChange={isReadOnly ? undefined : onEdgesChange}
				onNodeClick={handleNodeClick}
				onNodesChange={isReadOnly ? undefined : onNodesChange}
				onPaneClick={handlePaneClick}
				proOptions={{ hideAttribution: true }}
				snapGrid={[20, 20]}
				snapToGrid
			>
				{/* Grid Background */}
				<Background
					color="#2d2d44"
					gap={20}
					size={1}
					variant={BackgroundVariant.Dots}
				/>

				{/* Controls */}
				<Controls
					className="!bg-game-surface !border-game-border !shadow-lg"
					position="bottom-left"
					showFitView
					showInteractive={!isReadOnly}
					showZoom
				/>

				{/* Minimap */}
				<MiniMap
					className="!bg-game-surface !border-game-border"
					nodeColor={nodeColor}
					nodeStrokeWidth={3}
					pannable
					position="bottom-right"
					zoomable
				/>

				{/* Validation Panel */}
				{!isValid && validationErrors.length > 0 && (
					<Panel className="max-w-xs" position="top-right">
						<div className="bg-red-900/90 border border-red-700 rounded-lg p-3 shadow-lg">
							<h4 className="text-sm font-semibold text-red-200 mb-2 flex items-center gap-2">
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
								Validation Errors
							</h4>
							<ul className="text-xs text-red-300 space-y-1">
								{validationErrors.map((error, index) => (
									<li className="flex items-start gap-1" key={index}>
										<span className="text-red-400">-</span>
										<span>{error}</span>
									</li>
								))}
							</ul>
						</div>
					</Panel>
				)}

				{/* Undo/Redo Panel */}
				{!isReadOnly && (
					<Panel position="top-left">
						<div className="flex gap-1">
							<Button
								disabled={!canUndo}
								onClick={undo}
								size="icon"
								title="Undo (Cmd/Ctrl+Z)"
								variant="outline"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</Button>
							<Button
								disabled={!canRedo}
								onClick={redo}
								size="icon"
								title="Redo (Cmd/Ctrl+Shift+Z)"
								variant="outline"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</Button>
						</div>
					</Panel>
				)}
			</ReactFlow>
		</div>
	);
}

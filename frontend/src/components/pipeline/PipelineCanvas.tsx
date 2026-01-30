/**
 * PipelineCanvas Component
 *
 * Main React Flow-based visual pipeline editor.
 * Handles node rendering, connections, selection, and drag-drop from palette.
 */

import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type Connection,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  usePipelineStore,
  type NodeType,
  selectCanUndo,
  selectCanRedo,
} from '../../stores';
import { nodeTypes } from './nodes';
import { edgeTypes } from './DataFlowEdge';
import clsx from 'clsx';

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

export default function PipelineCanvas({ className, isReadOnly = false }: PipelineCanvasProps) {
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
    [isReadOnly, onConnect]
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
    [isReadOnly, screenToFlowPosition, addNode]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
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
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) undo();
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') ||
        ((event.metaKey || event.ctrlKey) && event.key === 'y')
      ) {
        event.preventDefault();
        if (canRedo) redo();
      }
    },
    [isReadOnly, canUndo, canRedo, undo, redo]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={clsx('w-full h-full', className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={isReadOnly ? undefined : onNodesChange}
        onEdgesChange={isReadOnly ? undefined : onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-game-bg"
        minZoom={0.25}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
      >
        {/* Grid Background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#2d2d44"
        />

        {/* Controls */}
        <Controls
          showZoom
          showFitView
          showInteractive={!isReadOnly}
          position="bottom-left"
          className="!bg-game-surface !border-game-border !shadow-lg"
        />

        {/* Minimap */}
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-right"
          className="!bg-game-surface !border-game-border"
        />

        {/* Validation Panel */}
        {!isValid && validationErrors.length > 0 && (
          <Panel position="top-right" className="max-w-xs">
            <div className="bg-red-900/90 border border-red-700 rounded-lg p-3 shadow-lg">
              <h4 className="text-sm font-semibold text-red-200 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Validation Errors
              </h4>
              <ul className="text-xs text-red-300 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-1">
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
              <button
                onClick={undo}
                disabled={!canUndo}
                className={clsx(
                  'p-2 rounded-lg border transition-all',
                  canUndo
                    ? 'bg-game-surface border-game-border hover:bg-game-border text-gray-200'
                    : 'bg-game-bg/50 border-game-border/50 text-gray-600 cursor-not-allowed'
                )}
                title="Undo (Cmd/Ctrl+Z)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={clsx(
                  'p-2 rounded-lg border transition-all',
                  canRedo
                    ? 'bg-game-surface border-game-border hover:bg-game-border text-gray-200'
                    : 'bg-game-bg/50 border-game-border/50 text-gray-600 cursor-not-allowed'
                )}
                title="Redo (Cmd/Ctrl+Shift+Z)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

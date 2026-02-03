/**
 * Pipeline Canvas Component
 * Main canvas with nodes, connections, and particles
 */

import type { DragEvent, MouseEvent, RefObject } from 'react';
import type { PlacedNode, Connection, PendingConnection, QueryParticle } from './types';
import { getNodeInfo, isValidConnection } from './data';
import { PipelineNode } from './PipelineNode';

interface PipelineCanvasProps {
  canvasRef: RefObject<HTMLDivElement>;
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
}: PipelineCanvasProps) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Canvas uses mouse interactions
    <div
      ref={canvasRef}
      data-canvas-bg
      className={`flex-1 bg-game-bg relative overflow-hidden ${
        draggedNodeType ? 'ring-2 ring-sky-500 ring-inset' : ''
      } ${pendingConnection ? 'cursor-crosshair' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onClick}
    >
      {/* Grid pattern - subtle dots */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* SVG layer for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} aria-hidden="true">
        {/* Existing connections */}
        {connections.map((conn) => {
          const sourceNode = placedNodes.find((n) => n.id === conn.sourceNodeId);
          const targetNode = placedNodes.find((n) => n.id === conn.targetNodeId);
          if (!sourceNode || !targetNode) return null;

          const isValid = isValidConnection(sourceNode.type, targetNode.type);
          const showInvalid = showValidation && !isValid;
          const strokeColor = showInvalid ? '#ef4444' : getNodeInfo(sourceNode.type).color;
          const dx = targetNode.x - sourceNode.x;
          const cx = Math.abs(dx) * 0.5;

          return (
            <g key={conn.id}>
              <path
                d={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${targetNode.x - cx} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth="3"
                strokeOpacity={showInvalid ? 0.8 : 0.6}
                strokeDasharray={showInvalid ? '8 4' : undefined}
                className="pointer-events-auto cursor-pointer hover:stroke-opacity-100"
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
                tabIndex={0}
                role="button"
                aria-label="Delete connection"
              />
              {showInvalid && (
                <g transform={`translate(${(sourceNode.x + targetNode.x) / 2}, ${(sourceNode.y + targetNode.y) / 2})`}>
                  <circle r="12" fill="#ef4444" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    ✗
                  </text>
                </g>
              )}
              <circle r="4" fill={strokeColor}>
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  path={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${targetNode.x - cx} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`}
                />
              </circle>
            </g>
          );
        })}

        {/* Query particles */}
        {queryParticles.map(particle => (
          <circle
            key={particle.id}
            cx={particle.x}
            cy={particle.y}
            r={3}
            fill="#7dd3fc"
            opacity={1 - particle.progress}
          >
            <animate
              attributeName="r"
              values="3;5;3"
              dur="0.3s"
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* Pending connection line */}
        {pendingConnection && (() => {
          const sourceNode = placedNodes.find((n) => n.id === pendingConnection.sourceNodeId);
          if (!sourceNode) return null;

          const sourceColor = getNodeInfo(sourceNode.type).color;
          const dx = pendingConnection.mouseX - sourceNode.x;
          const cx = Math.abs(dx) * 0.5;

          return (
            <path
              d={`M ${sourceNode.x} ${sourceNode.y} C ${sourceNode.x + cx} ${sourceNode.y}, ${pendingConnection.mouseX - cx} ${pendingConnection.mouseY}, ${pendingConnection.mouseX} ${pendingConnection.mouseY}`}
              fill="none"
              stroke={sourceColor}
              strokeWidth="3"
              strokeDasharray="8 4"
              strokeOpacity="0.8"
            />
          );
        })()}
      </svg>

      {/* Placed nodes */}
      {placedNodes.map((node) => (
        <PipelineNode
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          isDragging={node.id === draggingNodeId}
          isPipelineBroken={isPipelineBroken}
          simulationRunning={simulationRunning}
          pendingConnection={pendingConnection}
          connections={connections}
          onMouseDown={onNodeMouseDown}
          onStartConnection={onStartConnection}
          onCompleteConnection={onCompleteConnection}
        />
      ))}

      {/* Empty state */}
      {placedNodes.length === 0 && !draggedNodeType && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-game-surface border border-game-border mb-4">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-2">Blueprint Canvas</p>
            <p className="text-slate-500 text-sm">Drag nodes from the palette to build your pipeline, then connect them.</p>
          </div>
        </div>
      )}

      {/* Drop indicator */}
      {draggedNodeType && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-sky-950/80 px-8 py-5 rounded-lg border border-sky-700">
            <p className="text-sky-300 font-medium">Drop here to place node</p>
          </div>
        </div>
      )}
    </div>
  );
}

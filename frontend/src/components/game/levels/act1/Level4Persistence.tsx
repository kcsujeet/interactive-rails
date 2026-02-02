/**
 * Level 4: Persistence Layer
 *
 * Models glow blue (transient) until connected to database.
 * "Simulate Restart" clears transient data.
 */

import { useState, useRef } from 'react';
import type { LevelComponentProps } from '../index';
import {
  LevelLayout,
  LeftPanel,
  CenterPanel,
  RightPanel,
  LevelHeader,
  InstructionPanel,
  CodePreviewPanel,
  DraggableNode,
  NodePalette,
  NodePaletteGroup,
  CanvasNode,
  ConnectionLayer,
  useLevelCompletion,
} from '../shared';

interface PlacedNode {
  id: string;
  type: string;
  x: number;
  y: number;
  label?: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

// Node definitions
const NODE_DEFS: Record<string, { name: string; icon: string; color: string; description: string }> = {
  request: { name: 'Request', icon: 'R', color: '#22c55e', description: 'HTTP request' },
  router: { name: 'Router', icon: '/', color: '#f59e0b', description: 'routes.rb' },
  controller: { name: 'Controller', icon: 'C', color: '#3b82f6', description: 'PostsController' },
  model: { name: 'Model', icon: 'M', color: '#8b5cf6', description: 'ActiveRecord model' },
  database: { name: 'Database', icon: 'D', color: '#06b6d4', description: 'PostgreSQL' },
  view: { name: 'View', icon: 'V', color: '#ec4899', description: 'ERB template' },
  response: { name: 'Response', icon: 'R', color: '#10b981', description: 'HTML response' },
};

export function Level4Persistence({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pre-built pipeline WITHOUT database connection to models
  const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([
    { id: 'request-1', type: 'request', x: 80, y: 250 },
    { id: 'router-1', type: 'router', x: 200, y: 250 },
    { id: 'controller-1', type: 'controller', x: 340, y: 250 },
    { id: 'post-model', type: 'model', x: 500, y: 180, label: 'Post' },
    { id: 'comment-model', type: 'model', x: 500, y: 320, label: 'Comment' },
    { id: 'view-1', type: 'view', x: 700, y: 250 },
    { id: 'response-1', type: 'response', x: 860, y: 250 },
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
    { id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
    { id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
    { id: 'c4', sourceId: 'post-model', targetId: 'comment-model' },
    { id: 'c5', sourceId: 'post-model', targetId: 'view-1' },
    { id: 'c6', sourceId: 'comment-model', targetId: 'view-1' },
    { id: 'c7', sourceId: 'view-1', targetId: 'response-1' },
  ]);

  const [databaseAdded, setDatabaseAdded] = useState(false);
  const [modelsConnectedToDb, setModelsConnectedToDb] = useState<Set<string>>(new Set());
  const [dataCounter, setDataCounter] = useState(0);
  const [showRestartEffect, setShowRestartEffect] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; x: number; y: number } | null>(null);

  // Check if level is complete - both models connected to database
  const isComplete = modelsConnectedToDb.has('post-model') && modelsConnectedToDb.has('comment-model');

  // Simulate data creation
  const createData = () => {
    setDataCounter(prev => prev + 1);
  };

  // Simulate restart - clears data if models aren't persisted
  const simulateRestart = () => {
    setShowRestartEffect(true);
    setTimeout(() => {
      if (!isComplete) {
        // Data is lost if models aren't connected to database
        setDataCounter(0);
      }
      setShowRestartEffect(false);
    }, 1000);
  };

  // Handle dropping database node
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType !== 'database' || databaseAdded || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dbNode: PlacedNode = {
      id: 'database-1',
      type: 'database',
      x,
      y,
    };

    setPlacedNodes(prev => [...prev, dbNode]);
    setDatabaseAdded(true);
  };

  // Handle connection
  const handleStartConnection = (nodeId: string) => {
    const node = placedNodes.find(n => n.id === nodeId);
    if (node) {
      setPendingConnection({ sourceId: nodeId, x: node.x + 60, y: node.y });
    }
  };

  const handleCompleteConnection = (targetId: string) => {
    if (!pendingConnection || pendingConnection.sourceId === targetId) {
      setPendingConnection(null);
      return;
    }

    const sourceNode = placedNodes.find(n => n.id === pendingConnection.sourceId);
    const targetNode = placedNodes.find(n => n.id === targetId);

    // Check if connecting model to database
    if (
      (sourceNode?.type === 'model' && targetNode?.type === 'database') ||
      (sourceNode?.type === 'database' && targetNode?.type === 'model')
    ) {
      const modelId = sourceNode?.type === 'model' ? sourceNode.id : targetNode!.id;
      setModelsConnectedToDb(prev => new Set([...prev, modelId]));

      setConnections(prev => [
        ...prev,
        {
          id: `conn-${Date.now()}`,
          sourceId: pendingConnection.sourceId,
          targetId,
        },
      ]);
    }

    setPendingConnection(null);
  };

  // Handle completing the level
  const handleComplete = async () => {
    const success = await completeLevel('act1-level4-persistence', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Canvas handlers
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (pendingConnection && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPendingConnection({
        ...pendingConnection,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleCanvasClick = () => {
    setSelectedNodeId(null);
    setPendingConnection(null);
  };

  const handleNodeDrag = (id: string, x: number, y: number) => {
    if (id === 'database-1') {
      setPlacedNodes(prev => prev.map(n => (n.id === id ? { ...n, x, y } : n)));
    }
  };

  // Get connection coordinates
  const getConnectionCoords = () => {
    return connections.map(conn => {
      const source = placedNodes.find(n => n.id === conn.sourceId);
      const target = placedNodes.find(n => n.id === conn.targetId);
      if (!source || !target) return null;

      // Model to database connections are green
      const isDbConnection =
        (source.type === 'model' && target.type === 'database') ||
        (source.type === 'database' && target.type === 'model');

      return {
        id: conn.id,
        startX: source.x + 60,
        startY: source.y,
        endX: target.x - 60,
        endY: target.y,
        color: isDbConnection ? '#22c55e' : '#6b7280',
        animated: true,
      };
    }).filter(Boolean) as Array<{
      id: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
      animated: boolean;
    }>;
  };

  // Generate code preview
  const getCodeFiles = () => {
    const files = [];

    // Database config
    files.push({
      filename: 'config/database.yml',
      language: 'ruby',
      code: `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

production:
  <<: *default
  url: <%= ENV['DATABASE_URL'] %>`,
      highlight: isComplete ? [2, 11] : [],
    });

    // Model with persistence
    files.push({
      filename: 'app/models/post.rb',
      language: 'ruby',
      code: modelsConnectedToDb.has('post-model')
        ? `class Post < ApplicationRecord
  # Data persists to database
  has_many :comments

  validates :title, presence: true
end`
        : `class Post
  # WARNING: Not persisted!
  # Data lives in memory only
  attr_accessor :title, :body
end`,
      highlight: modelsConnectedToDb.has('post-model') ? [2] : [2, 3],
    });

    return files;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Users are complaining their posts vanish when the Dyno restarts."
          instructions={[
            'Drag the Database node to the canvas',
            'Connect BOTH models (Post and Comment) to the Database',
            'Use "Simulate Restart" to verify data persists',
          ]}
          goal="Make data survive server restarts by connecting models to persistent storage."
        >
          <NodePalette title="Available Components">
            {!databaseAdded ? (
              <NodePaletteGroup title="Storage">
                <DraggableNode
                  type="database"
                  name="Database"
                  description="PostgreSQL persistent storage"
                  icon="D"
                  color="#06b6d4"
                  onDragStart={(e, type) => e.dataTransfer.setData('nodeType', type)}
                />
              </NodePaletteGroup>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Database added!
                {!isComplete && <div className="mt-2">Connect both models to it.</div>}
              </div>
            )}
          </NodePalette>

          {/* Data counter & restart */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Data Simulation</div>

            <div className="bg-gray-800 rounded-lg p-4 mb-3">
              <div className="text-2xl font-bold text-center mb-1" style={{ color: isComplete ? '#22c55e' : '#3b82f6' }}>
                {dataCounter}
              </div>
              <div className="text-xs text-gray-500 text-center">Records Created</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={createData}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                + Create Record
              </button>
              <button
                onClick={simulateRestart}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
              >
                Simulate Restart
              </button>
            </div>

            {showRestartEffect && (
              <div className={`mt-3 text-center text-sm ${isComplete ? 'text-green-400' : 'text-red-400'}`}>
                {isComplete ? 'Data survived restart!' : 'Data lost on restart!'}
              </div>
            )}
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={4}
          levelName="Persistence Layer"
          actNumber={1}
          onExit={onExit}
          onReset={() => {
            setPlacedNodes([
              { id: 'request-1', type: 'request', x: 80, y: 250 },
              { id: 'router-1', type: 'router', x: 200, y: 250 },
              { id: 'controller-1', type: 'controller', x: 340, y: 250 },
              { id: 'post-model', type: 'model', x: 500, y: 180, label: 'Post' },
              { id: 'comment-model', type: 'model', x: 500, y: 320, label: 'Comment' },
              { id: 'view-1', type: 'view', x: 700, y: 250 },
              { id: 'response-1', type: 'response', x: 860, y: 250 },
            ]);
            setConnections([
              { id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
              { id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
              { id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
              { id: 'c4', sourceId: 'post-model', targetId: 'comment-model' },
              { id: 'c5', sourceId: 'post-model', targetId: 'view-1' },
              { id: 'c6', sourceId: 'comment-model', targetId: 'view-1' },
              { id: 'c7', sourceId: 'view-1', targetId: 'response-1' },
            ]);
            setDatabaseAdded(false);
            setModelsConnectedToDb(new Set());
            setDataCounter(0);
          }}
        />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative bg-gray-950 overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          {/* Restart effect overlay */}
          {showRestartEffect && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
              <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                Restarting...
              </div>
            </div>
          )}

          {/* Connections */}
          <ConnectionLayer
            connections={getConnectionCoords()}
            selectedConnectionId={null}
            pendingConnection={
              pendingConnection
                ? {
                    startX: placedNodes.find(n => n.id === pendingConnection.sourceId)!.x + 60,
                    startY: placedNodes.find(n => n.id === pendingConnection.sourceId)!.y,
                    endX: pendingConnection.x,
                    endY: pendingConnection.y,
                  }
                : null
            }
          />

          {/* Nodes */}
          {placedNodes.map(node => {
            const def = NODE_DEFS[node.type];
            const isModel = node.type === 'model';
            const isPersisted = isModel && modelsConnectedToDb.has(node.id);

            // Determine glow color based on persistence state
            let glowColor: string | undefined;
            if (isModel) {
              glowColor = isPersisted ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)';
            }

            return (
              <CanvasNode
                key={node.id}
                id={node.id}
                type={node.type}
                name={node.label || def.name}
                icon={def.icon}
                color={def.color}
                x={node.x}
                y={node.y}
                selected={selectedNodeId === node.id}
                locked={node.id !== 'database-1'}
                glowColor={glowColor}
                badge={isModel ? (isPersisted ? 'DB' : 'MEM') : undefined}
                badgeColor={isPersisted ? '#22c55e' : '#3b82f6'}
                onSelect={setSelectedNodeId}
                onStartConnection={() => handleStartConnection(node.id)}
                onCompleteConnection={() => handleCompleteConnection(node.id)}
                onDrag={handleNodeDrag}
              />
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-gray-900/80 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/40 border border-blue-500" />
              <span className="text-gray-400">Transient (memory only)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/40 border border-green-500" />
              <span className="text-gray-400">Persisted (database)</span>
            </div>
          </div>

          {/* Completion button */}
          {isComplete && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/30 hover:from-green-500 hover:to-green-400 transition-all"
              >
                Complete Level
              </button>
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={getCodeFiles()}
          learningGoal="Understanding the difference between transient (memory) and persistent (database) data storage."
        >
          {/* Persistence status */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Persistence Status</div>
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${modelsConnectedToDb.has('post-model') ? 'text-green-400' : 'text-blue-400'}`}>
                <span>{modelsConnectedToDb.has('post-model') ? '+' : '-'}</span>
                <span>Post Model: {modelsConnectedToDb.has('post-model') ? 'Persisted' : 'Transient'}</span>
              </div>
              <div className={`flex items-center gap-2 ${modelsConnectedToDb.has('comment-model') ? 'text-green-400' : 'text-blue-400'}`}>
                <span>{modelsConnectedToDb.has('comment-model') ? '+' : '-'}</span>
                <span>Comment Model: {modelsConnectedToDb.has('comment-model') ? 'Persisted' : 'Transient'}</span>
              </div>
            </div>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level4Persistence;

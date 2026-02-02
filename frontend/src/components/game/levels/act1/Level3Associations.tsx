/**
 * Level 3: Semantic Associations
 *
 * Add a Comment model and choose the correct relationship type.
 * Decision modal appears when connecting Model → Model.
 */

import { useState, useCallback, useRef } from 'react';
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
  relationshipType?: string;
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

export function Level3Associations({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pre-built pipeline with Post model
  const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([
    { id: 'request-1', type: 'request', x: 80, y: 250 },
    { id: 'router-1', type: 'router', x: 200, y: 250 },
    { id: 'controller-1', type: 'controller', x: 340, y: 250 },
    { id: 'post-model', type: 'model', x: 500, y: 250, label: 'Post' },
    { id: 'database-1', type: 'database', x: 680, y: 250 },
    { id: 'view-1', type: 'view', x: 840, y: 250 },
    { id: 'response-1', type: 'response', x: 980, y: 250 },
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
    { id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
    { id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
    { id: 'c4', sourceId: 'post-model', targetId: 'database-1' },
    { id: 'c5', sourceId: 'database-1', targetId: 'view-1' },
    { id: 'c6', sourceId: 'view-1', targetId: 'response-1' },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [commentAdded, setCommentAdded] = useState(false);
  const [relationshipType, setRelationshipType] = useState<string | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [pendingRelationship, setPendingRelationship] = useState<{ sourceId: string; targetId: string } | null>(null);

  // Check if level is complete
  const isComplete = relationshipType === 'has_many';

  // Handle dropping Comment model
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType !== 'model' || commentAdded || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const commentNode: PlacedNode = {
      id: 'comment-model',
      type: 'model',
      x,
      y,
      label: 'Comment',
    };

    setPlacedNodes(prev => [...prev, commentNode]);
    setCommentAdded(true);
  };

  // Handle starting a connection
  const handleStartConnection = (nodeId: string) => {
    const node = placedNodes.find(n => n.id === nodeId);
    if (node) {
      setPendingConnection({ sourceId: nodeId, x: node.x + 60, y: node.y });
    }
  };

  // Handle completing a connection
  const handleCompleteConnection = (targetId: string) => {
    if (!pendingConnection || pendingConnection.sourceId === targetId) {
      setPendingConnection(null);
      return;
    }

    const sourceNode = placedNodes.find(n => n.id === pendingConnection.sourceId);
    const targetNode = placedNodes.find(n => n.id === targetId);

    // Check if connecting two models
    if (sourceNode?.type === 'model' && targetNode?.type === 'model') {
      // Show decision modal
      setPendingRelationship({ sourceId: pendingConnection.sourceId, targetId });
      setShowDecisionModal(true);
    }

    setPendingConnection(null);
  };

  // Handle decision modal choice
  const handleRelationshipChoice = (choice: string) => {
    if (pendingRelationship) {
      setConnections(prev => [
        ...prev,
        {
          id: `conn-${Date.now()}`,
          sourceId: pendingRelationship.sourceId,
          targetId: pendingRelationship.targetId,
          relationshipType: choice,
        },
      ]);
      setRelationshipType(choice);
    }
    setShowDecisionModal(false);
    setPendingRelationship(null);
  };

  // Handle completing the level
  const handleComplete = async () => {
    const success = await completeLevel('act1-level3-associations', {
      stars: 3,
      decisions: { relationship: relationshipType! },
    });
    if (success) {
      onComplete({ stars: 3, decisions: { relationship: relationshipType! } });
    }
  };

  // Canvas event handlers
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
    // Only allow dragging the Comment model
    if (id === 'comment-model') {
      setPlacedNodes(prev => prev.map(n => (n.id === id ? { ...n, x, y } : n)));
    }
  };

  // Get connection coordinates
  const getConnectionCoords = () => {
    return connections.map(conn => {
      const source = placedNodes.find(n => n.id === conn.sourceId);
      const target = placedNodes.find(n => n.id === conn.targetId);
      if (!source || !target) return null;

      // Model-to-model connections are special
      const isModelConnection = source.type === 'model' && target.type === 'model';
      const color = isModelConnection
        ? conn.relationshipType === 'has_many'
          ? '#22c55e'
          : conn.relationshipType
          ? '#ef4444'
          : '#8b5cf6'
        : '#6b7280';

      return {
        id: conn.id,
        startX: source.x + 60,
        startY: source.y,
        endX: target.x - 60,
        endY: target.y,
        color,
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

    // Post model
    files.push({
      filename: 'app/models/post.rb',
      language: 'ruby',
      code: relationshipType
        ? `class Post < ApplicationRecord
  ${relationshipType} :comments${relationshipType === 'has_many' ? ', dependent: :destroy' : ''}
end`
        : `class Post < ApplicationRecord
  # No associations defined yet
end`,
      highlight: relationshipType ? [2] : [],
    });

    // Comment model (if added)
    if (commentAdded) {
      files.push({
        filename: 'app/models/comment.rb',
        language: 'ruby',
        code: `class Comment < ApplicationRecord
  belongs_to :post
end`,
        highlight: [2],
      });
    }

    // Show what happens in view
    if (relationshipType) {
      files.push({
        filename: 'app/views/posts/show.html.erb',
        language: 'ruby',
        code: relationshipType === 'has_many'
          ? `<h1><%= @post.title %></h1>

<h2>Comments (<%= @post.comments.count %>)</h2>
<% @post.comments.each do |comment| %>
  <div class="comment">
    <%= comment.body %>
  </div>
<% end %>`
          : `<h1><%= @post.title %></h1>

<h2>Comment</h2>
<% if @post.comment %>
  <div class="comment">
    <%= @post.comment.body %>
  </div>
<% end %>
<!-- Only showing ONE comment! -->`,
        highlight: relationshipType === 'has_many' ? [3, 4, 5] : [8],
      });
    }

    return files;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="We have a Blog, but we can't show Comments. The data isn't linking."
          instructions={[
            'Drag the Comment Model to the canvas',
            'Connect the Post Model to the Comment Model',
            'Choose the correct relationship type in the dialog',
          ]}
          goal="Add Comments to Posts using the correct ActiveRecord association."
        >
          <NodePalette title="Available Components">
            {!commentAdded ? (
              <NodePaletteGroup title="Models">
                <DraggableNode
                  type="model"
                  name="Comment"
                  description="Comment model for posts"
                  icon="M"
                  color="#8b5cf6"
                  onDragStart={(e, type) => e.dataTransfer.setData('nodeType', type)}
                />
              </NodePaletteGroup>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Comment model added!
                {!relationshipType && <div className="mt-2">Now connect Post → Comment</div>}
              </div>
            )}
          </NodePalette>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={3}
          levelName="Semantic Associations"
          actNumber={1}
          onExit={onExit}
          onReset={() => {
            setPlacedNodes([
              { id: 'request-1', type: 'request', x: 80, y: 250 },
              { id: 'router-1', type: 'router', x: 200, y: 250 },
              { id: 'controller-1', type: 'controller', x: 340, y: 250 },
              { id: 'post-model', type: 'model', x: 500, y: 250, label: 'Post' },
              { id: 'database-1', type: 'database', x: 680, y: 250 },
              { id: 'view-1', type: 'view', x: 840, y: 250 },
              { id: 'response-1', type: 'response', x: 980, y: 250 },
            ]);
            setConnections([
              { id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
              { id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
              { id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
              { id: 'c4', sourceId: 'post-model', targetId: 'database-1' },
              { id: 'c5', sourceId: 'database-1', targetId: 'view-1' },
              { id: 'c6', sourceId: 'view-1', targetId: 'response-1' },
            ]);
            setCommentAdded(false);
            setRelationshipType(null);
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
            const isLocked = node.id !== 'comment-model';
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
                locked={isLocked}
                onSelect={setSelectedNodeId}
                onStartConnection={() => handleStartConnection(node.id)}
                onCompleteConnection={() => handleCompleteConnection(node.id)}
                onDrag={handleNodeDrag}
              />
            );
          })}

          {/* Decision Modal */}
          {showDecisionModal && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-2">Relationship Type?</h3>
                <p className="text-gray-400 text-sm mb-6">
                  How should Post relate to Comment?
                </p>

                <div className="space-y-3">
                  {[
                    {
                      value: 'has_one',
                      label: 'has_one',
                      preview: 'Only ONE comment per post',
                      consequence: 'Limits posts to a single comment',
                      correct: false,
                    },
                    {
                      value: 'has_many',
                      label: 'has_many',
                      preview: 'ALL comments for a post',
                      consequence: 'Posts can have unlimited comments',
                      correct: true,
                    },
                    {
                      value: 'has_and_belongs_to_many',
                      label: 'has_and_belongs_to_many',
                      preview: 'Comments shared between posts',
                      consequence: 'Creates many-to-many relationship',
                      correct: false,
                    },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleRelationshipChoice(option.value)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        option.correct
                          ? 'border-gray-600 hover:border-green-500 hover:bg-green-900/20'
                          : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-cyan-400">{option.label}</span>
                        {option.correct && (
                          <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-300">{option.preview}</div>
                      <div className="text-xs text-gray-500 mt-1">{option.consequence}</div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowDecisionModal(false);
                    setPendingRelationship(null);
                  }}
                  className="mt-4 text-gray-500 hover:text-gray-300 text-sm w-full text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

          {/* Wrong choice feedback */}
          {relationshipType && relationshipType !== 'has_many' && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-900/80 border border-red-700 text-red-200 px-6 py-3 rounded-lg">
              Wrong relationship type! {relationshipType === 'has_one' ? 'Only one comment shows.' : 'Comments would be shared between posts.'}
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={getCodeFiles()}
          learningGoal="Understanding ActiveRecord associations: has_many, has_one, belongs_to, and when to use each."
        >
          {/* Relationship explanation */}
          {relationshipType && (
            <div className={`p-4 border-t ${relationshipType === 'has_many' ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${relationshipType === 'has_many' ? 'text-green-400' : 'text-red-400'}`}>
                {relationshipType === 'has_many' ? 'Correct!' : 'Not quite right'}
              </div>
              <p className="text-sm text-gray-300">
                {relationshipType === 'has_many' ? (
                  'A Post has_many Comments is the correct one-to-many relationship. Each post can have multiple comments.'
                ) : relationshipType === 'has_one' ? (
                  'has_one limits each post to a single comment. Posts typically have many comments!'
                ) : (
                  'has_and_belongs_to_many creates a many-to-many relationship. Comments belong to specific posts, not shared between them.'
                )}
              </p>
            </div>
          )}
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level3Associations;

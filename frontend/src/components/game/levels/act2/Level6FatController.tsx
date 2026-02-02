/**
 * Level 6: The Fat Controller
 *
 * Controller has 4 logic blocks that need to be moved to appropriate places.
 * Complexity meter shows when controller is "too fat".
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
  useLevelCompletion,
  type ValidationResult,
} from '../shared';

interface LogicBlock {
  id: string;
  name: string;
  code: string;
  color: string;
  currentLocation: string; // node id where the block currently is
  validTargets: string[]; // node types this block can be moved to
}

interface NodeWithBlocks {
  id: string;
  type: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  blocks: string[]; // block ids
  complexity: number;
}

const INITIAL_BLOCKS: LogicBlock[] = [
  {
    id: 'validate',
    name: 'Validate',
    code: 'validates :title, presence: true',
    color: '#22c55e',
    currentLocation: 'controller-1',
    validTargets: ['model'],
  },
  {
    id: 'charge',
    name: 'Charge',
    code: 'Stripe.charge(amount)',
    color: '#3b82f6',
    currentLocation: 'controller-1',
    validTargets: ['service'],
  },
  {
    id: 'email',
    name: 'Email',
    code: 'UserMailer.welcome.deliver_later',
    color: '#f59e0b',
    currentLocation: 'controller-1',
    validTargets: ['service'],
  },
  {
    id: 'save',
    name: 'Save',
    code: '@post.save!',
    color: '#8b5cf6',
    currentLocation: 'controller-1',
    validTargets: ['model'],
  },
];

const INITIAL_NODES: NodeWithBlocks[] = [
  {
    id: 'controller-1',
    type: 'controller',
    name: 'PostsController',
    icon: 'C',
    color: '#3b82f6',
    x: 150,
    y: 250,
    blocks: ['validate', 'charge', 'email', 'save'],
    complexity: 85,
  },
  {
    id: 'model-1',
    type: 'model',
    name: 'Post',
    icon: 'M',
    color: '#8b5cf6',
    x: 450,
    y: 150,
    blocks: [],
    complexity: 10,
  },
  {
    id: 'service-1',
    type: 'service',
    name: 'OrderService',
    icon: 'S',
    color: '#10b981',
    x: 450,
    y: 350,
    blocks: [],
    complexity: 0,
  },
];

const COMPLEXITY_THRESHOLD = 50;
const BLOCK_COMPLEXITY = 20;

export function Level6FatController({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [blocks, setBlocks] = useState<LogicBlock[]>(INITIAL_BLOCKS);
  const [nodes, setNodes] = useState<NodeWithBlocks[]>(INITIAL_NODES);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  // Calculate controller complexity
  const controllerNode = nodes.find(n => n.id === 'controller-1');
  const controllerComplexity = controllerNode ? controllerNode.blocks.length * BLOCK_COMPLEXITY + 5 : 0;

  // Validation function - checks blocks are in CORRECT locations, not just moved
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    // Check each block is in its correct location
    for (const block of blocks) {
      const currentNode = nodes.find(n => n.id === block.currentLocation);
      if (!currentNode) continue;

      const isCorrect = block.validTargets.includes(currentNode.type);

      if (!isCorrect) {
        if (block.currentLocation === 'controller-1') {
          errors.push(`${block.name} is still in the Controller`);
        } else {
          errors.push(`${block.name} should be in ${block.validTargets.join(' or ')}, not ${currentNode.type}`);
        }
      }
    }

    // Also check complexity threshold
    if (controllerComplexity >= COMPLEXITY_THRESHOLD) {
      errors.push(`Controller complexity (${controllerComplexity}) is still above threshold (${COMPLEXITY_THRESHOLD})`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Not quite right!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'All blocks are in their correct locations!',
    };
  };

  // Handle dragging a block
  const handleBlockDragStart = (blockId: string) => {
    setDraggedBlock(blockId);
  };

  const handleBlockDragEnd = () => {
    setDraggedBlock(null);
    setDragOverNode(null);
  };

  // Handle dropping a block on a node
  const handleDropOnNode = (nodeId: string) => {
    if (!draggedBlock) return;

    const block = blocks.find(b => b.id === draggedBlock);
    const targetNode = nodes.find(n => n.id === nodeId);

    if (!block || !targetNode) return;

    // Check if this is a valid target
    if (!block.validTargets.includes(targetNode.type)) {
      // Invalid drop - shake or show feedback
      return;
    }

    // Move block to new node
    setBlocks(prev =>
      prev.map(b =>
        b.id === draggedBlock ? { ...b, currentLocation: nodeId } : b
      )
    );

    // Update node block lists
    setNodes(prev =>
      prev.map(n => {
        if (n.id === block.currentLocation) {
          return { ...n, blocks: n.blocks.filter(bid => bid !== draggedBlock) };
        }
        if (n.id === nodeId) {
          return { ...n, blocks: [...n.blocks, draggedBlock] };
        }
        return n;
      })
    );

    setDraggedBlock(null);
    setDragOverNode(null);
  };

  // Handle completing the level
  const handleComplete = async () => {
    const success = await completeLevel('act2-level6-fat-controller', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Get complexity status color
  const getComplexityColor = (complexity: number) => {
    if (complexity < 30) return '#22c55e'; // Green
    if (complexity < COMPLEXITY_THRESHOLD) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  // Generate code preview
  const getCodeFiles = () => {
    const controller = nodes.find(n => n.type === 'controller');
    const model = nodes.find(n => n.type === 'model');
    const service = nodes.find(n => n.type === 'service');

    const controllerBlocks = blocks.filter(b => b.currentLocation === controller?.id);
    const modelBlocks = blocks.filter(b => b.currentLocation === model?.id);
    const serviceBlocks = blocks.filter(b => b.currentLocation === service?.id);

    const files = [];

    // Controller file
    files.push({
      filename: 'app/controllers/posts_controller.rb',
      language: 'ruby',
      code: `class PostsController < ApplicationController
  def create
    @post = Post.new(post_params)
${controllerBlocks.map(b => `    ${b.code}`).join('\n') || '    # Clean controller!'}
    redirect_to @post
  end
end

# Complexity: ${controllerComplexity}`,
      highlight: controllerBlocks.length > 0 ? controllerBlocks.map((_, i) => i + 4) : [4],
    });

    // Model file
    files.push({
      filename: 'app/models/post.rb',
      language: 'ruby',
      code: `class Post < ApplicationRecord
${modelBlocks.map(b => `  ${b.code}`).join('\n') || '  # Add validations here'}
end`,
      highlight: modelBlocks.map((_, i) => i + 2),
    });

    // Service file (if blocks moved there)
    if (serviceBlocks.length > 0) {
      files.push({
        filename: 'app/services/order_service.rb',
        language: 'ruby',
        code: `class OrderService
  def initialize(post)
    @post = post
  end

  def call
${serviceBlocks.map(b => `    ${b.code}`).join('\n')}
  end
end`,
        highlight: serviceBlocks.map((_, i) => i + 7),
      });
    }

    return files;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The PostsController has grown to 300 lines. It's doing validation, payment processing, email sending, AND database operations."
          instructions={[
            'Drag logic blocks from the Controller to appropriate destinations',
            'Validate and Save belong in the Model',
            'Charge and Email belong in the Service',
            'Get controller complexity under 50',
          ]}
          goal="Apply the Single Responsibility Principle (SRP) by extracting concerns."
        >
          {/* Complexity Meter */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Controller Complexity
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Score</span>
                <span style={{ color: getComplexityColor(controllerComplexity) }} className="font-bold">
                  {controllerComplexity}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, controllerComplexity)}%`,
                    backgroundColor: getComplexityColor(controllerComplexity),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span className="text-yellow-500">Threshold: {COMPLEXITY_THRESHOLD}</span>
                <span>100</span>
              </div>
            </div>
            <div className={`text-sm text-center py-2 rounded ${
              controllerComplexity < COMPLEXITY_THRESHOLD ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {controllerComplexity < COMPLEXITY_THRESHOLD ? 'Controller is clean!' : 'Controller too complex!'}
            </div>
          </div>

          {/* Logic Block Legend */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Logic Blocks</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-gray-400">Validate - belongs in Model</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8b5cf6' }} />
                <span className="text-gray-400">Save - belongs in Model</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-gray-400">Charge - belongs in Service</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-gray-400">Email - belongs in Service</span>
              </div>
            </div>
          </div>

        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={6}
          levelName="The Fat Controller"
          actNumber={2}
          onExit={onExit}
          onReset={() => {
            setBlocks(INITIAL_BLOCKS);
            setNodes(INITIAL_NODES);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative bg-gray-950 overflow-hidden p-8"
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          {/* Nodes with blocks */}
          {nodes.map(node => {
            const nodeBlocks = blocks.filter(b => b.currentLocation === node.id);
            const isValidTarget = draggedBlock
              ? blocks.find(b => b.id === draggedBlock)?.validTargets.includes(node.type)
              : false;

            return (
              <div
                key={node.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  dragOverNode === node.id && isValidTarget ? 'scale-105' : ''
                } transition-transform`}
                style={{ left: node.x, top: node.y }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isValidTarget) setDragOverNode(node.id);
                }}
                onDragLeave={() => setDragOverNode(null)}
                onDrop={() => handleDropOnNode(node.id)}
              >
                {/* Node container */}
                <div
                  className={`rounded-xl border-2 p-4 min-w-[200px] transition-all ${
                    dragOverNode === node.id && isValidTarget
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-gray-600 bg-gray-800/80'
                  }`}
                  style={{ borderColor: dragOverNode === node.id && isValidTarget ? undefined : node.color }}
                >
                  {/* Node header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: node.color }}
                    >
                      {node.icon}
                    </span>
                    <div>
                      <div className="text-white font-semibold">{node.name}</div>
                      <div className="text-xs text-gray-400">{node.type}</div>
                    </div>
                    {node.type === 'controller' && (
                      <div
                        className="ml-auto text-xs font-bold px-2 py-1 rounded"
                        style={{
                          backgroundColor: getComplexityColor(controllerComplexity),
                          color: 'white',
                        }}
                      >
                        {controllerComplexity}
                      </div>
                    )}
                  </div>

                  {/* Block slots */}
                  <div className="space-y-2 min-h-[60px]">
                    {nodeBlocks.length > 0 ? (
                      nodeBlocks.map(block => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={() => handleBlockDragStart(block.id)}
                          onDragEnd={handleBlockDragEnd}
                          className="px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: block.color }}
                        >
                          <div className="text-white text-sm font-medium">{block.name}</div>
                          <div className="text-white/70 text-xs font-mono truncate">{block.code}</div>
                        </div>
                      ))
                    ) : (
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center text-gray-500 text-sm">
                        {isValidTarget ? 'Drop block here' : 'No blocks'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Arrows showing relationships */}
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
              </marker>
            </defs>
            {/* Controller to Model */}
            <line x1="210" y1="230" x2="390" y2="170" stroke="#4b5563" strokeWidth="2" markerEnd="url(#arrowhead)" strokeDasharray="5,5" />
            {/* Controller to Service */}
            <line x1="210" y1="270" x2="390" y2="330" stroke="#4b5563" strokeWidth="2" markerEnd="url(#arrowhead)" strokeDasharray="5,5" />
          </svg>

        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={getCodeFiles()}
          learningGoal="Understanding the Single Responsibility Principle: each class should have only one reason to change."
        >
          {/* SRP explanation */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              Single Responsibility Principle
            </div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>+ Controllers handle HTTP concerns</li>
              <li>+ Models handle data & validation</li>
              <li>+ Services handle business logic</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level6FatController;

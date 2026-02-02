/**
 * Level 7: Service Objects
 *
 * Extract business logic from a fat Model into a Service object.
 * Similar to Level 6 but extracting from Model instead of Controller.
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
  currentLocation: string;
  validTargets: string[]; // node types this block SHOULD be moved to
  shouldStayInModel: boolean; // true if it belongs in Model, false if it should go to Service
}

interface NodeWithBlocks {
  id: string;
  type: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  blocks: string[];
}

const INITIAL_BLOCKS: LogicBlock[] = [
  {
    id: 'validations',
    name: 'Validations',
    code: 'validates :email, presence: true',
    color: '#22c55e',
    currentLocation: 'model-1',
    validTargets: ['model'],
    shouldStayInModel: true,
  },
  {
    id: 'associations',
    name: 'Associations',
    code: 'has_many :orders',
    color: '#8b5cf6',
    currentLocation: 'model-1',
    validTargets: ['model'],
    shouldStayInModel: true,
  },
  {
    id: 'charge',
    name: 'Charge Payment',
    code: 'Stripe::Charge.create(...)',
    color: '#3b82f6',
    currentLocation: 'model-1',
    validTargets: ['service'],
    shouldStayInModel: false,
  },
  {
    id: 'email',
    name: 'Send Email',
    code: 'UserMailer.welcome.deliver_later',
    color: '#f59e0b',
    currentLocation: 'model-1',
    validTargets: ['service'],
    shouldStayInModel: false,
  },
  {
    id: 'api',
    name: 'External API',
    code: 'SlackNotifier.notify(...)',
    color: '#ef4444',
    currentLocation: 'model-1',
    validTargets: ['service'],
    shouldStayInModel: false,
  },
];

const INITIAL_NODES: NodeWithBlocks[] = [
  {
    id: 'model-1',
    type: 'model',
    name: 'User',
    icon: 'M',
    color: '#8b5cf6',
    x: 150,
    y: 250,
    blocks: ['validations', 'associations', 'charge', 'email', 'api'],
  },
  {
    id: 'service-1',
    type: 'service',
    name: 'UserRegistrationService',
    icon: 'S',
    color: '#10b981',
    x: 500,
    y: 250,
    blocks: [],
  },
];

export function Level7Services({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [blocks, setBlocks] = useState<LogicBlock[]>(INITIAL_BLOCKS);
  const [nodes, setNodes] = useState<NodeWithBlocks[]>(INITIAL_NODES);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    for (const block of blocks) {
      const currentNode = nodes.find(n => n.id === block.currentLocation);
      if (!currentNode) continue;

      if (block.shouldStayInModel) {
        // Data-related blocks should stay in Model
        if (currentNode.type !== 'model') {
          errors.push(`${block.name} should stay in the Model (data-related)`);
        }
      } else {
        // Business logic blocks should move to Service
        if (currentNode.type !== 'service') {
          errors.push(`${block.name} is business logic - move it to the Service`);
        }
      }
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
      message: 'Model is now focused on data, Service handles business logic!',
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

  const handleComplete = async () => {
    const success = await completeLevel('act2-level7-service-objects', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Count blocks in each location
  const modelBlocks = blocks.filter(b => b.currentLocation === 'model-1');
  const serviceBlocks = blocks.filter(b => b.currentLocation === 'service-1');

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The User model has grown to 500 lines! It's handling validations, associations, AND business logic like payments and notifications."
          instructions={[
            'Keep data-related code in the Model (validations, associations)',
            'Move business logic to the Service (payments, emails, APIs)',
            'Click Submit to check your solution',
          ]}
          goal="Learn the Service Object pattern - Models for data, Services for business logic."
        >
          {/* Block Legend */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Block Guide</div>
            <div className="space-y-2 text-xs">
              <div className="text-gray-500 mb-2">Keep in Model:</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-gray-400">Validations (data integrity)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8b5cf6' }} />
                <span className="text-gray-400">Associations (relationships)</span>
              </div>
              <div className="text-gray-500 mt-3 mb-2">Move to Service:</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-gray-400">Charge Payment (external API)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-gray-400">Send Email (side effect)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
                <span className="text-gray-400">External API (integration)</span>
              </div>
            </div>
          </div>

        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={7}
          levelName="Service Objects"
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
                <div
                  className={`rounded-xl border-2 p-4 min-w-[220px] transition-all ${
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
                  </div>

                  {/* Block slots */}
                  <div className="space-y-2 min-h-[80px]">
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
                        {isValidTarget ? 'Drop blocks here' : 'No blocks'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Arrow showing flow */}
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="arrowhead-7" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
              </marker>
            </defs>
            <line x1="230" y1="250" x2="400" y2="250" stroke="#4b5563" strokeWidth="2" markerEnd="url(#arrowhead-7)" strokeDasharray="5,5" />
            <text x="315" y="235" fill="#6b7280" fontSize="11" textAnchor="middle">calls</text>
          </svg>

          {/* Summary boxes */}
          <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-4">
            <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg px-4 py-2">
              <div className="text-purple-400 text-xs uppercase">Model</div>
              <div className="text-white font-bold">{modelBlocks.length} blocks</div>
            </div>
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg px-4 py-2">
              <div className="text-green-400 text-xs uppercase">Service</div>
              <div className="text-white font-bold">{serviceBlocks.length} blocks</div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/services/user_registration_service.rb',
            language: 'ruby',
            code: `class UserRegistrationService
  def initialize(user:)
    @user = user
  end

  def call
    return failure(@user.errors) unless @user.valid?

    ActiveRecord::Base.transaction do
      @user.save!
      charge_payment
      send_welcome_email
      notify_slack
    end

    success(@user)
  end

  private

  def charge_payment
    Stripe::Charge.create(
      customer: @user.stripe_customer_id,
      amount: 999
    )
  end

  def send_welcome_email
    UserMailer.welcome(@user).deliver_later
  end

  def notify_slack
    SlackNotifier.notify("New user: #{@user.email}")
  end
end`,
            highlight: [1, 6, 10, 11, 12, 13, 20, 27, 31],
          }]}
          learningGoal="Service Objects extract business logic from Models. Models should only handle data (validations, associations, scopes). Services handle orchestration and side effects."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              Model vs Service
            </div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>+ Models: data shape, validations, queries</li>
              <li>+ Services: orchestration, side effects, APIs</li>
              <li>+ Keep Models under 200 lines</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level7Services;

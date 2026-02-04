/**
 * Level 6: Separation of Concerns
 *
 * Player places code blocks into the correct architectural layer.
 * Teaches: Controllers handle HTTP, Models handle data, Services handle business logic.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';
import { Button } from '../../../ui/Button';
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

interface CodeBlock {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  correctTarget: 'controller' | 'model' | 'service';
  currentLocation: string | null; // null = in palette, or node id
}

interface ArchitectureNode {
  id: string;
  type: 'controller' | 'model' | 'service';
  name: string;
  description: string;
  icon: string;
  color: string;
}

const CODE_BLOCKS: CodeBlock[] = [
  {
    id: 'params',
    name: 'Permit Params',
    code: 'params.require(:order).permit(:product_id, :quantity)',
    color: '#3b82f6',
    description: 'Handles incoming HTTP parameters',
    correctTarget: 'controller',
    currentLocation: null,
  },
  {
    id: 'response',
    name: 'Render Response',
    code: 'render json: { order: @order }, status: :created',
    color: '#06b6d4',
    description: 'Formats HTTP response',
    correctTarget: 'controller',
    currentLocation: null,
  },
  {
    id: 'validation',
    name: 'Validation',
    code: 'validates :total, numericality: { greater_than: 0 }',
    color: '#22c55e',
    description: 'Ensures data integrity',
    correctTarget: 'model',
    currentLocation: null,
  },
  {
    id: 'association',
    name: 'Association',
    code: 'belongs_to :user\nhas_many :line_items',
    color: '#10b981',
    description: 'Defines data relationships',
    correctTarget: 'model',
    currentLocation: null,
  },
  {
    id: 'payment',
    name: 'Process Payment',
    code: 'Stripe::Charge.create(amount: total_cents)',
    color: '#f59e0b',
    description: 'External API integration',
    correctTarget: 'service',
    currentLocation: null,
  },
  {
    id: 'email',
    name: 'Send Receipt',
    code: 'OrderMailer.receipt(@order).deliver_later',
    color: '#ef4444',
    description: 'Triggers side effects',
    correctTarget: 'service',
    currentLocation: null,
  },
];

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: 'controller',
    type: 'controller',
    name: 'OrdersController',
    description: 'HTTP layer - requests & responses',
    icon: 'C',
    color: '#3b82f6',
  },
  {
    id: 'model',
    type: 'model',
    name: 'Order',
    description: 'Data layer - structure & validation',
    icon: 'M',
    color: '#22c55e',
  },
  {
    id: 'service',
    type: 'service',
    name: 'CheckoutService',
    description: 'Business layer - logic & orchestration',
    icon: 'S',
    color: '#f59e0b',
  },
];

export function Level6FatController({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [blocks, setBlocks] = useState<CodeBlock[]>(CODE_BLOCKS);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  // Count correctly placed blocks
  const placedBlocks = blocks.filter(b => b.currentLocation !== null);
  const correctlyPlaced = blocks.filter(
    b => b.currentLocation === b.correctTarget
  );

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    // Check all blocks are placed
    const unplacedBlocks = blocks.filter(b => b.currentLocation === null);
    if (unplacedBlocks.length > 0) {
      errors.push(`${unplacedBlocks.length} block(s) still need to be placed`);
    }

    // Check blocks are in correct locations
    for (const block of blocks) {
      if (block.currentLocation && block.currentLocation !== block.correctTarget) {
        const targetNode = ARCHITECTURE_NODES.find(n => n.id === block.currentLocation);
        errors.push(`"${block.name}" doesn't belong in ${targetNode?.name || 'that location'}`);
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Architecture needs adjustment!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'Clean architecture - each layer has a single responsibility!',
    };
  };

  // Handle dragging
  const handleDragStart = (blockId: string) => {
    setDraggedBlock(blockId);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
    setDragOverNode(null);
  };

  const handleDropOnNode = (nodeId: string) => {
    if (!draggedBlock) return;

    setBlocks(prev =>
      prev.map(b =>
        b.id === draggedBlock ? { ...b, currentLocation: nodeId } : b
      )
    );

    setDraggedBlock(null);
    setDragOverNode(null);
  };

  const handleRemoveFromNode = (blockId: string) => {
    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId ? { ...b, currentLocation: null } : b
      )
    );
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level6-separation-of-concerns', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Get blocks for a specific node
  const getBlocksForNode = (nodeId: string) =>
    blocks.filter(b => b.currentLocation === nodeId);

  // Get blocks still in palette
  const paletteBlocks = blocks.filter(b => b.currentLocation === null);

  // Generate code preview
  const generateCodePreview = () => {
    const controllerBlocks = getBlocksForNode('controller');
    const modelBlocks = getBlocksForNode('model');
    const serviceBlocks = getBlocksForNode('service');

    return [
      {
        filename: 'app/controllers/orders_controller.rb',
        language: 'ruby',
        code: `class OrdersController < ApplicationController
  def create
    ${controllerBlocks.find(b => b.id === 'params')?.code || '# Handle params here'}

    result = CheckoutService.new(@order).call

    if result.success?
      ${controllerBlocks.find(b => b.id === 'response')?.code || '# Render response here'}
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end
end`,
        highlight: controllerBlocks.length > 0 ? [3, 8] : [],
      },
      {
        filename: 'app/models/order.rb',
        language: 'ruby',
        code: `class Order < ApplicationRecord
  ${modelBlocks.find(b => b.id === 'association')?.code || '# Define associations here'}

  ${modelBlocks.find(b => b.id === 'validation')?.code || '# Add validations here'}
end`,
        highlight: modelBlocks.length > 0 ? [2, 4] : [],
      },
      {
        filename: 'app/services/checkout_service.rb',
        language: 'ruby',
        code: `class CheckoutService
  def initialize(order)
    @order = order
  end

  def call
    return failure(@order.errors) unless @order.valid?

    ActiveRecord::Base.transaction do
      @order.save!
      ${serviceBlocks.find(b => b.id === 'payment')?.code || '# Process payment here'}
      ${serviceBlocks.find(b => b.id === 'email')?.code || '# Send notifications here'}
    end

    success(@order)
  end
end`,
        highlight: serviceBlocks.length > 0 ? [11, 12] : [],
      },
    ];
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your startup just closed Series A! The CEO wants checkout by Friday. You're architecting the code - place each piece in the right layer."
          instructions={[
            'Drag code blocks from the palette to the correct layer',
            'Controller: HTTP concerns (params, responses)',
            'Model: Data concerns (validations, associations)',
            'Service: Business logic (payments, emails)',
          ]}
          goal="Learn the Single Responsibility Principle - each layer should have one job."
        >
          {/* Code Block Palette */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Code Blocks ({paletteBlocks.length} remaining)
            </div>
            <div className="space-y-2">
              {paletteBlocks.map(block => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(block.id)}
                  onDragEnd={handleDragEnd}
                  className="p-3 rounded-lg cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity border-2 border-transparent hover:border-foreground/20"
                  style={{ backgroundColor: block.color }}
                >
                  <div className="text-foreground text-sm font-medium">{block.name}</div>
                  <div className="text-foreground/60 text-xs mt-1">{block.description}</div>
                </div>
              ))}
              {paletteBlocks.length === 0 && (
                <div className="text-muted-foreground text-sm text-center py-4">
                  All blocks placed!
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Correctly Placed</span>
              <span className={correctlyPlaced.length === blocks.length ? 'text-success' : 'text-foreground'}>
                {correctlyPlaced.length} / {blocks.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${(correctlyPlaced.length / blocks.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={6}
          levelName="Separation of Concerns"
          actNumber={2}
          onExit={onExit}
          onReset={() => setBlocks(CODE_BLOCKS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-8">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          {/* Architecture Nodes */}
          <div className="relative h-full flex items-center justify-center gap-8">
            {ARCHITECTURE_NODES.map(node => {
              const nodeBlocks = getBlocksForNode(node.id);
              const isValidTarget = draggedBlock !== null;

              return (
                <div
                  key={node.id}
                  className={`w-64 transition-all ${
                    dragOverNode === node.id ? 'scale-105' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverNode(node.id);
                  }}
                  onDragLeave={() => setDragOverNode(null)}
                  onDrop={() => handleDropOnNode(node.id)}
                >
                  <div
                    className={`rounded-xl border-2 p-4 min-h-[300px] transition-all ${
                      dragOverNode === node.id
                        ? 'border-foreground bg-foreground/10'
                        : 'border-border bg-card/50'
                    }`}
                  >
                    {/* Node Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-foreground font-bold text-lg"
                        style={{ backgroundColor: node.color }}
                      >
                        {node.icon}
                      </span>
                      <div>
                        <div className="text-foreground font-semibold">{node.name}</div>
                        <div className="text-xs text-muted-foreground">{node.description}</div>
                      </div>
                    </div>

                    {/* Dropped Blocks */}
                    <div className="space-y-2 min-h-[180px]">
                      {nodeBlocks.length > 0 ? (
                        nodeBlocks.map(block => {
                          const isCorrect = block.correctTarget === node.id;
                          return (
                            <div
                              key={block.id}
                              className={`p-3 rounded-lg relative group ${
                                isCorrect ? 'ring-2 ring-success' : ''
                              }`}
                              style={{ backgroundColor: block.color }}
                            >
                              <div className="text-foreground text-sm font-medium">{block.name}</div>
                              <div className="text-foreground/60 text-xs font-mono mt-1 truncate">
                                {block.code.split('\n')[0]}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFromNode(block.id)}
                                className="absolute top-1 right-1 w-5 h-5 rounded bg-black/30 text-foreground/70 hover:text-foreground hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                              >
                                ×
                              </Button>
                              {isCorrect && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          dragOverNode === node.id
                            ? 'border-foreground/50 text-foreground/70'
                            : 'border-border text-muted-foreground'
                        }`}>
                          {isValidTarget ? 'Drop code here' : 'Drag code blocks here'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={generateCodePreview()}
          learningGoal="Single Responsibility Principle: Controllers handle HTTP, Models handle data, Services handle business logic."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Why Separate Concerns?
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>+ Easier to test each layer independently</li>
              <li>+ Changes in one layer don't break others</li>
              <li>+ New team members understand faster</li>
              <li>+ Scales to larger teams and codebases</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level6FatController;

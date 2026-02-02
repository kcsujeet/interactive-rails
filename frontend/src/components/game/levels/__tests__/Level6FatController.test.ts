/**
 * Tests for Level 6: The Fat Controller
 *
 * Validates that blocks must be moved to their CORRECT locations,
 * not just moved anywhere to reduce complexity.
 */

import { describe, test, expect } from 'bun:test';

// Types matching the component
interface LogicBlock {
  id: string;
  name: string;
  code: string;
  color: string;
  currentLocation: string;
  validTargets: string[];
}

interface NodeWithBlocks {
  id: string;
  type: string;
  name: string;
  blocks: string[];
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

// Recreate validation logic from component
const COMPLEXITY_THRESHOLD = 50;
const BLOCK_COMPLEXITY = 20;

function validateLevel6Solution(blocks: LogicBlock[], nodes: NodeWithBlocks[]): ValidationResult {
  const errors: string[] = [];

  // Calculate controller complexity
  const controllerNode = nodes.find(n => n.id === 'controller-1');
  const controllerComplexity = controllerNode ? controllerNode.blocks.length * BLOCK_COMPLEXITY + 5 : 0;

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
}

// Test data
const INITIAL_BLOCKS: LogicBlock[] = [
  { id: 'validate', name: 'Validate', code: 'validates :title, presence: true', color: '#22c55e', currentLocation: 'controller-1', validTargets: ['model'] },
  { id: 'charge', name: 'Charge', code: 'Stripe.charge(amount)', color: '#3b82f6', currentLocation: 'controller-1', validTargets: ['service'] },
  { id: 'email', name: 'Email', code: 'UserMailer.welcome.deliver_later', color: '#f59e0b', currentLocation: 'controller-1', validTargets: ['service'] },
  { id: 'save', name: 'Save', code: '@post.save!', color: '#8b5cf6', currentLocation: 'controller-1', validTargets: ['model'] },
];

const INITIAL_NODES: NodeWithBlocks[] = [
  { id: 'controller-1', type: 'controller', name: 'PostsController', blocks: ['validate', 'charge', 'email', 'save'] },
  { id: 'model-1', type: 'model', name: 'Post', blocks: [] },
  { id: 'service-1', type: 'service', name: 'OrderService', blocks: [] },
];

describe('Level 6: Fat Controller', () => {
  describe('Initial State', () => {
    test('should be invalid when no blocks are moved', () => {
      const result = validateLevel6Solution(INITIAL_BLOCKS, INITIAL_NODES);

      expect(result.valid).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details!.length).toBeGreaterThan(0);
    });

    test('should report all 4 blocks still in controller', () => {
      const result = validateLevel6Solution(INITIAL_BLOCKS, INITIAL_NODES);

      expect(result.details).toContain('Validate is still in the Controller');
      expect(result.details).toContain('Charge is still in the Controller');
      expect(result.details).toContain('Email is still in the Controller');
      expect(result.details).toContain('Save is still in the Controller');
    });

    test('should report complexity above threshold', () => {
      const result = validateLevel6Solution(INITIAL_BLOCKS, INITIAL_NODES);

      // 4 blocks * 20 + 5 = 85
      expect(result.details!.some(d => d.includes('complexity') && d.includes('85'))).toBe(true);
    });
  });

  describe('Partial Solutions (False Positives Prevention)', () => {
    test('should be invalid when only Validate moved to Model', () => {
      const blocks = INITIAL_BLOCKS.map(b =>
        b.id === 'validate' ? { ...b, currentLocation: 'model-1' } : b
      );
      const nodes = [
        { ...INITIAL_NODES[0], blocks: ['charge', 'email', 'save'] },
        { ...INITIAL_NODES[1], blocks: ['validate'] },
        { ...INITIAL_NODES[2], blocks: [] },
      ];

      const result = validateLevel6Solution(blocks, nodes);

      expect(result.valid).toBe(false);
      expect(result.details).toContain('Charge is still in the Controller');
      expect(result.details).toContain('Email is still in the Controller');
      expect(result.details).toContain('Save is still in the Controller');
    });

    test('should be invalid when Validate and Charge moved but Email and Save remain', () => {
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.id === 'validate') return { ...b, currentLocation: 'model-1' };
        if (b.id === 'charge') return { ...b, currentLocation: 'service-1' };
        return b;
      });
      const nodes = [
        { ...INITIAL_NODES[0], blocks: ['email', 'save'] },
        { ...INITIAL_NODES[1], blocks: ['validate'] },
        { ...INITIAL_NODES[2], blocks: ['charge'] },
      ];

      const result = validateLevel6Solution(blocks, nodes);

      expect(result.valid).toBe(false);
      // Complexity: 2 blocks * 20 + 5 = 45 (under 50), but blocks still wrong
      expect(result.details).toContain('Email is still in the Controller');
      expect(result.details).toContain('Save is still in the Controller');
    });

    test('should be invalid when complexity under threshold but blocks in wrong places', () => {
      // Move Validate to Service (wrong!) and Charge to Model (wrong!)
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.id === 'validate') return { ...b, currentLocation: 'service-1' }; // WRONG
        if (b.id === 'charge') return { ...b, currentLocation: 'model-1' }; // WRONG
        if (b.id === 'email') return { ...b, currentLocation: 'service-1' };
        if (b.id === 'save') return { ...b, currentLocation: 'model-1' };
        return b;
      });
      const nodes = [
        { ...INITIAL_NODES[0], blocks: [] },
        { ...INITIAL_NODES[1], blocks: ['charge', 'save'] },
        { ...INITIAL_NODES[2], blocks: ['validate', 'email'] },
      ];

      const result = validateLevel6Solution(blocks, nodes);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Validate') && d.includes('model'))).toBe(true);
      expect(result.details!.some(d => d.includes('Charge') && d.includes('service'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when all blocks are in correct locations', () => {
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.id === 'validate') return { ...b, currentLocation: 'model-1' };
        if (b.id === 'save') return { ...b, currentLocation: 'model-1' };
        if (b.id === 'charge') return { ...b, currentLocation: 'service-1' };
        if (b.id === 'email') return { ...b, currentLocation: 'service-1' };
        return b;
      });
      const nodes = [
        { ...INITIAL_NODES[0], blocks: [] },
        { ...INITIAL_NODES[1], blocks: ['validate', 'save'] },
        { ...INITIAL_NODES[2], blocks: ['charge', 'email'] },
      ];

      const result = validateLevel6Solution(blocks, nodes);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('correct locations');
    });

    test('should report correct success message', () => {
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.id === 'validate') return { ...b, currentLocation: 'model-1' };
        if (b.id === 'save') return { ...b, currentLocation: 'model-1' };
        if (b.id === 'charge') return { ...b, currentLocation: 'service-1' };
        if (b.id === 'email') return { ...b, currentLocation: 'service-1' };
        return b;
      });
      const nodes = [
        { ...INITIAL_NODES[0], blocks: [] },
        { ...INITIAL_NODES[1], blocks: ['validate', 'save'] },
        { ...INITIAL_NODES[2], blocks: ['charge', 'email'] },
      ];

      const result = validateLevel6Solution(blocks, nodes);

      expect(result.valid).toBe(true);
      expect(result.details).toBeUndefined();
    });
  });

  describe('Complexity Calculation', () => {
    test('initial complexity should be 85 (4 blocks * 20 + 5)', () => {
      const controllerNode = INITIAL_NODES.find(n => n.id === 'controller-1')!;
      const complexity = controllerNode.blocks.length * BLOCK_COMPLEXITY + 5;
      expect(complexity).toBe(85);
    });

    test('complexity with 2 blocks should be 45', () => {
      const complexity = 2 * BLOCK_COMPLEXITY + 5;
      expect(complexity).toBe(45);
    });

    test('complexity with 0 blocks should be 5', () => {
      const complexity = 0 * BLOCK_COMPLEXITY + 5;
      expect(complexity).toBe(5);
    });

    test('threshold should be 50', () => {
      expect(COMPLEXITY_THRESHOLD).toBe(50);
    });
  });
});

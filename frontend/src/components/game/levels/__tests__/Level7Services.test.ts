/**
 * Tests for Level 7: Service Objects
 *
 * Validates that data-related blocks stay in Model,
 * and business logic blocks move to Service.
 */

import { describe, test, expect } from 'bun:test';

interface LogicBlock {
  id: string;
  name: string;
  currentLocation: string;
  validTargets: string[];
  shouldStayInModel: boolean;
}

interface NodeWithBlocks {
  id: string;
  type: string;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

// Recreate validation logic from component
function validateLevel7Solution(blocks: LogicBlock[], nodes: NodeWithBlocks[]): ValidationResult {
  const errors: string[] = [];

  for (const block of blocks) {
    const currentNode = nodes.find(n => n.id === block.currentLocation);
    if (!currentNode) continue;

    if (block.shouldStayInModel) {
      if (currentNode.type !== 'model') {
        errors.push(`${block.name} should stay in the Model (data-related)`);
      }
    } else {
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
}

// Test data
const INITIAL_BLOCKS: LogicBlock[] = [
  { id: 'validations', name: 'Validations', currentLocation: 'model-1', validTargets: ['model'], shouldStayInModel: true },
  { id: 'associations', name: 'Associations', currentLocation: 'model-1', validTargets: ['model'], shouldStayInModel: true },
  { id: 'charge', name: 'Charge Payment', currentLocation: 'model-1', validTargets: ['service'], shouldStayInModel: false },
  { id: 'email', name: 'Send Email', currentLocation: 'model-1', validTargets: ['service'], shouldStayInModel: false },
  { id: 'api', name: 'External API', currentLocation: 'model-1', validTargets: ['service'], shouldStayInModel: false },
];

const NODES: NodeWithBlocks[] = [
  { id: 'model-1', type: 'model' },
  { id: 'service-1', type: 'service' },
];

describe('Level 7: Service Objects', () => {
  describe('Initial State', () => {
    test('should be invalid when no blocks are moved', () => {
      const result = validateLevel7Solution(INITIAL_BLOCKS, NODES);

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(3); // 3 business logic blocks need to move
    });

    test('should not complain about data blocks already in Model', () => {
      const result = validateLevel7Solution(INITIAL_BLOCKS, NODES);

      expect(result.details!.some(d => d.includes('Validations'))).toBe(false);
      expect(result.details!.some(d => d.includes('Associations'))).toBe(false);
    });

    test('should complain about business logic blocks in Model', () => {
      const result = validateLevel7Solution(INITIAL_BLOCKS, NODES);

      expect(result.details).toContain('Charge Payment is business logic - move it to the Service');
      expect(result.details).toContain('Send Email is business logic - move it to the Service');
      expect(result.details).toContain('External API is business logic - move it to the Service');
    });
  });

  describe('Partial Solutions', () => {
    test('should be invalid when only Charge moved to Service', () => {
      const blocks = INITIAL_BLOCKS.map(b =>
        b.id === 'charge' ? { ...b, currentLocation: 'service-1' } : b
      );

      const result = validateLevel7Solution(blocks, NODES);

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(2);
      expect(result.details!.some(d => d.includes('Charge'))).toBe(false);
    });

    test('should be invalid when data blocks moved to Service (wrong!)', () => {
      const blocks = INITIAL_BLOCKS.map(b =>
        b.id === 'validations' ? { ...b, currentLocation: 'service-1' } : b
      );

      const result = validateLevel7Solution(blocks, NODES);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Validations') && d.includes('Model'))).toBe(true);
    });

    test('should be invalid when Associations moved to Service (wrong!)', () => {
      const blocks = INITIAL_BLOCKS.map(b =>
        b.id === 'associations' ? { ...b, currentLocation: 'service-1' } : b
      );

      const result = validateLevel7Solution(blocks, NODES);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Associations') && d.includes('Model'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when data stays in Model and business logic in Service', () => {
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.shouldStayInModel) return b; // Keep in model
        return { ...b, currentLocation: 'service-1' }; // Move to service
      });

      const result = validateLevel7Solution(blocks, NODES);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('Model is now focused on data');
    });

    test('should have no errors in correct solution', () => {
      const blocks = INITIAL_BLOCKS.map(b => {
        if (b.shouldStayInModel) return b;
        return { ...b, currentLocation: 'service-1' };
      });

      const result = validateLevel7Solution(blocks, NODES);

      expect(result.details).toBeUndefined();
    });
  });

  describe('Block Classification', () => {
    test('Validations should stay in Model', () => {
      const block = INITIAL_BLOCKS.find(b => b.id === 'validations')!;
      expect(block.shouldStayInModel).toBe(true);
      expect(block.validTargets).toContain('model');
    });

    test('Associations should stay in Model', () => {
      const block = INITIAL_BLOCKS.find(b => b.id === 'associations')!;
      expect(block.shouldStayInModel).toBe(true);
      expect(block.validTargets).toContain('model');
    });

    test('Charge Payment should go to Service', () => {
      const block = INITIAL_BLOCKS.find(b => b.id === 'charge')!;
      expect(block.shouldStayInModel).toBe(false);
      expect(block.validTargets).toContain('service');
    });

    test('Send Email should go to Service', () => {
      const block = INITIAL_BLOCKS.find(b => b.id === 'email')!;
      expect(block.shouldStayInModel).toBe(false);
      expect(block.validTargets).toContain('service');
    });

    test('External API should go to Service', () => {
      const block = INITIAL_BLOCKS.find(b => b.id === 'api')!;
      expect(block.shouldStayInModel).toBe(false);
      expect(block.validTargets).toContain('service');
    });
  });
});

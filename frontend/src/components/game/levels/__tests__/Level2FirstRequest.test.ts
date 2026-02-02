/**
 * Tests for Level 2: First Request
 *
 * Validates the MVC pipeline is complete with all required nodes and connections.
 */

import { describe, test, expect } from 'bun:test';

interface PlacedNode {
  id: string;
  type: string;
}

interface Connection {
  sourceId: string;
  targetId: string;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level2State {
  placedNodes: PlacedNode[];
  connections: Connection[];
}

const REQUIRED_TYPES = ['request', 'router', 'controller', 'model', 'database', 'view', 'response'];

const EXPECTED_PATH = [
  { from: 'request', to: 'router' },
  { from: 'router', to: 'controller' },
  { from: 'controller', to: 'model' },
  { from: 'model', to: 'database' },
  { from: 'database', to: 'view' },
  { from: 'view', to: 'response' },
];

// Recreate validation logic from component
function validateLevel2Solution(state: Level2State): ValidationResult {
  const errors: string[] = [];
  const { placedNodes, connections } = state;

  // Check if all required node types are present
  const nodeTypes = new Set(placedNodes.map(n => n.type));
  const missingTypes = REQUIRED_TYPES.filter(t => !nodeTypes.has(t));

  if (missingTypes.length > 0) {
    errors.push(`Missing nodes: ${missingTypes.join(', ')}`);
  }

  // Check if all required connections exist
  for (const expected of EXPECTED_PATH) {
    const sourceNode = placedNodes.find(n => n.type === expected.from);
    const targetNode = placedNodes.find(n => n.type === expected.to);

    if (sourceNode && targetNode) {
      const hasConnection = connections.some(
        c => c.sourceId === sourceNode.id && c.targetId === targetNode.id
      );
      if (!hasConnection) {
        errors.push(`Missing connection: ${expected.from} → ${expected.to}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Pipeline incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'MVC pipeline complete!',
  };
}

describe('Level 2: First Request', () => {
  describe('Initial State', () => {
    test('should be invalid with only request node', () => {
      const result = validateLevel2Solution({
        placedNodes: [{ id: 'request-1', type: 'request' }],
        connections: [],
      });

      expect(result.valid).toBe(false);
    });

    test('should require all MVC nodes', () => {
      const result = validateLevel2Solution({
        placedNodes: [{ id: 'request-1', type: 'request' }],
        connections: [],
      });

      expect(result.details!.some(d => d.includes('router'))).toBe(true);
      expect(result.details!.some(d => d.includes('controller'))).toBe(true);
      expect(result.details!.some(d => d.includes('model'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid with only some nodes placed', () => {
      const result = validateLevel2Solution({
        placedNodes: [
          { id: 'request-1', type: 'request' },
          { id: 'router-1', type: 'router' },
          { id: 'controller-1', type: 'controller' },
        ],
        connections: [],
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid with all nodes but no connections', () => {
      const result = validateLevel2Solution({
        placedNodes: REQUIRED_TYPES.map(t => ({ id: `${t}-1`, type: t })),
        connections: [],
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid with partial connections', () => {
      const result = validateLevel2Solution({
        placedNodes: REQUIRED_TYPES.map(t => ({ id: `${t}-1`, type: t })),
        connections: [
          { sourceId: 'request-1', targetId: 'router-1' },
          { sourceId: 'router-1', targetId: 'controller-1' },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('controller → model'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    const completeState: Level2State = {
      placedNodes: REQUIRED_TYPES.map(t => ({ id: `${t}-1`, type: t })),
      connections: [
        { sourceId: 'request-1', targetId: 'router-1' },
        { sourceId: 'router-1', targetId: 'controller-1' },
        { sourceId: 'controller-1', targetId: 'model-1' },
        { sourceId: 'model-1', targetId: 'database-1' },
        { sourceId: 'database-1', targetId: 'view-1' },
        { sourceId: 'view-1', targetId: 'response-1' },
      ],
    };

    test('should be valid with complete pipeline', () => {
      const result = validateLevel2Solution(completeState);
      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel2Solution(completeState);
      expect(result.message).toContain('complete');
    });
  });

  describe('Expected Path', () => {
    test('request connects to router', () => {
      expect(EXPECTED_PATH[0]).toEqual({ from: 'request', to: 'router' });
    });

    test('router connects to controller', () => {
      expect(EXPECTED_PATH[1]).toEqual({ from: 'router', to: 'controller' });
    });

    test('controller connects to model', () => {
      expect(EXPECTED_PATH[2]).toEqual({ from: 'controller', to: 'model' });
    });

    test('model connects to database', () => {
      expect(EXPECTED_PATH[3]).toEqual({ from: 'model', to: 'database' });
    });

    test('database connects to view', () => {
      expect(EXPECTED_PATH[4]).toEqual({ from: 'database', to: 'view' });
    });

    test('view connects to response', () => {
      expect(EXPECTED_PATH[5]).toEqual({ from: 'view', to: 'response' });
    });
  });
});

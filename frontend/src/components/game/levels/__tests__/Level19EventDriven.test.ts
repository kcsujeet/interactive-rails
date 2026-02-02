/**
 * Tests for Level 19: Event-Driven Architecture
 *
 * Validates that users experience BOTH architectures:
 * 1. Direct coupling (sequential)
 * 2. Event bus (parallel via pub/sub)
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level19State {
  eventBusEnabled: boolean;
  orderCountBefore: number;  // Orders processed before enabling event bus
  orderCountAfter: number;   // Orders processed after enabling event bus
}

// Recreate validation logic from component
function validateLevel19Solution(state: Level19State): ValidationResult {
  const errors: string[] = [];

  if (state.orderCountBefore === 0) {
    errors.push('Process at least one order WITHOUT the Event Bus first to see the problem');
  }

  if (!state.eventBusEnabled) {
    errors.push('Enable the Event Bus to decouple services');
  }

  if (state.orderCountAfter < 1) {
    errors.push('Process at least one order WITH the Event Bus to see the improvement');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Experience both architectures first!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Services are now loosely coupled via events!',
  };
}

describe('Level 19: Event-Driven Architecture', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: false,
        orderCountBefore: 0,
        orderCountAfter: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(3);
    });

    test('should require processing order without event bus', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: false,
        orderCountBefore: 0,
        orderCountAfter: 0,
      });

      expect(result.details!.some(d => d.includes('WITHOUT the Event Bus'))).toBe(true);
    });

    test('should require enabling event bus', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: false,
        orderCountBefore: 1,
        orderCountAfter: 0,
      });

      expect(result.details!.some(d => d.includes('Enable the Event Bus'))).toBe(true);
    });

    test('should require processing order with event bus', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 1,
        orderCountAfter: 0,
      });

      expect(result.details!.some(d => d.includes('WITH the Event Bus'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid if only processed before', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: false,
        orderCountBefore: 3,
        orderCountAfter: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid if skipped direct coupling', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 0,
        orderCountAfter: 5,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('WITHOUT'))).toBe(true);
    });

    test('should be invalid if enabled but no orders after', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 1,
        orderCountAfter: 0,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when all conditions met', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 1,
        orderCountAfter: 1,
      });

      expect(result.valid).toBe(true);
    });

    test('should be valid with multiple orders', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 3,
        orderCountAfter: 5,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel19Solution({
        eventBusEnabled: true,
        orderCountBefore: 1,
        orderCountAfter: 1,
      });

      expect(result.message).toContain('loosely coupled');
    });
  });

  describe('Learning Flow', () => {
    test('typical flow: direct coupling -> enable bus -> pub/sub', () => {
      // Step 1: Process order directly
      let state: Level19State = {
        eventBusEnabled: false,
        orderCountBefore: 1,
        orderCountAfter: 0,
      };
      expect(validateLevel19Solution(state).valid).toBe(false);

      // Step 2: Enable event bus
      state = { ...state, eventBusEnabled: true };
      expect(validateLevel19Solution(state).valid).toBe(false);

      // Step 3: Process order with event bus
      state = { ...state, orderCountAfter: 1 };
      expect(validateLevel19Solution(state).valid).toBe(true);
    });
  });
});

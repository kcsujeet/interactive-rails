/**
 * Tests for Level 15: Idempotency
 *
 * Validates that users see the overcharge problem first, then fix with idempotency.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level15State {
  idempotencyEnabled: boolean;
  duplicatesBlocked: number;
  sawOvercharge: boolean;
}

// Recreate validation logic from component
function validateLevel15Solution(state: Level15State): ValidationResult {
  const errors: string[] = [];

  if (!state.sawOvercharge) {
    errors.push('Wait to see a customer get overcharged first (observe the problem)');
  }

  if (!state.idempotencyEnabled) {
    errors.push('Enable Idempotency to prevent duplicate charges');
  }

  if (state.duplicatesBlocked < 2) {
    errors.push(`Need to block at least 2 duplicate webhooks (currently ${state.duplicatesBlocked})`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Idempotency not working yet!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Duplicate webhooks are now safely handled!',
  };
}

describe('Level 15: Idempotency', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: false,
        duplicatesBlocked: 0,
        sawOvercharge: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(3);
    });

    test('should require seeing overcharge first', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: false,
        duplicatesBlocked: 0,
        sawOvercharge: false,
      });

      expect(result.details!.some(d => d.includes('overcharged'))).toBe(true);
    });

    test('should require enabling idempotency', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: false,
        duplicatesBlocked: 0,
        sawOvercharge: true,
      });

      expect(result.details!.some(d => d.includes('Enable Idempotency'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid if enabled but not enough blocked', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: true,
        duplicatesBlocked: 1,
        sawOvercharge: true,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('currently 1'))).toBe(true);
    });

    test('should be invalid if skipped seeing overcharge', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: true,
        duplicatesBlocked: 5,
        sawOvercharge: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('overcharged'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with all conditions met', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: true,
        duplicatesBlocked: 2,
        sawOvercharge: true,
      });

      expect(result.valid).toBe(true);
    });

    test('should be valid with more than minimum blocked', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: true,
        duplicatesBlocked: 10,
        sawOvercharge: true,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel15Solution({
        idempotencyEnabled: true,
        duplicatesBlocked: 3,
        sawOvercharge: true,
      });

      expect(result.message).toContain('safely handled');
    });
  });

  describe('Learning Flow', () => {
    test('typical flow: see overcharge -> enable idempotency -> block duplicates', () => {
      // Step 1: See overcharge
      let state: Level15State = {
        idempotencyEnabled: false,
        duplicatesBlocked: 0,
        sawOvercharge: true,
      };
      expect(validateLevel15Solution(state).valid).toBe(false);

      // Step 2: Enable idempotency
      state = { ...state, idempotencyEnabled: true };
      expect(validateLevel15Solution(state).valid).toBe(false);

      // Step 3: Block enough duplicates
      state = { ...state, duplicatesBlocked: 2 };
      expect(validateLevel15Solution(state).valid).toBe(true);
    });
  });
});

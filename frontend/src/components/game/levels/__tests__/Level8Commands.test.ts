/**
 * Tests for Level 8: The Command Pattern
 *
 * Validates that users must experience BOTH scenarios:
 * 1. See the problem (failure without transaction)
 * 2. See the solution (rollback with transaction)
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level8State {
  transactionWrapped: boolean;
  sawProblem: boolean;
  sawRollback: boolean;
}

// Recreate validation logic from component
function validateLevel8Solution(state: Level8State): ValidationResult {
  const errors: string[] = [];

  if (!state.sawProblem) {
    errors.push('Run simulation WITHOUT transaction first to see the problem');
  }

  if (!state.sawRollback) {
    errors.push('Run simulation WITH transaction to see rollback behavior');
  }

  if (!state.transactionWrapped) {
    errors.push('Enable Transaction wrapping');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Need to experience both scenarios!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Transaction ensures all-or-nothing behavior!',
  };
}

describe('Level 8: Command Pattern', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: false,
        sawRollback: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(3);
    });

    test('should require seeing the problem first', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: false,
        sawRollback: false,
      });

      expect(result.details).toContain('Run simulation WITHOUT transaction first to see the problem');
    });

    test('should require seeing rollback', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: false,
        sawRollback: false,
      });

      expect(result.details).toContain('Run simulation WITH transaction to see rollback behavior');
    });

    test('should require transaction wrapping', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: false,
        sawRollback: false,
      });

      expect(result.details).toContain('Enable Transaction wrapping');
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid if only saw problem', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: true,
        sawRollback: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('problem'))).toBe(false);
      expect(result.details!.some(d => d.includes('rollback'))).toBe(true);
    });

    test('should be invalid if only saw rollback (skipped problem)', () => {
      const result = validateLevel8Solution({
        transactionWrapped: true,
        sawProblem: false,
        sawRollback: true,
      });

      expect(result.valid).toBe(false);
      expect(result.details).toContain('Run simulation WITHOUT transaction first to see the problem');
    });

    test('should be invalid if saw both but transaction not enabled', () => {
      const result = validateLevel8Solution({
        transactionWrapped: false,
        sawProblem: true,
        sawRollback: true,
      });

      expect(result.valid).toBe(false);
      expect(result.details).toContain('Enable Transaction wrapping');
    });

    test('should be invalid if transaction enabled but didnt see problem', () => {
      const result = validateLevel8Solution({
        transactionWrapped: true,
        sawProblem: false,
        sawRollback: true,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.length).toBe(1);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when all conditions met', () => {
      const result = validateLevel8Solution({
        transactionWrapped: true,
        sawProblem: true,
        sawRollback: true,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel8Solution({
        transactionWrapped: true,
        sawProblem: true,
        sawRollback: true,
      });

      expect(result.message).toContain('all-or-nothing');
    });

    test('should have no error details when valid', () => {
      const result = validateLevel8Solution({
        transactionWrapped: true,
        sawProblem: true,
        sawRollback: true,
      });

      expect(result.details).toBeUndefined();
    });
  });

  describe('Learning Flow', () => {
    test('typical learning path: see problem -> enable transaction -> see rollback', () => {
      // Step 1: Initial state
      let state: Level8State = { transactionWrapped: false, sawProblem: false, sawRollback: false };
      expect(validateLevel8Solution(state).valid).toBe(false);

      // Step 2: Run without transaction, see failure
      state = { ...state, sawProblem: true };
      expect(validateLevel8Solution(state).valid).toBe(false);

      // Step 3: Enable transaction
      state = { ...state, transactionWrapped: true };
      expect(validateLevel8Solution(state).valid).toBe(false);

      // Step 4: Run with transaction, see rollback
      state = { ...state, sawRollback: true };
      expect(validateLevel8Solution(state).valid).toBe(true);
    });
  });
});

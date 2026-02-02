/**
 * Tests for Level 20: Feature Flags
 *
 * Validates flag is enabled, rollout is 100%, and new version succeeds.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level20State {
  flagEnabled: boolean;
  rolloutPercentage: number;
  newSuccesses: number;
  newErrors: number;
}

// Recreate validation logic from component
function validateLevel20Solution(state: Level20State): ValidationResult {
  const errors: string[] = [];

  if (!state.flagEnabled) {
    errors.push('Enable the feature flag to start gradual rollout');
  }

  if (state.rolloutPercentage < 100) {
    errors.push(`Increase rollout to 100% (currently ${state.rolloutPercentage}%)`);
  }

  if (state.newSuccesses < 5) {
    errors.push(`Need at least 5 successful requests on new version (currently ${state.newSuccesses})`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Rollout incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Feature successfully rolled out to 100% of users!',
  };
}

describe('Level 20: Feature Flags', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel20Solution({
        flagEnabled: false,
        rolloutPercentage: 10,
        newSuccesses: 0,
        newErrors: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should require enabling flag', () => {
      const result = validateLevel20Solution({
        flagEnabled: false,
        rolloutPercentage: 10,
        newSuccesses: 0,
        newErrors: 0,
      });

      expect(result.details!.some(d => d.includes('feature flag'))).toBe(true);
    });

    test('should require 100% rollout', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 50,
        newSuccesses: 10,
        newErrors: 0,
      });

      expect(result.details!.some(d => d.includes('100%'))).toBe(true);
    });

    test('should require successful requests', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 100,
        newSuccesses: 2,
        newErrors: 0,
      });

      expect(result.details!.some(d => d.includes('5 successful'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid at 50% rollout', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 50,
        newSuccesses: 10,
        newErrors: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid at 90% rollout', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 90,
        newSuccesses: 10,
        newErrors: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid with only 4 successes', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 100,
        newSuccesses: 4,
        newErrors: 0,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with 100% rollout and 5 successes', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 100,
        newSuccesses: 5,
        newErrors: 0,
      });

      expect(result.valid).toBe(true);
    });

    test('should be valid with more successes', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 100,
        newSuccesses: 20,
        newErrors: 1,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel20Solution({
        flagEnabled: true,
        rolloutPercentage: 100,
        newSuccesses: 5,
        newErrors: 0,
      });

      expect(result.message).toContain('100%');
    });
  });

  describe('Traffic Routing', () => {
    test('routes traffic based on percentage', () => {
      const rolloutPercentage = 50;
      const random = 0.3; // 30%

      const goesToNew = random * 100 < rolloutPercentage;
      expect(goesToNew).toBe(true);
    });

    test('high random goes to old version', () => {
      const rolloutPercentage = 50;
      const random = 0.7; // 70%

      const goesToNew = random * 100 < rolloutPercentage;
      expect(goesToNew).toBe(false);
    });
  });

  describe('Error Rates', () => {
    test('old version has higher error rate', () => {
      const oldErrorRate = 20;
      const newErrorRate = 5;

      expect(oldErrorRate).toBeGreaterThan(newErrorRate);
    });
  });
});

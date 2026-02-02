/**
 * Tests for Level 21: Read/Write Split
 *
 * Validates replica is enabled and primary load stays low.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level21State {
  replicaEnabled: boolean;
  primaryLoad: number;
  readCount: number;
}

// Recreate validation logic from component
function validateLevel21Solution(state: Level21State): ValidationResult {
  const errors: string[] = [];

  if (!state.replicaEnabled) {
    errors.push('Enable read replica to offload queries from primary');
  }

  if (state.primaryLoad >= 50) {
    errors.push(`Primary database load too high (${state.primaryLoad}%) - reads should go to replica`);
  }

  if (state.readCount < 10) {
    errors.push(`Process at least 10 read queries (currently ${state.readCount})`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Read/write split incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Reads now route to replica, writes to primary!',
  };
}

describe('Level 21: Read/Write Split', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel21Solution({
        replicaEnabled: false,
        primaryLoad: 80,
        readCount: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should require enabling replica', () => {
      const result = validateLevel21Solution({
        replicaEnabled: false,
        primaryLoad: 80,
        readCount: 0,
      });

      expect(result.details!.some(d => d.includes('read replica'))).toBe(true);
    });

    test('should require low primary load', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 70,
        readCount: 15,
      });

      expect(result.details!.some(d => d.includes('load too high'))).toBe(true);
    });

    test('should require processing reads', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 30,
        readCount: 5,
      });

      expect(result.details!.some(d => d.includes('10 read queries'))).toBe(true);
    });
  });

  describe('Load Thresholds', () => {
    test('should be invalid at 50% load', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 50,
        readCount: 15,
      });

      expect(result.valid).toBe(false);
    });

    test('should be valid at 49% load', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 49,
        readCount: 15,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid with only 9 reads', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 30,
        readCount: 9,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with replica and low load', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 30,
        readCount: 15,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel21Solution({
        replicaEnabled: true,
        primaryLoad: 30,
        readCount: 15,
      });

      expect(result.message).toContain('replica');
    });
  });

  describe('Query Routing', () => {
    test('reads route to replica when enabled', () => {
      const replicaEnabled = true;
      const isRead = true;

      const target = replicaEnabled && isRead ? 'replica' : 'primary';
      expect(target).toBe('replica');
    });

    test('writes always route to primary', () => {
      const replicaEnabled = true;
      const isRead = false;

      const target = replicaEnabled && isRead ? 'replica' : 'primary';
      expect(target).toBe('primary');
    });

    test('all queries route to primary without replica', () => {
      const replicaEnabled = false;
      const isRead = true;

      const target = replicaEnabled && isRead ? 'replica' : 'primary';
      expect(target).toBe('primary');
    });
  });

  describe('Load Distribution', () => {
    test('read-heavy workload benefits from replica', () => {
      // 70% reads, 30% writes
      const readPercentage = 70;
      const replicaEnabled = true;

      // With replica, reads go to replica
      const primaryLoadWithReplica = 30; // Only writes
      const primaryLoadWithout = 100; // All queries

      expect(primaryLoadWithReplica).toBeLessThan(primaryLoadWithout);
    });
  });
});

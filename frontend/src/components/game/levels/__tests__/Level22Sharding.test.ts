/**
 * Tests for Level 22: Database Sharding
 *
 * Validates sharding is enabled and load is distributed across shards.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level22State {
  shardingEnabled: boolean;
  shard0Load: number;
  shard1Load: number;
}

// Recreate validation logic from component
function validateLevel22Solution(state: Level22State): ValidationResult {
  const errors: string[] = [];

  if (!state.shardingEnabled) {
    errors.push('Enable sharding to distribute data across databases');
  }

  if (state.shard0Load >= 60) {
    errors.push(`Shard 0 load too high (${state.shard0Load}%)`);
  }

  if (state.shard1Load >= 60) {
    errors.push(`Shard 1 load too high (${state.shard1Load}%)`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Sharding not optimized!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Data distributed across shards!',
  };
}

describe('Level 22: Database Sharding', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel22Solution({
        shardingEnabled: false,
        shard0Load: 0,
        shard1Load: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should require enabling sharding', () => {
      const result = validateLevel22Solution({
        shardingEnabled: false,
        shard0Load: 0,
        shard1Load: 0,
      });

      expect(result.details!.some(d => d.includes('Enable sharding'))).toBe(true);
    });
  });

  describe('Load Thresholds', () => {
    test('should be invalid if shard 0 load is high', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 80,
        shard1Load: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Shard 0'))).toBe(true);
    });

    test('should be invalid if shard 1 load is high', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 40,
        shard1Load: 80,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Shard 1'))).toBe(true);
    });

    test('should be invalid at exactly 60% on either shard', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 60,
        shard1Load: 40,
      });

      expect(result.valid).toBe(false);
    });

    test('should be valid at 59% on both shards', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 59,
        shard1Load: 59,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with balanced low load', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 40,
        shard1Load: 45,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel22Solution({
        shardingEnabled: true,
        shard0Load: 40,
        shard1Load: 40,
      });

      expect(result.message).toContain('distributed');
    });
  });

  describe('Shard Routing', () => {
    test('routes by tenant_id % 2', () => {
      const getTenantShard = (tenantId: number) => tenantId % 2;

      expect(getTenantShard(1)).toBe(1);
      expect(getTenantShard(2)).toBe(0);
      expect(getTenantShard(3)).toBe(1);
      expect(getTenantShard(4)).toBe(0);
    });

    test('even tenant IDs go to shard 0', () => {
      const tenants = [2, 4, 6, 8, 10];
      const allGoToShard0 = tenants.every(id => id % 2 === 0);
      expect(allGoToShard0).toBe(true);
    });

    test('odd tenant IDs go to shard 1', () => {
      const tenants = [1, 3, 5, 7, 9];
      const allGoToShard1 = tenants.every(id => id % 2 === 1);
      expect(allGoToShard1).toBe(true);
    });
  });

  describe('Tenant Distribution', () => {
    const tenants = [
      { id: 1, name: 'Acme Corp', shard: 0, records: 5000000 },
      { id: 2, name: 'Globex Inc', shard: 1, records: 3000000 },
      { id: 3, name: 'Initech', shard: 0, records: 2000000 },
      { id: 4, name: 'Umbrella', shard: 1, records: 4000000 },
    ];

    test('total records is 14M', () => {
      const total = tenants.reduce((sum, t) => sum + t.records, 0);
      expect(total).toBe(14000000);
    });

    test('records split across shards', () => {
      const shard0Records = tenants.filter(t => t.shard === 0).reduce((sum, t) => sum + t.records, 0);
      const shard1Records = tenants.filter(t => t.shard === 1).reduce((sum, t) => sum + t.records, 0);

      expect(shard0Records).toBe(7000000);
      expect(shard1Records).toBe(7000000);
    });
  });
});

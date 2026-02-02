/**
 * Tests for Level 25: Microservices
 *
 * Validates that all domains are extracted and gateway is added.
 */

import { describe, test, expect } from 'bun:test';

interface Domain {
  id: string;
  name: string;
  extracted: boolean;
  dependencies: string[];
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level25State {
  scalpelActive: boolean;
  domains: Domain[];
  gateway: boolean;
}

// Recreate validation logic from component
function validateLevel25Solution(state: Level25State): ValidationResult {
  const errors: string[] = [];

  if (!state.scalpelActive) {
    errors.push('Activate the Scalpel tool first');
  }

  const unextractedDomains = state.domains.filter(d => !d.extracted);
  if (unextractedDomains.length > 0) {
    errors.push(`${unextractedDomains.length} domain(s) still in the monolith: ${unextractedDomains.map(d => d.name).join(', ')}`);
  }

  if (!state.gateway) {
    errors.push('Add an API Gateway to route requests to services');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Extraction incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Monolith successfully decomposed into microservices!',
  };
}

const INITIAL_DOMAINS: Domain[] = [
  { id: 'identity', name: 'Identity', extracted: false, dependencies: [] },
  { id: 'billing', name: 'Billing', extracted: false, dependencies: ['identity'] },
  { id: 'inventory', name: 'Inventory', extracted: false, dependencies: [] },
  { id: 'orders', name: 'Orders', extracted: false, dependencies: ['identity', 'billing', 'inventory'] },
];

describe('Level 25: Microservices', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel25Solution({
        scalpelActive: false,
        domains: INITIAL_DOMAINS,
        gateway: false,
      });

      expect(result.valid).toBe(false);
    });

    test('should require activating scalpel', () => {
      const result = validateLevel25Solution({
        scalpelActive: false,
        domains: INITIAL_DOMAINS,
        gateway: false,
      });

      expect(result.details).toContain('Activate the Scalpel tool first');
    });

    test('should report all 4 domains in monolith', () => {
      const result = validateLevel25Solution({
        scalpelActive: true,
        domains: INITIAL_DOMAINS,
        gateway: false,
      });

      expect(result.details!.some(d => d.includes('4 domain(s)'))).toBe(true);
      expect(result.details!.some(d => d.includes('Identity'))).toBe(true);
      expect(result.details!.some(d => d.includes('Billing'))).toBe(true);
    });

    test('should require gateway', () => {
      const result = validateLevel25Solution({
        scalpelActive: true,
        domains: INITIAL_DOMAINS,
        gateway: false,
      });

      expect(result.details!.some(d => d.includes('API Gateway'))).toBe(true);
    });
  });

  describe('Partial Extraction', () => {
    test('should be invalid with only Identity extracted', () => {
      const domains = INITIAL_DOMAINS.map(d =>
        d.id === 'identity' ? { ...d, extracted: true } : d
      );

      const result = validateLevel25Solution({
        scalpelActive: true,
        domains,
        gateway: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('3 domain(s)'))).toBe(true);
    });

    test('should be invalid with 3 extracted but no gateway', () => {
      const domains = INITIAL_DOMAINS.map(d =>
        d.id !== 'orders' ? { ...d, extracted: true } : d
      );

      const result = validateLevel25Solution({
        scalpelActive: true,
        domains,
        gateway: false,
      });

      expect(result.valid).toBe(false);
    });

    test('should be invalid with all extracted but no gateway', () => {
      const domains = INITIAL_DOMAINS.map(d => ({ ...d, extracted: true }));

      const result = validateLevel25Solution({
        scalpelActive: true,
        domains,
        gateway: false,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Gateway'))).toBe(true);
    });

    test('should be invalid with gateway but domains not extracted', () => {
      const result = validateLevel25Solution({
        scalpelActive: true,
        domains: INITIAL_DOMAINS,
        gateway: true,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with all domains extracted and gateway', () => {
      const domains = INITIAL_DOMAINS.map(d => ({ ...d, extracted: true }));

      const result = validateLevel25Solution({
        scalpelActive: true,
        domains,
        gateway: true,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const domains = INITIAL_DOMAINS.map(d => ({ ...d, extracted: true }));

      const result = validateLevel25Solution({
        scalpelActive: true,
        domains,
        gateway: true,
      });

      expect(result.message).toContain('Monolith successfully decomposed');
    });
  });

  describe('Domain Dependencies', () => {
    test('Identity has no dependencies', () => {
      const identity = INITIAL_DOMAINS.find(d => d.id === 'identity')!;
      expect(identity.dependencies).toEqual([]);
    });

    test('Billing depends on Identity', () => {
      const billing = INITIAL_DOMAINS.find(d => d.id === 'billing')!;
      expect(billing.dependencies).toContain('identity');
    });

    test('Inventory has no dependencies', () => {
      const inventory = INITIAL_DOMAINS.find(d => d.id === 'inventory')!;
      expect(inventory.dependencies).toEqual([]);
    });

    test('Orders depends on all other domains', () => {
      const orders = INITIAL_DOMAINS.find(d => d.id === 'orders')!;
      expect(orders.dependencies).toContain('identity');
      expect(orders.dependencies).toContain('billing');
      expect(orders.dependencies).toContain('inventory');
    });
  });

  describe('Learning Flow', () => {
    test('typical flow: activate scalpel -> extract domains -> add gateway', () => {
      // Step 1: Activate scalpel
      let state: Level25State = {
        scalpelActive: true,
        domains: INITIAL_DOMAINS,
        gateway: false,
      };
      expect(validateLevel25Solution(state).valid).toBe(false);

      // Step 2: Extract domains one by one
      state = {
        ...state,
        domains: state.domains.map(d =>
          d.id === 'identity' ? { ...d, extracted: true } : d
        ),
      };
      expect(validateLevel25Solution(state).valid).toBe(false);

      // Step 3: Extract all domains
      state = {
        ...state,
        domains: state.domains.map(d => ({ ...d, extracted: true })),
      };
      expect(validateLevel25Solution(state).valid).toBe(false);

      // Step 4: Add gateway
      state = { ...state, gateway: true };
      expect(validateLevel25Solution(state).valid).toBe(true);
    });
  });
});

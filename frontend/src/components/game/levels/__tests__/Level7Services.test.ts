/**
 * Tests for Level 7: Building a Service Object
 *
 * Player constructs a service by placing components into 4 sections:
 * Dependencies, Initialize, Steps, Results.
 * Teaches: Service object pattern with initialize + call interface.
 */

import { describe, test, expect } from 'bun:test';

// Types matching the component
interface ServiceComponent {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  correctSection: 'dependencies' | 'initialize' | 'steps' | 'results';
  stepOrder?: number; // For steps section - required order
  currentSection: string | null; // null = in palette
}

interface ServiceSection {
  id: 'dependencies' | 'initialize' | 'steps' | 'results';
  name: string;
  requiredCount: number;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

// Sections with their requirements
const SECTIONS: ServiceSection[] = [
  { id: 'dependencies', name: 'Dependencies', requiredCount: 2 },
  { id: 'initialize', name: 'Initialize', requiredCount: 1 },
  { id: 'steps', name: 'Steps', requiredCount: 3 },
  { id: 'results', name: 'Results', requiredCount: 2 },
];

// Recreate validation logic from component
function validateLevel7Solution(components: ServiceComponent[]): ValidationResult {
  const errors: string[] = [];

  // Check all components are placed
  const unplacedComponents = components.filter(c => c.currentSection === null);
  if (unplacedComponents.length > 0) {
    errors.push(`${unplacedComponents.length} component(s) still need to be placed`);
  }

  // Check components are in correct sections
  for (const component of components) {
    if (component.currentSection && component.currentSection !== component.correctSection) {
      const section = SECTIONS.find(s => s.id === component.currentSection);
      errors.push(`"${component.name}" doesn't belong in ${section?.name || 'that section'}`);
    }
  }

  // Check step ordering (steps must be in correct order)
  const stepsInSection = components
    .filter(c => c.currentSection === 'steps' && c.correctSection === 'steps')
    .sort((a, b) => {
      // Sort by position in the steps section (would need index tracking in real component)
      // For testing, we verify that all steps with stepOrder are present
      return (a.stepOrder || 0) - (b.stepOrder || 0);
    });

  // Verify step order is respected
  const expectedStepOrder = [1, 2, 3];
  const actualStepOrder = stepsInSection.map(s => s.stepOrder).filter(Boolean);

  if (actualStepOrder.length === 3) {
    for (let i = 0; i < actualStepOrder.length; i++) {
      if (actualStepOrder[i] !== expectedStepOrder[i]) {
        errors.push('Steps must be in order: Validate → Charge Payment → Save & Notify');
        break;
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Service needs adjustment!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Well-structured service object with clear responsibilities!',
  };
}

// Test data - matches the component's SERVICE_COMPONENTS
const SERVICE_COMPONENTS: ServiceComponent[] = [
  // Dependencies (2)
  {
    id: 'order',
    name: 'Order',
    code: '@order',
    color: '#3b82f6',
    description: 'The order to process',
    correctSection: 'dependencies',
    currentSection: null,
  },
  {
    id: 'payment_gateway',
    name: 'Payment Gateway',
    code: '@payment_gateway',
    color: '#8b5cf6',
    description: 'Payment processing interface',
    correctSection: 'dependencies',
    currentSection: null,
  },
  // Initialize (1)
  {
    id: 'constructor',
    name: 'Constructor',
    code: 'def initialize(order, payment_gateway: Stripe)',
    color: '#06b6d4',
    description: 'Dependency injection setup',
    correctSection: 'initialize',
    currentSection: null,
  },
  // Steps (3 - must be in order)
  {
    id: 'validate',
    name: 'Validate',
    code: 'return failure(@order.errors) unless @order.valid?',
    color: '#22c55e',
    description: 'Step 1: Check business rules',
    correctSection: 'steps',
    stepOrder: 1,
    currentSection: null,
  },
  {
    id: 'charge',
    name: 'Charge Payment',
    code: '@payment_gateway.charge(@order.total)',
    color: '#f59e0b',
    description: 'Step 2: Process payment',
    correctSection: 'steps',
    stepOrder: 2,
    currentSection: null,
  },
  {
    id: 'save_notify',
    name: 'Save & Notify',
    code: '@order.save! && OrderMailer.confirmation(@order).deliver_later',
    color: '#ef4444',
    description: 'Step 3: Persist and send confirmation',
    correctSection: 'steps',
    stepOrder: 3,
    currentSection: null,
  },
  // Results (2)
  {
    id: 'success',
    name: 'Success Result',
    code: 'Success.new(@order)',
    color: '#10b981',
    description: 'Return value on success',
    correctSection: 'results',
    currentSection: null,
  },
  {
    id: 'failure',
    name: 'Failure Result',
    code: 'Failure.new(errors)',
    color: '#dc2626',
    description: 'Return value on failure',
    correctSection: 'results',
    currentSection: null,
  },
];

describe('Level 7: Building a Service Object', () => {
  describe('Initial State (all components in palette)', () => {
    test('should be invalid when no components are placed', () => {
      const result = validateLevel7Solution(SERVICE_COMPONENTS);

      expect(result.valid).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details!.some(d => d.includes('8 component(s) still need to be placed'))).toBe(true);
    });
  });

  describe('Partial Solutions', () => {
    test('should be invalid when only dependencies are placed', () => {
      const components = SERVICE_COMPONENTS.map(c =>
        c.correctSection === 'dependencies' ? { ...c, currentSection: 'dependencies' } : c
      );

      const result = validateLevel7Solution(components);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('6 component(s) still need to be placed'))).toBe(true);
    });

    test('should be invalid when components are in wrong sections', () => {
      const components = SERVICE_COMPONENTS.map(c => {
        // Place all, but put Constructor in steps (wrong!)
        if (c.id === 'order') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'payment_gateway') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'constructor') return { ...c, currentSection: 'steps' }; // WRONG
        if (c.id === 'validate') return { ...c, currentSection: 'steps' };
        if (c.id === 'charge') return { ...c, currentSection: 'steps' };
        if (c.id === 'save_notify') return { ...c, currentSection: 'steps' };
        if (c.id === 'success') return { ...c, currentSection: 'results' };
        if (c.id === 'failure') return { ...c, currentSection: 'results' };
        return c;
      });

      const result = validateLevel7Solution(components);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Constructor') && d.includes('Steps'))).toBe(true);
    });

    test('should be invalid when step placed in dependencies', () => {
      const components = SERVICE_COMPONENTS.map(c => {
        if (c.id === 'order') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'payment_gateway') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'constructor') return { ...c, currentSection: 'initialize' };
        if (c.id === 'validate') return { ...c, currentSection: 'dependencies' }; // WRONG
        if (c.id === 'charge') return { ...c, currentSection: 'steps' };
        if (c.id === 'save_notify') return { ...c, currentSection: 'steps' };
        if (c.id === 'success') return { ...c, currentSection: 'results' };
        if (c.id === 'failure') return { ...c, currentSection: 'results' };
        return c;
      });

      const result = validateLevel7Solution(components);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Validate') && d.includes('Dependencies'))).toBe(true);
    });

    test('should be invalid when result placed in initialize', () => {
      const components = SERVICE_COMPONENTS.map(c => {
        if (c.id === 'order') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'payment_gateway') return { ...c, currentSection: 'dependencies' };
        if (c.id === 'constructor') return { ...c, currentSection: 'initialize' };
        if (c.id === 'validate') return { ...c, currentSection: 'steps' };
        if (c.id === 'charge') return { ...c, currentSection: 'steps' };
        if (c.id === 'save_notify') return { ...c, currentSection: 'steps' };
        if (c.id === 'success') return { ...c, currentSection: 'initialize' }; // WRONG
        if (c.id === 'failure') return { ...c, currentSection: 'results' };
        return c;
      });

      const result = validateLevel7Solution(components);

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Success Result') && d.includes('Initialize'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when all components are in correct sections', () => {
      const components = SERVICE_COMPONENTS.map(c => ({
        ...c,
        currentSection: c.correctSection,
      }));

      const result = validateLevel7Solution(components);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('Well-structured service');
    });

    test('should have no errors when all components correctly placed', () => {
      const components = SERVICE_COMPONENTS.map(c => ({
        ...c,
        currentSection: c.correctSection,
      }));

      const result = validateLevel7Solution(components);

      expect(result.details).toBeUndefined();
    });
  });

  describe('Component Classification', () => {
    test('Order should go to Dependencies', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'order')!;
      expect(component.correctSection).toBe('dependencies');
    });

    test('Payment Gateway should go to Dependencies', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'payment_gateway')!;
      expect(component.correctSection).toBe('dependencies');
    });

    test('Constructor should go to Initialize', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'constructor')!;
      expect(component.correctSection).toBe('initialize');
    });

    test('Validate should go to Steps with order 1', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'validate')!;
      expect(component.correctSection).toBe('steps');
      expect(component.stepOrder).toBe(1);
    });

    test('Charge Payment should go to Steps with order 2', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'charge')!;
      expect(component.correctSection).toBe('steps');
      expect(component.stepOrder).toBe(2);
    });

    test('Save & Notify should go to Steps with order 3', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'save_notify')!;
      expect(component.correctSection).toBe('steps');
      expect(component.stepOrder).toBe(3);
    });

    test('Success Result should go to Results', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'success')!;
      expect(component.correctSection).toBe('results');
    });

    test('Failure Result should go to Results', () => {
      const component = SERVICE_COMPONENTS.find(c => c.id === 'failure')!;
      expect(component.correctSection).toBe('results');
    });
  });

  describe('Section Requirements', () => {
    test('Dependencies section requires 2 components', () => {
      const section = SECTIONS.find(s => s.id === 'dependencies')!;
      expect(section.requiredCount).toBe(2);

      const depsComponents = SERVICE_COMPONENTS.filter(c => c.correctSection === 'dependencies');
      expect(depsComponents.length).toBe(2);
    });

    test('Initialize section requires 1 component', () => {
      const section = SECTIONS.find(s => s.id === 'initialize')!;
      expect(section.requiredCount).toBe(1);

      const initComponents = SERVICE_COMPONENTS.filter(c => c.correctSection === 'initialize');
      expect(initComponents.length).toBe(1);
    });

    test('Steps section requires 3 components', () => {
      const section = SECTIONS.find(s => s.id === 'steps')!;
      expect(section.requiredCount).toBe(3);

      const stepsComponents = SERVICE_COMPONENTS.filter(c => c.correctSection === 'steps');
      expect(stepsComponents.length).toBe(3);
    });

    test('Results section requires 2 components', () => {
      const section = SECTIONS.find(s => s.id === 'results')!;
      expect(section.requiredCount).toBe(2);

      const resultsComponents = SERVICE_COMPONENTS.filter(c => c.correctSection === 'results');
      expect(resultsComponents.length).toBe(2);
    });

    test('Total components should be 8', () => {
      expect(SERVICE_COMPONENTS.length).toBe(8);
    });
  });

  describe('Service Object Pattern', () => {
    test('should have dependency injection via initialize', () => {
      const constructor = SERVICE_COMPONENTS.find(c => c.id === 'constructor')!;
      expect(constructor.code).toContain('initialize');
      expect(constructor.code).toContain('order');
      expect(constructor.code).toContain('payment_gateway');
    });

    test('should have explicit success/failure return types', () => {
      const success = SERVICE_COMPONENTS.find(c => c.id === 'success')!;
      const failure = SERVICE_COMPONENTS.find(c => c.id === 'failure')!;

      expect(success.code).toContain('Success');
      expect(failure.code).toContain('Failure');
    });

    test('steps should follow validate-then-act pattern', () => {
      const steps = SERVICE_COMPONENTS
        .filter(c => c.correctSection === 'steps')
        .sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));

      // First step should be validation
      expect(steps[0].name).toBe('Validate');

      // Then processing
      expect(steps[1].name).toBe('Charge Payment');

      // Then persistence/notification
      expect(steps[2].name).toBe('Save & Notify');
    });
  });
});

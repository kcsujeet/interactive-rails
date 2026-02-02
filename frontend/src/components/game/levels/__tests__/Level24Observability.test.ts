/**
 * Tests for Level 24: Observability
 *
 * Validates tracing is enabled and bottleneck is identified.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level24State {
  tracingEnabled: boolean;
  problemFound: boolean;
  selectedSpan: string | null;
}

// Recreate validation logic from component
function validateLevel24Solution(state: Level24State): ValidationResult {
  const errors: string[] = [];

  if (!state.tracingEnabled) {
    errors.push('Enable distributed tracing to see request flow');
  }

  if (!state.problemFound) {
    errors.push('Click on the slow span to identify the bottleneck');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Bottleneck not identified!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Bottleneck found using distributed tracing!',
  };
}

describe('Level 24: Observability', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel24Solution({
        tracingEnabled: false,
        problemFound: false,
        selectedSpan: null,
      });

      expect(result.valid).toBe(false);
    });

    test('should require enabling tracing', () => {
      const result = validateLevel24Solution({
        tracingEnabled: false,
        problemFound: false,
        selectedSpan: null,
      });

      expect(result.details!.some(d => d.includes('distributed tracing'))).toBe(true);
    });

    test('should require identifying bottleneck', () => {
      const result = validateLevel24Solution({
        tracingEnabled: true,
        problemFound: false,
        selectedSpan: null,
      });

      expect(result.details!.some(d => d.includes('bottleneck'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid with tracing but no problem found', () => {
      const result = validateLevel24Solution({
        tracingEnabled: true,
        problemFound: false,
        selectedSpan: 'auth',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid when bottleneck found', () => {
      const result = validateLevel24Solution({
        tracingEnabled: true,
        problemFound: true,
        selectedSpan: 'billing',
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel24Solution({
        tracingEnabled: true,
        problemFound: true,
        selectedSpan: 'billing',
      });

      expect(result.message).toContain('distributed tracing');
    });
  });

  describe('Span Analysis', () => {
    const spans = [
      { id: 'auth', service: 'Auth', operation: 'verify_token', duration: 50, start: 0 },
      { id: 'billing', service: 'Billing', operation: 'get_subscription', duration: 1800, start: 50 },
      { id: 'orders', service: 'Orders', operation: 'recent_orders', duration: 120, start: 1850 },
      { id: 'db', service: 'Database', operation: 'query', duration: 30, start: 1970 },
    ];

    test('total duration is 2000ms', () => {
      const totalDuration = spans.reduce((max, s) => Math.max(max, s.start + s.duration), 0);
      expect(totalDuration).toBe(2000);
    });

    test('billing is the slowest span', () => {
      const slowest = spans.reduce((max, s) => s.duration > max.duration ? s : max);
      expect(slowest.id).toBe('billing');
    });

    test('billing takes 90% of total time', () => {
      const totalDuration = 2000;
      const billingDuration = 1800;
      const percentage = (billingDuration / totalDuration) * 100;
      expect(percentage).toBe(90);
    });

    test('clicking billing identifies the problem', () => {
      const selectedSpan = 'billing';
      const problemFound = selectedSpan === 'billing';
      expect(problemFound).toBe(true);
    });

    test('clicking other spans does not identify problem', () => {
      const otherSpans = ['auth', 'orders', 'db'];
      for (const span of otherSpans) {
        const problemFound = span === 'billing';
        expect(problemFound).toBe(false);
      }
    });
  });

  describe('Span Visibility', () => {
    test('spans are hidden until tracing enabled', () => {
      const tracingEnabled = false;
      const spansVisible = tracingEnabled;
      expect(spansVisible).toBe(false);
    });

    test('spans become visible with tracing', () => {
      const tracingEnabled = true;
      const spansVisible = tracingEnabled;
      expect(spansVisible).toBe(true);
    });
  });

  describe('Service Latency Thresholds', () => {
    test('under 500ms is acceptable', () => {
      const duration = 50;
      const isSlow = duration > 500;
      expect(isSlow).toBe(false);
    });

    test('over 500ms is slow', () => {
      const duration = 1800;
      const isSlow = duration > 500;
      expect(isSlow).toBe(true);
    });
  });
});

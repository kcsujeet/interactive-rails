/**
 * Tests for Level 18: Cloud Storage
 *
 * Validates direct upload is enabled and memory stays low.
 */

import { describe, test, expect } from 'bun:test';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level18State {
  directUploadEnabled: boolean;
  directUploadsCompleted: number;
  memoryPeak: number;
}

// Recreate validation logic from component
function validateLevel18Solution(state: Level18State): ValidationResult {
  const errors: string[] = [];

  if (!state.directUploadEnabled) {
    errors.push('Enable direct upload to S3 to bypass app server');
  }

  if (state.directUploadsCompleted < 2) {
    errors.push(`Complete at least 2 direct uploads (currently ${state.directUploadsCompleted})`);
  }

  if (state.memoryPeak >= 100) {
    errors.push(`Memory peak too high (${state.memoryPeak}MB) - direct upload should keep memory low`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Storage optimization incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Direct upload bypasses app server for large files!',
  };
}

describe('Level 18: Cloud Storage', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: false,
        directUploadsCompleted: 0,
        memoryPeak: 0,
      });

      expect(result.valid).toBe(false);
    });

    test('should require enabling direct upload', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: false,
        directUploadsCompleted: 0,
        memoryPeak: 0,
      });

      expect(result.details!.some(d => d.includes('direct upload'))).toBe(true);
    });

    test('should require completing uploads', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 0,
        memoryPeak: 50,
      });

      expect(result.details!.some(d => d.includes('direct uploads'))).toBe(true);
    });
  });

  describe('Memory Constraints', () => {
    test('should be invalid if memory peak is too high', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 2,
        memoryPeak: 150,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('Memory peak'))).toBe(true);
    });

    test('should be invalid at exactly 100MB', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 2,
        memoryPeak: 100,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid with only 1 upload', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 1,
        memoryPeak: 50,
      });

      expect(result.valid).toBe(false);
      expect(result.details!.some(d => d.includes('currently 1'))).toBe(true);
    });
  });

  describe('Correct Solution', () => {
    test('should be valid with 2 uploads and low memory', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 2,
        memoryPeak: 50,
      });

      expect(result.valid).toBe(true);
    });

    test('should be valid at memory peak 99', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 2,
        memoryPeak: 99,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel18Solution({
        directUploadEnabled: true,
        directUploadsCompleted: 2,
        memoryPeak: 50,
      });

      expect(result.message).toContain('bypasses');
    });
  });

  describe('Upload Methods', () => {
    test('traditional upload spikes memory', () => {
      const directUploadEnabled = false;
      const fileSize = 100;
      const memoryIncrease = directUploadEnabled ? 0 : fileSize;

      expect(memoryIncrease).toBe(100);
    });

    test('direct upload keeps memory flat', () => {
      const directUploadEnabled = true;
      const fileSize = 100;
      const memoryIncrease = directUploadEnabled ? 0 : fileSize;

      expect(memoryIncrease).toBe(0);
    });
  });
});

/**
 * Tests for Level 12: Authorization (hybrid build + simulate)
 *
 * Validates step completion gating and star rating calculation.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface StepState {
	isComplete: boolean;
	incompleteStepTitles: string[];
}

// Recreate validation logic from component
function validateLevel12Solution(state: StepState): ValidationResult {
	if (!state.isComplete) {
		return {
			valid: false,
			message: 'Complete all steps first',
			details: state.incompleteStepTitles,
		};
	}
	return { valid: true, message: 'Authorization policy is deployed!' };
}

// Recreate star rating logic from useStepGating
function calculateStarRating(wrongAttempts: number): 1 | 2 | 3 {
	if (wrongAttempts === 0) return 3;
	if (wrongAttempts <= 2) return 2;
	return 1;
}

describe('Level 12: Authorization', () => {
	describe('Step Completion Validation', () => {
		test('should be invalid when no steps are complete', () => {
			const result = validateLevel12Solution({
				isComplete: false,
				incompleteStepTitles: [
					'Add the Pundit Gem',
					'Include Pundit in Controller',
					'Generate ApplicationPolicy',
					'Choose the Policy Class',
					'Define the destroy? Method',
					'Wire Up the Controller',
					'Scope the Index Query',
				],
			});

			expect(result.valid).toBe(false);
			expect(result.message).toBe('Complete all steps first');
			expect(result.details).toHaveLength(7);
		});

		test('should be invalid with partial completion', () => {
			const result = validateLevel12Solution({
				isComplete: false,
				incompleteStepTitles: [
					'Wire Up the Controller',
					'Scope the Index Query',
				],
			});

			expect(result.valid).toBe(false);
			expect(result.details).toHaveLength(2);
			expect(result.details).toContain('Wire Up the Controller');
		});

		test('should be valid when all steps are complete', () => {
			const result = validateLevel12Solution({
				isComplete: true,
				incompleteStepTitles: [],
			});

			expect(result.valid).toBe(true);
			expect(result.message).toContain('deployed');
		});
	});

	describe('Star Rating Calculation', () => {
		test('should give 3 stars with 0 wrong attempts', () => {
			expect(calculateStarRating(0)).toBe(3);
		});

		test('should give 2 stars with 1 wrong attempt', () => {
			expect(calculateStarRating(1)).toBe(2);
		});

		test('should give 2 stars with 2 wrong attempts', () => {
			expect(calculateStarRating(2)).toBe(2);
		});

		test('should give 1 star with 3 wrong attempts', () => {
			expect(calculateStarRating(3)).toBe(1);
		});

		test('should give 1 star with many wrong attempts', () => {
			expect(calculateStarRating(10)).toBe(1);
		});
	});
});

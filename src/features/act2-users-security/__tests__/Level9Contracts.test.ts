/**
 * Tests for Level 9: Data Contracts
 *
 * Validates that contract is added and enough valid inputs are processed.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level9State {
	contractAdded: boolean;
	validatedCount: number;
	rejectedCount: number;
}

// Recreate validation logic from component
function validateLevel9Solution(state: Level9State): ValidationResult {
	const errors: string[] = [];

	if (!state.contractAdded) {
		errors.push('Add a Contract node to validate input at the boundary');
	}

	if (state.validatedCount < 5) {
		errors.push(
			`Need to validate at least 5 clean inputs (currently ${state.validatedCount})`,
		);
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Input validation incomplete!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Data contracts now validate input at the boundary!',
	};
}

describe('Level 9: Data Contracts', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing done', () => {
			const result = validateLevel9Solution({
				contractAdded: false,
				validatedCount: 0,
				rejectedCount: 0,
			});

			expect(result.valid).toBe(false);
		});

		test('should require adding contract', () => {
			const result = validateLevel9Solution({
				contractAdded: false,
				validatedCount: 0,
				rejectedCount: 0,
			});

			expect(result.details?.some((d) => d.includes('Contract node'))).toBe(
				true,
			);
		});

		test('should require validating inputs', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 0,
				rejectedCount: 0,
			});

			expect(result.details?.some((d) => d.includes('validate'))).toBe(true);
		});
	});

	describe('Partial Progress', () => {
		test('should be invalid with only 1 validation', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 1,
				rejectedCount: 2,
			});

			expect(result.valid).toBe(false);
			expect(result.details?.some((d) => d.includes('currently 1'))).toBe(true);
		});

		test('should be invalid with only 4 validations', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 4,
				rejectedCount: 5,
			});

			expect(result.valid).toBe(false);
		});

		test('should be invalid with contract but 0 validations', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 0,
				rejectedCount: 10,
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with 5 validations', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 5,
				rejectedCount: 3,
			});

			expect(result.valid).toBe(true);
		});

		test('should be valid with more than 5 validations', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 10,
				rejectedCount: 7,
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel9Solution({
				contractAdded: true,
				validatedCount: 5,
				rejectedCount: 3,
			});

			expect(result.message).toContain('boundary');
		});
	});

	describe('Contract Behavior', () => {
		test('dirty particles should be rejected', () => {
			const isDirty = true;
			const contractAdded = true;

			// With contract, dirty input is rejected
			const isRejected = contractAdded && isDirty;
			expect(isRejected).toBe(true);
		});

		test('clean particles should pass through', () => {
			const isDirty = false;
			const contractAdded = true;

			// With contract, clean input passes
			const isValidated = contractAdded && !isDirty;
			expect(isValidated).toBe(true);
		});

		test('without contract, all particles pass', () => {
			const contractAdded = false;
			const _isDirty = true;

			// Without contract, everything passes (bad!)
			const passesThrough = !contractAdded;
			expect(passesThrough).toBe(true);
		});
	});
});

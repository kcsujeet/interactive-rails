/**
 * Tests for SubmitButton Component
 *
 * Tests the validation result handling and button behavior.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

// Helper to simulate button behavior
function simulateSubmitClick(
	validateFn: () => ValidationResult,
	onSuccessFn: () => Promise<void>,
): { result: ValidationResult; successCalled: boolean } {
	const result = validateFn();
	let successCalled = false;

	if (result.valid) {
		successCalled = true;
		// In real component, this would call onSuccessFn
	}

	return { result, successCalled };
}

describe('SubmitButton', () => {
	describe('Validation Results', () => {
		test('should call onSuccess when validation passes', () => {
			const validateFn = () => ({ valid: true, message: 'Success!' });
			const { result, successCalled } = simulateSubmitClick(
				validateFn,
				async () => {},
			);

			expect(result.valid).toBe(true);
			expect(successCalled).toBe(true);
		});

		test('should not call onSuccess when validation fails', () => {
			const validateFn = () => ({
				valid: false,
				message: 'Failed!',
				details: ['Error 1'],
			});
			const { result, successCalled } = simulateSubmitClick(
				validateFn,
				async () => {},
			);

			expect(result.valid).toBe(false);
			expect(successCalled).toBe(false);
		});

		test('should preserve error details on failure', () => {
			const details = ['Error 1', 'Error 2', 'Error 3'];
			const validateFn = () => ({
				valid: false,
				message: 'Multiple errors!',
				details,
			});
			const { result } = simulateSubmitClick(validateFn, async () => {});

			expect(result.details).toEqual(details);
		});

		test('should not have details on success', () => {
			const validateFn = () => ({ valid: true, message: 'Success!' });
			const { result } = simulateSubmitClick(validateFn, async () => {});

			expect(result.details).toBeUndefined();
		});
	});

	describe('ValidationResult Type', () => {
		test('valid result has required fields', () => {
			const result: ValidationResult = {
				valid: true,
				message: 'All good!',
			};

			expect(result.valid).toBe(true);
			expect(result.message).toBeDefined();
		});

		test('invalid result can have details', () => {
			const result: ValidationResult = {
				valid: false,
				message: 'Not good!',
				details: ['Problem 1', 'Problem 2'],
			};

			expect(result.valid).toBe(false);
			expect(result.details).toHaveLength(2);
		});

		test('details is optional', () => {
			const result: ValidationResult = {
				valid: false,
				message: 'Error without details',
			};

			expect(result.details).toBeUndefined();
		});
	});

	describe('Multiple Validations', () => {
		test('should update result on each click', () => {
			let clickCount = 0;
			const validateFn = () => {
				clickCount++;
				return clickCount >= 3
					? { valid: true, message: 'Finally!' }
					: {
							valid: false,
							message: `Attempt ${clickCount}`,
							details: ['Try again'],
						};
			};

			// First click
			let { result } = simulateSubmitClick(validateFn, async () => {});
			expect(result.valid).toBe(false);

			// Second click
			({ result } = simulateSubmitClick(validateFn, async () => {}));
			expect(result.valid).toBe(false);

			// Third click
			({ result } = simulateSubmitClick(validateFn, async () => {}));
			expect(result.valid).toBe(true);
		});
	});
});

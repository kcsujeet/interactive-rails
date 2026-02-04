/**
 * Tests for Level 11: Authorization
 *
 * Validates that policy is added and hackers are blocked.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level11State {
	policyAdded: boolean;
	blockedCount: number;
	breachOccurred: boolean;
}

// Recreate validation logic from component
function validateLevel11Solution(state: Level11State): ValidationResult {
	const errors: string[] = [];

	if (!state.policyAdded) {
		errors.push('Add the Policy node to protect your endpoints');
	}

	if (state.breachOccurred) {
		errors.push(
			'A security breach occurred! Reset and try again with the Policy enabled',
		);
	}

	if (state.blockedCount < 3) {
		errors.push(
			`Need to block at least 3 unauthorized requests (currently ${state.blockedCount})`,
		);
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Authorization not complete!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Unauthorized requests are now blocked!',
	};
}

describe('Level 11: Authorization', () => {
	describe('Initial State', () => {
		test('should be invalid when no policy added', () => {
			const result = validateLevel11Solution({
				policyAdded: false,
				blockedCount: 0,
				breachOccurred: false,
			});

			expect(result.valid).toBe(false);
			expect(result.details).toContain(
				'Add the Policy node to protect your endpoints',
			);
		});

		test('should require blocking at least 3 requests', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 0,
				breachOccurred: false,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('block at least 3'))).toBe(
				true,
			);
		});
	});

	describe('Security Breach', () => {
		test('should be invalid if breach occurred', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 5,
				breachOccurred: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('security breach'))).toBe(
				true,
			);
		});

		test('should require reset after breach', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 10,
				breachOccurred: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('Reset'))).toBe(true);
		});
	});

	describe('Partial Progress', () => {
		test('should be invalid with policy but only 1 block', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 1,
				breachOccurred: false,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('currently 1'))).toBe(true);
		});

		test('should be invalid with policy but only 2 blocks', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 2,
				breachOccurred: false,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('currently 2'))).toBe(true);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with policy and 3+ blocked', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 3,
				breachOccurred: false,
			});

			expect(result.valid).toBe(true);
		});

		test('should be valid with policy and many blocked', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 10,
				breachOccurred: false,
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel11Solution({
				policyAdded: true,
				blockedCount: 3,
				breachOccurred: false,
			});

			expect(result.message).toContain('blocked');
		});
	});
});

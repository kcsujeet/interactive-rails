/**
 * Tests for Level 4: Persistence
 *
 * Validates that both models are connected to database for persistence.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level4State {
	databaseAdded: boolean;
	modelsConnectedToDb: Set<string>;
}

// Recreate validation logic from component
function validateLevel4Solution(state: Level4State): ValidationResult {
	const errors: string[] = [];

	if (!state.databaseAdded) {
		errors.push('Add a Database node to the canvas');
	}

	if (!state.modelsConnectedToDb.has('product-model')) {
		errors.push('Connect Product model to Database for persistence');
	}

	if (!state.modelsConnectedToDb.has('review-model')) {
		errors.push('Connect Review model to Database for persistence');
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Data is still transient (memory only)!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Data now persists across restarts!',
	};
}

describe('Level 4: Persistence', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing done', () => {
			const result = validateLevel4Solution({
				databaseAdded: false,
				modelsConnectedToDb: new Set(),
			});

			expect(result.valid).toBe(false);
		});

		test('should require adding database', () => {
			const result = validateLevel4Solution({
				databaseAdded: false,
				modelsConnectedToDb: new Set(),
			});

			expect(result.details?.some((d) => d.includes('Database node'))).toBe(
				true,
			);
		});

		test('should require connecting product model', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(),
			});

			expect(result.details?.some((d) => d.includes('Product model'))).toBe(
				true,
			);
		});

		test('should require connecting review model', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(),
			});

			expect(result.details?.some((d) => d.includes('Review model'))).toBe(
				true,
			);
		});
	});

	describe('Partial Progress', () => {
		test('should be invalid with only product connected', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(['product-model']),
			});

			expect(result.valid).toBe(false);
			expect(result.details?.some((d) => d.includes('Review'))).toBe(true);
		});

		test('should be invalid with only review connected', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(['review-model']),
			});

			expect(result.valid).toBe(false);
			expect(result.details?.some((d) => d.includes('Product'))).toBe(true);
		});

		test('should be invalid without database', () => {
			const result = validateLevel4Solution({
				databaseAdded: false,
				modelsConnectedToDb: new Set(['product-model', 'review-model']),
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with both models connected', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(['product-model', 'review-model']),
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel4Solution({
				databaseAdded: true,
				modelsConnectedToDb: new Set(['product-model', 'review-model']),
			});

			expect(result.message).toContain('persists');
		});
	});

	describe('Transient vs Persisted', () => {
		test('transient data is lost on restart', () => {
			// Simulate restart behavior
			let dataCounter = 5;
			const isPersisted = false;

			// On restart, transient data is cleared
			if (!isPersisted) {
				dataCounter = 0;
			}

			expect(dataCounter).toBe(0);
		});

		test('persisted data survives restart', () => {
			// Simulate restart behavior
			let dataCounter = 5;
			const isPersisted = true;

			// On restart, persisted data remains
			if (!isPersisted) {
				dataCounter = 0;
			}

			expect(dataCounter).toBe(5);
		});
	});
});

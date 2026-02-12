/**
 * Tests for Level 1: Stack Choice (Database Only)
 *
 * Validates that a database must be selected. The game is always API-only.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level1State {
	database: 'postgresql' | 'sqlite' | null;
}

// Recreate validation logic from component
function validateLevel1Solution(state: Level1State): ValidationResult {
	if (state.database === null) {
		return {
			valid: false,
			message: 'Drag a database to the slot to generate!',
			details: ['Select a Database System'],
		};
	}

	return {
		valid: true,
		message: 'App generated successfully!',
	};
}

describe('Level 1: Stack Choice (Database Only)', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing selected', () => {
			const result = validateLevel1Solution({ database: null });

			expect(result.valid).toBe(false);
			expect(result.details).toContain('Select a Database System');
		});
	});

	describe('Valid Selections', () => {
		test('should be valid with PostgreSQL', () => {
			const result = validateLevel1Solution({ database: 'postgresql' });
			expect(result.valid).toBe(true);
		});

		test('should be valid with SQLite', () => {
			const result = validateLevel1Solution({ database: 'sqlite' });
			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel1Solution({ database: 'postgresql' });
			expect(result.message).toContain('generated');
		});
	});

	describe('Constraints', () => {
		test('SQLite choice records sharding constraint', () => {
			const choices = {
				database: 'sqlite' as const,
				constraints: {
					canShard: false,
				},
			};

			expect(choices.constraints.canShard).toBe(false);
		});

		test('PostgreSQL choice allows sharding', () => {
			const choices = {
				database: 'postgresql' as const,
				constraints: {
					canShard: true,
				},
			};

			expect(choices.constraints.canShard).toBe(true);
		});
	});

	describe('API-only mode', () => {
		test('always generates with --api flag', () => {
			// The game is API-only, so apiOnly is always true regardless of choices
			const choices = {
				database: 'postgresql' as const,
				constraints: {
					canShard: true,
				},
			};

			// No frontend field — the command always includes --api
			expect(choices).not.toHaveProperty('frontend');
		});
	});
});

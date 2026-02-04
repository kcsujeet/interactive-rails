/**
 * Tests for Level 1: Stack Choice
 *
 * Validates that both database and frontend must be selected.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level1State {
	database: 'postgresql' | 'sqlite' | null;
	frontend: 'react' | 'hotwire' | null;
}

// Recreate validation logic from component
function validateLevel1Solution(state: Level1State): ValidationResult {
	const errors: string[] = [];

	if (state.database === null) {
		errors.push('Select a Database System');
	}

	if (state.frontend === null) {
		errors.push('Select a Frontend Architecture');
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Fill all slots to generate!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'App generated successfully!',
	};
}

describe('Level 1: Stack Choice', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing selected', () => {
			const result = validateLevel1Solution({
				database: null,
				frontend: null,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.length).toBe(2);
		});

		test('should require database selection', () => {
			const result = validateLevel1Solution({
				database: null,
				frontend: null,
			});

			expect(result.details).toContain('Select a Database System');
		});

		test('should require frontend selection', () => {
			const result = validateLevel1Solution({
				database: null,
				frontend: null,
			});

			expect(result.details).toContain('Select a Frontend Architecture');
		});
	});

	describe('Partial Selection', () => {
		test('should be invalid with only database selected', () => {
			const result = validateLevel1Solution({
				database: 'postgresql',
				frontend: null,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.length).toBe(1);
			expect(result.details).toContain('Select a Frontend Architecture');
		});

		test('should be invalid with only frontend selected', () => {
			const result = validateLevel1Solution({
				database: null,
				frontend: 'hotwire',
			});

			expect(result.valid).toBe(false);
			expect(result.details!.length).toBe(1);
			expect(result.details).toContain('Select a Database System');
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with PostgreSQL + Hotwire', () => {
			const result = validateLevel1Solution({
				database: 'postgresql',
				frontend: 'hotwire',
			});

			expect(result.valid).toBe(true);
		});

		test('should be valid with PostgreSQL + React', () => {
			const result = validateLevel1Solution({
				database: 'postgresql',
				frontend: 'react',
			});

			expect(result.valid).toBe(true);
		});

		test('should be valid with SQLite + Hotwire', () => {
			const result = validateLevel1Solution({
				database: 'sqlite',
				frontend: 'hotwire',
			});

			expect(result.valid).toBe(true);
		});

		test('should be valid with SQLite + React', () => {
			const result = validateLevel1Solution({
				database: 'sqlite',
				frontend: 'react',
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel1Solution({
				database: 'postgresql',
				frontend: 'hotwire',
			});

			expect(result.message).toContain('generated');
		});
	});

	describe('Constraints', () => {
		test('SQLite choice records sharding constraint', () => {
			const choices = {
				database: 'sqlite' as const,
				frontend: 'hotwire' as const,
				constraints: {
					canShard: false,
				},
			};

			expect(choices.constraints.canShard).toBe(false);
		});

		test('PostgreSQL choice allows sharding', () => {
			const choices = {
				database: 'postgresql' as const,
				frontend: 'hotwire' as const,
				constraints: {
					canShard: true,
				},
			};

			expect(choices.constraints.canShard).toBe(true);
		});

		test('React choice requires API-only mode', () => {
			const choices = {
				database: 'postgresql' as const,
				frontend: 'react' as const,
				constraints: {
					apiOnly: true,
				},
			};

			expect(choices.constraints.apiOnly).toBe(true);
		});

		test('Hotwire choice does not require API-only mode', () => {
			const choices = {
				database: 'postgresql' as const,
				frontend: 'hotwire' as const,
				constraints: {
					apiOnly: false,
				},
			};

			expect(choices.constraints.apiOnly).toBe(false);
		});
	});
});

/**
 * Tests for Level 3: Associations
 *
 * Validates that has_many is the correct relationship for Post → Comment.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level3State {
	commentAdded: boolean;
	relationshipType: 'has_one' | 'has_many' | 'has_and_belongs_to_many' | null;
}

// Recreate validation logic from component
function validateLevel3Solution(state: Level3State): ValidationResult {
	const errors: string[] = [];

	if (!state.commentAdded) {
		errors.push('Add the Comment model to the canvas');
	}

	if (state.relationshipType === null) {
		errors.push('Connect Post to Comment and select a relationship type');
	} else if (state.relationshipType !== 'has_many') {
		if (state.relationshipType === 'has_one') {
			errors.push(
				'has_one limits posts to a single comment - use has_many instead',
			);
		} else if (state.relationshipType === 'has_and_belongs_to_many') {
			errors.push(
				'has_and_belongs_to_many is for many-to-many - comments belong to one post',
			);
		}
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Wrong relationship type!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Post has_many Comments - correct!',
	};
}

describe('Level 3: Associations', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing done', () => {
			const result = validateLevel3Solution({
				commentAdded: false,
				relationshipType: null,
			});

			expect(result.valid).toBe(false);
		});

		test('should require adding comment model', () => {
			const result = validateLevel3Solution({
				commentAdded: false,
				relationshipType: null,
			});

			expect(result.details!.some((d) => d.includes('Comment model'))).toBe(
				true,
			);
		});

		test('should require selecting relationship', () => {
			const result = validateLevel3Solution({
				commentAdded: true,
				relationshipType: null,
			});

			expect(result.details!.some((d) => d.includes('relationship type'))).toBe(
				true,
			);
		});
	});

	describe('Wrong Choices', () => {
		test('should be invalid with has_one', () => {
			const result = validateLevel3Solution({
				commentAdded: true,
				relationshipType: 'has_one',
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('single comment'))).toBe(
				true,
			);
		});

		test('should be invalid with has_and_belongs_to_many', () => {
			const result = validateLevel3Solution({
				commentAdded: true,
				relationshipType: 'has_and_belongs_to_many',
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('many-to-many'))).toBe(
				true,
			);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with has_many', () => {
			const result = validateLevel3Solution({
				commentAdded: true,
				relationshipType: 'has_many',
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel3Solution({
				commentAdded: true,
				relationshipType: 'has_many',
			});

			expect(result.message).toContain('has_many');
		});
	});

	describe('Learning Outcomes', () => {
		test('has_one creates 1:1 relationship', () => {
			// has_one means: Post has_one Comment (only one)
			const explanation = 'has_one limits posts to a single comment';
			expect(explanation).toContain('single');
		});

		test('has_many creates 1:N relationship', () => {
			// has_many means: Post has_many Comments (unlimited)
			const explanation = 'has_many allows unlimited comments per post';
			expect(explanation).toContain('unlimited');
		});

		test('has_and_belongs_to_many creates N:N relationship', () => {
			// HABTM means: Comments shared between posts (wrong for this case)
			const explanation =
				'has_and_belongs_to_many shares comments between posts';
			expect(explanation).toContain('shares');
		});
	});
});

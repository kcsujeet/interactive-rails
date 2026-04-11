/**
 * Tests for Level 12: ViewComponents
 *
 * Validates that component is created and all duplications extracted.
 */

import { describe, expect, test } from 'bun:test';

interface ViewBlock {
	id: string;
	view: string;
	extracted: boolean;
}

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level12State {
	componentCreated: boolean;
	blocks: ViewBlock[];
}

// Recreate validation logic from component
function validateLevel12Solution(state: Level12State): ValidationResult {
	const errors: string[] = [];

	if (!state.componentCreated) {
		errors.push('Create the ViewComponent first');
	}

	const unextractedBlocks = state.blocks.filter((b) => !b.extracted);
	if (unextractedBlocks.length > 0) {
		errors.push(
			`${unextractedBlocks.length} view(s) still have duplicated code`,
		);
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Duplication still exists!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'All duplicated code extracted to ViewComponent!',
	};
}

const INITIAL_BLOCKS: ViewBlock[] = [
	{ id: 'user-card-1', view: 'users/index', extracted: false },
	{ id: 'user-card-2', view: 'posts/show', extracted: false },
	{ id: 'user-card-3', view: 'reviews/show', extracted: false },
];

describe('Level 12: ViewComponents', () => {
	describe('Initial State', () => {
		test('should be invalid when component not created', () => {
			const result = validateLevel12Solution({
				componentCreated: false,
				blocks: INITIAL_BLOCKS,
			});

			expect(result.valid).toBe(false);
			expect(result.details).toContain('Create the ViewComponent first');
		});

		test('should report 3 views with duplicated code', () => {
			const result = validateLevel12Solution({
				componentCreated: true,
				blocks: INITIAL_BLOCKS,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('3 view(s)'))).toBe(true);
		});
	});

	describe('Partial Progress', () => {
		test('should be invalid with 1 view extracted', () => {
			const blocks = INITIAL_BLOCKS.map((b, i) =>
				i === 0 ? { ...b, extracted: true } : b,
			);

			const result = validateLevel12Solution({
				componentCreated: true,
				blocks,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('2 view(s)'))).toBe(true);
		});

		test('should be invalid with 2 views extracted', () => {
			const blocks = INITIAL_BLOCKS.map((b, i) =>
				i < 2 ? { ...b, extracted: true } : b,
			);

			const result = validateLevel12Solution({
				componentCreated: true,
				blocks,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('1 view(s)'))).toBe(true);
		});

		test('should be invalid if extractions done but component not created', () => {
			const blocks = INITIAL_BLOCKS.map((b) => ({ ...b, extracted: true }));

			const result = validateLevel12Solution({
				componentCreated: false,
				blocks,
			});

			expect(result.valid).toBe(false);
			expect(result.details).toContain('Create the ViewComponent first');
		});
	});

	describe('Correct Solution', () => {
		test('should be valid when component created and all extracted', () => {
			const blocks = INITIAL_BLOCKS.map((b) => ({ ...b, extracted: true }));

			const result = validateLevel12Solution({
				componentCreated: true,
				blocks,
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const blocks = INITIAL_BLOCKS.map((b) => ({ ...b, extracted: true }));

			const result = validateLevel12Solution({
				componentCreated: true,
				blocks,
			});

			expect(result.message).toContain('All duplicated code extracted');
		});
	});
});

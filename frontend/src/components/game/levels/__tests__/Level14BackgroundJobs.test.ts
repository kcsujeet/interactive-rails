/**
 * Tests for Level 14: Background Jobs
 *
 * Validates that users experience blocking first, then async processing.
 */

import { describe, expect, test } from 'bun:test';

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

interface Level14State {
	workerEnabled: boolean;
	completedJobs: number;
	requestTime: number | null;
	experiencedBlocking: boolean;
}

// Recreate validation logic from component
function validateLevel14Solution(state: Level14State): ValidationResult {
	const errors: string[] = [];

	if (!state.experiencedBlocking) {
		errors.push(
			'Generate a PDF WITHOUT the worker first to see the blocking behavior',
		);
	}

	if (!state.workerEnabled) {
		errors.push('Enable the Background Worker');
	}

	if (state.completedJobs < 2) {
		errors.push(
			`Complete at least 2 background jobs (currently ${state.completedJobs})`,
		);
	}

	if (
		state.workerEnabled &&
		state.requestTime !== null &&
		state.requestTime > 500
	) {
		errors.push(
			'Response time too slow - background jobs should return instantly',
		);
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Background processing not complete!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Jobs now process in the background!',
	};
}

describe('Level 14: Background Jobs', () => {
	describe('Initial State', () => {
		test('should be invalid when nothing done', () => {
			const result = validateLevel14Solution({
				workerEnabled: false,
				completedJobs: 0,
				requestTime: null,
				experiencedBlocking: false,
			});

			expect(result.valid).toBe(false);
		});

		test('should require experiencing blocking first', () => {
			const result = validateLevel14Solution({
				workerEnabled: false,
				completedJobs: 0,
				requestTime: null,
				experiencedBlocking: false,
			});

			expect(result.details!.some((d) => d.includes('blocking behavior'))).toBe(
				true,
			);
		});

		test('should require enabling worker', () => {
			const result = validateLevel14Solution({
				workerEnabled: false,
				completedJobs: 0,
				requestTime: null,
				experiencedBlocking: true,
			});

			expect(result.details).toContain('Enable the Background Worker');
		});
	});

	describe('Partial Progress', () => {
		test('should be invalid if only experienced blocking', () => {
			const result = validateLevel14Solution({
				workerEnabled: false,
				completedJobs: 0,
				requestTime: 5000,
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('blocking'))).toBe(false);
		});

		test('should be invalid with worker but no jobs completed', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 0,
				requestTime: 20,
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('currently 0'))).toBe(true);
		});

		test('should be invalid with only 1 job completed', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 1,
				requestTime: 20,
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('currently 1'))).toBe(true);
		});
	});

	describe('Response Time Check', () => {
		test('should warn if response time is too slow with worker', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 3,
				requestTime: 1000, // Too slow
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(false);
			expect(result.details!.some((d) => d.includes('too slow'))).toBe(true);
		});

		test('should not check response time when worker disabled', () => {
			const result = validateLevel14Solution({
				workerEnabled: false,
				completedJobs: 0,
				requestTime: 5000, // Slow, but worker not enabled
				experiencedBlocking: true,
			});

			expect(result.details!.some((d) => d.includes('too slow'))).toBe(false);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid with all conditions met', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 3,
				requestTime: 20,
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(true);
		});

		test('should accept fast response times', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 2,
				requestTime: 50,
				experiencedBlocking: true,
			});

			expect(result.valid).toBe(true);
		});

		test('should have correct success message', () => {
			const result = validateLevel14Solution({
				workerEnabled: true,
				completedJobs: 2,
				requestTime: 20,
				experiencedBlocking: true,
			});

			expect(result.message).toContain('background');
		});
	});

	describe('Learning Flow', () => {
		test('typical flow: blocking -> enable worker -> complete jobs', () => {
			// Step 1: Experience blocking
			let state: Level14State = {
				workerEnabled: false,
				completedJobs: 0,
				requestTime: 5000,
				experiencedBlocking: true,
			};
			expect(validateLevel14Solution(state).valid).toBe(false);

			// Step 2: Enable worker
			state = { ...state, workerEnabled: true, requestTime: 20 };
			expect(validateLevel14Solution(state).valid).toBe(false);

			// Step 3: Complete jobs
			state = { ...state, completedJobs: 2 };
			expect(validateLevel14Solution(state).valid).toBe(true);
		});
	});
});

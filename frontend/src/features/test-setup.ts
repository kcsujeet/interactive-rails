/**
 * Test setup for level components
 */

// Mock React hooks for testing
export const mockUseState = <T>(
	initial: T,
): [T, (val: T | ((prev: T) => T)) => void] => {
	let state = initial;
	const setState = (val: T | ((prev: T) => T)) => {
		if (typeof val === 'function') {
			state = (val as (prev: T) => T)(state);
		} else {
			state = val;
		}
	};
	return [state, setState];
};

// Mock level completion hook
export const mockCompleteLevel = async (
	levelId: string,
	data: { stars: number },
) => {
	return true;
};

// Helper to create validation result
export interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

// Common test utilities
export const expectValid = (result: ValidationResult) => {
	if (!result.valid) {
		throw new Error(
			`Expected valid but got: ${result.message} - ${result.details?.join(', ')}`,
		);
	}
};

export const expectInvalid = (
	result: ValidationResult,
	expectedDetails?: string[],
) => {
	if (result.valid) {
		throw new Error(`Expected invalid but got valid`);
	}
	if (expectedDetails) {
		for (const detail of expectedDetails) {
			if (!result.details?.some((d) => d.includes(detail))) {
				throw new Error(
					`Expected detail containing "${detail}" but got: ${result.details?.join(', ')}`,
				);
			}
		}
	}
};

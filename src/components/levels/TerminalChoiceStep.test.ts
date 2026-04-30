/**
 * Tests for TerminalChoiceStep
 *
 * Pure logic tests (no DOM) for the buildTerminalHistory helper.
 */

import { describe, expect, test } from 'bun:test';
import type { TerminalStepData } from './TerminalChoiceStep';
import { buildTerminalHistory } from './TerminalChoiceStep';

const STEP_1: TerminalStepData = {
	commands: [
		{
			id: 'wrong-1',
			label: 'wrong install',
			command: 'wrong install',
			correct: false,
			feedback: 'Wrong!',
		},
		{
			id: 'correct-1',
			label: 'correct install',
			command: 'brew install tool',
			correct: true,
		},
	],
	outputLines: [
		{ text: 'Installing...', color: 'cyan' },
		{ text: 'Done!', color: 'green' },
	],
};

const STEP_2: TerminalStepData = {
	commands: [
		{
			id: 'correct-2',
			label: 'correct config',
			command: 'tool configure',
			correct: true,
		},
		{
			id: 'wrong-2',
			label: 'wrong config',
			command: 'bad configure',
			correct: false,
			feedback: 'Nope!',
		},
	],
	outputLines: [{ text: 'Configured!', color: 'green' }],
};

const STEP_3: TerminalStepData = {
	commands: [
		{
			id: 'wrong-3',
			label: 'wrong check',
			command: 'bad check',
			correct: false,
			feedback: 'Not that one.',
		},
		{
			id: 'correct-3',
			label: 'correct check',
			command: 'tool --version',
			correct: true,
		},
	],
	outputLines: [{ text: 'v1.0.0', color: 'green' }],
};

describe('buildTerminalHistory', () => {
	describe('pure terminal levels (all steps are terminal)', () => {
		const ALL_STEPS: TerminalStepData[] = [STEP_1, STEP_2, STEP_3];

		test('returns empty history when on first step', () => {
			const history = buildTerminalHistory(ALL_STEPS, 0);
			expect(history).toEqual([]);
		});

		test('includes correct command from step 1 when on step 2', () => {
			const history = buildTerminalHistory(ALL_STEPS, 1);

			expect(history).toHaveLength(1);
			expect(history[0].command).toBe('brew install tool');
			expect(history[0].output).toEqual(STEP_1.outputLines);
			expect(history[0].isError).toBe(false);
		});

		test('accumulates history from all completed steps', () => {
			const history = buildTerminalHistory(ALL_STEPS, 3);

			expect(history).toHaveLength(3);
			expect(history[0].command).toBe('brew install tool');
			expect(history[1].command).toBe('tool configure');
			expect(history[2].command).toBe('tool --version');
		});

		test('only includes steps before currentStep', () => {
			const history = buildTerminalHistory(ALL_STEPS, 2);

			expect(history).toHaveLength(2);
			expect(history[0].command).toBe('brew install tool');
			expect(history[1].command).toBe('tool configure');
		});
	});

	describe('mixed levels (some steps are null)', () => {
		test('skips null steps at the beginning', () => {
			// L3 pattern: [null, null, terminal, terminal]
			const steps: (TerminalStepData | null)[] = [null, null, STEP_1, STEP_2];

			const history = buildTerminalHistory(steps, 3);
			expect(history).toHaveLength(1);
			expect(history[0].command).toBe('brew install tool');
		});

		test('skips null step at position 0', () => {
			// L2 pattern: [null, terminal, terminal, terminal, terminal]
			const steps: (TerminalStepData | null)[] = [null, STEP_1, STEP_2, STEP_3];

			const history = buildTerminalHistory(steps, 3);
			expect(history).toHaveLength(2);
			expect(history[0].command).toBe('brew install tool');
			expect(history[1].command).toBe('tool configure');
		});

		test('returns empty when currentStep is before any terminal steps', () => {
			const steps: (TerminalStepData | null)[] = [null, null, STEP_1];

			const history = buildTerminalHistory(steps, 1);
			expect(history).toEqual([]);
		});

		test('handles all null steps', () => {
			const steps: (TerminalStepData | null)[] = [null, null, null];

			const history = buildTerminalHistory(steps, 3);
			expect(history).toEqual([]);
		});
	});

	describe('edge cases', () => {
		test('returns empty for empty steps array', () => {
			const history = buildTerminalHistory([], 0);
			expect(history).toEqual([]);
		});

		test('handles currentStep beyond steps length', () => {
			const history = buildTerminalHistory([STEP_1], 5);

			expect(history).toHaveLength(1);
			expect(history[0].command).toBe('brew install tool');
		});

		test('skips steps with no correct command', () => {
			const noCorrect: TerminalStepData = {
				commands: [
					{
						id: 'w1',
						label: 'wrong',
						command: 'wrong',
						correct: false,
					},
				],
				outputLines: [],
			};

			const history = buildTerminalHistory([noCorrect, STEP_1], 2);
			expect(history).toHaveLength(1);
			expect(history[0].command).toBe('brew install tool');
		});
	});
});

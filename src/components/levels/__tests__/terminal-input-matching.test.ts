/**
 * Free-input terminal matching.
 *
 * Terminal steps accept typed commands (recall) before showing the option
 * buttons (recognition). The matcher decides whether typed input selects
 * one of the step's commands. Rules under test:
 *
 * - whitespace is normalized (trim + collapse runs)
 * - input matches a command's `command` string or its `label`
 * - matching is case-sensitive (options can differ only by case, and shell
 *   commands are case-sensitive)
 * - anything else is unrecognized
 * - options reveal after FREE_INPUT_MISS_LIMIT misses
 */

import { describe, expect, test } from 'bun:test';
import {
	FREE_INPUT_MISS_LIMIT,
	matchTypedCommand,
	shouldRevealOptions,
} from '@/components/levels/terminal-input-matching';

const COMMANDS = [
	{
		id: 'wrong-apt',
		label: 'apt-get install rails',
		command: 'apt-get install rails',
		correct: false,
		feedback: 'Rails is not a system package.',
	},
	{
		id: 'correct',
		label: 'gem install rails',
		command: 'gem install rails -v 8.0.2',
		correct: true,
	},
];

describe('matchTypedCommand', () => {
	test('matches the full command string exactly', () => {
		const match = matchTypedCommand('gem install rails -v 8.0.2', COMMANDS);
		expect(match).toEqual({ kind: 'match', command: COMMANDS[1] });
	});

	test('matches by label when the command has extra parts', () => {
		const match = matchTypedCommand('gem install rails', COMMANDS);
		expect(match).toEqual({ kind: 'match', command: COMMANDS[1] });
	});

	test('matches a wrong option so its feedback can teach', () => {
		const match = matchTypedCommand('apt-get install rails', COMMANDS);
		expect(match).toEqual({ kind: 'match', command: COMMANDS[0] });
	});

	test('normalizes whitespace before comparing', () => {
		const match = matchTypedCommand('  gem   install   rails  ', COMMANDS);
		expect(match).toEqual({ kind: 'match', command: COMMANDS[1] });
	});

	test('is case-sensitive', () => {
		expect(matchTypedCommand('Gem install rails', COMMANDS)).toEqual({
			kind: 'unrecognized',
		});
	});

	test('returns unrecognized for anything else', () => {
		expect(matchTypedCommand('brew install rails', COMMANDS)).toEqual({
			kind: 'unrecognized',
		});
		expect(matchTypedCommand('', COMMANDS)).toEqual({ kind: 'unrecognized' });
	});
});

describe('shouldRevealOptions', () => {
	test('stays hidden below the miss limit', () => {
		expect(shouldRevealOptions(0)).toBe(false);
		expect(shouldRevealOptions(FREE_INPUT_MISS_LIMIT - 1)).toBe(false);
	});

	test('reveals at the miss limit and beyond', () => {
		expect(shouldRevealOptions(FREE_INPUT_MISS_LIMIT)).toBe(true);
		expect(shouldRevealOptions(FREE_INPUT_MISS_LIMIT + 3)).toBe(true);
	});
});

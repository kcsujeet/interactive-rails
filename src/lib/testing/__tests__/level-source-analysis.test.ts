/**
 * Unit tests for the level source analyzer that powers the curriculum-wide
 * quality sweep. The analyzer parses level source files with the TypeScript
 * compiler API, because most levels keep their choice data as unexported
 * module-scope consts that cannot be introspected via imports.
 */

import { describe, expect, test } from 'bun:test';
import {
	extractOptionGroups,
	extractPipelineFlowTags,
	extractProbeDiscoveryMaps,
	findAnswerLeaks,
	findOptionGroupViolations,
} from '@/lib/testing/level-source-analysis';

describe('extractOptionGroups', () => {
	test('finds an array of choice options with fields and line number', () => {
		const source = `
const COMMANDS = [
	{ id: 'a', label: 'apt-get install rails', command: 'apt-get install rails', correct: false, feedback: 'Rails is not a system package.' },
	{ id: 'b', label: 'gem install rails', command: 'gem install rails', correct: true },
];
`;
		const groups = extractOptionGroups('x.ts', source);
		expect(groups.length).toBe(1);
		expect(groups[0]?.line).toBe(2);
		expect(groups[0]?.options).toEqual([
			{
				correct: false,
				label: 'apt-get install rails',
				command: 'apt-get install rails',
				feedback: 'Rails is not a system package.',
				color: undefined,
			},
			{
				correct: true,
				label: 'gem install rails',
				command: 'gem install rails',
				feedback: undefined,
				color: undefined,
			},
		]);
	});

	test('ignores arrays whose objects have no correct flag', () => {
		const source = `
const STAGES = [
	{ id: 'a', label: 'Router' },
	{ id: 'b', label: 'Controller' },
];
`;
		expect(extractOptionGroups('x.ts', source)).toEqual([]);
	});

	test('ignores arrays with only correct options (history/data, not a choice)', () => {
		const source = `
const DONE = [
	{ id: 'a', label: 'x', correct: true },
	{ id: 'b', label: 'y', correct: true },
];
`;
		expect(extractOptionGroups('x.ts', source)).toEqual([]);
	});

	test('treats decision-modal consequence text as the feedback field', () => {
		const source = `
const MODAL_OPTIONS = [
	{ label: 'has_one', value: 'has_one', consequence: 'Limits products to a single review', correct: false },
	{ label: 'has_many', value: 'has_many', consequence: 'Products can have unlimited reviews', correct: true },
];
`;
		const groups = extractOptionGroups('x.ts', source);
		expect(groups[0]?.options[0]?.feedback).toBe(
			'Limits products to a single review',
		);
	});

	test('reads template-literal strings and color fields', () => {
		const source = `
const OPTIONS = [
	{ id: 'a', label: \`validates :name\`, correct: true, color: 'zinc' },
	{ id: 'b', label: 'validate :name', correct: false, feedback: 'Close.', color: 'zinc' },
];
`;
		const groups = extractOptionGroups('x.ts', source);
		expect(groups[0]?.options[0]?.label).toBe('validates :name');
		expect(groups[0]?.options[0]?.color).toBe('zinc');
	});
});

describe('findOptionGroupViolations', () => {
	const base = { file: 'x.ts', line: 1 };

	test('flags correct answer in first position', () => {
		const violations = findOptionGroupViolations({
			...base,
			options: [
				{ correct: true, label: 'good' },
				{ correct: false, label: 'bad', feedback: 'why' },
			],
		});
		expect(violations.some((v) => v.includes('first'))).toBe(true);
	});

	test('flags wrong option without feedback', () => {
		const violations = findOptionGroupViolations({
			...base,
			options: [
				{ correct: false, label: 'bad' },
				{ correct: true, label: 'good' },
			],
		});
		expect(violations.some((v) => v.includes('feedback'))).toBe(true);
	});

	test('flags mixed colors across options', () => {
		const violations = findOptionGroupViolations({
			...base,
			options: [
				{ correct: false, label: 'bad', feedback: 'why', color: 'rose' },
				{ correct: true, label: 'good', color: 'green' },
			],
		});
		expect(violations.some((v) => v.includes('color'))).toBe(true);
	});

	test('flags multiple correct answers', () => {
		const violations = findOptionGroupViolations({
			...base,
			options: [
				{ correct: false, label: 'bad', feedback: 'why' },
				{ correct: true, label: 'good' },
				{ correct: true, label: 'also good' },
			],
		});
		expect(violations.some((v) => v.includes('correct'))).toBe(true);
	});

	test('passes a compliant group', () => {
		const violations = findOptionGroupViolations({
			...base,
			options: [
				{ correct: false, label: 'bad', feedback: 'why wrong' },
				{ correct: true, label: 'good' },
			],
		});
		expect(violations).toEqual([]);
	});
});

describe('findAnswerLeaks', () => {
	const base = { file: 'x.ts', line: 1 };

	test('flags feedback that names a distinctive token of the correct answer', () => {
		const leaks = findAnswerLeaks({
			...base,
			options: [
				{
					correct: false,
					label: 'apt-get install rails',
					feedback: 'Rails is a gem. Use gem install rails instead.',
				},
				{ correct: true, label: 'gem install rails' },
			],
		});
		expect(leaks.length).toBe(1);
	});

	test('does not flag feedback that only explains why the choice is wrong', () => {
		const leaks = findAnswerLeaks({
			...base,
			options: [
				{
					correct: false,
					label: 'apt-get install rails',
					feedback: "Rails isn't a system package.",
				},
				{ correct: true, label: 'gem install rails' },
			],
		});
		expect(leaks).toEqual([]);
	});

	test('does not flag tokens the wrong option itself already contains', () => {
		const leaks = findAnswerLeaks({
			...base,
			options: [
				{
					correct: false,
					label: 'rails generate migration AddName',
					command: 'rails generate migration AddName',
					feedback: 'A migration alone does not define the model class.',
				},
				{
					correct: true,
					label: 'rails generate model Product',
					command: 'rails generate model Product',
				},
			],
		});
		expect(leaks).toEqual([]);
	});
});

describe('extractPipelineFlowTags', () => {
	test('reports tags with and without activeConnections', () => {
		const source = `
export function Reward() {
	return (
		<div>
			<PipelineFlow nodes={nodes} connections={conns} activeConnections={active} />
			<PipelineFlow nodes={nodes} connections={conns} />
		</div>
	);
}
`;
		const tags = extractPipelineFlowTags('x.tsx', source);
		expect(tags.length).toBe(2);
		expect(tags[0]?.hasActiveConnections).toBe(true);
		expect(tags[1]?.hasActiveConnections).toBe(false);
	});
});

describe('extractProbeDiscoveryMaps', () => {
	test('reads string and string-array values', () => {
		const source = `
const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'probe-a': ['disc-1'],
	'probe-b': ['disc-2', 'disc-3'],
};
export const OTHER = { x: 1 };
const SECOND_LEVEL_MAP = { y: 2 };
`;
		const maps = extractProbeDiscoveryMaps('x.ts', source);
		expect(maps.length).toBe(1);
		expect(maps[0]?.entries).toEqual({
			'probe-a': ['disc-1'],
			'probe-b': ['disc-2', 'disc-3'],
		});
	});

	test('reads plain string values as single-element arrays', () => {
		const source = `
export const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'probe-a': 'disc-1',
	'probe-b': 'disc-2',
};
`;
		const maps = extractProbeDiscoveryMaps('x.ts', source);
		expect(maps[0]?.entries).toEqual({
			'probe-a': ['disc-1'],
			'probe-b': ['disc-2'],
		});
	});
});

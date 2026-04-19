import { describe, expect, test } from 'bun:test';

import {
	ADD_KAMAL_COMMANDS,
	DEPLOY_YML_OPTIONS,
	KAMAL_INIT_COMMANDS,
	KAMAL_SETUP_COMMANDS,
	SECRETS_OPTIONS,
	STEP_DEFS,
} from '../data/build-steps';
import { DISCOVERY_DEFS } from '../data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';

const ALL_OPTION_SETS = [
	{ name: 'ADD_KAMAL_COMMANDS', options: ADD_KAMAL_COMMANDS },
	{ name: 'KAMAL_INIT_COMMANDS', options: KAMAL_INIT_COMMANDS },
	{ name: 'DEPLOY_YML_OPTIONS', options: DEPLOY_YML_OPTIONS },
	{ name: 'SECRETS_OPTIONS', options: SECRETS_OPTIONS },
	{ name: 'KAMAL_SETUP_COMMANDS', options: KAMAL_SETUP_COMMANDS },
];

describe('Level 42 Deployment: Discoveries', () => {
	test('exactly 5 discoveries', () => {
		expect(DISCOVERY_DEFS).toHaveLength(5);
	});

	test('discovery IDs are unique', () => {
		const ids = DISCOVERY_DEFS.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('discovery labels are unique', () => {
		const labels = DISCOVERY_DEFS.map((d) => d.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test('every discovery label describes a real failure mode', () => {
		for (const d of DISCOVERY_DEFS) {
			expect(d.label.length).toBeGreaterThan(20);
		}
	});
});

describe('Level 42 Deployment: Probes', () => {
	test('exactly 5 probes', () => {
		expect(PROBES).toHaveLength(5);
	});

	test('probe IDs are unique', () => {
		const ids = PROBES.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('each probe has 4+ response lines', () => {
		for (const p of PROBES) {
			expect(p.responseLines.length).toBeGreaterThanOrEqual(4);
		}
	});

	test('exact probe IDs', () => {
		expect(PROBES.map((p) => p.id).sort()).toEqual(
			[
				'bad-release',
				'git-pull',
				'rollback',
				'scp-restart',
				'two-servers',
			].sort(),
		);
	});
});

describe('Level 42 Deployment: Probe to discovery mapping', () => {
	test('every probe maps to at least one discovery', () => {
		for (const probe of PROBES) {
			const mapped = PROBE_DISCOVERY_MAP[probe.id];
			expect(mapped).toBeDefined();
			expect(mapped.length).toBeGreaterThan(0);
		}
	});

	test('mapped discovery IDs all exist in DISCOVERY_DEFS', () => {
		const defIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
		for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
			for (const id of ids) {
				expect(defIds.has(id)).toBe(true);
			}
		}
	});

	test('every discovery is reachable via at least one probe', () => {
		const reached = new Set<string>();
		for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
			for (const id of ids) reached.add(id);
		}
		for (const d of DISCOVERY_DEFS) {
			expect(reached.has(d.id)).toBe(true);
		}
	});

	test('probe-to-discovery mapping is strictly 1:1', () => {
		// Non-negotiable rule: every probe must fire before "Build the Fix" appears.
		// That only works if each probe unlocks exactly one unique discovery.
		const unlocked: string[] = [];
		for (const ids of Object.values(PROBE_DISCOVERY_MAP)) {
			expect(ids).toHaveLength(1);
			unlocked.push(ids[0]);
		}
		expect(new Set(unlocked).size).toBe(unlocked.length);
		expect(unlocked.length).toBe(DISCOVERY_DEFS.length);
	});
});

describe('Level 42 Deployment: Build steps', () => {
	test('exactly 5 steps', () => {
		expect(STEP_DEFS).toHaveLength(5);
	});

	test('step IDs are unique', () => {
		const ids = STEP_DEFS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('Level 42 Deployment: Build step quality', () => {
	for (const { name, options } of ALL_OPTION_SETS) {
		test(`${name} has exactly one correct answer`, () => {
			const correct = options.filter((o) => o.correct);
			expect(correct).toHaveLength(1);
		});

		test(`${name} IDs are unique`, () => {
			const ids = options.map((o) => o.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test(`${name} labels are unique`, () => {
			const labels = options.map((o) => o.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test(`${name}: every wrong option has substantive feedback`, () => {
			for (const o of options) {
				if (o.correct) continue;
				expect(o.feedback).toBeDefined();
				expect((o.feedback as string).length).toBeGreaterThan(20);
			}
		});

		test(`${name}: feedback does not quote the correct label verbatim`, () => {
			const correctLabel = options.find((o) => o.correct)?.label ?? '';
			for (const o of options) {
				if (o.correct) continue;
				expect(o.feedback ?? '').not.toContain(correctLabel);
			}
		});
	}
});

describe('Level 42 Deployment: Stress scenarios', () => {
	test('exactly 5 scenarios', () => {
		expect(STRESS_SCENARIOS).toHaveLength(5);
	});

	test('scenario IDs are unique', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('scenario labels are unique', () => {
		const labels = STRESS_SCENARIOS.map((s) => s.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test('mix of allowed and blocked (at least one of each)', () => {
		const allowed = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'allowed',
		);
		const blocked = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'blocked',
		);
		expect(allowed.length).toBeGreaterThan(0);
		expect(blocked.length).toBeGreaterThan(0);
	});

	test('every scenario has responseLines with at least 4 lines', () => {
		for (const s of STRESS_SCENARIOS) {
			expect(s.responseLines).toBeDefined();
			expect((s.responseLines ?? []).length).toBeGreaterThanOrEqual(4);
		}
	});

	test('exact scenario IDs', () => {
		expect(STRESS_SCENARIOS.map((s) => s.id).sort()).toEqual(
			[
				'broken-push',
				'deploy-broken-health',
				'deploy-ok',
				'fleet-deploy',
				'rollback',
			].sort(),
		);
	});
});

describe('Level 42 Deployment: Phase coverage', () => {
	test('reward scenarios span the failure modes uncovered by probes', () => {
		const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
		expect(scenarioIds.has('deploy-ok')).toBe(true);
		expect(scenarioIds.has('deploy-broken-health')).toBe(true);
		expect(scenarioIds.has('rollback')).toBe(true);
		expect(scenarioIds.has('fleet-deploy')).toBe(true);
		expect(scenarioIds.has('broken-push')).toBe(true);
	});
});

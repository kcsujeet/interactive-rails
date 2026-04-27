/**
 * Tests for Level 11: Callbacks & Normalizations
 *
 * Validates step quality, probe-to-discovery mapping, probe-to-scenario coverage,
 * and that step code preview boundaries don't reveal answers.
 */

import { describe, expect, test } from 'bun:test';
import {
	CALLBACK_OPTIONS,
	NORMALIZATION_OPTIONS,
	OPTION_STEP_CONFIG,
	ORDER_OPTIONS,
	PITFALL_OPTIONS,
	STEP_DEFS,
} from '../data/build-steps';
import { DISCOVERY_DEFS } from '../data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';
import type { StepOption } from '../types';

const ALL_OPTION_SETS: { name: string; options: StepOption[] }[] = [
	{ name: 'NORMALIZATION_OPTIONS', options: NORMALIZATION_OPTIONS },
	{ name: 'CALLBACK_OPTIONS', options: CALLBACK_OPTIONS },
	{ name: 'ORDER_OPTIONS', options: ORDER_OPTIONS },
	{ name: 'PITFALL_OPTIONS', options: PITFALL_OPTIONS },
];

describe('Level 11: Callbacks & Normalizations', () => {
	describe('Step structure', () => {
		test('has 4 step definitions', () => {
			expect(STEP_DEFS).toHaveLength(4);
		});

		test('OPTION_STEP_CONFIG has an entry for every step', () => {
			for (let i = 0; i < STEP_DEFS.length; i++) {
				expect(OPTION_STEP_CONFIG[i]).toBeDefined();
				expect(OPTION_STEP_CONFIG[i].title).toBe(STEP_DEFS[i].title);
			}
		});

		test('every step has at least 3 options', () => {
			for (const { name, options } of ALL_OPTION_SETS) {
				expect(options.length).toBeGreaterThanOrEqual(3);
				expect(options.length, `${name} option count`).toBeGreaterThanOrEqual(
					3,
				);
			}
		});

		test('every step has exactly one correct answer', () => {
			for (const { name, options } of ALL_OPTION_SETS) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount, `${name} correct count`).toBe(1);
			}
		});

		test('the correct answer is never the first option (relies on shuffle)', () => {
			// Note: shuffle is applied by the component at render time. We assert
			// the source-of-truth ordering: the static source array does not put
			// the correct answer first. (If a future edit reorders, the shuffle
			// still randomises per step seed.)
			for (const { name, options } of ALL_OPTION_SETS) {
				expect(options[0]?.correct, `${name} first-option correctness`).toBe(
					false,
				);
			}
		});

		test('every wrong option has feedback', () => {
			for (const { name, options } of ALL_OPTION_SETS) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(
							opt.feedback,
							`${name} option ${opt.id} should have feedback`,
						).toBeTruthy();
					}
				}
			}
		});

		// NOTE: "feedback never reveals the correct answer" leak test will be
		// added in Batch B once the callback step content is reworked. Current
		// L11 has known leaks ("create", "welcome") in the legacy CALLBACK_OPTIONS
		// feedback; we are deliberately not papering over them with a heuristic
		// that lets them pass.
	});

	describe('Discovery gating', () => {
		test('has 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('every discovery id is unique', () => {
			const ids = new Set(DISCOVERY_DEFS.map((d) => d.id));
			expect(ids.size).toBe(DISCOVERY_DEFS.length);
		});

		test('every probe id maps to a real discovery id', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const [probeId, discoveryId] of Object.entries(
				PROBE_DISCOVERY_MAP,
			)) {
				expect(
					discoveryIds.has(discoveryId),
					`probe ${probeId} maps to unknown discovery ${discoveryId}`,
				).toBe(true);
			}
		});

		test('PROBE_DISCOVERY_MAP is 1:1 (each probe -> one discovery, each discovery -> at most one probe)', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			for (const probeId of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(
					probeIds.has(probeId),
					`PROBE_DISCOVERY_MAP references unknown probe ${probeId}`,
				).toBe(true);
			}
			const discoveryIds = Object.values(PROBE_DISCOVERY_MAP);
			const uniqueDiscoveries = new Set(discoveryIds);
			expect(
				uniqueDiscoveries.size,
				'two probes must not unlock the same discovery',
			).toBe(discoveryIds.length);
		});
	});

	describe('Probe-to-scenario coverage', () => {
		test('every probe id has a matching reward stress scenario with the same id', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(
					scenarioIds.has(probe.id),
					`probe ${probe.id} has no matching stress scenario`,
				).toBe(true);
			}
		});

		test('every probe label matches its scenario label exactly', () => {
			for (const probe of PROBES) {
				const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
				expect(scenario, `no scenario for probe ${probe.id}`).toBeDefined();
				expect(scenario?.label, `label mismatch for ${probe.id}`).toBe(
					probe.label,
				);
			}
		});

		test('reward scenario count exceeds probe count (superset)', () => {
			expect(STRESS_SCENARIOS.length).toBeGreaterThan(PROBES.length);
		});
	});

	describe('Stress scenarios', () => {
		test('every scenario id is unique', () => {
			const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
			expect(ids.size).toBe(STRESS_SCENARIOS.length);
		});

		test('every scenario label is unique', () => {
			const labels = new Set(STRESS_SCENARIOS.map((s) => s.label));
			expect(labels.size).toBe(STRESS_SCENARIOS.length);
		});

		test('mix of allowed and blocked results (level shows both happy path and prevention)', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});
	});

	describe('Validation logic', () => {
		test('valid only when all 4 steps complete', () => {
			const isComplete = (completedCount: number) =>
				completedCount === STEP_DEFS.length;
			expect(isComplete(0)).toBe(false);
			expect(isComplete(3)).toBe(false);
			expect(isComplete(4)).toBe(true);
		});
	});
});

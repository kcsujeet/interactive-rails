/**
 * Level 51: Multi-Database. Reward wiring tests (dead-scenario regression,
 * audit 2026-07-09). Imports the component's exported wiring because
 * mirrors cannot verify frame coverage.
 */

import { describe, expect, test } from 'bun:test';
import {
	PROBES,
	REWARD_PROBE_FRAMES,
	STRESS_SCENARIOS,
} from '../components/level-51-multi-database/Level51MultiDatabase';

describe('Level 51: reward wiring', () => {
	test('scenario labels are unique (no duplicate buttons)', () => {
		const labels = STRESS_SCENARIOS.map((s) => s.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test('scenario ids are unique and no two scenarios share frames', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		const frameRefs = STRESS_SCENARIOS.map(
			(s) => REWARD_PROBE_FRAMES[s.id],
		).filter((f) => f !== undefined);
		expect(new Set(frameRefs).size).toBe(frameRefs.length);
	});

	test('every scenario has reward frames (no dead buttons)', () => {
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_PROBE_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
	});

	test('every probe id has a matching scenario id', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const probe of PROBES) {
			expect(ids.has(probe.id), `probe "${probe.id}" unpaired`).toBe(true);
		}
	});
});

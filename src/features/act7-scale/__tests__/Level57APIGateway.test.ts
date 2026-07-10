/**
 * Level 57: API Gateway. Post-reconciliation tests (2026-07-09).
 *
 * The level was redesigned so the gateway fronts the modular monolith's
 * packages (there are no separate services before L58's extraction design).
 * These tests import the component's exported data directly, a deliberate
 * exception to the mirror-don't-import rule for the wiring-class checks
 * (frames coverage, probe/scenario pairing) that mirrors cannot verify.
 */

import { describe, expect, test } from 'bun:test';
import {
	expectAllDiscoveriesRequired,
	expectBuildStepQuality,
	expectProbeDiscoveryMapOneToOne,
	expectProbesMatchScenarios,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	DISCOVERY_DEFS,
	generateGatewayCommands,
	OBSERVE_PROBE_FRAMES,
	OPTION_STEP_CONFIG,
	PROBE_DISCOVERY_MAP,
	PROBES,
	REWARD_PROBE_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-57-api-gateway/Level57APIGateway';

describe('Level 57: discovery / probe wiring', () => {
	test('all discoveries are required', () => {
		expectAllDiscoveriesRequired({
			discoveries: DISCOVERY_DEFS,
			minRequired: DISCOVERY_DEFS.length,
		});
	});

	test('probe-discovery map is strictly 1:1', () => {
		expectProbeDiscoveryMapOneToOne({
			probes: PROBES,
			discoveries: DISCOVERY_DEFS,
			map: PROBE_DISCOVERY_MAP,
		});
	});

	test('probes tell 3-6 bullet stories', () => {
		expectStoriesPresent({ items: PROBES, kind: 'probe' });
	});
});

describe('Level 57: observe visuals', () => {
	test('every probe has animation frames', () => {
		for (const probe of PROBES) {
			expect(
				OBSERVE_PROBE_FRAMES[probe.id],
				`probe "${probe.id}" has no observe frames`,
			).toBeInstanceOf(Array);
			expect(OBSERVE_PROBE_FRAMES[probe.id].length).toBeGreaterThanOrEqual(2);
		}
	});

	test('every probe drives a distinct animation', () => {
		expectEveryProbeDrivesDistinctChange({
			probes: PROBES,
			probeStateMap: OBSERVE_PROBE_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('observe frames never touch the gateway (it does not exist yet)', () => {
		const violations: string[] = [];
		for (const [probeId, frames] of Object.entries(OBSERVE_PROBE_FRAMES)) {
			for (const [i, frame] of frames.entries()) {
				if ('gateway' in frame || 'edgeIn' in frame) {
					violations.push(`${probeId} frame ${i} references the gateway`);
				}
			}
		}
		expect(violations).toEqual([]);
	});
});

describe('Level 57: probe / scenario pairing and reward wiring', () => {
	test('every probe has a matching reward scenario (same id and label)', () => {
		expectProbesMatchScenarios({ probes: PROBES, scenarios: STRESS_SCENARIOS });
	});

	test('scenario basics: unique ids/labels, mixed outcomes', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
	});

	test('scenarios tell 3-6 bullet stories', () => {
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('every scenario has reward frames (no dead buttons)', () => {
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_PROBE_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
			expect(REWARD_PROBE_FRAMES[scenario.id].length).toBeGreaterThanOrEqual(2);
		}
	});

	test('no orphan reward frames', () => {
		const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const frameId of Object.keys(REWARD_PROBE_FRAMES)) {
			expect(
				scenarioIds.has(frameId),
				`reward frames for "${frameId}" have no scenario button`,
			).toBe(true);
		}
	});
});

describe('Level 57: build step quality', () => {
	test('terminal step: one correct command, wrongs teach, correct not first', () => {
		expectBuildStepQuality({
			name: 'generate-gateway',
			options: generateGatewayCommands.map((c) => ({
				id: c.id,
				label: c.label,
				correct: c.correct,
				feedback: c.feedback,
			})),
		});
	});

	test('option steps 1-5 exist with three options each and teach distinct lessons', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			1, 2, 3, 4, 5,
		]);
		for (const [index, config] of Object.entries(OPTION_STEP_CONFIG)) {
			expect(config.options.length, `step ${index} option count`).toBe(3);
			expectBuildStepQuality({
				name: `step-${index} (${config.title})`,
				options: config.options.map((o) => ({
					id: o.id,
					label: o.name,
					correct: o.correct,
					feedback: o.feedback,
				})),
			});
		}
	});

	test('every step index maps to terminal or option config exactly once', () => {
		STEP_DEFS.forEach((def, index) => {
			const isTerminal = index === 0;
			const isOption = OPTION_STEP_CONFIG[index] !== undefined;
			expect(
				isTerminal !== isOption,
				`step ${index} (${def.id}) must be exactly one of terminal/option`,
			).toBe(true);
		});
	});
});

describe('Level 57: world coherence (the L58 seam)', () => {
	test('no phantom microservice topology anywhere in probes or scenarios', () => {
		const text = JSON.stringify({ PROBES, STRESS_SCENARIOS, DISCOVERY_DEFS });
		for (const forbidden of [':3001', ':3002', ':3003', 'users.internal']) {
			expect(text.includes(forbidden), `found "${forbidden}"`).toBe(false);
		}
	});

	test('the route-moved pair teaches the extraction seam', () => {
		const probe = PROBES.find((p) => p.id === 'route-moved');
		const scenario = STRESS_SCENARIOS.find((s) => s.id === 'route-moved');
		expect(probe?.story?.join(' ')).toContain('app-store release');
		expect(scenario?.story?.join(' ')).toContain(
			'free to reorganize behind the stable URL',
		);
	});
});

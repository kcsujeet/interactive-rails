/**
 * Level 58: The Architect (capstone). Post-redesign tests (2026-07-10).
 *
 * The capstone's before-state is the post-L56 modular monolith: events,
 * state machines, gateway, and boundaries all exist. The remaining pains
 * are structural (deploy coupling, shared-DB contention, shared-runtime
 * blast radius), and the build phase is five architectural decisions plus
 * one real command. These tests import the component's exported data
 * (wiring cannot be verified from mirrors).
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
	OBSERVE_PROBE_FRAMES,
	OPTION_STEP_CONFIG,
	PROBE_DISCOVERY_MAP,
	PROBES,
	REWARD_PROBE_FRAMES,
	SKELETON_COMMANDS,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-58-architect/Level58Architect';

describe('Level 58: discovery / probe wiring', () => {
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

describe('Level 58: world coherence (post-L56 before-state)', () => {
	test('probes never claim the pains earlier levels already fixed', () => {
		const text = JSON.stringify(PROBES).toLowerCase();
		// L56 fixed synchronous side effects; L54 fixed unguarded transitions.
		for (const forbidden of [
			'synchronous',
			'state machine',
			'rolls back',
			'rolled back',
			'no way to know who',
		]) {
			expect(text.includes(forbidden), `probes claim "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('the pains are structural: deploy, database, runtime', () => {
		const labels = DISCOVERY_DEFS.map((d) => d.label).join(' ');
		expect(labels).toContain('deploy');
		expect(labels).toContain('checkout');
		expect(labels).toContain('storefront');
	});
});

describe('Level 58: observe visuals', () => {
	test('every probe has frames and drives a distinct animation', () => {
		for (const probe of PROBES) {
			expect(
				OBSERVE_PROBE_FRAMES[probe.id],
				`probe "${probe.id}" has no observe frames`,
			).toBeInstanceOf(Array);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: PROBES,
			probeStateMap: OBSERVE_PROBE_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('observe frames never touch reward-only zones (they do not exist yet)', () => {
		const rewardOnly = [
			'gateway',
			'flagGate',
			'billingSvc',
			'billingDb',
			'eventBus',
		];
		const violations: string[] = [];
		for (const [probeId, frames] of Object.entries(OBSERVE_PROBE_FRAMES)) {
			for (const [i, frame] of frames.entries()) {
				for (const zone of Object.keys(frame.zones ?? {})) {
					if (rewardOnly.includes(zone)) {
						violations.push(`${probeId} frame ${i} touches "${zone}"`);
					}
				}
			}
		}
		expect(violations).toEqual([]);
	});
});

describe('Level 58: probe / scenario pairing and reward wiring', () => {
	test('every probe has a matching reward scenario (same id and label)', () => {
		expectProbesMatchScenarios({ probes: PROBES, scenarios: STRESS_SCENARIOS });
	});

	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('every scenario has reward frames; no orphans', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_PROBE_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
		for (const key of Object.keys(REWARD_PROBE_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
	});

	test('paired reward stories replay the observe story ("same ...")', () => {
		for (const probe of PROBES) {
			const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
			expect(
				scenario?.story?.[0].toLowerCase().startsWith('same'),
				`scenario "${probe.id}" story must open with the same-actor replay`,
			).toBe(true);
		}
	});
});

describe('Level 58: build steps are decisions, not recap trivia', () => {
	test('terminal step: one correct command, wrongs teach, correct not first', () => {
		expectBuildStepQuality({
			name: 'service-skeleton',
			options: SKELETON_COMMANDS.map((c) => ({
				id: c.id,
				label: c.label,
				correct: c.correct,
				feedback: c.feedback,
			})),
		});
	});

	test('decision steps have three options each and pass quality rules', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			0, 1, 3, 4, 5,
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
			const isTerminal = index === 2;
			const isOption = OPTION_STEP_CONFIG[index] !== undefined;
			expect(
				isTerminal !== isOption,
				`step ${index} (${def.id}) must be exactly one of terminal/option`,
			).toBe(true);
		});
	});

	test('no step re-teaches an earlier level tool as its lesson', () => {
		// The old capstone re-installed Packwerk, AASM, and Wisper. Decisions
		// may REFERENCE prior concepts; they must not re-run their setup.
		const text = JSON.stringify(OPTION_STEP_CONFIG);
		for (const forbidden of [
			'packwerk init',
			'include AASM',
			'Wisper::Publisher',
			'opentelemetry-sdk',
		]) {
			expect(text.includes(forbidden), `step re-teaches "${forbidden}"`).toBe(
				false,
			);
		}
	});
});

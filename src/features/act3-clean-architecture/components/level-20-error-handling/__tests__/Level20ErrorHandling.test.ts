/**
 * Level 20: Error Handling. Tests pin the review-finding fixes and import
 * the real component data so drift is caught at type-check time.
 *
 * Rails facts verified against canonical docs on 2026-07-20:
 * - rescue_from handlers match bottom-up: register StandardError first so
 *   the specific handlers registered after it take priority.
 *   https://guides.rubyonrails.org/action_controller_overview.html#rescue
 *
 * Curriculum ground truth:
 * - API paths are unversioned before L48; no /api/v1/ in homework or code.
 * - Observe shows only components that exist: there is no "Error Handler
 *   (missing!)" placeholder node. The rescue_from node appears only in the
 *   reward phase (the build introduces it).
 */

import { describe, expect, test } from 'bun:test';
import {
	expectBuildStepQuality,
	expectProbeDiscoveryMapOneToOne,
} from '@/lib/testing/level-pedagogy';
import {
	DISCOVERY_DEFS,
	getCodeFiles,
	MAPPING_OPTIONS,
	PROBE_DISCOVERY_MAP,
	PROBES,
	SHAPE_OPTIONS,
	STAGE_DISCOVERY_MAP,
	STEP_DEFS,
	STRATEGY_OPTIONS,
	STRESS_SCENARIOS,
} from '../Level20ErrorHandling';

const allPreviewCode = () => {
	const chunks: string[] = [];
	for (const phase of ['observe', 'build', 'reward'] as const) {
		for (let step = -1; step <= STEP_DEFS.length; step++) {
			for (const f of getCodeFiles(phase, step)) {
				chunks.push(`${f.filename}\n${f.code}`);
			}
		}
	}
	return chunks.join('\n');
};

describe('Level 20: build step quality', () => {
	const STEP_OPTION_SETS = [
		{ name: 'choose-strategy', options: STRATEGY_OPTIONS },
		{ name: 'map-exceptions', options: MAPPING_OPTIONS },
		{ name: 'define-shape', options: SHAPE_OPTIONS },
	];

	test('every step: exactly one correct, correct never first, feedback present', () => {
		for (const set of STEP_OPTION_SETS) {
			expectBuildStepQuality({ name: set.name, options: set.options });
		}
	});
});

describe('Level 20: discovery gating is 1:1', () => {
	test('each probe unlocks exactly one distinct discovery', () => {
		expectProbeDiscoveryMapOneToOne({
			probes: PROBES,
			discoveries: DISCOVERY_DEFS.filter(
				(d) => d.id !== 'no-centralized-handling',
			),
			map: Object.fromEntries(
				Object.entries(PROBE_DISCOVERY_MAP).map(([k, v]) => [k, [v]]),
			),
		});
	});

	test('inconsistent-shapes is unlocked by the bad-params probe only, not a stage click', () => {
		expect(PROBE_DISCOVERY_MAP['bad-params']).toBe('inconsistent-shapes');
		expect(Object.values(STAGE_DISCOVERY_MAP)).not.toContain(
			'inconsistent-shapes',
		);
	});

	test('the fourth discovery (no-centralized-handling) comes from the controller stage click', () => {
		expect(STAGE_DISCOVERY_MAP.controller).toBe('no-centralized-handling');
		expect(Object.values(PROBE_DISCOVERY_MAP)).not.toContain(
			'no-centralized-handling',
		);
	});
});

describe('Level 20: observe shows only what exists', () => {
	test('no code preview or inspector renders an "Error Handler (Missing!)" placeholder', () => {
		const all = allPreviewCode();
		expect(all.includes('Error Handler (Missing!)')).toBe(false);
		expect(all.includes('(missing!)')).toBe(false);
	});

	test('the missing-product probe and the observe preview agree: products#show has NO rescue', () => {
		// The story is a raw 500 for a missing product. That is only true if
		// show has no rescue. A rescue rendering 500 would contradict it.
		const observe = getCodeFiles('observe', -1)
			.map((f) => f.code)
			.join('\n');
		const showBlock = observe.slice(
			observe.indexOf('def show'),
			observe.indexOf('def create'),
		);
		expect(showBlock).toContain('No rescue');
		expect(showBlock.includes('rescue ActiveRecord::RecordNotFound')).toBe(
			false,
		);
	});
});

describe('Level 20: the built fix registers rescue_from StandardError', () => {
	test('the final ApplicationController rescues StandardError, registered first', () => {
		const reward = getCodeFiles('reward', STEP_DEFS.length);
		const app = reward.find((f) =>
			f.filename.includes('application_controller.rb'),
		);
		expect(app?.code).toContain('rescue_from StandardError');
		// Registered before the specific handlers (bottom-up matching).
		const idxStandard = app?.code.indexOf('rescue_from StandardError') ?? -1;
		const idxNotFound =
			app?.code.indexOf('rescue_from ActiveRecord::RecordNotFound') ?? -1;
		expect(idxStandard).toBeGreaterThanOrEqual(0);
		expect(idxStandard).toBeLessThan(idxNotFound);
	});

	test('the reward preview reaches the final clean controller (gating fix)', () => {
		const reward = getCodeFiles('reward', STEP_DEFS.length)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');
		expect(reward).toContain('No begin/rescue needed!');
	});
});

describe('Level 20: unversioned paths and actor honesty', () => {
	test('the bad-params stress scenario actor is not an attacker (innocent malformed request)', () => {
		const badParams = STRESS_SCENARIOS.find((s) => s.id === 'bad-params');
		expect(badParams?.actor).not.toBe('attacker');
	});

	test('no code preview uses versioned /api/v1/ paths (pre-L48)', () => {
		expect(allPreviewCode().includes('/api/v1/')).toBe(false);
	});
});

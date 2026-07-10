/**
 * Level 55: Modular Monolith. Post-redesign tests (2026-07-10).
 *
 * The redesign's core correction is mechanism honesty: Packwerk is
 * CI-time static analysis (per its README), never a runtime firewall.
 * These tests pin that: probes live in the before-world (no tool
 * vocabulary), the blocked reward scenario is a PR failing in CI
 * before merge, and no player-visible string frames the check as
 * intercepting requests at runtime. They import the component's
 * exported data because wiring cannot be verified from mirrors.
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
	getCodeFiles,
	INIT_COMMANDS,
	INSTALL_COMMANDS,
	OBSERVE_PROBE_FRAMES,
	OPTION_STEP_CONFIG,
	PROBE_DISCOVERY_MAP,
	PROBES,
	REWARD_PROBE_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-55-modular-monolith/Level55ModularMonolith';

describe('Level 55: discovery / probe wiring', () => {
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

describe('Level 55: mechanism honesty (static analysis in CI, not runtime)', () => {
	test('probes live in the before-world: no boundary-tool vocabulary', () => {
		const text = JSON.stringify(PROBES).toLowerCase();
		for (const forbidden of [
			'packwerk',
			'boundary check',
			'packs/',
			'package.yml',
			'codeowners',
		]) {
			expect(text.includes(forbidden), `probes mention "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('observe frames only show the before-world', () => {
		const text = JSON.stringify(OBSERVE_PROBE_FRAMES).toLowerCase();
		for (const forbidden of ['packs/', 'boundary', 'codeowners', 'packwerk']) {
			expect(
				text.includes(forbidden),
				`observe frames mention "${forbidden}"`,
			).toBe(false);
		}
	});

	test('the blocked scenario is a PR failing in CI before merge', () => {
		const blocked = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'blocked',
		);
		expect(blocked.map((s) => s.id)).toEqual(['internal-rename']);
		const scenario = blocked[0];
		expect(scenario?.method).toBe('PR');
		expect(scenario?.description).toContain('before merge');
		expect(scenario?.story?.some((line) => line.includes('BEFORE merge'))).toBe(
			true,
		);
	});

	test('no player-visible string frames the check as runtime blocking', () => {
		const text = JSON.stringify({
			STRESS_SCENARIOS,
			REWARD_PROBE_FRAMES,
		}).toLowerCase();
		for (const forbidden of ['403', 'request blocked', 'firewall', 'raises']) {
			expect(text.includes(forbidden), `reward claims "${forbidden}"`).toBe(
				false,
			);
		}
		// The reward frame for the blocked PR must say where blocking happens.
		expect(JSON.stringify(REWARD_PROBE_FRAMES['internal-rename'])).toContain(
			'PR blocked before merge',
		);
	});
});

describe('Level 55: observe visuals', () => {
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

	test('every observe probe ends on customer-visible damage', () => {
		const lastFrames = {
			'internal-rename': 'receipts stopped arriving',
			'circular-hotfix': 'overselling continues',
			'incident-owner': 'refunds down the whole time',
		};
		for (const [probeId, expected] of Object.entries(lastFrames)) {
			const frames = OBSERVE_PROBE_FRAMES[probeId] ?? [];
			const last = JSON.stringify(frames[frames.length - 1]);
			expect(last, `probe "${probeId}" final frame`).toContain(expected);
		}
	});
});

describe('Level 55: probe / scenario pairing and reward wiring', () => {
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

describe('Level 55: build steps', () => {
	test('terminal steps: one correct command, wrongs teach, correct not first', () => {
		for (const [name, commands] of [
			['install', INSTALL_COMMANDS],
			['init', INIT_COMMANDS],
		] as const) {
			expectBuildStepQuality({
				name,
				options: commands.map((c) => ({
					id: c.id,
					label: c.label,
					correct: c.correct,
					feedback: c.feedback,
				})),
			});
		}
	});

	test('install step includes the binstub (per the Packwerk README)', () => {
		const correct = INSTALL_COMMANDS.find((c) => c.correct);
		expect(correct?.command).toBe(
			'bundle add packwerk && bundle binstub packwerk',
		);
	});

	test('option steps are 2-6, three options each, and pass quality rules', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			2, 3, 4, 5, 6,
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

	test('wrong-option feedback never contains that step answer tokens', () => {
		const answerTokens: Record<number, string[]> = {
			2: ['package.yml', 'packs/', 'git mv', 'mkdir'],
			3: ['::Public', 'SendReceipt', 'namespace'],
			4: ['dependencies:', '- packs/'],
			5: ['ci.yml', ' CI', 'workflow'],
			6: ['CODEOWNERS', '@myapp'],
		};
		for (const [index, tokens] of Object.entries(answerTokens)) {
			const config = OPTION_STEP_CONFIG[Number(index)];
			for (const option of config.options.filter((o) => !o.correct)) {
				for (const token of tokens) {
					expect(
						option.feedback?.includes(token),
						`step ${index} feedback for "${option.id}" leaks "${token}"`,
					).toBe(false);
				}
			}
		}
	});

	test('steps 0-1 are terminal steps (no option config)', () => {
		expect(OPTION_STEP_CONFIG[0]).toBeUndefined();
		expect(OPTION_STEP_CONFIG[1]).toBeUndefined();
		expect(STEP_DEFS.length).toBe(7);
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'install',
			'init',
			'define-package',
			'public-api',
			'declare-deps',
			'ci-gate',
			'codeowners',
		]);
	});
});

describe('Level 55: code preview boundaries', () => {
	const previewAt = (completedStep: number) =>
		getCodeFiles('build', completedStep)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');

	test('observe preview never shows the answer surface', () => {
		const observe = getCodeFiles('observe', -1)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');
		for (const token of [
			'packwerk',
			'package.yml',
			'packs/',
			'enforce_dependencies',
			'CODEOWNERS',
			'Public',
		]) {
			expect(observe.includes(token), `observe preview leaks "${token}"`).toBe(
				false,
			);
		}
	});

	test('preview while working on step N never contains step N answers', () => {
		// completedStep = N - 1 is what the player sees while choosing at step N.
		const leaks: [number, string[]][] = [
			[0, ['packwerk']],
			[1, ['packwerk.yml']],
			[2, ['packs/billing', 'enforce_dependencies']],
			[3, ['Public', 'SendReceipt']],
			[4, ['- packs/notifications']],
			[5, ['ci.yml', 'packwerk check']],
			[6, ['CODEOWNERS', '@myapp']],
		];
		for (const [step, tokens] of leaks) {
			const preview = previewAt(step - 1);
			for (const token of tokens) {
				expect(
					preview.includes(token),
					`working on step ${step}, preview leaks "${token}"`,
				).toBe(false);
			}
		}
	});

	test('preview grows monotonically: each completed step adds its file', () => {
		const expectAfter: [number, string][] = [
			[0, 'Gemfile'],
			[1, 'packwerk.yml'],
			[2, 'packs/billing/package.yml'],
			[3, 'packs/notifications/app/public/send_receipt.rb'],
			[5, '.github/workflows/ci.yml'],
			[6, '.github/CODEOWNERS'],
		];
		for (const [step, filename] of expectAfter) {
			expect(
				getCodeFiles('build', step).some((f) => f.filename === filename),
				`after step ${step}, preview must include ${filename}`,
			).toBe(true);
		}
		// Dependencies appear in package.yml only after the declare-deps step.
		const pkgBefore = getCodeFiles('build', 3).find(
			(f) => f.filename === 'packs/billing/package.yml',
		);
		const pkgAfter = getCodeFiles('build', 4).find(
			(f) => f.filename === 'packs/billing/package.yml',
		);
		expect(pkgBefore?.code.includes('- packs/notifications')).toBe(false);
		expect(pkgAfter?.code.includes('- packs/notifications')).toBe(true);
	});
});

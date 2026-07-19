import { describe, expect, test } from 'bun:test';

import {
	expectBuildStepQuality,
	expectProbeDiscoveryMapOneToOne,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import {
	CONFIRM_KAMAL_COMMANDS,
	DEPLOY_YML_OPTIONS,
	KAMAL_SETUP_COMMANDS,
	REVIEW_SCAFFOLD_COMMANDS,
	SECRETS_OPTIONS,
	STEP_DEFS,
} from '../data/build-steps';
import { getCodeFiles } from '../data/code-files';
import { DISCOVERY_DEFS } from '../data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';

const ALL_OPTION_SETS = [
	{ name: 'CONFIRM_KAMAL_COMMANDS', options: CONFIRM_KAMAL_COMMANDS },
	{ name: 'REVIEW_SCAFFOLD_COMMANDS', options: REVIEW_SCAFFOLD_COMMANDS },
	{ name: 'DEPLOY_YML_OPTIONS', options: DEPLOY_YML_OPTIONS },
	{ name: 'SECRETS_OPTIONS', options: SECRETS_OPTIONS },
	{ name: 'KAMAL_SETUP_COMMANDS', options: KAMAL_SETUP_COMMANDS },
];

describe('Level 49 Deployment: shared pedagogy lints', () => {
	test('PROBE_DISCOVERY_MAP is strictly 1:1', () => {
		expectProbeDiscoveryMapOneToOne({
			probes: PROBES,
			discoveries: DISCOVERY_DEFS,
			map: PROBE_DISCOVERY_MAP,
		});
	});

	test('every probe has 3-6 substantive story bullets', () => {
		expectStoriesPresent({ items: PROBES, kind: 'probe' });
	});

	test('every reward scenario has 3-6 substantive story bullets', () => {
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	// expectProbesMatchScenarios is intentionally omitted: this level uses a
	// PROBE_TO_SCENARIO map (probe ids and scenario ids differ), enforced by
	// the level-specific "paired scenario labels share a thematic word with
	// the probe" test below.

	test('reward scenarios pass basic sanity (uniqueness, mix of results)', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
	});

	for (const { name, options } of ALL_OPTION_SETS) {
		test(`build step quality: ${name}`, () => {
			expectBuildStepQuality({ name, options });
		});
	}
});

// Level-specific assertions, counts, exact ids, theme-word matching that
// the shared helpers cannot know about.
describe('Level 49 Deployment: level-specific shape', () => {
	test('exactly 5 discoveries with unique labels', () => {
		expect(DISCOVERY_DEFS).toHaveLength(5);
		const labels = DISCOVERY_DEFS.map((d) => d.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	test('exactly 5 probes with the expected ids', () => {
		expect(PROBES).toHaveLength(5);
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

	test('every probe has 4+ response lines', () => {
		for (const p of PROBES) {
			expect(p.responseLines.length).toBeGreaterThanOrEqual(4);
		}
	});

	test('exactly 5 build steps with unique ids', () => {
		expect(STEP_DEFS).toHaveLength(5);
		const ids = STEP_DEFS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('build does not re-install the Kamal default (rails new already scaffolded it)', () => {
		// The correct first two steps confirm/inspect the scaffolding, they do
		// not install a gem or run `kamal init`.
		const confirm = CONFIRM_KAMAL_COMMANDS.find((o) => o.correct);
		expect(confirm?.command).toBe('kamal version');
		const review = REVIEW_SCAFFOLD_COMMANDS.find((o) => o.correct);
		expect(review?.command).toBe(
			'ls config/deploy.yml .kamal/secrets Dockerfile',
		);
		// `bundle add kamal` and `kamal init` are now wrong options, never correct.
		for (const opt of [
			...CONFIRM_KAMAL_COMMANDS,
			...REVIEW_SCAFFOLD_COMMANDS,
		]) {
			if (opt.command === 'bundle add kamal' || opt.command === 'kamal init') {
				expect(opt.correct).toBe(false);
			}
		}
	});

	test('deploy.yml correct answer configures a job role that rotates on deploy', () => {
		const correct = DEPLOY_YML_OPTIONS.find((o) => o.correct);
		expect(correct?.code).toContain('job:');
		expect(correct?.code).toContain('cmd: bin/jobs');
		// It is a role under servers:, NOT an accessory (accessories are not
		// updated on deploy).
		expect(correct?.code).not.toContain('accessories:');
	});

	test('reward + build code files ship the job role, never an accessory worker', () => {
		const rewardCode = getCodeFiles('reward', STEP_DEFS.length)
			.map((f) => f.code)
			.join('\n');
		expect(rewardCode).toContain('cmd: bin/jobs');
		expect(rewardCode).not.toContain('accessories:');
		const buildCode = getCodeFiles('build', STEP_DEFS.length)
			.map((f) => f.code)
			.join('\n');
		expect(buildCode).toContain('cmd: bin/jobs');
	});

	test('first-deploy wrong option uses the real subcommand kamal build push', () => {
		const buildPush = KAMAL_SETUP_COMMANDS.find(
			(o) => o.id === 'wrong-build-push',
		);
		expect(buildPush?.command).toBe('kamal build push');
		expect(buildPush?.correct).toBe(false);
		// The fabricated `kamal push` must not exist anywhere in this set.
		for (const opt of KAMAL_SETUP_COMMANDS) {
			expect(opt.command).not.toBe('kamal push');
		}
	});

	test('broken-health scenario reports 503 (L47 deep check), not stock /up 500', () => {
		const s = STRESS_SCENARIOS.find((x) => x.id === 'deploy-broken-health');
		const joined = (s?.responseLines ?? []).map((l) => l.text).join('\n');
		expect(joined).toContain('503');
		expect(joined).not.toContain('500');
	});

	test('exactly 5 stress scenarios with the expected ids', () => {
		expect(STRESS_SCENARIOS).toHaveLength(5);
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

	test('every scenario has 4+ response lines', () => {
		for (const s of STRESS_SCENARIOS) {
			expect((s.responseLines ?? []).length).toBeGreaterThanOrEqual(4);
		}
	});

	// Probe and scenario labels share a thematic verb so the player feels
	// the reward phase replays observe with the fix applied. Generic helpers
	// cannot know which words count as thematic for this level.
	test('paired scenario labels share a thematic word with the probe', () => {
		const pairs: Array<{
			probeId: string;
			scenarioId: string;
			shared: string[];
		}> = [
			{ probeId: 'scp-restart', scenarioId: 'deploy-ok', shared: ['Deploy'] },
			{ probeId: 'git-pull', scenarioId: 'broken-push', shared: ['Deploy'] },
			{
				probeId: 'bad-release',
				scenarioId: 'deploy-broken-health',
				shared: ['Ship a release'],
			},
			{ probeId: 'rollback', scenarioId: 'rollback', shared: ['Roll back'] },
			{
				probeId: 'two-servers',
				scenarioId: 'fleet-deploy',
				shared: ['Deploy', 'two servers'],
			},
		];

		for (const { probeId, scenarioId, shared } of pairs) {
			const probe = PROBES.find((p) => p.id === probeId);
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			expect(probe).toBeDefined();
			expect(scenario).toBeDefined();
			for (const token of shared) {
				expect(probe?.label).toContain(token);
				expect(scenario?.label).toContain(token);
			}
		}
	});
});

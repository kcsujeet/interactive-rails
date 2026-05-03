/**
 * Tests for Level 11: Callbacks & Normalizations
 *
 * Validates step quality, probe-to-discovery mapping, probe-to-scenario coverage,
 * and that step feedback never reveals the correct answer.
 */

import { describe, expect, test } from 'bun:test';
import {
	EXTERNAL_SYNC_OPTIONS,
	NORMALIZATION_OPTIONS,
	OPTION_STEP_CONFIG,
	STATUS_ENUM_OPTIONS,
	STEP_DEFS,
	WELCOME_EMAIL_OPTIONS,
} from '../data/build-steps';
import { getCodeFiles } from '../data/code-files';
import { DISCOVERY_DEFS } from '../data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';
import type { StepOption } from '../types';

const ALL_OPTION_SETS: { name: string; options: StepOption[] }[] = [
	{ name: 'NORMALIZATION_OPTIONS', options: NORMALIZATION_OPTIONS },
	{ name: 'STATUS_ENUM_OPTIONS', options: STATUS_ENUM_OPTIONS },
	{ name: 'WELCOME_EMAIL_OPTIONS', options: WELCOME_EMAIL_OPTIONS },
	{ name: 'EXTERNAL_SYNC_OPTIONS', options: EXTERNAL_SYNC_OPTIONS },
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

		test('the correct answer is never the first option in source order', () => {
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

		test('feedback never reveals the correct answer', () => {
			// "Distinctive" = a token in the correct answer's label that does NOT
			// appear in any wrong option's label. Tokens shared across options are
			// the level's domain language, not a leak.
			const tokenize = (s: string) =>
				s
					.toLowerCase()
					.split(/[\s,(){}<>:_[\]]+/)
					.filter((t) => t.length >= 5);
			for (const { name, options } of ALL_OPTION_SETS) {
				const correct = options.find((o) => o.correct);
				if (!correct) continue;
				const wrongTokens = new Set<string>();
				for (const opt of options) {
					if (opt.correct) continue;
					for (const t of tokenize(opt.label)) wrongTokens.add(t);
				}
				const distinctiveTokens = tokenize(correct.label).filter(
					(t) => !wrongTokens.has(t),
				);
				for (const opt of options) {
					if (opt.correct || !opt.feedback) continue;
					const fb = opt.feedback.toLowerCase();
					for (const token of distinctiveTokens) {
						expect(
							fb,
							`${name} feedback for ${opt.id} should not contain "${token}" (a token unique to the correct answer "${correct.label}")`,
						).not.toContain(token);
					}
				}
			}
		});
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

	describe('Code preview boundaries', () => {
		// For each step (k), the code preview shown WHILE the player is working
		// on that step is the result of step (k - 1). That preview must not
		// contain distinctive strings from step k's correct answer.
		const distinctiveAnswerStringsByStep: Record<number, string[]> = {
			0: ['normalizes :email'],
			1: ['enum :status, draft: "draft"'],
			2: ['send_welcome_email(@user)'],
			3: ['sync_to_accounting(@product.id)'],
		};

		test('preview shown while working on step k (= state after step k-1) does not contain step k answer signatures', () => {
			for (let k = 0; k < STEP_DEFS.length; k++) {
				const previewStep = k; // = furthestStep when working on step k
				const files = getCodeFiles('build', previewStep);
				const blob = files.map((f) => f.code).join('\n');
				for (const sig of distinctiveAnswerStringsByStep[k] ?? []) {
					expect(
						blob,
						`step ${k} preview (furthestStep=${previewStep}) must NOT contain "${sig}" before the player completes step ${k}`,
					).not.toContain(sig);
				}
			}
		});

		test('preview accumulates: each completed step produces visible artifacts', () => {
			// Sanity: the after-step-k preview must contain the just-completed step's signature
			const sigsAfterCompletion: Record<number, string[]> = {
				1: ['normalizes :email'],
				2: ['enum :status, draft: "draft"'],
				3: ['send_welcome_email'],
				4: ['sync_to_accounting'],
			};
			for (const [stepStr, sigs] of Object.entries(sigsAfterCompletion)) {
				const step = Number(stepStr);
				const files = getCodeFiles('build', step);
				const blob = files.map((f) => f.code).join('\n');
				for (const sig of sigs) {
					expect(
						blob,
						`after step ${step}, preview should contain "${sig}"`,
					).toContain(sig);
				}
			}
		});
	});

	describe('Production-safe defaults', () => {
		test('the correct status enum is string-encoded, not integer-encoded', () => {
			const correct = STATUS_ENUM_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('"draft"');
			expect(correct?.label).not.toMatch(/draft:\s*0/);
		});

		test('the correct welcome-email option lives in the controller, not the model', () => {
			const correct = WELCOME_EMAIL_OPTIONS.find((o) => o.correct);
			expect(correct?.label.toLowerCase()).toContain('controller');
		});

		test('the correct external-sync option fires the side effect from the controller, not a callback', () => {
			const correct = EXTERNAL_SYNC_OPTIONS.find((o) => o.correct);
			expect(correct?.label.toLowerCase()).toContain('controller');
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

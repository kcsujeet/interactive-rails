/**
 * Tests for Level 49: Feature Flags & Staged Rollouts
 *
 * Validates step quality (option set hygiene, terminal command hygiene,
 * feedback non-leakage), probe-to-discovery 1:1 mapping, probe-to-scenario
 * coverage, scenario uniqueness, code preview boundaries, and the production-
 * safe-default invariants for the level (Flipper.enabled? wrap, percentage_of_actors
 * rollout, admin UI behind admin auth).
 */

import { describe, expect, test } from 'bun:test';
import {
	expectEveryProbeDrivesDistinctChange,
	expectEveryProbeDrivesVisualChange,
} from '@/lib/testing/probe-pedagogy';
import {
	ALL_OPTION_SETS,
	CONFIGURE_ROLLOUT_OPTIONS,
	INSTALL_FLIPPER_COMMANDS,
	MOUNT_ADMIN_UI_OPTIONS,
	OPTION_STEP_CONFIG,
	RUN_INSTALLER_COMMANDS,
	STEP_DEFS,
	STEP_TYPES,
	WRAP_FEATURE_OPTIONS,
} from '../data/build-steps';
import { getCodeFiles } from '../data/code-files';
import { DISCOVERY_DEFS } from '../data/discoveries';
import {
	OBSERVE_CONNECTIONS,
	OBSERVE_STAGES,
	PROBE_OBSERVE_OVERRIDES,
	REWARD_CONNECTIONS,
	REWARD_STAGES,
	SCENARIO_REWARD_OVERRIDES,
} from '../data/pipeline-stages';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';

describe('Level 49: Feature Flags & Staged Rollouts', () => {
	describe('Step structure', () => {
		test('has 5 step definitions', () => {
			expect(STEP_DEFS).toHaveLength(5);
		});

		test('STEP_TYPES has the same length as STEP_DEFS', () => {
			expect(STEP_TYPES).toHaveLength(STEP_DEFS.length);
		});

		test('OPTION_STEP_CONFIG has an entry for each option-typed step', () => {
			for (let i = 0; i < STEP_DEFS.length; i++) {
				if (STEP_TYPES[i] === 'option') {
					expect(
						OPTION_STEP_CONFIG[i],
						`step ${i} is option-typed but has no OPTION_STEP_CONFIG entry`,
					).toBeDefined();
					expect(OPTION_STEP_CONFIG[i].title).toBe(STEP_DEFS[i].title);
				} else {
					expect(
						OPTION_STEP_CONFIG[i],
						`step ${i} is terminal-typed but has an OPTION_STEP_CONFIG entry`,
					).toBeUndefined();
				}
			}
		});

		test('every option set has at least 3 options', () => {
			for (const { name, options } of ALL_OPTION_SETS) {
				expect(options.length, `${name}`).toBeGreaterThanOrEqual(3);
			}
		});

		test('every option set has exactly one correct answer', () => {
			for (const { name, options } of ALL_OPTION_SETS) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount, `${name}`).toBe(1);
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
							`${name} ${opt.id} should have feedback`,
						).toBeTruthy();
					}
				}
			}
		});

		test('feedback never reveals the correct answer (distinctive tokens)', () => {
			// Distinctive token = a token in the correct answer's label that
			// does NOT appear in any wrong option's label. Tokens shared across
			// options are level domain language, not a leak.
			const tokenize = (s: string) =>
				s
					.toLowerCase()
					.split(/[\s,(){}<>:_[\].]+/)
					.filter((t) => t.length >= 6);

			for (const { name, options } of ALL_OPTION_SETS) {
				const correct = options.find((o) => o.correct);
				if (!correct) continue;
				const wrongTokens = new Set<string>();
				for (const opt of options) {
					if (opt.correct) continue;
					for (const t of tokenize(opt.label)) wrongTokens.add(t);
				}
				const distinctive = tokenize(correct.label).filter(
					(t) => !wrongTokens.has(t),
				);
				for (const opt of options) {
					if (opt.correct || !opt.feedback) continue;
					const fb = opt.feedback.toLowerCase();
					for (const token of distinctive) {
						expect(
							fb,
							`${name}.${opt.id} feedback contains "${token}", a token unique to the correct answer "${correct.label}"`,
						).not.toContain(token);
					}
				}
			}
		});
	});

	describe('Terminal command quality', () => {
		const TERMINAL_SETS = [
			{ name: 'INSTALL_FLIPPER_COMMANDS', commands: INSTALL_FLIPPER_COMMANDS },
			{ name: 'RUN_INSTALLER_COMMANDS', commands: RUN_INSTALLER_COMMANDS },
		];

		test('every terminal step has at least 3 commands', () => {
			for (const { name, commands } of TERMINAL_SETS) {
				expect(commands.length, name).toBeGreaterThanOrEqual(3);
			}
		});

		test('every terminal step has exactly one correct command', () => {
			for (const { name, commands } of TERMINAL_SETS) {
				expect(commands.filter((c) => c.correct).length, name).toBe(1);
			}
		});

		test('terminal-step correct answer is never the first option', () => {
			for (const { name, commands } of TERMINAL_SETS) {
				expect(commands[0]?.correct, name).toBe(false);
			}
		});

		test('every wrong terminal command has feedback', () => {
			for (const { name, commands } of TERMINAL_SETS) {
				for (const c of commands) {
					if (!c.correct) {
						expect(c.feedback, `${name} ${c.id}`).toBeTruthy();
					}
				}
			}
		});
	});

	describe('Discovery gating', () => {
		test('has 3 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(3);
		});

		test('every discovery id is unique', () => {
			const ids = new Set(DISCOVERY_DEFS.map((d) => d.id));
			expect(ids.size).toBe(DISCOVERY_DEFS.length);
		});

		test('PROBE_DISCOVERY_MAP is 1:1', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));

			for (const [probeId, discoveryId] of Object.entries(
				PROBE_DISCOVERY_MAP,
			)) {
				expect(probeIds.has(probeId), `probe ${probeId} not in PROBES`).toBe(
					true,
				);
				expect(
					discoveryIds.has(discoveryId),
					`discovery ${discoveryId} not in DISCOVERY_DEFS`,
				).toBe(true);
			}

			const mappedDiscoveries = Object.values(PROBE_DISCOVERY_MAP);
			expect(
				new Set(mappedDiscoveries).size,
				'two probes must not unlock the same discovery',
			).toBe(mappedDiscoveries.length);

			expect(
				Object.keys(PROBE_DISCOVERY_MAP).length,
				'every probe must unlock exactly one discovery',
			).toBe(PROBES.length);
		});
	});

	describe('Probe-to-scenario coverage', () => {
		test('every probe has a matching reward stress scenario with the same id', () => {
			const scenarioIds = new Set(STRESS_SCENARIOS.map((s) => s.id));
			for (const probe of PROBES) {
				expect(
					scenarioIds.has(probe.id),
					`probe ${probe.id} has no matching stress scenario`,
				).toBe(true);
			}
		});

		test('every probe and scenario label share the same prefix (the action) per the design-level mirror rule', () => {
			// design-level skill: probe and scenario labels mirror with a
			// parenthetical change ("POST create payment" ->
			// "POST create payment (with push)"). Identical labels are
			// also allowed. The shared prefix up to the first parenthetical
			// must match -- it identifies the action being replayed.
			const stripParenthetical = (s: string) =>
				s.replace(/\s*\([^)]*\)\s*$/, '').trim();
			for (const probe of PROBES) {
				const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
				expect(scenario, `no scenario for probe ${probe.id}`).toBeDefined();
				const probeAction = stripParenthetical(probe.label);
				const scenarioAction = stripParenthetical(scenario?.label ?? '');
				expect(
					scenarioAction,
					`probe "${probe.label}" and scenario "${scenario?.label}" do not share an action prefix`,
				).toBe(probeAction);
			}
		});

		test('reward scenarios are a strict superset of probes', () => {
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

		test('mix of allowed and blocked results (level shows both happy path and kill switch)', () => {
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

	describe('Pipeline visualization', () => {
		test('observe topology shows ONLY the system as it currently exists (no flag-gate, no legacy-processor)', () => {
			// The audit-level rule: "the observe phase visualization must
			// only show components that exist in the 'before' state."
			// The flag gate and the legacy processor as a routable
			// destination are added by the build phase. Showing them in
			// observe (even as "missing" placeholders) misleads the
			// player about what the current system actually looks like.
			const ids = new Set(OBSERVE_STAGES.map((s) => s.id));
			expect(ids.has('flag-gate')).toBe(false);
			expect(ids.has('legacy-processor')).toBe(false);
		});

		test('observe topology has exactly the three nodes that currently exist', () => {
			const ids = new Set(OBSERVE_STAGES.map((s) => s.id));
			expect(ids).toEqual(new Set(['client', 'app-server', 'new-processor']));
		});

		test('app-server carries the broken-state energy (variant critical, NO TOGGLE badge)', () => {
			const app = OBSERVE_STAGES.find((s) => s.id === 'app-server');
			expect(app?.variant).toBe('critical');
			expect(app?.badge).toBe('NO TOGGLE');
		});

		test('observe edges form a single linear path (client -> app -> new processor)', () => {
			const edges = OBSERVE_CONNECTIONS.map((c) => `${c.from}-${c.to}`);
			expect(edges).toEqual(['client-app-server', 'app-server-new-processor']);
		});

		test('reward topology adds the flag-gate and the legacy-processor (the build adds new infrastructure)', () => {
			const observeIds = new Set(OBSERVE_STAGES.map((s) => s.id));
			const rewardIds = new Set(REWARD_STAGES.map((s) => s.id));
			expect(rewardIds.has('flag-gate')).toBe(true);
			expect(rewardIds.has('legacy-processor')).toBe(true);
			// All observe nodes carry over to reward (capability is added,
			// the existing nodes are not replaced).
			for (const id of observeIds) {
				expect(rewardIds.has(id)).toBe(true);
			}
		});

		test('reward connections include both flag-gate -> new and flag-gate -> legacy edges (the fork)', () => {
			const toNew = REWARD_CONNECTIONS.find(
				(c) => c.from === 'flag-gate' && c.to === 'new-processor',
			);
			const toLegacy = REWARD_CONNECTIONS.find(
				(c) => c.from === 'flag-gate' && c.to === 'legacy-processor',
			);
			expect(toNew).toBeDefined();
			expect(toLegacy).toBeDefined();
		});

		test('every observe stage id is unique', () => {
			const ids = new Set(OBSERVE_STAGES.map((s) => s.id));
			expect(ids.size).toBe(OBSERVE_STAGES.length);
		});

		test('every reward stage id is unique', () => {
			const ids = new Set(REWARD_STAGES.map((s) => s.id));
			expect(ids.size).toBe(REWARD_STAGES.length);
		});
	});

	describe('Code preview boundaries', () => {
		// For step k, the preview the player sees while WORKING on step k is
		// the result of step (k-1). It must NOT contain step k's distinctive
		// answer signatures.
		const distinctiveByStep: Record<number, string[]> = {
			0: ['flipper-active_record', 'flipper-ui'],
			1: ['flipper:setup', 'db:migrate'],
			2: ['Flipper.enabled?'],
			3: ['enable_percentage_of_actors'],
			4: ['AdminConstraint', 'Flipper::UI'],
		};

		test('preview while working on step k does not contain step k answer signatures', () => {
			for (let k = 0; k < STEP_DEFS.length; k++) {
				const files = getCodeFiles('build', k);
				const blob = files.map((f) => f.code).join('\n');
				for (const sig of distinctiveByStep[k] ?? []) {
					expect(
						blob,
						`step ${k} preview must NOT contain "${sig}" before completing step ${k}`,
					).not.toContain(sig);
				}
			}
		});

		test('preview after completing all steps contains all production-safe defaults', () => {
			const files = getCodeFiles('reward', STEP_DEFS.length);
			const blob = files.map((f) => f.code).join('\n');
			expect(blob).toContain('Flipper.enabled?');
			expect(blob).toContain('Current.user');
			expect(blob).toContain('LegacyPaymentProcessor');
			expect(blob).toContain('constraints(AdminConstraint.new)');
			expect(blob).toContain('Flipper::UI.app(Flipper)');
			// Devise's authenticate helper must never appear (this app is on the
			// Rails 8 built-in auth generator).
			expect(blob).not.toContain('authenticate :user');
		});
	});

	describe('Production-safe defaults (level invariants)', () => {
		test('the wrap-feature correct answer uses Flipper.enabled? with an actor', () => {
			const correct = WRAP_FEATURE_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('Flipper.enabled?');
			expect(correct?.label).toContain('Current.user');
		});

		test('the rollout correct answer uses enable_percentage_of_actors (stable per actor)', () => {
			const correct = CONFIGURE_ROLLOUT_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('enable_percentage_of_actors');
			// Rule out percentage_of_time which produces flapping behaviour
			expect(correct?.label).not.toContain('percentage_of_time');
		});

		test('the admin-UI correct answer mounts inside a Rails route constraints block (not Devise authenticate)', () => {
			const correct = MOUNT_ADMIN_UI_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('constraints(AdminConstraint.new)');
			expect(correct?.label).toContain('Flipper::UI');
			// The Rails 8 built-in auth app has no Devise `authenticate` helper.
			expect(correct?.label).not.toContain('authenticate :user');
		});

		test('the Devise authenticate variant is present as a WRONG option', () => {
			const devise = MOUNT_ADMIN_UI_OPTIONS.find(
				(o) => o.id === 'wrong-devise-authenticate',
			);
			expect(devise?.correct).toBe(false);
			expect(devise?.label).toContain('authenticate :user');
			expect(devise?.feedback ?? '').toContain('Devise');
		});
	});

	describe('Validation logic', () => {
		test('valid only when all 5 steps complete', () => {
			const isComplete = (completedCount: number) =>
				completedCount === STEP_DEFS.length;
			expect(isComplete(0)).toBe(false);
			expect(isComplete(4)).toBe(false);
			expect(isComplete(5)).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Probe pedagogy (.agents/rules/pedagogy.md). Every probe must drive
	// a visible center-panel change, and no two probes may produce
	// identical visual state. The helpers come from
	// `@/lib/testing/probe-pedagogy`. This is the regression catch for
	// the original L49 Batch B bug, where probes only updated the
	// left-panel discovery checklist and the pipeline stayed static.
	// ─────────────────────────────────────────────────────────────────

	describe('Probe pedagogy (visible state change required)', () => {
		test('every probe has a PROBE_OBSERVE_OVERRIDES entry that mutates the pipeline', () => {
			expectEveryProbeDrivesVisualChange({
				probes: PROBES,
				probeStateMap: PROBE_OBSERVE_OVERRIDES,
				validate: (_probeId, override) => {
					const errs: string[] = [];
					const stages = override.stages ?? {};
					if (Object.keys(stages).length === 0) {
						errs.push('PROBE_OBSERVE_OVERRIDES.stages is empty');
						return errs;
					}
					const hasVisibleDelta = Object.values(stages).some(
						(s) =>
							s.badge !== undefined ||
							s.sublabel !== undefined ||
							s.variant !== undefined,
					);
					if (!hasVisibleDelta) {
						errs.push(
							'no stage override sets badge / sublabel / variant ' +
								'(nothing would visibly change on screen)',
						);
					}
					return errs;
				},
			});
		});

		test('every probe drives a DISTINCT visual state (no two probes produce the same overrides)', () => {
			expectEveryProbeDrivesDistinctChange({
				probes: PROBES,
				probeStateMap: PROBE_OBSERVE_OVERRIDES,
				serialize: (_id, override) =>
					JSON.stringify({
						stages: override.stages,
						edges: [...override.activeConnections].sort(),
					}),
			});
		});

		test('PROBE_OBSERVE_OVERRIDES activeConnections only reference real edges in OBSERVE_CONNECTIONS', () => {
			const validEdgeIds = new Set(
				OBSERVE_CONNECTIONS.map((c) => `${c.from}-${c.to}`),
			);
			for (const [probeId, override] of Object.entries(
				PROBE_OBSERVE_OVERRIDES,
			)) {
				for (const edgeId of override.activeConnections) {
					expect(
						validEdgeIds.has(edgeId),
						`probe "${probeId}" references unknown edge id "${edgeId}"`,
					).toBe(true);
				}
			}
		});

		test('every reward stress scenario has a SCENARIO_REWARD_OVERRIDES entry that mutates the pipeline', () => {
			expectEveryProbeDrivesVisualChange({
				probes: STRESS_SCENARIOS,
				probeStateMap: SCENARIO_REWARD_OVERRIDES,
				validate: (_id, override) => {
					const errs: string[] = [];
					const stages = override.stages ?? {};
					if (Object.keys(stages).length === 0) {
						errs.push('SCENARIO_REWARD_OVERRIDES.stages is empty');
						return errs;
					}
					const hasVisibleDelta = Object.values(stages).some(
						(s) =>
							s.badge !== undefined ||
							s.sublabel !== undefined ||
							s.variant !== undefined,
					);
					if (!hasVisibleDelta) {
						errs.push('no stage override sets badge / sublabel / variant');
					}
					return errs;
				},
			});
		});

		test('every reward scenario drives a DISTINCT visual state', () => {
			expectEveryProbeDrivesDistinctChange({
				probes: STRESS_SCENARIOS,
				probeStateMap: SCENARIO_REWARD_OVERRIDES,
				serialize: (_id, override) =>
					JSON.stringify({
						stages: override.stages,
						edges: [...override.activeConnections].sort(),
					}),
			});
		});

		test('SCENARIO_REWARD_OVERRIDES activeConnections only reference real edges in REWARD_CONNECTIONS', () => {
			const validEdgeIds = new Set(
				REWARD_CONNECTIONS.map((c) => `${c.from}-${c.to}`),
			);
			for (const [scenarioId, override] of Object.entries(
				SCENARIO_REWARD_OVERRIDES,
			)) {
				for (const edgeId of override.activeConnections) {
					expect(
						validEdgeIds.has(edgeId),
						`scenario "${scenarioId}" references unknown edge id "${edgeId}"`,
					).toBe(true);
				}
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Reward wiring (dead/duplicate-scenario regression, audit 2026-07-09).
// ---------------------------------------------------------------------------

describe('Level 50: reward wiring', () => {
	test('no two kill-switch scenarios duplicate each other', () => {
		const killScenarios = STRESS_SCENARIOS.filter((s) =>
			`${s.label} ${s.description}`.toLowerCase().includes('kill'),
		);
		expect(
			killScenarios.length,
			`kill-switch scenarios: ${killScenarios.map((s) => s.id).join(', ')}`,
		).toBeLessThanOrEqual(1);
	});

	test('every scenario has a reward override (no dead buttons)', () => {
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				SCENARIO_REWARD_OVERRIDES[scenario.id],
				`scenario "${scenario.id}" fires but changes nothing`,
			).toBeDefined();
		}
	});

	test('no orphan reward overrides', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const key of Object.keys(SCENARIO_REWARD_OVERRIDES)) {
			expect(ids.has(key), `override for "${key}" has no button`).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Cross-level honesty with L49 (kamal rollback is fast; a hand redeploy is
// not the alternative) and correct HTTP status for an unmatched route.
// ---------------------------------------------------------------------------

describe('Level 50: cross-level + HTTP correctness', () => {
	const probeText = (id: string) => {
		const p = PROBES.find((x) => x.id === id);
		return [
			...(p?.responseLines ?? []).map((l) => l.text),
			...((p?.story as string[] | undefined) ?? []),
		].join('\n');
	};

	test('no probe claims a 30-minute Kamal redeploy (L49: rollback is ~2s)', () => {
		for (const p of PROBES) {
			const blob = probeText(p.id);
			expect(blob).not.toContain('30 min');
			expect(blob).not.toContain('~30');
		}
	});

	test('vendor-flaky kill-switch probe returns 404 for the unmatched route, not 501', () => {
		const blob = probeText('vendor-flaky');
		expect(blob).toContain('404');
		expect(blob).not.toContain('501');
	});

	test('the flag advantage is framed as surgical scope vs full-release rollback', () => {
		const blob = probeText('rollout-everyone').toLowerCase();
		expect(blob).toContain('rollback');
		expect(blob).toContain('release');
	});
});

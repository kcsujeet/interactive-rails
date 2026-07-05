/**
 * Tests for Level 15: Callbacks & Normalizations
 *
 * After the 2026-05-09 tightening cut, the level has two on-concept steps:
 *   step 0: normalize the Product name (positive callback example)
 *   step 1: send the welcome email from the controller (negative callback example)
 * The status-enum step + the external-sync step were dropped (off-concept and
 * structurally redundant respectively). The customer-impact dashboard reduced
 * from 3 surfaces to 2 (Storefront Search + Signup Confirmation).
 *
 * Validates step quality, probe-to-discovery mapping, probe-to-scenario coverage,
 * the customer-impact damage payloads, that step feedback never reveals the
 * correct answer, and that player-visible text uses the post-L9 column name
 * (`email_address`, never `email`) and avoids the old zone-lane vocabulary
 * (Incoming Request / Normalizes / After Save) and future-axis vocab.
 */

import { describe, expect, test } from 'bun:test';
import {
	NORMALIZATION_OPTIONS,
	OPTION_STEP_CONFIG,
	STEP_DEFS,
	WELCOME_EMAIL_OPTIONS,
} from '../data/build-steps';
import { getCodeFiles } from '../data/code-files';
import { level15Callbacks } from '../data/content';
import { DISCOVERY_DEFS } from '../data/discoveries';
import { PROBE_DISCOVERY_MAP, PROBES } from '../data/probes';
import { STRESS_SCENARIOS } from '../data/stress-scenarios';
import type { StepOption } from '../types';

const ALL_OPTION_SETS: { name: string; options: StepOption[] }[] = [
	{ name: 'NORMALIZATION_OPTIONS', options: NORMALIZATION_OPTIONS },
	{ name: 'WELCOME_EMAIL_OPTIONS', options: WELCOME_EMAIL_OPTIONS },
];

// FORBIDDEN_VOCAB scans every player-visible string for vocabulary that
// belongs to later acts (deploy, CI, staging) or to the legacy zone-lane
// visualization (Incoming Request / Normalizes (Product) / After Save /
// Product Model as a label / "(skipped)"). Those labels were the old
// data-pipeline lens that the dashboard redesign replaced.
const FORBIDDEN_VOCAB = [
	'Deploy',
	'deploy',
	' CI ',
	'staging',
	'Staging',
	'Incoming Request',
	'Normalizes (Product)',
	'After Save',
	'Product Model',
	'(skipped)',
];

// `email:` (without `_address`) refers to the pre-L9 column name and must
// never appear in player-visible text. The regex anchors on `email` followed
// by `:` and *not* preceded by an underscore (so `email_address:` is allowed
// and `address.email_address` is allowed). Lookbehind is fine in modern JS.
const FORBIDDEN_EMAIL_KEY = /(?<!_)email:\s/;

describe('Level 15: Callbacks & Normalizations', () => {
	describe('Step structure', () => {
		test('has 2 step definitions (post-tightening: normalize + welcome-email anti-callback)', () => {
			expect(STEP_DEFS).toHaveLength(2);
		});

		test('Step 0 normalizes the Product name (not the User email)', () => {
			expect(STEP_DEFS[0].title).toBe('Normalize the Product Name');
			expect(STEP_DEFS[0].title).not.toContain('Email');
		});

		test('Step 1 sends the welcome email (anti-callback example)', () => {
			expect(STEP_DEFS[1].title).toBe('Send the Welcome Email');
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

		test('feedback never names the correct answer keyword (across the whole level)', () => {
			// Cross-step leak: feedback in step N must not contain the answer
			// keyword from step N (covered above) AND should not name keywords
			// from this level's other answers as foils.
			const HARD_LEAK_KEYWORDS_BY_STEP: Record<number, string[]> = {
				0: ['normalizes :name'],
				1: ['send_welcome_email(@user)', 'UsersController#create'],
			};
			const stepIndexByOptionsName: Record<string, number> = {
				NORMALIZATION_OPTIONS: 0,
				WELCOME_EMAIL_OPTIONS: 1,
			};
			for (const { name, options } of ALL_OPTION_SETS) {
				const idx = stepIndexByOptionsName[name];
				const leakKeywords = HARD_LEAK_KEYWORDS_BY_STEP[idx] ?? [];
				for (const opt of options) {
					if (opt.correct || !opt.feedback) continue;
					for (const k of leakKeywords) {
						expect(
							opt.feedback.toLowerCase(),
							`${name} feedback for ${opt.id} must not contain answer keyword "${k}"`,
						).not.toContain(k.toLowerCase());
					}
				}
			}
		});
	});

	describe('Discovery gating', () => {
		test('every discovery id is unique', () => {
			const ids = new Set(DISCOVERY_DEFS.map((d) => d.id));
			expect(ids.size).toBe(DISCOVERY_DEFS.length);
		});

		test('discoveries describe customer-facing damage (not artifact mechanics)', () => {
			const expected = new Set(['buyer-cant-find', 'duplicate-accounts']);
			expect(new Set(DISCOVERY_DEFS.map((d) => d.id))).toEqual(expected);
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

		test('PROBE_DISCOVERY_MAP covers every probe (1:1 with discoveries)', () => {
			expect(Object.keys(PROBE_DISCOVERY_MAP).length).toBe(PROBES.length);
			expect(Object.keys(PROBE_DISCOVERY_MAP).length).toBe(
				DISCOVERY_DEFS.length,
			);
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

	describe('Customer-impact dashboard payloads', () => {
		// Every probe must paint damage on exactly one customer-facing surface
		// and have at least one incident-log entry. The build phase introduces
		// the fix; observe must show the customer cost. Post-tightening, the
		// dashboard has 2 surfaces (storefront, signup) and 2 probes.

		test('every probe has a damage payload', () => {
			for (const probe of PROBES) {
				expect(probe.damage, `probe ${probe.id} missing damage`).toBeDefined();
			}
		});

		test('every probe targets exactly one customer-facing surface', () => {
			for (const probe of PROBES) {
				const flags = [
					probe.damage.storefront ? 1 : 0,
					probe.damage.signup ? 1 : 0,
				];
				const total = flags.reduce((a, b) => a + b, 0);
				expect(
					total,
					`probe ${probe.id} should hit exactly one surface, got ${total}`,
				).toBe(1);
			}
		});

		test('every surface is hit by exactly one probe (1:1 with discoveries)', () => {
			const surfaceProbes = {
				storefront: PROBES.filter((p) => p.damage.storefront).map((p) => p.id),
				signup: PROBES.filter((p) => p.damage.signup).map((p) => p.id),
			};
			expect(surfaceProbes.storefront).toEqual(['buyer-search-misses']);
			expect(surfaceProbes.signup).toEqual(['duplicate-signup']);
		});

		test('every probe has at least one incident log entry', () => {
			for (const probe of PROBES) {
				expect(
					probe.damage.incidentLog.length,
					`probe ${probe.id} incident log empty`,
				).toBeGreaterThan(0);
			}
		});

		test('storefront damage shows the dirty stored value', () => {
			const probe = PROBES.find((p) => p.id === 'buyer-search-misses');
			expect(probe?.damage.storefront?.storedValue).toContain('Ceramic Mug');
			// Must reflect the dirty whitespace surface.
			expect(probe?.damage.storefront?.storedValue).toMatch(/\s\s/);
		});

		test('signup damage shows two distinct accounts', () => {
			const probe = PROBES.find((p) => p.id === 'duplicate-signup');
			const dmg = probe?.damage.signup;
			expect(dmg).toBeDefined();
			expect(dmg?.primaryEmail).not.toBe(dmg?.duplicateEmail);
			expect(dmg?.primaryEmail).toContain('@');
			expect(dmg?.duplicateEmail).toContain('@');
		});

		test('only the two on-concept probes exist (no listing/oversold leak)', () => {
			const ids = new Set(PROBES.map((p) => p.id));
			expect(ids).toEqual(new Set(['buyer-search-misses', 'duplicate-signup']));
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

		test('all scenarios are "allowed" (post-tightening: no naturally-blocked path)', () => {
			// The generic testing.md "mix of allowed/blocked results" rule applies
			// to security/access levels (L11 authorization, L13 strong params)
			// where the fix actively rejects bad requests. L15 fixes data shape
			// and side-effect placement; every customer-facing request still
			// succeeds end-to-end. Forcing a blocked scenario here would pad
			// data to satisfy a rule, which is the inverse of the L15 tightening
			// lesson (don't pad to satisfy a generic rule).
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			expect(allowed.length).toBe(STRESS_SCENARIOS.length);
		});
	});

	describe('Code preview boundaries', () => {
		// For each step (k), the code preview shown WHILE the player is working
		// on that step is the result of step (k - 1). That preview must not
		// contain distinctive strings from step k's correct answer.
		const distinctiveAnswerStringsByStep: Record<number, string[]> = {
			0: ['normalizes :name'],
			1: ['send_welcome_email(@user)'],
		};

		test('observe preview must NOT contain any normalizes reference (step 0 leak)', () => {
			// User.rb in real myapp ships with `normalizes :email_address` from
			// the L9 Rails 8 auth generator. Showing User in observe pre-leaks
			// the step 0 answer pattern (player only has to swap field name and
			// lambda body). Observe shows only the broken Product model.
			const files = getCodeFiles('observe', 0);
			const blob = files.map((f) => f.code).join('\n');
			expect(
				blob,
				'observe must not contain `normalizes` -- that is the step 0 answer pattern',
			).not.toContain('normalizes ');
		});

		test('observe preview shows only the broken Product model (no User leak)', () => {
			const files = getCodeFiles('observe', 0);
			const filenames = files.map((f) => f.filename);
			expect(filenames).toContain('app/models/product.rb');
			expect(
				filenames,
				'app/models/user.rb in real myapp contains `normalizes :email_address` (pre-leaks step 0). Hide it in observe; reintroduce in build/reward.',
			).not.toContain('app/models/user.rb');
		});

		test('preview shown while working on step k (= codePreviewStep = k - 1) does not contain step k answer signatures', () => {
			// Caller convention (Level15Callbacks.tsx):
			//   codePreviewStep = isCurrentStepCompleted ? currentStep : currentStep - 1
			// So while working on step k *before* completing it, codePreviewStep = k - 1.
			for (let k = 0; k < STEP_DEFS.length; k++) {
				const previewStep = k - 1;
				const files = getCodeFiles('build', previewStep);
				const blob = files.map((f) => f.code).join('\n');
				for (const sig of distinctiveAnswerStringsByStep[k] ?? []) {
					expect(
						blob,
						`step ${k} preview (codePreviewStep=${previewStep}) must NOT contain "${sig}" before the player completes step ${k}`,
					).not.toContain(sig);
				}
			}
		});

		test('preview accumulates: each just-completed step produces its visible artifact', () => {
			// Caller convention: when step k is the last completed step, codePreviewStep = k.
			// So getCodeFiles('build', k) = state immediately after step k just completed.
			const sigsAfterCompletion: Record<number, string[]> = {
				0: ['normalizes :name'],
				1: ['send_welcome_email(@user)'],
			};
			for (const [stepStr, sigs] of Object.entries(sigsAfterCompletion)) {
				const step = Number(stepStr);
				const files = getCodeFiles('build', step);
				const blob = files.map((f) => f.code).join('\n');
				for (const sig of sigs) {
					expect(
						blob,
						`after step ${step} just completed (codePreviewStep=${step}), preview should contain "${sig}"`,
					).toContain(sig);
				}
			}
		});

		test('after step 1 just completed, UsersController#create is visible in the preview', () => {
			// Reproduces the bug surfaced in the screenshot: player completes
			// "Send the Welcome Email" but the controller code does not appear.
			const files = getCodeFiles('build', 1);
			const filenames = files.map((f) => f.filename);
			expect(filenames).toContain('app/controllers/users_controller.rb');
		});

		test('no enum / migration / products controller bleed into the preview (post-tightening)', () => {
			// Status enum, migration, and ProductsController#mark_sold were dropped.
			// Walk every furthestStep value and assert their distinctive strings never appear.
			for (let s = -1; s <= STEP_DEFS.length; s++) {
				const blob = getCodeFiles('build', s)
					.map((f) => f.code)
					.join('\n');
				expect(blob, `step ${s} blob`).not.toContain('enum :status');
				expect(blob, `step ${s} blob`).not.toContain('mark_sold');
				expect(blob, `step ${s} blob`).not.toContain('sync_to_accounting');
				expect(blob, `step ${s} blob`).not.toContain('AddStatusToProducts');
			}
		});
	});

	describe('Production-safe defaults', () => {
		test('the correct welcome-email option lives in the controller, not the model', () => {
			const correct = WELCOME_EMAIL_OPTIONS.find((o) => o.correct);
			expect(correct?.label.toLowerCase()).toContain('controller');
		});

		test('the correct normalize option targets Product.name (the L9 user already has email_address normalization)', () => {
			const correct = NORMALIZATION_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain('normalizes :name');
			// Negative: must not target email/email_address (that lesson was at L9)
			expect(correct?.label).not.toContain(':email');
		});
	});

	describe('Validation logic', () => {
		test('valid only when both steps complete', () => {
			const isComplete = (completedCount: number) =>
				completedCount === STEP_DEFS.length;
			expect(isComplete(0)).toBe(false);
			expect(isComplete(1)).toBe(false);
			expect(isComplete(2)).toBe(true);
		});
	});

	describe('Player-visible vocabulary (cumulative-pattern axis)', () => {
		// Every player-visible string must:
		// 1. Use email_address, never `email:` (the User column was renamed at L9).
		// 2. Avoid future-axis words (Deploy, CI, staging), those belong to Acts 7-8.
		// 3. Avoid the old zone-lane labels (Incoming Request, Normalizes (Product),
		//    After Save, Product Model, "(skipped)") -- those were the data-pipeline
		//    lens that the customer-impact dashboard redesign replaced.

		const allPlayerVisibleStrings = (): string[] => {
			const strings: string[] = [];
			// Trigger + problem + learning content
			strings.push(level15Callbacks.trigger.description);
			strings.push(level15Callbacks.problem.observation);
			strings.push(level15Callbacks.problem.codeExample ?? '');
			strings.push(level15Callbacks.problem.goal ?? '');
			if (level15Callbacks.hint) strings.push(level15Callbacks.hint.text);
			const lc = level15Callbacks.learningContent;
			if (lc) {
				strings.push(lc.title, lc.goal, lc.conceptExplanation);
				strings.push(lc.railsCodeExample ?? '');
				strings.push(lc.whenToUse ?? '');
				strings.push(...(lc.commonMistakes ?? []));
			}
			// Probes
			for (const probe of PROBES) {
				strings.push(probe.label, probe.command);
				strings.push(...probe.responseLines.map((l) => l.text));
				strings.push(...(probe.story ?? []));
				strings.push(...probe.damage.incidentLog);
				if (probe.damage.storefront) {
					strings.push(probe.damage.storefront.storedValue);
				}
				if (probe.damage.signup) {
					strings.push(probe.damage.signup.primaryEmail);
					strings.push(probe.damage.signup.duplicateEmail);
				}
			}
			// Stress scenarios
			for (const sc of STRESS_SCENARIOS) {
				strings.push(sc.label, sc.description, sc.path, sc.actor);
				if (sc.responseLines) {
					strings.push(...sc.responseLines.map((l) => l.text));
				}
				if (sc.story) {
					strings.push(...sc.story);
				}
			}
			// Step content
			for (const cfg of Object.values(OPTION_STEP_CONFIG)) {
				strings.push(cfg.title, cfg.description);
				for (const opt of cfg.options) {
					strings.push(opt.label, opt.feedback ?? '');
				}
			}
			// Discovery labels
			for (const d of DISCOVERY_DEFS) strings.push(d.label);
			return strings.filter((s) => s.length > 0);
		};

		test('no player-visible string contains the bare `email:` key (must be email_address)', () => {
			for (const s of allPlayerVisibleStrings()) {
				expect(
					s,
					`player-visible string "${s}" uses bare "email:" (should be email_address)`,
				).not.toMatch(FORBIDDEN_EMAIL_KEY);
			}
		});

		test('no player-visible string contains forbidden vocabulary (future-act + old-zone-labels)', () => {
			for (const s of allPlayerVisibleStrings()) {
				for (const forbidden of FORBIDDEN_VOCAB) {
					expect(
						s,
						`player-visible string contains forbidden token "${forbidden}": "${s}"`,
					).not.toContain(forbidden);
				}
			}
		});

		test('no player-visible string mentions the dropped enum / sync concepts', () => {
			// Status enum + sync_to_accounting were dropped during tightening.
			// No player-visible text should reference them anymore.
			const droppedTokens = [
				'enum :status',
				'sync_to_accounting',
				'mark_sold',
				'AccountingApi',
				'accounting',
				'lifecycle field',
				'status enum',
				'state machine',
			];
			for (const s of allPlayerVisibleStrings()) {
				for (const token of droppedTokens) {
					expect(
						s.toLowerCase(),
						`player-visible string mentions dropped concept "${token}": "${s}"`,
					).not.toContain(token.toLowerCase());
				}
			}
		});
	});
});

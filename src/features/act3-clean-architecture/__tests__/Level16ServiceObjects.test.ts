/**
 * Level 16: Service Objects. Post-redesign tests (2026-07-10).
 *
 * The redesign anchors the before-state to myapp ground truth (level-15
 * tag): the real signup lives in UsersController with email_address/
 * password fields, the welcome-email side effect from the callbacks
 * level, and an auto-login session whose token the response returns.
 * Pins here guard the audit's P-findings:
 *   - The thin controller must STILL return the session token (the old
 *     "fixed" code silently dropped it: a regression taught as the
 *     answer).
 *   - No validation-in-service: model validations (from the validations
 *     level) stay the single source of truth; the service branches on
 *     user.save only.
 *   - No invented APIs: generate_token_for(:session) and the phantom
 *     Api::RegistrationsController / display_name fields are banned.
 *   - The reward is interactive: scenarios with frames, not a poster.
 * Data.define(:success?, ...) syntax verified on Ruby 4.0.1 (myapp's
 * interpreter) before pinning.
 */

import { describe, expect, test } from 'bun:test';
import {
	expectBuildStepQuality,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	getCodeFiles,
	OPTION_STEP_CONFIG,
	REWARD_SCENARIO_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-16-service-objects/Level16ServiceObjects';

const allPreviewCode = () => {
	const chunks: string[] = [];
	for (const phase of ['intro', 'build', 'reward'] as const) {
		for (let step = -1; step <= STEP_DEFS.length; step++) {
			for (const f of getCodeFiles(phase, step)) {
				chunks.push(`${f.filename}\n${f.code}`);
			}
		}
	}
	return chunks.join('\n');
};

describe('Level 16: ground truth (myapp level-15 anchoring)', () => {
	test('the before-state is the real UsersController grown fat', () => {
		const intro = getCodeFiles('intro', -1)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');
		expect(intro).toContain('app/controllers/users_controller.rb');
		expect(intro).toContain('allow_unauthenticated_access only: :create');
		expect(intro).toContain('email_address');
		expect(intro).toContain('sessions.create!');
		expect(intro).toContain('token: session.token');
		expect(intro).toContain('send_welcome_email');
	});

	test('invented APIs from the old level are gone everywhere', () => {
		const all = allPreviewCode();
		for (const forbidden of [
			'generate_token_for',
			'display_name',
			'Api::RegistrationsController',
			'DefaultPreferences.apply',
		]) {
			expect(all.includes(forbidden), `preview contains "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('no validation-in-service or validation-in-controller anywhere', () => {
		// Model validations (validations level) are the source of truth;
		// the service branches on user.save only.
		const all = allPreviewCode();
		for (const forbidden of [
			'params[:email].blank?',
			'params[:password].length',
			'@params[:email_address].blank?',
			'@params[:password].length',
			'"Email required"',
			'"Password too short"',
		]) {
			expect(all.includes(forbidden), `preview contains "${forbidden}"`).toBe(
				false,
			);
		}
	});
});

describe('Level 16: the token regression is fixed', () => {
	test('the thin controller still returns the session token', () => {
		const done = getCodeFiles('build', STEP_DEFS.length)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');
		const controller = done.slice(done.indexOf('users_controller.rb'));
		expect(controller).toContain('result.user.sessions.create!');
		expect(controller).toContain('token: session.token');
	});

	test('the session stays in the controller, not the service', () => {
		const done = getCodeFiles('build', STEP_DEFS.length);
		const service = done.find((f) =>
			f.filename.includes('user_registration.rb'),
		);
		expect(service).toBeDefined();
		expect(service?.code.includes('sessions.create!')).toBe(false);
		expect(service?.code.includes('request.')).toBe(false);
	});

	test('the final service uses the canonical verified Result shape', () => {
		const done = getCodeFiles('build', STEP_DEFS.length);
		const service = done.find((f) =>
			f.filename.includes('user_registration.rb'),
		);
		expect(service?.code).toContain(
			'Result = Data.define(:success?, :user, :errors)',
		);
		expect(service?.code).toContain('user.errors.full_messages');
	});
});

describe('Level 16: build steps', () => {
	test('step defs are the 4-step chain', () => {
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'choose-pattern',
			'define-result',
			'move-side-effects',
			'wire-controller',
		]);
	});

	test('option steps are 0-3, exactly three options each, quality rules pass', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			0, 1, 2, 3,
		]);
		for (const [index, config] of Object.entries(OPTION_STEP_CONFIG)) {
			expect(config.options.length, `step ${index} option count`).toBe(3);
			expectBuildStepQuality({
				name: `step-${index} (${config.title})`,
				options: config.options,
			});
		}
	});

	test('wrong-option feedback never contains that step answer tokens', () => {
		const stepAnswerTokens: [number, string[]][] = [
			[0, ['PORO', 'service class', 'UserRegistration']],
			[1, ['Data.define', 'Data ']],
			[2, ['#call', 'sequentially']],
			[3, ['.call(', 'class-level', 'class method']],
		];
		for (const [index, tokens] of stepAnswerTokens) {
			const config = OPTION_STEP_CONFIG[index];
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
});

describe('Level 16: code preview boundaries', () => {
	const previewAt = (completedStep: number) =>
		getCodeFiles('build', completedStep)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');

	test('preview while working on step N never contains step N answers', () => {
		const leaks: [number, string[]][] = [
			[0, ['UserRegistration', 'app/services']],
			[1, ['Data.define', 'Result =']],
			[2, ['apply_default_preferences']],
			[3, ['UserRegistration.call', 'self.call', 'ApplicationService']],
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

	test('preview grows step by step', () => {
		expect(previewAt(0)).toContain('app/services/user_registration.rb');
		expect(previewAt(1)).toContain(
			'Result = Data.define(:success?, :user, :errors)',
		);
		expect(previewAt(2)).toContain('apply_default_preferences');
		const done = previewAt(STEP_DEFS.length);
		expect(done).toContain('app/services/application_service.rb');
		expect(done).toContain('UserRegistration.call(user_params)');
	});
});

describe('Level 16: interactive reward (no more static poster)', () => {
	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('the reward demonstrates the reuse claims the old poster only asserted', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id).sort();
		expect(ids).toEqual([
			'api-signup',
			'invalid-signup',
			'rake-import',
			'unit-test',
		]);
		const text = JSON.stringify(STRESS_SCENARIOS);
		expect(text).toContain('CSV');
		expect(text.toLowerCase()).toContain('without http');
	});

	test('every scenario has frames; no orphans; all distinct', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_SCENARIO_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
		for (const key of Object.keys(REWARD_SCENARIO_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: STRESS_SCENARIOS,
			probeStateMap: REWARD_SCENARIO_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('the failure scenario shows a clean failure Result, not an exception', () => {
		const frames = JSON.stringify(
			REWARD_SCENARIO_FRAMES['invalid-signup'],
		).toLowerCase();
		expect(frames).toContain('422');
		expect(frames).toContain('failure');
	});

	test('the rake import does not log anyone in', () => {
		const frames = JSON.stringify(REWARD_SCENARIO_FRAMES['rake-import']);
		expect(frames.toLowerCase()).toContain('no sessions');
	});
});

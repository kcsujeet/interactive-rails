/**
 * Level 18: Validation Contracts. Tests pin the review-finding fixes and
 * import the real component data so drift is caught at type-check time.
 *
 * dry-validation facts verified against canonical docs on 2026-07-20:
 * - Reuse predefined schemas by passing them to `params` as comma-separated
 *   arguments: `params(SchemaA, SchemaB)`. The `&` operator is NOT the
 *   documented composition mechanism and raises on current dry-validation.
 *   https://dry-rb.org/gems/dry-validation/ (schemas: reusing schemas)
 *
 * Ground-truth anchoring (L16 service objects):
 * - ApplicationService only defines `self.call`; it has NO initializer, so
 *   UserRegistration must define its own `initialize(params)` (no `super`).
 * - Result = Data.define(:success?, :user, :errors): every construction
 *   must pass all three members.
 * - The app column is `email_address`, not `email`. L16 established
 *   preferences as User columns, so no separate Profile/NotificationPref
 *   models are persisted.
 */

import { describe, expect, test } from 'bun:test';
import {
	expectBuildStepQuality,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	COMPOSE_CONTRACT_OPTIONS,
	CROSS_FIELD_RULE_OPTIONS,
	getCodeFiles,
	INSTALL_GEM_COMMANDS,
	INSTALL_GEM_OUTPUT,
	REWARD_SCENARIO_FRAMES,
	SCHEMA_APPROACH_OPTIONS,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../Level18ValidationContracts';

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

describe('Level 18: build step quality', () => {
	const STEP_OPTION_SETS = [
		{ name: 'install-gem', options: INSTALL_GEM_COMMANDS },
		{ name: 'schema-approach', options: SCHEMA_APPROACH_OPTIONS },
		{ name: 'compose-contract', options: COMPOSE_CONTRACT_OPTIONS },
		{ name: 'cross-field-rule', options: CROSS_FIELD_RULE_OPTIONS },
	];

	test('every step: exactly one correct, correct never first, feedback present', () => {
		for (const set of STEP_OPTION_SETS) {
			expectBuildStepQuality({ name: set.name, options: set.options });
		}
	});

	test('compose-contract correct answer uses comma-separated schemas, not the & operator', () => {
		const correct = COMPOSE_CONTRACT_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe(
			'params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)',
		);
		expect(correct?.label.includes(' & ')).toBe(false);
	});

	test('the & operator is a wrong option; its feedback does not reveal the comma form', () => {
		const andOption = COMPOSE_CONTRACT_OPTIONS.find(
			(o) => o.id === 'and-operator',
		);
		expect(andOption?.correct).toBe(false);
		expect(andOption?.label.includes(' & ')).toBe(true);
		expect(andOption?.feedback?.toLowerCase().includes('comma')).toBe(false);
		expect(andOption?.feedback?.includes('as arguments')).toBe(false);
	});

	test('before_action wrong option names the controller, not "back in the service"', () => {
		const opt = CROSS_FIELD_RULE_OPTIONS.find((o) => o.id === 'before-action');
		expect(opt?.feedback).toContain('controller');
		expect(opt?.feedback?.includes('back in the service')).toBe(false);
	});

	test('schema-approach correct answer uses email_address, never bare :email', () => {
		const correct = SCHEMA_APPROACH_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain(':email_address');
		expect(correct?.label.includes(':email)')).toBe(false);
	});

	test('gem install output only claims dry-validation is added to the Gemfile', () => {
		const joined = INSTALL_GEM_OUTPUT.map((l) => l.text).join('\n');
		expect(joined).toContain('dry-validation added to Gemfile');
		expect(joined.includes('and dry-schema added to Gemfile')).toBe(false);
		expect(joined.toLowerCase()).toContain('dependency');
	});
});

describe('Level 18: code preview correctness', () => {
	test('no preview ever composes schemas with the & operator', () => {
		const all = allPreviewCode();
		expect(all.includes('UserSchema & ')).toBe(false);
		expect(all.includes('ProfileSchema & ')).toBe(false);
		expect(all.includes('& NotifPrefsSchema')).toBe(false);
	});

	test('the contract preview uses the comma-arg params form', () => {
		const contract = getCodeFiles('build', STEP_DEFS.length).find((f) =>
			f.filename.includes('registration_contract.rb'),
		);
		expect(contract?.code).toContain(
			'params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)',
		);
	});

	test('every Result construction passes all three Data.define members', () => {
		// success?, user, errors. A Result.new(...) that omits user: or
		// errors: would crash against Data.define(:success?, :user, :errors).
		const all = allPreviewCode();
		expect(all.includes('Result.new(success?: true, data:')).toBe(false);
		expect(all.includes('success?: false, errors:')).toBe(false);
		// The final service returns the canonical success and failure shapes.
		const service = getCodeFiles('build', STEP_DEFS.length).find((f) =>
			f.filename.includes('user_registration.rb'),
		);
		expect(service?.code).toContain(
			'Result = Data.define(:success?, :user, :errors)',
		);
		expect(service?.code).toContain(
			'Result.new(success?: true, user: user, errors: [])',
		);
	});

	test('the reward preview drops the old scattered inline validations', () => {
		const service = getCodeFiles('build', STEP_DEFS.length).find((f) =>
			f.filename.includes('user_registration.rb'),
		);
		// The fixed service delegates to the contract; the inline early-return
		// field checks from the intro must be gone.
		expect(service?.code).toContain('RegistrationContract.new.call(@params)');
		expect(service?.code.includes('Password too short')).toBe(false);
		expect(service?.code.includes('Name required')).toBe(false);
	});

	test('the final service defines its own initialize (ApplicationService has no super)', () => {
		const service = getCodeFiles('build', STEP_DEFS.length).find((f) =>
			f.filename.includes('user_registration.rb'),
		);
		expect(service?.code).toContain('def initialize(params)');
		expect(service?.code.includes('super(params)')).toBe(false);
	});

	test('previews use email_address and never invent Profile/NotificationPref models', () => {
		const all = allPreviewCode();
		expect(all).toContain('email_address');
		expect(all.includes('@params[:email]')).toBe(false);
		expect(all.includes('Profile.create!')).toBe(false);
		expect(all.includes('NotificationPref.create!')).toBe(false);
	});
});

describe('Level 18: interactive reward (no more static poster)', () => {
	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('the four scenarios replay the intro damage stories plus the valid path', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id).sort();
		expect(ids).toEqual([
			'all-errors-at-once',
			'creator-cross-field',
			'malformed-payload',
			'valid-signup',
		]);
		// Exactly one allowed path (the valid signup); the three damage
		// stories all come back as blocked 422s.
		const allowed = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'allowed',
		).map((s) => s.id);
		expect(allowed).toEqual(['valid-signup']);
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

	test('all-errors-at-once returns four field errors in one response', () => {
		const scenario = STRESS_SCENARIOS.find(
			(s) => s.id === 'all-errors-at-once',
		);
		const lines = (scenario?.responseLines ?? []).map((l) => l.text).join('\n');
		expect(lines).toContain('422');
		expect(lines.toLowerCase()).toContain('one round trip');
		// The frames flag all four bad fields at once (not one at a time).
		const frames = JSON.stringify(REWARD_SCENARIO_FRAMES['all-errors-at-once']);
		expect(frames).toContain('"email_address"');
		expect(frames).toContain('"password"');
		expect(frames).toContain('"display_name"');
		expect(frames).toContain('"email_digest"');
	});

	test('malformed-payload is a clean 422 at the schema layer, never a 500', () => {
		const scenario = STRESS_SCENARIOS.find((s) => s.id === 'malformed-payload');
		const lines = (scenario?.responseLines ?? []).map((l) => l.text).join('\n');
		expect(lines).toContain('422');
		const story = (scenario?.story ?? []).join('\n');
		expect(story).toContain('500');
		const frames = JSON.stringify(
			REWARD_SCENARIO_FRAMES['malformed-payload'],
		).toLowerCase();
		expect(frames).toContain('must be a string');
		expect(frames).toContain('no crash');
		// The reward frames must NOT show the endpoint crashing.
		expect(frames.includes('500')).toBe(false);
	});

	test('creator-cross-field keys the failure to :role via the rules layer', () => {
		const frames = JSON.stringify(
			REWARD_SCENARIO_FRAMES['creator-cross-field'],
		);
		expect(frames).toContain('"rules"');
		expect(frames.toLowerCase()).toContain('role');
		const scenario = STRESS_SCENARIOS.find(
			(s) => s.id === 'creator-cross-field',
		);
		const lines = (scenario?.responseLines ?? []).map((l) => l.text).join('\n');
		expect(lines).toContain('role');
	});

	test('valid-signup persists and leaves uniqueness to the model', () => {
		const frames = JSON.stringify(
			REWARD_SCENARIO_FRAMES['valid-signup'],
		).toLowerCase();
		expect(frames).toContain('201');
		const scenario = STRESS_SCENARIOS.find((s) => s.id === 'valid-signup');
		const story = (scenario?.story ?? []).join('\n').toLowerCase();
		expect(story).toContain('uniqueness');
	});
});

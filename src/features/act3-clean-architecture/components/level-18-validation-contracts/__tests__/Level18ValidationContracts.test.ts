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
import { expectBuildStepQuality } from '@/lib/testing/level-pedagogy';
import {
	COMPOSE_CONTRACT_OPTIONS,
	CROSS_FIELD_RULE_OPTIONS,
	getCodeFiles,
	INSTALL_GEM_COMMANDS,
	INSTALL_GEM_OUTPUT,
	SCHEMA_APPROACH_OPTIONS,
	STEP_DEFS,
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

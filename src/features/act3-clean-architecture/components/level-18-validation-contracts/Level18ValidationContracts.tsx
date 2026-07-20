/**
 * Level 18: Validation Contracts
 *
 * Sequential phase flow: intro -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): the validation gauntlet in its broken state.
 *   A signup payload with several bad fields hits the L16 service, which
 *   checks fields one at a time and RETURNS at the first bad one, so the
 *   customer only ever sees one error and has to resubmit again and again.
 *   The round-trip strip and damage callout make the cost visible.
 * Phase 2 (HOW - build): 4 steps (1 TerminalChoice + 3 OptionCard)
 *   Step 0: Install dry-validation gem (TerminalChoiceStep)
 *   Step 1: Choose schema approach (OptionCard)
 *   Step 2: Compose the contract (OptionCard)
 *   Step 3: Add cross-field rule (OptionCard)
 * Phase 3 (ADVANTAGE - reward): the same gauntlet, now a RegistrationContract
 *   with a Schema layer + Rules layer. The player fires the same signup
 *   stories from the intro and watches the contract return every error in one
 *   response, reject malformed input with a clean 422, and key the cross-field
 *   failure to :role. The valid signup shows the model still owning uniqueness.
 *
 * Visualization: custom ValidationGauntletFlow (state-driven, frame-animated),
 * matching the L16 service-objects reward pattern.
 *
 * Teaches: dry-validation gem, Dry::Schema.Params, schema composition,
 * cross-field rules, and the contract-vs-model-validation boundary.
 */

import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import {
	type EdgeVizState,
	type FieldChip,
	type GauntletVizState,
	ValidationGauntletFlow,
	type ValidatorVizState,
} from './ValidationGauntletFlow';

registerLevelCode('act3-level18-validation-contracts', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Step definitions (1 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install dry-validation' },
	{ id: 'schema-approach', title: 'Choose Schema Approach' },
	{ id: 'compose-contract', title: 'Compose the Contract' },
	{ id: 'cross-field-rule', title: 'Add Cross-Field Rule' },
];

// ──────────────────────────────────────────────
// Terminal step data (step 0)
// ──────────────────────────────────────────────

export const INSTALL_GEM_COMMANDS = [
	{
		id: 'npm-install',
		label: 'npm install dry-validation',
		command: 'npm install dry-validation',
		correct: false,
		feedback:
			'dry-validation is a Ruby gem, not an npm package. Ruby gems are installed through a different tool.',
	},
	{
		id: 'gem-install',
		label: 'gem install dry-validation',
		command: 'gem install dry-validation',
		correct: false,
		feedback:
			'That installs system-wide. In a Rails project, dependencies are managed through the Gemfile so the whole team stays in sync.',
	},
	{
		id: 'bundle-add',
		label: 'bundle add dry-validation',
		command: 'bundle add dry-validation',
		correct: true,
	},
];

export const INSTALL_GEM_OUTPUT = [
	{ text: 'Fetching dry-validation 1.10.0', color: 'muted' as const },
	{ text: 'Fetching dry-schema 1.13.4 (dependency)', color: 'muted' as const },
	{ text: 'Installing dry-schema 1.13.4', color: 'green' as const },
	{ text: 'Installing dry-validation 1.10.0', color: 'green' as const },
	{
		text: 'Bundle updated! dry-validation added to Gemfile (dry-schema comes along as a dependency).',
		color: 'green' as const,
	},
];

// Terminal step map for building history (step 0 is terminal, rest are null)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: INSTALL_GEM_COMMANDS, outputLines: INSTALL_GEM_OUTPUT },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step data (steps 1-3)
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// Step 1: Choose Schema Approach
export const SCHEMA_APPROACH_OPTIONS: StepOption[] = [
	{
		id: 'inline-checks',
		label: 'Keep inline if/else checks in the service',
		correct: false,
		feedback:
			'Inline checks are exactly the problem. They scatter validation logic and produce inconsistent errors.',
	},
	{
		id: 'active-model',
		label: 'Use ActiveModel::Model with validates macros',
		correct: false,
		feedback:
			'ActiveModel ties validation to Rails. It cannot separate schema checks (types, formats) from business rules (cross-field logic).',
	},
	{
		id: 'dry-schema',
		label: 'Dry::Schema.Params { required(:email_address).filled(:string) }',
		correct: true,
	},
	{
		id: 'json-schema',
		label: 'JSON Schema validation with json_schemer gem',
		correct: false,
		feedback:
			'JSON Schema validates structure but has no Ruby-native rule blocks for cross-field business logic.',
	},
];

// Step 2: Compose the Contract
export const COMPOSE_CONTRACT_OPTIONS: StepOption[] = [
	{
		id: 'single-schema',
		label: 'params(RegistrationSchema)',
		correct: false,
		feedback:
			'One giant schema defeats the purpose. Separate schemas per concern are reusable across different contracts.',
	},
	{
		id: 'and-operator',
		label: 'params(CredentialsSchema & ProfileSchema & NotifPrefsSchema)',
		correct: false,
		feedback:
			'A schema is not a set you intersect. dry-validation reuses several predefined schemas a different way when you pass them to the definition method.',
	},
	{
		id: 'composed-args',
		label: 'params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)',
		correct: true,
	},
];

// Step 3: Add Cross-Field Rule
export const CROSS_FIELD_RULE_OPTIONS: StepOption[] = [
	{
		id: 'validate-method',
		label: `validate :check_creator_digest\ndef check_creator_digest\n  errors.add(:role, "...") if ...\nend`,
		correct: false,
		feedback:
			'That is ActiveRecord callback syntax. Dry::Validation contracts use a different block-based API for rules.',
	},
	{
		id: 'before-action',
		label: `before_action :validate_creator_digest\ndef validate_creator_digest\n  # check in controller\nend`,
		correct: false,
		feedback:
			'That drags the rule into the controller. Every other caller (imports, tests) would have to re-implement it. Business rules belong where the validation lives.',
	},
	{
		id: 'rule-block',
		label: `rule(:role, :email_digest) do\n  if values[:role] == "creator" &&\n     values[:email_digest] != "weekly"\n    key(:role).failure("creators need weekly digest")\n  end\nend`,
		correct: true,
	},
];

// Map from step index -> OptionCard config (steps 1-3)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	1: {
		title: 'Choose Schema Approach',
		description:
			'The registration service has scattered inline checks for email format, password length, display name, bio, and digest frequency. How should you define reusable validation schemas?',
		options: SCHEMA_APPROACH_OPTIONS,
	},
	2: {
		title: 'Compose the Contract',
		description:
			'You have three separate schemas: CredentialsSchema, ProfileSchema, and NotifPrefsSchema. How do you reuse all three inside a single contract that validates the entire registration payload?',
		options: COMPOSE_CONTRACT_OPTIONS,
	},
	3: {
		title: 'Add Cross-Field Rule',
		description:
			'Creator accounts must enable the weekly digest. This business rule spans two fields (role and email_digest). How do you add it to the contract?',
		options: CROSS_FIELD_RULE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

export function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Intro phase: show service with scattered validations (service exists from L16)
	if (phase === 'intro') {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `# Service exists from L16, but validations are scattered inline!
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def call
    # Credential validations (inline!)
    if @params[:email_address].blank?
      return Result.new(success?: false, user: nil, errors: ["Email required"])
    end
    if @params[:password].length < 8
      return Result.new(success?: false, user: nil, errors: ["Password too short"])
    end

    # Profile validations (inline!)
    if @params[:display_name].blank?
      return Result.new(success?: false, user: nil, errors: ["Name required"])
    end
    if @params[:bio]&.length.to_i > 500
      return Result.new(success?: false, user: nil, errors: ["Bio too long"])
    end

    # Notification prefs (inline!)
    digests = %w[daily weekly monthly never]
    unless digests.include?(@params[:email_digest])
      return Result.new(success?: false, user: nil, errors: ["Bad digest"])
    end

    # Cross-field rule (also inline!)
    if @params[:role] == "creator" && @params[:email_digest] != "weekly"
      return Result.new(success?: false, user: nil, errors: ["Creators need weekly"])
    end

    user = User.create!(@params)
    Result.new(success?: true, user: user, errors: [])
  end
end`,
			highlight: [7, 8, 10, 11, 15, 16, 18, 19, 24, 25, 29, 30],
		});
		return files;
	}

	// Build / reward phases: evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "puma"
gem "sqlite3"

# Add dry-validation for contract-based validation
# gem "dry-validation"  <-- install this`,
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `# Gemfile
gem "rails", "~> 8.0"
gem "puma"
gem "sqlite3"
gem "dry-validation"`,
			highlight: [5],
		});
	}

	if (furthestStep >= 2 && furthestStep < 3) {
		files.push({
			filename: 'app/schemas/credentials_schema.rb',
			language: 'ruby',
			code: `CredentialsSchema = Dry::Schema.Params do
  required(:email_address).filled(:string,
    format?: URI::MailTo::EMAIL_REGEXP)
  required(:password).filled(:string, min_size?: 8)
  optional(:role).filled(:string)
end`,
		});
		files.push({
			filename: 'app/schemas/profile_schema.rb',
			language: 'ruby',
			code: `ProfileSchema = Dry::Schema.Params do
  required(:display_name).filled(:string)
  optional(:bio).filled(:string, max_size?: 500)
  optional(:location).filled(:string)
end`,
		});
		files.push({
			filename: 'app/schemas/notif_prefs_schema.rb',
			language: 'ruby',
			code: `NotifPrefsSchema = Dry::Schema.Params do
  required(:email_digest).filled(:string,
    included_in?: %w[daily weekly monthly never])
  optional(:push_enabled).filled(:bool)
  optional(:mentions_only).filled(:bool)
end`,
		});
	}

	if (furthestStep >= 3 && furthestStep < 4) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)

  # Add cross-field rules here...
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(CredentialsSchema, ProfileSchema, NotifPrefsSchema)

  rule(:role, :email_digest) do
    if values[:role] == "creator" &&
       values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end`,
			highlight: [4, 5, 6, 7],
		});
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `# Service from L16, now delegates validation to the contract
class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    validation = RegistrationContract.new.call(@params)

    if validation.failure?
      return Result.new(success?: false, user: nil,
                        errors: validation.errors.to_h)
    end

    # The model still owns data-integrity rules (email uniqueness).
    user = User.create!(validation.to_h)
    Result.new(success?: true, user: user, errors: [])
  end
end`,
			highlight: [10, 12, 13, 14],
		});
		files.push({
			filename: 'app/controllers/users_controller.rb',
			language: 'ruby',
			code: `# Thin controller (unchanged from L16): it only speaks HTTP and
# delegates the workflow to the service.
class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    result = UserRegistration.call(registration_params)

    if result.success?
      render json: UserSerializer.new(result.user).serializable_hash.to_json,
             status: :created
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end

  private

  def registration_params
    params.expect(user: [
      :email_address, :password, :role,
      :display_name, :bio, :email_digest, :push_enabled
    ])
  end
end`,
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Visualization: field labels + base states
// ──────────────────────────────────────────────

const FIELD_LABELS: { key: FieldChip['key']; label: string }[] = [
	{ key: 'email_address', label: 'email_address' },
	{ key: 'password', label: 'password' },
	{ key: 'display_name', label: 'display_name' },
	{ key: 'email_digest', label: 'email_digest' },
	{ key: 'role', label: 'role' },
];

function fieldsFrom(
	states: Partial<Record<FieldChip['key'], FieldChip['state']>>,
	notes: Partial<Record<FieldChip['key'], string>> = {},
): FieldChip[] {
	return FIELD_LABELS.map(({ key, label }) => ({
		key,
		label,
		state: states[key] ?? 'unchecked',
		note: notes[key],
	}));
}

const IDLE_REQUEST: EdgeVizState = { active: false, reverse: false, label: '' };
const IDLE_RESULT: EdgeVizState = { active: false, reverse: true, label: '' };

// Intro (before): the short-circuit. The service checked email, returned, and
// never looked at the other four fields. The customer resubmits four times.
const INTRO_STATE: GauntletVizState = {
	fields: fieldsFrom(
		{
			email_address: 'bad',
			password: 'unchecked',
			display_name: 'unchecked',
			email_digest: 'unchecked',
			role: 'unchecked',
		},
		{ email_address: 'blank' },
	),
	validator: {
		mode: 'inline',
		sublabel: 'checks email, returns, never sees the rest',
		badge: '422: 1 of 4',
		flash: 'red',
		activeLayer: 'none',
	},
	request: { active: false, reverse: false, label: 'POST /users' },
	result: { active: false, reverse: true, label: '422 -> "Email required"' },
	roundTrips: 4,
};

// Reward base (idle contract, before any scenario is fired).
const BASE_STATE: GauntletVizState = {
	fields: fieldsFrom({}),
	validator: {
		mode: 'contract',
		sublabel: 'waiting for a signup',
		badge: null,
		flash: 'idle',
		activeLayer: 'none',
	},
	request: { ...IDLE_REQUEST },
	result: { ...IDLE_RESULT },
	roundTrips: 1,
};

// The four sequential errors a customer hits in the before-state, one per trip.
const ROUND_TRIP_STRIP = [
	'Trip 1: "Email required"',
	'Trip 2: "Password too short"',
	'Trip 3: "Name required"',
	'Trip 4: "Bad digest"',
];

// ──────────────────────────────────────────────
// Reward stress scenarios (replay the intro damage stories with the fix)
// ──────────────────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'all-errors-at-once',
		label: 'Sign up with four fields wrong',
		description: 'The schema checks every field and returns all errors at once',
		method: 'POST',
		path: '/users',
		actor: 'new seller',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'POST /users (email, password, name, digest all bad)' },
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'errors: {email_address, password, display_name, email_digest}',
				color: 'red',
			},
			{ text: 'One response, four errors. One round trip.', color: 'green' },
		],
		story: [
			'A new seller fills the signup form and gets four fields wrong.',
			'The whole payload enters the contract at once.',
			'The schema layer checks every field together and flags all four.',
			'The contract returns all four errors in one 422, so the seller fixes everything in a single pass instead of four round trips.',
		],
	},
	{
		id: 'malformed-payload',
		label: 'Send password as a number, not a string',
		description:
			'The schema type-checks the payload, so a bad type is a clean 422 (not a 500)',
		method: 'POST',
		path: '/users',
		actor: 'buggy client',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'POST /users {"password": 12345678}' },
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: 'errors: {password: ["must be a string"]}', color: 'red' },
			{
				text: 'No 500. The schema rejects the wrong type at the boundary.',
				color: 'green',
			},
		],
		story: [
			'A buggy mobile client sends password as a JSON number instead of a string.',
			'The inline version called number.length and crashed with a 500.',
			'The schema layer type-checks the payload: password must be a filled string.',
			'The wrong type is rejected with a clean 422 keyed to :password. The endpoint never crashes.',
		],
	},
	{
		id: 'creator-cross-field',
		label: 'Sign up as a creator with the monthly digest',
		description:
			'Every field is valid, but the cross-field rule keys the failure to :role',
		method: 'POST',
		path: '/users',
		actor: 'creator',
		expectedResult: 'blocked',
		responseLines: [
			{ text: 'POST /users (role: creator, email_digest: monthly)' },
			{
				text: 'schema passes: every field is individually valid',
				color: 'green',
			},
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: 'errors: {role: ["creators need weekly digest"]}', color: 'red' },
		],
		story: [
			'A creator signs up and picks the monthly digest. Every individual field is valid.',
			'The schema layer passes: shape and types are fine.',
			'The rules layer runs rule(:role, :email_digest) and fails the cross-field check.',
			'The error comes back keyed to :role (not a bare string), so the frontend can highlight the exact field. The rule lives in the contract, reusable and testable without HTTP.',
		],
	},
	{
		id: 'valid-signup',
		label: 'Sign up with a valid payload',
		description:
			'Schema passes, rules pass, the service persists; the model still owns uniqueness',
		method: 'POST',
		path: '/users',
		actor: 'new seller',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'POST /users (all fields valid, role: member)' },
			{ text: 'schema passes -> rules pass', color: 'green' },
			{ text: 'UserRegistration persists the validated data', color: 'green' },
			{ text: '201 Created', color: 'green' },
		],
		story: [
			'A new seller submits a clean, valid payload.',
			'The schema layer passes and the rules layer passes.',
			'The thin service persists the validated data with User.create!.',
			'The model still owns data-integrity rules like email uniqueness, so the contract and the model each guard their own layer.',
		],
	},
];

// ──────────────────────────────────────────────
// Reward frames (full-snapshot patches, played on fire)
// ──────────────────────────────────────────────

type RewardFrame = {
	fields?: FieldChip[];
	validator?: Partial<ValidatorVizState>;
	request?: Partial<EdgeVizState>;
	result?: Partial<EdgeVizState>;
	roundTrips?: number;
};

const REQUEST_IN: RewardFrame = {
	fields: fieldsFrom({}),
	validator: {
		sublabel: 'RegistrationContract.new.call(params)',
		badge: 'POST',
		flash: 'amber',
		activeLayer: 'none',
	},
	request: { active: true, reverse: false, label: 'POST /users' },
	result: { active: false, reverse: true, label: '' },
	roundTrips: 1,
};

export const REWARD_SCENARIO_FRAMES: Record<string, RewardFrame[]> = {
	'all-errors-at-once': [
		REQUEST_IN,
		{
			fields: fieldsFrom(
				{
					email_address: 'bad',
					password: 'bad',
					display_name: 'bad',
					email_digest: 'bad',
					role: 'ok',
				},
				{
					email_address: 'is missing',
					password: 'min 8 chars',
					display_name: 'is missing',
					email_digest: 'not in list',
				},
			),
			validator: {
				sublabel: 'schema checks every field at once',
				badge: 'SCHEMA',
				flash: 'amber',
				activeLayer: 'schema',
			},
			request: { active: false, label: '' },
		},
		{
			validator: {
				sublabel: 'four errors, one response',
				badge: '422 x4',
				flash: 'red',
				activeLayer: 'schema',
			},
			result: { active: true, reverse: true, label: '422 {4 fields}' },
			roundTrips: 1,
		},
	],
	'malformed-payload': [
		{
			...REQUEST_IN,
			validator: {
				sublabel: 'call(params): password is a number',
				badge: 'POST',
				flash: 'amber',
				activeLayer: 'none',
			},
		},
		{
			fields: fieldsFrom(
				{
					email_address: 'ok',
					password: 'bad',
					display_name: 'ok',
					email_digest: 'ok',
					role: 'ok',
				},
				{ password: 'must be a string' },
			),
			validator: {
				sublabel: 'schema rejects the wrong type',
				badge: 'SCHEMA',
				flash: 'amber',
				activeLayer: 'schema',
			},
			request: { active: false, label: '' },
		},
		{
			validator: {
				sublabel: 'clean 422, no crash',
				badge: '422',
				flash: 'red',
				activeLayer: 'schema',
			},
			result: { active: true, reverse: true, label: '422 {password}' },
		},
	],
	'creator-cross-field': [
		REQUEST_IN,
		{
			fields: fieldsFrom({
				email_address: 'ok',
				password: 'ok',
				display_name: 'ok',
				email_digest: 'ok',
				role: 'ok',
			}),
			validator: {
				sublabel: 'every field valid, schema passes',
				badge: 'SCHEMA OK',
				flash: 'amber',
				activeLayer: 'schema',
			},
			request: { active: false, label: '' },
		},
		{
			validator: {
				sublabel: 'rule(:role, :email_digest) fails',
				badge: 'RULES',
				flash: 'amber',
				activeLayer: 'rules',
			},
		},
		{
			validator: {
				sublabel: '422 keyed to :role',
				badge: '422 role',
				flash: 'red',
				activeLayer: 'rules',
			},
			result: { active: true, reverse: true, label: '422 {role}' },
		},
	],
	'valid-signup': [
		REQUEST_IN,
		{
			fields: fieldsFrom({
				email_address: 'ok',
				password: 'ok',
				display_name: 'ok',
				email_digest: 'ok',
				role: 'ok',
			}),
			validator: {
				sublabel: 'schema passes',
				badge: 'SCHEMA OK',
				flash: 'amber',
				activeLayer: 'schema',
			},
			request: { active: false, label: '' },
		},
		{
			validator: {
				sublabel: 'rules pass -> service persists',
				badge: 'RULES OK',
				flash: 'amber',
				activeLayer: 'rules',
			},
		},
		{
			validator: {
				sublabel: 'User created (model owns uniqueness)',
				badge: '201',
				flash: 'green',
				activeLayer: 'none',
			},
			result: { active: true, reverse: true, label: '201 Created' },
		},
	],
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level18ValidationContracts({
	onComplete,
}: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Reward visualization state ──
	const [vizState, setVizState] = useState<GauntletVizState>(BASE_STATE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setVizState(structuredClone(BASE_STATE));
	}, []);

	const applyFrame = useCallback((frame: RewardFrame) => {
		setVizState((prev) => ({
			fields: frame.fields ?? prev.fields,
			validator: { ...prev.validator, ...frame.validator },
			request: { ...prev.request, ...frame.request },
			result: { ...prev.result, ...frame.result },
			roundTrips: frame.roundTrips ?? prev.roundTrips,
		}));
	}, []);

	const runAnimation = useCallback(
		(frames: RewardFrame[]) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setVizState((prev) => ({
								...prev,
								request: { ...prev.request, active: false },
								result: { ...prev.result, active: false },
							}));
							setVizAnimating(false);
						}, ANIMATION_DURATION_MS);
						timersRef.current.push(cleanup);
					}
				}, i * ANIMATION_DURATION_MS);
				timersRef.current.push(t);
			}
		},
		[applyFrame, resetViz],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_SCENARIO_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = (option: StepOption) => {
		if (option.correct) {
			stepper.completeStep();
		} else if (option.feedback) {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		if (phase !== 'reward') {
			return {
				valid: false,
				message: 'Fire a few signup scenarios to see the contract handle them.',
			};
		}
		return { valid: true, message: 'Validation contract is locked down!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The registration service (extracted in L16) creates a User from a
							rich signup payload: credentials, profile fields, and notification
							preferences. Validations are scattered inline inside the service
							with early returns, so it checks one field, bails on the first bad
							one, and returns a single error.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							A seller who gets four fields wrong has to submit four times. A
							malformed payload crashes the endpoint. The buried cross-field
							rule ("creators need the weekly digest") cannot be reused or
							tested on its own. You need a validation contract.
						</p>
					</div>

					{/* Build phases: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward: legend */}
					{phase === 'reward' && (
						<div className="p-4 border-b border-border space-y-2">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Contract
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Fire each signup story and watch the contract handle it. The
								schema layer checks every field's shape and types at once; the
								rules layer runs cross-field business logic after.
							</p>
							<div className="grid grid-cols-2 gap-2 pt-1">
								<div className="rounded-md border border-success/40 bg-success/5 dark:bg-success/10 p-2 text-center">
									<div className="text-lg font-bold text-success">
										{stressTest.allowedCount}
									</div>
									<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
										Allowed
									</div>
								</div>
								<div className="rounded-md border border-destructive/40 bg-destructive/5 dark:bg-destructive/10 p-2 text-center">
									<div className="text-lg font-bold text-destructive">
										{stressTest.blockedCount}
									</div>
									<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
										Blocked (422)
									</div>
								</div>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Validation Contracts"
					levelNumber={18}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col min-h-0">
								<div className="text-center pt-4 px-6">
									<h3 className="text-lg font-semibold text-foreground">
										One error at a time
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										The service checks fields one by one and returns at the
										first bad one
									</p>
								</div>
								<ValidationGauntletFlow state={INTRO_STATE} />
							</div>

							<div className="px-6 pb-4 space-y-3">
								{/* Round-trip strip */}
								<div className="rounded-lg border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3">
									<div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
										What the customer lives through
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
										{ROUND_TRIP_STRIP.map((trip) => (
											<div
												className="text-xs font-mono text-foreground/80 rounded-md border border-border bg-card px-2 py-1"
												key={trip}
											>
												{trip}
											</div>
										))}
									</div>
									<p className="text-xs text-muted-foreground mt-2">
										Four submissions to surface four problems. The malformed
										payload and the buried creator/digest rule make it worse.
									</p>
								</div>

								<div className="flex justify-center">
									<Button
										className="gap-2"
										onClick={() => setPhase('build')}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: Terminal choice (install gem) */}
								{stepper.currentStep === 0 && (
									<TerminalChoiceStep
										commands={INSTALL_GEM_COMMANDS}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												The dry-validation gem provides contract-based
												validation with composable schemas and cross-field
												rules. How do you add it to your Rails project?
											</p>
										}
										hasNext={hasNextStep}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										onCorrect={() => stepper.completeStep()}
										onNext={stepper.nextStep}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={INSTALL_GEM_OUTPUT}
										stepKey={stepper.currentStep}
										title="Install dry-validation"
									/>
								)}

								{/* Steps 1-3: OptionCard choices */}
								{stepper.currentStep >= 1 && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{shuffledOptions.map((opt) => (
													<OptionCard
														color="violet"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{shuffledOptions.map((opt) => (
														<OptionCard
															color="violet"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
															size="lg"
														/>
													))}
												</div>

												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}

										{isViewingCompletedStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={
														hasNextStep
															? stepper.nextStep
															: () => {
																	stressTest.reset();
																	resetViz();
																	setPhase('reward');
																}
													}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex flex-col min-h-0">
								<div className="text-center pt-4 px-6">
									<h3 className="text-lg font-semibold text-foreground">
										One contract, every error at once
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Schema layer checks shape and types together; rules layer
										runs cross-field logic
									</p>
								</div>
								<ValidationGauntletFlow state={vizState} />
							</div>

							<div className="px-4 pb-4">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={stressTest.toggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward'
							? STEP_DEFS.length
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
					learningGoal="A validation contract validates the request at the boundary: the schema layer checks shape and types (so a malformed payload is a clean 422, never a 500), and the rules layer runs cross-field business logic, returning every error in one response. The model still owns data-integrity rules like uniqueness."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level18ValidationContracts;

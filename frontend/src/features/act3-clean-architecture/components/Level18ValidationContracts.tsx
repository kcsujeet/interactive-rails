/**
 * Level 18: Validation Contracts
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Scattered Validations" zone layout.
 *   A large Controller zone shows 5 inline validation blocks crammed together
 *   (email check, password check, display name check, digest check, cross-field rule).
 *   The player clicks each block to discover why scattered validations are problematic.
 *   Probes reveal inconsistent error responses and missing cross-field logic.
 * Phase 2 (HOW - build): 4 steps (1 TerminalChoice + 3 OptionCard)
 *   Step 0: Install dry-validation gem (TerminalChoiceStep)
 *   Step 1: Choose schema approach (OptionCard)
 *   Step 2: Create composed contract (OptionCard)
 *   Step 3: Add cross-field rule (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Contract" button
 * Phase 4 (ADVANTAGE - reward): Two-zone layout: thin Controller delegates to
 *   Contract zone containing composed schemas + rule block. Stress test fires
 *   registration payloads showing consistent validation.
 *
 * Visualization approach: Custom zone layout (refactoring concept, not request lifecycle).
 * The fat controller is shown with scattered inline checks, then extracted into
 * controller + contract zones in the reward phase.
 *
 * Teaches: dry-validation gem, Dry::Schema, schema composition, cross-field rules
 */

import { ArrowRight, Check, Play, Search, Star, X } from 'lucide-react';
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
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import {
	ScenarioCards,
	type ScenarioConfig,
} from '@/components/levels/ScenarioCards';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Validation blocks inside the fat controller
// ──────────────────────────────────────────────

interface ValidationBlock {
	id: string;
	label: string;
	lines: string;
	code: string;
}

const VALIDATION_BLOCKS: ValidationBlock[] = [
	{
		id: 'email-check',
		label: 'Email Check',
		lines: 'Lines 3-5',
		code: `if params[:email].blank?
  return render json: {error: "Email required"}, status: 422
end`,
	},
	{
		id: 'password-check',
		label: 'Password Check',
		lines: 'Lines 6-8',
		code: `if params[:password].length < 8
  return render json: {error: "Password too short"}, status: 422
end`,
	},
	{
		id: 'name-check',
		label: 'Display Name Check',
		lines: 'Lines 11-13',
		code: `if params[:display_name].blank?
  return render json: {error: "Name required"}, status: 422
end`,
	},
	{
		id: 'digest-check',
		label: 'Digest Frequency Check',
		lines: 'Lines 17-19',
		code: `unless %w[daily weekly monthly never].include?(params[:digest])
  return render json: {error: "Bad digest"}, status: 422
end`,
	},
	{
		id: 'cross-field-rule',
		label: 'Cross-Field Rule (buried!)',
		lines: 'Lines 22-24',
		code: `if params[:role] == "creator" && params[:digest] != "weekly"
  return render json: {error: "Creators need weekly"}, status: 422
end`,
	},
];

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'scattered-validations', label: 'Scattered inline validations' },
	{ id: 'inconsistent-errors', label: 'Inconsistent error responses' },
	{ id: 'no-cross-field', label: 'No cross-field rules' },
	{ id: 'controller-bloat', label: 'Controller too complex' },
];

// ──────────────────────────────────────────────
// Scenario configurations (observe phase)
// ──────────────────────────────────────────────

const SCENARIOS: ScenarioConfig[] = [
	{
		id: 'user-three-errors',
		title: 'User submits a form with 3 invalid fields',
		consequence:
			'Only the first error is returned. User must fix and resubmit for each one.',
	},
	{
		id: 'reuse-validation',
		title: 'Reuse validation logic in admin endpoint',
		consequence:
			'Must copy all inline checks to the new controller. No shared validation layer.',
	},
	{
		id: 'test-cross-field',
		title: 'Unit test the creator+weekly rule',
		consequence:
			'Business rules are buried in the controller. Cannot test without the full HTTP stack.',
	},
];

// Map scenario IDs to discovery IDs they trigger
const SCENARIO_DISCOVERY_MAP: Record<string, string> = {
	'user-three-errors': 'inconsistent-errors',
	'reuse-validation': 'scattered-validations',
	'test-cross-field': 'no-cross-field',
};

// Map scenario IDs to flow animation: which validation block lights up
const OBSERVE_FLOW: Record<string, string[]> = {
	'user-three-errors': [
		'render {error: "Email required"} (STOP)',
		'(never checked)',
		'(never checked)',
		'(never checked)',
		'(never checked)',
	],
	'reuse-validation': [
		'Copy to new controller',
		'Copy to new controller',
		'Copy to new controller',
		'Copy to new controller',
		'Copy to new controller',
	],
	'test-cross-field': [
		'(inline in controller)',
		'(inline in controller)',
		'(inline in controller)',
		'(inline in controller)',
		'Buried here, untestable',
	],
};

// ──────────────────────────────────────────────
// Block inspector data (observe phase)
// ──────────────────────────────────────────────

const BLOCK_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	'email-check': {
		stageId: 'email-check',
		title: 'Email Check (Inline)',
		description:
			'The email check returns immediately with its own error format. If this fails, no other validations run. The controller never collects all errors at once.',
		code: `if params[:email].blank?
  return render json: {error: "Email required"}, status: 422
end
# Only one error per request. User fixes email,
# then discovers password is also wrong.`,
	},
	'password-check': {
		stageId: 'password-check',
		title: 'Password Check (Inline)',
		description:
			'Another standalone check with its own render call. If email passes but password fails, only the password error is returned. No batch validation.',
		code: `if params[:password].length < 8
  return render json: {error: "Password too short"}, status: 422
end`,
	},
	'name-check': {
		stageId: 'name-check',
		title: 'Display Name Check (Inline)',
		description:
			'Profile validation mixed in with user validations. These belong to different models but are jumbled together in one controller action.',
		code: `# Profile model field validated in user controller
if params[:display_name].blank?
  return render json: {error: "Name required"}, status: 422
end`,
	},
	'digest-check': {
		stageId: 'digest-check',
		title: 'Digest Frequency Check (Inline)',
		description:
			'Notification preferences validated inline. The allowed values list is hardcoded in the controller instead of being defined in a schema.',
		code: `digests = %w[daily weekly monthly never]
unless digests.include?(params[:digest])
  return render json: {error: "Bad digest"}, status: 422
end`,
	},
	'cross-field-rule': {
		stageId: 'cross-field-rule',
		title: 'Cross-Field Rule (Buried)',
		description:
			'Business logic that spans two fields (role + digest). Buried between format checks. Cannot be tested independently or reused in other contexts.',
		code: `# Business rule: creators must have weekly digest
if params[:role] == "creator" && params[:digest] != "weekly"
  return render json: {error: "Creators need weekly"}, status: 422
end
# This rule is impossible to unit test without
# hitting the full HTTP stack.`,
	},
};

// Map block IDs to discovery IDs
const BLOCK_DISCOVERY_MAP: Record<string, string> = {
	'email-check': 'inconsistent-errors',
	'password-check': 'scattered-validations',
	'name-check': 'controller-bloat',
	'digest-check': 'scattered-validations',
	'cross-field-rule': 'no-cross-field',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-registration',
		label: 'Valid registration',
		description: 'POST with all fields correct',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
	{
		id: 'missing-email',
		label: 'Missing email',
		description: 'POST without required email field',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'short-password',
		label: 'Short password',
		description: 'POST with password under 8 chars',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'invalid-digest',
		label: 'Invalid digest value',
		description: 'POST with digest: "hourly" (not in allowed list)',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'creator-monthly',
		label: 'Creator + monthly digest',
		description: 'POST with role: creator, digest: monthly',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'blocked',
	},
	{
		id: 'creator-weekly',
		label: 'Creator + weekly digest',
		description: 'POST with role: creator, digest: weekly',
		method: 'POST',
		path: '/api/v1/register',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
];

// Reward flow messages: [controller, contract-result]
const REWARD_FLOW: Record<string, string[]> = {
	'valid-registration': [
		'contract.call(params)',
		'Result(success: true, values: {email, password, ...})',
	],
	'missing-email': [
		'contract.call(params)',
		'Result(failure: {email: ["must be filled"]})',
	],
	'short-password': [
		'contract.call(params)',
		'Result(failure: {password: ["min 8 chars"]})',
	],
	'invalid-digest': [
		'contract.call(params)',
		'Result(failure: {email_digest: ["not included"]})',
	],
	'creator-monthly': [
		'contract.call(params)',
		'Result(failure: {role: ["creators need weekly digest"]})',
	],
	'creator-weekly': [
		'contract.call(params)',
		'Result(success: true, values: {role: "creator", digest: "weekly"})',
	],
};

// ──────────────────────────────────────────────
// Step definitions (1 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-gem', title: 'Install dry-validation' },
	{ id: 'schema-approach', title: 'Choose Schema Approach' },
	{ id: 'compose-contract', title: 'Create the Contract' },
	{ id: 'cross-field-rule', title: 'Add Cross-Field Rule' },
];

// ──────────────────────────────────────────────
// Terminal step data (step 0)
// ──────────────────────────────────────────────

const INSTALL_GEM_COMMANDS = [
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

const INSTALL_GEM_OUTPUT = [
	{ text: 'Fetching dry-validation 1.10.0', color: 'muted' as const },
	{ text: 'Fetching dry-schema 1.13.4', color: 'muted' as const },
	{ text: 'Installing dry-schema 1.13.4', color: 'green' as const },
	{ text: 'Installing dry-validation 1.10.0', color: 'green' as const },
	{
		text: 'Bundle updated! dry-validation and dry-schema added to Gemfile.',
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
const SCHEMA_APPROACH_OPTIONS: StepOption[] = [
	{
		id: 'inline-checks',
		label: 'Keep inline if/else checks in the controller',
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
		label: 'Dry::Schema.Params { required(:email).filled(:string) }',
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

// Step 2: Create the Contract
const COMPOSE_CONTRACT_OPTIONS: StepOption[] = [
	{
		id: 'single-schema',
		label: 'params(RegistrationSchema)',
		correct: false,
		feedback:
			'One giant schema defeats the purpose. Individual schemas per model are reusable across different contracts.',
	},
	{
		id: 'nested-schemas',
		label: 'params { schema UserSchema; schema ProfileSchema }',
		correct: false,
		feedback:
			'That is not valid dry-validation syntax. Schemas compose with a different operator.',
	},
	{
		id: 'composed-and',
		label: 'params(UserSchema & ProfileSchema & NotifPrefsSchema)',
		correct: true,
	},
];

// Step 3: Add Cross-Field Rule
const CROSS_FIELD_RULE_OPTIONS: StepOption[] = [
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
			'That puts the logic back in the controller. The whole point is to keep business rules in the contract.',
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
			'The controller has scattered inline checks for email format, password length, display name, bio, and digest frequency. How should you define reusable validation schemas?',
		options: SCHEMA_APPROACH_OPTIONS,
	},
	2: {
		title: 'Create the Contract',
		description:
			'You have three separate schemas: UserSchema, ProfileSchema, and NotifPrefsSchema. How do you compose them into a single contract that validates the entire registration payload?',
		options: COMPOSE_CONTRACT_OPTIONS,
	},
	3: {
		title: 'Add Cross-Field Rule',
		description:
			'Creator accounts must enable weekly digest. This business rule spans two fields (role and email_digest). How do you add it to the contract?',
		options: CROSS_FIELD_RULE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Contract schema blocks for reward visualization
// ──────────────────────────────────────────────

const CONTRACT_SCHEMAS = [
	{ id: 'user-schema', label: 'UserSchema', fields: 'email, password, role' },
	{
		id: 'profile-schema',
		label: 'ProfileSchema',
		fields: 'display_name, bio',
	},
	{
		id: 'notif-schema',
		label: 'NotifPrefsSchema',
		fields: 'email_digest, push_enabled',
	},
	{
		id: 'cross-field',
		label: 'rule(:role, :email_digest)',
		fields: 'creators need weekly',
	},
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show controller with scattered validations
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/registration_controller.rb',
			language: 'ruby',
			code: `class RegistrationController < ApplicationController
  def create
    # User validations (inline!)
    if params[:email].blank?
      return render json: {error: "Email required"}, status: 422
    end
    if params[:password].length < 8
      return render json: {error: "Password too short"}, status: 422
    end

    # Profile validations (inline!)
    if params[:display_name].blank?
      return render json: {error: "Name required"}, status: 422
    end
    if params[:bio].length > 500
      return render json: {error: "Bio too long"}, status: 422
    end

    # Notification prefs (inline!)
    digests = %w[daily weekly monthly never]
    unless digests.include?(params[:digest])
      return render json: {error: "Bad digest"}, status: 422
    end

    # Cross-field rule (also inline!)
    if params[:role] == "creator" && params[:digest] != "weekly"
      return render json: {error: "Creators need weekly"}, status: 422
    end

    user = User.create!(email: params[:email], ...)
    Profile.create!(user: user, ...)
    NotificationPref.create!(user: user, ...)
    render json: user, status: :created
  end
end`,
			highlight: [4, 5, 7, 8, 12, 13, 15, 16, 20, 21, 25, 26],
		});
		return files;
	}

	// Build / activate / reward phases: evolving code
	if (furthestStep === 0) {
		// Step 0: installing the gem
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
		// Step 1: choosing schema approach
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
		// Step 2: composing contract
		files.push({
			filename: 'app/schemas/user_schema.rb',
			language: 'ruby',
			code: `UserSchema = Dry::Schema.Params do
  required(:email).filled(:string,
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
		// Step 3: adding cross-field rule
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  # Add cross-field rules here...
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 4) {
		// All steps complete: full contract + clean controller
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

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
			filename: 'app/controllers/registration_controller.rb',
			language: 'ruby',
			code: `class RegistrationController < ApplicationController
  def create
    result = RegistrationContract.new.call(params.to_h)

    if result.failure?
      render json: { errors: result.errors.to_h }, status: 422
      return
    end

    attrs = result.to_h
    user = User.create!(email: attrs[:email],
                        password: attrs[:password])
    Profile.create!(user: user,
                    display_name: attrs[:display_name])
    NotificationPref.create!(user: user,
                             email_digest: attrs[:email_digest])

    render json: user, status: :created
  end
end`,
			highlight: [3, 5, 6],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Legend (reward phase left panel)
// ──────────────────────────────────────────────

function ContractLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Contract Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Valid payload (contract passes, all schemas satisfied)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Invalid payload (contract rejects with structured errors)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level18ValidationContracts({
	onComplete,
}: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] =
		useState<StageInspectorData | null>(null);
	const [inspectedBlocks, setInspectedBlocks] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Flow animation state (observe phase) ──
	const [flowPhase, setFlowPhase] = useState(-1);
	const [flowMessages, setFlowMessages] = useState<string[]>([]);
	const flowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearFlow = useCallback(() => {
		for (const t of flowTimeoutsRef.current) clearTimeout(t);
		flowTimeoutsRef.current = [];
	}, []);

	const runFlow = useCallback(
		(messages: string[]) => {
			clearFlow();
			setFlowMessages(messages);
			const totalPhases = messages.length;
			const delay = 800;

			setFlowPhase(0);

			for (let p = 1; p < totalPhases; p++) {
				const t = setTimeout(() => {
					setFlowPhase(p);
				}, delay * p);
				flowTimeoutsRef.current.push(t);
			}

			const endT = setTimeout(() => {
				setFlowPhase(-1);
			}, delay * (totalPhases + 1));
			flowTimeoutsRef.current.push(endT);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	// ── Reward flow animation state ──
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardFlowMessages, setRewardFlowMessages] = useState<string[]>([]);
	const rewardFlowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearRewardFlow = useCallback(() => {
		for (const t of rewardFlowTimeoutsRef.current) clearTimeout(t);
		rewardFlowTimeoutsRef.current = [];
	}, []);

	const runRewardFlow = useCallback(
		(messages: string[]) => {
			clearRewardFlow();
			setRewardFlowMessages(messages);
			setRewardFlowPhase(0);

			const t1 = setTimeout(() => setRewardFlowPhase(1), 600);
			const t2 = setTimeout(() => setRewardFlowPhase(2), 1200);
			const t3 = setTimeout(() => setRewardFlowPhase(-1), 2400);
			rewardFlowTimeoutsRef.current.push(t1, t2, t3);
		},
		[clearRewardFlow],
	);

	useEffect(() => {
		return () => clearRewardFlow();
	}, [clearRewardFlow]);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Block click handler (observe phase) ──
	const handleBlockClick = useCallback(
		(blockId: string) => {
			if (phase !== 'observe') return;
			if (flowPhase !== -1) return;

			const data = BLOCK_INSPECTOR_MAP[blockId];
			if (!data) return;

			setInspectorData(data);
			setInspectedBlocks((prev) => {
				if (prev.has(blockId)) return prev;
				const next = new Set(prev);
				next.add(blockId);
				return next;
			});

			const discoveryId = BLOCK_DISCOVERY_MAP[blockId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, flowPhase, discoveryGating],
	);

	// ── Scenario handler (observe phase) ──
	const handleScenario = useCallback(
		(scenarioId: string) => {
			setLastProbeId(scenarioId);
			const discoveryId = SCENARIO_DISCOVERY_MAP[scenarioId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			const messages = OBSERVE_FLOW[scenarioId];
			if (messages) runFlow(messages);
			// Mark all blocks as inspected after scenario reveals them
			setInspectedBlocks(new Set(VALIDATION_BLOCKS.map((b) => b.id)));
		},
		[discoveryGating, runFlow],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateContract = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler (reward phase) ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runRewardFlow(messages);
		},
		[stressTest, runRewardFlow],
	);

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
		return { valid: true, message: 'Validation contract is locked down!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Latest stress test result for reward visualization
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastWasBlocked = lastResult?.result === 'blocked';

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The registration endpoint creates a User, Profile, and
							NotificationPrefs in one request. Validations are scattered
							inline in the controller with duplicated{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								render
							</code>{' '}
							calls and inconsistent error formats.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Cross-field rules like "creator accounts must enable weekly
							digest" are buried between model checks. You need a validation
							contract to centralize all of this.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveries={discoveryGating.discoveries}
								discoveredCount={discoveryGating.discoveredCount}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<ContractLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Valid</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">
											Rejected
										</div>
									</div>
								</div>
							</div>
						</>
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
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							{/* Fat Controller zone with scattered validation blocks */}
							<div className="flex-1 flex items-center justify-center px-6 relative">
								<div className="w-full max-w-lg">
									{/* Controller header */}
									<div className="flex items-center justify-between mb-2">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											RegistrationController#create
										</div>
										<div className="text-xs font-mono text-destructive font-bold">
											35 lines of inline checks
										</div>
									</div>

									{/* Controller zone: border wraps all validation blocks */}
									<div className="border-2 border-destructive/50 rounded-lg bg-destructive/5 dark:bg-destructive/10 p-3 space-y-2">
										{VALIDATION_BLOCKS.map((block, i) => {
											const isFlowActive = flowPhase === i;
											const flowMsg = flowMessages[i];
											const isInspected = inspectedBlocks.has(
												block.id,
											);
											const isError =
												flowMsg &&
												(flowMsg.includes('422') ||
													flowMsg.includes('never reached'));
											const isPassed =
												flowMsg && flowMsg.includes('passed');

											return (
												<button
													key={block.id}
													type="button"
													className={`w-full text-left border rounded-md p-3 transition-all duration-300 cursor-pointer hover:ring-2 hover:ring-ring/30 ${
														isFlowActive
															? isError
																? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/10 dark:bg-destructive/20'
																: isPassed
																	? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/30 bg-success/5 dark:bg-success/10'
																	: 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-primary/30 bg-primary/5 dark:bg-primary/10'
															: 'border-border bg-card'
													} ${
														!isInspected && flowPhase === -1
															? 'ring-1 ring-primary/20'
															: ''
													}`}
													disabled={flowPhase !== -1}
													onClick={() =>
														handleBlockClick(block.id)
													}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="text-sm font-medium text-foreground">
																{block.label}
															</span>
															<span className="text-xs text-muted-foreground font-mono">
																{block.lines}
															</span>
														</div>
														{!isInspected &&
															flowPhase === -1 && (
																<span className="text-primary text-sm animate-pulse font-bold">
																	<Search className="w-3.5 h-3.5" />
																</span>
															)}
													</div>
													{/* Flow message during animation */}
													{flowMsg && flowPhase >= i && (
														<div
															className={`text-xs font-medium mt-1.5 ${
																isFlowActive
																	? 'animate-in fade-in duration-300'
																	: 'opacity-70'
															} ${
																isError
																	? 'text-destructive'
																	: isPassed
																		? 'text-success'
																		: 'text-muted-foreground'
															}`}
														>
															{flowMsg}
														</div>
													)}
												</button>
											);
										})}
									</div>

									{/* Error format indicator */}
									{flowPhase !== -1 && (
										<div className="mt-2 text-center text-xs font-mono text-destructive animate-in fade-in duration-300">
											Only one error returned per request (no
											batch validation)
										</div>
									)}
								</div>

								{/* Stage Inspector overlay */}
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Scenario cards */}
							<div className="px-6 pb-2">
								<ScenarioCards
									scenarios={SCENARIOS}
									onSelect={handleScenario}
									disabled={flowPhase !== -1}
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: Terminal choice (install gem) */}
								{stepper.currentStep === 0 && (
									<TerminalChoiceStep
										title="Install dry-validation"
										description={
											<p className="text-sm text-muted-foreground">
												The dry-validation gem provides
												contract-based validation with composable
												schemas and cross-field rules. How do you
												add it to your Rails project?
											</p>
										}
										commands={INSTALL_GEM_COMMANDS}
										outputLines={INSTALL_GEM_OUTPUT}
										initialHistory={buildTerminalHistory(
											TERMINAL_STEP_MAP,
											stepper.currentStep,
										)}
										completed={isViewingCompletedStep}
										hasNext={hasNextStep}
										onCorrect={() => stepper.completeStep()}
										onWrong={(fb) =>
											stepper.recordWrongAttempt(fb)
										}
										onNext={stepper.nextStep}
										stepKey={stepper.currentStep}
									/>
								)}

								{/* Steps 1-3: OptionCard choices */}
								{stepper.currentStep >= 1 &&
									currentOptionConfig && (
										<>
											<h3 className="text-lg font-semibold text-foreground">
												{currentOptionConfig.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												{currentOptionConfig.description}
											</p>

											{isViewingCompletedStep ? (
												<div className="space-y-2">
													{currentOptionConfig.options.map(
														(opt) => (
															<OptionCard
																color="violet"
																disabled={!opt.correct}
																key={opt.id}
																mono
																name={opt.label}
																selected={opt.correct}
																size="lg"
															/>
														),
													)}
												</div>
											) : (
												<>
													<div className="space-y-2">
														{currentOptionConfig.options.map(
															(opt) => (
																<OptionCard
																	color="violet"
																	key={opt.id}
																	mono
																	name={opt.label}
																	onClick={() =>
																		handleOptionClick(
																			opt,
																		)
																	}
																	size="lg"
																/>
															),
														)}
													</div>

													<ErrorFeedback
														message={
															stepper.lastFeedback
														}
														onDismiss={
															stepper.clearFeedback
														}
													/>
												</>
											)}

											{isViewingCompletedStep &&
												hasNextStep && (
													<div className="flex justify-end">
														<Button
															className="gap-2"
															onClick={
																stepper.nextStep
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

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Your validation contract is ready. Watch it catch
									invalid payloads, missing fields, and cross-field
									rule violations with consistent, structured errors.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateContract}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Contract
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Two-zone layout: Controller -> Contract */}
							<div className="flex-1 flex items-center justify-center px-6">
								<div className="flex items-center gap-4 w-full max-w-2xl">
									{/* Thin Controller zone */}
									<div
										className={`flex-shrink-0 w-48 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 0
												? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-primary/30'
												: 'border-success/50 bg-success/5 dark:bg-success/10'
										}`}
									>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Controller
										</div>
										<pre className="text-xs font-mono text-foreground leading-relaxed">
											{`result = Contract
  .new.call(params)

if result.failure?
  render errors
else
  create records
end`}
										</pre>
										<div className="mt-2 text-xs font-mono text-success">
											10 lines
										</div>
										{rewardFlowMessages[0] &&
											rewardFlowPhase >= 0 && (
												<div
													className={`text-xs font-medium mt-1.5 text-primary ${
														rewardFlowPhase === 0
															? 'animate-in fade-in duration-300'
															: 'opacity-70'
													}`}
												>
													{rewardFlowMessages[0]}
												</div>
											)}
									</div>

									{/* Flow connector */}
									<FlowConnector
										direction="horizontal"
										active={rewardFlowPhase === 1}
										dotColor={
											lastWasBlocked
												? 'bg-destructive'
												: 'bg-success'
										}
									/>

									{/* Contract zone */}
									<div
										className={`flex-1 border-2 rounded-lg p-4 transition-all duration-300 ${
											rewardFlowPhase === 2
												? lastWasBlocked
													? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/30 bg-destructive/5 dark:bg-destructive/10'
													: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/30 bg-success/5 dark:bg-success/10'
												: 'border-border bg-card'
										}`}
									>
										<div className="flex items-center justify-between mb-2">
											<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												RegistrationContract
											</div>
											{lastResult && (
												<div
													className={`text-xs font-mono font-bold ${
														lastWasBlocked
															? 'text-destructive'
															: 'text-success'
													}`}
												>
													{lastWasBlocked
														? 'Result(failure)'
														: 'Result(success)'}
												</div>
											)}
										</div>

										{/* Schema blocks inside contract */}
										<div className="space-y-1.5">
											{CONTRACT_SCHEMAS.map((schema) => (
												<div
													key={schema.id}
													className="border border-border/50 rounded px-2.5 py-1.5 bg-muted/30 dark:bg-muted/10"
												>
													<div className="flex items-center justify-between">
														<span className="text-xs font-medium text-foreground">
															{schema.label}
														</span>
														<span className="text-xs text-muted-foreground font-mono">
															{schema.fields}
														</span>
													</div>
												</div>
											))}
										</div>

										{/* Flow message */}
										{rewardFlowMessages[1] &&
											rewardFlowPhase >= 2 && (
												<div
													className={`text-xs font-medium mt-2 ${
														rewardFlowPhase === 2
															? 'animate-in fade-in duration-300'
															: 'opacity-70'
													} ${
														lastWasBlocked
															? 'text-destructive'
															: 'text-success'
													}`}
												>
													{rewardFlowMessages[1]}
												</div>
											)}
									</div>
								</div>
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
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
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level18ValidationContracts;

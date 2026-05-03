/**
 * Level 12: Validations
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire data probes to see garbage get saved. Discovery gating
 *   controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 4 steps building ActiveRecord validations
 *   Step 0: Add presence validation (OptionCard)
 *   Step 1: Add uniqueness validation (OptionCard)
 *   Step 2: Add format validation (OptionCard)
 *   Step 3: Test invalid record in Rails Console (TerminalChoiceStep)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire data payloads at the
 *   validated model and watch accepted/rejected results.
 *
 * Teaches: validates, presence, uniqueness, format, errors.full_messages
 */

import { ArrowRight, Check, Database, X } from 'lucide-react';
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
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act2-level12-validations', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'empty-saved', label: 'Empty products get saved to the database' },
	{ id: 'duplicate-email', label: 'Duplicate emails are accepted' },
	{ id: 'bad-format', label: 'Malformed emails pass through' },
	{ id: 'no-validations', label: 'Model has no validations' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'empty-post',
		label: 'POST empty record',
		command: 'POST /api/products (name: "", description: "")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":5,"name":"","description":""}',
				color: 'muted',
			},
			{
				text: 'Empty product saved. No presence check ran.',
				color: 'yellow',
			},
		],
		story: [
			'A user submits the product form without filling in any fields.',
			'The controller passes empty strings to Product.create!.',
			'The model has no presence validations on name or description.',
			'A blank product is saved to the database and shown on the storefront.',
		],
	},
	{
		id: 'duplicate-email',
		label: 'POST duplicate email',
		command: 'POST /api/users (email: "joe@test.com") [already exists]',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":8,"email":"joe@test.com"}',
				color: 'muted',
			},
			{
				text: 'Duplicate email saved. No uniqueness check.',
				color: 'yellow',
			},
		],
		story: [
			'A new user signs up with joe@test.com, which is already taken.',
			'The model has no uniqueness validation on the email column.',
			'A second row with the same email is inserted into the users table.',
			"Both accounts now receive each other's password reset emails.",
		],
	},
	{
		id: 'bad-email',
		label: 'POST invalid email',
		command: 'POST /api/users (email: "not-an-email")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":9,"email":"not-an-email"}',
				color: 'muted',
			},
			{
				text: 'Malformed email saved. No format validation.',
				color: 'yellow',
			},
		],
		story: [
			'A user types "not-an-email" into the email field and submits.',
			'The model has no format validation on the email column.',
			'The malformed string is saved as-is to the database.',
			'Order confirmations and password resets will bounce forever.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'empty-post': 'empty-saved',
	'duplicate-email': 'duplicate-email',
	'bad-email': 'bad-format',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ modelSublabel: string; dbBadge: string }
> = {
	'empty-post': {
		modelSublabel: 'name: ""',
		dbBadge: '201!',
	},
	'duplicate-email': {
		modelSublabel: 'joe@test.com',
		dbBadge: '201!',
	},
	'bad-email': {
		modelSublabel: 'not-an-email',
		dbBadge: '201!',
	},
};

// Map probe IDs to data card display text
const PROBE_DATA_CARD: Record<string, string> = {
	'empty-post': '{ name: "", description: "" }',
	'duplicate-email': '{ email: "joe@test.com" }',
	'bad-email': '{ email: "not-an-email" }',
};

// ──────────────────────────────────────────────
// Flow animation messages (per probe / scenario)
// ──────────────────────────────────────────────

// Observe phase: 3 zones (Input, Model Gate, Database)
const OBSERVE_FLOW: Record<string, string[]> = {
	'empty-post': [
		'POST /api/products from client',
		'No validations, passes through',
		'Empty record saved! 201',
	],
	'duplicate-email': [
		'POST /api/users from client',
		'No uniqueness check, passes through',
		'Duplicate email saved! 201',
	],
	'bad-email': [
		'POST /api/users from client',
		'No format check, passes through',
		'Malformed email saved! 201',
	],
};

// Reward phase: 3 zones (Input, Validation Gate, Result)
const REWARD_FLOW: Record<string, string[]> = {
	'valid-post': [
		'Valid product: name + description',
		'validates :name, :description pass',
		'Saved! 201 Created',
	],
	'empty-title': [
		'Product with blank name',
		'validates :name FAILS',
		'Rejected! 422',
	],
	'valid-user': [
		'User with valid email',
		'validates :email passes',
		'Saved! 201 Created',
	],
	'duplicate-email': [
		'Duplicate email signup',
		'uniqueness check FAILS',
		'Rejected! 422',
	],
	'bad-email-format': [
		'User with "not-an-email"',
		'format check FAILS',
		'Rejected! 422',
	],
	'empty-post': [
		'Product with blank name + description',
		'validates :name, :description FAILS',
		'Rejected! 422',
	],
	'bad-email': [
		'User with "not-an-email"',
		'format check FAILS',
		'Rejected! 422',
	],
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	controller: {
		stageId: 'controller',
		title: 'ProductsController',
		description:
			'The controller receives the request, builds a new record, and calls save. It trusts whatever data comes in.',
		code: `def create
  product = Product.new(product_params)
  product.save  # Always succeeds, no checks!
  render json: product, status: :created
end`,
	},
	model: {
		stageId: 'model',
		title: 'Product Model (No Validations)',
		description:
			'The model has no validations. Any data passes straight through to the database. Empty strings, duplicates, malformed values all get saved.',
		code: `class Product < ApplicationRecord
  # No validations!
  # Anything gets saved.
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database (Garbage In)',
		description:
			'The database stores whatever the model sends. Empty names, duplicate emails, and malformed data pile up. Cleaning up later is painful.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	model: 'no-validations',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-post',
		label: 'Valid product with name and description',
		description: 'A complete product with all required fields',
		method: 'POST',
		path: '/api/products',
		actor: 'authenticated user',
		expectedResult: 'allowed',
	},
	{
		id: 'empty-post',
		label: 'POST empty record',
		description: 'Product with blank name and description fields',
		method: 'POST',
		path: '/api/products',
		actor: 'authenticated user',
		expectedResult: 'blocked',
	},
	{
		id: 'empty-title',
		label: 'Product with blank name',
		description: 'Missing required name field',
		method: 'POST',
		path: '/api/products',
		actor: 'authenticated user',
		expectedResult: 'blocked',
	},
	{
		id: 'valid-user',
		label: 'User with valid email',
		description: 'New user with unique, properly formatted email',
		method: 'POST',
		path: '/api/users',
		actor: 'registration',
		expectedResult: 'allowed',
	},
	{
		id: 'duplicate-email',
		label: 'POST duplicate email',
		description: 'Email already exists in the database',
		method: 'POST',
		path: '/api/users',
		actor: 'registration',
		expectedResult: 'blocked',
	},
	{
		id: 'bad-email',
		label: 'POST invalid email',
		description: 'Email fails format validation',
		method: 'POST',
		path: '/api/users',
		actor: 'registration',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 steps: 3 OptionCard + 1 terminal)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'presence', title: 'Add Presence Validation' },
	{ id: 'uniqueness', title: 'Add Uniqueness Validation' },
	{ id: 'format', title: 'Add Format Validation' },
	{ id: 'test-invalid', title: 'Test Invalid Record' },
];

// ──────────────────────────────────────────────
// Step option types
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Step 0: Presence validation (OptionCard)
// ──────────────────────────────────────────────

const PRESENCE_OPTIONS: StepOption[] = [
	{
		id: 'callback',
		label: 'before_save { raise if name.blank? }',
		correct: false,
		feedback:
			'Raising in a callback crashes the request with a 500. Validations return structured error messages instead.',
	},
	{
		id: 'db-constraint',
		label: 'add_column :products, :name, :string, null: false',
		correct: false,
		feedback:
			'Database constraints are a safety net, but they return cryptic errors. Model validations give user-friendly messages.',
	},
	{
		id: 'presence',
		label: 'validates :name, presence: true',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 1: Uniqueness validation (OptionCard)
// ──────────────────────────────────────────────

const UNIQUENESS_OPTIONS: StepOption[] = [
	{
		id: 'manual-check',
		label: 'User.find_by(email: email).nil?',
		correct: false,
		feedback:
			'Manual lookups have race conditions. Two requests can check simultaneously and both pass.',
	},
	{
		id: 'uniqueness',
		label: 'validates :email, uniqueness: { case_sensitive: false }',
		correct: true,
	},
	{
		id: 'rescue',
		label: 'rescue ActiveRecord::RecordNotUnique',
		correct: false,
		feedback:
			'Rescuing database errors is reactive. Validations check proactively before attempting the save.',
	},
];

// ──────────────────────────────────────────────
// Step 2: Format validation (OptionCard)
// ──────────────────────────────────────────────

const FORMAT_OPTIONS: StepOption[] = [
	{
		id: 'simple-regex',
		label: 'validates :email, format: { with: /@/ }',
		correct: false,
		feedback:
			'A single @ check is too permissive. "not@valid" would pass. Use the standard email regexp.',
	},
	{
		id: 'custom-method',
		label: 'validate :check_email_format',
		correct: false,
		feedback:
			'Writing custom email regex is error-prone. Ruby ships a battle-tested pattern in URI::MailTo.',
	},
	{
		id: 'uri-regexp',
		label: 'validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }',
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 3: Test invalid record (TerminalChoiceStep, irb>)
// ──────────────────────────────────────────────

const testCommands: TerminalCommand[] = [
	{
		id: 'valid-check',
		label: 'product.valid?',
		command: 'product.valid?',
		correct: false,
		feedback:
			'That returns true/false but does not show the error details. You need the actual messages.',
	},
	{
		id: 'save-bang',
		label: 'product.save!',
		command: 'product.save!',
		correct: false,
		feedback:
			'Bang methods raise exceptions on failure. You want to inspect the errors, not crash.',
	},
	{
		id: 'full-messages',
		label: 'product.errors.full_messages',
		command: 'product.errors.full_messages',
		correct: true,
	},
];

const testOutput: TerminalOutputLine[] = [
	{
		text: '=> ["Name can\'t be blank", "Description can\'t be blank"]',
		color: 'red',
	},
];

// Terminal step map for buildTerminalHistory
const CONSOLE_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: testCommands, outputLines: testOutput },
];

// OptionCard step configs (indexed by step number)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Add Presence Validation',
		description:
			'Products are being created with blank names. How should you prevent empty values from being saved?',
		options: PRESENCE_OPTIONS,
	},
	1: {
		title: 'Add Uniqueness Validation',
		description:
			'Users are signing up with duplicate emails (including case variations like "Admin@" vs "admin@"). Pick the validation that prevents duplicates regardless of casing.',
		options: UNIQUENESS_OPTIONS,
	},
	2: {
		title: 'Add Format Validation',
		description:
			'Uniqueness alone is not enough. Strings like "not-an-email" still pass. Add a format check to ensure the email matches a proper pattern.',
		options: FORMAT_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the unvalidated model
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  # No validations!
  # Any data gets saved, even blanks and duplicates.
end`,
			highlight: [2, 3],
		});
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  # No email validation!
end`,
			highlight: [3],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	const productValidations: string[] = [];
	const userValidations: string[] = [];

	if (furthestStep >= 1) {
		productValidations.push('  validates :name, presence: true');
		productValidations.push('  validates :description, presence: true');
	}

	if (furthestStep >= 2) {
		userValidations.push(
			'  validates :email, uniqueness: { case_sensitive: false }',
		);
	}

	if (furthestStep >= 3) {
		userValidations.push(
			'  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }',
		);
	}

	files.push({
		filename: 'app/models/product.rb',
		language: 'ruby',
		code:
			productValidations.length > 0
				? `class Product < ApplicationRecord\n${productValidations.join('\n')}\nend`
				: `class Product < ApplicationRecord\n  # No validations yet.\nend`,
		highlight:
			productValidations.length > 0
				? productValidations.map((_, i) => i + 2)
				: [],
	});

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
${userValidations.join('\n')}
end`,
			highlight: userValidations.map((_, i) => i + 3),
		});
	}

	// After all steps: show controller error response pattern
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/products_controller.rb',
			language: 'ruby',
			code: `class Api::ProductsController < ApplicationController
  def create
    product = Product.new(product_params)

    if product.save
      render json: ProductSerializer.new(product), status: :created
    else
      render json: { errors: product.errors.full_messages },
             status: :unprocessable_entity
    end
  end
end`,
			highlight: [7, 8, 9],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Valid data (saved)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Invalid data (rejected with 422)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level12Validations({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Probe display state (tracks last probe for visualization) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;

	// ── Latest stress test result (for reward visualization) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];

	// ── Flow animation state ──
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
			const totalPhases = messages.length * 2 - 1;
			const delay = 1500;

			setFlowPhase(0);

			for (let p = 1; p <= totalPhases; p++) {
				const t = setTimeout(() => {
					setFlowPhase(p);
				}, delay * p);
				flowTimeoutsRef.current.push(t);
			}

			const endT = setTimeout(
				() => {
					setFlowPhase(-1);
				},
				delay * (totalPhases + 2),
			);
			flowTimeoutsRef.current.push(endT);
		},
		[clearFlow],
	);

	useEffect(() => {
		return () => clearFlow();
	}, [clearFlow]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			// Trigger discovery if this stage has one
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
			const messages = OBSERVE_FLOW[probeId];
			if (messages) runFlow(messages);
			// Mark all zones as inspected after animation reveals them
			setInspectedStages(new Set(['controller', 'model', 'database']));
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

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const messages = REWARD_FLOW[scenarioId];
			if (messages) runFlow(messages);
		},
		[stressTest, runFlow],
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
		return { valid: true, message: 'Validations are in place!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// Shuffle OptionCard options per step
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	// Code preview index: show result of previous steps while working, current step after completing
	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

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
							Your database is full of garbage data: empty products with no
							name, duplicate emails, and malformed addresses.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							ActiveRecord{' '}
							<span className="text-foreground font-medium">validations</span>{' '}
							catch bad data before it reaches the database, returning clear
							error messages to API consumers.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build phase: step progress */}
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

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Saved</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Rejected</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Validations"
					levelNumber={12}
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
							{/* Data Gate: three clickable zones connected by arrows */}
							<div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 relative">
								{/* Input Zone (Controller) */}
								<button
									className={`w-full max-w-sm border rounded-lg p-3 bg-card text-left transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: !inspectedStages.has('controller')
												? 'ring-1 ring-primary/20'
												: ''
									}`}
									onClick={() => handleStageClick('controller')}
									type="button"
								>
									<div className="flex items-center justify-between mb-1.5">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											Incoming Data
										</span>
										{!inspectedStages.has('controller') && (
											<span className="text-primary text-sm animate-pulse font-bold">
												?
											</span>
										)}
									</div>
									<pre className="text-xs font-mono text-foreground leading-relaxed">
										{lastProbeId
											? PROBE_DATA_CARD[lastProbeId]
											: '{ name: "...", description: "..." }'}
									</pre>
									{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
										<div
											className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
										>
											{flowMessages[0]}
										</div>
									)}
								</button>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 1}
									dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
								/>

								{/* Model Gate Zone */}
								<button
									className={`w-full max-w-sm border-2 rounded-lg p-4 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 2
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
											: probeDisplay
												? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10'
									} ${
										flowPhase !== 2 && !inspectedStages.has('model')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('model')}
									type="button"
								>
									<div className="font-mono text-xs text-muted-foreground">
										class Product &lt; ApplicationRecord
									</div>
									<div
										className={`text-sm font-medium mt-1.5 ${
											probeDisplay
												? 'text-destructive'
												: 'text-muted-foreground/50'
										}`}
									>
										{probeDisplay
											? probeDisplay.modelSublabel
											: '(no validations)'}
									</div>
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div
											className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
										>
											{flowMessages[1]}
										</div>
									)}
									{!inspectedStages.has('model') && flowPhase !== 2 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 3}
									dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
								/>

								{/* Database Zone */}
								<button
									className={`w-full max-w-sm border rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
										flowPhase === 4
											? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
											: probeDisplay
												? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'border-border bg-card'
									} ${
										flowPhase !== 4 && !inspectedStages.has('database')
											? 'ring-1 ring-primary/20'
											: ''
									}`}
									onClick={() => handleStageClick('database')}
									type="button"
								>
									<Database
										className={`w-5 h-5 mx-auto mb-1 ${
											flowPhase === 4
												? 'text-destructive'
												: probeDisplay
													? 'text-destructive'
													: 'text-muted-foreground'
										}`}
									/>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Database
									</div>
									{probeDisplay && (
										<div className="text-xs font-mono text-destructive font-bold mt-1">
											{probeDisplay.dbBadge}
										</div>
									)}
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div
											className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
										>
											{flowMessages[2]}
										</div>
									)}
									{!inspectedStages.has('database') && flowPhase !== 4 && (
										<div className="text-primary text-sm animate-pulse font-bold mt-1">
											?
										</div>
									)}
								</button>

								{/* Stage Inspector overlay */}
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									disabled={flowPhase !== -1}
									onProbe={handleProbe}
									probes={PROBES}
									title="Data Probe"
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
								{/* OptionCard steps (0, 1, 2) */}
								{currentOptionConfig && (
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

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</>
								)}

								{/* Terminal step (3: test invalid record, last step -> reward) */}
								{stepper.currentStep === 3 && (
									<TerminalChoiceStep
										commands={testCommands}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												You have a product with no name and no description. The
												record fails validation. How do you inspect the error
												messages that explain what went wrong?
											</p>
										}
										hasNext
										initialHistory={buildTerminalHistory(CONSOLE_STEP_MAP, 0)}
										onCorrect={() => stepper.completeStep()}
										onNext={() => {
											setPhase('reward');
											stressTest.reset();
										}}
										onWrong={(fb) => stepper.recordWrongAttempt(fb)}
										outputLines={testOutput}
										prompt="irb>"
										stepKey={stepper.currentStep}
										terminalTitle="Rails Console"
										title="Test Invalid Record"
									/>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							{/* Data Gate: now with active validations */}
							<div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
								{/* Input Zone */}
								<div
									className={`w-full max-w-sm border rounded-lg p-3 bg-card text-center transition-all duration-300 ${
										flowPhase === 0
											? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
											: ''
									}`}
								>
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
										Incoming Data
									</div>
									<div className="text-xs font-mono text-foreground">
										{lastResult
											? STRESS_SCENARIOS.find(
													(s) => s.id === lastResult.scenarioId,
												)?.label
											: 'Fire a scenario below'}
									</div>
									{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
										<div
											className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
										>
											{flowMessages[0]}
										</div>
									)}
								</div>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 1}
									dotColor={
										!lastResult
											? 'bg-primary'
											: lastResult.result === 'allowed'
												? 'bg-success'
												: 'bg-destructive'
									}
								/>

								{/* Validation Gate (active) */}
								<div
									className={`w-full max-w-sm border-2 rounded-lg p-4 text-center transition-all duration-300 ${
										flowPhase === 2
											? lastResult?.result === 'blocked'
												? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive bg-destructive/5 dark:bg-destructive/10'
												: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
											: !lastResult
												? 'border-success/40 bg-success/5 dark:bg-success/10'
												: lastResult.result === 'allowed'
													? 'border-success bg-success/10 dark:bg-success/15'
													: 'border-destructive bg-destructive/5 dark:bg-destructive/10'
									}`}
								>
									<div className="font-mono text-xs text-muted-foreground mb-2">
										class Product / User &lt; ApplicationRecord
									</div>
									<div className="space-y-0.5 font-mono text-xs text-success">
										<div>validates :name, presence: true</div>
										<div>validates :email, uniqueness: true</div>
										<div>validates :email, format: {'{ ... }'}</div>
									</div>
									{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mt-2 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												lastResult?.result === 'blocked'
													? 'text-destructive'
													: 'text-success'
											}`}
										>
											{flowMessages[1]}
										</div>
									)}
								</div>

								{/* Flow connector */}
								<FlowConnector
									active={flowPhase === 3}
									dotColor={
										!lastResult
											? 'bg-primary'
											: lastResult.result === 'allowed'
												? 'bg-success'
												: 'bg-destructive'
									}
								/>

								{/* Result Zone */}
								<div
									className={`w-full max-w-sm border rounded-lg p-3 text-center transition-all duration-300 ${
										flowPhase === 4
											? lastResult?.result === 'blocked'
												? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
												: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success/50 bg-success/10 dark:bg-success/15'
											: !lastResult
												? 'border-border bg-card'
												: lastResult.result === 'allowed'
													? 'border-success/50 bg-success/10 dark:bg-success/15'
													: 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
									}`}
								>
									{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
										<div
											className={`text-xs font-medium mb-1 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
												lastResult?.result === 'blocked'
													? 'text-destructive'
													: 'text-success'
											}`}
										>
											{flowMessages[2]}
										</div>
									)}
									{lastResult?.result === 'allowed' && (
										<>
											<Database className="w-5 h-5 mx-auto mb-1 text-success" />
											<div className="text-xs font-bold text-success">
												SAVED
											</div>
											<div className="text-xs text-success/70 mt-0.5">
												201 Created
											</div>
										</>
									)}
									{lastResult?.result === 'blocked' && (
										<>
											<X className="w-5 h-5 mx-auto mb-1 text-destructive" />
											<div className="text-xs font-bold text-destructive">
												422 Unprocessable Entity
											</div>
											<div className="text-xs font-mono text-destructive/70 mt-0.5">
												errors.full_messages
											</div>
										</>
									)}
									{!lastResult && (
										<>
											<Database className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
											<div className="text-xs text-muted-foreground">
												Waiting for scenario...
											</div>
										</>
									)}
								</div>
							</div>

							{/* Stress test controls */}
							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={flowPhase !== -1}
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
						phase === 'reward' ? STEP_DEFS.length : codePreviewStep,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level12Validations;

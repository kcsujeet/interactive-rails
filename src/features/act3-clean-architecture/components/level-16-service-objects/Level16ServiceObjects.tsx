/**
 * Level 16: Service Objects
 *
 * Sequential phase flow: intro -> build -> reward (Type 2: the problem
 * is code structure, visible by reading the code; no probes).
 *
 * Redesign (2026-07-10), anchored to myapp ground truth (level-15 tag):
 *   - The before-state is the REAL UsersController#create grown fat:
 *     email_address/password fields via params.expect, the welcome-email
 *     side effect from the callbacks level, default preferences, and an
 *     auto-login session whose token the response returns (the same
 *     user.sessions.create! pattern SessionsController uses).
 *   - No inline param validation anywhere: model validations (from the
 *     validations level) are the single source of truth; the service
 *     branches on user.save only. The old level carried controller
 *     param checks into the service and taught validation-in-service.
 *   - The thin controller STILL returns the session token. The old
 *     "fixed" controller silently dropped it (a real regression taught
 *     as the answer). Session creation stays in the controller: it
 *     needs request.remote_ip / request.user_agent, and a rake import
 *     must not log users in.
 *   - Result = Data.define(:success?, :user, :errors) syntax verified
 *     on Ruby 4.0.1 (myapp's interpreter).
 *   - The reward is interactive: the same workflow fires from three
 *     callers (controller, rake task, unit test), demonstrating the
 *     reuse the old static poster only asserted.
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
	type ValidationResult,
} from '@/components/levels';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import {
	type CallEdgeState,
	type CallerKey,
	CallersFlow,
	type CallerVizState,
	type ServiceVizState,
} from './CallersFlow';

registerLevelCode('act3-level16-service-objects', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro phase)
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'side-effect';
	code: string;
}

const ANNOTATED_SECTIONS: AnnotatedSection[] = [
	{
		id: 'core',
		label: 'Job 1: create the user',
		variant: 'core',
		code: `@user = User.new(user_params)
if @user.save`,
	},
	{
		id: 'welcome',
		label: 'Job 2: welcome email',
		variant: 'side-effect',
		code: `  send_welcome_email(@user)`,
	},
	{
		id: 'preferences',
		label: 'Job 3: default preferences',
		variant: 'side-effect',
		code: `  @user.update!(
    locale: "en", timezone: "UTC",
    notification_preference: "email",
  )`,
	},
	{
		id: 'session',
		label: 'Job 4: auto-login session',
		variant: 'side-effect',
		code: `  session = @user.sessions.create!(
    ip_address: request.remote_ip,
    user_agent: request.user_agent,
  )`,
	},
	{
		id: 'render',
		label: 'Job 5: HTTP response',
		variant: 'core',
		code: `  render json: {
    id: @user.id,
    email_address: @user.email_address,
    token: session.token,
  }, status: :created`,
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 OptionCard steps)
// ──────────────────────────────────────────────

export const STEP_DEFS: StepDef[] = [
	{ id: 'choose-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'define-result', title: 'Define the Return Value' },
	{ id: 'move-side-effects', title: 'Move the Side Effects' },
	{ id: 'wire-controller', title: 'Wire the Callers' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'concern',
		label: 'Extract into an ActiveSupport::Concern',
		correct: false,
		feedback:
			'Concerns mix shared behavior into existing classes. Signup is a multi-step workflow with one entry point, not behavior several models share.',
	},
	{
		id: 'callback',
		label: 'Move the extra work into model callbacks (after_create)',
		correct: false,
		feedback:
			'Callbacks run on every create, everywhere: admin edits, imports, tests. The callbacks lesson still holds: side effects do not belong in the model lifecycle.',
	},
	{
		id: 'service',
		label:
			'Extract into a plain Ruby class (UserRegistration) with one public method',
		correct: true,
	},
];

const RESULT_OPTIONS: StepOption[] = [
	{
		id: 'hash',
		label: 'Return a hash: { success: true, user: user, errors: [] }',
		correct: false,
		feedback:
			'Hashes have no shape guarantees. A typo like result[:succes] silently returns nil, and every caller has to remember which keys exist.',
	},
	{
		id: 'custom-class',
		label: 'Write a Result class with attr_reader, initialize, and freeze',
		correct: false,
		feedback:
			'Hand-rolled immutability and equality is boilerplate that drifts. Ruby ships a one-line way to define an immutable value object with named fields.',
	},
	{
		id: 'data-define',
		label: 'Result = Data.define(:success?, :user, :errors)',
		correct: true,
	},
];

const SIDE_EFFECTS_OPTIONS: StepOption[] = [
	{
		id: 'separate-services',
		label:
			'A separate service for each: WelcomeEmail.call, PreferenceSetter.call',
		correct: false,
		feedback:
			'Two more classes for a few lines each. Over-extraction scatters one workflow across files and makes the flow harder to follow, not easier.',
	},
	{
		id: 'background-job',
		label: 'Enqueue each one as a background job',
		correct: false,
		feedback:
			'The app has no job infrastructure yet, and this work has to be done before the response renders. Deferring it means half-registered users.',
	},
	{
		id: 'inline-in-call',
		label:
			'Run them in order inside the service, right after the save succeeds',
		correct: true,
	},
];

const WIRING_OPTIONS: StepOption[] = [
	{
		id: 'instantiate-manual',
		label: 'service = UserRegistration.new(user_params)\nservice.call',
		correct: false,
		feedback:
			'It works, but every caller now owns two steps plus the construction detail. Callers should not need to know how the service is built to use it.',
	},
	{
		id: 'call-class-method',
		label: 'result = UserRegistration.call(user_params)',
		correct: true,
	},
	{
		id: 'inline-block',
		label:
			'UserRegistration.new(user_params) do |service|\n  service.call\nend',
		correct: false,
		feedback:
			'A block adds ceremony without meaning here. Invocation should read as one predictable line at every call site.',
	},
];

export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Choose Extraction Pattern',
		description:
			'Signup is one action doing five jobs, and next week support needs the same workflow from a CSV import, with no HTTP request anywhere. Where should the workflow live?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define the Return Value',
		description:
			'The workflow has a new home. The controller, the rake task, and the tests all need to know whether it worked, and why not. What does it hand back?',
		options: RESULT_OPTIONS,
	},
	2: {
		title: 'Move the Side Effects',
		description:
			'The welcome email and the default preferences moved out of the controller with the workflow. Where do they run?',
		options: SIDE_EFFECTS_OPTIONS,
	},
	3: {
		title: 'Wire the Callers',
		description:
			'The service is complete. How does the controller (or the rake task, or a test) invoke it?',
		options: WIRING_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Reward: scenarios + frames (three callers, one workflow)
// ──────────────────────────────────────────────

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'api-signup',
		label: 'Customer signs up through the storefront',
		description: 'The controller delegates and renders the Result',
		method: 'POST',
		path: '/users',
		actor: 'storefront',
		expectedResult: 'allowed',
		story: [
			'A customer submits the signup form.',
			'The controller hands user_params to the service and waits for a Result.',
			'The service saves the user, sends the welcome email, applies default preferences, and returns success.',
			'The controller creates the login session and renders 201 with the token, exactly what the fat version returned, from an action you can read in one breath.',
		],
	},
	{
		id: 'invalid-signup',
		label: 'Sign up with an email that is already taken',
		description: 'Model validations speak; the service passes them through',
		method: 'POST',
		path: '/users',
		actor: 'storefront',
		expectedResult: 'blocked',
		story: [
			'A customer signs up with an address that already has an account.',
			'user.save fails: the model validations from the validations level are still the single source of truth.',
			'The service returns a failure Result carrying the model errors. No email is sent, no preferences are written, no session is created.',
			'The controller renders 422 with the errors. Failure is a value the caller branches on, not an exception to untangle.',
		],
	},
	{
		id: 'rake-import',
		label: 'Bulk-import 500 sellers from a CSV',
		description: 'The rake task calls the same workflow, no HTTP anywhere',
		method: 'RAKE',
		path: 'lib/tasks/seller_import.rake',
		actor: 'support team',
		expectedResult: 'allowed',
		story: [
			'Support hands over a CSV of 500 sellers from the partner program.',
			'The rake task loops the rows and calls UserRegistration.call for each one: the exact workflow the storefront uses, welcome emails and preferences included.',
			'Failed rows come back as failure Results and land in a report instead of aborting the run.',
			'No sessions are created: importing an account is not logging someone in, which is exactly why the session stayed in the controller.',
		],
	},
	{
		id: 'unit-test',
		label: 'Run the signup test without HTTP',
		description:
			'The test calls the service directly and asserts on the Result',
		method: 'TEST',
		path: 'test/services/user_registration_test.rb',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'The test calls UserRegistration.call with plain attributes.',
			'No router, no request, no controller: the workflow runs as ordinary Ruby.',
			'Assertions read straight off the Result: success?, the user, the errors.',
			'The whole file runs in a blink, which is what makes the workflow cheap to change from now on.',
		],
	},
];

export type RewardFrame = {
	callers?: Partial<Record<CallerKey, Partial<CallerVizState>>>;
	service?: Partial<ServiceVizState>;
	edges?: Partial<Record<CallerKey, Partial<CallEdgeState>>>;
};

export const REWARD_SCENARIO_FRAMES: Record<string, RewardFrame[]> = {
	'api-signup': [
		{
			callers: {
				controller: {
					sublabel: 'POST /users from the signup form',
					badge: 'POST',
					flash: 'amber',
				},
			},
			edges: {
				controller: {
					active: true,
					reverse: false,
					label: 'UserRegistration.call(user_params)',
				},
			},
		},
		{
			service: {
				sublabel: 'save -> welcome email -> preferences',
				badge: 'RUNNING',
				flash: 'amber',
			},
			edges: { controller: { active: false, label: '' } },
		},
		{
			service: {
				sublabel: 'workflow finished',
				badge: 'SUCCESS',
				flash: 'green',
			},
			edges: {
				controller: {
					active: true,
					reverse: true,
					label: 'Result(success?: true, user)',
				},
			},
		},
		{
			callers: {
				controller: {
					sublabel: 'creates the session, renders id + token',
					badge: '201',
					flash: 'green',
				},
			},
			edges: { controller: { active: false, label: '' } },
		},
	],
	'invalid-signup': [
		{
			callers: {
				controller: {
					sublabel: 'POST /users, email already taken',
					badge: 'POST',
					flash: 'amber',
				},
			},
			edges: {
				controller: {
					active: true,
					reverse: false,
					label: 'UserRegistration.call(user_params)',
				},
			},
		},
		{
			service: {
				sublabel: 'user.save fails: model validations speak',
				badge: 'SAVE FAILED',
				flash: 'red',
			},
			edges: { controller: { active: false, label: '' } },
		},
		{
			service: {
				sublabel: 'no email sent, no preferences written',
				badge: 'FAILURE RESULT',
				flash: 'red',
			},
			edges: {
				controller: {
					active: true,
					reverse: true,
					label: 'Result(success?: false, errors)',
				},
			},
		},
		{
			callers: {
				controller: {
					sublabel: 'renders the model errors, no session created',
					badge: '422',
					flash: 'red',
				},
			},
			edges: { controller: { active: false, label: '' } },
		},
	],
	'rake-import': [
		{
			callers: {
				rake: {
					sublabel: 'reads 500 CSV rows from the partner program',
					badge: 'CSV',
					flash: 'amber',
				},
			},
			edges: {
				rake: {
					active: true,
					reverse: false,
					label: 'UserRegistration.call(row) x 500',
				},
			},
		},
		{
			service: {
				sublabel: 'same workflow, no HTTP anywhere',
				badge: 'RUNNING',
				flash: 'amber',
			},
			edges: { rake: { active: false, label: '' } },
		},
		{
			service: {
				sublabel: 'one Result per row',
				badge: 'DONE',
				flash: 'green',
			},
			edges: {
				rake: {
					active: true,
					reverse: true,
					label: '497 success, 3 failures reported',
				},
			},
		},
		{
			callers: {
				rake: {
					sublabel: 'no sessions created: imports do not log anyone in',
					badge: 'DONE',
					flash: 'green',
				},
			},
			edges: { rake: { active: false, label: '' } },
		},
	],
	'unit-test': [
		{
			callers: {
				test: {
					sublabel: 'calls the service with plain attributes',
					badge: 'RUN',
					flash: 'amber',
				},
			},
			edges: {
				test: {
					active: true,
					reverse: false,
					label: 'UserRegistration.call(attrs)',
				},
			},
		},
		{
			service: {
				sublabel: 'runs without router, request, or controller',
				badge: 'RUNNING',
				flash: 'amber',
			},
			edges: { test: { active: false, label: '' } },
		},
		{
			service: {
				sublabel: 'workflow finished',
				badge: 'SUCCESS',
				flash: 'green',
			},
			edges: {
				test: { active: true, reverse: true, label: 'assert result.success?' },
			},
		},
		{
			callers: {
				test: {
					sublabel: 'green in 0.03s, no HTTP in the whole file',
					badge: 'PASS',
					flash: 'green',
				},
			},
			edges: { test: { active: false, label: '' } },
		},
	],
};

const BASE_CALLERS: Record<CallerKey, CallerVizState> = {
	controller: { sublabel: 'POST /users', badge: null, flash: 'idle' },
	rake: {
		sublabel: 'lib/tasks/seller_import.rake',
		badge: null,
		flash: 'idle',
	},
	test: {
		sublabel: 'test/services/user_registration_test.rb',
		badge: null,
		flash: 'idle',
	},
};

const BASE_SERVICE: ServiceVizState = {
	sublabel: 'one workflow, one entry point',
	badge: null,
	flash: 'idle',
};

const IDLE_CALL_EDGE: CallEdgeState = {
	active: false,
	reverse: false,
	label: '',
};

const BASE_EDGES: Record<CallerKey, CallEdgeState> = {
	controller: IDLE_CALL_EDGE,
	rake: IDLE_CALL_EDGE,
	test: IDLE_CALL_EDGE,
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

// The real UsersController from myapp (level-15 tag), grown fat by the
// preferences + auto-login work this level opens with.
const FAT_CONTROLLER = `class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    @user = User.new(user_params)

    if @user.save
      send_welcome_email(@user)

      @user.update!(
        locale: "en",
        timezone: "UTC",
        notification_preference: "email",
      )

      session = @user.sessions.create!(
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
      )

      render json: {
        id: @user.id,
        email_address: @user.email_address,
        token: session.token,
      }, status: :created
    else
      render json: { errors: @user.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.expect(user: [ :email_address, :password ])
  end

  def send_welcome_email(user)
    Rails.logger.info "TODO welcome email to #{user.email_address}"
  end
end`;

const SERVICE_COMPLETE = `class UserRegistration
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)

    unless user.save
      return Result.new(
        success?: false, user: nil,
        errors: user.errors.full_messages,
      )
    end

    send_welcome_email(user)
    apply_default_preferences(user)

    Result.new(success?: true, user: user, errors: [])
  end

  private

  def send_welcome_email(user)
    Rails.logger.info "TODO welcome email to #{user.email_address}"
  end

  def apply_default_preferences(user)
    user.update!(
      locale: "en",
      timezone: "UTC",
      notification_preference: "email",
    )
  end
end`;

export function getCodeFiles(phase: Phase, completedStep: number) {
	const files = [];

	if (phase === 'intro' || completedStep < 0) {
		return [
			{
				filename: 'app/controllers/users_controller.rb',
				language: 'ruby',
				code: FAT_CONTROLLER,
				highlight: [8, 10, 11, 12, 13, 14, 16, 17, 18, 19],
			},
		];
	}

	// The fat controller stays visible (unchanged) until the wiring step.
	if (completedStep < 3) {
		files.push({
			filename: 'app/controllers/users_controller.rb',
			language: 'ruby',
			code: FAT_CONTROLLER,
			highlight: [],
		});
	}

	if (completedStep === 0) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `class UserRegistration
  # The workflow moves here. What should #call hand back?

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)
    # save, side effects, and then... return what to the caller?
  end
end`,
			highlight: [2],
		});
	}

	if (completedStep === 1) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `class UserRegistration
  Result = Data.define(:success?, :user, :errors)

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)

    unless user.save
      return Result.new(
        success?: false, user: nil,
        errors: user.errors.full_messages,
      )
    end

    # Side effects: the welcome email and the default
    # preferences moved with the workflow. Where do they run?

    Result.new(success?: true, user: user, errors: [])
  end
end`,
			highlight: [2, 18, 19],
		});
	}

	if (completedStep === 2) {
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: `${SERVICE_COMPLETE}

# How does the controller invoke this?`,
			highlight: [18, 19],
		});
	}

	if (completedStep >= 3) {
		files.push({
			filename: 'app/services/application_service.rb',
			language: 'ruby',
			code: `class ApplicationService
  def self.call(...)
    new(...).call
  end
end`,
			highlight: [2],
		});
		files.push({
			filename: 'app/services/user_registration.rb',
			language: 'ruby',
			code: SERVICE_COMPLETE.replace(
				'class UserRegistration',
				'class UserRegistration < ApplicationService',
			),
			highlight: [2],
		});
		files.push({
			filename: 'app/controllers/users_controller.rb',
			language: 'ruby',
			code: `class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    result = UserRegistration.call(user_params)

    if result.success?
      session = result.user.sessions.create!(
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
      )

      render json: {
        id: result.user.id,
        email_address: result.user.email_address,
        token: session.token,
      }, status: :created
    else
      render json: { errors: result.errors },
             status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.expect(user: [ :email_address, :password ])
  end
end`,
			highlight: [5, 7, 16],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level16ServiceObjects({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Reward visualization state ──
	const [callerStates, setCallerStates] = useState(BASE_CALLERS);
	const [serviceState, setServiceState] = useState(BASE_SERVICE);
	const [edgeStates, setEdgeStates] = useState(BASE_EDGES);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setCallerStates(structuredClone(BASE_CALLERS));
		setServiceState(structuredClone(BASE_SERVICE));
		setEdgeStates(structuredClone(BASE_EDGES));
	}, []);

	const applyFrame = useCallback((frame: RewardFrame) => {
		if (frame.callers) {
			setCallerStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.callers ?? {})) {
					next[key as CallerKey] = { ...next[key as CallerKey], ...patch };
				}
				return next;
			});
		}
		if (frame.service) {
			setServiceState((prev) => ({ ...prev, ...frame.service }));
		}
		if (frame.edges) {
			setEdgeStates((prev) => {
				const next = { ...prev };
				for (const [key, patch] of Object.entries(frame.edges ?? {})) {
					next[key as CallerKey] = { ...next[key as CallerKey], ...patch };
				}
				return next;
			});
		}
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
							setEdgeStates((prev) => {
								const next = { ...prev };
								for (const key of Object.keys(next) as CallerKey[]) {
									next[key] = { ...next[key], active: false };
								}
								return next;
							});
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
		return {
			valid: true,
			message:
				'Workflow extracted: one service with one entry point, a Result the caller branches on, and a controller that only speaks HTTP.',
		};
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
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Signup kept growing. The{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								UsersController#create
							</code>{' '}
							action now creates the user, sends the welcome email, applies
							default preferences, logs the customer in, and renders the
							response: five jobs in one method.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Next week support needs the same workflow to bulk-import 500
							sellers from a CSV, with no HTTP request anywhere. Move the
							workflow into one dedicated, testable home and give it a return
							value every caller can branch on.
						</p>
					</div>

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

					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Result Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<Check className="w-4 h-4 text-success shrink-0" />
										<span className="text-foreground">
											Success Result: the workflow ran to the end
										</span>
									</div>
									<div className="flex items-center gap-2">
										<X className="w-4 h-4 text-destructive shrink-0" />
										<span className="text-foreground">
											Failure Result: clean 422, no half-done side effects
										</span>
									</div>
								</div>
							</div>
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Success</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Failure</div>
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
					levelName="Service Objects"
					levelNumber={16}
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
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									The Problem: UsersController#create
								</div>
								<span className="text-xs font-mono text-destructive font-bold">
									one action, five jobs
								</span>
							</div>

							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-1">
									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'def create'}
									</pre>

									{ANNOTATED_SECTIONS.map((section) => {
										const isSideEffect = section.variant === 'side-effect';
										return (
											<div
												className={`border-l-2 rounded-r-md px-3 py-2 ${
													isSideEffect
														? 'border-l-warning bg-warning/5 dark:bg-warning/10'
														: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30'
												}`}
												key={section.id}
											>
												<div className="flex items-center gap-2 mb-1">
													<Badge
														className={`text-[10px] px-1.5 py-0 ${
															isSideEffect
																? 'border-warning/50 text-warning'
																: 'text-muted-foreground'
														}`}
														variant={isSideEffect ? 'outline' : 'secondary'}
													>
														{section.label}
													</Badge>
												</div>
												<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
													{section.code}
												</pre>
											</div>
										);
									})}

									<pre className="text-xs font-mono text-muted-foreground px-3 py-1">
										{'end'}
									</pre>
								</div>
							</div>

							<div className="px-6 py-3">
								<div className="max-w-lg mx-auto">
									<div className="border border-warning/30 bg-warning/5 dark:bg-warning/10 rounded-lg p-3 text-sm text-foreground">
										<strong>Five jobs in one method.</strong> Support wants to
										bulk-import 500 sellers from a CSV next week. None of this
										can run outside an HTTP request, and none of it can be
										tested without one.
									</div>
								</div>
							</div>

							<div className="p-4 flex justify-center">
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
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>

								<div className="space-y-2">
									{shuffledOptions.map((opt) =>
										isViewingCompletedStep ? (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.label}
												selected={opt.correct}
												size="lg"
											/>
										) : (
											<OptionCard
												color="violet"
												key={opt.id}
												mono
												name={opt.label}
												onClick={() => handleOptionClick(opt)}
												size="lg"
											/>
										),
									)}
								</div>

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
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 flex flex-col min-h-0">
								<CallersFlow
									callers={callerStates}
									edges={edgeStates}
									service={serviceState}
								/>
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
					learningGoal="A service object is a plain Ruby class that owns one multi-step workflow: one public entry point in, one immutable Result out. The controller shrinks to HTTP work (params in, status codes out, session creation with request context), and the same workflow becomes callable from rake tasks and tests with no HTTP anywhere."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level16ServiceObjects;

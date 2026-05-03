/**
 * Level 35: Action Mailer
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   discover that there is no mailer, no token generation, and no password
 *   reset endpoint. Fire API probes to confirm the dead end.
 *   Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 5 steps (mix of OptionCard + TerminalChoiceStep)
 *   Step 0: Add generates_token_for to User model (OptionCard)
 *   Step 1: Generate the mailer (TerminalChoiceStep)
 *   Step 2: Build the password reset email mailer method (OptionCard)
 *   Step 3: Build the email template with ERB (OptionCard)
 *   Step 4: Create the password reset controller (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire password reset scenarios at
 *   the new flow and watch allowed/blocked results.
 *
 * Teaches: Action Mailer, generates_token_for, deliver_later, stateless tokens
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
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

registerLevelCode('act5-level35-action-mailer', () =>
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
	{ id: 'no-reset-endpoint', label: 'No password reset endpoint' },
	{ id: 'no-token-generation', label: 'No token generation' },
	{ id: 'no-mailer', label: 'No mailer configured' },
	{ id: 'manual-resets', label: 'Manual resets only' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'post-password-reset',
		label: 'POST /api/password_resets',
		command: 'POST /api/password_resets {email: "user@example.com"}',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{
				text: '{"error":"No route matches POST /api/password_resets"}',
				color: 'muted',
			},
			{
				text: 'No route exists. Users who forget their password have no way to recover.',
				color: 'yellow',
			},
			{
				text: 'Password reset is a dead end. No endpoint, no flow.',
				color: 'red',
			},
		],
		story: [
			'A customer forgets their password and clicks "Reset password."',
			'The app sends a POST to /api/password_resets.',
			'Rails returns 404: no route matches. The endpoint does not exist.',
			'The customer is stuck with no way to recover their account.',
		],
	},
	{
		id: 'check-support',
		label: 'Check support tickets',
		command: 'GET /admin/support_tickets?tag=password_reset',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'muted' },
			{
				text: '{"total":47,"this_week":12,"avg_resolution":"3.2 hours"}',
				color: 'muted',
			},
			{
				text: '47 manual password reset requests. 12 this week alone.',
				color: 'yellow',
			},
			{
				text: 'Support is manually running User.find_by(email: ...).update!(password: ...) in console.',
				color: 'red',
			},
		],
		story: [
			'The support team checks their ticket queue for password-related issues.',
			'47 manual password reset requests total, 12 this week alone.',
			'Each one requires a support agent to open a Rails console and reset the password by hand.',
			'Average resolution time is 3.2 hours per ticket. This does not scale.',
		],
	},
	{
		id: 'inspect-user',
		label: 'Inspect User model',
		command: 'User.instance_methods.grep(/token|reset|mailer/)',
		responseLines: [
			{ text: '=> []', color: 'muted' },
			{
				text: 'No token generation methods. No reset flow. No mailer integration.',
				color: 'yellow',
			},
			{
				text: 'The User model has has_secure_password but nothing else for password recovery.',
				color: 'red',
			},
		],
		story: [
			'A developer inspects the User model for password recovery methods.',
			'User.instance_methods.grep(/token|reset|mailer/) returns an empty array.',
			'The model has has_secure_password for login, but no token generation or mailer integration.',
			'There is no programmatic way to generate a reset token or send a recovery email.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'post-password-reset': 'no-reset-endpoint',
	'check-support': 'manual-resets',
	'inspect-user': 'no-token-generation',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ controllerSublabel: string; modelBadge: string }
> = {
	'post-password-reset': {
		controllerSublabel: '404 NOT FOUND',
		modelBadge: 'DEAD END',
	},
	'check-support': {
		controllerSublabel: 'NO ROUTE',
		modelBadge: 'MANUAL ONLY',
	},
	'inspect-user': {
		controllerSublabel: 'NO ACTION',
		modelBadge: 'NO TOKEN',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'A user who forgot their password tries to POST to /api/password_resets. The request never reaches a controller because no route is defined for password resets.',
	},
	router: {
		stageId: 'router',
		title: 'Router',
		description:
			'The router has no entry for password_resets. The request hits a 404 dead end. There is no self-service recovery path.',
		code: `Rails.application.routes.draw do
  namespace :api do
    resources :products
    resources :reviews
    # No password_resets route!
  end
end`,
	},
	controller: {
		stageId: 'controller',
		title: 'Controller (Missing!)',
		description:
			'There is no PasswordResetsController. No action exists to accept a reset request, generate a token, or send an email. Users are completely stuck.',
	},
	model: {
		stageId: 'model',
		title: 'User Model',
		description:
			'The User model has has_secure_password for authentication, but no token generation for password recovery. There is no generates_token_for, no reset method, and no mailer integration.',
		code: `class User < ApplicationRecord
  has_secure_password
  has_many :products
  has_many :reviews

  # No generates_token_for!
  # No password reset support at all.
end`,
	},
	database: {
		stageId: 'database',
		title: 'Database',
		description:
			'The users table stores password_digest but has no token columns. With generates_token_for, you do not need to store tokens in the database at all.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	controller: 'no-reset-endpoint',
	model: 'no-token-generation',
	router: 'no-mailer',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'post-password-reset',
		label: 'POST /api/password_resets',
		description: 'Password reset endpoint now exists (was 404)',
		method: 'POST',
		path: '/api/password_resets',
		actor: 'user@example.com',
		expectedResult: 'allowed',
	},
	{
		id: 'check-support',
		label: 'Check support tickets',
		description: 'Manual resets no longer needed (self-service works)',
		method: 'GET',
		path: '/admin/support_tickets?tag=password_reset',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'inspect-user',
		label: 'Inspect User model',
		description: 'User now has generates_token_for (was missing)',
		method: 'GET',
		path: '/api/user/token_methods',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'valid-email',
		label: 'Valid email reset',
		description: 'POST with a registered email address',
		method: 'POST',
		path: '/api/password_resets',
		actor: 'user@example.com',
		expectedResult: 'allowed',
	},
	{
		id: 'nonexistent-email',
		label: 'Non-existent email',
		description: 'POST with unknown email (same response, no leak)',
		method: 'POST',
		path: '/api/password_resets',
		actor: 'nobody@example.com',
		expectedResult: 'allowed',
	},
	{
		id: 'valid-token-reset',
		label: 'Valid token reset',
		description: 'PATCH with a fresh, valid token',
		method: 'PATCH',
		path: '/api/password_resets/:token',
		actor: 'user@example.com',
		expectedResult: 'allowed',
	},
	{
		id: 'expired-token',
		label: 'Expired token',
		description: 'PATCH with a token older than 15 minutes',
		method: 'PATCH',
		path: '/api/password_resets/:token',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
	{
		id: 'used-token',
		label: 'Already-used token',
		description: 'PATCH with a token after password was changed',
		method: 'PATCH',
		path: '/api/password_resets/:token',
		actor: 'attacker',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (5 steps: OptionCard, Terminal, OptionCard x3)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-token', title: 'Add generates_token_for' },
	{ id: 'generate-mailer', title: 'Generate the Mailer' },
	{ id: 'build-email', title: 'Build the Reset Email' },
	{ id: 'build-template', title: 'Build the Email Template' },
	{ id: 'create-controller', title: 'Create the Controller' },
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

// Step 0: Add generates_token_for to User model
const TOKEN_OPTIONS: StepOption[] = [
	{
		id: 'random-token-column',
		label: `add_column :users, :reset_token, :string\nuser.update!(reset_token: SecureRandom.hex)`,
		correct: false,
		feedback:
			'Storing tokens in a column means you have to manage expiry, cleanup, and secure comparison yourself. Rails 8 has a built-in approach that handles all of this.',
	},
	{
		id: 'generates-with-expiry',
		label: `generates_token_for :password_reset, expires_in: 15.minutes do\n  password_salt&.last(10)\nend`,
		correct: true,
	},
	{
		id: 'generates-no-expiry',
		label: `generates_token_for :password_reset`,
		correct: false,
		feedback:
			'Without an expiry duration, tokens live forever. A leaked token could be used days or weeks later. You need a time limit.',
	},
];

// Step 2: Build the password reset email
const EMAIL_OPTIONS: StepOption[] = [
	{
		id: 'no-token-in-url',
		label: `def password_reset(user)\n  @user = user\n  mail(to: user.email, subject: "Reset your password")\nend`,
		correct: false,
		feedback:
			'The email body needs a verifiable proof of identity for the recipient. Without it, anyone could claim to be that user.',
	},
	{
		id: 'deliver-now-inline',
		label: `def password_reset(user)\n  @user = user\n  @token = user.generate_token_for(:password_reset)\n  mail(to: user.email, subject: "Reset your password").deliver_now\nend`,
		correct: false,
		feedback:
			'Calling deliver_now inside the mailer method blocks the entire request. Delivery should be triggered by the controller, not hardcoded in the mailer.',
	},
	{
		id: 'correct-mailer',
		label: `def password_reset(user)\n  @user = user\n  @token = user.generate_token_for(:password_reset)\n  mail(to: user.email, subject: "Reset your password")\nend`,
		correct: true,
	},
];

// Step 3: Build the Email Template (ERB)
const TEMPLATE_OPTIONS: StepOption[] = [
	{
		id: 'mustache-style',
		label: `<h1>Reset your password</h1>
<p>Hi {{ user.name }},</p>
<p>You requested a password reset.</p>
<p>{{ link_to "Reset password", password_reset_url(token) }}</p>
<p>This link expires in 15 minutes.</p>`,
		correct: false,
		feedback:
			'Curly-brace interpolation ({{ ... }}) is what JavaScript template libraries use (Handlebars, Vue, Mustache). Rails uses a different template syntax that mixes Ruby code with HTML.',
	},
	{
		id: 'no-output-tag',
		label: `<h1>Reset your password</h1>
<p>Hi <% @user.name %>,</p>
<p>You requested a password reset.</p>
<p><% link_to "Reset password", password_reset_url(@token) %></p>
<p>This link expires in 15 minutes.</p>`,
		correct: false,
		feedback:
			'These tags run the Ruby code but do not print anything to the page. The user would see "Hi ," and an empty link. There is a small character difference between "run code" tags and "output the value" tags.',
	},
	{
		id: 'correct-erb',
		label: `<h1>Reset your password</h1>
<p>Hi <%= @user.name %>,</p>
<p>You requested a password reset.</p>
<p><%= link_to "Reset password", password_reset_url(@token) %></p>
<p>This link expires in 15 minutes.</p>`,
		correct: true,
	},
];

// Step 4: Create the password reset controller
const CONTROLLER_OPTIONS: StepOption[] = [
	{
		id: 'find-by-token-deliver-now',
		label: `def create\n  user = User.find_by(email: params[:email])\n  UserMailer.password_reset(user).deliver_now if user\n  render json: { message: "Check your email" }\nend`,
		correct: false,
		feedback:
			'deliver_now blocks the HTTP request while waiting for SMTP. Under load, this causes timeouts. Background delivery is the Rails convention.',
	},
	{
		id: 'correct-controller',
		label: `def create\n  user = User.find_by(email: params[:email])\n  UserMailer.password_reset(user).deliver_later if user\n  render json: { message: "Check your email" }\nend`,
		correct: true,
	},
	{
		id: 'find-by-email-leak',
		label: `def create\n  user = User.find_by!(email: params[:email])\n  UserMailer.password_reset(user).deliver_later\n  render json: { message: "Email sent" }\nend`,
		correct: false,
		feedback:
			'find_by! raises an error if the email is not found. That reveals whether an email is registered, which is an information leak.',
	},
];

// Map from step index -> OptionCard config (null for terminal steps)
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Add generates_token_for',
		description:
			'The User model needs a way to generate secure, expiring password reset tokens. Rails 8 provides a built-in method that creates signed tokens without storing anything in the database. How should you configure it?',
		options: TOKEN_OPTIONS,
	},
	2: {
		title: 'Build the Reset Email',
		description:
			'The mailer method receives a user and needs to generate a token, build a reset URL, and compose the email. How should the password_reset method look?',
		options: EMAIL_OPTIONS,
	},
	3: {
		title: 'Build the Email Template',
		description:
			'The generator created app/views/user_mailer/password_reset.html.erb but it is empty. This is the actual HTML the user receives in their inbox. Rails uses ERB (Embedded Ruby) for templates: HTML with special tags that mix in Ruby code. The mailer method already set @user and @token for the template to use. Pick the version that builds the correct email.',
		options: TEMPLATE_OPTIONS,
	},
	4: {
		title: 'Create the Controller',
		description:
			'The PasswordResetsController#create action receives an email address, looks up the user, and sends the reset email. It must not leak whether the email exists and must not block the request during delivery.',
		options: CONTROLLER_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Terminal step data (Step 1: generate the mailer)
// ──────────────────────────────────────────────

const MAILER_TERMINAL_COMMANDS = [
	{
		id: 'generate-controller',
		label: 'rails generate controller UserMailer password_reset',
		command: 'rails generate controller UserMailer password_reset',
		correct: false,
		feedback:
			'Mailers have their own generator. Using the controller generator creates HTTP controllers, not mailer classes.',
	},
	{
		id: 'generate-mailer',
		label: 'rails generate mailer User password_reset',
		command: 'rails generate mailer User password_reset',
		correct: true,
	},
	{
		id: 'generate-model',
		label: 'rails generate model UserMailer',
		command: 'rails generate model UserMailer',
		correct: false,
		feedback:
			'Mailers are not models. Rails has a dedicated generator for mailer classes with their own directory and templates.',
	},
];

const MAILER_TERMINAL_OUTPUT = [
	{ text: 'create  app/mailers/user_mailer.rb', color: 'green' as const },
	{
		text: 'create  app/views/user_mailer/password_reset.html.erb',
		color: 'green' as const,
	},
	{
		text: 'create  app/views/user_mailer/password_reset.text.erb',
		color: 'green' as const,
	},
	{
		text: 'create  test/mailers/user_mailer_test.rb',
		color: 'green' as const,
	},
	{
		text: 'create  test/mailers/previews/user_mailer_preview.rb',
		color: 'green' as const,
	},
];

// Build the terminal step map for history (null = OptionCard step)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // Step 0: OptionCard
	{
		commands: MAILER_TERMINAL_COMMANDS,
		outputLines: MAILER_TERMINAL_OUTPUT,
	}, // Step 1: Terminal
	null, // Step 2: OptionCard (build email method)
	null, // Step 3: OptionCard (build template)
	null, // Step 4: OptionCard (create controller)
];

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'model', dots: 'mixed' },
	{ from: 'model', to: 'database', dots: 'mixed' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'model', dots: 'clean' },
	{ from: 'model', to: 'mailer', dots: 'clean' },
	{ from: 'mailer', to: 'response', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show User model with no token generation
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  has_many :products
  has_many :reviews

  # No generates_token_for!
  # No password reset support.
  # Users who forget their password are locked out.
end`,
			highlight: [6, 7, 8],
		});
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: `Rails.application.routes.draw do
  namespace :api do
    resources :products
    resources :reviews
    # No password_resets route!
  end
end`,
			highlight: [6],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		// Step 0: player is choosing the token config
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  has_many :products
  has_many :reviews

  # Add token generation here...
end`,
			highlight: [6],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  has_many :products
  has_many :reviews

  generates_token_for :password_reset,
                      expires_in: 15.minutes do
    password_salt&.last(10)
  end
end`,
			highlight: [6, 7, 8, 9],
		});
	}

	if (furthestStep >= 2) {
		files.push({
			filename: 'app/mailers/user_mailer.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class UserMailer < ApplicationMailer
  def password_reset(user)
    @user = user
    @token = user.generate_token_for(:password_reset)

    mail(to: user.email, subject: "Reset your password")
  end
end`
					: `class UserMailer < ApplicationMailer
  def password_reset(user)
    @user = user
    # Build the email method...
  end
end`,
			highlight: furthestStep >= 3 ? [3, 4, 6] : [4],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/views/user_mailer/password_reset.html.erb',
			language: 'erb',
			code: `<h1>Reset your password</h1>
<p>Hi <%= @user.name %>,</p>
<p>You requested a password reset.</p>
<p><%= link_to "Reset password", password_reset_url(@token) %></p>
<p>This link expires in 15 minutes.</p>`,
			highlight: [2, 4],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/api/password_resets_controller.rb',
			language: 'ruby',
			code: `class Api::PasswordResetsController < ApplicationController
  def create
    user = User.find_by(email: params[:email])
    UserMailer.password_reset(user).deliver_later if user
    render json: { message: "Check your email" }
  end

  def update
    user = User.find_by_token_for(:password_reset, params[:token])
    if user
      user.update!(password: params[:password])
      render json: { message: "Password updated" }
    else
      render json: { error: "Invalid or expired token" },
             status: :unprocessable_entity
    end
  end
end`,
			highlight: [3, 4, 5, 9, 10, 11],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase left panel)
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
					<span className="text-foreground">
						Valid request (token accepted, email sent)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Rejected (expired or used token)
					</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level35ActionMailer({ onComplete }: LevelComponentProps) {
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

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'request',
				label: 'Request',
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'router',
				label: 'Router',
				inspectable: true,
				inspected: inspectedStages.has('router'),
			},
			{
				id: 'controller',
				label: 'Controller',
				sublabel: probeDisplay ? probeDisplay.controllerSublabel : '(missing!)',
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'model',
				label: 'User Model',
				badge: probeDisplay ? probeDisplay.modelBadge : 'NO RESET',
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				inspectable: true,
				inspected: inspectedStages.has('database'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'router', label: 'Router' },
			{
				id: 'controller',
				label: 'PasswordResets',
				sublabel: wasBlocked ? 'Token Invalid' : 'find_by_token_for',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'REJECTED' : undefined,
			},
			{
				id: 'model',
				label: 'User Model',
				sublabel: wasBlocked ? 'nil (not found)' : 'generate_token_for',
			},
			{
				id: 'mailer',
				label: 'Mailer',
				sublabel: wasBlocked ? 'skipped' : 'deliver_later',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? 'BLOCKED' : 'SENT',
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: wasBlocked ? '422' : '200',
			},
		];
	}, [lastResult]);

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
		},
		[discoveryGating],
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

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
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
		return { valid: true, message: 'Password reset flow is live!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const isTerminalStep = stepper.currentStep === 1;

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
							Users who forget their password are completely locked out. There
							is no self-service recovery flow. Support tickets for manual
							password resets are piling up, averaging 12 per week.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							You need to build a secure password reset flow using Rails 8{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								generates_token_for
							</code>{' '}
							and Action Mailer with{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								deliver_later
							</code>
							.
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
										<div className="text-xs text-success/70">Allowed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
									</div>
								</div>
							</div>
						</>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Action Mailer"
					levelNumber={35}
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
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
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
									onProbe={handleProbe}
									probes={PROBES}
									title="Password Reset Probe"
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
								{/* Terminal step (Step 1) */}
								{isTerminalStep && (
									<TerminalChoiceStep
										commands={MAILER_TERMINAL_COMMANDS}
										completed={isViewingCompletedStep}
										description={
											<p className="text-sm text-muted-foreground">
												Rails has a dedicated generator for mailer classes. It
												creates the mailer file, email templates (HTML and
												text), a test file, and a preview file. Which command
												generates the UserMailer with a password_reset method?
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
										outputLines={MAILER_TERMINAL_OUTPUT}
										stepKey={stepper.currentStep}
										title="Generate the Mailer"
									/>
								)}

								{/* OptionCard steps (Steps 0, 2, 3) */}
								{!isTerminalStep && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{shuffleOptions(
													currentOptionConfig.options,
													stepper.currentStep,
												).map((opt) => (
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
													{shuffleOptions(
														currentOptionConfig.options,
														stepper.currentStep,
													).map((opt) => (
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
														hasNextStep ? stepper.nextStep : handleStartReward
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
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
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
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'reward'
							? STEP_DEFS.length - 1
							: stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level35ActionMailer;

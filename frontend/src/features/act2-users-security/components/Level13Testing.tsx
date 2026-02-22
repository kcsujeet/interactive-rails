/**
 * Level 13: Testing
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Watch broken commits pass through an empty test gate to production
 * Phase 2 (HOW - build): 6 steps (3 terminal + 3 OptionCard) setting up RSpec + FactoryBot
 *   Step 0: bundle add rspec-rails (terminal)
 *   Step 1: rails generate rspec:install (terminal)
 *   Step 2: bundle add factory_bot_rails (terminal)
 *   Step 3: Configure FactoryBot in RSpec (OptionCard)
 *   Step 4: Write the User Factory (OptionCard)
 *   Step 5: Write the Request Spec (OptionCard)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Testing" button
 * Phase 4 (ADVANTAGE - reward): Test gate catches broken commits
 *
 * Teaches: RSpec, FactoryBot, request specs
 */

import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Step definitions (6 steps: 3 terminal + 3 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-rspec', title: 'Add rspec-rails Gem' },
	{ id: 'run-rspec-install', title: 'Run RSpec Generator' },
	{ id: 'add-factory-bot', title: 'Add factory_bot_rails Gem' },
	{ id: 'configure-factory-bot', title: 'Configure FactoryBot in RSpec' },
	{ id: 'write-factory', title: 'Write the User Factory' },
	{ id: 'write-request-spec', title: 'Write the Request Spec' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add rspec-rails
	'terminal', // 1: rails generate rspec:install
	'terminal', // 2: bundle add factory_bot_rails
	'option', // 3: Configure FactoryBot
	'option', // 4: Write User Factory
	'option', // 5: Write Request Spec
];

// ──────────────────────────────────────────────
// Step 0: Add rspec-rails (Terminal)
// ──────────────────────────────────────────────

const addRspecCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem-install',
		label: 'gem install rspec',
		command: 'gem install rspec',
		correct: false,
		feedback:
			"That installs system-wide, not into your project's Gemfile. Use the bundler command that adds and installs in one step.",
	},
	{
		id: 'correct',
		label: 'bundle add rspec-rails',
		command: 'bundle add rspec-rails',
		correct: true,
	},
	{
		id: 'wrong-npm',
		label: 'npm install jest',
		command: 'npm install jest',
		correct: false,
		feedback:
			'Jest is a JavaScript testing framework. You need a Ruby testing framework for a Rails app.',
	},
];

const addRspecOutput: TerminalOutputLine[] = [
	{ text: 'Fetching rspec-rails 7.1.0', color: 'cyan' },
	{ text: 'Installing rspec-core 3.13.0', color: 'muted' },
	{ text: 'Installing rspec-expectations 3.13.0', color: 'muted' },
	{ text: 'Installing rspec-rails 7.1.0', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 1: Run RSpec Generator (Terminal)
// ──────────────────────────────────────────────

const runRspecInstallCommands: TerminalCommand[] = [
	{
		id: 'wrong-test-install',
		label: 'rails generate test:install',
		command: 'rails generate test:install',
		correct: false,
		feedback:
			'There is no test:install generator. RSpec has its own generator name that matches the gem.',
	},
	{
		id: 'correct',
		label: 'rails generate rspec:install',
		command: 'rails generate rspec:install',
		correct: true,
	},
	{
		id: 'wrong-rspec-init',
		label: 'rspec --init',
		command: 'rspec --init',
		correct: false,
		feedback:
			'That initializes plain RSpec without Rails integration. You need the Rails-specific generator for helpers and config.',
	},
];

const runRspecInstallOutput: TerminalOutputLine[] = [
	{ text: '      create  .rspec', color: 'green' },
	{ text: '      create  spec/spec_helper.rb', color: 'green' },
	{ text: '      create  spec/rails_helper.rb', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 2: Add factory_bot_rails (Terminal)
// ──────────────────────────────────────────────

const addFactoryBotCommands: TerminalCommand[] = [
	{
		id: 'wrong-factory-bot',
		label: 'bundle add factory_bot',
		command: 'bundle add factory_bot',
		correct: false,
		feedback:
			'That is the plain Ruby gem. The Rails variant auto-discovers factories and integrates with the test environment.',
	},
	{
		id: 'wrong-faker',
		label: 'bundle add faker',
		command: 'bundle add faker',
		correct: false,
		feedback:
			'Faker generates fake data (names, emails). You need a factory library for creating test records.',
	},
	{
		id: 'correct',
		label: 'bundle add factory_bot_rails',
		command: 'bundle add factory_bot_rails',
		correct: true,
	},
];

const addFactoryBotOutput: TerminalOutputLine[] = [
	{ text: 'Fetching factory_bot_rails 6.4.4', color: 'cyan' },
	{ text: 'Installing factory_bot 6.5.0', color: 'muted' },
	{ text: 'Installing factory_bot_rails 6.4.4', color: 'muted' },
	{ text: 'Bundle complete! 15 Gemfile dependencies.', color: 'green' },
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addRspecCommands, outputLines: addRspecOutput },
	{ commands: runRspecInstallCommands, outputLines: runRspecInstallOutput },
	{ commands: addFactoryBotCommands, outputLines: addFactoryBotOutput },
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ──────────────────────────────────────────────
// OptionCard step data type
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Step 3: Configure FactoryBot in RSpec (OptionCard)
// ──────────────────────────────────────────────

const CONFIGURE_FB_OPTIONS: StepOption[] = [
	{
		id: 'wrong-require',
		label: 'require "factory_bot"',
		correct: false,
		feedback:
			'Requiring the library loads it, but does not make DSL methods like create() and build() available in your specs.',
	},
	{
		id: 'correct',
		label: 'config.include FactoryBot::Syntax::Methods',
		correct: true,
	},
	{
		id: 'wrong-module',
		label: 'config.include FactoryBot::Methods',
		correct: false,
		feedback:
			"That module doesn't exist. The DSL methods live in a specific Syntax namespace.",
	},
];

// ──────────────────────────────────────────────
// Step 4: Write the User Factory (OptionCard)
// ──────────────────────────────────────────────

const WRITE_FACTORY_OPTIONS: StepOption[] = [
	{
		id: 'wrong-yaml',
		label: `# test/fixtures/users.yml
one:
  email: user@example.com
  password_digest: <%= BCrypt::Password.create("pass") %>`,
		correct: false,
		feedback:
			'YAML fixtures are static and brittle. Factories generate unique data on each call and compose traits flexibly.',
	},
	{
		id: 'correct',
		label: `FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { "password123" }
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-sql',
		label: `ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO users (email, password_digest)
  VALUES ('test@ex.com', 'abc123')
SQL`,
		correct: false,
		feedback:
			'Raw SQL bypasses model validations and callbacks. Test data should go through the same code path as production.',
	},
];

// ──────────────────────────────────────────────
// Step 5: Write the Request Spec (OptionCard)
// ──────────────────────────────────────────────

const WRITE_SPEC_OPTIONS: StepOption[] = [
	{
		id: 'wrong-controller-spec',
		label: `RSpec.describe SessionsController, type: :controller do
  it "sets the session" do
    post :create, params: { email: "a@b.com", password: "pass" }
    expect(assigns(:token)).to be_present
  end
end`,
		correct: false,
		feedback:
			'Controller specs test internals like assigns(). Request specs test the real HTTP cycle your clients experience.',
	},
	{
		id: 'correct',
		label: `RSpec.describe "Sessions API", type: :request do
  it "returns a token on valid login" do
    user = create(:user, password: "password123")
    post "/api/v1/sessions",
         params: { email: user.email, password: "password123" }
    expect(response).to have_http_status(:created)
    expect(json_response["token"]).to be_present
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-model-spec',
		label: `RSpec.describe User, type: :model do
  it "authenticates with correct password" do
    user = create(:user, password: "password123")
    expect(user.authenticate("password123")).to eq(user)
  end
end`,
		correct: false,
		feedback:
			'Model specs test the model in isolation. The login endpoint broke at the HTTP layer, not the model layer.',
	},
];

// Map from step index -> OptionCard data for option-type steps
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	3: {
		title: 'Configure FactoryBot in RSpec',
		description:
			'FactoryBot is installed but RSpec does not know about it yet. Which line in rails_helper.rb makes create(), build(), and other FactoryBot methods available in every spec?',
		options: CONFIGURE_FB_OPTIONS,
	},
	4: {
		title: 'Write the User Factory',
		description:
			'Your request spec needs a user to log in with. Which approach creates reusable, dynamic test data?',
		options: WRITE_FACTORY_OPTIONS,
	},
	5: {
		title: 'Write the Request Spec',
		description:
			'The login endpoint broke and nobody noticed. Which spec type would have caught it before deploy?',
		options: WRITE_SPEC_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Pipeline stage/connection configs (observe vs reward)
// ──────────────────────────────────────────────

const OBSERVE_STAGES: PipelineStage[] = [
	{ id: 'code', label: 'Code' },
	{ id: 'build', label: 'Build' },
	{
		id: 'test',
		label: 'Test Gate',
		sublabel: '(no tests)',
		variant: 'inactive',
	},
	{ id: 'prod', label: 'Production', badge: '500!' },
];

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'code', to: 'build', dots: 'mixed' },
	{ from: 'build', to: 'test', dots: 'mixed' },
	{ from: 'test', to: 'prod', dots: 'mixed' },
];

const REWARD_STAGES: PipelineStage[] = [
	{ id: 'code', label: 'Code' },
	{ id: 'build', label: 'Build' },
	{
		id: 'test',
		label: 'RSpec',
		sublabel: '2 specs, 0 failures',
		variant: 'active',
		badge: 'FAIL',
	},
	{ id: 'prod', label: 'Production' },
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'code', to: 'build', dots: 'mixed' },
	{ from: 'build', to: 'test', dots: 'mixed' },
	{ from: 'test', to: 'prod', dots: 'clean' },
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the broken controller + empty spec dir
	if (phase === 'observe') {
		files.push({
			filename: 'app/controllers/api/v1/sessions_controller.rb',
			language: 'ruby',
			code: `class Api::V1::SessionsController < ApplicationController
  def create
    user = User.find_by(email: params[:email])
    if user&.authenticate(params[:password])
      session = user.sessions.create!
      render json: { auth_token: session.token },
             status: :created
    else
      render json: { error: "Invalid credentials" },
             status: :unauthorized
    end
  end
end

# Bug: column was renamed from 'token' to 'auth_token'
# but line 6 still references session.token
# => NoMethodError: undefined method 'token'
# => 500 Internal Server Error`,
			highlight: [6],
		});
		files.push({
			filename: 'spec/',
			language: 'plaintext',
			code: '# (empty directory)\n# No test framework configured\n# No factories\n# No specs',
		});
		return files;
	}

	// Build / activate / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/sessions_controller.rb',
			language: 'ruby',
			code: `class Api::V1::SessionsController < ApplicationController
  def create
    user = User.find_by(email: params[:email])
    if user&.authenticate(params[:password])
      session = user.sessions.create!
      render json: { auth_token: session.token },
             status: :created
    else
      render json: { error: "Invalid credentials" },
             status: :unauthorized
    end
  end
end`,
			highlight: [6],
		});
	}

	if (furthestStep >= 1) {
		// After step 0: Gemfile shows rspec-rails
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "bcrypt", "~> 3.1.7"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
end`
					: `source "https://rubygems.org"

gem "rails", "~> 8.0.0"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "bcrypt", "~> 3.1.7"

group :development, :test do
  gem "rspec-rails"
end`,
			highlight: furthestStep >= 3 ? [9, 10] : [9],
		});
	}

	if (furthestStep >= 2) {
		// After step 1: .rspec + rails_helper.rb
		files.push({
			filename: '.rspec',
			language: 'plaintext',
			code: '--require spec_helper\n--format documentation\n--color',
		});
		files.push({
			filename: 'spec/rails_helper.rb',
			language: 'ruby',
			code:
				furthestStep >= 4
					? `require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rspec/rails"

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.include FactoryBot::Syntax::Methods
end`
					: `require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rspec/rails"

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
end`,
			highlight: furthestStep >= 4 ? [9] : [],
		});
	}

	if (furthestStep >= 5) {
		// After step 4: User factory
		files.push({
			filename: 'spec/factories/users.rb',
			language: 'ruby',
			code: `FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { "password123" }
  end
end`,
			highlight: [2, 3, 4],
		});
	}

	if (furthestStep >= 6) {
		// After step 5: Request spec
		files.push({
			filename: 'spec/requests/api/v1/sessions_spec.rb',
			language: 'ruby',
			code: `require "rails_helper"

RSpec.describe "Sessions API", type: :request do
  it "returns a token on valid login" do
    user = create(:user, password: "password123")
    post "/api/v1/sessions",
         params: { email: user.email,
                   password: "password123" }
    expect(response).to have_http_status(:created)
    expect(json_response["token"]).to be_present
  end

  it "returns 401 with wrong password" do
    user = create(:user, password: "password123")
    post "/api/v1/sessions",
         params: { email: user.email,
                   password: "wrong" }
    expect(response).to have_http_status(:unauthorized)
  end
end`,
			highlight: [4, 5, 9, 10, 14, 18],
		});
	}

	if (furthestStep >= 7) {
		// All complete: show passing test output
		files.push({
			filename: 'Test Output',
			language: 'plaintext',
			code: `$ bundle exec rspec spec/requests/api/v1/sessions_spec.rb

Sessions API
  returns a token on valid login     PASSED
  returns 401 with wrong password    PASSED

2 examples, 0 failures

Finished in 0.24 seconds`,
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
					<span className="text-foreground">Clean commit (passes)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Broken commit (has bug)</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level13Testing({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('observe');
	const [caughtCount, setCaughtCount] = useState(0);
	const [deployedCount, setDeployedCount] = useState(0);

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Reward phase: simple counter interval (matches dot loop timing) ──
	useEffect(() => {
		if (phase !== 'reward') return;
		const interval = setInterval(() => {
			setCaughtCount((c) => c + 1);
			setDeployedCount((c) => c + 3);
		}, 3500);
		return () => clearInterval(interval);
	}, [phase]);

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

	const handleActivateTesting = () => {
		setPhase('reward');
		setCaughtCount(0);
		setDeployedCount(0);
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
		return { valid: true, message: 'Test suite is in place!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							A deploy broke the login endpoint. Nobody noticed for 3 hours
							because there are zero tests. The only safety net was manual
							testing.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The community standard is{' '}
							<span className="text-foreground font-medium">RSpec</span> for
							test structure and{' '}
							<span className="text-foreground font-medium">FactoryBot</span>{' '}
							for test data. Request specs test the full HTTP request/response
							cycle.
						</p>
					</div>

					{/* Observe phase: legend only */}
					{phase === 'observe' && <PipelineLegend />}

					{/* Build / activate / reward phases: step progress */}
					{phase !== 'observe' && (
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
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{caughtCount}
										</div>
										<div className="text-xs text-destructive/70">Caught</div>
									</div>
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{deployedCount}
										</div>
										<div className="text-xs text-success/70">Deployed</div>
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
					levelName="Testing"
					levelNumber={13}
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
									stages={OBSERVE_STAGES}
								/>
							</div>
							<div className="p-6 flex justify-center">
								<Button
									className="gap-2"
									onClick={handleStartBuild}
									size="lg"
								>
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Terminal steps (0, 1, 2) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={addRspecCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													RSpec is the Ruby community standard for testing. Add
													it to your project dependencies.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={addRspecOutput}
											stepKey={stepper.currentStep}
											title="Add rspec-rails Gem"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={runRspecInstallCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													RSpec needs a spec directory, helpers, and config
													files. Run the install generator to scaffold them.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={runRspecInstallOutput}
											stepKey={stepper.currentStep}
											title="Run RSpec Generator"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 2 && (
										<TerminalChoiceStep
											commands={addFactoryBotCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													FactoryBot creates test data with sensible defaults.
													Add the Rails-integrated version to your project.
												</p>
											}
											hasNext={hasNextStep}
											initialHistory={buildTerminalHistory(
												SHELL_STEP_MAP,
												stepper.currentStep,
											)}
											onCorrect={() => stepper.completeStep()}
											onNext={stepper.nextStep}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={addFactoryBotOutput}
											stepKey={stepper.currentStep}
											title="Add factory_bot_rails Gem"
										/>
									)}

								{/* OptionCard steps (3, 4, 5) */}
								{currentStepType === 'option' && currentOptionConfig && (
									<>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{currentOptionConfig.description}
										</p>

										{isViewingCompletedStep ? (
											<div className="space-y-2">
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														color="emerald"
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
													{currentOptionConfig.options.map((opt) => (
														<OptionCard
															color="emerald"
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
									Your test suite is ready. See broken commits get caught at the
									test gate before they reach production.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateTesting}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Testing
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={REWARD_STAGES}
								/>
							</div>
							<div className="p-4 text-center">
								<p className="text-sm text-muted-foreground">
									Test gate active. Broken commits are caught before they reach
									production. Click Submit to complete the level.
								</p>
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

export default Level13Testing;

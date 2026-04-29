/**
 * Level 13: Testing
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration of a deploy pipeline with
 *   an empty test gate. Click stages to inspect them, fire "deploy" probes
 *   to see broken commits pass straight to production. Discovery gating
 *   controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 6 steps (3 terminal + 3 OptionCard) setting up RSpec + FactoryBot
 *   Step 0: bundle add rspec-rails (terminal)
 *   Step 1: rails generate rspec:install (terminal)
 *   Step 2: bundle add factory_bot_rails (terminal)
 *   Step 3: Configure FactoryBot in RSpec (OptionCard)
 *   Step 4: Write the User Factory (OptionCard)
 *   Step 5: Write the Request Spec (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire commits at the test gate
 *   and watch clean ones deploy while broken ones get caught.
 *
 * Teaches: RSpec, FactoryBot, request specs
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
	type TerminalCommand,
	type TerminalOutputLine,
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

registerLevelCode('act2-level13-testing', () =>
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
	{ id: 'no-framework', label: 'No test framework installed' },
	{ id: 'empty-specs', label: 'Zero test files exist' },
	{ id: 'broken-deploy', label: 'Broken code reaches production' },
	{ id: 'no-test-data', label: 'No factories for test records' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'broken-login',
		label: 'Deploy token rename',
		command: 'git push origin main (renamed token -> auth_token)',
		responseLines: [
			{ text: 'Deploying commit a3f91c2...', color: 'cyan' },
			{ text: 'Build: OK', color: 'green' },
			{ text: 'Test gate: (empty, no specs to run)', color: 'yellow' },
			{ text: 'Deploy: SUCCESS', color: 'green' },
			{ text: '', color: 'muted' },
			{
				text: 'POST /api/v1/sessions => 500 Internal Server Error',
				color: 'red',
			},
			{
				text: "NoMethodError: undefined method 'token' for Session",
				color: 'red',
			},
			{
				text: 'Users unable to log in. No alert for 3 hours.',
				color: 'yellow',
			},
		],
		story: [
			'A developer renames the Session model\'s "token" column to "auth_token".',
			'The commit passes the build step (no syntax errors).',
			'The test gate is empty: zero specs exist to catch the broken method call.',
			'The deploy goes live. Every login attempt crashes with a NoMethodError for 3 hours.',
		],
	},
	{
		id: 'untested-endpoint',
		label: 'Deploy broken create',
		command: 'git push origin main (new products#create with typo)',
		responseLines: [
			{ text: 'Deploying commit 7b2e4d1...', color: 'cyan' },
			{ text: 'Build: OK', color: 'green' },
			{ text: 'Test gate: (empty, no specs to run)', color: 'yellow' },
			{ text: 'Deploy: SUCCESS', color: 'green' },
			{ text: '', color: 'muted' },
			{
				text: 'POST /api/v1/products => 500 Internal Server Error',
				color: 'red',
			},
			{
				text: "NameError: undefined local variable 'paramss'",
				color: 'red',
			},
			{
				text: 'No factory to generate test data. No spec to catch the typo.',
				color: 'yellow',
			},
		],
		story: [
			'A developer adds a new products#create action with a typo ("paramss").',
			'The build passes because Ruby does not check variable names at compile time.',
			'No request spec or factory exists to exercise the create endpoint.',
			'The typo hits production. Every product creation attempt returns a 500 error.',
		],
	},
	{
		id: 'bad-migration',
		label: 'Deploy dropped column',
		command: 'git push origin main (removed email column by accident)',
		responseLines: [
			{ text: 'Deploying commit e5c8a09...', color: 'cyan' },
			{ text: 'Build: OK', color: 'green' },
			{ text: 'Test gate: (empty, no specs to run)', color: 'yellow' },
			{ text: 'Deploy: SUCCESS', color: 'green' },
			{ text: '', color: 'muted' },
			{
				text: 'GET /api/v1/users => 500 Internal Server Error',
				color: 'red',
			},
			{
				text: "ActiveRecord::StatementInvalid: column 'email' does not exist",
				color: 'red',
			},
			{
				text: 'Every page that touches User is broken.',
				color: 'yellow',
			},
		],
		story: [
			'A developer accidentally includes a migration that drops the email column.',
			'The build succeeds because migrations run at deploy time, not build time.',
			'No model or request specs reference the email column, so the test gate is empty.',
			'After deploy, every endpoint that reads User.email crashes with a missing column error.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'broken-login': 'broken-deploy',
	'untested-endpoint': 'no-test-data',
	'bad-migration': 'empty-specs',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ testSublabel: string; prodBadge: string }
> = {
	'broken-login': { testSublabel: '(no tests)', prodBadge: '500!' },
	'untested-endpoint': { testSublabel: '(no tests)', prodBadge: '500!' },
	'bad-migration': { testSublabel: '(no tests)', prodBadge: '500!' },
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	code: {
		stageId: 'code',
		title: 'Code Push',
		description:
			'Developers push commits to the main branch. Each commit might introduce new features, bug fixes, or accidental regressions. Without automated checks, every push is a gamble.',
	},
	build: {
		stageId: 'build',
		title: 'Build Step',
		description:
			'Bundler installs dependencies and compiles assets. The build step only checks that the code can be loaded, not that it works correctly. Syntax errors are caught here, but logic bugs pass through.',
	},
	test: {
		stageId: 'test',
		title: 'Test Gate (Empty!)',
		description:
			'This gate does not exist yet. There is no test framework, no spec files, no factories. Every commit passes through to production without any automated verification.',
		code: `# spec/ directory:
# (empty)
# No .rspec file
# No spec_helper.rb
# No rails_helper.rb
# No factories/
# No request specs`,
	},
	prod: {
		stageId: 'prod',
		title: 'Production (Unprotected)',
		description:
			'Users hit the live app directly. When a broken commit deploys, real users see 500 errors, broken forms, and missing data. The only "test" is user complaints.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	test: 'no-framework',
	prod: 'empty-specs',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'broken-login',
		label: 'Deploy token rename',
		description: 'Renamed token column but forgot to update controller',
		method: 'PUSH',
		path: 'sessions_controller.rb',
		actor: 'dev_bob',
		expectedResult: 'blocked',
	},
	{
		id: 'untested-endpoint',
		label: 'Deploy broken create',
		description: 'New products#create with typo, request spec catches it',
		method: 'PUSH',
		path: 'products_controller.rb',
		actor: 'dev_charlie',
		expectedResult: 'blocked',
	},
	{
		id: 'bad-migration',
		label: 'Deploy dropped column',
		description: 'Removed email column by accident, model spec catches it',
		method: 'PUSH',
		path: 'user.rb',
		actor: 'dev_alice',
		expectedResult: 'blocked',
	},
	{
		id: 'clean-refactor',
		label: 'Clean model refactor',
		description: 'Refactored session creation, all specs still pass',
		method: 'PUSH',
		path: 'sessions_controller.rb',
		actor: 'dev_alice',
		expectedResult: 'allowed',
	},
	{
		id: 'clean-validation',
		label: 'Clean validation add',
		description: 'Added email format validation, specs pass',
		method: 'PUSH',
		path: 'user.rb',
		actor: 'dev_alice',
		expectedResult: 'allowed',
	},
	{
		id: 'clean-endpoint',
		label: 'Clean new endpoint',
		description: 'Added show action with passing specs',
		method: 'PUSH',
		path: 'products_controller.rb',
		actor: 'dev_bob',
		expectedResult: 'allowed',
	},
];

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
    expect(response.parsed_body["token"]).to be_present
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
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'code', to: 'build', dots: 'mixed' },
	{ from: 'build', to: 'test', dots: 'mixed' },
	{ from: 'test', to: 'prod', dots: 'mixed' },
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
    user = User.authenticate_by(
      email: params[:email],
      password: params[:password]
    )
    if user
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
# but line 9 still references session.token
# => NoMethodError: undefined method 'token'
# => 500 Internal Server Error`,
			highlight: [9],
		});
		files.push({
			filename: 'spec/',
			language: 'plaintext',
			code: '# (empty directory)\n# No test framework configured\n# No factories\n# No specs',
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/api/v1/sessions_controller.rb',
			language: 'ruby',
			code: `class Api::V1::SessionsController < ApplicationController
  def create
    user = User.authenticate_by(
      email: params[:email],
      password: params[:password]
    )
    if user
      session = user.sessions.create!
      render json: { auth_token: session.token },
             status: :created
    else
      render json: { error: "Invalid credentials" },
             status: :unauthorized
    end
  end
end`,
			highlight: [9],
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
    expect(response.parsed_body["token"]).to be_present
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
					<span className="text-foreground">Clean commit (tests pass)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Broken commit (tests catch)</span>
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
				id: 'code',
				label: 'Code',
				inspectable: true,
				inspected: inspectedStages.has('code'),
			},
			{
				id: 'build',
				label: 'Build',
				inspectable: true,
				inspected: inspectedStages.has('build'),
			},
			{
				id: 'test',
				label: 'Test Gate',
				sublabel: probeDisplay ? probeDisplay.testSublabel : '(no tests)',
				variant: 'inactive' as const,
				inspectable: true,
				inspected: inspectedStages.has('test'),
			},
			{
				id: 'prod',
				label: 'Production',
				badge: probeDisplay ? probeDisplay.prodBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('prod'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'code', label: 'Code' },
			{ id: 'build', label: 'Build' },
			{
				id: 'test',
				label: 'RSpec',
				sublabel: wasBlocked ? 'FAILURE' : '2 specs, 0 failures',
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				badge: wasBlocked ? '1 FAILED' : undefined,
			},
			{
				id: 'prod',
				label: 'Production',
				sublabel: wasBlocked ? '(blocked)' : 'deployed',
				variant: wasBlocked ? ('default' as const) : ('active' as const),
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
		return { valid: true, message: 'Test suite is in place!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
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
										<div className="text-xs text-success/70">Deployed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Caught</div>
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
									title="Deploy Probe"
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
												{shuffledOptions.map((opt) => (
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
													{shuffledOptions.map((opt) => (
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

										{isViewingCompletedStep && !hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={handleStartReward}
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

export default Level13Testing;

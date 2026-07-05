/**
 * Level 14: Testing
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Customer-Impact Dashboard. Three customer-facing
 *   surfaces stacked vertically (Homepage product list, Account page snippet,
 *   Login form preview). Probes simulate real refactor mistakes from earlier
 *   levels: dropping a security check (L13 regression), forgetting to put
 *   authorize back (L11 regression), renaming an email column (L10 regression).
 *   Each probe paints the customer-visible damage onto the dashboard and adds
 *   a red incident-log entry with concrete cost (refunds, tickets, lost
 *   orders). The bottom rspec terminal stays quiet -- no specs run, nothing
 *   flagged the regression.
 * Phase 2 (HOW - build): 7 steps (3 terminal + 4 OptionCard) setting up the
 *   testing framework and writing a real spec.
 *   Step 0: bundle add rspec-rails --group "development, test" (terminal)
 *   Step 1: bin/rails generate rspec:install (terminal)
 *   Step 2: bundle add factory_bot_rails --group "development, test" (terminal)
 *   Step 3: Create spec/support/factory_bot.rb (OptionCard)
 *   Step 4: Uncomment the support-file autoload in rails_helper.rb (OptionCard)
 *   Step 5: Write the User factory (OptionCard)
 *   Step 6: Write the Products request spec (OptionCard)
 * Phase 3 (ADVANTAGE - reward): Same dashboard, same regressions. But now a
 *   spec exists. The dashboard stays clean on every regression scenario; a
 *   green toast surfaces ("Caught locally...") and the rspec terminal animates
 *   the actual ....F. output naming the failed `it "..."`. The clean refactor
 *   passes all 6 examples. The contrast is the lesson.
 */

import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act2-level14-testing', () =>
	getCodeFiles('reward', STEP_DEFS.length - 1),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Customer dashboard damage shape
// ──────────────────────────────────────────────
//
// The visualization is three customer-facing surfaces (homepage / account /
// login). Each probe paints damage onto the matching surface and adds an
// incident-log entry. In reward, the dashboard stays clean for every
// regression scenario: the spec catches the change before it reaches a
// customer.

interface HomepageDamage {
	spam: true;
}

interface AccountDamage {
	deletedByStranger: true;
}

interface LoginDamage {
	serverError: true;
}

interface DashboardDamage {
	homepage?: HomepageDamage;
	account?: AccountDamage;
	login?: LoginDamage;
	incidentLog: string[];
}

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────
//
// IDs match probe IDs 1:1 so the gating helper enforces "fire every probe
// to surface every distinct piece of customer damage."

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'spam-product-on-homepage',
		label: 'Spam product appears FEATURED on the homepage',
	},
	{
		id: 'product-deleted-by-stranger',
		label: "Customer's own product is deleted by a stranger",
	},
	{
		id: 'login-down-overnight',
		label: 'Login form 500s for every customer overnight',
	},
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────
//
// Each probe simulates a real refactor mistake a teammate could make. The
// label is plain-English consequence, not Rails-internal jargon. The
// `damage` payload paints the customer-facing dashboard. The `responseLines`
// are intentionally quiet: no specs run, the rspec terminal stays empty.

interface DamagedProbe extends ProbeConfig {
	damage: DashboardDamage;
}

const PROBES: DamagedProbe[] = [
	{
		id: 'spam-product-on-homepage',
		label: 'A junior dev refactors the controller and drops a security check',
		command: 'bundle exec rspec',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: '# no specs run. nothing flagged this.', color: 'muted' },
		],
		damage: {
			homepage: { spam: true },
			incidentLog: [
				'47 customers saw the spam ad before Marketing flagged it.',
				'12 refund requests filed.',
				'3-hour exposure window.',
			],
		},
		story: [
			'A junior dev refactors the products controller and accidentally drops the L13 line that filters which fields users can set.',
			'A regular user posts featured: true in the body. With the L13 filter gone, the attribute now reaches the model and lands in the database.',
			'The homepage updates: a spam product titled "Buy Crypto!!!" pinned FEATURED above legit listings.',
			'Marketing notices three hours later. By then 47 customers have seen it and 12 refund requests are open.',
		],
	},
	{
		id: 'product-deleted-by-stranger',
		label: 'A teammate refactors authorize and forgets to put it back',
		command: 'bundle exec rspec',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: '# no specs run. nothing flagged this.', color: 'muted' },
		],
		damage: {
			account: { deletedByStranger: true },
			incidentLog: [
				'Alice opened a support ticket: "Where did my product go?"',
				'Trust score down.',
				'Restored manually from a backup.',
			],
		},
		story: [
			'A teammate refactors destroy in the products controller. The ownership check looks unused at a glance and gets removed.',
			"A non-owner sends DELETE /api/products/:id against Alice's mug. Without the ownership check, the destroy goes through.",
			'Alice opens her account page. The mug is gone, replaced by a strikethrough card labelled "DELETED by user_99".',
			'Alice files a support ticket. The team restores the product from a backup. Trust score drops.',
		],
	},
	{
		id: 'login-down-overnight',
		label: 'A migration renames the email column',
		command: 'bundle exec rspec',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: '# no specs run. nothing flagged this.', color: 'muted' },
		],
		damage: {
			login: { serverError: true },
			incidentLog: [
				'All login attempts failed for 6 hours overnight.',
				'$42K in lost orders.',
				'PagerDuty fired at 2am.',
			],
		},
		story: [
			'A teammate generates a migration that renames users.email_address to users.email and runs it.',
			'The encrypted lookup, the auth concern, and the factory all reference email_address. Login crashes globally.',
			'Every customer hitting the sign-in form sees a 500 error. The Sign-in button is disabled.',
			'PagerDuty fires at 2am. By the time someone reverts six hours later, the site has lost $42K in orders.',
		],
	},
];

// Probe -> discovery is 1:1. Each probe surfaces one distinct piece of
// customer damage, each piece is surfaced by exactly one probe.
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'spam-product-on-homepage': 'spam-product-on-homepage',
	'product-deleted-by-stranger': 'product-deleted-by-stranger',
	'login-down-overnight': 'login-down-overnight',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────
//
// Same three regressions (1:1 with probes) plus a clean-refactor scenario.
// All four set expectedResult: 'allowed', from the customer's perspective,
// "allowed = customer sees nothing wrong." The spec catches the regressions
// locally; the dashboard stays clean.

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'spam-product-on-homepage',
		label: 'A junior dev refactors the controller and drops a security check',
		description:
			"Same regression as the observe probe. The request spec asserts that a posted product with featured: true ends up with featured = false. The suite goes red on the developer's machine; the change never reaches the homepage.",
		method: 'rspec',
		path: 'spec/requests/products_spec.rb',
		actor: 'before merge',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: 'Run options: include {:focus=>true}', color: 'muted' },
			{ text: '....F.', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Failures:', color: 'red' },
			{
				text: '  1) Api::Products POST /api/products drops featured: true (admin-only field)',
				color: 'red',
			},
			{
				text: '     Failure/Error: expect(Product.last.featured).to be false',
				color: 'red',
			},
			{ text: '       expected false, got true', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Finished in 0.3 seconds (files took 1.2 seconds to load)',
				color: 'muted',
			},
			{ text: '6 examples, 1 failure', color: 'red' },
		],
		story: [
			'Same junior dev, same edit: they remove the line that filters which fields a regular user can set.',
			'But you wrote a spec at L14 that posts featured: true and expects Product.last.featured to be false.',
			"rspec runs in 0.3 seconds on the dev's machine and reports 6 examples, 1 failure.",
			'The change never reaches the homepage. Customers see the normal three products.',
		],
	},
	{
		id: 'product-deleted-by-stranger',
		label: 'A teammate refactors authorize and forgets to put it back',
		description:
			'Same regression as the observe probe. The request spec asserts that a non-owner DELETE returns 404 or 403. With the authorize call missing, the suite goes red before merge.',
		method: 'rspec',
		path: 'spec/requests/products_spec.rb',
		actor: 'before merge',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: 'Run options: include {:focus=>true}', color: 'muted' },
			{ text: '.....F', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Failures:', color: 'red' },
			{
				text: '  1) Api::Products PATCH /api/products/:id blocks a non-owner with 404 (Pundit + scoped policy)',
				color: 'red',
			},
			{
				text: '     Failure/Error: expect(response).to have_http_status(:not_found).or have_http_status(:forbidden)',
				color: 'red',
			},
			{
				text: '       expected the response to have status :not_found or :forbidden, got 200',
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Finished in 0.3 seconds (files took 1.2 seconds to load)',
				color: 'muted',
			},
			{ text: '6 examples, 1 failure', color: 'red' },
		],
		story: [
			'Same teammate, same edit: they remove the ownership check from destroy.',
			'But you wrote a spec at L14 that deletes a product as a non-owner and expects 404 or 403.',
			'rspec runs in 0.3 seconds and reports 6 examples, 1 failure.',
			'Alice never opens a support ticket. Her product stays in her account.',
		],
	},
	{
		id: 'login-down-overnight',
		label: 'A migration renames the email column',
		description:
			'Same migration as the observe probe. The factory still sets email_address; every spec that calls create(:user) errors out. The suite is red before any customer hits the sign-in form.',
		method: 'rspec',
		path: 'spec/requests/products_spec.rb',
		actor: 'before merge',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: 'Run options: include {:focus=>true}', color: 'muted' },
			{ text: 'EEEEEE', color: 'red' },
			{ text: '', color: 'muted' },
			{ text: 'Failures:', color: 'red' },
			{
				text: '  1) Api::Products GET /api/products returns the products visible to the current user',
				color: 'red',
			},
			{
				text: '     Failure/Error: sequence(:email_address) { |n| "user#{n}@example.com" }',
				color: 'red',
			},
			{
				text: "       NoMethodError: undefined method `email_address=' for #<User>",
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: 'Finished in 0.4 seconds (files took 1.2 seconds to load)',
				color: 'muted',
			},
			{ text: '6 examples, 6 failures', color: 'red' },
		],
		story: [
			'Same teammate, same migration: they rename users.email_address to users.email.',
			'But you wrote a spec at L14 that creates users via the factory.',
			'Every example errors out with NoMethodError before it can even hit a request.',
			'rspec runs in 0.4 seconds and reports 6 examples, 6 failures. Login stays up.',
		],
	},
	{
		id: 'helper-rename-clean-refactor',
		label: 'Refactor: rename a private helper method',
		description:
			'A real refactor with no behavior change. All six examples pass. The same spec that catches regressions confirms safe edits stay safe.',
		method: 'rspec',
		path: 'spec/requests/products_spec.rb',
		actor: 'before merge',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '$ bundle exec rspec', color: 'cyan' },
			{ text: 'Run options: include {:focus=>true}', color: 'muted' },
			{ text: '......', color: 'green' },
			{ text: '', color: 'muted' },
			{
				text: 'Finished in 0.3 seconds (files took 1.2 seconds to load)',
				color: 'muted',
			},
			{ text: '6 examples, 0 failures', color: 'green' },
		],
		story: [
			'A teammate renames a private helper method in products_controller.rb. No public behavior changes.',
			'They run the spec you wrote at L14.',
			'All six examples pass. rspec reports "6 examples, 0 failures".',
			'The same spec that catches regressions also confirms safe edits stay safe. The rename ships with confidence.',
		],
	},
];

// ──────────────────────────────────────────────
// Step definitions (7 steps: 3 terminal + 4 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-rspec', title: 'Add the test framework gem' },
	{ id: 'run-rspec-install', title: 'Run the install generator' },
	{ id: 'add-factory-bot', title: 'Add the factories gem' },
	{ id: 'create-support-file', title: 'Create the support file' },
	{ id: 'uncomment-glob', title: 'Autoload spec/support/' },
	{ id: 'write-factory', title: 'Write the User factory' },
	{ id: 'write-request-spec', title: 'Write the products request spec' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal',
	'terminal',
	'terminal',
	'option',
	'option',
	'option',
	'option',
];

// ──────────────────────────────────────────────
// Step 0: Add rspec-rails (Terminal)
// ──────────────────────────────────────────────

const addRspecCommands: TerminalCommand[] = [
	{
		id: 'wrong-default-group',
		label: 'bundle add rspec-rails',
		command: 'bundle add rspec-rails',
		correct: false,
		feedback:
			'bundle add without a group puts the gem in the default group. That ships it to production, where you never run specs, wasted memory and a larger Gemfile.lock for nothing. Pick the option that scopes the gem to the groups where it is actually used.',
	},
	{
		id: 'wrong-test-only',
		label: 'bundle add rspec-rails --group "test"',
		command: 'bundle add rspec-rails --group "test"',
		correct: false,
		feedback:
			'Test-only is too narrow. The generator that creates spec files runs in the development environment, so the gem has to be loadable there too. Look for the option that includes both groups.',
	},
	{
		id: 'correct',
		label: 'bundle add rspec-rails --group "development, test"',
		command: 'bundle add rspec-rails --group "development, test"',
		correct: true,
	},
];

const addRspecOutput: TerminalOutputLine[] = [
	{ text: 'Fetching gem metadata from https://rubygems.org/.', color: 'muted' },
	{ text: 'Resolving dependencies...', color: 'muted' },
	{ text: 'Fetching rspec-support 3.13.5', color: 'cyan' },
	{ text: 'Fetching rspec-core 3.13.6', color: 'cyan' },
	{ text: 'Fetching rspec-expectations 3.13.5', color: 'cyan' },
	{ text: 'Fetching rspec-mocks 3.13.7', color: 'cyan' },
	{ text: 'Fetching rspec-rails 8.0.4', color: 'cyan' },
	{ text: 'Installing rspec-rails 8.0.4', color: 'muted' },
	{ text: 'Bundle complete!', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 1: Run RSpec Generator (Terminal)
// ──────────────────────────────────────────────

const runRspecInstallCommands: TerminalCommand[] = [
	{
		id: 'wrong-test-install',
		label: 'bin/rails generate test:install',
		command: 'bin/rails generate test:install',
		correct: false,
		feedback:
			'There is no test:install generator. Each test framework registers a generator named after itself. Pick the option whose generator name matches the gem you just installed.',
	},
	{
		id: 'wrong-rspec-init',
		label: 'rspec --init',
		command: 'rspec --init',
		correct: false,
		feedback:
			'That bootstraps plain RSpec without the Rails integration: no rails_helper.rb, no Active Record hooks, no fixture path config. You need the Rails-aware generator.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate rspec:install',
		command: 'bin/rails generate rspec:install',
		correct: true,
	},
];

const runRspecInstallOutput: TerminalOutputLine[] = [
	{ text: '      create  .rspec', color: 'green' },
	{ text: '      create  spec', color: 'green' },
	{ text: '      create  spec/spec_helper.rb', color: 'green' },
	{ text: '      create  spec/rails_helper.rb', color: 'green' },
];

// ──────────────────────────────────────────────
// Step 2: Add factory_bot_rails (Terminal)
// ──────────────────────────────────────────────

const addFactoryBotCommands: TerminalCommand[] = [
	{
		id: 'wrong-default-group',
		label: 'bundle add factory_bot_rails',
		command: 'bundle add factory_bot_rails',
		correct: false,
		feedback:
			'No --group means the gem lands in the default production group. Factories are only used in specs; shipping them to production is wasted memory.',
	},
	{
		id: 'wrong-plain-factory',
		label: 'bundle add factory_bot --group "development, test"',
		command: 'bundle add factory_bot --group "development, test"',
		correct: false,
		feedback:
			'That is the plain Ruby variant. The Rails variant auto-discovers spec/factories/*.rb and integrates with the Rails test runner, you would have to wire all of that up by hand otherwise.',
	},
	{
		id: 'correct',
		label: 'bundle add factory_bot_rails --group "development, test"',
		command: 'bundle add factory_bot_rails --group "development, test"',
		correct: true,
	},
];

const addFactoryBotOutput: TerminalOutputLine[] = [
	{ text: 'Fetching gem metadata from https://rubygems.org/.', color: 'muted' },
	{ text: 'Resolving dependencies...', color: 'muted' },
	{ text: 'Fetching factory_bot 6.6.0', color: 'cyan' },
	{ text: 'Fetching factory_bot_rails 6.5.1', color: 'cyan' },
	{ text: 'Installing factory_bot 6.6.0', color: 'muted' },
	{ text: 'Installing factory_bot_rails 6.5.1', color: 'muted' },
	{ text: 'Bundle complete!', color: 'green' },
];

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addRspecCommands, outputLines: addRspecOutput },
	{ commands: runRspecInstallCommands, outputLines: runRspecInstallOutput },
	{ commands: addFactoryBotCommands, outputLines: addFactoryBotOutput },
	null,
	null,
	null,
	null,
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
// Step 3: Create the support file (OptionCard)
// ──────────────────────────────────────────────

const SUPPORT_FILE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-require',
		label: `# spec/support/factory_bot.rb
require "factory_bot"`,
		correct: false,
		feedback:
			'Requiring the gem only loads the library. It does not make the DSL methods available inside RSpec examples.',
	},
	{
		id: 'wrong-wrong-module',
		label: `# spec/support/factory_bot.rb
RSpec.configure do |config|
  config.include FactoryBot::Methods
end`,
		correct: false,
		feedback:
			'FactoryBot::Methods is not a real module. The DSL methods (create, build, build_stubbed) live inside a Syntax namespace.',
	},
	{
		id: 'correct',
		label: `# spec/support/factory_bot.rb
RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end`,
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 4: Uncomment the support-file autoload (OptionCard)
// ──────────────────────────────────────────────

const UNCOMMENT_GLOB_OPTIONS: StepOption[] = [
	{
		id: 'wrong-direct-include',
		label: `# spec/rails_helper.rb
RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end`,
		correct: false,
		feedback:
			'Putting the include directly in rails_helper.rb works, but it skips the support-file convention every Rails team uses. The next concern (request helpers, time helpers, WebMock) would also have to live in rails_helper.rb until the file is impossible to read.',
	},
	{
		id: 'wrong-spec-helper',
		label: `# spec/spec_helper.rb
require_relative "../spec/support/factory_bot"`,
		correct: false,
		feedback:
			'spec_helper.rb is the framework-only helper that loads before Rails is booted. Loading FactoryBot from there fails, the gem requires Rails to be loaded first.',
	},
	{
		id: 'correct',
		label: `# spec/rails_helper.rb (uncomment the line)
Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }`,
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 5: Write the User factory (OptionCard)
// ──────────────────────────────────────────────

const WRITE_FACTORY_OPTIONS: StepOption[] = [
	{
		id: 'wrong-fixed-email',
		label: `FactoryBot.define do
  factory :user do
    email_address { "user@example.com" }
    password { "password123" }
  end
end`,
		correct: false,
		feedback:
			'The User model validates email_address for uniqueness. Two specs that each create(:user) collide on the second insert and one of them blows up with a validation error. Test data has to be unique per call.',
	},
	{
		id: 'wrong-password-digest',
		label: `FactoryBot.define do
  factory :user do
    email_address { "user@example.com" }
    password_digest { "abc123" }
  end
end`,
		correct: false,
		feedback:
			'password_digest writes the column directly and skips has_secure_password. The hash is not a real BCrypt digest, so authenticate_by always returns nil. Login specs would fail even with a "correct" password.',
	},
	{
		id: 'correct',
		label: `FactoryBot.define do
  factory :user do
    sequence(:email_address) { |n| "user#{n}@example.com" }
    password { "password123" }
  end
end`,
		correct: true,
	},
];

// ──────────────────────────────────────────────
// Step 6: Write the products request spec (OptionCard)
// ──────────────────────────────────────────────

const WRITE_SPEC_OPTIONS: StepOption[] = [
	{
		id: 'wrong-controller-spec',
		label: `RSpec.describe Api::ProductsController, type: :controller do
  it "creates a product" do
    post :create, params: { product: { name: "X", price: 1 } }
    expect(assigns(:product)).to be_persisted
  end
end`,
		correct: false,
		feedback:
			'Controller specs poke at internals like assigns() and skip the full request stack: no real authentication, no Pundit, no params filter. They cannot catch any of the regressions you just observed.',
	},
	{
		id: 'wrong-model-only',
		label: `RSpec.describe Product, type: :model do
  it "validates name presence" do
    expect(build(:product, name: nil)).not_to be_valid
  end
end`,
		correct: false,
		feedback:
			'Model specs only test the model in isolation. The regressions you saw all happen at the HTTP layer: dropped params filter, missing authorize call, broken column reference. A model spec would have caught none of them.',
	},
	{
		id: 'correct',
		label: `RSpec.describe "Api::Products", type: :request do
  let(:user)       { create(:user) }
  let(:other_user) { create(:user) }
  let(:headers) do
    session = user.sessions.create!(ip_address: "127.0.0.1", user_agent: "rspec")
    { "Authorization" => "Bearer #{session.token}" }
  end

  it "drops featured: true on create" do
    params = { product: { name: "X", description: "d", price: 1, featured: true } }
    post "/api/products", params: params, headers: headers, as: :json
    expect(Product.last.featured).to be false
  end

  it "blocks a non-owner from updating" do
    product = create(:product, user: other_user, name: "Theirs")
    patch "/api/products/#{product.id}",
          params: { product: { name: "Hijacked" } },
          headers: headers, as: :json
    expect(response).to have_http_status(:not_found).or have_http_status(:forbidden)
    expect(product.reload.name).to eq("Theirs")
  end
end`,
		correct: true,
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
		title: 'Create the support file',
		description:
			'FactoryBot is installed but RSpec does not know about it yet. Rails specs put one-concern config in spec/support/<concern>.rb. Which file content makes create() and build() available in every spec?',
		options: SUPPORT_FILE_OPTIONS,
	},
	4: {
		title: 'Autoload spec/support files',
		description:
			'rails_helper.rb is generated with the support-file autoload commented out. Pick the change that loads every file in spec/support/ for every spec, so the FactoryBot include actually runs.',
		options: UNCOMMENT_GLOB_OPTIONS,
	},
	5: {
		title: 'Write the User factory',
		description:
			'Your specs need to create users. The User model validates email_address for uniqueness and uses has_secure_password (so passwords are hashed via the password=virtual attribute, not by writing password_digest). Which factory does the right thing?',
		options: WRITE_FACTORY_OPTIONS,
	},
	6: {
		title: 'Write the products request spec',
		description:
			'You want one spec that catches the regressions you just saw: a dropped params filter, a missing authorize call, and a column rename. Which spec exercises the products controller end-to-end and asserts the actual behavior?',
		options: WRITE_SPEC_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files: {
		filename: string;
		language: string;
		code: string;
		highlight?: number[];
	}[] = [];

	if (phase === 'observe') {
		files.push({
			filename: 'Terminal',
			language: 'plaintext',
			code: `$ bundle exec rspec
bundler: command not found: rspec

# spec/ directory: does not exist yet.
# test/ ships from \`rails new\` but only contains
# the empty Minitest scaffolding (test_helper.rb,
# models/, controllers/, system/), no real specs.

# When a teammate edits a controller or runs a
# migration, nothing in the project asserts that
# the rules from earlier levels still hold.
# Every regression reaches a real customer
# before anyone notices.`,
		});
		return files;
	}

	if (furthestStep >= 0) {
		const showFactory = furthestStep >= 2;
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.1.3"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "bcrypt", "~> 3.1.7"
# ... other production gems ...

gem "jsonapi-serializer", "~> 2.2"
gem "pundit", "~> 2.5"

gem "rspec-rails", "~> 8.0", groups: [:development, :test]${showFactory ? '\n\ngem "factory_bot_rails", "~> 6.5", groups: [:development, :test]' : ''}`,
			highlight: showFactory ? [12, 14] : [12],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: '.rspec',
			language: 'plaintext',
			code: '--require spec_helper',
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'spec/support/factory_bot.rb',
			language: 'ruby',
			code: `RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'spec/rails_helper.rb',
			language: 'ruby',
			code: `require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
abort("...production!") if Rails.env.production?
require "rspec/rails"

# Loads spec/support/**/*.rb (e.g. factory_bot.rb).
Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.filter_rails_from_backtrace!
end`,
			highlight: [8],
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'spec/factories/users.rb',
			language: 'ruby',
			code: `FactoryBot.define do
  factory :user do
    sequence(:email_address) { |n| "user#{n}@example.com" }
    password { "password123" }
  end
end`,
			highlight: [3, 4],
		});
		files.push({
			filename: 'spec/factories/products.rb',
			language: 'ruby',
			code: `FactoryBot.define do
  factory :product do
    sequence(:name) { |n| "Product #{n}" }
    description { "A high-quality product crafted with care." }
    price { 19.99 }
    user
  end
end`,
		});
	}

	if (furthestStep >= 6) {
		files.push({
			filename: 'spec/requests/products_spec.rb',
			language: 'ruby',
			code: `require "rails_helper"

RSpec.describe "Api::Products", type: :request do
  let(:user)       { create(:user) }
  let(:other_user) { create(:user) }
  let(:headers) do
    session = user.sessions.create!(ip_address: "127.0.0.1", user_agent: "rspec")
    { "Authorization" => "Bearer #{session.token}" }
  end

  describe "GET /api/products" do
    it "returns the products visible to the current user" do
      create(:product, user: user, name: "Mine")
      create(:product, user: other_user, name: "Theirs")
      get "/api/products", headers: headers
      expect(response).to have_http_status(:ok)
    end

    it "returns 401 without a token" do
      get "/api/products"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/products" do
    it "creates a product owned by the current user" do
      params = { product: { name: "New", description: "Brand new", price: 9.99 } }
      expect {
        post "/api/products", params: params, headers: headers, as: :json
      }.to change(Product, :count).by(1)
      expect(Product.last.user).to eq(user)
    end

    it "drops featured: true (admin-only field)" do
      params = { product: { name: "Sneaky", description: "...", price: 1, featured: true } }
      post "/api/products", params: params, headers: headers, as: :json
      expect(Product.last.featured).to be false
    end
  end

  describe "PATCH /api/products/:id" do
    it "lets the owner update their product" do
      product = create(:product, user: user, name: "Old")
      patch "/api/products/#{product.id}",
            params: { product: { name: "New" } },
            headers: headers, as: :json
      expect(product.reload.name).to eq("New")
    end

    it "blocks a non-owner with 404 (Pundit + scoped policy)" do
      product = create(:product, user: other_user, name: "Theirs")
      patch "/api/products/#{product.id}",
            params: { product: { name: "Hijacked" } },
            headers: headers, as: :json
      expect(response).to have_http_status(:not_found).or have_http_status(:forbidden)
      expect(product.reload.name).to eq("Theirs")
    end
  end
end`,
			highlight: [37, 38, 39, 50, 51, 52],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Customer dashboard sub-components
// ──────────────────────────────────────────────

interface ProductCardSpec {
	name: string;
	price: string;
	featured?: boolean;
	spam?: boolean;
	deleted?: boolean;
}

const HOMEPAGE_IDLE: ProductCardSpec[] = [
	{ name: 'Ceramic Mug', price: '$19.99' },
	{ name: 'Sneakers', price: '$89.99' },
	{ name: 'Notebook', price: '$4.99' },
];

const HOMEPAGE_SPAM: ProductCardSpec[] = [
	{ name: 'Buy Crypto!!!', price: '$0.01', spam: true, featured: true },
	{ name: 'Sneakers', price: '$89.99' },
	{ name: 'Notebook', price: '$4.99' },
];

const ACCOUNT_IDLE: ProductCardSpec[] = [
	{ name: 'Ceramic Mug', price: '$19.99' },
	{ name: 'Notebook', price: '$4.99' },
];

const ACCOUNT_DELETED: ProductCardSpec[] = [
	{ name: 'Ceramic Mug', price: '$19.99', deleted: true },
	{ name: 'Notebook', price: '$4.99' },
];

interface ProductCardProps {
	product: ProductCardSpec;
}

function ProductCard({ product }: ProductCardProps) {
	if (product.spam) {
		return (
			<div className="rounded-md border-2 border-destructive bg-destructive/10 p-2 relative flex-1 min-h-0 flex flex-col justify-center">
				<div className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 shadow-md">
					FEATURED
				</div>
				<div className="text-xs font-bold text-destructive truncate">
					{product.name}
				</div>
				<div className="text-xs text-destructive font-semibold">
					{product.price}
				</div>
			</div>
		);
	}
	if (product.deleted) {
		return (
			<div className="rounded-md border-2 border-destructive bg-destructive/10 p-2 relative flex-1 min-h-0 flex flex-col justify-center">
				<div className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 shadow-md">
					DELETED
				</div>
				<div className="text-xs font-bold text-destructive line-through truncate">
					{product.name}
				</div>
				<div className="text-[10px] text-destructive font-semibold">
					by user_99
				</div>
			</div>
		);
	}
	return (
		<div className="rounded-md border border-border bg-card p-2 flex-1 min-h-0 flex flex-col justify-center">
			<div className="text-xs font-medium text-foreground truncate">
				{product.name}
			</div>
			<div className="text-xs text-muted-foreground">{product.price}</div>
		</div>
	);
}

interface ColumnPanelProps {
	title: string;
	children: React.ReactNode;
}

function ColumnPanel({ title, children }: ColumnPanelProps) {
	return (
		<div className="border border-border rounded-md p-2 flex flex-col gap-1.5 min-w-0 h-full">
			<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
				{title}
			</div>
			{children}
		</div>
	);
}

interface HomepageProductsProps {
	damage?: HomepageDamage;
}

function HomepageProducts({ damage }: HomepageProductsProps) {
	const products = damage ? HOMEPAGE_SPAM : HOMEPAGE_IDLE;
	return (
		<ColumnPanel title="Home Page">
			<div className="flex flex-col gap-1.5 flex-1 min-h-0">
				{products.map((p) => (
					<ProductCard key={p.name} product={p} />
				))}
			</div>
		</ColumnPanel>
	);
}

interface AccountListProps {
	damage?: AccountDamage;
}

function AccountList({ damage }: AccountListProps) {
	const products = damage ? ACCOUNT_DELETED : ACCOUNT_IDLE;
	return (
		<ColumnPanel title="Account Page (Alice)">
			<div className="flex flex-col gap-1.5 flex-1 min-h-0">
				{products.map((p) => (
					<ProductCard key={p.name} product={p} />
				))}
			</div>
		</ColumnPanel>
	);
}

interface LoginPreviewProps {
	damage?: LoginDamage;
}

function LoginPreview({ damage }: LoginPreviewProps) {
	const broken = !!damage;
	if (broken) {
		return (
			<ColumnPanel title="Login Page">
				<div className="rounded-md border-2 border-destructive bg-destructive/10 p-3 flex flex-col gap-2 items-center justify-center flex-1 min-h-0 relative">
					<div className="rounded bg-destructive text-destructive-foreground px-2 py-1 text-xs font-bold shadow-md tracking-wider">
						SERVER ERROR 500
					</div>
					<div className="text-[10px] text-destructive font-semibold text-center leading-tight">
						Sign-in unavailable
					</div>
					<Button
						className="w-full h-8 text-xs mt-1 opacity-50"
						disabled
						size="sm"
						variant="outline"
					>
						Sign in
					</Button>
				</div>
			</ColumnPanel>
		);
	}
	return (
		<ColumnPanel title="Login Page">
			<div className="rounded-md border border-border bg-background p-3 flex flex-col gap-2 flex-1 min-h-0 justify-center">
				<div className="rounded border border-border bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
					email
				</div>
				<div className="rounded border border-border bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
					password
				</div>
				<Button className="w-full h-8 text-xs" size="sm" variant="default">
					Sign in
				</Button>
			</div>
		</ColumnPanel>
	);
}

interface IncidentLogProps {
	entries: string[];
}

function IncidentLog({ entries }: IncidentLogProps) {
	if (entries.length === 0) return null;
	return (
		<div className="border border-destructive/40 bg-destructive/5 rounded-md px-3 py-1.5 flex items-center gap-3 flex-wrap">
			<span className="text-[10px] font-semibold text-destructive uppercase tracking-wider shrink-0">
				Incident log
			</span>
			<ul className="flex items-center gap-3 flex-wrap min-w-0">
				{entries.map((entry) => (
					<li
						className="text-xs text-destructive flex items-center gap-1.5 leading-tight"
						key={entry}
					>
						<span aria-hidden className="text-destructive">
							•
						</span>
						<span>{entry}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

interface CustomerDashboardProps {
	damage: DashboardDamage | null;
}

function CustomerDashboard({ damage }: CustomerDashboardProps) {
	return (
		<div className="flex-1 min-h-0 overflow-hidden px-4 pt-4 pb-2 flex flex-col">
			<div className="max-w-4xl w-full mx-auto flex-1 min-h-0 flex flex-col gap-2">
				<div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
					<HomepageProducts damage={damage?.homepage} />
					<AccountList damage={damage?.account} />
					<LoginPreview damage={damage?.login} />
				</div>
				<IncidentLog entries={damage?.incidentLog ?? []} />
			</div>
		</div>
	);
}

interface RegressionToastProps {
	message: string;
}

function RegressionToast({ message }: RegressionToastProps) {
	return (
		<div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-300">
			<Card className="px-4 py-3 border-success/50 bg-success/10 max-w-xl">
				<div className="text-sm text-success font-medium">{message}</div>
			</Card>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level14Testing({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// ── Observe-phase damage state ──
	// The dashboard paints the customer-visible damage of whichever probe
	// fired most recently. Pre-fire it shows the clean idle state.
	const observeDamage = useMemo<DashboardDamage | null>(() => {
		if (!lastProbeId) return null;
		const probe = PROBES.find((p) => p.id === lastProbeId);
		return probe?.damage ?? null;
	}, [lastProbeId]);

	// ── Reward-phase toast ──
	// In reward, every regression scenario fires a toast describing the
	// rspec catch. The clean-refactor scenario fires "All checks pass".
	// The dashboard stays clean across all four scenarios, the spec runs
	// before the change ever reaches a customer.
	const lastResult = stressTest.results[stressTest.results.length - 1];

	useEffect(() => {
		if (phase !== 'reward' || !lastResult) return;
		const scenario = STRESS_SCENARIOS.find(
			(s) => s.id === lastResult.scenarioId,
		);
		if (!scenario) return;
		const message =
			scenario.id === 'helper-rename-clean-refactor'
				? 'All checks pass. (rspec ran 6 examples in 0.3s; 0 failures)'
				: `Caught locally. The change never reached customers. (rspec ran 6 examples in 0.3s; ${
						scenario.id === 'login-down-overnight' ? '6 failures' : '1 failure'
					})`;
		setToastMessage(message);
		const timeout = setTimeout(() => setToastMessage(null), 4000);
		return () => clearTimeout(timeout);
	}, [phase, lastResult]);

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
		setToastMessage(null);
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
							Across earlier levels you built rules into your app: contact info
							goes through the encrypted column, only the owner can change a
							product, admin-only fields stay admin-only. Right now those rules
							live only in the code that implements them.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The next refactor that breaks one of them will reach customers
							before anyone notices. Watch what that looks like, then add
							automated checks that catch the change locally.
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

					{/* Reward phase: counters */}
					{phase === 'reward' && (
						<div className="p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Customer impact
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-success/20 rounded-lg p-3 text-center">
									<div className="text-2xl font-bold text-success">
										{stressTest.allowedCount}
									</div>
									<div className="text-xs text-success/70">
										Customers see normal data
									</div>
								</div>
								<div className="bg-destructive/20 rounded-lg p-3 text-center">
									<div className="text-2xl font-bold text-destructive">
										{stressTest.blockedCount}
									</div>
									<div className="text-xs text-destructive/70">
										Customers see damage
									</div>
								</div>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Testing"
					levelNumber={14}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col relative">
							<CustomerDashboard damage={observeDamage} />

							{/* Probe terminal */}
							<div className="px-6 pb-4">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="Simulate a refactor"
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
													Add the testing framework gem to your Gemfile, but
													only in the groups where it is actually used.
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
											title="Add the test framework gem"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={runRspecInstallCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Run the gem-provided install generator to scaffold a
													spec/ directory, .rspec config, and helper files.
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
											title="Run the install generator"
										/>
									)}

								{currentStepType === 'terminal' &&
									stepper.currentStep === 2 && (
										<TerminalChoiceStep
											commands={addFactoryBotCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Add the factories gem so your specs can build test
													records with sensible defaults. Same group rules as
													the framework gem.
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
											title="Add the factories gem"
										/>
									)}

								{/* OptionCard steps (3, 4, 5, 6) */}
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
						<div className="flex-1 flex flex-col relative">
							{toastMessage && <RegressionToast message={toastMessage} />}

							<CustomerDashboard damage={null} />

							{/* Stress test controls */}
							<div className="px-6 pb-4">
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

export default Level14Testing;

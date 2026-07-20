/**
 * Level 2: First Boot
 *
 * 6-step progression: choose a database, install it, generate the project,
 * explore the generated app, create the database, and boot the server.
 *
 * ID: "act1-level2-first-boot"
 */

import { AlertCircle, ArrowRight } from 'lucide-react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
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
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

registerLevelCode('act1-level2-first-boot', () => [
	{
		filename: 'Gemfile',
		language: 'ruby',
		code: `source "https://rubygems.org"

gem "rails", "~> 8.1.3"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"

gem "tzinfo-data", platforms: %i[ windows jruby ]

# Database-backed adapters for cache, queue, and Action Cable
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"

gem "bootsnap", require: false
gem "kamal", require: false
gem "thruster", require: false

gem "image_processing", "~> 2.0"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "bundler-audit", require: false
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
end`,
	},
	{
		filename: 'config/database.yml',
		language: 'yaml',
		code: `default: &default
  adapter: postgresql
  encoding: unicode
  max_connections: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

test:
  <<: *default
  database: myapp_test

production:
  primary: &primary_production
    <<: *default
    database: myapp_production
    username: myapp
    password: <%= ENV["MYAPP_DATABASE_PASSWORD"] %>
  cache:
    <<: *primary_production
    database: myapp_production_cache
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: myapp_production_queue
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: myapp_production_cable
    migrations_paths: db/cable_migrate`,
	},
	{
		filename: 'config/application.rb',
		language: 'ruby',
		code: `require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module Myapp
  class Application < Rails::Application
    config.load_defaults 8.1

    config.autoload_lib(ignore: %w[assets tasks])

    # API-only mode: leaner middleware stack (no sessions, flash, cookies by default).
    config.api_only = true
  end
end`,
	},
]);

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-db', title: 'Choose Database' },
	{ id: 'install-pg', title: 'Install PostgreSQL' },
	{ id: 'generate-project', title: 'Generate Project' },
	{ id: 'explore-app', title: 'Explore the App' },
	{ id: 'create-db', title: 'Create Database' },
	{ id: 'boot-server', title: 'Boot Server' },
];

// Step 2: Install PostgreSQL commands
const installPgCommands: TerminalCommand[] = [
	{
		id: 'wrong-gem',
		label: 'gem install pg',
		command: 'gem install pg',
		correct: false,
		feedback:
			"That's the Ruby driver. Install the database server itself first.",
	},
	{
		id: 'wrong-apt',
		label: 'apt-get install postgresql',
		command: 'apt-get install postgresql',
		correct: false,
		feedback: 'apt-get is a Linux package manager, not available on macOS.',
	},
	{
		id: 'correct',
		label: 'brew install postgresql@17',
		command: 'brew install postgresql@17',
		correct: true,
	},
];

const installPgOutput: TerminalOutputLine[] = [
	{ text: '==> Downloading postgresql@17...', color: 'cyan' },
	{ text: '==> Installing postgresql@17', color: 'green' },
	{ text: '==> Starting postgresql@17', color: 'green' },
	{ text: '\u2713 PostgreSQL 17.0 is running on port 5432', color: 'green' },
];

// Step 3: Generate Project commands
const generateCommands: TerminalCommand[] = [
	{
		id: 'wrong-no-flags',
		label: 'rails new myapp',
		command: 'rails new myapp',
		correct: false,
		feedback: 'Missing flags. You need API-only mode and a database adapter.',
	},
	{
		id: 'correct',
		label: 'rails new myapp --api --database=postgresql',
		command: 'rails new myapp --api --database=postgresql',
		correct: true,
	},
	{
		id: 'wrong-generate',
		label: 'rails generate app myapp',
		command: 'rails generate app myapp',
		correct: false,
		feedback:
			'"generate" is for scaffolding inside an existing app, not creating one.',
	},
];

const generateOutput: TerminalOutputLine[] = [
	{ text: '      create  Gemfile', color: 'green' },
	{ text: '      create  Dockerfile', color: 'green' },
	{ text: '      create  Rakefile', color: 'green' },
	{
		text: '      create  app/controllers/application_controller.rb',
		color: 'green',
	},
	{ text: '      create  app/models/application_record.rb', color: 'green' },
	{ text: '      create  config/application.rb', color: 'green' },
	{ text: '      create  config/database.yml', color: 'cyan' },
	{ text: '         run  bundle install --quiet', color: 'yellow' },
	{ text: '         run  bundle exec kamal init', color: 'yellow' },
	{
		text: '       rails  solid_cache:install solid_queue:install solid_cable:install',
		color: 'cyan',
	},
	{ text: '✓ Generated myapp', color: 'green' },
];

// Step 4: Explore the Generated App commands
//
// `ls -F` is on every macOS / Linux system. We deliberately avoid `tree`
// here even though its output is prettier -- `tree` is not installed by
// default on macOS, and we do not want a beginner's first encounter with
// the directory layout to end with "command not found".
const exploreCommands: TerminalCommand[] = [
	{
		id: 'wrong-cat',
		label: 'cat myapp',
		command: 'cat myapp',
		correct: false,
		feedback:
			'cat reads files. To list a directory you need a different command.',
	},
	{
		id: 'wrong-find',
		label: 'find myapp -type f',
		command: 'find myapp -type f',
		correct: false,
		feedback:
			'find -type f lists every individual file (hundreds of them). You want a high-level view of the top-level directory layout, not every file.',
	},
	{
		id: 'correct',
		label: 'ls -F myapp',
		command: 'ls -F myapp',
		correct: true,
	},
];

const exploreOutput: TerminalOutputLine[] = [
	// `ls -F` adds a trailing slash to directories and an asterisk to
	// executables, which is how the player tells folders from files.
	{
		text: 'Dockerfile     Rakefile       config/        public/',
		color: 'green',
	},
	{
		text: 'Gemfile        README.md      config.ru      script/',
		color: 'green',
	},
	{
		text: 'Gemfile.lock   app/           db/            storage/',
		color: 'green',
	},
	{
		text: 'bin/           lib/           log/           test/',
		color: 'green',
	},
	{ text: 'tmp/           vendor/', color: 'green' },
	{ text: '', color: 'muted' },
	{
		text: '# Trailing / marks a directory. Most of your work lives in:',
		color: 'cyan',
	},
	{
		text: '#   app/      models, controllers, mailers, jobs',
		color: 'cyan',
	},
	{
		text: '#   config/   routes, database, credentials',
		color: 'cyan',
	},
	{
		text: '#   db/       migrations, schema, seeds',
		color: 'cyan',
	},
];

// Step 5: Create Database commands
const createDbCommands: TerminalCommand[] = [
	{
		id: 'wrong-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: false,
		feedback:
			"Database doesn't exist yet. Migrations need an existing database.",
	},
	{
		id: 'correct',
		label: 'rails db:create',
		command: 'rails db:create',
		correct: true,
	},
];

const createDbOutput: TerminalOutputLine[] = [
	{ text: `Created database 'myapp_development'`, color: 'green' },
	{ text: `Created database 'myapp_test'`, color: 'green' },
];

// Step 6: Boot Server commands
const bootCommands: TerminalCommand[] = [
	{
		id: 'wrong-start',
		label: 'rails start',
		command: 'rails start',
		correct: false,
		feedback:
			'"start" isn\'t a Rails command. Think about what runs a web server.',
	},
	{
		id: 'correct',
		label: 'rails server',
		command: 'rails server',
		correct: true,
	},
];

const bootOutput: TerminalOutputLine[] = [
	{ text: '=> Booting Puma', color: 'cyan' },
	{
		text: '=> Rails 8.1.3 application starting in development',
		color: 'cyan',
	},
	{ text: '* Listening on http://127.0.0.1:3000', color: 'green' },
	{ text: 'Use Ctrl-C to stop', color: 'muted' },
];

// Terminal step data for building history (step 0 is Choose DB, not terminal)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: Choose Database (OptionCard)
	{ commands: installPgCommands, outputLines: installPgOutput },
	{ commands: generateCommands, outputLines: generateOutput },
	{ commands: exploreCommands, outputLines: exploreOutput },
	{ commands: createDbCommands, outputLines: createDbOutput },
	{ commands: bootCommands, outputLines: bootOutput },
];

// Terminal step titles and descriptions
const TERMINAL_STEPS: {
	stepIndex: number;
	title: string;
	description: React.ReactNode;
	commands: TerminalCommand[];
	outputLines: TerminalOutputLine[];
}[] = [
	{
		stepIndex: 1,
		title: 'Install PostgreSQL',
		description: (
			<p className="text-sm text-muted-foreground">
				PostgreSQL needs a server running on your machine. Which package manager
				installs system software on macOS?
			</p>
		),
		commands: installPgCommands,
		outputLines: installPgOutput,
	},
	{
		stepIndex: 2,
		title: 'Generate Project',
		description: (
			<p className="text-sm text-muted-foreground">
				Create an API-only Rails app configured for PostgreSQL.
			</p>
		),
		commands: generateCommands,
		outputLines: generateOutput,
	},
	{
		stepIndex: 3,
		title: 'Explore the App',
		description: (
			<p className="text-sm text-muted-foreground">
				<code>rails new</code> generated a full Rails app skeleton. Before
				creating the database, take a look around. Pick the right command to
				view the top-level directory layout.
			</p>
		),
		commands: exploreCommands,
		outputLines: exploreOutput,
	},
	{
		stepIndex: 4,
		title: 'Create Database',
		description: (
			<p className="text-sm text-muted-foreground">
				The project is generated. Now create the development and test databases.
			</p>
		),
		commands: createDbCommands,
		outputLines: createDbOutput,
	},
	{
		stepIndex: 5,
		title: 'Boot Server',
		description: (
			<p className="text-sm text-muted-foreground">
				Database created. Start the Rails server and verify it responds.
			</p>
		),
		commands: bootCommands,
		outputLines: bootOutput,
	},
];

export function Level2FirstBoot({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	// Step 1: Choose Database - click-to-select with feedback
	function handleChooseDb(choice: 'postgresql' | 'sqlite') {
		if (choice === 'postgresql') {
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(
				'Rails 8 makes SQLite viable for a single server (WAL mode + IMMEDIATE transactions handle concurrent writes), but a multi-server API needs replication and shared state across hosts. Pick the database that scales horizontally.',
			);
		}
	}

	const handleComplete = () => {
		const choices = {
			database: 'postgresql',
			constraints: {
				apiOnly: true,
				canShard: true,
			},
		};

		try {
			localStorage.setItem(
				'interactive-rails-game-choices',
				JSON.stringify(choices),
			);
		} catch (e) {
			console.error('Failed to save game choices:', e);
		}

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
		return { valid: true, message: 'Rails app is ready!' };
	};

	// Code preview - only generated FILES, no terminal (center panel handles that)
	// furthestStep: 0=start, 1=chose DB, 2=installed PG, 3=generated project,
	//               4=explored app, 5=created DB, 6=booted server
	const getCodeFiles = () => {
		const files = [];

		// Stack choice summary (after choosing DB)
		if (stepper.furthestStep >= 1) {
			files.push({
				filename: 'Stack',
				language: 'bash',
				code: `Database:  PostgreSQL 17
Framework: Rails 8.1 (API-only)
Server:    Puma`,
				highlight: [1, 2, 3],
			});
		}

		// Config files appear after rails new (step 2)
		if (stepper.furthestStep >= 3) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `source "https://rubygems.org"

gem "rails", "~> 8.1.3"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"

gem "tzinfo-data", platforms: %i[ windows jruby ]

# Database-backed adapters for cache, queue, and Action Cable
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"

gem "bootsnap", require: false
gem "kamal", require: false
gem "thruster", require: false

gem "image_processing", "~> 2.0"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "bundler-audit", require: false
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
end`,
				highlight: [9, 10, 11, 12],
			});

			files.push({
				filename: 'config/database.yml',
				language: 'yaml',
				code: `default: &default
  adapter: postgresql
  encoding: unicode
  max_connections: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

test:
  <<: *default
  database: myapp_test

production:
  primary: &primary_production
    <<: *default
    database: myapp_production
    username: myapp
    password: <%= ENV["MYAPP_DATABASE_PASSWORD"] %>
  cache:
    <<: *primary_production
    database: myapp_production_cache
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: myapp_production_queue
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: myapp_production_cable
    migrations_paths: db/cable_migrate`,
				highlight: [2, 7, 11],
			});

			files.push({
				filename: 'config/application.rb',
				language: 'ruby',
				code: `require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module Myapp
  class Application < Rails::Application
    config.load_defaults 8.1

    config.autoload_lib(ignore: %w[assets tasks])

    # API-only mode: leaner middleware stack (no sessions, flash, cookies by default).
    config.api_only = true
  end
end`,
				highlight: [13],
			});
		}

		// Directory Layout reference (after explore step)
		if (stepper.furthestStep >= 4) {
			files.push({
				filename: 'Directory Layout',
				language: 'bash',
				code: `myapp/
├── Dockerfile             # Container image (Rails 8 default for Kamal deploys)
├── Gemfile                # Ruby gem dependencies
├── Gemfile.lock           # Locked gem versions
├── README.md              # Documentation
├── Rakefile               # Task runner config
├── app/                   # Your app code (models, controllers, mailers, jobs)
├── bin/                   # Runner scripts (rails, setup, dev, jobs)
├── config/                # Configuration (routes, database, credentials)
├── config.ru              # Rack server entry point
├── db/                    # Migrations, schema, seeds
├── lib/                   # Code shared across the app
├── log/                   # Application logs
├── public/                # Static files served as-is
├── script/                # One-off Ruby scripts you run by hand
├── storage/               # Active Storage local-disk uploads
├── test/                  # Test files
├── tmp/                   # Cache, sockets, ephemeral data
└── vendor/                # Third-party code vendored into the repo`,
				highlight: [7, 8, 9, 11],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'Project Files',
				language: 'bash',
				code: `# No project yet.
# Choose a database to begin.`,
				highlight: [],
			});
		}

		return files;
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Find current terminal step config (if viewing a terminal step)
	const currentTerminalStep = TERMINAL_STEPS.find(
		(ts) => ts.stepIndex === stepper.currentStep,
	);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Ruby and Rails are installed. Now create your first Rails
							application. Pick a database, install it, generate the project,
							and get the server running.
						</p>
					</div>

					{/* Step Progress */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress
							currentStep={stepper.currentStep}
							onStepClick={stepper.goToStep}
							steps={stepper.steps}
						/>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="First Boot"
					levelNumber={2}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Choose Database (OptionCard) */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Your Database
								</h3>
								<p className="text-sm text-muted-foreground">
									Your API will serve multiple users sending concurrent
									requests. Pick the database that can handle that.
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										<OptionCard
											color="blue"
											description="File-based, zero config. Great for prototypes and single-writer apps."
											disabled
											name="SQLite"
											size="lg"
										/>
										<OptionCard
											color="blue"
											description="Client-server database many processes connect to at once. Runs as its own service you install and manage."
											name="PostgreSQL"
											selected
											size="lg"
										/>
									</div>
								) : (
									<>
										<div className="space-y-2">
											<OptionCard
												color="blue"
												description="File-based, zero config. Great for prototypes and single-writer apps."
												name="SQLite"
												onClick={() => handleChooseDb('sqlite')}
												size="lg"
											/>
											<OptionCard
												color="blue"
												description="Client-server database many processes connect to at once. Runs as its own service you install and manage."
												name="PostgreSQL"
												onClick={() => handleChooseDb('postgresql')}
												size="lg"
											/>
										</div>

										{stepper.lastFeedback && (
											<div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
												<AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
												<p className="text-sm text-destructive">
													{stepper.lastFeedback}
												</p>
											</div>
										)}
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
							</div>
						)}

						{/* Steps 2-5: Terminal choice steps */}
						{currentTerminalStep && (
							<TerminalChoiceStep
								commands={currentTerminalStep.commands}
								completed={isViewingCompletedStep}
								description={currentTerminalStep.description}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentTerminalStep.outputLines}
								stepKey={stepper.currentStep}
								title={currentTerminalStep.title}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level2FirstBoot;

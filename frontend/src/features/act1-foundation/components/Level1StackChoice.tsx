/**
 * Level 2: Hello, Rails
 *
 * 5-step progression: choose a database, install it, generate the project,
 * create the database, and boot the server.
 *
 * ID remains "act1-level1-stack-choice" to preserve saved progress.
 */

import { useState } from 'react';
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
	SimulatedTerminal,
	StepProgress,
	type TerminalCommand,
	type TerminalOutputLine,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

type DatabaseChoice = 'postgresql' | 'sqlite' | null;

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-db', title: 'Choose Database' },
	{ id: 'install-pg', title: 'Install PostgreSQL' },
	{ id: 'generate-project', title: 'Generate Project' },
	{ id: 'create-db', title: 'Create Database' },
	{ id: 'boot-server', title: 'Boot Server' },
];

export function Level1StackChoice({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);
	const [database, setDatabase] = useState<DatabaseChoice>(null);

	// Step 1: Choose Database — click-to-select with feedback
	function handleChooseDb(choice: DatabaseChoice) {
		if (choice === 'postgresql') {
			setDatabase('postgresql');
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(
				'SQLite only supports one writer at a time. A multi-user API needs a database that handles concurrent writes.',
			);
		}
	}

	// Step 2: Install PostgreSQL commands
	const installPgCommands: TerminalCommand[] = [
		{
			id: 'wrong-gem',
			label: 'gem install pg',
			command: 'gem install pg',
			correct: false,
			feedback: "That's the Ruby driver — install the PostgreSQL server first.",
		},
		{
			id: 'wrong-apt',
			label: 'apt-get install postgresql',
			command: 'apt-get install postgresql',
			correct: false,
			feedback: 'apt-get is a Linux package manager — not available on macOS.',
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
		{ text: '✓ PostgreSQL 17.0 is running on port 5432', color: 'green' },
	];

	// Step 3: Generate Project commands
	const generateCommands: TerminalCommand[] = [
		{
			id: 'wrong-no-flags',
			label: 'rails new myapp',
			command: 'rails new myapp',
			correct: false,
			feedback: 'Missing flags — you need API-only mode and a database adapter.',
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
			feedback: '"generate" is for scaffolding inside an existing app, not creating one.',
		},
	];

	const generateOutput: TerminalOutputLine[] = [
		{ text: '      create  .', color: 'green' },
		{ text: '      create  Gemfile', color: 'green' },
		{ text: '      create  Rakefile', color: 'green' },
		{ text: '      create  config.ru', color: 'green' },
		{
			text: '      create  app/controllers/application_controller.rb',
			color: 'green',
		},
		{ text: '      create  app/models/application_record.rb', color: 'green' },
		{
			text: '      create  config/database.yml  (postgresql)',
			color: 'cyan',
		},
		{ text: '      create  config/application.rb', color: 'green' },
		{ text: '         run  bundle install', color: 'yellow' },
		{ text: 'Bundle complete! 12 Gemfile dependencies.', color: 'green' },
	];

	// Step 4: Create Database commands
	const createDbCommands: TerminalCommand[] = [
		{
			id: 'wrong-migrate',
			label: 'rails db:migrate',
			command: 'rails db:migrate',
			correct: false,
			feedback: "Database doesn't exist yet — migrations need an existing database.",
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

	// Step 5: Boot Server commands
	const bootCommands: TerminalCommand[] = [
		{
			id: 'wrong-start',
			label: 'rails start',
			command: 'rails start',
			correct: false,
			feedback: '"start" isn\'t a Rails command. Think about what runs a web server.',
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
			text: '=> Rails 8.0.0 application starting in development',
			color: 'cyan',
		},
		{ text: '* Listening on http://127.0.0.1:3000', color: 'green' },
		{ text: '', color: 'muted' },
		{ text: '$ curl http://localhost:3000/up', color: 'yellow' },
		{ text: '{"status":"ok"}', color: 'green' },
	];

	const handleComplete = async () => {
		const choices = {
			database: 'postgresql',
			constraints: {
				apiOnly: true,
				canShard: true,
			},
		};

		try {
			localStorage.setItem(
				'rails-expert-game-choices',
				JSON.stringify(choices),
			);
		} catch (e) {
			console.error('Failed to save game choices:', e);
		}

		const success = await completeLevel('act1-level1-stack-choice', {
			stars: stepper.starRating,
			stackChoices: { database: 'postgresql' },
		});
		if (success) {
			onComplete({ stars: stepper.starRating });
		}
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

	// Code preview updates per step
	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep >= 1) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "pg"
gem "puma", ">= 5.0"

# Rails 8 defaults (no Redis needed)
gem "solid_queue"
gem "solid_cache"
gem "solid_cable"`,
				highlight: [4],
			});
		}

		if (stepper.currentStep >= 2) {
			files.push({
				filename: 'config/database.yml',
				language: 'yaml',
				code: `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

test:
  <<: *default
  database: myapp_test`,
				highlight: [2],
			});
		}

		if (stepper.currentStep >= 3) {
			files.push({
				filename: 'config/application.rb',
				language: 'ruby',
				code: `module Myapp
  class Application < Rails::Application
    config.load_defaults 8.0

    # API-only mode: no cookies, sessions, flash
    config.api_only = true
  end
end`,
				highlight: [6],
			});
		}

		if (stepper.currentStep >= 4) {
			files.push({
				filename: 'Server Output',
				language: 'bash',
				code: `# Puma starting in single mode...
# * Listening on http://127.0.0.1:3000
#
# GET http://localhost:3000/up
# => {"status":"ok"}
#
# Your Rails API is running!`,
				highlight: [5, 7],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'setup.sh',
				language: 'bash',
				code: `# First, choose your database.
# PostgreSQL or SQLite?`,
				highlight: [],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Ruby and Rails are installed. Now create your first Rails
							application — pick a database, install it, generate the project,
							and get the server running.
						</p>
					</div>

					{/* Step Progress */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Database Palette (step 1 only) */}
					{stepper.currentStep === 0 && (
						<div className="p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Databases
							</div>
							<div className="space-y-2">
								<OptionCard
									color="cyan"
									description="File-based, zero config. Great for prototypes and single-writer apps."
									name="SQLite"
									onClick={() => handleChooseDb('sqlite')}
									size="lg"
								/>
								<OptionCard
									color="blue"
									description="Multi-user, concurrent writes, sharding & read replicas. The production standard."
									name="PostgreSQL"
									onClick={() => handleChooseDb('postgresql')}
									size="lg"
								/>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Hello, Rails"
					levelNumber={2}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Choose Database */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Your Database
								</h3>
								<p className="text-sm text-muted-foreground">
									Your API will serve multiple users sending concurrent
									requests. Pick the database that can handle that.
								</p>
								<div className="bg-card border border-border rounded-lg p-6 text-center">
									<div className="text-sm text-muted-foreground">
										Select a database from the left panel
									</div>
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 2: Install PostgreSQL */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Install PostgreSQL
								</h3>
								<p className="text-sm text-muted-foreground">
									PostgreSQL needs a server running on your machine. Which
									package manager installs system software on macOS?
								</p>
								<SimulatedTerminal
									commands={installPgCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={installPgOutput}
								/>
							</div>
						)}

						{/* Step 3: Generate Project */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Generate Project
								</h3>
								<p className="text-sm text-muted-foreground">
									Create an API-only Rails app configured for PostgreSQL.
								</p>
								<SimulatedTerminal
									commands={generateCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={generateOutput}
								/>
							</div>
						)}

						{/* Step 4: Create Database */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Create Database
								</h3>
								<p className="text-sm text-muted-foreground">
									The project is generated. Now create the development and test
									databases.
								</p>
								<SimulatedTerminal
									commands={createDbCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={createDbOutput}
								/>
							</div>
						)}

						{/* Step 5: Boot Server (stays visible after completion) */}
						{stepper.currentStep >= 4 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Boot Server
								</h3>
								<p className="text-sm text-muted-foreground">
									Database created. Start the Rails server and verify it
									responds.
								</p>
								<SimulatedTerminal
									commands={bootCommands}
									completed={stepper.isComplete}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={bootOutput}
								/>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Your Choices
						</div>
						{database ? (
							<div className="space-y-2 text-sm">
								<div className="text-muted-foreground">
									<span className="text-success font-medium">PostgreSQL</span> —
									Can scale to sharding in Act VII
								</div>
								<div className="text-muted-foreground">
									<span className="text-success font-medium">API-only</span> —
									Lean JSON endpoints, no view layer
								</div>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								Choose a database to see your stack
							</p>
						)}
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level1StackChoice;

/**
 * Level 1: The Stack Choice
 *
 * 4-step progression to set up a new Rails API project.
 * Steps: Choose Database → Generate Project → Create Database → Boot Server
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
	useLevelCompletion,
	type TerminalCommand,
	type TerminalOutputLine,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

type DatabaseChoice = 'postgresql' | 'sqlite' | null;

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-db', title: 'Choose Database' },
	{ id: 'generate-project', title: 'Generate Project' },
	{ id: 'create-db', title: 'Create Database' },
	{ id: 'boot-server', title: 'Boot Server' },
];

export function Level1StackChoice({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);
	const [database, setDatabase] = useState<DatabaseChoice>(null);
	const [dragOverSlot, setDragOverSlot] = useState(false);

	// Step 1: Choose Database
	function handleDragStart(e: React.DragEvent, type: string) {
		e.dataTransfer.setData('nodeType', type);
	}

	function handleDropDatabase(e: React.DragEvent) {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('nodeType');
		if (nodeType === 'postgresql' || nodeType === 'sqlite') {
			setDatabase(nodeType);
			stepper.completeStep();
		}
		setDragOverSlot(false);
	}

	// Step 2: Generate Project commands
	const generateCommands: TerminalCommand[] = database
		? [
				{
					id: 'correct',
					label: `rails new myapp --api --database=${database}`,
					command: `rails new myapp --api --database=${database}`,
					correct: true,
				},
				{
					id: 'wrong-no-flags',
					label: 'rails new myapp',
					command: 'rails new myapp',
					correct: false,
					feedback:
						'Add --api for API-only mode and --database for your database choice.',
				},
				{
					id: 'wrong-generate',
					label: 'rails generate app myapp',
					command: 'rails generate app myapp',
					correct: false,
					feedback:
						'Not a real command — use "rails new" to create a new application.',
				},
			]
		: [];

	const generateOutput: TerminalOutputLine[] = [
		{ text: '      create  .', color: 'green' },
		{ text: '      create  Gemfile', color: 'green' },
		{ text: '      create  Rakefile', color: 'green' },
		{ text: '      create  config.ru', color: 'green' },
		{ text: '      create  app/controllers/application_controller.rb', color: 'green' },
		{ text: '      create  app/models/application_record.rb', color: 'green' },
		{ text: `      create  config/database.yml  (${database || 'postgresql'})`, color: 'cyan' },
		{ text: '      create  config/application.rb', color: 'green' },
		{ text: '         run  bundle install', color: 'yellow' },
		{ text: 'Bundle complete! 12 Gemfile dependencies.', color: 'green' },
	];

	// Step 3: Create Database commands
	const createDbCommands: TerminalCommand[] = [
		{
			id: 'correct',
			label: 'rails db:create',
			command: 'rails db:create',
			correct: true,
		},
		{
			id: 'wrong-migrate',
			label: 'rails db:migrate',
			command: 'rails db:migrate',
			correct: false,
			feedback:
				'The database does not exist yet — run db:create first, then migrate later.',
		},
	];

	const createDbOutput: TerminalOutputLine[] = [
		{ text: `Created database 'myapp_development'`, color: 'green' },
		{ text: `Created database 'myapp_test'`, color: 'green' },
	];

	// Step 4: Boot Server commands
	const bootCommands: TerminalCommand[] = [
		{
			id: 'correct',
			label: 'rails server',
			command: 'rails server',
			correct: true,
		},
		{
			id: 'wrong-start',
			label: 'rails start',
			command: 'rails start',
			correct: false,
			feedback: 'The command is "rails server" (or "rails s" for short).',
		},
	];

	const bootOutput: TerminalOutputLine[] = [
		{ text: '=> Booting Puma', color: 'cyan' },
		{ text: '=> Rails 8.0.0 application starting in development', color: 'cyan' },
		{ text: '* Listening on http://127.0.0.1:3000', color: 'green' },
		{ text: '', color: 'muted' },
		{ text: '$ curl http://localhost:3000/up', color: 'yellow' },
		{ text: '{"status":"ok"}', color: 'green' },
	];

	const handleComplete = async () => {
		const choices = {
			database,
			constraints: {
				apiOnly: true,
				canShard: database === 'postgresql',
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
			stackChoices: { database: database! },
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

		if (stepper.currentStep >= 1 && database) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "${database === 'postgresql' ? 'pg' : 'sqlite3'}"
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
				language: 'ruby',
				code:
					database === 'postgresql'
						? `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

test:
  <<: *default
  database: myapp_test`
						: `default: &default
  adapter: sqlite3
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  timeout: 5000

development:
  <<: *default
  database: storage/development.sqlite3

test:
  <<: *default
  database: storage/test.sqlite3`,
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
				language: 'ruby',
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
				filename: 'rails_generator.sh',
				language: 'ruby',
				code: `# Choose a database to get started
# Drag PostgreSQL or SQLite to the slot`,
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
							Day 1. Set up your Rails API project from scratch. Your
							database choice will determine your scaling limits later.
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
									color="blue"
									description="Production-ready. Supports sharding & read replicas."
									dragData="postgresql"
									dragType="nodeType"
									draggable
									name="PostgreSQL"
									onDragStart={(e) => handleDragStart(e, 'postgresql')}
									size="lg"
								/>
								<OptionCard
									color="cyan"
									description="Simple, file-based. Rails 8 makes it production-ready."
									dragData="sqlite"
									dragType="nodeType"
									draggable
									name="SQLite"
									onDragStart={(e) => handleDragStart(e, 'sqlite')}
									size="lg"
									warning="Cannot support Sharding (Level 49)"
								/>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The Stack Choice"
					levelNumber={1}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Database Slot */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Your Database
								</h3>
								<p className="text-sm text-muted-foreground">
									Drag a database from the left panel into the slot below.
								</p>
								<div className="flex justify-center py-8">
									<div
										className={`w-64 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all ${
											dragOverSlot
												? 'border-primary bg-primary/10 scale-105'
												: 'border-border bg-card/50 hover:border-muted-foreground'
										}`}
										onDragEnter={() => setDragOverSlot(true)}
										onDragLeave={() => setDragOverSlot(false)}
										onDragOver={(e) => e.preventDefault()}
										onDrop={handleDropDatabase}
									>
										<div className="text-3xl text-muted-foreground mb-2">
											+
										</div>
										<div className="text-sm font-medium text-muted-foreground">
											Database System
										</div>
										<div className="text-xs text-primary mt-2">
											Drag & drop here
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Step 2: Generate Project */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Generate Project
								</h3>
								<p className="text-sm text-muted-foreground">
									Pick the correct{' '}
									<span className="font-mono text-primary">rails new</span>{' '}
									command to create your API app with{' '}
									<span className="font-mono text-primary">
										{database === 'postgresql' ? 'PostgreSQL' : 'SQLite'}
									</span>
									.
								</p>
								<SimulatedTerminal
									commands={generateCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={generateOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: Create Database */}
						{stepper.currentStep === 2 && (
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
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 4: Boot Server */}
						{stepper.currentStep === 3 && (
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
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={bootOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Complete */}
						{stepper.isComplete && (
							<div className="text-center py-12 space-y-4">
								<div className="text-4xl">
									{'★'.repeat(stepper.starRating)}
									{'☆'.repeat(3 - stepper.starRating)}
								</div>
								<h3 className="text-xl font-bold text-foreground">
									Rails App is Running!
								</h3>
								<p className="text-muted-foreground">
									Your API-only Rails 8 app is up on localhost:3000.
								</p>
								<Button onClick={handleComplete}>
									Complete Level
								</Button>
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
								{database === 'postgresql' ? (
									<div className="text-muted-foreground">
										<span className="text-success font-medium">PostgreSQL</span>{' '}
										— Can scale to sharding in Act VII
									</div>
								) : (
									<div className="text-muted-foreground">
										<span className="text-warning font-medium">SQLite</span> —
										Cannot shard (Level 49 blocked)
									</div>
								)}
								<div className="text-muted-foreground">
									<span className="text-success font-medium">API-only</span> —
									Lean JSON endpoints, no view layer
								</div>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								Drag a database to see your choices
							</p>
						)}
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level1StackChoice;

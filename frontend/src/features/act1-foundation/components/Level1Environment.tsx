/**
 * Level 1: The Environment
 *
 * 4-step progression to set up a Ruby/Rails dev environment with asdf.
 * Steps: Install asdf → Configure .tool-versions → Install Ruby → Install Rails
 */

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

const STEP_DEFS: StepDef[] = [
	{ id: 'install-asdf', title: 'Install asdf' },
	{ id: 'tool-versions', title: 'Configure .tool-versions' },
	{ id: 'install-ruby', title: 'Install Ruby' },
	{ id: 'install-rails', title: 'Install Rails' },
];

type ToolVersionFormat = 'correct' | 'capitalized' | 'yaml' | 'hyphen' | null;

const FORMAT_OPTIONS: {
	id: ToolVersionFormat;
	label: string;
	color: 'green' | 'blue' | 'amber' | 'rose';
	description: string;
	correct: boolean;
	feedback: string;
}[] = [
	{
		id: 'capitalized',
		label: 'Ruby 3.3.6',
		color: 'blue',
		description: 'PascalCase plugin name',
		correct: false,
		feedback:
			'asdf plugin names are always lowercase — "Ruby" won\'t be recognized.',
	},
	{
		id: 'yaml',
		label: 'ruby: 3.3.6',
		color: 'amber',
		description: 'Colon-separated like YAML',
		correct: false,
		feedback:
			'.tool-versions isn\'t YAML — colons are not part of the format.',
	},
	{
		id: 'correct',
		label: 'ruby 3.3.6',
		color: 'green',
		description: 'Space-separated plugin and version',
		correct: true,
		feedback: '',
	},
	{
		id: 'hyphen',
		label: 'ruby-3.3.6',
		color: 'rose',
		description: 'Hyphen-separated',
		correct: false,
		feedback:
			'Hyphens are not the separator in .tool-versions — try a different delimiter.',
	},
];

export function Level1Environment({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);

	// Step 1: Install asdf commands
	const asdfCommands: TerminalCommand[] = [
		{
			id: 'wrong-apt',
			label: 'apt-get install asdf',
			command: 'apt-get install asdf',
			correct: false,
			feedback:
				'apt-get is a Linux package manager — not available on macOS.',
		},
		{
			id: 'correct',
			label: 'brew install asdf',
			command: 'brew install asdf',
			correct: true,
		},
		{
			id: 'wrong-npm',
			label: 'npm install -g asdf',
			command: 'npm install -g asdf',
			correct: false,
			feedback:
				"asdf isn't a Node package — it's a system tool, not an npm module.",
		},
	];

	const asdfOutput: TerminalOutputLine[] = [
		{ text: '==> Downloading asdf...', color: 'cyan' },
		{ text: '==> Installing asdf', color: 'green' },
		{ text: '==> Adding asdf to shell profile', color: 'green' },
		{ text: '✓ asdf installed (v0.14.0)', color: 'green' },
	];

	// Step 3: Install Ruby commands
	const rubyCommands: TerminalCommand[] = [
		{
			id: 'wrong-brew',
			label: 'brew install ruby',
			command: 'brew install ruby',
			correct: false,
			feedback:
				"A system-installed Ruby won't read .tool-versions — you need the version manager to handle it.",
		},
		{
			id: 'wrong-ruby',
			label: 'ruby install 3.3.6',
			command: 'ruby install 3.3.6',
			correct: false,
			feedback:
				'That\'s not a valid command. Which tool manages your versions?',
		},
		{
			id: 'correct',
			label: 'asdf install ruby',
			command: 'asdf install ruby',
			correct: true,
		},
	];

	const rubyOutput: TerminalOutputLine[] = [
		{ text: 'ruby 3.3.6 is being installed...', color: 'cyan' },
		{ text: 'Downloading ruby-3.3.6.tar.gz...', color: 'muted' },
		{ text: 'Compiling Ruby 3.3.6...', color: 'muted' },
		{ text: '✓ ruby 3.3.6 installed', color: 'green' },
	];

	// Step 4: Install Rails commands
	const railsCommands: TerminalCommand[] = [
		{
			id: 'wrong-npm',
			label: 'npm install rails',
			command: 'npm install rails',
			correct: false,
			feedback:
				'Rails is Ruby, not Node. Think about how Ruby distributes packages.',
		},
		{
			id: 'correct',
			label: 'gem install rails',
			command: 'gem install rails',
			correct: true,
		},
		{
			id: 'wrong-brew',
			label: 'brew install rails',
			command: 'brew install rails',
			correct: false,
			feedback:
				"Rails isn't a system package — it's distributed through Ruby's own ecosystem.",
		},
	];

	const railsOutput: TerminalOutputLine[] = [
		{ text: 'Fetching rails-8.0.0.gem', color: 'cyan' },
		{ text: 'Installing actionpack-8.0.0...', color: 'muted' },
		{ text: 'Installing activerecord-8.0.0...', color: 'muted' },
		{ text: 'Installing railties-8.0.0...', color: 'muted' },
		{ text: '✓ Successfully installed rails-8.0.0', color: 'green' },
		{ text: '27 gems installed', color: 'green' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level1-environment', {
			stars: stepper.starRating,
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
		return { valid: true, message: 'Dev environment is ready!' };
	};

	// Code preview updates per step
	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep >= 1) {
			files.push({
				filename: '.tool-versions',
				language: 'bash',
				code: 'ruby 3.3.6',
				highlight: [1],
			});
		}

		if (stepper.currentStep >= 2) {
			files.push({
				filename: 'Terminal: ruby --version',
				language: 'bash',
				code: `$ ruby --version
ruby 3.3.6 (2024-11-05) [arm64-darwin24]

$ which ruby
/Users/dev/.asdf/shims/ruby`,
				highlight: [2],
			});
		}

		if (stepper.currentStep >= 3) {
			files.push({
				filename: 'Terminal: rails --version',
				language: 'bash',
				code: `$ rails --version
Rails 8.0.0`,
				highlight: [2],
			});
			files.push({
				filename: 'Gemfile (skeleton)',
				language: 'ruby',
				code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "puma", ">= 5.0"

# Rails 8 defaults
gem "solid_queue"
gem "solid_cache"
gem "solid_cable"`,
				highlight: [3],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'setup.sh',
				language: 'bash',
				code: `# Step 1: Install a version manager
# asdf lets you manage Ruby, Node, Python
# — all from one tool.`,
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
							Before writing any code, you need Ruby and Rails on your machine.
							Use <span className="font-mono text-primary">asdf</span> to
							manage versions — it keeps every project pinned to the exact Ruby
							it needs.
						</p>
					</div>

					{/* Step Progress */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Step 2: .tool-versions format options */}
					{stepper.currentStep === 1 && (
						<div className="p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Pick the correct format
							</div>
							<div className="space-y-2">
								{FORMAT_OPTIONS.map((opt) => (
									<OptionCard
										key={opt.id}
										color={opt.color}
										description={opt.description}
										name={opt.label}
										size="lg"
										onClick={() => {
											if (opt.correct) {
												stepper.completeStep();
											} else {
												stepper.recordWrongAttempt(opt.feedback);
											}
										}}
									/>
								))}
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The Environment"
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
						{/* Step 1: Install asdf */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Install asdf
								</h3>
								<p className="text-sm text-muted-foreground">
									asdf is a version manager that handles Ruby, Node, Python,
									and more — all with one tool. How do you install it on
									macOS?
								</p>
								<SimulatedTerminal
									commands={asdfCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={asdfOutput}
								/>
							</div>
						)}

						{/* Step 2: Configure .tool-versions */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Configure .tool-versions
								</h3>
								<p className="text-sm text-muted-foreground">
									The{' '}
									<span className="font-mono text-primary">
										.tool-versions
									</span>{' '}
									file pins your project to a specific Ruby version. Pick the
									correct format from the left panel.
								</p>
								<div className="bg-card border border-border rounded-lg p-6 text-center">
									<div className="font-mono text-lg text-muted-foreground mb-2">
										.tool-versions
									</div>
									<div className="text-sm text-muted-foreground">
										Select the correct format from the panel on the left
									</div>
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: Install Ruby */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Install Ruby
								</h3>
								<p className="text-sm text-muted-foreground">
									Your{' '}
									<span className="font-mono text-primary">
										.tool-versions
									</span>{' '}
									says{' '}
									<span className="font-mono text-primary">ruby 3.3.6</span>.
									Now install it through asdf so it reads that file
									automatically.
								</p>
								<SimulatedTerminal
									commands={rubyCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={rubyOutput}
								/>
							</div>
						)}

						{/* Step 4: Install Rails (stays visible after completion) */}
						{stepper.currentStep >= 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Install Rails
								</h3>
								<p className="text-sm text-muted-foreground">
									Ruby is installed. Now you need the Rails framework. How
									does Ruby distribute its packages?
								</p>
								<SimulatedTerminal
									commands={railsCommands}
									completed={stepper.isComplete}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={railsOutput}
								/>
							</div>
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

export default Level1Environment;

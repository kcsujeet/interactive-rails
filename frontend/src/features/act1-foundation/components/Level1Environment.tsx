/**
 * Level 1: The Environment
 *
 * 5-step progression to set up a Ruby/Rails dev environment with asdf.
 * Steps: Install asdf -> Source in .zshrc -> Configure .tool-versions -> Install Ruby -> Install Rails
 */

import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStep,
	type ValidationResult,
} from '@/components/levels';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating } from '@/hooks/useStepGating';

const STEPS: TerminalStep[] = [
	{
		id: 'install-asdf',
		title: 'Install asdf',
		description: (
			<p className="text-sm text-muted-foreground">
				asdf is a version manager that handles Ruby, Node, Python, and
				more, all with one tool. How do you install it on macOS?
			</p>
		),
		commands: [
			{
				id: 'wrong-apt',
				label: 'apt-get install asdf',
				command: 'apt-get install asdf',
				correct: false,
				feedback:
					'apt-get is a Linux package manager, not available on macOS.',
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
					"asdf isn't a Node package. It's a system tool, not an npm module.",
			},
		],
		outputLines: [
			{ text: '==> Downloading asdf...', color: 'cyan' },
			{ text: '==> Installing asdf', color: 'green' },
			{ text: '\u2713 asdf installed (v0.14.0)', color: 'green' },
		],
	},
	{
		id: 'source-asdf',
		title: 'Source asdf in .zshrc',
		description: (
			<p className="text-sm text-muted-foreground">
				asdf is installed, but your shell doesn't know about it yet.
				Which line do you add to{' '}
				<span className="font-mono text-primary">~/.zshrc</span> to load
				asdf on every new terminal session?
			</p>
		),
		commands: [
			{
				id: 'path-only',
				label: 'export PATH="/opt/homebrew/opt/asdf/bin:$PATH"',
				command: 'echo \'export PATH="/opt/homebrew/opt/asdf/bin:$PATH"\' >> ~/.zshrc',
				correct: false,
				feedback:
					"Adding the binary to PATH isn't enough. asdf needs its shell integration sourced to manage shims.",
			},
			{
				id: 'wrong-path',
				label: 'source /usr/local/asdf/asdf.sh',
				command: "echo 'source /usr/local/asdf/asdf.sh' >> ~/.zshrc",
				correct: false,
				feedback:
					'That path is for older Intel Macs. Homebrew on Apple Silicon installs to /opt/homebrew.',
			},
			{
				id: 'correct',
				label: '. /opt/homebrew/opt/asdf/libexec/asdf.sh',
				command: "echo '. /opt/homebrew/opt/asdf/libexec/asdf.sh' >> ~/.zshrc",
				correct: true,
			},
			{
				id: 'alias',
				label: 'alias asdf="/opt/homebrew/bin/asdf"',
				command: "echo 'alias asdf=\"/opt/homebrew/bin/asdf\"' >> ~/.zshrc",
				correct: false,
				feedback:
					'An alias only gives you the command. asdf also needs shell hooks for shim management.',
			},
		],
		outputLines: [
			{ text: '\u2713 Added to ~/.zshrc', color: 'green' },
			{ text: 'Reloading shell...', color: 'muted' },
			{ text: '\u2713 asdf loaded', color: 'green' },
		],
	},
	{
		id: 'tool-versions',
		title: 'Configure .tool-versions',
		description: (
			<p className="text-sm text-muted-foreground">
				The{' '}
				<span className="font-mono text-primary">.tool-versions</span>{' '}
				file pins your project to a specific Ruby version. Pick the
				correct format:
			</p>
		),
		commands: [
			{
				id: 'capitalized',
				label: 'Ruby 3.3.6',
				command: 'echo "Ruby 3.3.6" > .tool-versions',
				correct: false,
				feedback:
					'asdf plugin names are always lowercase. "Ruby" won\'t be recognized.',
			},
			{
				id: 'yaml',
				label: 'ruby: 3.3.6',
				command: 'echo "ruby: 3.3.6" > .tool-versions',
				correct: false,
				feedback:
					".tool-versions isn't YAML. Colons are not part of the format.",
			},
			{
				id: 'hyphen',
				label: 'ruby-3.3.6',
				command: 'echo "ruby-3.3.6" > .tool-versions',
				correct: false,
				feedback:
					'Hyphens are not the separator in .tool-versions. Try a different delimiter.',
			},
			{
				id: 'correct',
				label: 'ruby 3.3.6',
				command: 'echo "ruby 3.3.6" > .tool-versions',
				correct: true,
			},
		],
		outputLines: [
			{ text: '\u2713 .tool-versions created', color: 'green' },
		],
	},
	{
		id: 'install-ruby',
		title: 'Install Ruby',
		description: (
			<p className="text-sm text-muted-foreground">
				Your{' '}
				<span className="font-mono text-primary">.tool-versions</span>{' '}
				says{' '}
				<span className="font-mono text-primary">ruby 3.3.6</span>. Now
				install it through asdf so it reads that file automatically.
			</p>
		),
		commands: [
			{
				id: 'wrong-brew',
				label: 'brew install ruby',
				command: 'brew install ruby',
				correct: false,
				feedback:
					"A system-installed Ruby won't read .tool-versions. You need the version manager to handle it.",
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
		],
		outputLines: [
			{ text: 'ruby 3.3.6 is being installed...', color: 'cyan' },
			{ text: 'Downloading ruby-3.3.6.tar.gz...', color: 'muted' },
			{ text: 'Compiling Ruby 3.3.6...', color: 'muted' },
			{ text: '\u2713 ruby 3.3.6 installed', color: 'green' },
		],
	},
	{
		id: 'install-rails',
		title: 'Install Rails',
		description: (
			<p className="text-sm text-muted-foreground">
				Ruby is installed. Now you need the Rails framework. How does Ruby
				distribute its packages?
			</p>
		),
		commands: [
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
					"Rails isn't a system package. It's distributed through Ruby's own ecosystem.",
			},
		],
		outputLines: [
			{ text: 'Fetching rails-8.0.0.gem', color: 'cyan' },
			{ text: 'Installing actionpack-8.0.0...', color: 'muted' },
			{ text: 'Installing activerecord-8.0.0...', color: 'muted' },
			{ text: 'Installing railties-8.0.0...', color: 'muted' },
			{ text: '\u2713 Successfully installed rails-8.0.0', color: 'green' },
			{ text: '27 gems installed', color: 'green' },
		],
	},
];

function getCodeFiles({ furthestStep }: { furthestStep: number }) {
	const files = [];

	// ~/.zshrc is edited after sourcing asdf (step 1)
	if (furthestStep >= 2) {
		files.push({
			filename: '~/.zshrc',
			language: 'bash',
			code: `# asdf version manager
. /opt/homebrew/opt/asdf/libexec/asdf.sh`,
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: '.tool-versions',
			language: 'bash',
			code: 'ruby 3.3.6',
			highlight: [1],
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'Gemfile (global)',
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
			filename: 'Dev Environment',
			language: 'bash',
			code: `# Your dev environment is empty.
# Install a version manager to get started.`,
			highlight: [],
		});
	}

	return files;
}

export function Level1Environment({ onComplete, onExit }: LevelComponentProps) {
	const stepDefs = STEPS.map((s) => ({ id: s.id, title: s.title }));
	const stepper = useStepGating(stepDefs, { autoAdvance: false });

	const currentConfig = STEPS[stepper.currentStep];

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
		return { valid: true, message: 'Dev environment is ready!' };
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Before writing any code, you need Ruby and Rails on your machine.
							Use <span className="font-mono text-primary">asdf</span> to
							manage versions. It keeps every project pinned to the exact Ruby
							it needs.
						</p>
					</div>

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
						{currentConfig && (
							<TerminalChoiceStep
								commands={currentConfig.commands}
								completed={stepper.isCurrentStepCompleted}
								description={currentConfig.description}
								hasNext={stepper.currentStep < STEPS.length - 1}
								initialHistory={buildTerminalHistory(
									STEPS,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentConfig.outputLines}
								stepKey={stepper.currentStep}
								title={currentConfig.title}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles({ furthestStep: stepper.furthestStep })}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level1Environment;

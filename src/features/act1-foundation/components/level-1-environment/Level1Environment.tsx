/**
 * Level 1: The Environment
 *
 * 5-step progression to set up a Ruby/Rails dev environment with mise.
 * Steps: Install mise -> Activate in .zshrc -> Configure .mise.toml -> Install Ruby -> Install Rails
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
import { useStepGating } from '@/hooks/useStepGating';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

registerLevelCode('act1-level1-environment', () => []);

const STEPS: TerminalStep[] = [
	{
		id: 'install-mise',
		title: 'Install mise',
		description: (
			<p className="text-sm text-muted-foreground">
				mise is a fast, Rust-based version manager that handles Ruby, Node,
				Python, and more with one tool. How do you install it on macOS?
			</p>
		),
		commands: [
			{
				id: 'wrong-apt',
				label: 'apt-get install mise',
				command: 'apt-get install mise',
				correct: false,
				feedback: 'apt-get is a Linux package manager, not available on macOS.',
			},
			{
				id: 'correct',
				label: 'brew install mise',
				command: 'brew install mise',
				correct: true,
			},
			{
				id: 'wrong-npm',
				label: 'npm install -g mise',
				command: 'npm install -g mise',
				correct: false,
				feedback:
					"mise isn't a Node package. It's a system tool, not an npm module.",
			},
		],
		outputLines: [
			{ text: '==> Downloading mise...', color: 'cyan' },
			{ text: '==> Installing mise', color: 'green' },
			{ text: '\u2713 mise installed (v2026.4.1)', color: 'green' },
		],
	},
	{
		id: 'activate-mise',
		title: 'Activate mise in .zshrc',
		description: (
			<p className="text-sm text-muted-foreground">
				mise is installed, but your shell doesn't know about it yet. Which line
				do you add to <span className="font-mono text-primary">~/.zshrc</span>{' '}
				so mise auto-switches Ruby versions on every terminal session?
			</p>
		),
		commands: [
			{
				id: 'path-only',
				label: 'export PATH="/opt/homebrew/opt/mise/bin:$PATH"',
				command:
					'echo \'export PATH="/opt/homebrew/opt/mise/bin:$PATH"\' >> ~/.zshrc',
				correct: false,
				feedback:
					"Adding the binary to PATH isn't enough. mise needs a shell hook to auto-switch versions when you cd into a project.",
			},
			{
				id: 'wrong-source',
				label: 'source /opt/homebrew/opt/mise/mise.sh',
				command: "echo 'source /opt/homebrew/opt/mise/mise.sh' >> ~/.zshrc",
				correct: false,
				feedback:
					"mise doesn't ship a static shell script to source. Its shell hook is generated dynamically at startup.",
			},
			{
				id: 'correct',
				label: 'eval "$(mise activate zsh)"',
				command: 'echo \'eval "$(mise activate zsh)"\' >> ~/.zshrc',
				correct: true,
			},
			{
				id: 'alias',
				label: 'alias mise="/opt/homebrew/bin/mise"',
				command: 'echo \'alias mise="/opt/homebrew/bin/mise"\' >> ~/.zshrc',
				correct: false,
				feedback:
					'An alias only gives you the command. mise also needs a shell hook so it can auto-switch Ruby versions per directory.',
			},
		],
		outputLines: [
			{ text: '\u2713 Added to ~/.zshrc', color: 'green' },
			{ text: 'Reloading shell...', color: 'muted' },
			{ text: '\u2713 mise activated', color: 'green' },
		],
	},
	{
		id: 'mise-toml',
		title: 'Configure .mise.toml',
		description: (
			<p className="text-sm text-muted-foreground">
				mise reads tool versions from{' '}
				<span className="font-mono text-primary">.mise.toml</span> in your
				project root. As the extension suggests, it uses TOML syntax. Pick the
				correct content:
			</p>
		),
		commands: [
			{
				id: 'yaml',
				label: 'ruby: "3.4.9"',
				command: `printf 'ruby: "3.4.9"\\n' > .mise.toml`,
				correct: false,
				feedback: "That's YAML syntax. TOML uses `=`, not `:`.",
			},
			{
				id: 'tool-versions-style',
				label: 'ruby 3.4.9',
				command: `printf 'ruby 3.4.9\\n' > .mise.toml`,
				correct: false,
				feedback:
					"That's the old asdf/.tool-versions format. A .toml file needs proper TOML syntax.",
			},
			{
				id: 'no-section',
				label: 'ruby = "3.4.9"',
				command: `printf 'ruby = "3.4.9"\\n' > .mise.toml`,
				correct: false,
				feedback:
					"Valid TOML, but mise won't treat a bare top-level key as a tool declaration. It needs to live under the right grouping.",
			},
			{
				id: 'correct',
				label: '[tools] > ruby = "3.4.9"',
				command: `printf '[tools]\\nruby = "3.4.9"\\n' > .mise.toml`,
				correct: true,
			},
		],
		outputLines: [{ text: '\u2713 .mise.toml created', color: 'green' }],
	},
	{
		id: 'install-ruby',
		title: 'Install Ruby',
		description: (
			<p className="text-sm text-muted-foreground">
				Your <span className="font-mono text-primary">.mise.toml</span> pins{' '}
				<span className="font-mono text-primary">ruby 3.4.9</span>. Now install
				it through the version manager so it reads that file automatically.
			</p>
		),
		commands: [
			{
				id: 'wrong-brew',
				label: 'brew install ruby',
				command: 'brew install ruby',
				correct: false,
				feedback:
					"A system-installed Ruby won't read .mise.toml. You need the version manager to handle it.",
			},
			{
				id: 'wrong-ruby',
				label: 'ruby install 3.4.9',
				command: 'ruby install 3.4.9',
				correct: false,
				feedback:
					"That's not a valid command. Which tool manages your versions?",
			},
			{
				id: 'correct',
				label: 'mise install',
				command: 'mise install',
				correct: true,
			},
		],
		outputLines: [
			{ text: 'ruby 3.4.9 is being installed...', color: 'cyan' },
			{ text: 'Downloading ruby-3.4.9.tar.gz...', color: 'muted' },
			{ text: 'Compiling Ruby 3.4.9...', color: 'muted' },
			{ text: '\u2713 ruby 3.4.9 installed', color: 'green' },
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
			{ text: 'Fetching rails-8.1.3.gem', color: 'cyan' },
			{ text: 'Installing actionpack-8.1.3...', color: 'muted' },
			{ text: 'Installing activerecord-8.1.3...', color: 'muted' },
			{ text: 'Installing railties-8.1.3...', color: 'muted' },
			{ text: '\u2713 Successfully installed rails-8.1.3', color: 'green' },
			{ text: '27 gems installed', color: 'green' },
		],
	},
];

function getCodeFiles({ furthestStep }: { furthestStep: number }) {
	const files = [];

	// ~/.zshrc is edited after activating mise (step 1)
	if (furthestStep >= 2) {
		files.push({
			filename: '~/.zshrc',
			language: 'bash',
			code: `# mise version manager
eval "$(mise activate zsh)"`,
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: '.mise.toml',
			language: 'toml',
			code: `[tools]
ruby = "3.4.9"`,
			highlight: [2],
		});
	}

	if (furthestStep >= 5) {
		files.push({
			filename: 'Verify',
			language: 'bash',
			code: `# Check the Rails CLI is on your PATH
$ rails --version
Rails 8.1.3

# You now have:
#   ruby 3.4.9 (managed by mise)
#   rails 8.1.3 (installed as a system gem)
#
# Next: rails new <appname> creates a project,
# which generates its own Gemfile listing the
# gems that project depends on. There is no
# global Gemfile -- Gemfiles live per-project.`,
			highlight: [2],
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

export function Level1Environment({ onComplete }: LevelComponentProps) {
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
							Use a version manager to keep every project pinned to the exact
							Ruby it needs.
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

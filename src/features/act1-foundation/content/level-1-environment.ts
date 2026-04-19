import type { Level } from '@/types';

export const level1Environment: Level = {
	id: 'act1-level1-environment',
	actId: 1,
	levelNumber: 1,
	name: 'The Environment',
	trigger: {
		type: 'initialization',
		description:
			'Before writing any code, set up your dev environment: install a version manager, activate it in your shell, pin Ruby in a project config file, install Ruby, and install Rails.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'No Ruby or Rails installed. You need a version manager and the right tools before creating any project.',
		rootCause: 'No development environment configured.',
		codeExample: `# A Rails project needs:
# 1. A version manager, so every project
#    uses the exact Ruby version it was built with
# 2. Ruby (the language)
# 3. Rails (the framework, installed as a Ruby gem)
#
# A project config file pins the version per-project.
# The version manager reads this file and switches
# to the correct Ruby automatically when you cd in.`,
		goal: 'Set up a version manager, pin Ruby and Rails versions for the project, and install the Rails framework.',
		thresholds: {},
	},
	successConditions: [{ type: 'slot_filled', slotId: 'environment-ready' }],
	availableNodes: [],
	unlockedNodes: [],
	darkCanvas: true,
	learningContent: {
		title: 'Ruby/Rails Development Environment',
		goal: `In this level, you'll:\n- set up your Ruby on Rails development environment from scratch.\n- use a version manager that pins exact Ruby versions per project.\n- configure a version file and install Ruby through the version manager.\n- install the Rails framework as a Ruby gem.`,
		conceptExplanation: `Setting up a consistent dev environment is the first step in any Rails project.

**Why mise?**
- Written in Rust, so it's fast and has no shell startup overhead
- Manages multiple runtime versions (Ruby, Node, Python, etc.) with one tool
- Per-project version pinning via \`.mise.toml\`
- Team members always use the same Ruby version
- No conflicts between projects needing different versions
- Ruby support is built in, no separate plugin install

**The .mise.toml file:**
- Lives in your project root
- TOML syntax with tools declared under \`[tools]\`
- mise reads it automatically when you \`cd\` into the directory
- Also supports per-project env vars and tasks in the same file

**Ruby gems:**
- Rails is distributed as a Ruby gem
- \`gem install rails\` installs the Rails CLI
- The \`rails new\` command then generates project scaffolding`,
		railsCodeExample: `# Install mise (macOS)
brew install mise

# Activate mise in your shell
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# Pin Ruby in project root (.mise.toml)
cat <<EOF > .mise.toml
[tools]
ruby = "3.3.6"
EOF

# Install the pinned Ruby version
mise install

# Verify
ruby --version  # => ruby 3.3.6

# Install Rails
gem install rails
rails --version  # => Rails 8.0.0`,
		commonMistakes: [
			'Installing Ruby via Homebrew directly instead of a version manager (version conflicts across projects)',
			'Putting tool declarations at the top of .mise.toml without a section header',
			'Forgetting to activate mise in your shell after installing it',
		],
		whenToUse:
			'Always set up a version manager and .mise.toml at the start of a new Rails project.',
		furtherReading: [
			{
				title: 'mise-en-place Documentation',
				url: 'https://mise.jdx.dev/',
			},
			{
				title: 'Rails Getting Started',
				url: 'https://guides.rubyonrails.org/getting_started.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Install your version manager with Homebrew on macOS, then declare the Ruby version in .mise.toml under the right TOML section.',
	},
};

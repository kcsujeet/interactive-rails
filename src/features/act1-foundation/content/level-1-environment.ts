import type { Level } from '@/types';

export const level1Environment: Level = {
	id: 'act1-level1-environment',
	actId: 1,
	levelNumber: 1,
	name: 'The Environment',
	trigger: {
		type: 'initialization',
		description:
			'Your machine has no Ruby and no Rails. Before writing a single line of code, you need a setup that locks each project to the Ruby version it was built with -- so checking out an older project years from now still runs.',
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
		goal: 'End with a working Ruby + Rails toolchain that any future project can pin to a specific Ruby version automatically.',
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
ruby = "3.4.9"
EOF

# Install the pinned Ruby version
mise install

# Verify
ruby --version  # => ruby 3.4.9

# Install Rails
gem install rails
rails --version  # => Rails 8.1.3`,
		commonMistakes: [
			'Installing Ruby system-wide so every project shares the same version. Two projects on different Ruby versions then break each other on `cd`.',
			'Stopping after installing the version manager without wiring it into the shell -- the binary works, but the per-project auto-switch never happens.',
			'Skipping the project-level version pin. The first new contributor on a different machine ends up with a different Ruby and finds out at runtime.',
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
		text: 'On macOS, the package manager that handles system tools is the same one most developers use for everything else. Once installed, the version manager needs both an entry in your shell startup and a project file declaring which Ruby this project wants -- otherwise it knows nothing.',
	},
};

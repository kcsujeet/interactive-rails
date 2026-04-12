import type { Level } from '@/types';

export const level1Environment: Level = {
	id: 'act1-level1-environment',
	actId: 1,
	levelNumber: 1,
	name: 'The Environment',
	trigger: {
		type: 'initialization',
		description:
			'Before writing any code, set up your dev environment: install asdf for version management, pin Ruby in .tool-versions, install Ruby, and install Rails.',
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
# 1. A version manager (asdf), so every project
#    uses the exact Ruby version it was built with
# 2. Ruby (the language)
# 3. Rails (the framework, installed as a Ruby gem)
#
# .tool-versions pins the version per-project:
#   ruby 3.3.6
#
# asdf reads this file and installs/switches
# to the correct version automatically.`,
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

**Why asdf?**
- Manages multiple runtime versions (Ruby, Node, Python, etc.)
- Per-project version pinning via \`.tool-versions\`
- Team members always use the same Ruby version
- No conflicts between projects needing different versions

**The .tool-versions file:**
- Lives in your project root
- Space-separated format: \`ruby 3.3.6\`
- asdf reads it automatically when you \`cd\` into the directory

**Ruby gems:**
- Rails is distributed as a Ruby gem
- \`gem install rails\` installs the Rails CLI
- The \`rails new\` command then generates project scaffolding`,
		railsCodeExample: `# Install asdf (macOS)
brew install asdf

# Add Ruby plugin
asdf plugin add ruby

# Create .tool-versions in project root
echo "ruby 3.3.6" > .tool-versions

# Install the pinned Ruby version
asdf install ruby

# Verify
ruby --version  # => ruby 3.3.6

# Install Rails
gem install rails
rails --version  # => Rails 8.0.0`,
		commonMistakes: [
			'Installing Ruby via Homebrew instead of asdf (version conflicts)',
			'Using wrong .tool-versions format (YAML colons, hyphens)',
			'Forgetting to run asdf install after creating .tool-versions',
		],
		whenToUse:
			'Always set up asdf and .tool-versions at the start of a new Rails project.',
		furtherReading: [
			{
				title: 'asdf Version Manager',
				url: 'https://asdf-vm.com/',
			},
			{
				title: 'Rails Getting Started',
				url: 'https://guides.rubyonrails.org/getting_started.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Install asdf with Homebrew, then configure .tool-versions using space-separated format: "ruby 3.3.6".',
	},
};

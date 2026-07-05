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
		goal: `In this level, you'll:\n- set up a Ruby on Rails development environment from scratch.\n- pick a version manager so each project locks to its own Ruby version.\n- write a project-level config file and install the pinned Ruby through the manager.\n- install the Rails framework so the rails CLI is on your PATH.`,
		conceptExplanation: `Setting up a consistent dev environment is the first step in any Rails project.

**Why a version manager:**
- Two projects on the same laptop often need different Ruby versions; a system-wide Ruby breaks one of them on every \`cd\`.
- A version manager keeps multiple Rubies installed side-by-side and switches between them based on a project-level config file.
- The good ones also handle Node, Python, and other runtimes with the same tool, so you only learn one workflow.
- The good ones are written for speed, so the per-shell activation cost is essentially zero.

**The project-level pin:**
- Lives in your project root and is checked into git.
- Names the exact Ruby version the project was built with (e.g. \`3.4.9\`).
- The version manager reads it automatically when you \`cd\` into the directory and switches Ruby for you.
- Without this file, the next contributor's machine picks a different Ruby and surprises them at runtime.

**Ruby gems:**
- Rails itself is distributed as a Ruby gem (a Ruby package).
- Installing the Rails gem puts the \`rails\` CLI on your PATH.
- From there, \`rails new myapp\` generates a fresh project skeleton.`,
		railsCodeExample: `# After completing this level you will have run something like:
# 1. installed a version manager via your OS package manager
# 2. wired the version manager into your shell startup
# 3. created a project-level config file pinning Ruby to a specific version
# 4. installed that pinned Ruby through the version manager
# 5. installed the Rails framework gem

# Verify (after the level):
ruby --version  # => ruby 3.4.9
rails --version # => Rails 8.1.3`,
		commonMistakes: [
			'Installing Ruby system-wide so every project shares the same version. Two projects on different Ruby versions then break each other on `cd`.',
			'Stopping after installing the version manager without wiring it into the shell -- the binary works, but the per-project auto-switch never happens.',
			'Skipping the project-level version pin. The first new contributor on a different machine ends up with a different Ruby and finds out at runtime.',
		],
		whenToUse:
			'Always set up a version manager and a project-level Ruby pin at the start of a new Rails project.',
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
		homework: [
			{
				task: 'Install mise on your own machine and confirm it responds.',
				commands: ['brew install mise', 'mise --version'],
				verify: 'mise prints its version number.',
			},
			{
				task: 'Create a practice folder, pin Ruby to it, and confirm the pinned version is the one your shell now uses.',
				commands: [
					'mkdir rails-practice && cd rails-practice',
					'mise use ruby@3.4',
					'ruby -v',
				],
				verify:
					'ruby -v prints the 3.4.x version you just pinned, and a mise config file appeared in the folder.',
			},
			{
				task: 'Install Rails into that Ruby.',
				commands: ['gem install rails', 'rails -v'],
				verify: 'rails -v prints a Rails 8 version.',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Pick a version manager that ships per-project Ruby pinning, then ensure two pieces are in place: a shell-startup hook that activates it, and a project-root file declaring which Ruby this project wants. Either one missing and the auto-switch never happens.',
	},
};

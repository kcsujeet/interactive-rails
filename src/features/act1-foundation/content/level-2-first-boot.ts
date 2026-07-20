import type { Level } from '@/types';

export const level2FirstBoot: Level = {
	id: 'act1-level2-first-boot',
	actId: 1,
	levelNumber: 2,
	name: 'First Boot',
	trigger: {
		type: 'initialization',
		description:
			'Ruby and Rails are on your machine, but no application exists yet. Your job: stand up a JSON-only Rails project, pick a database that can handle multiple users hitting it at once, and have it responding on http://localhost:3000.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'No application exists yet. You have Ruby and Rails but no project.',
		rootCause: 'No application created yet.',
		codeExample: `# Rails 8 supports two databases out of the box.
# One is single-writer and file-based -- great for prototypes
# and embedded apps, not ideal for concurrent API traffic.
# The other is multi-user with concurrent writes, sharding,
# read replicas, and advanced queries -- the production
# standard for web APIs.
#
# Generating the project also requires telling Rails it is
# an API-only app (no HTML views, leaner middleware stack)
# and pointing it at the chosen database adapter.
#
# Your job: pick the right database, install it, generate
# the project with the right flags, and get the server
# running on http://localhost:3000.`,
		goal: 'End with a Rails server running locally that responds to /up with 200 OK, on a database that can serve concurrent API traffic.',
		thresholds: {},
	},
	successConditions: [{ type: 'slot_filled', slotId: 'database-slot' }],
	availableNodes: ['postgres', 'sqlite'],
	unlockedNodes: [
		'request',
		'router',
		'controller',
		'model',
		'database',
		'response',
		'serializer',
	],
	slots: [
		{
			id: 'database-slot',
			label: 'Database System',
			acceptTypes: ['postgres', 'sqlite'],
			required: true,
			position: { x: 500, y: 200 },
		},
	],
	darkCanvas: true,
	learningContent: {
		title: 'Rails 8 API Application',
		goal: `In this level, you'll:\n- create your first Rails 8 application.\n- pick the database engine that fits a production API serving concurrent traffic.\n- generate the project with the right flags so it boots in JSON-only mode.\n- see how Rails 8 ships database-backed adapters for jobs, caching, and WebSockets so a fresh app no longer needs a separate Redis.`,
		conceptExplanation: `Rails 8 introduces major changes to the default stack:

**Picking a database:**
- One option is single-writer and file-based. Rails 8 enables WAL mode and IMMEDIATE transactions by default, which is enough for prototypes and single-user tools, but not for an API multiple clients hit at the same time.
- The other option is a battle-tested multi-user database that supports sharding, read replicas, advanced queries, and concurrent writes. That is the standard production choice for web APIs and what the rest of this curriculum assumes.

**JSON-only mode:**
- A flag at project generation strips out HTML view rendering, cookies, sessions, flash, and CSRF middleware that an API never needs.
- The resulting controllers inherit from a leaner base class. Faster responses, fewer moving parts, perfect for React/mobile frontends.
- All of those middleware pieces can be added back later if needed.

**Rails 8 background defaults (no Redis needed):**
- Solid Queue for background jobs
- Solid Cache for caching
- Solid Cable for WebSockets

All three are database-backed, so a fresh Rails 8 app boots without a separate Redis or Memcached.`,
		railsCodeExample: `# After completing this level you will have:
# 1. installed the database server through your OS package manager
# 2. generated a Rails 8 project with the JSON-only flag and the right
#    database adapter
# 3. created the database for your fresh project
# 4. booted the local Rails web server

# Verify (after the level):
curl -I http://localhost:3000/up
# => HTTP/1.1 200 OK`,
		commonMistakes: [
			'Skipping the JSON-only flag at generation. The full-stack default brings a stack of HTML / cookie / session middleware that an API never uses, slowing every request.',
			'Trying to run the migration step before the database physically exists -- migrations expect to connect to a live database and only manage its schema.',
			'Reaching for an unfamiliar verb when the canonical Rails CLI command for booting a web server is right there in the Rails Guides.',
		],
		whenToUse:
			'A multi-user database for any app serving concurrent users. Single-writer file-based databases only for single-user or embedded apps.',
		furtherReading: [
			{
				title: 'Rails Getting Started',
				url: 'https://guides.rubyonrails.org/getting_started.html',
			},
			{
				title: 'Rails 8 Release Notes',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
		],
		homework: [
			{
				task: 'Inside your rails-practice folder, create a real API-only Rails app.',
				commands: [
					'rails new store_api --api --database=postgresql',
					'cd store_api',
				],
				verify:
					'A store_api directory exists with app/, config/, db/, and a Gemfile inside.',
			},
			{
				task: 'Boot the server and see the app respond, then stop it.',
				commands: ['bin/rails server'],
				verify:
					'http://localhost:3000 shows the Rails welcome screen. Ctrl+C stops the server.',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Two databases ship with Rails 8: one is single-writer and great for prototypes, one handles concurrent writes and is what production APIs run on. Pick for your traffic shape, then install the database server itself before generating the project.',
	},
};

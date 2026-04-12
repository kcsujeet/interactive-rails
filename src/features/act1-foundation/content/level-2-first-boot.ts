import type { Level } from '@/types';

export const level2FirstBoot: Level = {
	id: 'act1-level2-first-boot',
	actId: 1,
	levelNumber: 2,
	name: 'First Boot',
	trigger: {
		type: 'initialization',
		description:
			'Ruby and Rails are installed. Now create your first application: choose PostgreSQL over SQLite, install it, generate an API-only project, create the database, and boot the server.',
	},
	startingPipeline: {
		nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
		connections: [],
	},
	problem: {
		observation:
			'No application exists yet. You have Ruby and Rails but no project.',
		rootCause: 'No application created yet.',
		codeExample: `# Rails 8 supports two databases out of the box:
#
# PostgreSQL:
#   - Multi-user, concurrent writes
#   - Sharding, read replicas, advanced queries
#   - The production standard for web APIs
#
# SQLite:
#   - Single-writer, file-based
#   - Great for prototypes and embedded apps
#   - Not ideal for concurrent API requests
#
# The --api flag creates a lean app:
#   ActionController::API (leaner middleware stack)
#
# Your job: pick the right database, install it,
# generate the project, and get the server running.`,
		goal: 'Choose a production-grade database, install it, generate an API-only Rails project, create the database, and boot the server.',
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
		goal: `In this level, you'll:\n- create your first Rails 8 application.\n- learn which database engine is the go-to choice for production APIs.\n- generate an API-only project with the right flags.\n- discover how Rails 8 replaces Redis with database-backed adapters for jobs, caching, and WebSockets.`,
		conceptExplanation: `Rails 8 introduces major changes to the default stack:

**PostgreSQL vs SQLite:**
- PostgreSQL: Battle-tested, supports sharding, read replicas, advanced queries, concurrent writes
- SQLite: Rails 8 enables WAL mode and IMMEDIATE transactions by default, but it's still single-writer

**API-only mode (\`--api\`):**
- Inherits from \`ActionController::API\` instead of \`ActionController::Base\`
- Skips cookie, session, and flash middleware by default (can be added back)
- Lighter middleware stack, faster responses
- Perfect for React/mobile frontends

**Rails 8 Defaults (no Redis needed):**
- Solid Queue for background jobs
- Solid Cache for caching
- Solid Cable for WebSockets`,
		railsCodeExample: `# Install PostgreSQL
brew install postgresql@17

# Create a new Rails 8 API app
rails new myapp --api --database=postgresql

# Create the database
cd myapp
rails db:create

# Boot the server
rails server

# Test it
curl -I http://localhost:3000/up
# => HTTP/1.1 200 OK`,
		commonMistakes: [
			'Choosing SQLite for a multi-user API (single-writer limitation)',
			'Forgetting --api flag (includes unnecessary browser middleware)',
			'Running db:migrate before db:create',
			'Using "rails start" instead of "rails server"',
		],
		whenToUse:
			'PostgreSQL for any app serving concurrent users. SQLite only for single-user or embedded apps.',
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
	},
	hint: {
		delay: 30,
		text: 'PostgreSQL handles concurrent writes, so pick it for a multi-user API. Install the server with Homebrew before generating the project.',
	},
};

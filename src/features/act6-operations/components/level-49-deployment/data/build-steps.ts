import type { TerminalStepData } from '@/components/levels';
import { shuffleOptions } from '@/lib/shuffleOptions';

export const STEP_DEFS = [
	{ id: 'add-kamal', title: 'Add Kamal to the project' },
	{ id: 'kamal-init', title: 'Generate deploy config' },
	{ id: 'deploy-yml', title: 'Configure config/deploy.yml' },
	{ id: 'kamal-secrets', title: 'Wire .kamal/secrets' },
	{ id: 'kamal-setup', title: 'Run the first deploy' },
];

export const ADD_KAMAL_COMMANDS = [
	{
		id: 'wrong-brew',
		label: 'brew install kamal',
		command: 'brew install kamal',
		correct: false,
		feedback:
			'Kamal is a Ruby gem, not a system package. Homebrew will not find it in its formula index.',
	},
	{
		id: 'wrong-cap',
		label: 'bundle add capistrano',
		command: 'bundle add capistrano',
		correct: false,
		feedback:
			'Capistrano is a different deploy tool, not the Rails 8 default. Add the tool Rails 8 actually ships with.',
	},
	{
		id: 'correct',
		label: 'bundle add kamal',
		command: 'bundle add kamal',
		correct: true,
	},
];

export const KAMAL_INIT_COMMANDS = [
	{
		id: 'wrong-generate',
		label: 'bin/rails generate deploy',
		command: 'bin/rails generate deploy',
		correct: false,
		feedback:
			'Rails has no deploy generator. The scaffolding comes from the deploy tool itself, not `rails generate`.',
	},
	{
		id: 'wrong-new',
		label: 'kamal new',
		command: 'kamal new',
		correct: false,
		feedback:
			'That is not a Kamal subcommand. Scaffolding an existing project uses a different verb.',
	},
	{
		id: 'correct',
		label: 'kamal init',
		command: 'kamal init',
		correct: true,
	},
];

export const DEPLOY_YML_OPTIONS = [
	{
		id: 'no-proxy',
		label: 'Config without a proxy block',
		code: `service: my_app
image: my-org/my-app
servers:
  web:
    - 192.0.2.10
registry:
  server: ghcr.io
  username: kamal
  password:
    - KAMAL_REGISTRY_PASSWORD`,
		correct: false,
		feedback:
			'Without a proxy block Kamal cannot health-gate traffic, so a broken container will start serving requests immediately.',
	},
	{
		id: 'literal-password',
		label: 'Config with the registry password inlined',
		code: `service: my_app
image: my-org/my-app
servers:
  web:
    - 192.0.2.10
registry:
  server: ghcr.io
  username: kamal
  password: sk_live_hunter2
proxy:
  ssl: true
  host: app.example.com`,
		correct: false,
		feedback:
			'deploy.yml is committed to the repo. Anything written as a literal here ends up in git history.',
	},
	{
		id: 'correct',
		label: 'Config with servers, registry, and a health-gated proxy',
		code: `service: my_app
image: my-org/my-app
servers:
  web:
    - 192.0.2.10
    - 192.0.2.11
proxy:
  ssl: true
  host: app.example.com
  healthcheck:
    path: /up
registry:
  server: ghcr.io
  username: kamal
  password:
    - KAMAL_REGISTRY_PASSWORD`,
		correct: true,
	},
	{
		id: 'no-servers',
		label: 'Config without a servers list',
		code: `service: my_app
image: my-org/my-app
proxy:
  ssl: true
  host: app.example.com
registry:
  server: ghcr.io
  username: kamal
  password:
    - KAMAL_REGISTRY_PASSWORD`,
		correct: false,
		feedback:
			'With no servers declared, the tool has nothing to deploy to. The config describes where the app is going, and that list is missing.',
	},
];

export const SECRETS_OPTIONS = [
	{
		id: 'literal',
		label: 'Paste the master key directly into the file',
		code: `KAMAL_REGISTRY_PASSWORD=ghp_hunter2
RAILS_MASTER_KEY=abcd1234deadbeef
DATABASE_URL=postgres://user:pass@db.example.com/app`,
		correct: false,
		feedback:
			'That file is read from disk at deploy time. Embedding the raw secrets makes them leak through backups, shell history, and teammates watching you share your screen.',
	},
	{
		id: 'ruby-env',
		label: 'Use Ruby ENV[...] lookups',
		code: `KAMAL_REGISTRY_PASSWORD=ENV["KAMAL_REGISTRY_PASSWORD"]
RAILS_MASTER_KEY=ENV["RAILS_MASTER_KEY"]
DATABASE_URL=ENV["DATABASE_URL"]`,
		correct: false,
		feedback:
			'This file is evaluated as a shell-style env file, not Ruby. ENV[...] is a Ruby expression that never gets resolved here.',
	},
	{
		id: 'correct',
		label: 'Reference env vars and shell commands that resolve at deploy time',
		code: `KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
DATABASE_URL=$(op read "op://prod/app/DATABASE_URL")`,
		correct: true,
	},
	{
		id: 'empty',
		label: 'Leave the secrets file empty and set values in deploy.yml',
		code: `# deploy.yml handles secrets now
# (file intentionally left blank)`,
		correct: false,
		feedback:
			'deploy.yml is committed. Moving secret values there just relocates the leak into git history.',
	},
];

export const KAMAL_SETUP_COMMANDS = [
	{
		id: 'wrong-deploy',
		label: 'kamal deploy',
		command: 'kamal deploy',
		correct: false,
		feedback:
			'This command assumes the servers are already prepared. For the very first deploy on a brand-new host, something else has to install Docker and log in to the registry first.',
	},
	{
		id: 'wrong-push',
		label: 'kamal push',
		command: 'kamal push',
		correct: false,
		feedback:
			'Pushing builds and ships the image but does not prepare a fresh host. The first-run command does more than that.',
	},
	{
		id: 'correct',
		label: 'kamal setup',
		command: 'kamal setup',
		correct: true,
	},
];

const KAMAL_SETUP_OUTPUT: Array<{
	text: string;
	color?: 'default' | 'green' | 'yellow' | 'red' | 'cyan' | 'muted';
}> = [
	{ text: 'Ensuring Docker is installed on 192.0.2.10...', color: 'muted' },
	{ text: 'Ensuring Docker is installed on 192.0.2.11...', color: 'muted' },
	{ text: 'Logging in to ghcr.io on all servers...', color: 'muted' },
	{ text: 'Building image my-org/my-app:abc123...', color: 'cyan' },
	{ text: 'Pushing image to ghcr.io...', color: 'cyan' },
	{
		text: 'Starting container on 192.0.2.10 (healthcheck: /up)...',
		color: 'muted',
	},
	{ text: 'Healthy. Shifting traffic.', color: 'green' },
	{
		text: 'Starting container on 192.0.2.11 (healthcheck: /up)...',
		color: 'muted',
	},
	{ text: 'Healthy. Shifting traffic.', color: 'green' },
	{ text: '\u2713 App live at https://app.example.com', color: 'green' },
];

export const TERMINAL_STEP_MAP: Array<TerminalStepData | null> = [
	{
		commands: shuffleOptions(ADD_KAMAL_COMMANDS, 0),
		outputLines: [
			{ text: 'Resolving dependencies...', color: 'muted' },
			{ text: 'Added kamal (2.3.0)', color: 'green' },
		],
	},
	{
		commands: shuffleOptions(KAMAL_INIT_COMMANDS, 1),
		outputLines: [
			{ text: 'Created config/deploy.yml', color: 'green' },
			{ text: 'Created .kamal/secrets', color: 'green' },
		],
	},
	null,
	null,
	{
		commands: shuffleOptions(KAMAL_SETUP_COMMANDS, 4),
		outputLines: KAMAL_SETUP_OUTPUT,
	},
];

export function describeStep(step: number): string {
	switch (step) {
		case 0:
			return 'Rails 8 has a default deployment tool. Bring it into the project as a gem.';
		case 1:
			return 'Scaffold the two files the deploy tool needs: a manifest and a secrets reference.';
		case 2:
			return 'Pick the deploy manifest that declares servers, routes traffic through a proxy with a health check, and keeps secrets out of the committed file.';
		case 3:
			return 'Pick the secrets file that resolves values at deploy time instead of storing them in plaintext.';
		case 4:
			return 'The first deploy has to prepare brand-new hosts. Later deploys do not. Pick the first-run command.';
		default:
			return '';
	}
}

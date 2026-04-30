import { registerLevelCode } from '@/lib/codebase-registry';
import { STEP_DEFS } from './build-steps';

interface CodeFile {
	filename: string;
	language: string;
	code: string;
}

export function getCodeFiles(
	phase: 'observe' | 'build' | 'reward',
	completedStep: number,
): CodeFile[] {
	if (phase === 'observe') {
		return [
			{
				filename: 'bin/deploy.sh',
				language: 'bash',
				code: `#!/usr/bin/env bash
# Current deploy playbook. Runs from a developer's laptop.
set -e

scp -r . user@prod:/var/www/app
ssh user@prod "cd /var/www/app && bundle install"
ssh user@prod "systemctl restart puma"
# ~8 seconds of 502s during every restart.
# Rollback = do the whole thing again with a previous git sha.`,
			},
		];
	}

	if (phase === 'reward') return rewardCodeFiles();

	const files: CodeFile[] = [];

	if (completedStep >= 1) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "kamal", "~> 2.0"
gem "puma"`,
		});
	}

	if (completedStep >= 2) {
		files.push({
			filename: 'config/deploy.yml',
			language: 'yaml',
			code: `# Scaffolded by 'kamal init'. Fill in the essentials.
service: my_app
image:
servers:
registry:
proxy:
env:`,
		});
	}

	if (completedStep >= 3) {
		files.push({
			filename: 'config/deploy.yml',
			language: 'yaml',
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
    - KAMAL_REGISTRY_PASSWORD
env:
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_URL`,
		});
	}

	if (completedStep >= 4) {
		files.push({
			filename: '.kamal/secrets',
			language: 'bash',
			code: `# References resolved at deploy time. No literal secrets here.
KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
DATABASE_URL=$(op read "op://prod/app/DATABASE_URL")`,
		});
	}

	if (files.length === 0) {
		files.push({
			filename: 'project root',
			language: 'bash',
			code: `# No deployment tooling yet.
# Add Kamal to the Gemfile to begin.`,
		});
	}

	return files;
}

function rewardCodeFiles(): CodeFile[] {
	return [
		{
			filename: 'Gemfile',
			language: 'ruby',
			code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "kamal", "~> 2.0"
gem "puma"`,
		},
		{
			filename: 'config/deploy.yml',
			language: 'yaml',
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
    - KAMAL_REGISTRY_PASSWORD
env:
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_URL`,
		},
		{
			filename: '.kamal/secrets',
			language: 'bash',
			code: `KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
DATABASE_URL=$(op read "op://prod/app/DATABASE_URL")`,
		},
		{
			filename: 'bin/deploy (commands)',
			language: 'bash',
			code: `# First time, per host (once):
kamal setup

# Every release after that:
kamal deploy

# Something bad slipped through?
kamal rollback <previous-sha>`,
		},
	];
}

registerLevelCode('act6-level49-deployment', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

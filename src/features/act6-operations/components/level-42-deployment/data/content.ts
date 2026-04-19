import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level42Deployment: Level = {
	id: 'act6-level42-deployment',
	actId: 6,
	levelNumber: 42,
	name: 'Deployment',
	trigger: {
		type: 'incident',
		description:
			'The app is feature-complete but still lives on your laptop. Shipping it by hand drops traffic, leaves no rollback path, and breaks the moment you add a second server.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Each release involves scp, ssh, and a systemctl restart. Users see 502s during the restart window. A bad release takes 20 minutes to undo by hand, and there is no record of what was running before.',
		rootCause:
			'No deployment system: no Docker image, no registry, no reverse proxy, no health-gated traffic shift, no rollback.',
		codeExample: `# Day of the release. Your deploy playbook is:

scp -r . user@prod:/var/www/app
ssh user@prod "cd /var/www/app && bundle install"
ssh user@prod "systemctl restart puma"

# Three things go wrong, every time:
#
# 1. The restart takes ~8 seconds. Every request during that
#    window gets a 502 from the load balancer.
#
# 2. If the new release boots but crashes on a missing env var,
#    traffic still routes to it. Users hit 500s until someone
#    notices.
#
# 3. "Rollback" means SSHing in, 'git reset --hard <sha>',
#    bundle install, restart. Another 8-second outage, and
#    no one can tell you what sha was running 30 minutes ago.`,
		goal: 'Replace the manual shell deploy with a reproducible, zero-downtime deployment system that can roll back.',
		thresholds: {},
	},
	successConditions: [{ type: 'zero_downtime_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Deployment with Kamal',
		goal: `In this level, you'll:
- learn how Rails 8 apps ship to production with Kamal.
- generate and configure a deployment manifest for your servers.
- wire secrets so credentials never live in a committed file.
- run a first-time deploy, then an incremental deploy, and understand why they are different.`,
		conceptExplanation: `Kamal is Rails 8's default deployment tool. It packages your app as a Docker image, pushes it to a container registry, pulls it onto your servers over SSH, and rotates containers behind a proxy with a health check before it sends any real traffic to the new release.

**Why Kamal over \`scp\` + \`systemctl\`?**
- The image is reproducible: same SHA locally and in production.
- Traffic only shifts to a new container after it passes a health check, so a broken release cannot serve 500s.
- \`kamal rollback\` re-routes to the previous image tag instantly, no rebuild.
- One command deploys to N servers in a coordinated rotation.

**The two config files:**
- \`config/deploy.yml\` — service name, Docker image, servers, registry, proxy settings. Committed to the repo.
- \`.kamal/secrets\` — references env vars and commands that resolve to secrets at deploy time. Never contains literal secret values.

**Commands you'll meet:**
- \`kamal init\` — scaffolds the two config files.
- \`kamal setup\` — first-time deploy. Installs Docker on the server, logs in to the registry, runs your app.
- \`kamal deploy\` — incremental deploy. Reuses the already-prepared servers.
- \`kamal rollback\` — flip traffic back to the previous image.`,
		railsCodeExample: `# 1. Add Kamal to the project
#    $ bundle add kamal
#    $ kamal init

# config/deploy.yml
service: my_app

image: my-registry.example.com/my-org/my-app

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
  server: my-registry.example.com
  username: kamal-deploy
  password:
    - KAMAL_REGISTRY_PASSWORD

env:
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_URL

# .kamal/secrets
# References resolved at deploy time. No plaintext secrets here.
KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
DATABASE_URL=$(op read "op://prod/app/DATABASE_URL")

# 2. First-time deploy (installs Docker, logs in, rolls out)
#    $ kamal setup

# 3. Every subsequent deploy
#    $ kamal deploy
#    -> builds image, pushes to registry, pulls on each server,
#       boots new container, polls /up, only then stops old one.

# 4. Something went wrong? Roll back to the previous tag.
#    $ kamal rollback <previous-sha>`,
		commonMistakes: [
			'Writing literal passwords in config/deploy.yml instead of referencing them through .kamal/secrets',
			'Shipping without a /up endpoint so the proxy has no way to health-gate a broken release',
			'Running kamal deploy on a brand-new host before kamal setup has prepared it',
			'Assuming the old container keeps running forever — Kamal stops it once the new one is healthy',
		],
		whenToUse:
			'Any Rails 8 app going to real users on one or more Linux servers. Kamal is the default for a reason: it is simple, reproducible, and handles zero-downtime rotations without a PaaS.',
		furtherReading: [
			{
				title: 'Kamal documentation',
				url: 'https://kamal-deploy.org/',
			},
			{
				title: 'Rails 8 release notes: Kamal',
				url: 'https://guides.rubyonrails.org/8_0_release_notes.html',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Start with the gem, then generate the config files, then wire secrets before you run any deploy command.',
	},
};

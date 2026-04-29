import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level48Deployment: Level = {
	id: 'act6-level48-deployment',
	actId: 6,
	levelNumber: 48,
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
- \`config/deploy.yml\`: service name, Docker image, servers, registry, proxy settings. Committed to the repo.
- \`.kamal/secrets\`: references env vars and commands that resolve to secrets at deploy time. Never contains literal secret values.

**Commands you'll meet:**
- \`kamal init\` scaffolds the two config files.
- \`kamal setup\` first-time deploy. Installs Docker on the server, logs in to the registry, runs your app.
- \`kamal deploy\` incremental deploy. Reuses the already-prepared servers.
- \`kamal rollback\` flip traffic back to the previous image.

**Database migrations during deploy:**
A new image is useless if the schema does not match. Two common patterns:

1. **Run migrations from inside the container at boot.** The Rails-generated Dockerfile / startup script runs \`bin/rails db:migrate\` before booting the web server. Idempotent on each rotation. Simplest to set up.
2. **Run migrations explicitly via \`kamal app exec\` after deploy:**
\`\`\`bash
kamal deploy
kamal app exec --reuse 'bin/rails db:migrate'
\`\`\`
Per the Kamal docs, \`kamal app exec\` runs a one-off command inside the app container. The \`--reuse\` flag connects to the currently running container instead of starting a new one ([source](https://kamal-deploy.org/docs/commands/running-commands-on-servers/)).

Either pattern only works if migrations are **backward-compatible** (covered in L44 Safe Migrations). A migration that adds a NOT NULL column without a default will break the old containers the moment it commits. Backward-compatible migrations + Kamal's traffic gate = zero-downtime deploy.

(Kamal also supports lifecycle hooks via \`.kamal/hooks/<name>\` executable files. The official docs describe \`pre-deploy\` as the place for "final checks before deploying, e.g., checking CI completed" rather than a prescribed migrations location, so this curriculum picks one of the two patterns above instead.)

**Accessory containers (workers, scheduler, cache):**
A Rails 8 app does not run as one container. Solid Queue needs a worker process (\`bin/jobs\`), Solid Cable needs the connection adapter, the recurring scheduler needs to be running somewhere. Kamal models these as accessories:

\`\`\`yaml
accessories:
  worker:
    image: my-registry.example.com/my-org/my-app
    cmd: bin/jobs
    host: 192.0.2.10
    env:
      secret:
        - RAILS_MASTER_KEY
        - DATABASE_URL
\`\`\`
The accessory uses the same image as the web service, ensuring the worker and the web app are always at the same SHA. Without an accessory definition, \`perform_later\` queues jobs that nothing ever runs (the most common Rails 8 background-jobs bug, called out in \`rails-conventions.md\`).

**Asset precompilation in the image:**
The Dockerfile runs \`bundle install\` and \`bin/rails assets:precompile\` at build time so the image ships with compiled assets in \`public/assets/\`. Propshaft (Rails 8's default) fingerprints filenames so the same asset can be cached forever. Kamal's proxy serves them with appropriate cache headers. The build is the slow step; runtime startup is fast.

**Image tag immutability:**
Kamal tags images by git SHA (\`my-app:abc123\`). The tag is immutable: once built and pushed, that SHA always points to the same bytes. Rollback is just "point traffic back to the SHA from yesterday." This is the foundation of \`kamal rollback\`. Never re-tag an image (\`docker push my-app:abc123\` after rebuilding); if you do, rollback no longer means what you think.

**Logs and debugging:**
\`\`\`bash
kamal app logs                  # tail logs from the running container
kamal app logs --grep "5xx"     # filter for errors
kamal app exec --interactive    # SSH into the running container shell
kamal app exec "bin/rails runner 'User.count'"  # one-off Rails command
kamal proxy logs                # the load balancer / health-check logs
\`\`\`
You will need these the first time something fails. The wrong move is to SSH the host and \`docker exec\` directly; the right move is the kamal subcommand which respects the deploy lifecycle.

**Multi-environment setup:**
\`\`\`bash
kamal deploy -d staging         # uses config/deploy.staging.yml
kamal deploy -d production      # uses config/deploy.production.yml
\`\`\`
Per-environment files override the base \`config/deploy.yml\`. Different servers, different domains, different secrets, same codebase. Production should run the same image SHA staging just verified.

**Smoke tests after deploy:**
The proxy's \`/up\` healthcheck only proves the boot loop completed and the route returns 200. It doesn't prove the database is reachable, a dependent service is up, or migrations are applied. The Kamal proxy's \`healthcheck\` block only supports \`path\`, \`interval\`, and \`timeout\` ([source: Kamal proxy.rb](https://github.com/basecamp/kamal/blob/main/lib/kamal/configuration/proxy.rb)); it cannot run arbitrary shell commands. For deeper checks, add a \`.kamal/hooks/post-deploy\` executable:

\`\`\`bash
# .kamal/hooks/post-deploy (executable, no extension; shebang determines interpreter)
#!/usr/bin/env bash
set -e
kamal app exec --reuse "bin/rails runner 'raise unless ApplicationRecord.connection.active?'"
kamal app exec --reuse "bin/rails runner 'raise unless Stripe::Account.retrieve.id'"
\`\`\`
\`post-deploy\` runs after the new image is serving traffic. Per the Kamal docs ([hooks overview](https://kamal-deploy.org/docs/hooks/overview/)), if a hook script exits non-zero the command will be aborted. Use this for "boots clean but cannot serve real traffic" failure modes.

**Master key handling:**
\`RAILS_MASTER_KEY\` lives outside the repo in \`config/master.key\` (git-ignored). \`.kamal/secrets\` references it via \`$(cat config/master.key)\`. In CI, expose the key as a CI secret env var; locally, keep it on disk. Never commit the master key, never paste it in deploy.yml, never log it. The encrypted credentials file is useless without it; the master key is the entire trust boundary.`,
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
			'Assuming the old container keeps running forever. Kamal stops it once the new one is healthy',
			'No accessory for the Solid Queue worker. perform_later queues jobs and nothing ever runs them',
			'Running migrations after traffic has shifted instead of before. The new container hits a schema it expects to exist; the old containers still hit the pre-migrated schema',
			'Migrations that are not backward-compatible (NOT NULL without default, column rename, type change). Old containers crash the moment the migration commits',
			'Re-tagging an image SHA after rebuilding (kamal rollback no longer points at the bytes you think it does)',
			'Committing config/master.key or pasting RAILS_MASTER_KEY into deploy.yml. The master key is the entire trust boundary on the encrypted credentials file',
			'Skipping the smoke-test step. /up returning 200 only proves the boot loop completed; a smoke test catches "boots clean but cannot reach the database"',
			'SSHing the host and docker exec-ing directly instead of using kamal app exec. Bypasses the deploy lifecycle and can leave orphaned containers',
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
			{
				title: 'Kamal accessories',
				url: 'https://kamal-deploy.org/docs/configuration/accessories/',
			},
			{
				title: 'Kamal hooks',
				url: 'https://kamal-deploy.org/docs/hooks/overview/',
			},
			{
				title: 'Kamal proxy and SSL',
				url: 'https://kamal-deploy.org/docs/configuration/proxy/',
			},
		],
	},
	hint: {
		delay: 30,
		text: 'Start with the gem, then generate the config files, then wire secrets before you run any deploy command.',
	},
};

import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

export const PROBES: ProbeConfig[] = [
	{
		id: 'scp-restart',
		label: 'Deploy by scp + systemctl restart',
		command: 'scp -r . prod:/app && ssh prod "systemctl restart puma"',
		responseLines: [
			{ text: 'Uploading 4,812 files...', color: 'muted' },
			{ text: 'systemctl restart puma', color: 'muted' },
			{
				text: '[LB] 14 requests served 502 during restart (8.3s window)',
				color: 'red',
			},
			{ text: '[Server] Puma: up (after 8.3s).', color: 'yellow' },
		],
		story: [
			'Every deploy is scp followed by `systemctl restart puma`.',
			'The restart takes about 8 seconds.',
			'During those 8 seconds the load balancer still routes traffic to this server.',
			'Every request that arrives mid-restart gets a 502.',
			'Users mid-checkout see a blank error page and walk away.',
		],
	},
	{
		id: 'git-pull',
		label: 'Deploy by ssh + git pull',
		command:
			'ssh prod "cd /app && git pull && bundle install && systemctl restart puma"',
		responseLines: [
			{ text: 'Fetching origin...', color: 'muted' },
			{
				text: "Gemfile.lock out of sync. Running 'bundle install'...",
				color: 'yellow',
			},
			{
				text: 'An error occurred while installing nokogiri: libxml2 missing',
				color: 'red',
			},
			{
				text: '[Server] Puma failed to boot. Old process already stopped.',
				color: 'red',
			},
		],
		story: [
			'You SSH into prod and `git pull` the new code.',
			'`Gemfile.lock` changed. Bundle runs live on the prod server.',
			"One native dep (libxml2) isn't installed. Bundle fails.",
			'The old puma process already stopped. The new one never started.',
			'The app is dark until someone SSHes in and fixes libxml2 by hand.',
		],
	},
	{
		id: 'bad-release',
		label: 'Ship a release with a broken env var',
		command: 'scp -r . prod:/app && ssh prod "systemctl restart puma"',
		responseLines: [
			{ text: '[Server] Puma up.', color: 'green' },
			{
				text: '[App] ArgumentError: DATABASE_URL missing (raised per request)',
				color: 'red',
			},
			{
				text: '[LB] routing 100% of traffic to the broken release.',
				color: 'red',
			},
			{ text: 'Error rate: 100% for the last 11 minutes.', color: 'red' },
		],
		story: [
			'You ship a release that forgot to set `DATABASE_URL` in the deploy env.',
			'Puma still boots. The process is up.',
			'`systemctl status puma` returns OK.',
			'The load balancer has no better signal, so it routes traffic in.',
			'Every request raises `ArgumentError`. 100% error rate until a human notices.',
		],
	},
	{
		id: 'rollback',
		label: 'Roll back a bad release by git reset',
		command:
			'ssh prod "cd /app && git reset --hard abc123 && systemctl restart puma"',
		responseLines: [
			{ text: 'git reset --hard abc123', color: 'muted' },
			{
				text: 'bundle install (required by old Gemfile.lock)...',
				color: 'muted',
			},
			{ text: '[LB] another 12s of 502s during the restart', color: 'red' },
			{ text: 'Total outage window: ~4 minutes.', color: 'red' },
		],
		story: [
			'A previous deploy broke prod. You need to roll back to the previous sha.',
			'Rollback means: SSH in, `git reset --hard`, bundle install, restart.',
			"That's the same 8-second restart window as the original deploy.",
			'Plus bundle install. Plus the time to find the previous sha.',
			'Total outage window, counting detection: ~4 minutes.',
			"There's no record of what sha was serving 20 minutes ago.",
		],
	},
	{
		id: 'two-servers',
		label: 'Deploy to two servers at once',
		command: 'scp -r . prod1:/app && scp -r . prod2:/app && ssh ... "restart"',
		responseLines: [
			{ text: '[prod1] restart: OK', color: 'green' },
			{
				text: '[prod2] scp hit network blip, 1 file truncated.',
				color: 'yellow',
			},
			{ text: '[prod2] Puma: up (but with mismatched assets)', color: 'red' },
			{
				text: '[LB] half of users see stale JS, the other half see new JS',
				color: 'red',
			},
		],
		story: [
			'You scaled to two servers for redundancy.',
			'Deploy = scp to prod1 + scp to prod2, in parallel.',
			'prod1 completes cleanly.',
			'prod2 hits a network blip. One file is truncated.',
			'Puma boots on prod2 with mismatched assets.',
			'Half of users see stale JS, the other half see the new JS. The console explodes.',
		],
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'scp-restart': ['downtime'],
	'git-pull': ['irreproducible'],
	'bad-release': ['no-health-gate'],
	rollback: ['no-rollback'],
	'two-servers': ['fleet-fragility'],
};

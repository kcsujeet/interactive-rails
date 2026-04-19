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
	},
	{
		id: 'rollback',
		label: 'Roll back a bad release',
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
	},
];

export const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'scp-restart': ['downtime'],
	'git-pull': ['irreproducible'],
	'bad-release': ['no-health-gate'],
	rollback: ['no-rollback', 'downtime'],
	'two-servers': ['fleet-fragility', 'irreproducible'],
};

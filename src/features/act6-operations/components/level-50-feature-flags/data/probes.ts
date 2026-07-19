import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

export const PROBES: ProbeConfig[] = [
	{
		id: 'rollout-everyone',
		label: 'Customer pays during peak (feature is all-or-nothing)',
		command: 'POST /api/v1/payments (cart total: $87, 4:23pm peak)',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'NewPaymentProcessor edge case under peak load.',
				color: 'yellow',
			},
			{
				text: 'Customer cart abandoned. Refund will issue automatically.',
				color: 'yellow',
			},
			{
				text: 'The feature is on for 100% of users. There is no 5% dial.',
				color: 'red',
			},
			{
				text: 'kamal rollback is fast, but reverts the whole release, not just this.',
				color: 'red',
			},
		],
		story: [
			'A customer pays during peak traffic, at 4:23pm.',
			'The request hits the new payment processor.',
			'The processor has an edge case that fails 3% of charges under peak load.',
			'This customer is in the 3%. Their charge returns 500. Customer sees an error.',
			'The feature shipped on for everyone: there was no way to launch it to just 5% first and catch this at low blast radius.',
			'kamal rollback (L49) would recover in seconds, but it reverts the ENTIRE release, dragging back every other change shipped alongside this one.',
		],
	},
	{
		id: 'marketing-pin-time',
		label: 'Customer pays Monday 4pm (after deploy, before launch)',
		command: 'POST /api/v1/payments (cart total: $59)',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Charged via NewPaymentProcessor. Feature is live.',
				color: 'yellow',
			},
			{
				text: 'But Marketing has not announced yet. The launch is happening early.',
				color: 'red',
			},
			{
				text: 'Without a runtime toggle, deploy time IS launch time.',
				color: 'red',
			},
		],
		story: [
			'Marketing has scheduled the launch announcement for Tuesday at 9:00am sharp.',
			'Engineering deployed the new processor Monday at lunch (deploys happen when code is ready).',
			'A customer pays Monday at 4pm and unknowingly hits the new processor.',
			'The feature is live, but Marketing has not announced it. The launch is happening off-schedule, before the email blast goes out.',
			'Without a runtime toggle, you cannot ship the code now and release the feature at a specific later moment.',
		],
	},
	{
		id: 'vendor-flaky',
		label: 'Hit kill switch during a vendor outage',
		command: 'POST /admin/launch-toggles/new_payment_processor/disable',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No such route. There is no toggle endpoint to hit.',
				color: 'yellow',
			},
			{
				text: 'The feature is hardcoded into the controller, off switch and all.',
				color: 'yellow',
			},
			{
				text: 'To disable it you must roll the whole release back, not just this feature.',
				color: 'red',
			},
		],
		story: [
			'A third-party vendor (NewPaymentProcessor) starts returning 500s at peak load.',
			'Oncall reaches for a kill switch and POSTs to a toggle route.',
			'The route does not exist, so Rails returns 404: there is no runtime toggle to flip.',
			'The feature is hardcoded into the request flow, with no per-feature off switch.',
			'The only lever is kamal rollback (L49), which reverts the entire release. The vendor then self-recovers, and everything shipped alongside had to be rolled back for nothing.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
export const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'rollout-everyone': 'deploy-equals-release',
	'marketing-pin-time': 'no-launch-pinning',
	'vendor-flaky': 'no-kill-switch',
};

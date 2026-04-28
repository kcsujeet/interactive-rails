import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

export const PROBES: ProbeConfig[] = [
	{
		id: 'rollout-everyone',
		label: 'Customer pays during peak (3% drop, 30 min to roll back)',
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
				text: 'Engineering paged. Rolling back: git revert + Kamal redeploy ~30 min.',
				color: 'red',
			},
			{
				text: 'During the deploy window, more customers fall into the 3% bucket.',
				color: 'red',
			},
		],
		story: [
			'A customer pays during peak traffic, at 4:23pm.',
			'The request hits the new payment processor.',
			'The processor has an edge case that fails 3% of charges under peak load.',
			'This customer is in the 3%. Their charge returns 500. Customer sees an error.',
			'Engineering notices. Tries to roll back. Without a runtime toggle, the only option is git revert + Kamal redeploy: about 30 minutes.',
			'For the next 30 minutes, more customers fall into the 3% bucket and keep getting failed charges.',
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
			{ text: 'HTTP/1.1 501 Not Implemented', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No runtime toggle exists. Feature is hardcoded into the controller.',
				color: 'yellow',
			},
			{
				text: 'Recovery requires a revert + redeploy. MTTR ~30 minutes.',
				color: 'red',
			},
		],
		story: [
			'A third-party vendor (NewPaymentProcessor) starts returning 500s at peak load.',
			'Oncall pages, opens the runbook, and reads: "wait for the vendor to recover, or redeploy without the feature."',
			'There is no runtime kill switch. The feature is hardcoded into the request flow.',
			'30 minutes later, the redeploy ships. The vendor has already self-recovered. The whole episode was avoidable.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
export const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'rollout-everyone': 'deploy-equals-release',
	'marketing-pin-time': 'no-launch-pinning',
	'vendor-flaky': 'no-kill-switch',
};

import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

export const PROBES: ProbeConfig[] = [
	{
		id: 'rollout-everyone',
		label: 'Roll out new payment processor to all customers',
		command: 'POST /api/v1/payments (every user routes to new processor)',
		responseLines: [
			{ text: 'HTTP/1.1 500 Internal Server Error', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '3% of charges fail at peak traffic (NewPaymentProcessor edge case)',
				color: 'yellow',
			},
			{
				text: 'Only fix: revert + Kamal redeploy. ~30 minutes of impact.',
				color: 'red',
			},
		],
		story: [
			'A new payment processor ships behind no flag, so the deploy IS the release.',
			'Three percent of charges fail at peak. Customers see error toasts.',
			'There is no toggle. The only way out is to revert the commit and redeploy.',
			'A Kamal redeploy is roughly 30 minutes door-to-door. The whole time, charges are still failing.',
		],
	},
	{
		id: 'marketing-pin-time',
		label: 'Flip launch toggle at Tuesday 9:00am sharp',
		command: 'POST /admin/launch-toggles/new_payment_processor/enable',
		responseLines: [
			{ text: 'HTTP/1.1 409 Conflict', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Engineering can land code Mon; deploys are coordinated, not exact.',
				color: 'yellow',
			},
			{
				text: 'No mechanism to ship code now and release it at a specific later moment.',
				color: 'red',
			},
		],
		story: [
			'Marketing has scheduled a launch announcement for Tuesday at 9:00am sharp.',
			'Engineering can have the code merged and deployed by Monday afternoon.',
			'There is no way to make "code is in production" and "feature is visible to users" happen at different times.',
			'Either we deploy Tuesday at 9am sharp (risky, hand-wavy) or we miss the announcement window.',
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

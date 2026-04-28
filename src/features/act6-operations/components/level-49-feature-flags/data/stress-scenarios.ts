import type { StressScenario } from '@/hooks/useStressTest';

export const STRESS_SCENARIOS: StressScenario[] = [
	// Probe-matched scenarios (one per probe, same id and label)
	{
		id: 'rollout-everyone',
		label: 'Roll out new payment processor to all customers',
		description:
			'Flag at 100%: all traffic routes to NewPaymentProcessor. Same as the broken state, but now we can roll back instantly.',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'all_customers',
		expectedResult: 'allowed',
	},
	{
		id: 'marketing-pin-time',
		label: 'Flip launch toggle at Tuesday 9:00am sharp',
		description:
			'Code shipped Monday, off. Marketing flips the flag at Tuesday 9:00am. Time-to-launch: <1s.',
		method: 'POST',
		path: '/admin/flipper/features/new_payment_processor/enable',
		actor: 'marketing_admin',
		expectedResult: 'allowed',
	},
	{
		id: 'vendor-flaky',
		label: 'Hit kill switch during a vendor outage',
		description:
			'Oncall hits the admin UI, flips the flag off. Traffic immediately routes to the legacy code path. MTTR: <1s.',
		method: 'POST',
		path: '/admin/flipper/features/new_payment_processor/disable',
		actor: 'oncall',
		expectedResult: 'blocked',
	},
	// Reward-only scenarios (demonstrate flag superpowers)
	{
		id: 'gradual-5-percent',
		label: 'Ramp rollout to 5% of actors',
		description:
			'enable_percentage_of_actors at 5: ~5% of users hit the new path, the rest stay on legacy. Stable per user across requests.',
		method: 'POST',
		path: '/admin/flipper/features/new_payment_processor/percentage_of_actors',
		actor: 'oncall',
		expectedResult: 'allowed',
	},
	{
		id: 'beta-opt-in',
		label: 'Beta tester opts in via support',
		description:
			'enable_actor for one specific user: only that beta tester sees the new processor. Everyone else is on legacy.',
		method: 'POST',
		path: '/admin/flipper/features/new_payment_processor/actors',
		actor: 'beta_user_42',
		expectedResult: 'allowed',
	},
	{
		id: 'incident-recovery',
		label: 'Incident! Disable feature globally',
		description:
			'Hard kill: oncall disables the flag during a live incident. Active requests still in flight finish; new requests route to legacy. No redeploy.',
		method: 'POST',
		path: '/admin/flipper/features/new_payment_processor/clear',
		actor: 'oncall',
		expectedResult: 'blocked',
	},
];

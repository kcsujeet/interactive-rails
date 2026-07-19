import type { StressScenario } from '@/hooks/useStressTest';

export const STRESS_SCENARIOS: StressScenario[] = [
	// Probe-matched scenarios (one per probe, same id and label)
	{
		id: 'rollout-everyone',
		label: 'Customer pays during peak (one-feature flag flip)',
		description:
			'Same customer paying $87 at 4:23pm. Edge case still hits 3%, but now: oncall flips this ONE flag off in <1s, traffic shifts back to legacy, and every other change in the release stays live. No full rollback needed.',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer_peak_4_23pm',
		expectedResult: 'allowed',
	},
	{
		id: 'marketing-pin-time',
		label: 'Customer pays Monday 4pm (after deploy, before launch)',
		description:
			'Same customer paying Monday 4pm. Code shipped Monday with the flag OFF. Customer routes through legacy. Tuesday 9am: marketing flips the flag. New processor goes live exactly at announcement.',
		method: 'POST',
		path: '/api/v1/payments',
		actor: 'customer_monday_4pm',
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
];

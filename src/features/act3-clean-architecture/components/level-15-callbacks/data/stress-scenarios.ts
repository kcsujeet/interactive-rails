import type { StressScenario } from '@/hooks/useStressTest';

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'signup-messy',
		label: 'POST signup with messy email',
		description: 'Email with spaces and uppercase gets cleaned by normalizes',
		method: 'POST',
		path: '/api/users',
		actor: '"  JOE@GMAIL.COM  "',
		expectedResult: 'allowed',
	},
	{
		id: 'lookup-clean',
		label: 'GET user by clean email',
		description: 'Query value is normalized too, so the lookup matches',
		method: 'GET',
		path: '/api/users?email=joe@gmail.com',
		actor: 'system query',
		expectedResult: 'allowed',
	},
	{
		id: 'check-mailer',
		label: 'Check welcome email after signup',
		description:
			'Controller calls send_welcome_email(@user) after the save succeeds',
		method: 'POST',
		path: '/api/users',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
	{
		id: 'update-no-welcome',
		label: 'Update skips welcome email',
		description:
			'Profile updates go through a different controller action, so no welcome email fires',
		method: 'PATCH',
		path: '/api/users/5',
		actor: 'existing_user',
		expectedResult: 'allowed',
	},
	{
		id: 'rollback-crm',
		label: 'Rollback prevents orphan sync',
		description:
			'Sync only fires after the save succeeds, so a rolled-back save leaves no orphan side effect',
		method: 'POST',
		path: '/api/users (rollback)',
		actor: 'failed_txn',
		expectedResult: 'blocked',
	},
];

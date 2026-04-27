import type { StressScenario } from '@/hooks/useStressTest';

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'signup-messy',
		label: 'POST signup with messy email',
		description: 'Email with spaces and uppercase gets normalized',
		method: 'POST',
		path: '/api/v1/users',
		actor: '"  JOE@GMAIL.COM  "',
		expectedResult: 'allowed',
	},
	{
		id: 'lookup-clean',
		label: 'GET user by clean email',
		description: 'Query value normalized automatically by Rails',
		method: 'GET',
		path: '/api/v1/users?email=joe@gmail.com',
		actor: 'system query',
		expectedResult: 'allowed',
	},
	{
		id: 'check-mailer',
		label: 'Check mailer queue after signup',
		description: 'after_create fires and queues the mailer',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'new_user',
		expectedResult: 'allowed',
	},
	{
		id: 'update-no-welcome',
		label: 'Update skips welcome email',
		description: 'after_create does not fire on updates',
		method: 'PATCH',
		path: '/api/v1/users/5',
		actor: 'existing_user',
		expectedResult: 'allowed',
	},
	{
		id: 'rollback-crm',
		label: 'Rollback prevents CRM sync',
		description: 'after_commit blocks orphan API calls on rollback',
		method: 'POST',
		path: '/api/v1/users (rollback)',
		actor: 'failed_txn',
		expectedResult: 'blocked',
	},
];

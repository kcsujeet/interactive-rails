import type { StressScenario } from '@/hooks/useStressTest';

// Reward scenarios mirror the observe probes 1:1, plus one reward-only
// reinforcement scenario (profile edit, no email) that demonstrates the
// "side effect lives where the trigger lives" lesson by showing what does
// NOT fire on a different controller action. All three use 'allowed' --
// from the customer's perspective, "allowed" means the dashboard stays
// clean.

export const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'buyer-search-misses',
		label: 'Buyer searches the storefront for "Ceramic Mug"',
		description:
			'normalizes strips whitespace on writes AND on finder queries, so the search matches the cleaned stored value',
		method: 'GET',
		path: '/api/products?name=Ceramic+Mug',
		actor: 'buyer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'cyan' },
			{ text: '{"data":[{"id":42,"name":"Ceramic Mug",...}]}', color: 'green' },
			{
				text: 'normalizes :name cleaned the row on write AND the query on read. 1 result.',
				color: 'green',
			},
		],
		story: [
			'Same seller, same dirty submission "  Ceramic Mug  ".',
			'normalizes :name strips the whitespace before INSERT. The row stores "Ceramic Mug".',
			'Same buyer searches for "Ceramic Mug". normalizes also runs on the finder, so the query matches.',
			'1 result returned. The buyer sees the listing and clicks Buy.',
		],
	},
	{
		id: 'duplicate-signup',
		label: 'New user signs up, never receives a welcome email',
		description:
			'UsersController#create now calls send_welcome_email(@user) explicitly after the save succeeds',
		method: 'POST',
		path: '/api/users',
		actor: 'new_user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'cyan' },
			{
				text: 'send_welcome_email(@user) -> queued (job id 8a2c)',
				color: 'green',
			},
			{
				text: 'Customer receives the welcome email within seconds. No duplicate signup.',
				color: 'green',
			},
		],
		story: [
			'Same customer, same signup form.',
			'After @user.save succeeds, the controller now calls send_welcome_email(@user) on the next line.',
			'The customer gets the welcome email seconds later and stops worrying.',
			'No duplicate account is created. Support has one account per person, as it should be.',
		],
	},
	{
		id: 'update-no-welcome',
		label: 'Existing user edits their profile (no welcome email)',
		description:
			'Profile updates go through a different controller action, so no welcome email fires',
		method: 'PATCH',
		path: '/api/users/5',
		actor: 'existing_user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'cyan' },
			{
				text: 'UsersController#update -- no send_welcome_email call here.',
				color: 'green',
			},
			{
				text: 'Profile saved. No mailer fires. (Side effect lives where the trigger lives.)',
				color: 'green',
			},
		],
		story: [
			'An existing customer edits their profile (changes their phone number).',
			'The request hits UsersController#update, which only saves the record.',
			'Because the welcome email is an explicit call inside #create, it does NOT fire here.',
			'No bonus mailers, no surprises. The side effect lives next to the trigger that should fire it.',
		],
	},
];

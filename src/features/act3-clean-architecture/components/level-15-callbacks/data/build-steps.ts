import type { StepDef } from '@/hooks/useStepGating';
import type { StepOption } from '../types';

export const STEP_DEFS: StepDef[] = [
	{ id: 'choose-normalization', title: 'Normalize the Product Name' },
	{ id: 'send-welcome-email', title: 'Send the Welcome Email' },
];

// Step 0: Normalize the Product name on writes AND on finder queries.
// Positive callback example: `normalizes` is the canonical Rails 8 callback
// macro for normalization-only side effects (sources cited in content.ts
// learningContent.furtherReading -> Rails 8 normalizes API doc).
export const NORMALIZATION_OPTIONS: StepOption[] = [
	{
		id: 'before-validation',
		label: 'before_validation :strip_name',
		correct: false,
		feedback:
			'Manual hooks like this only run on writes. A buyer searching by the clean value still goes against the dirty stored row, so the lookup misses. The fix needs to clean values on BOTH writes and reads.',
	},
	{
		id: 'normalizes',
		label: 'normalizes :name, with: ->(n) { n.strip }',
		correct: true,
	},
	{
		id: 'before-save',
		label: 'before_save { self.name = name.strip }',
		correct: false,
		feedback:
			'This hook runs after validation, so a uniqueness check sees the raw value, not the cleaned one. It also still does nothing for finder queries: a buyer searching by the clean value still misses the dirty stored row.',
	},
];

// Step 1: Send the Welcome Email (negative callback example).
// Correct answer: extract to an explicit call from the controller, not a callback.
// This is the canonical "callbacks: normalization only, side effects elsewhere"
// teaching from rails-principles.md.
export const WELCOME_EMAIL_OPTIONS: StepOption[] = [
	{
		id: 'after-create-callback',
		label: 'after_create :send_welcome_email (on User model)',
		correct: false,
		feedback:
			'Hiding mailers inside the model means every test that creates a user fires real mail, every seed file does too, and a reader of the signup controller cannot see that mail is even being sent. The trigger gets buried in the model and the model becomes untestable.',
	},
	{
		id: 'after-commit-callback',
		label: 'after_commit :send_welcome_email, on: :create',
		correct: false,
		feedback:
			'Moving the side effect to a different lifecycle hook is the same anti-pattern in different clothing. Test runs and seed scripts still fire real mail. The signup controller still hides the trigger. The fix is not a different hook, it is no hook.',
	},
	{
		id: 'controller-call',
		label: 'send_welcome_email(@user) in UsersController#create',
		correct: true,
	},
];

// Map step index to option config
export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Normalize the Product Name',
		description:
			'Sellers submit product names with extra whitespace ("  Ceramic Mug  "). When buyers search the storefront for "Ceramic Mug" the dirty stored value does not match. Pick the way to clean the name field so writes AND finder queries are both consistent.',
		options: NORMALIZATION_OPTIONS,
	},
	1: {
		title: 'Send the Welcome Email',
		description:
			'After a user signs up successfully, we want to send them a welcome email. The signup controller has a saved @user. Where should the email-sending code live? Think about which option keeps the signup controller readable AND lets test runs and seed files create users without firing real mail.',
		options: WELCOME_EMAIL_OPTIONS,
	},
};

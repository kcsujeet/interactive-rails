import type { StepDef } from '@/hooks/useStepGating';
import type { StepOption } from '../types';

export const STEP_DEFS: StepDef[] = [
	{ id: 'choose-normalization', title: 'Normalize the Email' },
	{ id: 'add-status-enum', title: 'Add a Status Enum' },
	{ id: 'send-welcome-email', title: 'Send the Welcome Email' },
	{ id: 'sync-external', title: 'Sync to External Service' },
];

// Step 0: Normalize the email
export const NORMALIZATION_OPTIONS: StepOption[] = [
	{
		id: 'before-validation',
		label: 'before_validation :downcase_email',
		correct: false,
		feedback:
			"Manual hooks work, but they don't clean values used in finder queries. Rails 8 has a declarative API that handles both writes AND reads, so a lookup by a messy email still finds the record.",
	},
	{
		id: 'normalizes',
		label: 'normalizes :email, with: -> e { e.strip.downcase }',
		correct: true,
	},
	{
		id: 'before-save',
		label: 'before_save { self.email = email.strip.downcase }',
		correct: false,
		feedback:
			"This pattern runs after validation, so a uniqueness check sees the raw value, not the cleaned one. Two users could register with 'Joe@Gmail.com' and 'joe@gmail.com' and both pass uniqueness validation. Lookups by clean values also still fail.",
	},
];

// Step 1: Add a status enum (NEW — string-encoded, the production-safe default)
export const STATUS_ENUM_OPTIONS: StepOption[] = [
	{
		id: 'plain-string',
		label: 'add_column :products, :status, :string',
		correct: false,
		feedback:
			'A bare string column accepts ANY value. There is no helper to check the current state, no protection against typos, and no validation that a value is one of a fixed set. A misspelling silently saves a broken row that breaks every query that filters by it.',
	},
	{
		id: 'integer-encoded',
		label: 'enum :status, draft: 0, listed: 1, sold: 2',
		correct: false,
		feedback:
			'Number codes are unreadable in a database dump (status: 1 means nothing without the model open) and dangerous in production: reordering or inserting a value renumbers existing rows. SQL queries like WHERE status = 1 are also opaque to anyone reading them.',
	},
	{
		id: 'string-encoded',
		label: 'enum :status, draft: "draft", listed: "listed", sold: "sold"',
		correct: true,
	},
];

// Step 2: Send the Welcome Email (REFRAMED — anti-pattern motivator)
// Correct answer: extract to an explicit call from the controller, not a callback.
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
			'Moving the side effect to a different lifecycle hook is the same anti-pattern in different clothing. Test runs and seed scripts still fire real mail. The signup controller still hides the trigger. The fix is not a different hook — it is no hook.',
	},
	{
		id: 'controller-call',
		label: 'UserMailer.welcome(@user).deliver_later in UsersController#create',
		correct: true,
	},
];

// Step 3: Sync to External Service (REFRAMED — anti-pattern motivator)
// Correct answer: enqueue a background job from the controller (or a service)
// after the save, not from the model lifecycle.
export const EXTERNAL_SYNC_OPTIONS: StepOption[] = [
	{
		id: 'after-save-inline',
		label: 'after_save { AccountingApi.sync(self) }',
		correct: false,
		feedback:
			'Calling the third-party HTTP service inside a save means every save waits for that vendor to respond. If they are slow, every save is slow. If they are down, every save fails. And after_save fires on every save (including unrelated edits), not just sales.',
	},
	{
		id: 'after-commit-callback',
		label: 'after_commit :sync_to_accounting, on: :update',
		correct: false,
		feedback:
			'after_commit ties record persistence to the third-party vendor at the model level. The save still blocks the request waiting for the API. Tests that touch Product hit the real vendor. And the trigger is invisible to anyone reading the calling code.',
	},
	{
		id: 'background-job',
		label: 'AccountingSyncJob.perform_later(product.id) from the controller',
		correct: true,
	},
];

// Map step index to option config
export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Normalize the Email',
		description:
			'Emails are stored with leading and trailing spaces and inconsistent casing. Pick the way to clean the email field so writes and finder queries are both consistent.',
		options: NORMALIZATION_OPTIONS,
	},
	1: {
		title: 'Add a Status Enum',
		description:
			'Products move through a lifecycle: drafted by the seller, then listed for sale, then sold. Add a status field so the model can track which stage a product is in. Pick the way to model this fixed set of values.',
		options: STATUS_ENUM_OPTIONS,
	},
	2: {
		title: 'Send the Welcome Email',
		description:
			'After a user signs up successfully, we want to send them a welcome email. The signup controller has a saved @user. Where should the email-sending code live? Think about which option keeps the signup controller readable AND lets test runs and seed files create users without firing real mail.',
		options: WELCOME_EMAIL_OPTIONS,
	},
	3: {
		title: 'Sync to External Service',
		description:
			'When a Product is marked as sold, we need to notify a third-party accounting service over HTTP. The vendor API is slow and occasionally down. Where should this notification go so the user-facing save stays fast and never breaks when the vendor breaks?',
		options: EXTERNAL_SYNC_OPTIONS,
	},
};

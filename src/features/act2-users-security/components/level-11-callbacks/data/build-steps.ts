import type { StepDef } from '@/hooks/useStepGating';
import type { StepOption } from '../types';

export const STEP_DEFS: StepDef[] = [
	{ id: 'choose-normalization', title: 'Choose Normalization' },
	{ id: 'add-callback', title: 'Add Callback' },
	{ id: 'order-callbacks', title: 'Order Callbacks' },
	{ id: 'avoid-pitfall', title: 'Avoid Pitfall' },
];

// Step 0: Choose Normalization
export const NORMALIZATION_OPTIONS: StepOption[] = [
	{
		id: 'before-validation',
		label: 'before_validation :downcase_email',
		correct: false,
		feedback:
			"Manual callbacks work, but they don't normalize query values. Rails 8 has a declarative API that handles both writes and reads.",
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
			"before_save runs too late for validation uniqueness checks. Also, this pattern doesn't normalize finder queries.",
	},
];

// Step 1: Add Callback
export const CALLBACK_OPTIONS: StepOption[] = [
	{
		id: 'after-initialize',
		label: 'after_initialize :send_welcome_email',
		correct: false,
		feedback:
			'after_initialize runs every time a record is loaded from the database, not just on creation. Users would get welcome emails on every page load.',
	},
	{
		id: 'after-save',
		label: 'after_save :send_welcome_email',
		correct: false,
		feedback:
			'after_save fires on both create AND update. Users would get a welcome email every time their profile is edited.',
	},
	{
		id: 'after-create',
		label: 'after_create :send_welcome_email',
		correct: true,
	},
];

// Step 2: Order Callbacks
export const ORDER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-alpha',
		label: 'after_save -> before_validation -> before_save -> after_commit',
		correct: false,
		feedback:
			'Callbacks run in lifecycle order, not alphabetical. Validation happens before save, not after.',
	},
	{
		id: 'wrong-mixed',
		label: 'before_save -> before_validation -> after_commit -> after_save',
		correct: false,
		feedback:
			'Validation always runs before save. The lifecycle follows a strict sequence from validation through to commit.',
	},
	{
		id: 'correct-order',
		label: 'before_validation -> before_save -> after_save -> after_commit',
		correct: true,
	},
];

// Step 3: Avoid Pitfall
export const PITFALL_OPTIONS: StepOption[] = [
	{
		id: 'after-save',
		label: 'after_save',
		correct: false,
		feedback:
			'after_save runs inside the transaction. If the transaction rolls back, the external API call already happened and cannot be undone.',
	},
	{
		id: 'after-create',
		label: 'after_create',
		correct: false,
		feedback:
			'after_create also runs inside the transaction. External calls made here can fire for data that never actually gets committed.',
	},
	{
		id: 'after-commit',
		label: 'after_commit',
		correct: true,
	},
];

// Map step index to option config
export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	0: {
		title: 'Choose Normalization',
		description:
			'Emails are stored with leading/trailing spaces and inconsistent casing. Pick the best way to normalize the email field so writes and reads are consistent.',
		options: NORMALIZATION_OPTIONS,
	},
	1: {
		title: 'Add Callback',
		description:
			'New users sign up but never receive a welcome email. Add the right callback to trigger it when a user is first created.',
		options: CALLBACK_OPTIONS,
	},
	2: {
		title: 'Order Callbacks',
		description:
			'Your normalizes must run before validation checks uniqueness, and the welcome email must fire only after the record is persisted. Which lifecycle order does Rails actually follow?',
		options: ORDER_OPTIONS,
	},
	3: {
		title: 'Avoid Pitfall',
		description:
			'You need to sync new users to an external CRM via an API call. Which callback is safe for external side effects that should not fire if the transaction rolls back?',
		options: PITFALL_OPTIONS,
	},
};

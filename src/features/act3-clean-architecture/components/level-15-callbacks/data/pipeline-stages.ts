import type { StageInspectorData } from '@/components/levels/StageInspector';

// Stage inspector data (observe phase)
export const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	input: {
		stageId: 'input',
		title: 'Incoming User Data',
		description:
			'Raw params arrive from the signup form. The email field contains whatever the user typed: extra spaces, mixed case, accidental whitespace. No transformation happens before it reaches the model.',
	},
	normalizes: {
		stageId: 'normalizes',
		title: 'Normalizes (Missing!)',
		description:
			'This stage does not exist yet. There is no normalization layer to clean data before it reaches validation or the database. Rails 8 introduces a declarative normalizes API for exactly this purpose.',
	},
	model: {
		stageId: 'model',
		title: 'User Model',
		description:
			'The model validates presence and uniqueness, but stores data exactly as received. Email "  JOE@GMAIL.COM  " passes validation and gets saved as-is.',
		code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true,
                    uniqueness: true
  # No normalizes, no callbacks
end`,
	},
	callbacks: {
		stageId: 'callbacks',
		title: 'Callbacks (Missing!)',
		description:
			'No lifecycle hooks are configured. After a user is created, nothing else happens: no welcome email, no CRM sync, no side effects. The controller would have to do everything inline.',
	},
};

// Map stage IDs to discovery IDs they trigger.
// Pedagogy rule: each discovery is unlocked by exactly one source.
// `raw-stored` is owned by the signup-messy probe; clicking the
// normalizes stage surfaces inspector text but does not duplicate-unlock.
export const STAGE_DISCOVERY_MAP: Record<string, string> = {
	callbacks: 'no-hooks',
};

// Observe phase: 4 zones (Input, Normalizes, Model, Callbacks)
export const OBSERVE_FLOW: Record<string, string[]> = {
	'signup-messy': [
		'POST /api/v1/users from signup form',
		'No normalizes, raw data passes through',
		'Saved as "  JOE@GMAIL.COM  "',
		'No callbacks, nothing else happens',
	],
	'lookup-clean': [
		'User.find_by(email: "joe@gmail.com")',
		'No normalization on queries either',
		'DB has "  JOE@GMAIL.COM  ", query uses "joe@gmail.com"',
		'Lookup fails silently, nil returned',
	],
	'check-mailer': [
		'User.create! from registration',
		'No normalizes configured',
		'Record saved to database',
		'No after_create callback, 0 emails sent',
	],
};

// Reward phase: 4 zones (Input, Normalizes, Model, "After Save")
// The 4th zone shows what runs after the save commits. With the reframed
// content, that is the controller's next line (mailer or job), not a callback.
export const REWARD_FLOW: Record<string, string[]> = {
	'signup-messy': [
		'"  JOE@GMAIL.COM  " from signup',
		'strip + downcase: "joe@gmail.com"',
		'Cleaned email saved to DB',
		'Controller queues UserMailer.welcome',
	],
	'lookup-clean': [
		'find_by(email: "joe@gmail.com")',
		'Query value normalized automatically',
		'Match found in database',
		'Read path: no follow-up needed',
	],
	'check-mailer': [
		'New user registration',
		'Email normalized on write',
		'User record persisted',
		'Controller fires UserMailer.welcome.deliver_later',
	],
	'update-no-welcome': [
		'PATCH /api/v1/users/5',
		'Normalizes still runs on update',
		'Updated record saved',
		'Update action does not call welcome mailer',
	],
	'rollback-crm': [
		'POST /users (transaction fails)',
		'Normalizes runs before validation',
		'Save raises, controller never reaches enqueue',
		'No orphan job, no orphan email',
	],
};

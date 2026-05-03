import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

export const PROBES: ProbeConfig[] = [
	{
		id: 'signup-messy',
		label: 'POST signup with messy email',
		command: 'POST /api/users (email: "  JOE@GMAIL.COM  ")',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: '{"id":5,"email":"  JOE@GMAIL.COM  "}',
				color: 'yellow',
			},
			{
				text: 'Email stored with leading spaces and uppercase. No cleanup.',
				color: 'red',
			},
		],
		story: [
			'A user signs up typing "  JOE@GMAIL.COM  " with extra spaces and caps.',
			'The model saves the email exactly as submitted, with no normalization.',
			"The database now holds a dirty string that won't match clean lookups.",
			'Future login attempts with "joe@gmail.com" will fail silently.',
		],
	},
	{
		id: 'lookup-clean',
		label: 'GET user by clean email',
		command: 'User.find_by(email: "joe@gmail.com")',
		responseLines: [
			{ text: '=> nil', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'DB has "  JOE@GMAIL.COM  " but query uses "joe@gmail.com".',
				color: 'yellow',
			},
			{
				text: 'Case mismatch + whitespace. Lookup fails silently.',
				color: 'red',
			},
		],
		story: [
			'A returning user tries to log in with "joe@gmail.com".',
			'The query searches for an exact match in the users table.',
			'The stored value is "  JOE@GMAIL.COM  " (spaces + uppercase).',
			'find_by returns nil. The user is told their account does not exist.',
		],
	},
	{
		id: 'check-mailer',
		label: 'Check welcome email after signup',
		command: 'log "send_welcome_email called?"',
		responseLines: [
			{ text: '(no log entry)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'send_welcome_email never ran. User.create! does nothing beyond INSERT.',
				color: 'yellow',
			},
			{
				text: 'No code path triggers the welcome email after signup.',
				color: 'red',
			},
		],
		story: [
			'A new customer completes signup and waits for a welcome email.',
			'User.create! inserts the row but triggers no side effects.',
			'Nothing in the model or controller calls send_welcome_email.',
			'The customer never receives a welcome email or activation link.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
export const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'signup-messy': 'raw-stored',
	'lookup-clean': 'lookup-fails',
	'check-mailer': 'no-welcome',
};

// Map probe IDs to pipeline node display during observe
export const PROBE_PIPELINE_MAP: Record<
	string,
	{ normalizesSublabel: string; callbacksBadge: string }
> = {
	'signup-messy': {
		normalizesSublabel: '"  JOE@GMAIL.COM  "',
		callbacksBadge: 'RAW!',
	},
	'lookup-clean': {
		normalizesSublabel: 'nil (mismatch)',
		callbacksBadge: 'MISS!',
	},
	'check-mailer': {
		normalizesSublabel: '(skipped)',
		callbacksBadge: '0 emails',
	},
};

// Map probe IDs to data display text
export const PROBE_DATA_CARD: Record<string, string> = {
	'signup-messy': '"  JOE@GMAIL.COM  "',
	'lookup-clean': '"joe@gmail.com"',
	'check-mailer': 'User.create!',
};

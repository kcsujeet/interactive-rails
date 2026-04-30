import type { TerminalCommand, TerminalOutputLine } from '@/components/levels';
import type { StepDef } from '@/hooks/useStepGating';
import type { StepOption } from '../types';

export const STEP_DEFS: StepDef[] = [
	{ id: 'install-flipper', title: 'Install Flipper Gem' },
	{ id: 'run-installer', title: 'Run Installer + Migrate' },
	{ id: 'wrap-feature', title: 'Wrap the Feature Behind a Flag' },
	{ id: 'configure-rollout', title: 'Configure the Rollout Strategy' },
	{ id: 'mount-admin-ui', title: 'Mount the Admin UI Behind Auth' },
];

// Step type indexed by step number ('terminal' or 'option')
export const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add flipper-active_record
	'terminal', // 1: bin/rails generate flipper:setup + db:migrate
	'option', // 2: wrap feature in Flipper.enabled?
	'option', // 3: configure percentage_of_actors rollout
	'option', // 4: mount admin UI inside authenticate block
];

// ───────────────────────────────────────────────────────────────────
// Step 0: Install Flipper (terminal)
// ───────────────────────────────────────────────────────────────────

export const INSTALL_FLIPPER_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-npm',
		label: 'npm install flipper',
		command: 'npm install flipper',
		correct: false,
		feedback:
			'Flipper is a Ruby gem, not an npm package. Use the Ruby dependency manager.',
	},
	{
		id: 'wrong-gem-install',
		label: 'gem install flipper-active_record',
		command: 'gem install flipper-active_record',
		correct: false,
		feedback:
			'`gem install` puts the gem on your machine but does not add it to your Gemfile. Production deploys will not pick it up.',
	},
	{
		id: 'correct',
		label: 'bundle add flipper-active_record flipper-ui',
		command: 'bundle add flipper-active_record flipper-ui',
		correct: true,
	},
];

export const INSTALL_FLIPPER_OUTPUT: TerminalOutputLine[] = [
	{ text: 'Fetching flipper 1.3.4', color: 'cyan' },
	{ text: 'Fetching flipper-active_record 1.3.4', color: 'cyan' },
	{ text: 'Fetching flipper-ui 1.3.4', color: 'cyan' },
	{ text: 'Installing 3 gems', color: 'muted' },
	{ text: 'Bundle complete!', color: 'green' },
];

// ───────────────────────────────────────────────────────────────────
// Step 1: Run installer + migrate (terminal)
// ───────────────────────────────────────────────────────────────────

export const RUN_INSTALLER_COMMANDS: TerminalCommand[] = [
	{
		id: 'wrong-db-setup',
		label: 'bin/rails db:setup',
		command: 'bin/rails db:setup',
		correct: false,
		feedback:
			'`db:setup` recreates the database from `schema.rb`. It does not run the new gem migration that just got generated.',
	},
	{
		id: 'wrong-only-generate',
		label: 'bin/rails generate flipper:setup',
		command: 'bin/rails generate flipper:setup',
		correct: false,
		feedback:
			'Generating the migration file is half the work. The migration still has to actually run against your database.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate flipper:setup && bin/rails db:migrate',
		command: 'bin/rails generate flipper:setup && bin/rails db:migrate',
		correct: true,
	},
];

export const RUN_INSTALLER_OUTPUT: TerminalOutputLine[] = [
	{
		text: 'create  db/migrate/20260428000000_create_flipper_tables.rb',
		color: 'green',
	},
	{
		text: '== CreateFlipperTables: migrating ============================',
		color: 'green',
	},
	{ text: '-- create_table(:flipper_features)', color: 'muted' },
	{ text: '   -> 0.0021s', color: 'muted' },
	{ text: '-- create_table(:flipper_gates)', color: 'muted' },
	{ text: '   -> 0.0014s', color: 'muted' },
	{ text: 'Flipper schema is ready.', color: 'green' },
];

// ───────────────────────────────────────────────────────────────────
// Step 2: Wrap a feature behind a flag (option)
// ───────────────────────────────────────────────────────────────────

export const WRAP_FEATURE_OPTIONS: StepOption[] = [
	{
		id: 'wrong-rails-env',
		label:
			'if Rails.env.production?\n  NewPaymentProcessor.charge(...)\nelse\n  LegacyPaymentProcessor.charge(...)\nend',
		correct: false,
		feedback:
			'Environment-based gating cannot be flipped at runtime. To roll back, you have to redeploy with the env var changed. That is the same coupling we are trying to break.',
	},
	{
		id: 'wrong-random',
		label:
			'if rand < 0.5\n  NewPaymentProcessor.charge(...)\nelse\n  LegacyPaymentProcessor.charge(...)\nend',
		correct: false,
		feedback:
			'A random coin flip means the same user lands on different code paths across requests. Their first click goes to the new path, their second click to the legacy path. Customers experience inconsistency, support tickets explode.',
	},
	{
		id: 'wrong-unconditional',
		label: 'NewPaymentProcessor.charge(...)',
		correct: false,
		feedback:
			'Calling the new code path unconditionally is exactly the broken state from the observe phase. There is no toggle, no rollback path, no partial rollout.',
	},
	{
		id: 'correct',
		label:
			'if Flipper.enabled?(:new_payment_processor, Current.user)\n  NewPaymentProcessor.charge(...)\nelse\n  LegacyPaymentProcessor.charge(...)\nend',
		correct: true,
	},
];

// ───────────────────────────────────────────────────────────────────
// Step 3: Configure rollout strategy (option)
// ───────────────────────────────────────────────────────────────────

export const CONFIGURE_ROLLOUT_OPTIONS: StepOption[] = [
	{
		id: 'wrong-on-off',
		label: 'Flipper.enable(:new_payment_processor)',
		correct: false,
		feedback:
			'Boolean on/off works for a kill switch but skips the whole point of a gradual rollout. If you flip it on for everyone and 3% of charges break, 100% of users are exposed to the bug, not 3%.',
	},
	{
		id: 'wrong-percentage-of-time',
		label: 'Flipper.enable_percentage_of_time(:new_payment_processor, 5)',
		correct: false,
		feedback:
			'`percentage_of_time` flips a coin per request. The same user might see the new feature on click 1, the legacy on click 2, the new again on click 3. Users experience flapping behaviour. This is for shadow traffic, not user-facing rollouts.',
	},
	{
		id: 'wrong-actor-only',
		label: 'Flipper.enable_actor(:new_payment_processor, Current.user)',
		correct: false,
		feedback:
			'Per-actor enable is for opting individual beta testers in. It does not give you a percentage rollout: it only enables for the one user passed in.',
	},
	{
		id: 'correct',
		label: 'Flipper.enable_percentage_of_actors(:new_payment_processor, 5)',
		correct: true,
	},
];

// ───────────────────────────────────────────────────────────────────
// Step 4: Mount admin UI behind admin auth (option)
// ───────────────────────────────────────────────────────────────────

export const MOUNT_ADMIN_UI_OPTIONS: StepOption[] = [
	{
		id: 'wrong-no-auth',
		label: "mount Flipper::UI.app(Flipper) => '/flipper'",
		correct: false,
		feedback:
			'Mounting the admin UI without an auth block means anyone who knows the URL can flip your kill switches. This is a public knob on a private blast radius. Bots will find it.',
	},
	{
		id: 'wrong-only-localhost',
		label:
			"constraints lambda { |req| req.local? } do\n  mount Flipper::UI.app(Flipper) => '/flipper'\nend",
		correct: false,
		feedback:
			'Restricting to localhost (`req.local?`) means the admin UI is unreachable in production, where you actually need it during incidents. Oncall cannot flip a kill switch from their laptop.',
	},
	{
		id: 'wrong-rails-env-block',
		label:
			"if Rails.env.development?\n  mount Flipper::UI.app(Flipper) => '/flipper'\nend",
		correct: false,
		feedback:
			'Same problem as the localhost variant: the UI does not exist in production. The whole point of flags is to let oncall flip switches in prod without redeploying.',
	},
	{
		id: 'correct',
		label:
			"authenticate :user, ->(user) { user.admin? } do\n  mount Flipper::UI.app(Flipper) => '/flipper'\nend",
		correct: true,
	},
];

// Map step index to option config (only for option-typed steps)
export const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	2: {
		title: 'Wrap the Feature Behind a Flag',
		description:
			'The new payment processor is sitting in the controller, called unconditionally. Add a runtime check so the new code path only runs when an operator decides it should. The check needs to be flippable without a redeploy and must keep a single user on the same code path across their requests.',
		options: WRAP_FEATURE_OPTIONS,
	},
	3: {
		title: 'Configure the Rollout Strategy',
		description:
			'Pick the API call that gradually rolls the feature out to 5% of users. Two constraints: (1) one specific user should reliably stay in the same bucket across requests (no flapping), and (2) it should scale up to a 100% rollout by raising the percentage, without you touching the controller code.',
		options: CONFIGURE_ROLLOUT_OPTIONS,
	},
	4: {
		title: 'Mount the Admin UI Behind Auth',
		description:
			'Flipper ships an admin UI for flipping flags at runtime. Mount it at `/flipper`. Two requirements: (1) it has to exist in production (oncall needs it during incidents), and (2) only admins should be able to reach it. Random bots probing your routes should not get a kill-switch console.',
		options: MOUNT_ADMIN_UI_OPTIONS,
	},
};

export const ALL_OPTION_SETS: { name: string; options: StepOption[] }[] = [
	{ name: 'WRAP_FEATURE_OPTIONS', options: WRAP_FEATURE_OPTIONS },
	{ name: 'CONFIGURE_ROLLOUT_OPTIONS', options: CONFIGURE_ROLLOUT_OPTIONS },
	{ name: 'MOUNT_ADMIN_UI_OPTIONS', options: MOUNT_ADMIN_UI_OPTIONS },
];

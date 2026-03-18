/**
 * Level 34: Locking (Concurrency Control)
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Dual Timeline Lanes" visualization.
 *   Two horizontal swim lanes (Thread A top, Thread B bottom) with time
 *   flowing left to right. Shared Account Row card in the center.
 *   Without locking: both READ at same time, both WRITE with stale data.
 *   ProbeTerminal fires concurrent scenarios revealing lost updates.
 *
 * Phase 2 (HOW - build): 5 steps (2 terminal + 3 OptionCard)
 *   Step 0: Generate lock_version:integer migration (terminal)
 *   Step 1: Run rails db:migrate (terminal)
 *   Step 2: Add pessimistic locking with Account.lock.find(id) (OptionCard)
 *   Step 3: Build DeductBalance service with contract + lock (OptionCard)
 *   Step 4: Handle StaleObjectError for optimistic locking (OptionCard)
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Locking" button
 * Phase 4 (ADVANTAGE - reward): Same dual lanes, now showing locks working.
 *   Thread A acquires lock, Thread B waits, then proceeds with updated data.
 *
 * Teaches: Account.lock.find, with_lock, lock_version, optimistic vs
 *   pessimistic locking, StaleObjectError handling, SELECT ... FOR UPDATE
 */

import {
	ArrowRight,
	Clock,
	Database,
	Lock,
	Play,
	ShieldCheck,
	Star,
	Unlock,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'lost-update', label: "User A's deduction silently vanishes" },
	{
		id: 'stale-read',
		label: 'Both users read the same outdated balance',
	},
	{
		id: 'no-lock',
		label: 'No mechanism prevents simultaneous row access',
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'concurrent-deduct': ['lost-update', 'stale-read'],
	'stale-edit': ['no-lock'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'concurrent-deduct',
		label: 'Concurrent deductions',
		command: '# User A: deduct $30, User B: deduct $50 (simultaneously)',
		responseLines: [
			{
				text: 'User A: Account.find(1) => balance: $100',
				color: 'cyan',
			},
			{
				text: 'User B: Account.find(1) => balance: $100',
				color: 'cyan',
			},
			{
				text: 'User A: balance -= 30 => saves $70',
				color: 'yellow',
			},
			{
				text: 'User B: balance -= 50 => saves $50',
				color: 'red',
			},
			{
				text: 'Final balance: $50 (should be $20!)',
				color: 'red',
			},
			{
				text: "User A's $30 deduction was silently lost!",
				color: 'red',
			},
		],
	},
	{
		id: 'stale-edit',
		label: 'Stale profile edit',
		command: '# Two admins edit the same user profile simultaneously',
		responseLines: [
			{
				text: 'Admin A: User.find(1) => lock_version: nil',
				color: 'cyan',
			},
			{
				text: 'Admin B: User.find(1) => lock_version: nil',
				color: 'cyan',
			},
			{
				text: "Admin A: updates name to 'Alice'   => saved",
				color: 'yellow',
			},
			{
				text: "Admin B: updates name to 'Bob'     => saved (overwrites!)",
				color: 'red',
			},
			{
				text: 'No lock_version column means no conflict detection.',
				color: 'red',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-lock-version', title: 'Add Lock Version Column' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'add-pessimistic-lock', title: 'Add Row Lock' },
	{ id: 'build-service', title: 'Build Deduction Service' },
	{ id: 'handle-stale-error', title: 'Handle Conflicts' },
];

// Terminal step 0: Add lock_version migration
const LOCK_VERSION_COMMANDS = [
	{
		id: 'wrong-boolean',
		label: 'rails g migration AddLockedToAccounts locked:boolean',
		command: 'rails generate migration AddLockedToAccounts locked:boolean',
		correct: false,
		feedback:
			'A boolean flag cannot detect concurrent modifications. Optimistic locking needs a column that tracks how many times a record has been saved.',
	},
	{
		id: 'wrong-timestamp',
		label: 'rails g migration AddUpdatedAtToAccounts updated_at:datetime',
		command:
			'rails generate migration AddUpdatedAtToAccounts updated_at:datetime',
		correct: false,
		feedback:
			'Timestamps have precision issues with concurrent writes. Rails needs an auto-incrementing counter to detect exact version mismatches.',
	},
	{
		id: 'correct-lock-version',
		label: 'rails g migration AddLockVersionToAccounts lock_version:integer',
		command:
			'rails generate migration AddLockVersionToAccounts lock_version:integer',
		correct: true,
	},
];

const LOCK_VERSION_OUTPUT = [
	{ text: '  invoke  active_record', color: 'green' as const },
	{
		text: '  create    db/migrate/..._add_lock_version_to_accounts.rb',
		color: 'green' as const,
	},
];

// Terminal step 1: Run migration
const MIGRATE_COMMANDS = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'Seeding populates the database with sample data. The migration file still needs to be applied to the schema.',
	},
	{
		id: 'wrong-reset',
		label: 'rails db:reset',
		command: 'rails db:reset',
		correct: false,
		feedback:
			'Resetting drops and recreates the database from schema.rb. That discards all existing data. You just need to apply the pending migration.',
	},
	{
		id: 'correct-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const MIGRATE_OUTPUT = [
	{
		text: '== AddLockVersionToAccounts: migrating ===',
		color: 'green' as const,
	},
	{
		text: '-- add_column(:accounts, :lock_version, :integer, {:default=>0, :null=>false})',
		color: 'green' as const,
	},
	{
		text: '== AddLockVersionToAccounts: migrated ====',
		color: 'green' as const,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: LOCK_VERSION_COMMANDS, outputLines: LOCK_VERSION_OUTPUT },
	{ commands: MIGRATE_COMMANDS, outputLines: MIGRATE_OUTPUT },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// OptionCard step 2: Pessimistic locking
const PESSIMISTIC_OPTIONS = [
	{
		id: 'wrong-find-only',
		label: `ActiveRecord::Base.transaction do
  account = Account.find(id)
  # No lock acquired!
  account.balance -= amount
  account.save!
end`,
		correct: false,
		feedback:
			'A plain find does not acquire a row lock. Another transaction can read and modify the same row concurrently, causing a lost update.',
	},
	{
		id: 'correct-lock',
		label: `ActiveRecord::Base.transaction do
  account = Account.lock.find(id)
  # SELECT ... FOR UPDATE locks the row
  raise InsufficientFundsError if account.balance < amount
  account.balance -= amount
  account.save!
end`,
		correct: true,
	},
	{
		id: 'wrong-with-lock-outside',
		label: `account = Account.find(id)
account.with_lock do
  account.balance -= amount
  account.save!
end
# Lock released, but audit log outside lock
AuditLog.create!(account:, amount: -amount)`,
		correct: false,
		feedback:
			'The audit log creation is outside the lock block. If it fails, the balance was already changed. All related writes must be inside the same locked transaction.',
	},
];

// OptionCard step 3: Build service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class DeductBalance < ApplicationService
  Result = Data.define(:success?, :account, :errors)

  def initialize(account_id:, amount:)
    @account_id = account_id
    @amount = amount
  end

  def call
    ActiveRecord::Base.transaction do
      account = Account.lock.find(@account_id)
      raise InsufficientFundsError if account.balance < @amount
      account.balance -= @amount
      account.save!
      Result.new(success?: true, account:, errors: [])
    end
  rescue InsufficientFundsError
    Result.new(success?: false, account: nil,
      errors: ["Insufficient funds"])
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class DeductBalance < ApplicationService
  Result = Data.define(:success?, :account, :errors)

  def initialize(account_id:, amount:)
    @account_id = account_id
    @amount = amount
  end

  def call
    v = DeductionContract.new.call(
      account_id: @account_id, amount: @amount)
    return Result.new(success?: false,
      account: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      account = Account.lock.find(@account_id)
      raise InsufficientFundsError if account.balance < @amount
      account.balance -= @amount
      account.save!
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, account:, errors: [])
    end
  rescue InsufficientFundsError
    Result.new(success?: false, account: nil,
      errors: ["Insufficient funds"])
  end
end`,
		correct: true,
	},
];

// OptionCard step 4: Handle StaleObjectError
const STALE_ERROR_OPTIONS = [
	{
		id: 'wrong-ignore',
		label: `# In controller:
result = UpdateProfile.call(user_id:, params:)
# No StaleObjectError handling
# If two users edit simultaneously, one silently overwrites`,
		correct: false,
		feedback:
			'Without handling StaleObjectError, the second writer silently overwrites the first. Optimistic locking requires catching and retrying or reporting the conflict.',
	},
	{
		id: 'correct-rescue-retry',
		label: `# In controller:
def update
  result = UpdateProfile.call(
    user_id: Current.user.id, params: profile_params)
  if result.success?
    render json: UserSerializer.new(result.user)
  else
    render json: { error: { code: "VALIDATION_FAILED",
      message: "Update failed",
      details: result.errors } }, status: :unprocessable_entity
  end
rescue ActiveRecord::StaleObjectError
  render json: { error: { code: "CONFLICT",
    message: "Record was modified by another user",
    details: {} } }, status: :conflict
end`,
		correct: true,
	},
	{
		id: 'wrong-pessimistic-everywhere',
		label: `# In controller:
def update
  ActiveRecord::Base.transaction do
    user = User.lock.find(Current.user.id)
    user.update!(profile_params)
    render json: UserSerializer.new(user)
  end
end
# Pessimistic lock for a profile edit`,
		correct: false,
		feedback:
			'Pessimistic locking for low-contention profile edits is overkill. It blocks concurrent reads and can cause deadlocks. Use optimistic locking (lock_version) with StaleObjectError handling instead.',
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: {
			id: string;
			label: string;
			correct: boolean;
			feedback?: string;
		}[];
	}
> = {
	2: {
		title: 'Add Pessimistic Locking',
		description:
			'For financial operations, acquire a row lock to prevent concurrent modifications.',
		options: PESSIMISTIC_OPTIONS,
	},
	3: {
		title: 'Build the Deduction Service',
		description:
			'Create a service object with contract validation, transaction, and pessimistic locking.',
		options: SERVICE_OPTIONS,
	},
	4: {
		title: 'Handle Optimistic Lock Conflicts',
		description:
			'For low-contention resources like profiles, handle the case where another user edited the same record.',
		options: STALE_ERROR_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'single-deduct',
		label: 'POST deduct $30',
		description: 'Single user deducts $30 from account',
		method: 'POST',
		path: '/api/v1/accounts/1/deduct',
		actor: 'User A',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Transaction: lock -> deduct $30 -> audit -> commit',
				color: 'cyan',
			},
			{ text: 'Balance: $100 -> $70', color: 'green' },
		],
	},
	{
		id: 'concurrent-deduct-locked',
		label: 'POST concurrent deductions (locked)',
		description: 'Two users deduct simultaneously with FOR UPDATE lock',
		method: 'POST',
		path: '/api/v1/accounts/1/deduct',
		actor: 'User A + User B',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: '200 OK (both succeed, serialized)',
				color: 'green',
			},
			{
				text: 'User A: lock -> $100 - $30 = $70 -> commit',
				color: 'cyan',
			},
			{
				text: 'User B: waits... lock -> $70 - $50 = $20 -> commit',
				color: 'cyan',
			},
			{ text: 'Final balance: $20 (correct!)', color: 'green' },
		],
	},
	{
		id: 'transfer',
		label: 'POST transfer $50 between accounts',
		description:
			'Atomic transfer: debit sender + credit receiver in one transaction',
		method: 'POST',
		path: '/api/v1/transfers',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Transaction: lock both -> debit sender -> credit receiver -> commit',
				color: 'cyan',
			},
		],
	},
	{
		id: 'insufficient-funds',
		label: 'POST deduct $200 (insufficient)',
		description: 'Try to deduct more than available balance',
		method: 'POST',
		path: '/api/v1/accounts/1/deduct',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: '{ error: { code: "INSUFFICIENT_FUNDS" } }',
				color: 'yellow',
			},
			{
				text: 'Transaction rolled back. Balance unchanged.',
				color: 'green',
			},
		],
	},
	{
		id: 'stale-profile-edit',
		label: 'PATCH profile (stale version)',
		description: 'Edit profile that was already modified by another user',
		method: 'PATCH',
		path: '/api/v1/users/1',
		actor: 'User B (stale)',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '409 Conflict', color: 'red' },
			{
				text: '{ error: { code: "CONFLICT", message: "Record was modified" } }',
				color: 'yellow',
			},
			{
				text: 'StaleObjectError caught. Client can reload and retry.',
				color: 'cyan',
			},
		],
	},
	{
		id: 'invalid-amount',
		label: 'POST deduct -$10 (invalid)',
		description: 'Try to deduct a negative amount',
		method: 'POST',
		path: '/api/v1/accounts/1/deduct',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'DeductionContract: amount must be greater than 0',
				color: 'yellow',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Race Timeline visualization
// ──────────────────────────────────────────────

type CellVariant =
	| 'default'
	| 'blue'
	| 'purple'
	| 'success'
	| 'danger'
	| 'warning'
	| 'muted';

interface TimelineCell {
	text: string;
	variant: CellVariant;
}

interface TimelineRow {
	threadA: TimelineCell;
	center: TimelineCell;
	threadB: TimelineCell;
}

// Observe: concurrent deduction (no lock, race condition)
const OBSERVE_CONCURRENT_ROWS: TimelineRow[] = [
	{
		threadA: { text: 'READ \u2192 $100', variant: 'blue' },
		center: { text: '$100', variant: 'default' },
		threadB: { text: 'READ \u2192 $100', variant: 'purple' },
	},
	{
		threadA: { text: '-= $30 \u2192 $70', variant: 'blue' },
		center: { text: '$100 (stale)', variant: 'warning' },
		threadB: { text: '-= $50 \u2192 $50', variant: 'purple' },
	},
	{
		threadA: { text: 'SAVE $70', variant: 'success' },
		center: { text: '$70', variant: 'success' },
		threadB: { text: '', variant: 'muted' },
	},
	{
		threadA: { text: '', variant: 'muted' },
		center: { text: '$50 (LOST!)', variant: 'danger' },
		threadB: { text: 'SAVE $50 (overwrites)', variant: 'danger' },
	},
];

// Observe: stale profile edit (no lock_version)
const OBSERVE_STALE_ROWS: TimelineRow[] = [
	{
		threadA: { text: 'READ user (v: nil)', variant: 'blue' },
		center: { text: 'name: Alice', variant: 'default' },
		threadB: { text: 'READ user (v: nil)', variant: 'purple' },
	},
	{
		threadA: { text: "SET 'Carol'", variant: 'blue' },
		center: { text: 'Alice', variant: 'default' },
		threadB: { text: '(editing...)', variant: 'muted' },
	},
	{
		threadA: { text: 'SAVE', variant: 'success' },
		center: { text: 'Carol', variant: 'success' },
		threadB: { text: "SET 'Bob'", variant: 'purple' },
	},
	{
		threadA: { text: '', variant: 'muted' },
		center: { text: 'Bob (LOST!)', variant: 'danger' },
		threadB: { text: 'SAVE (overwrites)', variant: 'danger' },
	},
];

// Reward: locked concurrent deduction (serialized, correct)
const REWARD_ALLOWED_ROWS: TimelineRow[] = [
	{
		threadA: { text: 'LOCK + READ $100', variant: 'blue' },
		center: { text: '$100 (locked)', variant: 'warning' },
		threadB: { text: 'WAITING...', variant: 'warning' },
	},
	{
		threadA: { text: '-= $30, SAVE $70', variant: 'blue' },
		center: { text: '$70', variant: 'success' },
		threadB: { text: 'WAITING...', variant: 'warning' },
	},
	{
		threadA: { text: 'COMMIT + UNLOCK', variant: 'success' },
		center: { text: '$70', variant: 'default' },
		threadB: { text: 'LOCK + READ $70', variant: 'purple' },
	},
	{
		threadA: { text: '', variant: 'muted' },
		center: { text: '$20 (correct)', variant: 'success' },
		threadB: { text: '-= $50, SAVE $20', variant: 'success' },
	},
];

// Reward: blocked scenario (rejected by lock/validation)
const REWARD_BLOCKED_ROWS: TimelineRow[] = [
	{
		threadA: { text: 'LOCK + READ $100', variant: 'blue' },
		center: { text: '$100 (locked)', variant: 'warning' },
		threadB: { text: '', variant: 'muted' },
	},
	{
		threadA: { text: 'CHECK FAILS', variant: 'danger' },
		center: { text: '$100', variant: 'default' },
		threadB: { text: '', variant: 'muted' },
	},
	{
		threadA: { text: 'ROLLBACK', variant: 'danger' },
		center: { text: '$100 (safe)', variant: 'success' },
		threadB: { text: '', variant: 'muted' },
	},
];

const CELL_STYLES: Record<CellVariant, string> = {
	default: 'bg-muted/30 text-foreground border-muted-foreground/20',
	blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/50',
	purple:
		'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600/50',
	success:
		'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600/50',
	danger:
		'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-400 dark:border-red-500/50',
	warning:
		'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-600/50',
	muted: 'bg-muted/20 text-muted-foreground border-muted-foreground/10',
};

function RaceTimeline({
	rows,
	visibleCount,
	centerLabel,
}: {
	rows: TimelineRow[];
	visibleCount: number;
	centerLabel: string;
}) {
	return (
		<div className="w-full max-w-2xl">
			{/* Column headers */}
			<div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-2">
				<div className="text-center text-xs font-semibold text-blue-600 dark:text-blue-400">
					Thread A
				</div>
				<div className="text-center text-xs font-semibold text-muted-foreground w-28">
					{centerLabel}
				</div>
				<div className="text-center text-xs font-semibold text-purple-600 dark:text-purple-400">
					Thread B
				</div>
			</div>

			{/* Timeline rows */}
			<div className="space-y-1.5">
				{rows.slice(0, visibleCount).map((row, i) => (
					<div
						className="grid grid-cols-[1fr_auto_1fr] gap-2 animate-in fade-in slide-in-from-top-1 duration-300"
						key={`t${i}-${row.center.text}`}
					>
						<div
							className={cn(
								'rounded border px-3 py-2 text-xs font-mono text-center min-h-[36px] flex items-center justify-center transition-colors',
								CELL_STYLES[row.threadA.variant],
							)}
						>
							{row.threadA.text}
						</div>
						<div
							className={cn(
								'rounded border px-3 py-2 text-xs font-mono text-center font-bold w-28 flex items-center justify-center transition-colors',
								CELL_STYLES[row.center.variant],
							)}
						>
							{row.center.text}
						</div>
						<div
							className={cn(
								'rounded border px-3 py-2 text-xs font-mono text-center min-h-[36px] flex items-center justify-center transition-colors',
								CELL_STYLES[row.threadB.variant],
							)}
						>
							{row.threadB.text}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/deduct_balance.rb',
				language: 'ruby',
				code: `class DeductBalance < ApplicationService
  Result = Data.define(:success?, :account, :errors)

  def initialize(account_id:, amount:)
    @account_id = account_id
    @amount = amount
  end

  def call
    v = DeductionContract.new.call(
      account_id: @account_id, amount: @amount)
    return Result.new(success?: false,
      account: nil, errors: v.errors.to_h) if v.failure?

    account = Account.find(@account_id)
    account.balance -= @amount
    account.save!
    # No lock! Concurrent calls cause lost updates
    Result.new(success?: true, account:, errors: [])
  end
end`,
				highlight: [15, 16, 17],
			},
		];
	}

	if (phase === 'build') {
		if (furthestStep <= 0) {
			return [
				{
					filename: 'db/migrate/..._add_lock_version.rb (pending)',
					language: 'ruby',
					code: `# Migration will be generated in this step...
# Goal: add lock_version column for
# optimistic locking on Account`,
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'db/migrate/add_lock_version_to_accounts.rb (pending)',
					language: 'ruby',
					code: `class AddLockVersionToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :lock_version, :integer,
      default: 0, null: false
  end
end`,
					highlight: [3, 4],
				},
			];
		}
		if (furthestStep === 2) {
			return [
				{
					filename: 'db/migrate/add_lock_version_to_accounts.rb',
					language: 'ruby',
					code: `class AddLockVersionToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :lock_version, :integer,
      default: 0, null: false
  end
end`,
					highlight: [3, 4],
				},
				{
					filename: 'app/services/deduct_balance.rb (next step)',
					language: 'ruby',
					code: `# Add pessimistic locking for financial operations...`,
				},
			];
		}
		if (furthestStep === 3) {
			return [
				{
					filename: 'app/services/deduct_balance.rb (lock added)',
					language: 'ruby',
					code: `def call
  v = DeductionContract.new.call(...)
  return failure if v.failure?

  ActiveRecord::Base.transaction do
    account = Account.lock.find(@account_id)
    # SELECT ... FOR UPDATE locks the row
    raise InsufficientFundsError if account.balance < @amount
    account.balance -= @amount
    account.save!
    AuditLog.create!(account:, amount: -@amount,
      balance_after: account.balance)
    Result.new(success?: true, account:, errors: [])
  end
end`,
					highlight: [6, 7],
				},
			];
		}
		if (furthestStep === 4) {
			return [
				{
					filename: 'app/contracts/deduction_contract.rb',
					language: 'ruby',
					code: `class DeductionContract < Dry::Validation::Contract
  params do
    required(:account_id).filled(:integer)
    required(:amount).filled(:decimal, gt?: 0)
  end
end`,
				},
				{
					filename: 'app/services/deduct_balance.rb',
					language: 'ruby',
					code: `class DeductBalance < ApplicationService
  Result = Data.define(:success?, :account, :errors)

  def initialize(account_id:, amount:)
    @account_id = account_id
    @amount = amount
  end

  def call
    v = DeductionContract.new.call(
      account_id: @account_id, amount: @amount)
    return Result.new(success?: false,
      account: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      account = Account.lock.find(@account_id)
      raise InsufficientFundsError if account.balance < @amount
      account.balance -= @amount
      account.save!
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, account:, errors: [])
    end
  rescue InsufficientFundsError
    Result.new(success?: false, account: nil,
      errors: ["Insufficient funds"])
  end
end`,
					highlight: [1, 3, 10, 16],
				},
			];
		}
	}

	// Activate + reward: complete solution
	return [
		{
			filename: 'app/contracts/deduction_contract.rb',
			language: 'ruby',
			code: `class DeductionContract < Dry::Validation::Contract
  params do
    required(:account_id).filled(:integer)
    required(:amount).filled(:decimal, gt?: 0)
  end
end`,
		},
		{
			filename: 'app/services/deduct_balance.rb',
			language: 'ruby',
			code: `class DeductBalance < ApplicationService
  Result = Data.define(:success?, :account, :errors)

  def initialize(account_id:, amount:)
    @account_id = account_id
    @amount = amount
  end

  def call
    v = DeductionContract.new.call(
      account_id: @account_id, amount: @amount)
    return Result.new(success?: false,
      account: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      account = Account.lock.find(@account_id)
      raise InsufficientFundsError if account.balance < @amount
      account.balance -= @amount
      account.save!
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, account:, errors: [])
    end
  rescue InsufficientFundsError
    Result.new(success?: false, account: nil,
      errors: ["Insufficient funds"])
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/accounts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::AccountsController < ApplicationController
  def deduct
    result = DeductBalance.call(
      account_id: params[:id],
      amount: params.expect(deduction: [:amount])[:amount])
    if result.success?
      render json: AccountSerializer.new(result.account)
    else
      render json: { error: {
        code: "DEDUCTION_FAILED",
        message: "Could not deduct",
        details: result.errors } },
        status: :unprocessable_entity
    end
  rescue ActiveRecord::StaleObjectError
    render json: { error: {
      code: "CONFLICT",
      message: "Record was modified by another user",
      details: {} } }, status: :conflict
  end
end`,
		},
	];
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export function Level34Locking({ onComplete }: LevelComponentProps) {
	// Phase state
	const [phase, setPhase] = useState<Phase>('observe');

	// Gating hooks
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Visualization state (observe)
	const [vizAnimating, setVizAnimating] = useState(false);
	const [observeRows, setObserveRows] = useState<TimelineRow[] | null>(null);
	const [observeVisible, setObserveVisible] = useState(0);
	const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Visualization state (reward)
	const [rewardRows, setRewardRows] = useState<TimelineRow[] | null>(null);
	const [rewardVisible, setRewardVisible] = useState(0);

	// ── Cleanup timers ──
	const clearTimers = useCallback(() => {
		for (const t of animTimerRef.current) clearTimeout(t);
		animTimerRef.current = [];
	}, []);

	useEffect(() => () => clearTimers(), [clearTimers]);

	// ── Phase transitions ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── Observe: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			setVizAnimating(true);
			clearTimers();

			const rows =
				probeId === 'concurrent-deduct'
					? OBSERVE_CONCURRENT_ROWS
					: OBSERVE_STALE_ROWS;

			setObserveRows(rows);
			setObserveVisible(0);

			const step = ANIMATION_DURATION_MS;
			for (let i = 0; i < rows.length; i++) {
				const t = setTimeout(
					() => {
						setObserveVisible(i + 1);
					},
					step * (i + 1),
				);
				animTimerRef.current.push(t);
			}

			const tFinal = setTimeout(
				() => {
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				},
				step * (rows.length + 1),
			);
			animTimerRef.current.push(tFinal);
		},
		[vizAnimating, clearTimers, discoveryGating],
	);

	// ── Build: option click handler ──
	const handleOptionClick = useCallback(
		(option: { correct: boolean; feedback?: string }) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Reward: fire scenario handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			setVizAnimating(true);
			clearTimers();

			const rows =
				scenario.expectedResult === 'allowed'
					? REWARD_ALLOWED_ROWS
					: REWARD_BLOCKED_ROWS;

			setRewardRows(rows);
			setRewardVisible(0);

			const step = ANIMATION_DURATION_MS;
			for (let i = 0; i < rows.length; i++) {
				const t = setTimeout(
					() => {
						setRewardVisible(i + 1);
					},
					step * (i + 1),
				);
				animTimerRef.current.push(t);
			}

			const tFinal = setTimeout(
				() => {
					setVizAnimating(false);
				},
				step * (rows.length + 1),
			);
			animTimerRef.current.push(tFinal);
		},
		[vizAnimating, stressTest, clearTimers],
	);

	const handleToggleAutoFire = useCallback(
		(onFire: (id: string) => void) => {
			stressTest.toggleAutoFire(onFire);
		},
		[stressTest],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateReward = () => {
		setPhase('reward');
		setRewardRows(null);
		setRewardVisible(0);
	};

	const handleComplete = async () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (phase !== 'reward') {
			return {
				valid: false,
				message: 'Complete all phases first',
				details: [],
			};
		}
		if (stressTest.results.length < 3) {
			return {
				valid: false,
				message: 'Test more scenarios',
				details: ['Fire at least 3 stress test scenarios.'],
			};
		}
		return { valid: true, message: 'Locking prevents data corruption!' };
	};

	// ── Derived state ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep] ?? null;
	const isTerminalStep = stepper.currentStep <= 1;

	// ──────────────────────────────────────────
	// Render: Race Timeline
	// ──────────────────────────────────────────

	const observeCenterLabel =
		observeRows === OBSERVE_STALE_ROWS ? 'DB Row' : 'Balance';

	const renderObserveVisualization = () => (
		<div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
			{/* Banner */}
			<div className="text-center">
				<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
					<Unlock className="w-4 h-4 text-destructive" />
					<span className="text-sm font-semibold text-destructive">
						No Locking: Race Condition
					</span>
				</div>
			</div>

			{/* Timeline table */}
			{observeRows ? (
				<RaceTimeline
					centerLabel={observeCenterLabel}
					rows={observeRows}
					visibleCount={observeVisible}
				/>
			) : (
				<div className="w-full max-w-2xl rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
					<Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						Fire a probe to see the race condition unfold step by step.
					</p>
				</div>
			)}

			{/* Problem callout */}
			{observeVisible > 0 &&
				observeRows &&
				observeVisible >= observeRows.length && (
					<div className="max-w-2xl w-full bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
						<p className="text-xs text-muted-foreground">
							{observeRows === OBSERVE_CONCURRENT_ROWS
								? "Without a lock, Thread B overwrites Thread A's write. $30 vanished from the ledger."
								: "Without a lock_version column, Thread B silently overwrites Thread A's edit. No conflict detected."}
						</p>
					</div>
				)}
		</div>
	);

	const renderRewardVisualization = () => (
		<div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
			{/* Banner */}
			<div className="text-center">
				<div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-1.5">
					<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
					<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
						Pessimistic Lock: Serialized Access
					</span>
				</div>
			</div>

			{/* Timeline table */}
			{rewardRows ? (
				<RaceTimeline
					centerLabel="Balance"
					rows={rewardRows}
					visibleCount={rewardVisible}
				/>
			) : (
				<div className="w-full max-w-2xl rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
					<Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						Fire a scenario to see how locking serializes access.
					</p>
				</div>
			)}
		</div>
	);

	// ──────────────────────────────────────────
	// Main render
	// ──────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Prevent concurrent corruption with database locks so two users cannot overwrite each other's changes."
					instructions={
						phase === 'observe'
							? [
									'Fire probes to see race conditions between concurrent users',
									'Watch what happens when two threads modify the same row',
									'Discover all 3 concurrency problems',
								]
							: phase === 'build'
								? [
										'Add a lock_version column for optimistic locking',
										'Run the migration to apply the schema change',
										'Add pessimistic locking for financial operations',
										'Build a service with contract validation',
										'Handle StaleObjectError for conflict resolution',
									]
								: phase === 'reward'
									? [
											'Fire scenarios to verify locking prevents lost updates',
											'Test insufficient funds and stale version handling',
											'See how concurrent users are safely serialized',
										]
									: ['Review your star rating and visualize the solution']
					}
					scenario="Two users deduct from the same account simultaneously. Without locking, the last write wins and money vanishes. Locks serialize access so each user sees the correct balance."
				>
					<div className="border-t border-border">
						{phase === 'observe' && (
							<div className="p-4">
								<DiscoveryChecklist
									discoveries={discoveryGating.discoveries}
									minRequired={discoveryGating.minRequired}
								/>
							</div>
						)}

						{(phase === 'build' || phase === 'activate') && (
							<div className="p-4">
								<StepProgress
									currentStep={stepper.currentStep}
									onStepClick={stepper.goToStep}
									steps={stepper.steps}
								/>
							</div>
						)}

						{phase === 'reward' && (
							<div className="p-4 space-y-3">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Results
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg p-2 text-center">
										<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-emerald-600 dark:text-emerald-400">
											Committed
										</div>
									</div>
									<div className="bg-destructive/10 dark:bg-destructive/20 rounded-lg p-2 text-center">
										<div className="text-lg font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive">Rejected</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Locking"
					levelNumber={34}
					onComplete={handleComplete}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col">
					{/* ── OBSERVE PHASE ── */}
					{phase === 'observe' && (
						<>
							{renderObserveVisualization()}

							<div className="px-6 pb-2">
								<ProbeTerminal
									disabled={vizAnimating}
									onProbe={handleProbe}
									probes={PROBES}
									title="Concurrency Probe"
								/>
							</div>

							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button onClick={handleStartBuild} size="lg">
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</>
					)}

					{/* ── BUILD PHASE ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-y-auto p-6">
							{isTerminalStep ? (
								<TerminalChoiceStep
									commands={
										stepper.currentStep === 0
											? LOCK_VERSION_COMMANDS
											: MIGRATE_COMMANDS
									}
									completed={isViewingCompletedStep}
									description={
										<p className="text-sm text-muted-foreground">
											{stepper.currentStep === 0
												? 'Add a lock_version column to the accounts table for optimistic locking.'
												: 'Apply the pending migration to add the lock_version column to the database.'}
										</p>
									}
									hasNext={hasNextStep}
									initialHistory={buildTerminalHistory(
										TERMINAL_STEP_MAP,
										stepper.currentStep,
									)}
									onCorrect={() => stepper.completeStep()}
									onNext={stepper.nextStep}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={
										stepper.currentStep === 0
											? LOCK_VERSION_OUTPUT
											: MIGRATE_OUTPUT
									}
									stepKey={stepper.currentStep}
									title={STEP_DEFS[stepper.currentStep].title}
								/>
							) : currentOptionConfig ? (
								<div className="max-w-2xl mx-auto space-y-4">
									<div>
										<h3 className="text-lg font-semibold text-foreground">
											{currentOptionConfig.title}
										</h3>
										<p className="text-sm text-muted-foreground mt-1">
											{currentOptionConfig.description}
										</p>
									</div>

									<div className="space-y-3">
										{isViewingCompletedStep ? (
											currentOptionConfig.options.map((opt) => (
												<OptionCard
													disabled={!opt.correct}
													key={opt.id}
													mono
													name={opt.label}
													selected={opt.correct}
													size="sm"
												/>
											))
										) : (
											<>
												{currentOptionConfig.options.map((opt) => (
													<OptionCard
														key={opt.id}
														mono
														name={opt.label}
														onClick={() => handleOptionClick(opt)}
														size="sm"
													/>
												))}
												<ErrorFeedback
													message={stepper.lastFeedback}
													onDismiss={stepper.clearFeedback}
												/>
											</>
										)}
									</div>

									{isViewingCompletedStep && hasNextStep && (
										<div className="flex justify-end">
											<Button onClick={stepper.nextStep} variant="outline">
												Next Step
												<ArrowRight className="w-4 h-4" />
											</Button>
										</div>
									)}
								</div>
							) : null}
						</div>
					)}

					{/* ── ACTIVATE PHASE ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex flex-col items-center justify-center gap-6">
							<div className="flex items-center gap-1">
								{[1, 2, 3].map((s) => (
									<Star
										className={cn(
											'w-8 h-8',
											s <= stepper.starRating
												? 'text-yellow-500 fill-yellow-500'
												: 'text-muted-foreground',
										)}
										key={s}
									/>
								))}
							</div>
							<p className="text-muted-foreground text-sm">
								{stepper.starRating === 3
									? 'Perfect! No wrong attempts.'
									: stepper.starRating === 2
										? 'Good work! A couple of missteps.'
										: 'Complete! Room for improvement.'}
							</p>
							<Button onClick={handleActivateReward} size="lg">
								<Play className="w-4 h-4" />
								Visualize Locking
							</Button>
						</div>
					)}

					{/* ── REWARD PHASE ── */}
					{phase === 'reward' && (
						<>
							{renderRewardVisualization()}

							<div className="px-6 pb-2">
								<StressTestPanel
									allowedCount={stressTest.allowedCount}
									blockedCount={stressTest.blockedCount}
									canAutoFire={stressTest.canAutoFire}
									disabled={vizAnimating}
									isAutoFiring={stressTest.isAutoFiring}
									onFire={handleFireScenario}
									onToggleAutoFire={handleToggleAutoFire}
									results={stressTest.results}
									scenarios={STRESS_SCENARIOS}
								/>
							</div>
						</>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build' ? stepper.furthestStep : 0,
					)}
					learningGoal={
						phase === 'observe'
							? 'Without locking, concurrent reads followed by concurrent writes cause lost updates. The last writer silently overwrites earlier changes.'
							: 'Pessimistic locks serialize financial operations. Optimistic locks detect conflicts on low-contention edits.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Locking Strategy Guide
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-1.5">
								<Lock className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>Pessimistic (lock.find): financial data, inventory</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Unlock className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>Optimistic (lock_version): profiles, CMS pages</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Clock className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>SELECT ... FOR UPDATE holds lock until COMMIT</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level34Locking;

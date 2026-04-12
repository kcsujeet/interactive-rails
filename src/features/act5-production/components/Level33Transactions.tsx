/**
 * Level 33: Transactions (Atomicity)
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): "Database Snapshot" visualization.
 *   Left strip: 3 numbered operation indicators (Deduct Credits, Create Boost, Write Log)
 *   Main area: 3 mini database tables (users, boosts, credit_logs) showing actual values.
 *   Probes animate step-by-step: cells flash amber (running), green (committed),
 *   red (failed). The key visual: user sees credits=40 but no boost row exists.
 *
 * Phase 2 (HOW - build): 4 OptionCard steps
 *   Step 0: Identify the atomicity problem
 *   Step 1: Wrap operations in ActiveRecord::Base.transaction
 *   Step 2: Handle custom abort with raise ActiveRecord::Rollback
 *   Step 3: Build BoostPost service with contract + transaction
 *
 * Phase 3 (ADVANTAGE - reward): Same DB snapshot, now with transaction boundary
 *   (dashed border). On success, all tables update + COMMIT label. On failure,
 *   tables flash red then revert to original values + ROLLBACK label.
 *
 * Teaches: ActiveRecord::Base.transaction, raise ActiveRecord::Rollback,
 *   atomicity, rollback behavior, service objects with transactions
 */

import {
	ArrowRight,
	CheckCircle,
	CircleX,
	Coins,
	Database,
	FileText,
	Loader2,
	Rocket,
	ShieldCheck,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { shuffleOptions } from '@/lib/shuffleOptions';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'credits-no-boost', label: 'Credits deducted but post never boosted' },
	{ id: 'orphan-boost', label: 'Product boosted without audit trail' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'boost-fail': ['credits-no-boost'],
	'log-fail': ['orphan-boost'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'boost-fail',
		label: 'Boost post (Boost.create! fails)',
		command: '# Deduct credits, then create boost (boost fails)',
		responseLines: [
			{
				text: 'user.credits -= 10      =>  saves (credits: 40)',
				color: 'green',
			},
			{
				text: 'Boost.create!(...)      =>  BOOM! RecordInvalid',
				color: 'red',
			},
			{
				text: 'CreditLog.create!(...)  =>  never reached',
				color: 'muted',
			},
			{
				text: 'Credits deducted but post was never boosted!',
				color: 'red',
			},
			{ text: 'No rollback. 10 credits vanished.', color: 'red' },
		],
		story: [
			'A seller clicks "Boost Post" to promote their Laptop Pro listing.',
			'The system deducts 10 credits from their account and saves immediately.',
			'Next it tries to create the Boost record, but validation fails.',
			'The credit deduction already committed. There is no rollback.',
			'The seller lost 10 credits and got nothing in return.',
		],
	},
	{
		id: 'log-fail',
		label: 'Boost post (CreditLog fails)',
		command: '# Deduct credits, create boost, then log (log fails)',
		responseLines: [
			{
				text: 'user.credits -= 10      =>  saves (credits: 40)',
				color: 'green',
			},
			{
				text: 'Boost.create!(...)      =>  OK (boost #7)',
				color: 'green',
			},
			{
				text: 'CreditLog.create!(...)  =>  BOOM! ConnectionError',
				color: 'red',
			},
			{
				text: 'Product boosted but no audit trail!',
				color: 'red',
			},
			{
				text: 'Compliance violation: unaudited credit operation.',
				color: 'red',
			},
		],
		story: [
			'Same seller boosts a different product listing.',
			'Credits are deducted and the Boost record is created successfully.',
			'The system tries to write the CreditLog entry, but the database connection drops.',
			'The boost is live and credits are spent, but no audit trail exists.',
			'Finance has no record of this transaction. Compliance audit fails.',
		],
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'identify-problem', title: 'Identify the Problem' },
	{ id: 'wrap-transaction', title: 'Wrap in Transaction' },
	{ id: 'handle-rollback', title: 'Handle Custom Abort' },
	{ id: 'build-service', title: 'Build Boost Service' },
];

// OptionCard step 0: Identify the atomicity problem
const IDENTIFY_OPTIONS = [
	{
		id: 'wrong-validation',
		label: 'The input parameters are not validated before processing',
		correct: false,
		feedback:
			'Validation is important but not the root cause here. The issue is that each database write commits independently, so a failure midway leaves partial data.',
	},
	{
		id: 'wrong-ordering',
		label: 'The operations are executed in the wrong order',
		correct: false,
		feedback:
			'Reordering the steps does not solve the problem. Any step can fail, and without atomicity, earlier committed writes cannot be undone.',
	},
	{
		id: 'correct-no-atomicity',
		label:
			'Each operation commits independently, so a failure leaves partial writes that cannot be undone',
		correct: true,
	},
];

// OptionCard step 1: Wrap in transaction
const TRANSACTION_OPTIONS = [
	{
		id: 'wrong-begin-rescue',
		label: `begin
  user.credits -= cost
  user.save!
  Boost.create!(user:, post:, reach: 5000)
  CreditLog.create!(user:, amount: -cost)
rescue => e
  user.reload  # manual rollback?
end`,
		correct: false,
		feedback:
			'Manual rescue and reload cannot undo a committed write. Only database transactions guarantee atomicity with automatic rollback on any failure.',
	},
	{
		id: 'correct-transaction',
		label: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  Boost.create!(user:, post:, reach: 5000)
  CreditLog.create!(user:, amount: -cost,
    reason: "boost_post_#{post.id}")
end`,
		correct: true,
	},
	{
		id: 'wrong-save-only',
		label: `user.credits -= cost
user.save!
Boost.create!(user:, post:, reach: 5000)
CreditLog.create!(user:, amount: -cost)
# Just let exceptions propagate`,
		correct: false,
		feedback:
			'Letting exceptions propagate does not undo writes that already committed. Without a transaction boundary, user.save! persists even if Boost.create! fails.',
	},
];

// OptionCard step 2: Handle custom abort
const ROLLBACK_OPTIONS = [
	{
		id: 'wrong-return-false',
		label: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  return false if user.credits < 0
  Boost.create!(user:, post:, reach: 5000)
end`,
		correct: false,
		feedback:
			'Returning false inside a transaction does NOT trigger a rollback. The transaction commits normally with the credits already deducted. You need to raise to abort.',
	},
	{
		id: 'wrong-throw',
		label: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  throw :abort if user.credits < 0
  Boost.create!(user:, post:, reach: 5000)
end`,
		correct: false,
		feedback:
			'In Ruby, throw/catch is for flow control, not exception handling. ActiveRecord transactions respond to raise, not throw. Use the built-in rollback exception.',
	},
	{
		id: 'correct-rollback-raise',
		label: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  if user.credits < 0
    raise ActiveRecord::Rollback,
      "Insufficient credits"
  end
  Boost.create!(user:, post:, reach: 5000)
end`,
		correct: true,
	},
];

// OptionCard step 3: Build BoostPost service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    ActiveRecord::Base.transaction do
      user = User.find(@user_id)
      user.credits -= @cost
      user.save!
      boost = Boost.create!(user:, product_id: @product_id,
        reach: 5000)
      CreditLog.create!(user:, amount: -@cost,
        reason: "boost_post_#{@product_id}")
      Result.new(success?: true, boost:, errors: [])
    end
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, boost: nil,
      errors: [e.message])
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      product_id: @product_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      user = User.find(@user_id)
      raise ActiveRecord::Rollback if user.credits < @cost
      user.credits -= @cost
      user.save!
      boost = Boost.create!(user:, product_id: @product_id,
        reach: 5000)
      CreditLog.create!(user:, amount: -@cost,
        reason: "boost_post_#{@product_id}")
      Result.new(success?: true, boost:, errors: [])
    end || Result.new(success?: false, boost: nil,
      errors: ["Insufficient credits"])
  end
end`,
		correct: true,
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
	0: {
		title: 'Identify the Atomicity Problem',
		description:
			'What is the root cause of partial failures in the boost pipeline?',
		options: IDENTIFY_OPTIONS,
	},
	1: {
		title: 'Wrap Operations in a Transaction',
		description:
			'Choose the code that ensures credit deduction, boost creation, and credit log succeed or fail together.',
		options: TRANSACTION_OPTIONS,
	},
	2: {
		title: 'Handle Custom Abort',
		description:
			'Inside a transaction, how do you abort and trigger a rollback when a business rule fails?',
		options: ROLLBACK_OPTIONS,
	},
	3: {
		title: 'Build the Boost Service',
		description:
			'Create a service object with contract validation and a transaction wrapping all operations.',
		options: SERVICE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'valid-boost',
		label: 'POST boost (50 credits, valid)',
		description: 'Boost a product with sufficient credits',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'Transaction: deduct -> boost -> log -> commit',
				color: 'cyan',
			},
			{ text: 'All 3 operations committed atomically.', color: 'green' },
		],
	},
	{
		id: 'boost-with-discount',
		label: 'POST boost (30 credits, discount)',
		description: 'Boost with promotional discount applied',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'user with promo',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'Transaction: validate promo -> deduct 30 -> boost -> log -> commit',
				color: 'cyan',
			},
		],
	},
	{
		id: 'boost-fail',
		label: 'POST boost (Boost.create! fails)',
		description: 'Boost creation fails mid-transaction, triggering rollback',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'Boost.create! raised RecordInvalid inside transaction',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Credits unchanged.',
				color: 'green',
			},
		],
	},
	{
		id: 'log-fail',
		label: 'POST boost (CreditLog fails)',
		description:
			'Credit log creation fails mid-transaction, entire operation rolled back',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'CreditLog.create! raised ConnectionError inside transaction',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Credits and boost both undone.',
				color: 'green',
			},
		],
	},
	{
		id: 'negative-credits',
		label: 'POST boost (-5 credits, invalid)',
		description: 'Negative cost rejected by contract validation',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'BoostContract: cost must be greater than 0',
				color: 'yellow',
			},
			{
				text: 'Rejected before transaction. No writes attempted.',
				color: 'cyan',
			},
		],
	},
	{
		id: 'boost-creation-fails',
		label: 'POST boost (creation error)',
		description: 'Boost creation fails mid-transaction, rollback triggered',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'Boost.create! raised RecordInvalid',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Credits unchanged.',
				color: 'green',
			},
		],
	},
	{
		id: 'log-fails-rollback',
		label: 'POST boost (log fails, rollback)',
		description: 'Credit log creation fails, entire transaction rolls back',
		method: 'POST',
		path: '/api/v1/boosts',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'CreditLog.create! raised ConnectionError',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Credits and boost both undone.',
				color: 'green',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Database snapshot types and state
// ──────────────────────────────────────────────

type CellFlash = 'none' | 'running' | 'success' | 'failed' | 'rollback';

interface DbState {
	usersCredits: number;
	boostRow: { userId: number; postId: number; reach: number } | null;
	creditLogRow: {
		userId: number;
		amount: number;
		reason: string;
	} | null;
}

interface FlashState {
	users: CellFlash;
	boosts: CellFlash;
	creditLogs: CellFlash;
}

type OpStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

const INITIAL_DB: DbState = {
	usersCredits: 50,
	boostRow: null,
	creditLogRow: null,
};

const INITIAL_FLASH: FlashState = {
	users: 'none',
	boosts: 'none',
	creditLogs: 'none',
};

// ──────────────────────────────────────────────
// DatabaseSnapshot component (~80 lines, inline)
// ──────────────────────────────────────────────

interface DatabaseSnapshotProps {
	dbState: DbState;
	flashState: FlashState;
	opStates: [OpStatus, OpStatus, OpStatus];
	errorTable?: 'boosts' | 'creditLogs' | null;
	errorMessage?: string;
	showRollbackLabel?: boolean;
	showCommitLabel?: boolean;
	wrapped?: boolean;
}

const OP_DEFS = [
	{ icon: Coins, label: 'Deduct' },
	{ icon: Rocket, label: 'Boost' },
	{ icon: FileText, label: 'Log' },
];

function opColor(status: OpStatus): string {
	switch (status) {
		case 'running':
			return 'text-amber-500 border-amber-400';
		case 'success':
			return 'text-emerald-500 dark:text-emerald-400 border-emerald-500 dark:border-emerald-400';
		case 'failed':
			return 'text-destructive border-destructive';
		case 'skipped':
			return 'text-muted-foreground/40 border-muted-foreground/20';
		default:
			return 'text-muted-foreground border-muted-foreground/30';
	}
}

function cellBg(flash: CellFlash): string {
	switch (flash) {
		case 'running':
			return 'bg-amber-100 dark:bg-amber-900/40';
		case 'success':
			return 'bg-emerald-100 dark:bg-emerald-900/40';
		case 'failed':
			return 'bg-red-100 dark:bg-red-900/40';
		case 'rollback':
			return 'bg-red-50 dark:bg-red-900/20';
		default:
			return '';
	}
}

function DatabaseSnapshot({
	dbState,
	flashState,
	opStates,
	errorTable,
	errorMessage,
	showRollbackLabel,
	showCommitLabel,
	wrapped,
}: DatabaseSnapshotProps) {
	const tables = [
		{
			name: 'users',
			headerClass:
				'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
			columns: ['id', 'username', 'credits'],
			rows: [
				{
					cells: ['1', 'alice', String(dbState.usersCredits)],
					changed: dbState.usersCredits !== 50,
				},
			],
			flash: flashState.users,
			error: false,
		},
		{
			name: 'boosts',
			headerClass:
				'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
			columns: ['id', 'user_id', 'product_id', 'reach'],
			rows: dbState.boostRow
				? [
						{
							cells: [
								'1',
								String(dbState.boostRow.userId),
								String(dbState.boostRow.postId),
								String(dbState.boostRow.reach),
							],
							changed: true,
						},
					]
				: [],
			flash: flashState.boosts,
			error: errorTable === 'boosts',
		},
		{
			name: 'credit_logs',
			headerClass:
				'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
			columns: ['id', 'user_id', 'amount', 'reason'],
			rows: dbState.creditLogRow
				? [
						{
							cells: [
								'1',
								String(dbState.creditLogRow.userId),
								String(dbState.creditLogRow.amount),
								dbState.creditLogRow.reason,
							],
							changed: true,
						},
					]
				: [],
			flash: flashState.creditLogs,
			error: errorTable === 'creditLogs',
		},
	];

	return (
		<div
			className={cn(
				'space-y-4 w-full max-w-2xl transition-all duration-300',
				wrapped &&
					'border-2 border-dashed border-primary/50 bg-primary/5 dark:bg-primary/10 rounded-xl p-4',
			)}
		>
			{wrapped && (
				<div className="text-sm font-mono text-primary">
					ActiveRecord::Base.transaction do
				</div>
			)}

			{tables.map((table, tableIdx) => {
				const op = OP_DEFS[tableIdx];
				const Icon = op.icon;
				const status = opStates[tableIdx];

				return (
					<div className="flex items-center gap-4" key={table.name}>
						{/* Op icon */}
						<div className="flex flex-col items-center shrink-0 w-14">
							<div
								className={cn(
									'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors duration-300',
									opColor(status),
								)}
							>
								{status === 'running' ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Icon className="w-4 h-4" />
								)}
							</div>
							<span
								className={cn(
									'text-xs font-medium mt-0.5',
									status === 'skipped'
										? 'text-muted-foreground/40'
										: 'text-muted-foreground',
								)}
							>
								{op.label}
							</span>
						</div>

						{/* Table */}
						<div className="flex-1 rounded-lg border border-border overflow-hidden min-w-0">
							<div
								className={cn(
									'px-4 py-1.5 text-xs font-mono font-semibold flex items-center justify-between',
									table.headerClass,
								)}
							>
								<span>{table.name}</span>
								{table.error && errorMessage && (
									<span className="text-xs font-semibold text-destructive bg-destructive/10 dark:bg-destructive/20 rounded px-2 py-0.5">
										{errorMessage}
									</span>
								)}
							</div>
							<div className="bg-card">
								<div
									className="grid border-b border-border/50 px-4 py-1"
									style={{
										gridTemplateColumns: `repeat(${table.columns.length}, 1fr)`,
									}}
								>
									{table.columns.map((col) => (
										<span
											className="text-xs font-mono text-muted-foreground font-semibold"
											key={col}
										>
											{col}
										</span>
									))}
								</div>
								{table.rows.length > 0 ? (
									table.rows.map((row) => (
										<div
											className={cn(
												'grid px-4 py-1.5 transition-colors duration-300',
												cellBg(table.flash),
											)}
											key={row.cells[0]}
											style={{
												gridTemplateColumns: `repeat(${table.columns.length}, 1fr)`,
											}}
										>
											{row.cells.map((cell, cellIdx) => (
												<span
													className={cn(
														'text-sm font-mono',
														row.changed && cellIdx === row.cells.length - 1
															? 'text-foreground font-semibold'
															: 'text-muted-foreground',
													)}
													key={table.columns[cellIdx]}
												>
													{cell}
												</span>
											))}
										</div>
									))
								) : (
									<div
										className={cn(
											'px-4 py-2 text-center transition-colors duration-300',
											cellBg(table.flash),
										)}
									>
										<span className="text-xs text-muted-foreground italic">
											(no rows)
										</span>
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})}

			{wrapped && <div className="text-sm font-mono text-primary">end</div>}

			{showCommitLabel && (
				<div className="text-center">
					<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full px-4 py-1.5">
						<CheckCircle className="w-4 h-4" />
						COMMIT
					</span>
				</div>
			)}

			{showRollbackLabel && (
				<div className="text-center">
					<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive bg-destructive/10 dark:bg-destructive/20 rounded-full px-4 py-1.5">
						<CircleX className="w-4 h-4" />
						ROLLBACK
					</span>
				</div>
			)}
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
				filename: 'app/services/boost_post.rb',
				language: 'ruby',
				code: `class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      product_id: @product_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    user.credits -= @cost
    user.save!
    # Step 1 committed. If step 2 fails...
    boost = Boost.create!(user:, product_id: @product_id,
      reach: 5000)
    # Step 2 committed. If step 3 fails...
    CreditLog.create!(user:, amount: -@cost,
      reason: "boost_post_#{@product_id}")
    Result.new(success?: true, boost:, errors: [])
  end
end`,
				highlight: [19, 20, 22, 23, 25, 26],
			},
		];
	}

	if (phase === 'build') {
		if (furthestStep <= 0) {
			return [
				{
					filename: 'app/services/boost_post.rb (broken)',
					language: 'ruby',
					code: `# Each operation commits independently.
# If step 2 or 3 fails, step 1 is already
# persisted and cannot be undone.

user.credits -= cost
user.save!              # Committed!
Boost.create!(...)      # Might fail
CreditLog.create!(...)  # Might fail`,
					highlight: [5, 6],
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'app/services/boost_post.rb (next step)',
					language: 'ruby',
					code: `# Wrap all operations in a transaction...`,
				},
			];
		}
		if (furthestStep === 2) {
			return [
				{
					filename: 'app/services/boost_post.rb (transaction added)',
					language: 'ruby',
					code: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  Boost.create!(user:, product_id:, reach: 5000)
  CreditLog.create!(user:, amount: -cost,
    reason: "boost_post_#{product_id}")
end
# If any operation raises, ALL are rolled back.
# But what about business rule failures?`,
					highlight: [1, 7],
				},
			];
		}
		if (furthestStep === 3) {
			return [
				{
					filename: 'app/services/boost_post.rb (rollback added)',
					language: 'ruby',
					code: `ActiveRecord::Base.transaction do
  user.credits -= cost
  user.save!
  if user.credits < 0
    raise ActiveRecord::Rollback,
      "Insufficient credits"
  end
  Boost.create!(user:, product_id:, reach: 5000)
  CreditLog.create!(user:, amount: -cost,
    reason: "boost_post_#{product_id}")
end
# raise ActiveRecord::Rollback silently aborts
# the transaction without propagating the error.`,
					highlight: [4, 5, 6],
				},
			];
		}
	}

	// Reward: complete solution
	return [
		{
			filename: 'app/contracts/boost_contract.rb',
			language: 'ruby',
			code: `class BoostContract < Dry::Validation::Contract
  params do
    required(:user_id).filled(:integer)
    required(:product_id).filled(:integer)
    required(:cost).filled(:integer, gt?: 0)
  end
end`,
		},
		{
			filename: 'app/services/boost_post.rb',
			language: 'ruby',
			code: `class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, product_id:, cost:)
    @user_id = user_id
    @product_id = product_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      product_id: @product_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      user = User.find(@user_id)
      raise ActiveRecord::Rollback if user.credits < @cost
      user.credits -= @cost
      user.save!
      boost = Boost.create!(user:, product_id: @product_id,
        reach: 5000)
      CreditLog.create!(user:, amount: -@cost,
        reason: "boost_post_#{@product_id}")
      Result.new(success?: true, boost:, errors: [])
    end || Result.new(success?: false, boost: nil,
      errors: ["Insufficient credits"])
  end
end`,
			highlight: [17, 19, 28, 29],
		},
		{
			filename: 'app/controllers/api/v1/boosts_controller.rb',
			language: 'ruby',
			code: `class Api::V1::BoostsController < ApplicationController
  def create
    result = BoostPost.call(
      user_id: Current.user.id,
      product_id: boost_params[:product_id],
      cost: boost_params[:cost])
    if result.success?
      render json: BoostSerializer.new(result.boost),
        status: :created
    else
      render json: { error: {
        code: "BOOST_FAILED",
        message: "Could not boost post",
        details: result.errors } },
        status: :unprocessable_entity
    end
  end

  private

  def boost_params
    params.expect(boost: [:product_id, :cost])
  end
end`,
		},
	];
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export function Level33Transactions({ onComplete }: LevelComponentProps) {
	// Phase state
	const [phase, setPhase] = useState<Phase>('observe');

	// Gating hooks
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 2,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Visualization state
	const [vizAnimating, setVizAnimating] = useState(false);
	const [dbState, setDbState] = useState<DbState>({ ...INITIAL_DB });
	const [flashState, setFlashState] = useState<FlashState>({
		...INITIAL_FLASH,
	});
	const [opStates, setOpStates] = useState<[OpStatus, OpStatus, OpStatus]>([
		'idle',
		'idle',
		'idle',
	]);
	const [errorTable, setErrorTable] = useState<'boosts' | 'creditLogs' | null>(
		null,
	);
	const [errorMessage, setErrorMessage] = useState<string | undefined>(
		undefined,
	);
	const [problemCallout, setProblemCallout] = useState(
		'Fire probes to see what happens when an operation fails midway through the pipeline.',
	);

	// Reward visualization state
	const [rewardDb, setRewardDb] = useState<DbState>({ ...INITIAL_DB });
	const [rewardFlash, setRewardFlash] = useState<FlashState>({
		...INITIAL_FLASH,
	});
	const [rewardOps, setRewardOps] = useState<[OpStatus, OpStatus, OpStatus]>([
		'idle',
		'idle',
		'idle',
	]);
	const [rewardError, setRewardError] = useState<
		'boosts' | 'creditLogs' | null
	>(null);
	const [rewardErrorMsg, setRewardErrorMsg] = useState<string | undefined>(
		undefined,
	);
	const [showCommit, setShowCommit] = useState(false);
	const [showRollback, setShowRollback] = useState(false);
	const [showTransactionBorder, setShowTransactionBorder] = useState(false);

	const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// ── Cleanup timers ──
	const clearTimers = useCallback(() => {
		for (const t of animTimerRef.current) clearTimeout(t);
		animTimerRef.current = [];
	}, []);

	useEffect(() => () => clearTimers(), [clearTimers]);

	// ── Observe: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			setVizAnimating(true);
			clearTimers();

			const step = ANIMATION_DURATION_MS;

			// Reset state before animation
			setDbState({ ...INITIAL_DB });
			setFlashState({ ...INITIAL_FLASH });
			setOpStates(['idle', 'idle', 'idle']);
			setErrorTable(null);
			setErrorMessage(undefined);

			if (probeId === 'boost-fail') {
				// Op1 running
				setOpStates(['running', 'idle', 'idle']);
				setFlashState({ users: 'running', boosts: 'none', creditLogs: 'none' });

				const t1 = setTimeout(() => {
					// Op1 done: credits 50->40
					setDbState((prev) => ({ ...prev, usersCredits: 40 }));
					setFlashState({
						users: 'success',
						boosts: 'none',
						creditLogs: 'none',
					});
					setOpStates(['success', 'running', 'idle']);
					// Op2 running
					setFlashState((prev) => ({ ...prev, boosts: 'running' }));
				}, step);

				const t2 = setTimeout(() => {
					// Op2 failed
					setFlashState({
						users: 'success',
						boosts: 'failed',
						creditLogs: 'none',
					});
					setOpStates(['success', 'failed', 'skipped']);
					setErrorTable('boosts');
					setErrorMessage('RecordInvalid');
				}, step * 2);

				const t3 = setTimeout(() => {
					setProblemCallout(
						'Credits deducted but post was never boosted. 10 credits vanished with nothing to show.',
					);
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				}, step * 3);

				animTimerRef.current.push(t1, t2, t3);
			} else if (probeId === 'log-fail') {
				// Op1 running
				setOpStates(['running', 'idle', 'idle']);
				setFlashState({ users: 'running', boosts: 'none', creditLogs: 'none' });

				const t1 = setTimeout(() => {
					// Op1 done: credits 50->40
					setDbState((prev) => ({ ...prev, usersCredits: 40 }));
					setFlashState({
						users: 'success',
						boosts: 'none',
						creditLogs: 'none',
					});
					setOpStates(['success', 'running', 'idle']);
					setFlashState((prev) => ({ ...prev, boosts: 'running' }));
				}, step);

				const t2 = setTimeout(() => {
					// Op2 done: boost row created
					setDbState((prev) => ({
						...prev,
						boostRow: { userId: 1, postId: 42, reach: 5000 },
					}));
					setFlashState({
						users: 'success',
						boosts: 'success',
						creditLogs: 'none',
					});
					setOpStates(['success', 'success', 'running']);
					setFlashState((prev) => ({ ...prev, creditLogs: 'running' }));
				}, step * 2);

				const t3 = setTimeout(() => {
					// Op3 failed
					setFlashState({
						users: 'success',
						boosts: 'success',
						creditLogs: 'failed',
					});
					setOpStates(['success', 'success', 'failed']);
					setErrorTable('creditLogs');
					setErrorMessage('ConnectionError');
				}, step * 3);

				const t4 = setTimeout(() => {
					setProblemCallout(
						'Product boosted but no audit trail exists. Compliance requires every credit operation to be logged.',
					);
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				}, step * 4);

				animTimerRef.current.push(t1, t2, t3, t4);
			}
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
			setShowTransactionBorder(true);
			setShowCommit(false);
			setShowRollback(false);
			setRewardError(null);
			setRewardErrorMsg(undefined);
			setRewardDb({ ...INITIAL_DB });
			setRewardFlash({ ...INITIAL_FLASH });
			setRewardOps(['idle', 'idle', 'idle']);

			const step = ANIMATION_DURATION_MS;

			if (scenario.expectedResult === 'allowed') {
				// All ops run together
				setRewardOps(['running', 'running', 'running']);
				setRewardFlash({
					users: 'running',
					boosts: 'running',
					creditLogs: 'running',
				});

				const t1 = setTimeout(() => {
					// All succeed
					setRewardDb({
						usersCredits: 40,
						boostRow: { userId: 1, postId: 42, reach: 5000 },
						creditLogRow: { userId: 1, amount: -10, reason: 'boost_post_42' },
					});
					setRewardFlash({
						users: 'success',
						boosts: 'success',
						creditLogs: 'success',
					});
					setRewardOps(['success', 'success', 'success']);
					setShowCommit(true);
				}, step);

				const t2 = setTimeout(() => {
					setVizAnimating(false);
				}, step * 2);
				animTimerRef.current.push(t1, t2);
			} else {
				// Show failure then rollback
				setRewardOps(['running', 'running', 'running']);
				setRewardFlash({
					users: 'running',
					boosts: 'running',
					creditLogs: 'running',
				});

				const t1 = setTimeout(() => {
					// Tentative write, then failure
					if (
						scenarioId === 'boost-creation-fails' ||
						scenarioId === 'boost-fail'
					) {
						setRewardDb((prev) => ({ ...prev, usersCredits: 40 }));
						setRewardFlash({
							users: 'success',
							boosts: 'failed',
							creditLogs: 'none',
						});
						setRewardOps(['success', 'failed', 'skipped']);
						setRewardError('boosts');
						setRewardErrorMsg('RecordInvalid');
					} else if (
						scenarioId === 'log-fails-rollback' ||
						scenarioId === 'log-fail'
					) {
						setRewardDb({
							usersCredits: 40,
							boostRow: { userId: 1, postId: 42, reach: 5000 },
							creditLogRow: null,
						});
						setRewardFlash({
							users: 'success',
							boosts: 'success',
							creditLogs: 'failed',
						});
						setRewardOps(['success', 'success', 'failed']);
						setRewardError('creditLogs');
						setRewardErrorMsg('ConnectionError');
					} else {
						// negative-credits: contract rejects before transaction
						setRewardFlash({
							users: 'failed',
							boosts: 'none',
							creditLogs: 'none',
						});
						setRewardOps(['failed', 'skipped', 'skipped']);
					}
				}, step);

				const t2 = setTimeout(() => {
					// Rollback: revert everything
					setRewardDb({ ...INITIAL_DB });
					setRewardFlash({
						users: 'rollback',
						boosts: 'rollback',
						creditLogs: 'rollback',
					});
					setRewardOps(['idle', 'idle', 'idle']);
					setRewardError(null);
					setRewardErrorMsg(undefined);
					setShowRollback(true);
				}, step * 2);

				const t3 = setTimeout(() => {
					setRewardFlash({ ...INITIAL_FLASH });
					setVizAnimating(false);
				}, step * 3);

				animTimerRef.current.push(t1, t2, t3);
			}
		},
		[vizAnimating, stressTest],
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
		setDbState({ ...INITIAL_DB });
		setFlashState({ ...INITIAL_FLASH });
		setOpStates(['idle', 'idle', 'idle']);
	};

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
		setRewardDb({ ...INITIAL_DB });
		setRewardFlash({ ...INITIAL_FLASH });
		setRewardOps(['idle', 'idle', 'idle']);
		setShowTransactionBorder(false);
		setShowCommit(false);
		setShowRollback(false);
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
		return { valid: true, message: 'Transactions protecting data integrity!' };
	};

	// ── Derived state ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep] ?? null;
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	// ──────────────────────────────────────────
	// Render: Observe visualization
	// ──────────────────────────────────────────

	const renderObserveVisualization = () => (
		<div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
			{/* Banner */}
			<div className="text-center mb-2">
				<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
					<Zap className="w-4 h-4 text-destructive" />
					<span className="text-sm font-semibold text-destructive">
						No Transaction: Partial Writes
					</span>
				</div>
			</div>

			<DatabaseSnapshot
				dbState={dbState}
				errorMessage={errorMessage}
				errorTable={errorTable}
				flashState={flashState}
				opStates={opStates}
			/>

			{/* Problem callout */}
			<div className="max-w-2xl w-full bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center mt-2">
				<p className="text-sm text-muted-foreground">{problemCallout}</p>
			</div>
		</div>
	);

	const renderRewardVisualization = () => (
		<div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
			{/* Banner */}
			<div className="text-center mb-2">
				<div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-1.5">
					<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
					<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
						Transaction: All or Nothing
					</span>
				</div>
			</div>

			<DatabaseSnapshot
				dbState={rewardDb}
				errorMessage={rewardErrorMsg}
				errorTable={rewardError}
				flashState={rewardFlash}
				opStates={rewardOps}
				showCommitLabel={showCommit}
				showRollbackLabel={showRollback}
				wrapped={showTransactionBorder}
			/>
		</div>
	);

	// ──────────────────────────────────────────
	// Main render
	// ──────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Protect data integrity with transactions so multi-step operations either all succeed or all fail together."
					instructions={
						phase === 'observe'
							? [
									'Fire probes to see partial failures in the boost pipeline',
									'Watch what happens when step 2 or step 3 fails',
									'Discover both atomicity problems',
								]
							: phase === 'build'
								? [
										'Identify the root cause of partial failures',
										'Wrap operations in a database transaction',
										'Handle business rule failures with rollback',
										'Build a service with contract and transaction',
									]
								: [
										'Fire scenarios to verify transactions protect integrity',
										'Watch failures trigger rollbacks across all operations',
										'See how the pipeline handles edge cases atomically',
									]
					}
					scenario="The boost pipeline deducts user credits, creates a boost record, and logs a credit entry. Without a transaction, a failure at step 2 or 3 leaves the database in an inconsistent state."
				>
					<div className="border-t border-border">
						{phase === 'observe' && (
							<div className="p-4">
								<DiscoveryChecklist
									discoveredCount={discoveryGating.discoveredCount}
									discoveries={discoveryGating.discoveries}
									minRequired={discoveryGating.minRequired}
								/>
							</div>
						)}

						{phase === 'build' && (
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
										<div className="text-xs text-destructive">Rolled Back</div>
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
					levelName="Transactions"
					levelNumber={33}
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
									title="Boost Pipeline Probe"
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
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-y-auto p-6">
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
										shuffledOptions.map((opt) => (
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
											{shuffledOptions.map((opt) => (
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

								{isViewingCompletedStep && (
									<div className="flex justify-end">
										<Button
											onClick={
												hasNextStep ? stepper.nextStep : handleStartReward
											}
											variant="outline"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
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
						phase === 'build'
							? stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1
							: 0,
					)}
					learningGoal={
						phase === 'observe'
							? 'Without a transaction, each database write commits independently. A failure midway leaves data in an inconsistent state.'
							: 'Transactions ensure atomicity: all operations succeed together or all are rolled back on any failure.'
					}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Transaction Rules
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-1.5">
								<Database className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>Wrap related writes in a transaction block</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Zap className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>Any exception inside rolls back all changes</span>
							</li>
							<li className="flex items-start gap-1.5">
								<ShieldCheck className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>Use ActiveRecord::Rollback for silent aborts</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

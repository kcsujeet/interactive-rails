/**
 * Level 33: Transactions (Atomicity)
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Operation Pipeline" vertical step chain.
 *   3 vertically stacked operation boxes connected by FlowConnectors:
 *   Box 1: account.balance -= 100 (Charge)
 *   Box 2: Order.create!(...) (Create Order)
 *   Box 3: AuditLog.create!(...) (Audit)
 *   Probes fire: boxes light up top-to-bottom. On partial failure, completed
 *   boxes stay green, failed box goes red, remaining stay gray.
 *   The key visual: green boxes above the failure = committed writes that
 *   cannot be undone.
 *
 * Phase 2 (HOW - build): 4 OptionCard steps
 *   Step 0: Identify the atomicity problem
 *   Step 1: Wrap operations in ActiveRecord::Base.transaction
 *   Step 2: Handle custom abort with raise ActiveRecord::Rollback
 *   Step 3: Build ProcessOrder service with contract + transaction
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Transactions" button
 * Phase 4 (ADVANTAGE - reward): Same pipeline, now with a transaction boundary
 *   wrapping all 3 boxes. On failure, ALL boxes flash red then revert to gray
 *   (rollback). On success, all go green together.
 *
 * Teaches: ActiveRecord::Base.transaction, raise ActiveRecord::Rollback,
 *   atomicity, rollback behavior, service objects with transactions
 */

import {
	ArrowRight,
	CheckCircle,
	CircleX,
	Database,
	FileText,
	Play,
	ShieldCheck,
	ShoppingCart,
	Star,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FlowConnector } from '@/components/levels/FlowConnector';
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
	{ id: 'charge-no-order', label: 'Account charged but no order created' },
	{ id: 'orphan-audit', label: 'Audit log orphaned without order' },
	{
		id: 'no-rollback',
		label: 'No rollback mechanism for partial failures',
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'order-fail': ['charge-no-order'],
	'audit-fail': ['orphan-audit'],
	'inspect-code': ['no-rollback'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'order-fail',
		label: 'Process order (Order.create! fails)',
		command: '# Charge account, then create order (order fails)',
		responseLines: [
			{
				text: 'account.balance -= 100  =>  saves $400',
				color: 'green',
			},
			{
				text: 'Order.create!(...)     =>  BOOM! RecordInvalid',
				color: 'red',
			},
			{
				text: 'AuditLog.create!(...)  =>  never reached',
				color: 'muted',
			},
			{
				text: 'Account was charged $100 but no order exists!',
				color: 'red',
			},
			{ text: 'No rollback. Money vanished.', color: 'red' },
		],
	},
	{
		id: 'audit-fail',
		label: 'Process order (AuditLog fails)',
		command: '# Charge account, create order, then audit (audit fails)',
		responseLines: [
			{
				text: 'account.balance -= 100  =>  saves $400',
				color: 'green',
			},
			{
				text: 'Order.create!(...)     =>  OK (order #42)',
				color: 'green',
			},
			{
				text: 'AuditLog.create!(...)  =>  BOOM! ConnectionError',
				color: 'red',
			},
			{
				text: 'Order exists without audit trail!',
				color: 'red',
			},
			{
				text: 'Compliance violation: unaudited financial operation.',
				color: 'red',
			},
		],
	},
	{
		id: 'inspect-code',
		label: 'Inspect service code',
		command: 'cat app/services/process_order.rb',
		responseLines: [
			{
				text: 'class ProcessOrder < ApplicationService',
				color: 'cyan',
			},
			{ text: '  def call', color: 'muted' },
			{
				text: '    account.balance -= @amount',
				color: 'muted',
			},
			{
				text: '    account.save!          # Step 1: committed',
				color: 'yellow',
			},
			{
				text: '    Order.create!(...)     # Step 2: might fail',
				color: 'yellow',
			},
			{
				text: '    AuditLog.create!(...) # Step 3: might fail',
				color: 'yellow',
			},
			{
				text: '    # No transaction wrapping these operations!',
				color: 'red',
			},
			{ text: '  end', color: 'muted' },
			{ text: 'end', color: 'muted' },
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
	{ id: 'build-service', title: 'Build Order Service' },
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
  account.balance -= amount
  account.save!
  Order.create!(account:, total: amount)
  AuditLog.create!(account:, amount: -amount)
rescue => e
  account.reload  # manual rollback?
end`,
		correct: false,
		feedback:
			'Manual rescue and reload cannot undo a committed write. Only database transactions guarantee atomicity with automatic rollback on any failure.',
	},
	{
		id: 'correct-transaction',
		label: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  Order.create!(account:, total: amount)
  AuditLog.create!(account:, amount: -amount,
    balance_after: account.balance)
end`,
		correct: true,
	},
	{
		id: 'wrong-save-only',
		label: `account.balance -= amount
account.save!
Order.create!(account:, total: amount)
AuditLog.create!(account:, amount: -amount)
# Just let exceptions propagate`,
		correct: false,
		feedback:
			'Letting exceptions propagate does not undo writes that already committed. Without a transaction boundary, account.save! persists even if Order.create! fails.',
	},
];

// OptionCard step 2: Handle custom abort
const ROLLBACK_OPTIONS = [
	{
		id: 'wrong-return-false',
		label: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  return false if amount > account.balance
  Order.create!(account:, total: amount)
end`,
		correct: false,
		feedback:
			'Returning false inside a transaction does NOT trigger a rollback. The transaction commits normally with the balance already deducted. You need to raise to abort.',
	},
	{
		id: 'wrong-throw',
		label: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  throw :abort if amount > account.balance
  Order.create!(account:, total: amount)
end`,
		correct: false,
		feedback:
			'In Ruby, throw/catch is for flow control, not exception handling. ActiveRecord transactions respond to raise, not throw. Use the built-in rollback exception.',
	},
	{
		id: 'correct-rollback-raise',
		label: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  if account.balance < 0
    raise ActiveRecord::Rollback,
      "Insufficient funds"
  end
  Order.create!(account:, total: amount)
end`,
		correct: true,
	},
];

// OptionCard step 3: Build ProcessOrder service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class ProcessOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(account_id:, amount:, items:)
    @account_id = account_id
    @amount = amount
    @items = items
  end

  def call
    ActiveRecord::Base.transaction do
      account = Account.find(@account_id)
      account.balance -= @amount
      account.save!
      order = Order.create!(account:, total: @amount,
        items: @items)
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, order:, errors: [])
    end
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success?: false, order: nil,
      errors: [e.message])
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class ProcessOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(account_id:, amount:, items:)
    @account_id = account_id
    @amount = amount
    @items = items
  end

  def call
    v = OrderContract.new.call(
      account_id: @account_id,
      amount: @amount, items: @items)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      account = Account.find(@account_id)
      raise ActiveRecord::Rollback if account.balance < @amount
      account.balance -= @amount
      account.save!
      order = Order.create!(account:, total: @amount,
        items: @items)
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, order:, errors: [])
    end || Result.new(success?: false, order: nil,
      errors: ["Insufficient funds"])
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
			'What is the root cause of partial failures in the order processing pipeline?',
		options: IDENTIFY_OPTIONS,
	},
	1: {
		title: 'Wrap Operations in a Transaction',
		description:
			'Choose the code that ensures charge, order creation, and audit log succeed or fail together.',
		options: TRANSACTION_OPTIONS,
	},
	2: {
		title: 'Handle Custom Abort',
		description:
			'Inside a transaction, how do you abort and trigger a rollback when a business rule fails?',
		options: ROLLBACK_OPTIONS,
	},
	3: {
		title: 'Build the Order Service',
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
		id: 'valid-order',
		label: 'POST order $50 (valid)',
		description: 'Process a valid order with sufficient balance',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'Transaction: charge -> order -> audit -> commit',
				color: 'cyan',
			},
			{ text: 'All 3 operations committed atomically.', color: 'green' },
		],
	},
	{
		id: 'order-with-coupon',
		label: 'POST order $30 with coupon',
		description: 'Order with coupon discount applied',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'user with coupon',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '201 Created', color: 'green' },
			{
				text: 'Transaction: validate coupon -> charge $30 -> order -> audit -> commit',
				color: 'cyan',
			},
		],
	},
	{
		id: 'invalid-amount',
		label: 'POST order -$10 (invalid)',
		description: 'Negative amount rejected by contract validation',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'OrderContract: amount must be greater than 0',
				color: 'yellow',
			},
			{
				text: 'Rejected before transaction. No writes attempted.',
				color: 'cyan',
			},
		],
	},
	{
		id: 'order-creation-fails',
		label: 'POST order (creation error)',
		description: 'Order creation fails mid-transaction, rollback triggered',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'Order.create! raised RecordInvalid',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Balance unchanged.',
				color: 'green',
			},
		],
	},
	{
		id: 'audit-fails-rollback',
		label: 'POST order (audit fails, rollback)',
		description: 'Audit log creation fails, entire transaction rolls back',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'AuditLog.create! raised ConnectionError',
				color: 'yellow',
			},
			{
				text: 'Transaction ROLLED BACK. Balance and order both undone.',
				color: 'green',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Operation pipeline box states
// ──────────────────────────────────────────────

type BoxState =
	| 'idle'
	| 'running'
	| 'success'
	| 'failed'
	| 'skipped'
	| 'rollback';

interface PipelineBoxProps {
	icon: React.ReactNode;
	label: string;
	code: string;
	state: BoxState;
	wrapped?: boolean;
}

function PipelineBox({ icon, label, code, state, wrapped }: PipelineBoxProps) {
	return (
		<div
			className={cn(
				'rounded-lg border-2 px-4 py-3 transition-all duration-300',
				state === 'idle' && 'border-muted-foreground/30 bg-card',
				state === 'running' &&
					'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
				state === 'success' &&
					'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
				state === 'failed' &&
					'border-destructive bg-destructive/10 dark:bg-destructive/20',
				state === 'skipped' &&
					'border-muted-foreground/20 bg-muted/30 opacity-50',
				state === 'rollback' &&
					'border-destructive bg-destructive/5 dark:bg-destructive/10 opacity-70',
				wrapped && 'ring-2 ring-primary/30',
			)}
		>
			<div className="flex items-center gap-2">
				<div
					className={cn(
						'shrink-0',
						state === 'success' && 'text-emerald-600 dark:text-emerald-400',
						state === 'failed' && 'text-destructive',
						state === 'rollback' && 'text-destructive/60',
						state === 'running' && 'text-amber-600 dark:text-amber-400',
						(state === 'idle' || state === 'skipped') &&
							'text-muted-foreground',
					)}
				>
					{icon}
				</div>
				<div className="flex-1 min-w-0">
					<div
						className={cn(
							'font-semibold text-sm',
							state === 'success' && 'text-emerald-700 dark:text-emerald-300',
							state === 'failed' && 'text-destructive',
							state === 'rollback' && 'text-destructive/60',
							state === 'running' && 'text-amber-700 dark:text-amber-300',
							(state === 'idle' || state === 'skipped') && 'text-foreground',
						)}
					>
						{label}
					</div>
					<code className="text-xs text-muted-foreground font-mono">
						{code}
					</code>
				</div>
				<div className="shrink-0">
					{state === 'success' && (
						<CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
					)}
					{state === 'failed' && (
						<CircleX className="w-4 h-4 text-destructive" />
					)}
					{state === 'rollback' && (
						<CircleX className="w-4 h-4 text-destructive/50" />
					)}
				</div>
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
				filename: 'app/services/process_order.rb',
				language: 'ruby',
				code: `class ProcessOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(account_id:, amount:, items:)
    @account_id = account_id
    @amount = amount
    @items = items
  end

  def call
    v = OrderContract.new.call(
      account_id: @account_id,
      amount: @amount, items: @items)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    account = Account.find(@account_id)
    account.balance -= @amount
    account.save!
    # Step 1 committed. If step 2 fails...
    order = Order.create!(account:, total: @amount,
      items: @items)
    # Step 2 committed. If step 3 fails...
    AuditLog.create!(account:, amount: -@amount,
      balance_after: account.balance)
    Result.new(success?: true, order:, errors: [])
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
					filename: 'app/services/process_order.rb (broken)',
					language: 'ruby',
					code: `# Each operation commits independently.
# If step 2 or 3 fails, step 1 is already
# persisted and cannot be undone.

account.balance -= amount
account.save!           # Committed!
Order.create!(...)      # Might fail
AuditLog.create!(...)   # Might fail`,
					highlight: [5, 6],
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'app/services/process_order.rb (next step)',
					language: 'ruby',
					code: `# Wrap all operations in a transaction...`,
				},
			];
		}
		if (furthestStep === 2) {
			return [
				{
					filename: 'app/services/process_order.rb (transaction added)',
					language: 'ruby',
					code: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  Order.create!(account:, total: amount)
  AuditLog.create!(account:, amount: -amount,
    balance_after: account.balance)
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
					filename: 'app/services/process_order.rb (rollback added)',
					language: 'ruby',
					code: `ActiveRecord::Base.transaction do
  account.balance -= amount
  account.save!
  if account.balance < 0
    raise ActiveRecord::Rollback,
      "Insufficient funds"
  end
  Order.create!(account:, total: amount)
  AuditLog.create!(account:, amount: -amount,
    balance_after: account.balance)
end
# raise ActiveRecord::Rollback silently aborts
# the transaction without propagating the error.`,
					highlight: [4, 5, 6],
				},
			];
		}
	}

	// Activate + reward: complete solution
	return [
		{
			filename: 'app/contracts/order_contract.rb',
			language: 'ruby',
			code: `class OrderContract < Dry::Validation::Contract
  params do
    required(:account_id).filled(:integer)
    required(:amount).filled(:decimal, gt?: 0)
    required(:items).filled(:array, min_size?: 1)
  end
end`,
		},
		{
			filename: 'app/services/process_order.rb',
			language: 'ruby',
			code: `class ProcessOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(account_id:, amount:, items:)
    @account_id = account_id
    @amount = amount
    @items = items
  end

  def call
    v = OrderContract.new.call(
      account_id: @account_id,
      amount: @amount, items: @items)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      account = Account.find(@account_id)
      raise ActiveRecord::Rollback if account.balance < @amount
      account.balance -= @amount
      account.save!
      order = Order.create!(account:, total: @amount,
        items: @items)
      AuditLog.create!(account:, amount: -@amount,
        balance_after: account.balance)
      Result.new(success?: true, order:, errors: [])
    end || Result.new(success?: false, order: nil,
      errors: ["Insufficient funds"])
  end
end`,
			highlight: [17, 19, 27, 28],
		},
		{
			filename: 'app/controllers/api/v1/orders_controller.rb',
			language: 'ruby',
			code: `class Api::V1::OrdersController < ApplicationController
  def create
    result = ProcessOrder.call(
      account_id: Current.user.account_id,
      amount: order_params[:amount],
      items: order_params[:items])
    if result.success?
      render json: OrderSerializer.new(result.order),
        status: :created
    else
      render json: { error: {
        code: "ORDER_FAILED",
        message: "Could not process order",
        details: result.errors } },
        status: :unprocessable_entity
    end
  end

  private

  def order_params
    params.expect(order: [:amount, items: []])
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
		minRequired: 3,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Visualization state
	const [vizAnimating, setVizAnimating] = useState(false);
	const [boxStates, setBoxStates] = useState<[BoxState, BoxState, BoxState]>([
		'idle',
		'idle',
		'idle',
	]);
	const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Reward visualization state
	const [rewardBoxStates, setRewardBoxStates] = useState<
		[BoxState, BoxState, BoxState]
	>(['idle', 'idle', 'idle']);
	const [showTransactionBorder, setShowTransactionBorder] = useState(false);

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

			const step = ANIMATION_DURATION_MS;

			if (probeId === 'order-fail') {
				// Box 1 runs and succeeds, box 2 fails, box 3 skipped
				setBoxStates(['running', 'idle', 'idle']);
				const t1 = setTimeout(() => {
					setBoxStates(['success', 'running', 'idle']);
				}, step);
				const t2 = setTimeout(() => {
					setBoxStates(['success', 'failed', 'skipped']);
				}, step * 2);
				const t3 = setTimeout(() => {
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				}, step * 3);
				animTimerRef.current.push(t1, t2, t3);
			} else if (probeId === 'audit-fail') {
				// Box 1 and 2 succeed, box 3 fails
				setBoxStates(['running', 'idle', 'idle']);
				const t1 = setTimeout(() => {
					setBoxStates(['success', 'running', 'idle']);
				}, step);
				const t2 = setTimeout(() => {
					setBoxStates(['success', 'success', 'running']);
				}, step * 2);
				const t3 = setTimeout(() => {
					setBoxStates(['success', 'success', 'failed']);
				}, step * 3);
				const t4 = setTimeout(() => {
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				}, step * 4);
				animTimerRef.current.push(t1, t2, t3, t4);
			} else {
				// inspect-code: just show current state briefly
				const t1 = setTimeout(() => {
					setVizAnimating(false);
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				}, step);
				animTimerRef.current.push(t1);
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
			const step = ANIMATION_DURATION_MS;

			if (scenario.expectedResult === 'allowed') {
				// All boxes run and succeed together
				setRewardBoxStates(['running', 'running', 'running']);
				const t1 = setTimeout(() => {
					setRewardBoxStates(['success', 'success', 'success']);
				}, step);
				const t2 = setTimeout(() => {
					setVizAnimating(false);
				}, step * 2);
				animTimerRef.current.push(t1, t2);
			} else {
				// Show failure then rollback
				setRewardBoxStates(['running', 'running', 'running']);
				const t1 = setTimeout(() => {
					// One fails
					if (scenarioId === 'order-creation-fails') {
						setRewardBoxStates(['success', 'failed', 'skipped']);
					} else if (scenarioId === 'audit-fails-rollback') {
						setRewardBoxStates(['success', 'success', 'failed']);
					} else {
						setRewardBoxStates(['failed', 'skipped', 'skipped']);
					}
				}, step);
				const t2 = setTimeout(() => {
					// Rollback: all revert
					setRewardBoxStates(['rollback', 'rollback', 'rollback']);
				}, step * 2);
				const t3 = setTimeout(() => {
					setRewardBoxStates(['idle', 'idle', 'idle']);
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
		setBoxStates(['idle', 'idle', 'idle']);
	};

	const handleActivateReward = () => {
		setPhase('reward');
		setRewardBoxStates(['idle', 'idle', 'idle']);
		setShowTransactionBorder(false);
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

	// ──────────────────────────────────────────
	// Render: Operation Pipeline Visualization
	// ──────────────────────────────────────────

	const PIPELINE_BOXES: Omit<PipelineBoxProps, 'state' | 'wrapped'>[] = [
		{
			icon: <Database className="w-5 h-5" />,
			label: 'Charge Account',
			code: 'account.balance -= 100',
		},
		{
			icon: <ShoppingCart className="w-5 h-5" />,
			label: 'Create Order',
			code: 'Order.create!(...)',
		},
		{
			icon: <FileText className="w-5 h-5" />,
			label: 'Create Audit Log',
			code: 'AuditLog.create!(...)',
		},
	];

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

			{/* Vertical pipeline */}
			<div className="flex flex-col items-center gap-0 w-full max-w-sm">
				{PIPELINE_BOXES.map((box, i) => (
					<div className="w-full flex flex-col items-center" key={box.label}>
						<PipelineBox
							code={box.code}
							icon={box.icon}
							label={box.label}
							state={boxStates[i]}
						/>
						{i < PIPELINE_BOXES.length - 1 && (
							<FlowConnector
								active={
									boxStates[i] === 'running' || boxStates[i] === 'success'
								}
								dotColor={
									boxStates[i] === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
								}
							/>
						)}
					</div>
				))}
			</div>

			{/* Problem callout */}
			<div className="max-w-sm w-full bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center mt-2">
				<p className="text-xs text-muted-foreground">
					{boxStates[1] === 'failed'
						? 'Account was charged but no order was created. The $100 is gone with nothing to show for it.'
						: boxStates[2] === 'failed'
							? 'Order exists but no audit trail. Compliance requires every financial operation to be logged.'
							: 'Fire probes to see what happens when an operation fails midway through the pipeline.'}
				</p>
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

			{/* Vertical pipeline wrapped in transaction border */}
			<div
				className={cn(
					'flex flex-col items-center gap-0 w-full max-w-sm rounded-xl p-3 transition-all duration-300',
					showTransactionBorder &&
						'border-2 border-dashed border-primary/50 bg-primary/5 dark:bg-primary/10',
				)}
			>
				{showTransactionBorder && (
					<div className="text-xs font-mono text-primary mb-2">
						ActiveRecord::Base.transaction do
					</div>
				)}
				{PIPELINE_BOXES.map((box, i) => (
					<div className="w-full flex flex-col items-center" key={box.label}>
						<PipelineBox
							code={box.code}
							icon={box.icon}
							label={box.label}
							state={rewardBoxStates[i]}
							wrapped={showTransactionBorder}
						/>
						{i < PIPELINE_BOXES.length - 1 && (
							<FlowConnector
								active={
									rewardBoxStates[i] === 'running' ||
									rewardBoxStates[i] === 'success'
								}
								dotColor={
									rewardBoxStates[i] === 'success'
										? 'bg-emerald-500'
										: rewardBoxStates[i] === 'rollback'
											? 'bg-destructive'
											: 'bg-amber-500'
								}
							/>
						)}
					</div>
				))}
				{showTransactionBorder && (
					<div className="text-xs font-mono text-primary mt-2">end</div>
				)}
			</div>

			{/* Status callout */}
			{rewardBoxStates.some((s) => s === 'rollback') && (
				<div className="max-w-sm w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2 text-center">
					<p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
						ROLLBACK: All writes undone. Database unchanged.
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
					goal="Protect data integrity with transactions so multi-step operations either all succeed or all fail together."
					instructions={
						phase === 'observe'
							? [
									'Fire probes to see partial failures in the order pipeline',
									'Watch what happens when step 2 or step 3 fails',
									'Discover all 3 atomicity problems',
								]
							: phase === 'build'
								? [
										'Identify the root cause of partial failures',
										'Wrap operations in a database transaction',
										'Handle business rule failures with rollback',
										'Build a service with contract and transaction',
									]
								: phase === 'reward'
									? [
											'Fire scenarios to verify transactions protect integrity',
											'Watch failures trigger rollbacks across all operations',
											'See how the pipeline handles edge cases atomically',
										]
									: ['Review your star rating and visualize the solution']
					}
					scenario="The order pipeline charges an account, creates an order, and logs an audit. Without a transaction, a failure at step 2 or 3 leaves the database in an inconsistent state."
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
									title="Order Pipeline Probe"
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
								Visualize Transactions
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

export default Level33Transactions;

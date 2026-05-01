/**
 * Level 33: Locking (Concurrency Control)
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Split-screen concurrency visualization.
 *   Database table card (persistent) + two request cards side-by-side.
 *   Animated sequence shows both requests reading stale data, then one
 *   overwriting the other. Mismatch counter makes the consequence concrete.
 *   ProbeTerminal fires concurrent scenarios revealing lost updates.
 *
 * Phase 2 (HOW - build): 5 steps (2 terminal + 3 OptionCard)
 *   Step 0: Generate lock_version:integer migration (terminal)
 *   Step 1: Run rails db:migrate (terminal)
 *   Step 2: Add pessimistic locking with Product.lock.find(id) (OptionCard)
 *   Step 3: Build PlaceOrder service with contract + lock (OptionCard)
 *   Step 4: Handle StaleObjectError for optimistic locking (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same layout, now showing locks working.
 *   Request A acquires lock, Request B waits, then processes with fresh data.
 *
 * Teaches: Product.lock.find, with_lock, lock_version, optimistic vs
 *   pessimistic locking, StaleObjectError handling, SELECT ... FOR UPDATE
 */

import {
	AlertTriangle,
	ArrowRight,
	Clock,
	Cpu,
	Database,
	Lock,
	Save,
	ShieldCheck,
	Unlock,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import { cn } from '@/lib/utils';

registerLevelCode('act5-level33-locking', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'lost-update',
		label: "Customer A's order overwrites Customer B's stock update",
	},
	{
		id: 'no-lock',
		label: 'No mechanism prevents simultaneous row access',
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'concurrent-checkout': ['lost-update'],
	'stale-product-edit': ['no-lock'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'stale-product-edit',
		label: 'Stale product edit',
		command:
			'# Admin A: raise price by $10, Admin B: raise price by $5 (simultaneously)',
		responseLines: [
			{
				text: 'Admin A: Product.find(1) => price: $50.00, lock_version: nil',
				color: 'cyan',
			},
			{
				text: 'Admin B: Product.find(1) => price: $50.00, lock_version: nil',
				color: 'cyan',
			},
			{
				text: 'Admin A: sets price = $60.00 ($50 + $10) => saved',
				color: 'yellow',
			},
			{
				text: 'Admin B: sets price = $55.00 ($50 + $5) => saved (OVERWRITES $60!)',
				color: 'red',
			},
			{
				text: 'Final price: $55. $15 in adjustments, only $5 applied.',
				color: 'red',
			},
		],
		story: [
			'Admin A opens the Laptop Pro product page to raise the price by $10.',
			'Admin B opens the same page at the same time to raise the price by $5.',
			'Both see the current price: $50.00.',
			'Admin A saves first, setting it to $60.00.',
			'Admin B saves a moment later, overwriting it to $55.00 (based on the stale $50).',
			"Admin A's $10 increase is silently lost.",
		],
	},
	{
		id: 'concurrent-checkout',
		label: 'Concurrent checkouts',
		command: '# Customer A: buy 10, Customer B: buy 8 (simultaneously)',
		responseLines: [
			{
				text: 'Customer A: Product.find(1) => stock_count: 15',
				color: 'cyan',
			},
			{
				text: 'Customer B: Product.find(1) => stock_count: 15',
				color: 'cyan',
			},
			{
				text: 'Customer A: 15 - 10 = 5, saves stock_count = 5',
				color: 'yellow',
			},
			{
				text: 'Customer B: 15 - 8 = 7, saves stock_count = 7 (OVERWRITES 5!)',
				color: 'red',
			},
			{
				text: 'Final stock: 7. 18 units sold, only 8 deducted from 15!',
				color: 'red',
			},
			{
				text: "Request A's deduction was silently overwritten.",
				color: 'red',
			},
		],
		story: [
			'Customer A adds 10 Laptop Pros to their cart and clicks checkout.',
			'Customer B adds 8 of the same product and checks out simultaneously.',
			'Both requests read stock_count: 15 from the database.',
			'Customer A saves stock_count = 5 (15 minus 10).',
			'Customer B saves stock_count = 7 (15 minus 8), overwriting the first write.',
			'18 units were sold but only 8 deducted. Inventory is now wrong.',
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
	{ id: 'build-service', title: 'Build Order Service' },
	{ id: 'handle-stale-error', title: 'Handle Conflicts' },
];

// Terminal step 0: Add lock_version migration
const LOCK_VERSION_COMMANDS = [
	{
		id: 'wrong-boolean',
		label: 'rails g migration AddLockedToProducts locked:boolean',
		command: 'rails generate migration AddLockedToProducts locked:boolean',
		correct: false,
		feedback:
			'A boolean flag cannot detect concurrent modifications. Optimistic locking needs a column that tracks how many times a record has been saved.',
	},
	{
		id: 'wrong-timestamp',
		label: 'rails g migration AddUpdatedAtToProducts updated_at:datetime',
		command:
			'rails generate migration AddUpdatedAtToProducts updated_at:datetime',
		correct: false,
		feedback:
			'Timestamps have precision issues with concurrent writes. Rails needs an auto-incrementing counter to detect exact version mismatches.',
	},
	{
		id: 'correct-lock-version',
		label: 'rails g migration AddLockVersionToProducts lock_version:integer',
		command:
			'rails generate migration AddLockVersionToProducts lock_version:integer',
		correct: true,
	},
];

const LOCK_VERSION_OUTPUT = [
	{ text: '  invoke  active_record', color: 'green' as const },
	{
		text: '  create    db/migrate/..._add_lock_version_to_products.rb',
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
		text: '== AddLockVersionToProducts: migrating ===',
		color: 'green' as const,
	},
	{
		text: '-- add_column(:products, :lock_version, :integer, {:default=>0, :null=>false})',
		color: 'green' as const,
	},
	{
		text: '== AddLockVersionToProducts: migrated ====',
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
  product = Product.find(id)
  # No lock acquired!
  product.stock_count -= amount
  product.save!
end`,
		correct: false,
		feedback:
			'A plain find does not acquire a row lock. Another transaction can read and modify the same row concurrently, causing a lost update.',
	},
	{
		id: 'correct-lock',
		label: `ActiveRecord::Base.transaction do
  product = Product.lock.find(id)
  # SELECT ... FOR UPDATE locks the row
  raise InsufficientStockError if product.stock_count < amount
  product.stock_count -= amount
  product.save!
end`,
		correct: true,
	},
	{
		id: 'wrong-with-lock-outside',
		label: `product = Product.find(id)
product.with_lock do
  product.stock_count -= amount
  product.save!
end
# Lock released, but audit log outside lock
AuditLog.create!(product:, quantity: -amount)`,
		correct: false,
		feedback:
			'The audit log creation is outside the lock block. If it fails, the stock was already changed. All related writes must be inside the same locked transaction.',
	},
];

// OptionCard step 3: Build service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :product, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = amount
  end

  def call
    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      Result.new(success?: true, product:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, product: nil,
      errors: ["Insufficient stock"])
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :product, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = amount
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      product: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      AuditLog.create!(product:, quantity: @quantity,
        stock_after: product.stock_count)
      Result.new(success?: true, product:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, product: nil,
      errors: ["Insufficient stock"])
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
result = UpdateProduct.call(product_id:, params:)
# No StaleObjectError handling
# If two admins edit simultaneously, one silently overwrites`,
		correct: false,
		feedback:
			'Without handling StaleObjectError, the second writer silently overwrites the first. Optimistic locking requires catching and retrying or reporting the conflict.',
	},
	{
		id: 'correct-rescue-retry',
		label: `# In controller:
def update
  result = UpdateProduct.call(
    product_id: params[:id], params: product_params)
  if result.success?
    render json: ProductSerializer.new(result.product)
  else
    render json: { error: { code: "VALIDATION_FAILED",
      message: "Update failed",
      details: result.errors } }, status: :unprocessable_entity
  end
rescue ActiveRecord::StaleObjectError
  render json: { error: { code: "CONFLICT",
    message: "Record was modified by another admin",
    details: {} } }, status: :conflict
end`,
		correct: true,
	},
	{
		id: 'wrong-pessimistic-everywhere',
		label: `# In controller:
def update
  ActiveRecord::Base.transaction do
    product = Product.lock.find(params[:id])
    product.update!(product_params)
    render json: ProductSerializer.new(product)
  end
end
# Pessimistic lock for a product listing edit`,
		correct: false,
		feedback:
			'Pessimistic locking for low-contention product edits is overkill. It blocks concurrent reads and can cause deadlocks. Use optimistic locking (lock_version) with StaleObjectError handling instead.',
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
		title: 'Build the Order Service',
		description:
			'Create a service object with contract validation, transaction, and pessimistic locking.',
		options: SERVICE_OPTIONS,
	},
	4: {
		title: 'Handle Optimistic Lock Conflicts',
		description:
			'When two admins edit the same product, the second save should fail instead of silently overwriting. Handle the version conflict in the controller.',
		options: STALE_ERROR_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'single-order',
		label: 'POST order (buy 10)',
		description: 'Single customer buys 10 units',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Transaction: lock -> deduct 10 -> create order -> create order -> commit',
				color: 'cyan',
			},
			{ text: 'Stock: 15 -> 5', color: 'green' },
		],
	},
	{
		id: 'concurrent-order-locked',
		label: 'POST concurrent orders (locked)',
		description: 'Two customers order simultaneously with FOR UPDATE lock',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A + Customer B',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: '200 OK (both succeed, serialized)',
				color: 'green',
			},
			{
				text: 'Customer A: lock -> 15 - 10 = 5 -> commit',
				color: 'cyan',
			},
			{
				text: 'Customer B: waits... lock -> 5 - 3 = 2 -> commit',
				color: 'cyan',
			},
			{
				text: 'Final stock: 2 (both orders applied correctly!)',
				color: 'green',
			},
		],
	},
	{
		id: 'transfer',
		label: 'POST order (buy 5 units)',
		description: 'Single checkout: lock product, deduct stock, create order',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Transaction: lock -> deduct 5 -> create order -> audit log -> commit',
				color: 'cyan',
			},
			{ text: 'Stock: 15 -> 10', color: 'green' },
		],
	},
	{
		id: 'concurrent-checkout',
		label: 'POST concurrent checkouts (locked)',
		description:
			'Two customers check out simultaneously, both correctly serialized',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A + Customer B',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: '200 OK (both succeed, serialized)',
				color: 'green',
			},
			{
				text: 'Customer A: lock -> 15 - 10 = 5 -> commit',
				color: 'cyan',
			},
			{
				text: 'Customer B: waits... lock -> 5 - 8 = insufficient!',
				color: 'yellow',
			},
			{
				text: 'Customer A committed, Customer B rejected. No lost update.',
				color: 'green',
			},
		],
	},
	{
		id: 'insufficient-stock',
		label: 'POST order (buy 100, insufficient)',
		description: 'Try to order more than available stock',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: '{ error: { code: "INSUFFICIENT_STOCK" } }',
				color: 'yellow',
			},
			{
				text: 'Transaction rolled back. Stock unchanged.',
				color: 'green',
			},
		],
	},
	{
		id: 'stale-product-edit',
		label: 'PATCH product (stale version)',
		description: 'Edit product that was already modified by another admin',
		method: 'PATCH',
		path: '/api/v1/products/1',
		actor: 'Admin B (stale)',
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
		label: 'POST order (-5 quantity, invalid)',
		description: 'Try to deduct a negative amount',
		method: 'POST',
		path: '/api/v1/orders',
		actor: 'Customer A',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{
				text: 'OrderContract: amount must be greater than 0',
				color: 'yellow',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Concurrency visualization types
// ──────────────────────────────────────────────

type DbCellFlash =
	| 'idle'
	| 'reading'
	| 'success'
	| 'overwrite'
	| 'locked'
	| 'waiting';

interface ProductRowState {
	columns: string[];
	values: string[];
	flashCells: Record<number, DbCellFlash>;
}

interface RequestLogEntry {
	icon: 'database' | 'cpu' | 'save' | 'alert' | 'lock' | 'clock';
	text: string;
	variant: 'default' | 'success' | 'danger' | 'warning';
}

interface RequestCardState {
	label: string;
	endpoint: string;
	params: string;
	color: 'blue' | 'purple';
	log: RequestLogEntry[];
	badge?: { text: string; variant: 'success' | 'danger' | 'warning' };
}

interface AnimationFrame {
	dbRow?: Partial<ProductRowState>;
	requestA?: {
		newLogEntry?: RequestLogEntry;
		badge?: RequestCardState['badge'];
	};
	requestB?: {
		newLogEntry?: RequestLogEntry;
		badge?: RequestCardState['badge'];
	};
	mismatchCounter?: string;
	warningMessage?: string;
}

// ── Animation frame sequences ──

const OBSERVE_CHECKOUT_FRAMES: AnimationFrame[] = [
	{
		dbRow: { flashCells: { 3: 'reading' } },
		requestA: {
			newLogEntry: {
				icon: 'database',
				text: 'Reading stock_count...',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'database',
				text: 'Reading stock_count...',
				variant: 'default',
			},
		},
	},
	{
		dbRow: { flashCells: {} },
		requestA: {
			newLogEntry: {
				icon: 'database',
				text: 'Read: stock_count = 15',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'database',
				text: 'Read: stock_count = 15',
				variant: 'default',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Computing: 15 - 10 = 5',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Computing: 15 - 8 = 7',
				variant: 'default',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$50.00', '5', '(none)'],
			flashCells: { 3: 'success' },
		},
		requestA: {
			newLogEntry: {
				icon: 'save',
				text: 'Saved! stock_count = 5',
				variant: 'success',
			},
			badge: { text: 'SAVED', variant: 'success' },
		},
		requestB: {
			newLogEntry: {
				icon: 'clock',
				text: 'Still computing...',
				variant: 'warning',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$50.00', '7', '(none)'],
			flashCells: { 3: 'overwrite' },
		},
		requestB: {
			newLogEntry: {
				icon: 'alert',
				text: 'OVERWRITES! stock_count = 7',
				variant: 'danger',
			},
			badge: { text: 'OVERWRITES', variant: 'danger' },
		},
		mismatchCounter: '18 units sold, only 8 deducted',
		warningMessage:
			"Request B saved stock_count = 7 using the 15 it read before Request A saved. Request A's deduction to 5 was silently overwritten. 18 units sold from 15 in stock.",
	},
];

const OBSERVE_STALE_EDIT_FRAMES: AnimationFrame[] = [
	{
		dbRow: {
			columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
			values: ['1', 'Laptop Pro', '$50.00', '15', '(none)'],
			flashCells: { 2: 'reading' },
		},
		requestA: {
			newLogEntry: {
				icon: 'database',
				text: 'Reading product...',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'database',
				text: 'Reading product...',
				variant: 'default',
			},
		},
	},
	{
		dbRow: { flashCells: {} },
		requestA: {
			newLogEntry: {
				icon: 'database',
				text: 'Read: price = $50.00',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'database',
				text: 'Read: price = $50.00',
				variant: 'default',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Setting price = $60.00 ($50 + $10)',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'clock',
				text: 'Still editing...',
				variant: 'warning',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$60.00', '15', '(none)'],
			flashCells: { 2: 'success' },
		},
		requestA: {
			newLogEntry: {
				icon: 'save',
				text: 'Saved! price = $60.00',
				variant: 'success',
			},
			badge: { text: 'SAVED', variant: 'success' },
		},
		requestB: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Setting price = $55.00 ($50 + $5)',
				variant: 'default',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$55.00', '15', '(none)'],
			flashCells: { 2: 'overwrite' },
		},
		requestB: {
			newLogEntry: {
				icon: 'alert',
				text: 'OVERWRITES! price = $55.00',
				variant: 'danger',
			},
			badge: { text: 'OVERWRITES', variant: 'danger' },
		},
		mismatchCounter: '$15 in adjustments, only $5 applied',
		warningMessage:
			"Admin B saved $55 using the $50 they read before Admin A saved $60. Admin A's $10 raise was silently lost. Price should be $65, not $55.",
	},
];

const REWARD_ALLOWED_FRAMES: AnimationFrame[] = [
	{
		dbRow: { flashCells: { 3: 'locked' } },
		requestA: {
			newLogEntry: {
				icon: 'lock',
				text: 'SELECT ... FOR UPDATE (lock acquired)',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'clock',
				text: 'WAITING... (row locked by Request A)',
				variant: 'warning',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Computing: 15 - 10 = 5',
				variant: 'default',
			},
		},
		requestB: {
			newLogEntry: {
				icon: 'clock',
				text: 'Still waiting...',
				variant: 'warning',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$50.00', '5', '1'],
			flashCells: { 3: 'success', 4: 'success' },
		},
		requestA: {
			newLogEntry: {
				icon: 'save',
				text: 'COMMIT! stock_count = 5, lock_version = 1',
				variant: 'success',
			},
			badge: { text: 'COMMITTED', variant: 'success' },
		},
	},
	{
		dbRow: { flashCells: { 3: 'locked' } },
		requestB: {
			newLogEntry: {
				icon: 'lock',
				text: 'Lock acquired. Reading FRESH stock_count = 5',
				variant: 'default',
			},
		},
	},
	{
		dbRow: {
			values: ['1', 'Laptop Pro', '$50.00', '2', '2'],
			flashCells: { 3: 'success', 4: 'success' },
		},
		requestB: {
			newLogEntry: {
				icon: 'save',
				text: 'COMMIT! stock_count = 5 - 3 = 2, lock_version = 2',
				variant: 'success',
			},
			badge: { text: 'COMMITTED', variant: 'success' },
		},
		mismatchCounter: '13 units sold, 13 deducted. Correct!',
	},
];

const BLOCKED_FRAMES_INSUFFICIENT_STOCK: AnimationFrame[] = [
	{
		dbRow: { flashCells: { 3: 'locked' } },
		requestA: {
			newLogEntry: {
				icon: 'lock',
				text: 'SELECT ... FOR UPDATE (lock acquired)',
				variant: 'default',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Checking: stock_count (15) >= quantity (100)?',
				variant: 'default',
			},
		},
	},
	{
		dbRow: { flashCells: {} },
		requestA: {
			newLogEntry: {
				icon: 'alert',
				text: 'InsufficientStockError! 15 < 100. ROLLBACK.',
				variant: 'danger',
			},
			badge: { text: 'REJECTED', variant: 'danger' },
		},
		warningMessage:
			'Only 15 units in stock, but 100 requested. Transaction rolled back. Stock unchanged.',
	},
];

const BLOCKED_FRAMES_STALE_VERSION: AnimationFrame[] = [
	{
		requestA: {
			newLogEntry: {
				icon: 'database',
				text: 'Admin loaded edit form earlier: GET /products/1 returned lock_version: 0',
				variant: 'default',
			},
		},
	},
	{
		dbRow: { flashCells: { 4: 'reading' } },
		requestA: {
			newLogEntry: {
				icon: 'save',
				text: 'PATCH /products/1 with lock_version: 0 from form',
				variant: 'default',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'Rails checks: WHERE lock_version = 0... but DB has lock_version = 2',
				variant: 'warning',
			},
		},
	},
	{
		dbRow: { flashCells: {} },
		requestA: {
			newLogEntry: {
				icon: 'alert',
				text: 'StaleObjectError! 0 rows updated. Version mismatch.',
				variant: 'danger',
			},
			badge: { text: 'CONFLICT', variant: 'danger' },
		},
		warningMessage:
			'The admin loaded the form when lock_version was 0. Another admin saved in between, bumping it to 2. The stale PATCH was rejected. Client can reload the form and retry with the current version.',
	},
];

const BLOCKED_FRAMES_INVALID_AMOUNT: AnimationFrame[] = [
	{
		requestA: {
			newLogEntry: {
				icon: 'cpu',
				text: 'OrderContract validating: { quantity: -5 }',
				variant: 'default',
			},
		},
	},
	{
		requestA: {
			newLogEntry: {
				icon: 'alert',
				text: 'Contract failed: quantity must be greater than 0',
				variant: 'danger',
			},
			badge: { text: 'REJECTED', variant: 'danger' },
		},
		warningMessage:
			'Contract validation rejected the request before it reached the database. No lock acquired, no transaction started.',
	},
];

const BLOCKED_FRAMES_MAP: Record<string, AnimationFrame[]> = {
	'insufficient-stock': BLOCKED_FRAMES_INSUFFICIENT_STOCK,
	'stale-product-edit': BLOCKED_FRAMES_STALE_VERSION,
	'invalid-amount': BLOCKED_FRAMES_INVALID_AMOUNT,
};

// ── Inline visualization components ──

const LOG_ICONS: Record<RequestLogEntry['icon'], typeof Database> = {
	database: Database,
	cpu: Cpu,
	save: Save,
	alert: AlertTriangle,
	lock: Lock,
	clock: Clock,
};

const FLASH_STYLES: Record<DbCellFlash, string> = {
	idle: '',
	reading:
		'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 transition-colors duration-300',
	success:
		'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 transition-colors duration-300',
	overwrite:
		'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 transition-colors duration-300',
	locked:
		'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 transition-colors duration-300',
	waiting:
		'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 transition-colors duration-300',
};

function ProductTable({ row }: { row: ProductRowState }) {
	return (
		<div className="w-full max-w-2xl mx-auto">
			<div className="flex items-center gap-1.5 mb-1.5">
				<Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
				<span className="text-xs font-semibold text-teal-600 dark:text-teal-400 font-mono">
					products
				</span>
			</div>
			<div className="border border-border rounded-lg overflow-hidden">
				{/* Header */}
				<div
					className="grid bg-teal-50 dark:bg-teal-900/20 border-b border-border"
					style={{ gridTemplateColumns: `repeat(${row.columns.length}, 1fr)` }}
				>
					{row.columns.map((col) => (
						<div
							className="px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 font-mono border-r border-border last:border-r-0"
							key={col}
						>
							{col}
						</div>
					))}
				</div>
				{/* Row */}
				<div
					className="grid"
					style={{ gridTemplateColumns: `repeat(${row.columns.length}, 1fr)` }}
				>
					{row.values.map((val, i) => (
						<div
							className={cn(
								'px-3 py-2 text-xs font-mono border-r border-border last:border-r-0 transition-colors duration-300',
								FLASH_STYLES[row.flashCells[i] ?? 'idle'],
							)}
							key={`${row.columns[i]}-${val}`}
						>
							{val}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

const BADGE_STYLES: Record<string, string> = {
	success:
		'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600/50',
	danger:
		'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/50',
	warning:
		'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600/50',
};

const CARD_BORDER: Record<string, string> = {
	blue: 'border-blue-300 dark:border-blue-600/50',
	purple: 'border-purple-300 dark:border-purple-600/50',
};

const CARD_HEADER: Record<string, string> = {
	blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
	purple:
		'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
};

const LOG_VARIANT_STYLES: Record<string, string> = {
	default: 'text-muted-foreground',
	success: 'text-emerald-600 dark:text-emerald-400',
	danger: 'text-red-600 dark:text-red-400',
	warning: 'text-amber-600 dark:text-amber-400',
};

function RequestCard({ card }: { card: RequestCardState }) {
	return (
		<div
			className={cn(
				'flex-1 rounded-lg border overflow-hidden',
				CARD_BORDER[card.color],
			)}
		>
			{/* Header */}
			<div
				className={cn(
					'px-3 py-2 flex items-center justify-between',
					CARD_HEADER[card.color],
				)}
			>
				<div>
					<div className="text-xs font-semibold font-mono">{card.label}</div>
					<div className="text-xs font-mono opacity-70">{card.endpoint}</div>
				</div>
				{card.badge && (
					<span
						className={cn(
							'text-xs font-bold px-2 py-0.5 rounded border',
							BADGE_STYLES[card.badge.variant],
						)}
					>
						{card.badge.text}
					</span>
				)}
			</div>
			{/* Params */}
			<div className="px-3 py-1 bg-muted/30 border-b border-border">
				<code className="text-xs text-muted-foreground">{card.params}</code>
			</div>
			{/* Log entries */}
			<div className="px-3 py-2 space-y-1 min-h-[80px]">
				{card.log.map((entry, i) => {
					const Icon = LOG_ICONS[entry.icon];
					return (
						<div
							className={cn(
								'flex items-start gap-1.5 text-xs animate-in fade-in duration-300',
								LOG_VARIANT_STYLES[entry.variant],
							)}
							key={`${entry.text}-${i}`}
						>
							<Icon className="w-3 h-3 mt-0.5 shrink-0" />
							<span className="font-mono">{entry.text}</span>
						</div>
					);
				})}
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
				filename: 'app/services/place_order.rb',
				language: 'ruby',
				code: `class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :product, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = amount
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      product: nil, errors: v.errors.to_h) if v.failure?

    product = Product.find(@product_id)
    product.stock_count -= @quantity
    product.save!
    # No lock! Concurrent calls cause lost updates
    Result.new(success?: true, product:, errors: [])
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
# optimistic locking on Product`,
				},
			];
		}
		if (furthestStep === 1) {
			return [
				{
					filename: 'db/migrate/add_lock_version_to_products.rb (pending)',
					language: 'ruby',
					code: `class AddLockVersionToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :lock_version, :integer,
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
					filename: 'db/migrate/add_lock_version_to_products.rb',
					language: 'ruby',
					code: `class AddLockVersionToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :lock_version, :integer,
      default: 0, null: false
  end
end`,
					highlight: [3, 4],
				},
				{
					filename: 'app/services/place_order.rb (next step)',
					language: 'ruby',
					code: `# Add pessimistic locking for financial operations...`,
				},
			];
		}
		if (furthestStep === 3) {
			return [
				{
					filename: 'app/services/place_order.rb (lock added)',
					language: 'ruby',
					code: `def call
  v = OrderContract.new.call(...)
  return failure if v.failure?

  ActiveRecord::Base.transaction do
    product = Product.lock.find(@product_id)
    # SELECT ... FOR UPDATE locks the row
    raise InsufficientStockError if product.stock_count < @quantity
    product.stock_count -= @quantity
    product.save!
    AuditLog.create!(product:, quantity: @quantity,
      stock_after: product.stock_count)
    Result.new(success?: true, product:, errors: [])
  end
end`,
					highlight: [6, 7],
				},
			];
		}
		if (furthestStep === 4) {
			return [
				{
					filename: 'app/contracts/order_contract.rb',
					language: 'ruby',
					code: `class OrderContract < Dry::Validation::Contract
  params do
    required(:product_id).filled(:integer)
    required(:amount).filled(:decimal, gt?: 0)
  end
end`,
				},
				{
					filename: 'app/services/place_order.rb',
					language: 'ruby',
					code: `class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :product, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = amount
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      product: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      AuditLog.create!(product:, quantity: @quantity,
        stock_after: product.stock_count)
      Result.new(success?: true, product:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, product: nil,
      errors: ["Insufficient stock"])
  end
end`,
					highlight: [1, 3, 10, 16],
				},
			];
		}
	}

	// Reward: complete solution
	return [
		{
			filename: 'app/contracts/order_contract.rb',
			language: 'ruby',
			code: `class OrderContract < Dry::Validation::Contract
  params do
    required(:product_id).filled(:integer)
    required(:amount).filled(:decimal, gt?: 0)
  end
end`,
		},
		{
			filename: 'app/services/place_order.rb',
			language: 'ruby',
			code: `class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :product, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = amount
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      product: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      AuditLog.create!(product:, quantity: @quantity,
        stock_after: product.stock_count)
      Result.new(success?: true, product:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, product: nil,
      errors: ["Insufficient stock"])
  end
end`,
		},
		{
			filename: 'app/controllers/api/v1/orders_controller.rb',
			language: 'ruby',
			code: `class Api::V1::OrdersController < ApplicationController
  def create
    result = PlaceOrder.call(
      product_id: params[:id],
      quantity: params.expect(order: [:product_id, :quantity]))
    if result.success?
      render json: OrderSerializer.new(result.order)
    else
      render json: { error: {
        code: "DEDUCTION_FAILED",
        message: "Could not place order",
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

export function Level33Locking({ onComplete }: LevelComponentProps) {
	// Phase state
	const [phase, setPhase] = useState<Phase>('observe');

	// Gating hooks
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Visualization state
	const [vizAnimating, setVizAnimating] = useState(false);
	const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Database row state
	const defaultDbRow: ProductRowState = {
		columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
		values: ['1', 'Laptop Pro', '$50.00', '15', '(none)'],
		flashCells: {},
	};
	const [dbRow, setDbRow] = useState<ProductRowState>(defaultDbRow);

	// Request card states
	const emptyCardA: RequestCardState = {
		label: 'Request A',
		endpoint: 'POST /api/v1/orders',
		params: '{ product_id: 1, qty: 10 }',
		color: 'blue',
		log: [],
	};
	const emptyCardB: RequestCardState = {
		label: 'Request B',
		endpoint: 'POST /api/v1/orders',
		params: '{ product_id: 1, qty: 8 }',
		color: 'purple',
		log: [],
	};
	const [requestA, setRequestA] = useState<RequestCardState>(emptyCardA);
	const [requestB, setRequestB] = useState<RequestCardState>(emptyCardB);

	// Counters and warnings
	const [mismatchCounter, setMismatchCounter] = useState<string | null>(null);
	const [warningMessage, setWarningMessage] = useState<string | null>(null);
	const [vizStarted, setVizStarted] = useState(false);
	const [showRequestB, setShowRequestB] = useState(true);

	// ── Cleanup timers ──
	const clearTimers = useCallback(() => {
		for (const t of animTimerRef.current) clearTimeout(t);
		animTimerRef.current = [];
	}, []);

	useEffect(() => () => clearTimers(), [clearTimers]);

	// ── Apply a single animation frame ──
	const applyFrame = useCallback((frame: AnimationFrame) => {
		if (frame.dbRow) {
			setDbRow((prev) => ({
				columns: frame.dbRow?.columns ?? prev.columns,
				values: frame.dbRow?.values ?? prev.values,
				flashCells: frame.dbRow?.flashCells ?? prev.flashCells,
			}));
		}
		if (frame.requestA?.newLogEntry) {
			const entry = frame.requestA.newLogEntry;
			const badge = frame.requestA.badge;
			setRequestA((prev) => ({
				...prev,
				log: [...prev.log, entry],
				badge: badge ?? prev.badge,
			}));
		} else if (frame.requestA?.badge) {
			setRequestA((prev) => ({ ...prev, badge: frame.requestA?.badge }));
		}
		if (frame.requestB?.newLogEntry) {
			const entry = frame.requestB.newLogEntry;
			const badge = frame.requestB.badge;
			setRequestB((prev) => ({
				...prev,
				log: [...prev.log, entry],
				badge: badge ?? prev.badge,
			}));
		} else if (frame.requestB?.badge) {
			setRequestB((prev) => ({ ...prev, badge: frame.requestB?.badge }));
		}
		if (frame.mismatchCounter) {
			setMismatchCounter(frame.mismatchCounter);
		}
		if (frame.warningMessage) {
			setWarningMessage(frame.warningMessage);
		}
	}, []);

	// ── Run animation frame sequence ──
	const runAnimation = useCallback(
		(frames: AnimationFrame[], onComplete?: () => void) => {
			setVizAnimating(true);
			clearTimers();

			const step = ANIMATION_DURATION_MS;
			for (let i = 0; i < frames.length; i++) {
				const t = setTimeout(
					() => {
						applyFrame(frames[i]);
					},
					step * (i + 1),
				);
				animTimerRef.current.push(t);
			}

			const tFinal = setTimeout(
				() => {
					setVizAnimating(false);
					onComplete?.();
				},
				step * (frames.length + 1),
			);
			animTimerRef.current.push(tFinal);
		},
		[clearTimers, applyFrame],
	);

	// ── Observe: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;
			setVizStarted(true);
			setShowRequestB(true);

			// Reset cards
			setMismatchCounter(null);
			setWarningMessage(null);

			if (probeId === 'concurrent-checkout') {
				setDbRow({
					columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
					values: ['1', 'Laptop Pro', '$50.00', '15', '(none)'],
					flashCells: {},
				});
				setRequestA({ ...emptyCardA, log: [] });
				setRequestB({ ...emptyCardB, log: [] });
				runAnimation(OBSERVE_CHECKOUT_FRAMES, () => {
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				});
			} else {
				setDbRow({
					columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
					values: ['1', 'Laptop Pro', '$50.00', '15', '(none)'],
					flashCells: {},
				});
				setRequestA({
					label: 'Admin A',
					endpoint: 'PATCH /api/v1/products/1',
					params: '{ price: "$60.00" }',
					color: 'blue',
					log: [],
				});
				setRequestB({
					label: 'Admin B',
					endpoint: 'PATCH /api/v1/products/1',
					params: '{ price: "$55.00" }',
					color: 'purple',
					log: [],
				});
				runAnimation(OBSERVE_STALE_EDIT_FRAMES, () => {
					const discoveries = PROBE_DISCOVERY_MAP[probeId] ?? [];
					for (const d of discoveries) discoveryGating.discover(d);
				});
			}
		},
		[vizAnimating, discoveryGating, runAnimation],
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

			setVizStarted(true);
			setShowRequestB(
				scenarioId === 'concurrent-order-locked' ||
					scenarioId === 'concurrent-checkout',
			);
			setMismatchCounter(null);
			setWarningMessage(null);

			// Per-scenario params
			const SCENARIO_PARAMS: Record<string, { a: string; b: string }> = {
				'single-order': {
					a: '{ product_id: 1, qty: 10 }',
					b: '{ product_id: 1, qty: 3 }',
				},
				'concurrent-order-locked': {
					a: '{ product_id: 1, qty: 10 }',
					b: '{ product_id: 1, qty: 3 }',
				},
				'concurrent-checkout': {
					a: '{ product_id: 1, qty: 10 }',
					b: '{ product_id: 1, qty: 8 }',
				},
				transfer: {
					a: '{ product_id: 1, qty: 5 }',
					b: '{ product_id: 1, qty: 3 }',
				},
				'insufficient-stock': {
					a: '{ product_id: 1, qty: 100 }',
					b: '{ product_id: 1, qty: 3 }',
				},
				'stale-product-edit': {
					a: '{ price: "$65.00", lock_version: 0 }',
					b: '{ price: "$55.00", lock_version: 0 }',
				},
				'invalid-amount': {
					a: '{ product_id: 1, qty: -5 }',
					b: '{ product_id: 1, qty: 3 }',
				},
			};
			const params = SCENARIO_PARAMS[scenarioId] ?? {
				a: '{ product_id: 1 }',
				b: '{ product_id: 1 }',
			};

			// Reset DB row for reward phase (with lock_version)
			setDbRow({
				columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
				values: ['1', 'Laptop Pro', '$50.00', '15', '0'],
				flashCells: {},
			});
			setRequestA({
				label: 'Request A',
				endpoint: `${scenario.method} ${scenario.path}`,
				params: params.a,
				color: 'blue',
				log: [],
			});
			setRequestB({
				label: 'Request B',
				endpoint: `${scenario.method} ${scenario.path}`,
				params: params.b,
				color: 'purple',
				log: [],
			});

			const frames =
				scenario.expectedResult === 'allowed'
					? REWARD_ALLOWED_FRAMES
					: (BLOCKED_FRAMES_MAP[scenarioId] ??
						BLOCKED_FRAMES_INSUFFICIENT_STOCK);

			runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
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

	const handleStartReward = () => {
		setPhase('reward');
		stressTest.reset();
		setVizStarted(false);
		setShowRequestB(true);
		setDbRow({
			columns: ['id', 'name', 'price', 'stock_count', 'lock_version'],
			values: ['1', 'Laptop Pro', '$50.00', '15', '0'],
			flashCells: {},
		});
		setRequestA({ ...emptyCardA, log: [] });
		setRequestB({ ...emptyCardB, log: [] });
		setMismatchCounter(null);
		setWarningMessage(null);
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
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);
	const isTerminalStep = stepper.currentStep <= 1;

	// ──────────────────────────────────────────
	// Render: Concurrency Visualization
	// ──────────────────────────────────────────

	const renderConcurrencyViz = (mode: 'observe' | 'reward') => (
		<div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
			{/* Context banner */}
			<div className="text-center">
				{mode === 'observe' ? (
					<div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-1.5">
						<Zap className="w-4 h-4 text-destructive" />
						<span className="text-sm font-semibold text-destructive">
							2 requests hit the same row at the same moment
						</span>
					</div>
				) : (
					<div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-1.5">
						<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
						<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
							Pessimistic Lock: Serialized Access
						</span>
					</div>
				)}
			</div>

			{/* Database table (always visible) */}
			<ProductTable row={dbRow} />

			{/* Two request cards side by side */}
			{vizStarted ? (
				<div className="flex gap-3 w-full max-w-2xl mx-auto">
					<RequestCard card={requestA} />
					{showRequestB && <RequestCard card={requestB} />}
				</div>
			) : (
				<div className="w-full max-w-2xl mx-auto rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
					{mode === 'observe' ? (
						<>
							<Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								Fire a probe to see the race condition unfold step by step.
							</p>
						</>
					) : (
						<>
							<Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								Fire a scenario to see how locking serializes access.
							</p>
						</>
					)}
				</div>
			)}

			{/* Mismatch counter */}
			{mismatchCounter && (
				<div
					className={cn(
						'w-full max-w-2xl mx-auto rounded-lg border px-4 py-2 text-center text-sm font-semibold font-mono animate-in fade-in duration-300',
						mode === 'observe'
							? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300'
							: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300',
					)}
				>
					{mismatchCounter}
				</div>
			)}

			{/* Warning callout */}
			{warningMessage && (
				<div className="max-w-2xl mx-auto w-full bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-in fade-in duration-500">
					<div className="flex items-start gap-2">
						<AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
						<p className="text-xs text-muted-foreground">{warningMessage}</p>
					</div>
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
								: [
										'Fire scenarios to verify locking prevents lost updates',
										'Test insufficient funds and stale version handling',
										'See how concurrent users are safely serialized',
									]
					}
					scenario="Two customers check out the same product simultaneously. Without locking, the last write wins and stock goes negative. Locks serialize access so each request sees the correct inventory."
				>
					<div className="border-t border-border">
						{phase === 'observe' && (
							<div className="p-4 space-y-4">
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-2">
										Scenario
									</h3>
									<p className="text-sm text-muted-foreground">
										Two customers check out the same product simultaneously.
										Without locking, the last write wins and stock goes
										negative. Locks serialize access so each request sees the
										correct inventory.
									</p>
								</div>
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
					levelNumber={33}
					onComplete={handleComplete}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col min-h-0">
					{/* ── OBSERVE PHASE ── */}
					{phase === 'observe' && (
						<>
							{renderConcurrencyViz('observe')}

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
												? 'Add a lock_version column to the products table for optimistic locking.'
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
							) : null}
						</div>
					)}

					{/* ── REWARD PHASE ── */}
					{phase === 'reward' && (
						<>
							{renderConcurrencyViz('reward')}

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
								<span>
									Optimistic (lock_version): product listings, CMS pages
								</span>
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

export default Level33Locking;

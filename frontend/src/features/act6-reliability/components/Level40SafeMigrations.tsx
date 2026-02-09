/**
 * Level 40: Safe Migrations
 *
 * Migration risk analyzer. Player learns how to convert unsafe
 * database migrations into safe, zero-downtime alternatives.
 */

import { useState } from 'react';
import {
	AlertTriangle,
	ArrowRight,
	Check,
	Database,
	Lock,
	ShieldCheck,
	Timer,
	ToggleLeft,
	ToggleRight,
	Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';

// --- Types ---

type RiskLevel = 'unsafe' | 'caution' | 'safe';

interface SafeStep {
	label: string;
	code: string;
}

interface MigrationOperation {
	id: string;
	name: string;
	unsafeCode: string;
	risk: RiskLevel;
	lockDuration: number; // seconds for unsafe version
	safeLockDuration: number; // seconds for safe version
	safeSteps: SafeStep[];
	explanation: string;
	fixed: boolean;
}

// --- Initial Data ---

const INITIAL_OPERATIONS: MigrationOperation[] = [
	{
		id: 'add_column',
		name: 'add_column with default',
		unsafeCode: 'add_column :users, :admin, :boolean, default: false',
		risk: 'unsafe',
		lockDuration: 30,
		safeLockDuration: 0,
		safeSteps: [
			{
				label: 'Add column (no default)',
				code: 'add_column :users, :admin, :boolean',
			},
			{
				label: 'Backfill in batches',
				code: 'User.in_batches { |b| b.update_all(admin: false) }',
			},
			{
				label: 'Set default for new rows',
				code: 'change_column_default :users, :admin, false',
			},
		],
		explanation:
			'Adding a column with a default on a large table rewrites every row, holding an ACCESS EXCLUSIVE lock. Split into 3 steps: add the column (instant), backfill in batches (no lock), then set the default (instant).',
		fixed: false,
	},
	{
		id: 'add_index',
		name: 'add_index',
		unsafeCode: 'add_index :users, :email',
		risk: 'unsafe',
		lockDuration: 45,
		safeLockDuration: 0,
		safeSteps: [
			{
				label: 'Disable DDL transaction',
				code: 'disable_ddl_transaction!',
			},
			{
				label: 'Add index concurrently',
				code: 'add_index :users, :email, algorithm: :concurrently',
			},
		],
		explanation:
			'A standard CREATE INDEX acquires a SHARE lock, blocking all writes. Using algorithm: :concurrently builds the index without locking, but requires disable_ddl_transaction! since it cannot run inside a transaction.',
		fixed: false,
	},
	{
		id: 'remove_column',
		name: 'remove_column',
		unsafeCode: 'remove_column :users, :legacy_field',
		risk: 'caution',
		lockDuration: 5,
		safeLockDuration: 0,
		safeSteps: [
			{
				label: 'Ignore column in model first',
				code: 'self.ignored_columns += ["legacy_field"]',
			},
			{
				label: 'Deploy, then remove column',
				code: 'remove_column :users, :legacy_field',
			},
		],
		explanation:
			'Removing a column without ignoring it first causes errors on running instances that still reference it. Add ignored_columns in the model, deploy, then remove the column in a separate deploy.',
		fixed: false,
	},
	{
		id: 'rename_column',
		name: 'rename_column',
		unsafeCode: 'rename_column :users, :name, :full_name',
		risk: 'unsafe',
		lockDuration: 20,
		safeLockDuration: 0,
		safeSteps: [
			{
				label: 'Add new column',
				code: 'add_column :users, :full_name, :string',
			},
			{
				label: 'Backfill data',
				code: 'User.in_batches { |b| b.update_all("full_name = name") }',
			},
			{
				label: 'Write to both columns',
				code: '# Update app to write to both columns',
			},
			{
				label: 'Drop old column',
				code: 'remove_column :users, :name',
			},
		],
		explanation:
			'Renaming a column causes instant errors in running code referencing the old name. Instead, add the new column, backfill, update the app to use the new column, then drop the old one across multiple deploys.',
		fixed: false,
	},
];

// --- Helpers ---

const RISK_STYLES: Record<
	RiskLevel,
	{ bg: string; text: string; border: string; badge: string }
> = {
	unsafe: {
		bg: 'bg-destructive/10',
		text: 'text-destructive',
		border: 'border-destructive/30',
		badge: 'bg-destructive/20 text-destructive',
	},
	caution: {
		bg: 'bg-warning/10',
		text: 'text-warning',
		border: 'border-warning/30',
		badge: 'bg-warning/20 text-warning',
	},
	safe: {
		bg: 'bg-success/10',
		text: 'text-success',
		border: 'border-success/30',
		badge: 'bg-success/20 text-success',
	},
};

function getRiskLabel(risk: RiskLevel): string {
	switch (risk) {
		case 'unsafe':
			return 'Unsafe';
		case 'caution':
			return 'Caution';
		case 'safe':
			return 'Safe';
	}
}

function getRiskIcon(risk: RiskLevel) {
	switch (risk) {
		case 'unsafe':
			return <Lock className="w-3.5 h-3.5" />;
		case 'caution':
			return <AlertTriangle className="w-3.5 h-3.5" />;
		case 'safe':
			return <Unlock className="w-3.5 h-3.5" />;
	}
}

// --- Component ---

export function Level40SafeMigrations({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [operations, setOperations] =
		useState<MigrationOperation[]>(INITIAL_OPERATIONS);
	const [selectedOp, setSelectedOp] = useState<string | null>(null);
	const [strongMigrations, setStrongMigrations] = useState(false);

	const fixedCount = operations.filter((op) => op.fixed).length;
	const allFixed = fixedCount === operations.length;

	const handleFix = (opId: string) => {
		setOperations((prev) =>
			prev.map((op) => (op.id === opId ? { ...op, fixed: true } : op)),
		);
	};

	const handleReset = () => {
		setOperations(INITIAL_OPERATIONS);
		setSelectedOp(null);
		setStrongMigrations(false);
	};

	const validateSolution = (): ValidationResult => {
		const unfixed = operations.filter((op) => !op.fixed);
		if (unfixed.length > 0) {
			return {
				valid: false,
				message: `${unfixed.length} migration(s) still unsafe!`,
				details: unfixed.map(
					(op) => `Fix "${op.name}" to its safe alternative`,
				),
			};
		}
		return {
			valid: true,
			message: 'All migrations are safe for zero-downtime deploys!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act6-level40-safe-migrations', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const currentOp = operations.find((op) => op.id === selectedOp);

	// Build code preview based on state
	const codeFiles = buildCodePreview(operations, strongMigrations);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Convert all unsafe migrations to zero-downtime safe alternatives."
					instructions={[
						'Review each migration operation and its risk level',
						'Click an operation to see its unsafe vs safe approach',
						'Apply the safe fix for each operation',
						'Enable strong_migrations to catch unsafe patterns automatically',
					]}
					scenario="Your deploy adds a column with a default value to the users table (5M rows). The migration locks the table for 30 seconds. 100K users get 500 errors. You need to learn safe migration patterns."
				>
					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Migration Safety Progress
						</div>
						<div className="flex items-center gap-3 mb-2">
							<div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full bg-success transition-all duration-500"
									style={{
										width: `${(fixedCount / operations.length) * 100}%`,
									}}
								/>
							</div>
							<span className="text-sm font-bold text-foreground">
								{fixedCount}/{operations.length}
							</span>
						</div>
						<div className="text-xs text-muted-foreground">
							{allFixed
								? 'All migrations are safe!'
								: `${operations.length - fixedCount} operation(s) still need fixing`}
						</div>
					</div>

					{/* Impact Summary */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Deployment Impact
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Lock className="w-3 h-3 text-destructive" />
									Total Lock Time (unsafe)
								</span>
								<span className="font-mono text-destructive font-semibold">
									{operations.reduce(
										(sum, op) => sum + op.lockDuration,
										0,
									)}
									s
								</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Unlock className="w-3 h-3 text-success" />
									Total Lock Time (safe)
								</span>
								<span className="font-mono text-success font-semibold">
									{operations.reduce(
										(sum, op) =>
											sum +
											(op.fixed
												? op.safeLockDuration
												: op.lockDuration),
										0,
									)}
									s
								</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Database className="w-3 h-3" />
									Affected Rows
								</span>
								<span className="font-mono text-foreground">5,000,000</span>
							</div>
						</div>
					</div>

					{/* strong_migrations toggle */}
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full gap-2 ${strongMigrations ? 'border-success text-success' : ''}`}
							onClick={() => setStrongMigrations(!strongMigrations)}
							variant="outline"
						>
							{strongMigrations ? (
								<ToggleRight className="w-4 h-4" />
							) : (
								<ToggleLeft className="w-4 h-4" />
							)}
							strong_migrations
							{strongMigrations ? ' (ON)' : ' (OFF)'}
						</Button>
						<p className="text-xs text-muted-foreground mt-2">
							{strongMigrations
								? 'Gem detects unsafe migrations at dev time'
								: 'Enable to catch unsafe patterns automatically'}
						</p>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Safe Migrations"
					levelNumber={40}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-6">
						{/* Migration Operations List */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div>
									<div className="text-foreground font-semibold">
										Migration Operations
									</div>
									<div className="text-xs text-muted-foreground">
										Click an operation to review and fix it
									</div>
								</div>
								{strongMigrations && (
									<div className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
										<AlertTriangle className="w-3 h-3" />
										strong_migrations active
									</div>
								)}
							</div>
							<div className="p-4 space-y-3">
								{operations.map((op) => {
									const displayRisk = op.fixed ? 'safe' : op.risk;
									const style = RISK_STYLES[displayRisk];
									const isSelected = selectedOp === op.id;

									return (
										<button
											className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
												isSelected
													? `${style.border} ${style.bg} ring-2 ring-primary/20`
													: `border-border hover:${style.border} hover:${style.bg}`
											}`}
											key={op.id}
											onClick={() =>
												setSelectedOp(
													isSelected ? null : op.id,
												)
											}
											type="button"
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													{op.fixed ? (
														<div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
															<ShieldCheck className="w-4 h-4 text-success" />
														</div>
													) : (
														<div
															className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center`}
														>
															{getRiskIcon(
																op.risk,
															)}
														</div>
													)}
													<div>
														<div className="font-medium text-foreground text-sm">
															{op.name}
														</div>
														<code className="text-xs text-muted-foreground font-mono">
															{op.unsafeCode}
														</code>
													</div>
												</div>
												<div className="flex items-center gap-3">
													{/* Risk Badge */}
													<span
														className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${style.badge}`}
													>
														{getRiskIcon(
															displayRisk,
														)}
														{getRiskLabel(
															displayRisk,
														)}
													</span>
													{/* strong_migrations warning */}
													{strongMigrations &&
														!op.fixed && (
															<span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/20">
																blocked
															</span>
														)}
												</div>
											</div>

											{/* Timeline visualization */}
											<div className="mt-3 flex items-center gap-2">
												<Timer className="w-3 h-3 text-muted-foreground shrink-0" />
												<div className="flex-1 flex items-center gap-2">
													{/* Unsafe bar */}
													<div className="flex-1">
														<div className="h-2 bg-secondary rounded-full overflow-hidden">
															<div
																className={`h-full rounded-full transition-all duration-500 ${
																	op.fixed
																		? 'bg-muted'
																		: 'bg-destructive'
																}`}
																style={{
																	width: `${Math.min(100, (op.lockDuration / 50) * 100)}%`,
																}}
															/>
														</div>
														<div className="text-[10px] text-muted-foreground mt-0.5">
															{op.fixed ? (
																<span className="line-through">
																	{
																		op.lockDuration
																	}
																	s lock
																</span>
															) : (
																<span className="text-destructive">
																	{
																		op.lockDuration
																	}
																	s lock
																</span>
															)}
														</div>
													</div>
													<ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
													{/* Safe bar */}
													<div className="flex-1">
														<div className="h-2 bg-secondary rounded-full overflow-hidden">
															<div
																className="h-full bg-success rounded-full transition-all duration-500"
																style={{
																	width: op.fixed
																		? `${Math.max(3, (op.safeLockDuration / 50) * 100)}%`
																		: '0%',
																}}
															/>
														</div>
														<div className="text-[10px] mt-0.5">
															{op.fixed ? (
																<span className="text-success">
																	{op.safeLockDuration ===
																	0
																		? 'No lock'
																		: `${op.safeLockDuration}s lock`}
																</span>
															) : (
																<span className="text-muted-foreground">
																	fix to see
																</span>
															)}
														</div>
													</div>
												</div>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{/* Selected Operation Detail */}
						{currentOp && (
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-3 border-b border-border">
									<div className="text-foreground font-semibold">
										Fix: {currentOp.name}
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										{currentOp.explanation}
									</div>
								</div>
								<div className="p-4">
									{/* Unsafe approach */}
									<div className="mb-4">
										<div className="flex items-center gap-2 mb-2">
											<Lock className="w-4 h-4 text-destructive" />
											<span className="text-sm font-semibold text-destructive">
												Unsafe Approach
											</span>
											<span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
												<Timer className="w-3 h-3" />
												{currentOp.lockDuration}s table
												lock
											</span>
										</div>
										<pre className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm font-mono text-foreground overflow-x-auto">
											<code>{currentOp.unsafeCode}</code>
										</pre>
									</div>

									{/* Arrow */}
									<div className="flex items-center justify-center py-2">
										<div className="flex items-center gap-2 text-muted-foreground">
											<div className="h-px w-8 bg-border" />
											<ArrowRight className="w-4 h-4" />
											<div className="h-px w-8 bg-border" />
										</div>
									</div>

									{/* Safe approach */}
									<div className="mb-4">
										<div className="flex items-center gap-2 mb-2">
											<ShieldCheck className="w-4 h-4 text-success" />
											<span className="text-sm font-semibold text-success">
												Safe Approach
											</span>
											<span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
												<Timer className="w-3 h-3" />
												{currentOp.safeLockDuration === 0
													? 'No lock'
													: `${currentOp.safeLockDuration}s lock`}
											</span>
										</div>
										<div className="space-y-2">
											{currentOp.safeSteps.map(
												(step, i) => (
													<div
														className="flex items-start gap-3"
														key={step.label}
													>
														<div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
															<span className="text-xs font-bold text-success">
																{i + 1}
															</span>
														</div>
														<div className="flex-1">
															<div className="text-xs font-medium text-muted-foreground mb-1">
																{step.label}
															</div>
															<pre className="bg-success/5 border border-success/20 rounded-lg p-2.5 text-sm font-mono text-foreground overflow-x-auto">
																<code>
																	{step.code}
																</code>
															</pre>
														</div>
													</div>
												),
											)}
										</div>
									</div>

									{/* Fix button */}
									{!currentOp.fixed ? (
										<Button
											className="w-full gap-2"
											onClick={() =>
												handleFix(currentOp.id)
											}
											variant="default"
										>
											<ShieldCheck className="w-4 h-4" />
											Apply Safe Migration
										</Button>
									) : (
										<div className="flex items-center justify-center gap-2 py-3 text-success">
											<Check className="w-5 h-5" />
											<span className="font-semibold text-sm">
												Migration fixed!
											</span>
										</div>
									)}
								</div>
							</div>
						)}

						{/* All fixed message */}
						{allFixed && !currentOp && (
							<div className="bg-success/10 border-2 border-success/30 rounded-xl p-6 text-center">
								<ShieldCheck className="w-10 h-10 text-success mx-auto mb-3" />
								<div className="text-lg font-bold text-success mb-1">
									All Migrations Safe!
								</div>
								<div className="text-sm text-muted-foreground">
									Zero-downtime deploys are now possible. Submit
									to complete the level.
								</div>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={codeFiles}
					learningGoal="Safe migrations prevent downtime during deploys. Use strong_migrations gem to catch unsafe patterns, split risky operations into multiple steps, and always test migrations against production-sized data."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Safe Migration Rules
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-1.5">
								<AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
								Never add a column with a default on large tables
							</li>
							<li className="flex items-start gap-1.5">
								<AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
								Always add indexes concurrently
							</li>
							<li className="flex items-start gap-1.5">
								<AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
								Use ignored_columns before removing
							</li>
							<li className="flex items-start gap-1.5">
								<AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
								Never rename columns directly
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Gems
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary font-mono">
									strong_migrations
								</span>{' '}
								- Catch unsafe migrations
							</li>
							<li>
								<span className="text-primary font-mono">
									online_migrations
								</span>{' '}
								- Helpers for safe ops
							</li>
							<li>
								<span className="text-primary font-mono">
									pg_lock_timeout
								</span>{' '}
								- Prevent long locks
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

// --- Code Preview Builder ---

function buildCodePreview(
	operations: MigrationOperation[],
	strongMigrations: boolean,
) {
	const addColOp = operations.find((op) => op.id === 'add_column');
	const addIdxOp = operations.find((op) => op.id === 'add_index');
	const removeColOp = operations.find((op) => op.id === 'remove_column');
	const renameColOp = operations.find((op) => op.id === 'rename_column');

	const files = [];

	// Unsafe vs safe migration code
	if (addColOp && addIdxOp) {
		const addColCode = addColOp.fixed
			? `# SAFE: add_column (3 steps)
class AddAdminToUsers < ActiveRecord::Migration[7.1]
  def change
    # Step 1: Add column without default (instant)
    add_column :users, :admin, :boolean

    # Step 2: Backfill in batches (no lock)
    User.in_batches do |batch|
      batch.update_all(admin: false)
    end

    # Step 3: Set default for new rows (instant)
    change_column_default :users, :admin, false
  end
end`
			: `# UNSAFE: Locks table for 30+ seconds!
class AddAdminToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :admin, :boolean, default: false
    # ^^^ Rewrites every row, holds ACCESS EXCLUSIVE lock
    # 5M rows = ~30s of downtime
  end
end`;

		const addIdxCode = addIdxOp.fixed
			? `# SAFE: Concurrent index
class AddEmailIndexToUsers < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    add_index :users, :email, algorithm: :concurrently
    # Builds index without blocking writes
  end
end`
			: `# UNSAFE: Blocks all writes!
class AddEmailIndexToUsers < ActiveRecord::Migration[7.1]
  def change
    add_index :users, :email
    # ^^^ Acquires SHARE lock on table
    # Blocks INSERT/UPDATE/DELETE for duration
  end
end`;

		files.push({
			filename: 'db/migrate/add_admin_to_users.rb',
			language: 'ruby',
			code: addColCode,
			highlight: addColOp.fixed ? [5, 8, 13] : [4],
		});

		files.push({
			filename: 'db/migrate/add_email_index.rb',
			language: 'ruby',
			code: addIdxCode,
			highlight: addIdxOp.fixed ? [3, 6] : [4],
		});
	}

	if (removeColOp && renameColOp) {
		const removeCode = removeColOp.fixed
			? `# SAFE: Two-step column removal
# Deploy 1: Ignore column in model
class User < ApplicationRecord
  self.ignored_columns += ["legacy_field"]
end

# Deploy 2: Remove the column
class RemoveLegacyField < ActiveRecord::Migration[7.1]
  def change
    remove_column :users, :legacy_field
  end
end`
			: `# UNSAFE: Running code still references column!
class RemoveLegacyField < ActiveRecord::Migration[7.1]
  def change
    remove_column :users, :legacy_field
    # ^^^ Old app instances will crash trying
    # to SELECT legacy_field
  end
end`;

		const renameCode = renameColOp.fixed
			? `# SAFE: Multi-deploy rename
# Deploy 1: Add new column + backfill
add_column :users, :full_name, :string
User.in_batches { |b| b.update_all("full_name = name") }

# Deploy 2: App writes to both columns
# Deploy 3: App reads from new column
# Deploy 4: Drop old column
remove_column :users, :name`
			: `# UNSAFE: Breaks all code using old name!
class RenameNameToFullName < ActiveRecord::Migration[7.1]
  def change
    rename_column :users, :name, :full_name
    # ^^^ All queries referencing :name
    # instantly break on running instances
  end
end`;

		files.push({
			filename: 'db/migrate/remove_legacy_field.rb',
			language: 'ruby',
			code: removeCode,
			highlight: removeColOp.fixed ? [4] : [4],
		});

		files.push({
			filename: 'db/migrate/rename_name_column.rb',
			language: 'ruby',
			code: renameCode,
			highlight: renameColOp.fixed ? [3, 4, 9] : [4],
		});
	}

	// strong_migrations config
	if (strongMigrations) {
		files.push({
			filename: 'config/initializers/strong_migrations.rb',
			language: 'ruby',
			code: `# Catch unsafe migrations before they run
StrongMigrations.auto_analyze = true
StrongMigrations.start_after = 20240101000000

# Set statement timeout for migrations
StrongMigrations.lock_timeout = 10.seconds
StrongMigrations.statement_timeout = 1.hour

# Target version for safety checks
StrongMigrations.target_version = 16  # PostgreSQL

# Custom checks
StrongMigrations.add_check do |method, args|
  if method == :add_column && args[2]&.key?(:default)
    stop! "Adding a column with a default is unsafe on large tables."
  end
end`,
			highlight: [2, 6, 7],
		});
	}

	return files;
}

export default Level40SafeMigrations;

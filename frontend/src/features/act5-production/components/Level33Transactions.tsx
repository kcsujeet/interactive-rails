/**
 * Level 30: Transactions & Locking
 *
 * Prevent race conditions with database transactions and locking.
 * Step-by-step simulation showing concurrent access with and without locks.
 */

import {
	AlertTriangle,
	ArrowRight,
	Check,
	DollarSign,
	Lock,
	ShieldCheck,
	Unlock,
	Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

type LockingStrategy = 'none' | 'optimistic' | 'pessimistic';

interface TimelineStep {
	actor: 'A' | 'B';
	action: string;
	balanceRead: number | null;
	balanceWrite: number | null;
	locked: boolean;
	error?: string;
}

interface SimulationState {
	currentStep: number;
	balance: number;
	steps: TimelineStep[];
	finalBalance: number;
	isCorrect: boolean;
	lockHolder: 'A' | 'B' | null;
}

/**
 * Build the timeline steps for each locking strategy.
 *
 * Scenario: Account starts at $100. User A deducts $30, User B deducts $50.
 * Correct final balance: $100 - $30 - $50 = $20.
 */
function buildSimulation(strategy: LockingStrategy): SimulationState {
	switch (strategy) {
		case 'none':
			return {
				currentStep: -1,
				balance: 100,
				lockHolder: null,
				steps: [
					{
						actor: 'A',
						action: 'Reads balance',
						balanceRead: 100,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Reads balance',
						balanceRead: 100,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'A',
						action: 'Deducts $30, saves $70',
						balanceRead: null,
						balanceWrite: 70,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Deducts $50, saves $50',
						balanceRead: null,
						balanceWrite: 50,
						locked: false,
					},
				],
				finalBalance: 50,
				isCorrect: false,
			};
		case 'optimistic':
			return {
				currentStep: -1,
				balance: 100,
				lockHolder: null,
				steps: [
					{
						actor: 'A',
						action: 'Reads balance (v1)',
						balanceRead: 100,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Reads balance (v1)',
						balanceRead: 100,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'A',
						action: 'Saves $70 (v1 -> v2)',
						balanceRead: null,
						balanceWrite: 70,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Saves $50 -- StaleObjectError!',
						balanceRead: null,
						balanceWrite: null,
						locked: false,
						error: 'StaleObjectError: lock_version mismatch',
					},
					{
						actor: 'B',
						action: 'Retries: reads $70 (v2)',
						balanceRead: 70,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Saves $20 (v2 -> v3)',
						balanceRead: null,
						balanceWrite: 20,
						locked: false,
					},
				],
				finalBalance: 20,
				isCorrect: true,
			};
		case 'pessimistic':
			return {
				currentStep: -1,
				balance: 100,
				lockHolder: null,
				steps: [
					{
						actor: 'A',
						action: 'BEGIN + locks row',
						balanceRead: null,
						balanceWrite: null,
						locked: true,
					},
					{
						actor: 'A',
						action: 'Reads $100',
						balanceRead: 100,
						balanceWrite: null,
						locked: true,
					},
					{
						actor: 'B',
						action: 'Waits for lock...',
						balanceRead: null,
						balanceWrite: null,
						locked: false,
					},
					{
						actor: 'A',
						action: 'Saves $70, COMMIT',
						balanceRead: null,
						balanceWrite: 70,
						locked: false,
					},
					{
						actor: 'B',
						action: 'Acquires lock, reads $70',
						balanceRead: 70,
						balanceWrite: null,
						locked: true,
					},
					{
						actor: 'B',
						action: 'Saves $20, COMMIT',
						balanceRead: null,
						balanceWrite: 20,
						locked: false,
					},
				],
				finalBalance: 20,
				isCorrect: true,
			};
	}
}

export function Level33Transactions({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [strategy, setStrategy] = useState<LockingStrategy>('none');
	const [simulation, setSimulation] = useState<SimulationState>(
		buildSimulation('none'),
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [hasRunSimulation, setHasRunSimulation] = useState(false);
	const [strategiesViewed, setStrategiesViewed] = useState<
		Set<LockingStrategy>
	>(new Set());
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Auto-play simulation
	useEffect(() => {
		if (!isPlaying) return;

		if (simulation.currentStep >= simulation.steps.length - 1) {
			setIsPlaying(false);
			setHasRunSimulation(true);
			setStrategiesViewed((prev) => new Set([...prev, strategy]));
			return;
		}

		timerRef.current = setTimeout(() => {
			setSimulation((prev) => {
				const nextStep = prev.currentStep + 1;
				const step = prev.steps[nextStep];
				let newBalance = prev.balance;
				let newLockHolder = prev.lockHolder;

				if (step.balanceWrite !== null) {
					newBalance = step.balanceWrite;
				}
				if (step.locked) {
					newLockHolder = step.actor;
				} else if (prev.lockHolder === step.actor) {
					newLockHolder = null;
				}

				return {
					...prev,
					currentStep: nextStep,
					balance: newBalance,
					lockHolder: newLockHolder,
				};
			});
		}, 1200);

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [isPlaying, simulation.currentStep, simulation.steps.length, strategy]);

	const switchStrategy = useCallback((newStrategy: LockingStrategy) => {
		setStrategy(newStrategy);
		setSimulation(buildSimulation(newStrategy));
		setIsPlaying(false);
		if (timerRef.current) clearTimeout(timerRef.current);
	}, []);

	const runSimulation = useCallback(() => {
		setSimulation(buildSimulation(strategy));
		setTimeout(() => setIsPlaying(true), 100);
	}, [strategy]);

	const validateSolution = useCallback((): ValidationResult => {
		if (!hasRunSimulation) {
			return {
				valid: false,
				message: 'Run the simulation first',
				details: ['Click "Run Simulation" to see how concurrent access works'],
			};
		}
		if (strategy === 'none') {
			return {
				valid: false,
				message: 'Select a locking strategy',
				details: [
					'Choose either "Optimistic Lock" or "Pessimistic Lock" to prevent race conditions',
				],
			};
		}
		if (!strategiesViewed.has(strategy)) {
			return {
				valid: false,
				message: 'Run the simulation with your chosen strategy',
				details: [
					'Click "Run Simulation" to see how the lock protects the data',
				],
			};
		}
		return { valid: true, message: 'Race condition prevented with locking!' };
	}, [hasRunSimulation, strategy, strategiesViewed]);

	const handleComplete = async () => {
		const success = await completeLevel('act5-level33-transactions', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getActorColor = (actor: 'A' | 'B') =>
		actor === 'A' ? 'text-primary' : 'text-purple-400';
	const getActorBg = (actor: 'A' | 'B') =>
		actor === 'A'
			? 'bg-primary/10 border-primary/30'
			: 'bg-purple-500/10 border-purple-500/30';

	const isSimComplete = simulation.currentStep >= simulation.steps.length - 1;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Prevent race conditions with database transactions and locking."
					instructions={[
						'Run "No Protection" simulation to see the lost update bug',
						'Switch to Pessimistic or Optimistic locking',
						'Run simulation again to see the fix',
						'Submit with a valid locking strategy',
					]}
					scenario="Two users (A & B) update the same account balance simultaneously. Without transaction + lock, a 'lost update' bug occurs: $30 deduction is silently lost."
				>
					{/* Strategy Selector */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Locking Strategy
						</div>
						<div className="space-y-2">
							{[
								{
									key: 'none' as const,
									name: 'No Protection',
									Icon: Unlock,
									desc: 'No locking at all',
									danger: true,
								},
								{
									key: 'optimistic' as const,
									name: 'Optimistic Lock',
									Icon: ShieldCheck,
									desc: 'Detect conflicts via version column',
								},
								{
									key: 'pessimistic' as const,
									name: 'Pessimistic Lock',
									Icon: Lock,
									desc: 'SELECT FOR UPDATE locks the row',
								},
							].map((item) => (
								<Button
									className={`w-full p-3 h-auto text-left justify-start flex-col items-start rounded-lg border transition-all ${
										strategy === item.key
											? item.danger
												? 'border-destructive bg-destructive/10'
												: 'border-success bg-success/10'
											: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={item.key}
									onClick={() => switchStrategy(item.key)}
									variant="ghost"
								>
									<div className="flex items-center gap-2 w-full">
										<item.Icon
											className={`w-4 h-4 ${
												strategy === item.key
													? item.danger
														? 'text-destructive'
														: 'text-success'
													: 'text-muted-foreground'
											}`}
										/>
										<span
											className={`text-sm font-medium ${
												strategy === item.key
													? item.danger
														? 'text-destructive'
														: 'text-success'
													: 'text-foreground'
											}`}
										>
											{item.name}
										</span>
										{strategy === item.key && (
											<Check className="w-3 h-3 ml-auto text-current" />
										)}
									</div>
									<div className="text-xs text-muted-foreground mt-1 ml-6">
										{item.desc}
									</div>
								</Button>
							))}
						</div>
					</div>

					{/* Action Button */}
					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-3"
							disabled={isPlaying}
							onClick={runSimulation}
						>
							{isPlaying ? 'Simulating...' : 'Run Simulation'}
						</Button>
					</div>

					{/* Result Summary */}
					{isSimComplete && (
						<div className="p-4 border-t border-border">
							<div
								className={`p-4 rounded-lg border-2 ${
									simulation.isCorrect
										? 'border-success bg-success/10'
										: 'border-destructive bg-destructive/10'
								}`}
							>
								<div className="flex items-center gap-2 mb-2">
									{simulation.isCorrect ? (
										<ShieldCheck className="w-5 h-5 text-success" />
									) : (
										<AlertTriangle className="w-5 h-5 text-destructive" />
									)}
									<span
										className={`font-semibold ${
											simulation.isCorrect ? 'text-success' : 'text-destructive'
										}`}
									>
										{simulation.isCorrect
											? 'Correct Result'
											: 'Lost Update Bug!'}
									</span>
								</div>
								<div className="text-sm text-muted-foreground">
									Final balance:{' '}
									<span className="font-bold text-foreground">
										${simulation.finalBalance}
									</span>
									{!simulation.isCorrect && (
										<span className="text-destructive ml-1">
											(should be $20)
										</span>
									)}
								</div>
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Transactions & Locking"
					levelNumber={33}
					onComplete={handleComplete}
					onReset={() => {
						setStrategy('none');
						setSimulation(buildSimulation('none'));
						setIsPlaying(false);
						setHasRunSimulation(false);
						setStrategiesViewed(new Set());
						if (timerRef.current) clearTimeout(timerRef.current);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Account Balance Display */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<DollarSign className="w-5 h-5 text-foreground" />
									<span className="text-foreground font-semibold">
										Account Balance
									</span>
								</div>
								{simulation.lockHolder && (
									<div className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-warning/20 text-warning">
										<Lock className="w-3 h-3" />
										Locked by User {simulation.lockHolder}
									</div>
								)}
							</div>
							<div className="p-6 flex items-center justify-center">
								<div
									className={`text-6xl font-bold transition-colors ${
										isSimComplete
											? simulation.isCorrect
												? 'text-success'
												: 'text-destructive'
											: 'text-foreground'
									}`}
								>
									${simulation.balance}
								</div>
							</div>
							<div className="px-6 pb-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
								<span>User A: deduct $30</span>
								<span>User B: deduct $50</span>
								<span className="text-foreground font-medium">
									Expected: $20
								</span>
							</div>
						</div>

						{/* Timeline */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Users className="w-5 h-5 text-foreground" />
									<span className="text-foreground font-semibold">
										Concurrent Operations Timeline
									</span>
								</div>
								<div className="flex items-center gap-3 text-xs">
									<span className="flex items-center gap-1">
										<span className="w-2 h-2 rounded-full bg-primary" />
										User A
									</span>
									<span className="flex items-center gap-1">
										<span className="w-2 h-2 rounded-full bg-purple-400" />
										User B
									</span>
								</div>
							</div>
							<div className="p-4 space-y-3">
								{simulation.steps.map((step, i) => {
									const isActive = i <= simulation.currentStep;
									const isCurrent = i === simulation.currentStep;

									return (
										<div
											className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
												isCurrent
													? `${getActorBg(step.actor)} border-2`
													: isActive
														? 'bg-secondary/50 border-border'
														: 'border-transparent opacity-40'
											}`}
											key={i}
										>
											{/* Step number */}
											<div
												className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
													isActive
														? step.actor === 'A'
															? 'bg-primary text-white'
															: 'bg-purple-500 text-white'
														: 'bg-secondary text-muted-foreground'
												}`}
											>
												{i + 1}
											</div>

											{/* Actor label */}
											<div
												className={`w-16 text-sm font-semibold shrink-0 ${
													isActive
														? getActorColor(step.actor)
														: 'text-muted-foreground'
												}`}
											>
												User {step.actor}
											</div>

											{/* Arrow */}
											<ArrowRight
												className={`w-4 h-4 shrink-0 ${isActive ? 'text-muted-foreground' : 'text-border'}`}
											/>

											{/* Action */}
											<div className="flex-1 min-w-0">
												<span
													className={`text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
												>
													{step.action}
												</span>
												{step.error && isActive && (
													<div className="flex items-center gap-1 text-xs text-destructive mt-1">
														<AlertTriangle className="w-3 h-3" />
														{step.error}
													</div>
												)}
											</div>

											{/* Lock indicator */}
											{step.locked && isActive && (
												<Lock className="w-4 h-4 text-warning shrink-0" />
											)}

											{/* Balance change indicator */}
											{step.balanceWrite !== null && isActive && (
												<div className="text-sm font-mono font-bold text-foreground shrink-0">
													${step.balanceWrite}
												</div>
											)}
										</div>
									);
								})}

								{simulation.steps.length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
										Select a strategy and run the simulation
									</div>
								)}
							</div>

							{/* Final Result Bar */}
							{isSimComplete && (
								<div
									className={`px-4 py-3 border-t flex items-center justify-between ${
										simulation.isCorrect
											? 'bg-success/10 border-success/30'
											: 'bg-destructive/10 border-destructive/30'
									}`}
								>
									<div className="flex items-center gap-2">
										{simulation.isCorrect ? (
											<ShieldCheck className="w-5 h-5 text-success" />
										) : (
											<AlertTriangle className="w-5 h-5 text-destructive" />
										)}
										<span
											className={`text-sm font-semibold ${
												simulation.isCorrect
													? 'text-success'
													: 'text-destructive'
											}`}
										>
											{simulation.isCorrect
												? 'Both deductions applied correctly!'
												: "User A's $30 deduction was lost!"}
										</span>
									</div>
									<span
										className={`text-lg font-bold ${
											simulation.isCorrect ? 'text-success' : 'text-destructive'
										}`}
									>
										Final: ${simulation.finalBalance}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/account.rb',
							language: 'ruby',
							code:
								strategy === 'pessimistic'
									? `# PESSIMISTIC LOCKING
# Locks the database row until transaction completes.
# Other queries wait until the lock is released.

def deduct(amount)
  Account.transaction do
    account = Account.lock.find(params[:id])
    # SELECT * FROM accounts
    #   WHERE id = ? FOR UPDATE

    raise InsufficientFundsError if account.balance < amount

    account.balance -= amount
    account.save!
  end
  # Lock released on COMMIT
end

# Use when:
# - Financial data (money, credits)
# - High contention (many concurrent writes)
# - Short-lived transactions`
									: strategy === 'optimistic'
										? `# OPTIMISTIC LOCKING
# Uses a lock_version column to detect conflicts.
# No database locks -- checks version on save.

# Migration:
# add_column :accounts, :lock_version,
#   :integer, default: 0

def deduct(amount)
  account = Account.find(params[:id])
  account.balance -= amount
  account.save!
  # UPDATE accounts SET balance = ?,
  #   lock_version = 2
  #   WHERE id = ? AND lock_version = 1

rescue ActiveRecord::StaleObjectError
  # Another process updated first!
  retry  # Re-read and try again
end

# Use when:
# - Low contention (rare conflicts)
# - Read-heavy workloads
# - CMS content, user profiles`
										: `# NO PROTECTION -- RACE CONDITION!
# Both users read the same stale balance.

def deduct(amount)
  account = Account.find(params[:id])
  # User A reads $100
  # User B reads $100  (stale!)

  account.balance -= amount
  account.save!
  # User A saves $70
  # User B saves $50  (overwrites A!)
end

# Result: $50 instead of $20
# User A's deduction is silently LOST!


# Always wrap writes in a transaction:
Account.transaction do
  # ... atomic operations here
end`,
							highlight:
								strategy === 'pessimistic'
									? [6, 7, 14, 15]
									: strategy === 'optimistic'
										? [11, 12, 18, 19]
										: [12, 13],
						},
					]}
					learningGoal="Transactions + locking prevent race conditions. Use pessimistic locks for financial data, optimistic locks for low-contention edits."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							When to Use Each
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>
								<span className="text-foreground font-medium">
									Pessimistic:
								</span>{' '}
								Financial data, inventory, high-contention writes
							</li>
							<li>
								<span className="text-foreground font-medium">Optimistic:</span>{' '}
								CMS content, user profiles, low-contention edits
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Rails Methods
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li className="font-mono">Account.transaction do ... end</li>
							<li className="font-mono">Account.lock.find(id)</li>
							<li className="font-mono">lock_version column (optimistic)</li>
							<li className="font-mono">{'with_lock { ... } (shorthand)'}</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level33Transactions;

/**
 * Level 8: The Command Pattern
 *
 * Wrap multiple operations in a Transaction with Command objects.
 * Shows all-or-nothing behavior with rollback animation.
 */

import { useState } from 'react';
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

interface Command {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
}

export function Level8Commands({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [commands, setCommands] = useState<Command[]>([
		{ id: 'charge', name: 'ChargePayment', status: 'pending' },
		{ id: 'inventory', name: 'UpdateInventory', status: 'pending' },
		{ id: 'email', name: 'SendConfirmation', status: 'pending' },
	]);
	const [transactionWrapped, setTransactionWrapped] = useState(false);
	const [simulationRan, setSimulationRan] = useState(false);
	const [showRollback, setShowRollback] = useState(false);
	const [sawProblem, setSawProblem] = useState(false); // Saw failure without transaction
	const [sawRollback, setSawRollback] = useState(false); // Saw rollback with transaction

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!sawProblem) {
			errors.push(
				'Run simulation WITHOUT transaction first to see the problem',
			);
		}

		if (!sawRollback) {
			errors.push('Run simulation WITH transaction to see rollback behavior');
		}

		if (!transactionWrapped) {
			errors.push('Enable Transaction wrapping');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Need to experience both scenarios!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Transaction ensures all-or-nothing behavior!',
		};
	};

	const runSimulation = async () => {
		// Reset
		setCommands((prev) => prev.map((c) => ({ ...c, status: 'pending' })));
		setShowRollback(false);

		// Run commands one by one
		for (let i = 0; i < commands.length; i++) {
			setCommands((prev) =>
				prev.map((c, idx) => (idx === i ? { ...c, status: 'running' } : c)),
			);
			await new Promise((r) => setTimeout(r, 800));

			// Simulate failure on email (3rd command) if not wrapped
			if (i === 2 && !transactionWrapped) {
				setCommands((prev) =>
					prev.map((c, idx) => (idx === i ? { ...c, status: 'failed' } : c)),
				);
				// Show problem - first two succeeded but third failed
				setSimulationRan(true);
				setSawProblem(true); // User saw the problem
				return;
			}

			setCommands((prev) =>
				prev.map((c, idx) => (idx === i ? { ...c, status: 'success' } : c)),
			);
		}

		setSimulationRan(true);
	};

	const runWithRollback = async () => {
		setCommands((prev) => prev.map((c) => ({ ...c, status: 'pending' })));
		setShowRollback(false);

		// Run commands
		for (let i = 0; i < commands.length; i++) {
			setCommands((prev) =>
				prev.map((c, idx) => (idx === i ? { ...c, status: 'running' } : c)),
			);
			await new Promise((r) => setTimeout(r, 600));

			if (i === 2) {
				// Failure triggers rollback
				setCommands((prev) =>
					prev.map((c, idx) => (idx === i ? { ...c, status: 'failed' } : c)),
				);
				await new Promise((r) => setTimeout(r, 400));
				setShowRollback(true);

				// Rollback previous commands
				for (let j = i - 1; j >= 0; j--) {
					await new Promise((r) => setTimeout(r, 400));
					setCommands((prev) =>
						prev.map((c, idx) =>
							idx === j ? { ...c, status: 'rolled_back' } : c,
						),
					);
				}
				setSawRollback(true); // User saw the rollback
				return;
			}

			setCommands((prev) =>
				prev.map((c, idx) => (idx === i ? { ...c, status: 'success' } : c)),
			);
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level8-command-pattern', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getStatusColor = (status: Command['status']) => {
		switch (status) {
			case 'pending':
				return '#6b7280';
			case 'running':
				return '#f59e0b';
			case 'success':
				return '#22c55e';
			case 'failed':
				return '#ef4444';
			case 'rolled_back':
				return '#8b5cf6';
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn the Command pattern with transaction rollback for atomic operations."
					instructions={[
						'Click "Run Without Transaction" to see the problem',
						'Enable Transaction wrapping',
						'Click "Run With Transaction" to see rollback behavior',
					]}
					scenario="Payment succeeded, but the email failed. Now the customer was charged but never got a confirmation. The inventory wasn't updated either."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Transaction Control
						</div>
						<label className="flex items-center gap-3 cursor-pointer mb-4">
							<input
								checked={transactionWrapped}
								className="w-5 h-5 rounded border-border bg-card text-primary focus:ring-primary"
								onChange={(e) => setTransactionWrapped(e.target.checked)}
								type="checkbox"
							/>
							<span className="text-foreground">Wrap in Transaction</span>
						</label>

						<div className="space-y-2">
							<Button
								className="w-full"
								disabled={transactionWrapped}
								onClick={runSimulation}
								variant={transactionWrapped ? 'secondary' : 'destructive'}
							>
								Run Without Transaction
							</Button>
							<Button
								className="w-full"
								disabled={!transactionWrapped}
								onClick={runWithRollback}
								variant={!transactionWrapped ? 'secondary' : 'default'}
							>
								Run With Transaction
							</Button>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="The Command Pattern"
					levelNumber={8}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setCommands([
							{ id: 'charge', name: 'ChargePayment', status: 'pending' },
							{ id: 'inventory', name: 'UpdateInventory', status: 'pending' },
							{ id: 'email', name: 'SendConfirmation', status: 'pending' },
						]);
						setTransactionWrapped(false);
						setSimulationRan(false);
						setShowRollback(false);
						setSawProblem(false);
						setSawRollback(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background flex items-center justify-center p-8">
					{/* Transaction wrapper visualization */}
					<div
						className={`relative p-8 rounded-xl border-2 transition-all ${
							transactionWrapped
								? 'border-primary bg-primary/10'
								: 'border-border bg-card/30'
						}`}
					>
						{transactionWrapped && (
							<div className="absolute -top-3 left-4 px-2 bg-background text-primary text-sm font-mono">
								ActiveRecord::Base.transaction do
							</div>
						)}

						<div className="space-y-4">
							{commands.map((cmd, idx) => (
								<div className="flex items-center gap-4" key={cmd.id}>
									<div
										className="w-48 px-4 py-3 rounded-lg border-2 transition-all"
										style={{
											borderColor: getStatusColor(cmd.status),
											backgroundColor: `${getStatusColor(cmd.status)}20`,
										}}
									>
										<div className="text-foreground font-medium">
											{cmd.name}
										</div>
										<div
											className="text-xs mt-1"
											style={{ color: getStatusColor(cmd.status) }}
										>
											{cmd.status === 'pending' && 'Waiting...'}
											{cmd.status === 'running' && 'Executing...'}
											{cmd.status === 'success' && 'Completed'}
											{cmd.status === 'failed' && 'FAILED!'}
											{cmd.status === 'rolled_back' && 'Rolled back'}
										</div>
									</div>
									{idx < commands.length - 1 && (
										<svg
											className="w-6 h-6 text-muted-foreground"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M19 14l-7 7m0 0l-7-7m7 7V3"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
											/>
										</svg>
									)}
								</div>
							))}
						</div>

						{transactionWrapped && (
							<div className="absolute -bottom-3 left-4 px-2 bg-background text-primary text-sm font-mono">
								end
							</div>
						)}
					</div>

					{/* Rollback animation */}
					{showRollback && (
						<div className="absolute top-1/2 right-8 transform -translate-y-1/2 bg-warning/20 border border-warning rounded-lg p-4 text-warning">
							<div className="text-lg font-bold mb-1">ROLLBACK</div>
							<div className="text-sm">All changes reverted</div>
						</div>
					)}

					{/* Problem indicator */}
					{simulationRan &&
						!transactionWrapped &&
						commands.some((c) => c.status === 'failed') && (
							<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-destructive/20 border border-destructive rounded-lg px-6 py-3 text-destructive">
								Problem: Payment charged but email failed. Data inconsistent!
							</div>
						)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/services/checkout_service.rb',
							language: 'ruby',
							code: transactionWrapped
								? `class CheckoutService
  def call
    ActiveRecord::Base.transaction do
      ChargePaymentCommand.new(@order).call
      UpdateInventoryCommand.new(@order).call
      SendConfirmationCommand.new(@order).call
    end
  rescue => e
    # All changes rolled back automatically
    raise e
  end
end`
								: `class CheckoutService
  def call
    # DANGER: No transaction!
    ChargePaymentCommand.new(@order).call
    UpdateInventoryCommand.new(@order).call
    SendConfirmationCommand.new(@order).call
    # If email fails, payment already charged!
  end
end`,
							highlight: transactionWrapped ? [3, 4, 5, 6, 7, 8, 9] : [3, 7],
						},
					]}
					learningGoal="Transactions ensure all-or-nothing behavior. If any command fails, all previous changes are rolled back."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level8Commands;

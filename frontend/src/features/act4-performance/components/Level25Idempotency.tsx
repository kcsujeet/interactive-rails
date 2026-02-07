/**
 * Level 25: Idempotency
 *
 * Prevent duplicate operations with idempotency keys.
 * Player learns to handle retries safely.
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

interface PaymentAttempt {
	id: number;
	idempotencyKey: string | null;
	amount: number;
	status: 'processing' | 'success' | 'duplicate' | 'error';
	chargeCreated: boolean;
}

interface Config {
	useIdempotencyKey: boolean;
	storeResults: boolean;
	returnCached: boolean;
}

export function Level25Idempotency({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [config, setConfig] = useState<Config>({
		useIdempotencyKey: false,
		storeResults: false,
		returnCached: false,
	});
	const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
	const [totalCharges, setTotalCharges] = useState(0);
	const [processedKeys] = useState<Map<string, PaymentAttempt>>(new Map());
	const [currentKey, setCurrentKey] = useState<string>(
		`key_${Math.random().toString(36).substr(2, 8)}`,
	);

	const chargeAmount = 99.99;

	const processPayment = (isRetry = false) => {
		const key = config.useIdempotencyKey ? currentKey : null;
		const attempt: PaymentAttempt = {
			id: Date.now(),
			idempotencyKey: key,
			amount: chargeAmount,
			status: 'processing',
			chargeCreated: false,
		};

		setAttempts((prev) => [...prev.slice(-9), attempt]);

		setTimeout(() => {
			setAttempts((prev) =>
				prev.map((a) => {
					if (a.id !== attempt.id) return a;

					// Check for duplicate with idempotency
					if (config.useIdempotencyKey && key && processedKeys.has(key)) {
						if (config.returnCached) {
							return { ...a, status: 'duplicate', chargeCreated: false };
						}
					}

					// Process payment
					const success = Math.random() > 0.3; // 70% success rate

					if (success) {
						// Only create charge if not already processed
						if (!config.useIdempotencyKey || !processedKeys.has(key!)) {
							setTotalCharges((prev) => prev + 1);
							if (config.storeResults && key) {
								processedKeys.set(key, {
									...a,
									status: 'success',
									chargeCreated: true,
								});
							}
							return { ...a, status: 'success', chargeCreated: true };
						} else {
							return { ...a, status: 'duplicate', chargeCreated: false };
						}
					} else {
						return { ...a, status: 'error', chargeCreated: false };
					}
				}),
			);
		}, 1000);
	};

	const retryPayment = () => {
		processPayment(true);
	};

	const newPayment = () => {
		setCurrentKey(`key_${Math.random().toString(36).substr(2, 8)}`);
		processPayment(false);
	};

	const toggleConfig = (key: keyof Config) => {
		setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const validateSolution = (): ValidationResult => {
		if (!config.useIdempotencyKey) {
			return {
				valid: false,
				message: 'Enable idempotency keys!',
				details: ['Idempotency keys prevent duplicate charges'],
			};
		}
		if (!config.storeResults || !config.returnCached) {
			return {
				valid: false,
				message: 'Enable all idempotency features!',
				details: ['Store results and return cached responses'],
			};
		}
		return {
			valid: true,
			message: 'Idempotent payment processing configured!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level25-idempotency', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const duplicateCharges =
		totalCharges >
		attempts.filter((a) => a.status === 'success' && a.chargeCreated).length;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Make payment processing safe for retries with idempotency."
					instructions={[
						'Generate unique idempotency key per operation',
						'Store the result with the key',
						'Return cached result for duplicate keys',
						'Never process the same key twice',
					]}
					scenario="A user clicks 'Pay' but gets a network error. They click again. Without idempotency, you charge them twice! This is a lawsuit waiting to happen."
				>
					{/* Charge Counter */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Actual Charges Created
						</div>
						<div
							className={`text-center p-4 rounded-lg border-2 ${
								duplicateCharges
									? 'border-destructive bg-destructive/10'
									: 'border-success bg-success/10'
							}`}
						>
							<div
								className={`text-4xl font-bold ${duplicateCharges ? 'text-destructive' : 'text-success'}`}
							>
								{totalCharges}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{duplicateCharges
									? '⚠️ Duplicate charges detected!'
									: 'No duplicates'}
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Current Idempotency Key
						</div>
						<div className="font-mono text-xs text-primary bg-card p-2 rounded break-all">
							{config.useIdempotencyKey ? currentKey : 'None (unsafe!)'}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Safety features</span>
							<span
								className={
									Object.values(config).filter(Boolean).length === 3
										? 'text-success'
										: 'text-foreground'
								}
							>
								{Object.values(config).filter(Boolean).length} / 3
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Idempotency"
					levelNumber={25}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setConfig({
							useIdempotencyKey: false,
							storeResults: false,
							returnCached: false,
						});
						setAttempts([]);
						setTotalCharges(0);
						processedKeys.clear();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Configuration */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Idempotency Configuration
								</div>
							</div>
							<div className="p-4 grid grid-cols-3 gap-4">
								{[
									{
										key: 'useIdempotencyKey',
										name: 'Use Idempotency Key',
										icon: '🔑',
										desc: 'Client sends unique key per request',
									},
									{
										key: 'storeResults',
										name: 'Store Results',
										icon: '💾',
										desc: 'Save result with idempotency key',
									},
									{
										key: 'returnCached',
										name: 'Return Cached',
										icon: '📦',
										desc: 'Return stored result for duplicate key',
									},
								].map((item) => (
									<Button
										className={`p-4 h-auto rounded-lg border-2 text-left flex-col items-start transition-all ${
											config[item.key as keyof Config]
												? 'border-success bg-success/10'
												: 'border-border bg-card hover:border-muted-foreground'
										}`}
										key={item.key}
										onClick={() => toggleConfig(item.key as keyof Config)}
										variant="ghost"
									>
										<div className="text-2xl mb-2">{item.icon}</div>
										<div
											className={`font-semibold text-sm ${config[item.key as keyof Config] ? 'text-success' : 'text-foreground'}`}
										>
											{item.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{item.desc}
										</div>
									</Button>
								))}
							</div>
						</div>

						{/* Payment Simulation */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Payment Simulation
								</div>
								<div className="text-xs text-muted-foreground">
									Simulate a user making a payment with potential retries
								</div>
							</div>
							<div className="p-6">
								<div className="flex items-center justify-center gap-4 mb-6">
									<div className="text-center p-6 bg-secondary rounded-xl">
										<div className="text-3xl mb-2">💳</div>
										<div className="text-foreground font-semibold">
											${chargeAmount}
										</div>
										<div className="text-xs text-muted-foreground">
											Purchase
										</div>
									</div>

									<div className="flex flex-col gap-2">
										<Button className="px-6 py-3" onClick={newPayment}>
											New Payment
										</Button>
										<Button
											className="px-6 py-3 bg-warning text-warning-foreground hover:bg-warning/90"
											onClick={retryPayment}
											variant="secondary"
										>
											Retry (Same Key)
										</Button>
									</div>
								</div>

								{/* Scenario Explanation */}
								<div className="bg-secondary rounded-lg p-4 text-sm">
									<div className="text-warning font-semibold mb-2">
										Scenario:
									</div>
									<div className="text-muted-foreground">
										User clicks "Pay" → Request times out → User clicks "Retry"
										<br />
										<span
											className={
												config.useIdempotencyKey
													? 'text-success'
													: 'text-destructive'
											}
										>
											{config.useIdempotencyKey
												? '✓ Same idempotency key = safe to retry'
												: '✗ No idempotency key = potential double charge!'}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Attempt Log */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Payment Attempts
								</div>
							</div>
							<div className="p-4 space-y-2 max-h-48 overflow-y-auto">
								{attempts.length === 0 ? (
									<div className="text-center py-4 text-muted-foreground">
										Click "New Payment" or "Retry" to simulate payments
									</div>
								) : (
									attempts.map((attempt) => (
										<div
											className={`p-3 rounded-lg border ${
												attempt.status === 'success'
													? 'border-success bg-success/5'
													: attempt.status === 'duplicate'
														? 'border-warning bg-warning/5'
														: attempt.status === 'error'
															? 'border-destructive bg-destructive/5'
															: 'border-border bg-card'
											}`}
											key={attempt.id}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<span
														className={`text-lg ${
															attempt.status === 'success'
																? '✓'
																: attempt.status === 'duplicate'
																	? '↩️'
																	: attempt.status === 'error'
																		? '✗'
																		: '⏳'
														}`}
													>
														{attempt.status === 'success'
															? '✓'
															: attempt.status === 'duplicate'
																? '↩️'
																: attempt.status === 'error'
																	? '✗'
																	: '⏳'}
													</span>
													<div>
														<div className="text-foreground text-sm">
															${attempt.amount}
														</div>
														<div className="text-xs text-muted-foreground font-mono">
															{attempt.idempotencyKey || 'no key'}
														</div>
													</div>
												</div>
												<div className="text-right">
													<div
														className={`text-sm ${
															attempt.status === 'success'
																? 'text-success'
																: attempt.status === 'duplicate'
																	? 'text-warning'
																	: attempt.status === 'error'
																		? 'text-destructive'
																		: 'text-muted-foreground'
														}`}
													>
														{attempt.status}
													</div>
													<div className="text-xs text-muted-foreground">
														{attempt.chargeCreated
															? 'Charge created'
															: 'No charge'}
													</div>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/services/payment_service.rb',
							language: 'ruby',
							code: `class PaymentService
  def charge(amount:, idempotency_key:)
    # Check for existing result
    if (cached = IdempotencyStore.get(idempotency_key))
      return cached  # Return same result
    end

    # Process payment
    result = Stripe::Charge.create(
      amount: amount,
      idempotency_key: idempotency_key
    )

    # Store result
    IdempotencyStore.set(
      idempotency_key,
      result,
      expires_in: 24.hours
    )

    result
  end
end`,
							highlight: [3, 4, 5, 6, 14, 15, 16, 17, 18],
						},
					]}
					learningGoal="Idempotency ensures the same request produces the same result, no matter how many times it's sent. Critical for payments!"
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Principles
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Client generates unique key</li>
							<li>• Server stores result with key</li>
							<li>• Same key = same result returned</li>
							<li>• Expires after reasonable time</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Use Cases
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Payment processing</li>
							<li>• Order creation</li>
							<li>• Account creation</li>
							<li>• Any non-repeatable action</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level25Idempotency;

/**
 * Level 15: Idempotency
 *
 * Prevent duplicate processing with idempotency keys.
 * Shows webhook delivery retries being handled safely.
 */

import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
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
} from '../shared';

interface WebhookDelivery {
	id: number;
	eventId: string;
	attempt: number;
	status: 'pending' | 'processed' | 'duplicate' | 'error';
}

export function Level15Idempotency({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [idempotencyEnabled, setIdempotencyEnabled] = useState(false);
	const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
	const [chargeCount, setChargeCount] = useState(0);
	const [duplicatesBlocked, setDuplicatesBlocked] = useState(0);
	const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(
		new Set(),
	);
	const [sawOvercharge, setSawOvercharge] = useState(false);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!sawOvercharge) {
			errors.push(
				'Wait to see a customer get overcharged first (observe the problem)',
			);
		}

		if (!idempotencyEnabled) {
			errors.push('Enable Idempotency to prevent duplicate charges');
		}

		if (duplicatesBlocked < 2) {
			errors.push(
				`Need to block at least 2 duplicate webhooks (currently ${duplicatesBlocked})`,
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Idempotency not working yet!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Duplicate webhooks are now safely handled!',
		};
	};

	// Simulate webhook deliveries (with retries)
	useEffect(() => {
		const eventIds = ['evt_001', 'evt_002', 'evt_003'];
		let deliveryIndex = 0;

		const interval = setInterval(() => {
			// Stripe sends webhooks with retries
			const eventId = eventIds[deliveryIndex % 3];
			const attempt = Math.floor(deliveryIndex / 3) + 1;

			const delivery: WebhookDelivery = {
				id: Date.now(),
				eventId,
				attempt,
				status: 'pending',
			};

			setDeliveries((prev) => [...prev.slice(-8), delivery]);

			// Process after a short delay
			setTimeout(() => {
				setDeliveries((prev) =>
					prev.map((d) => {
						if (d.id !== delivery.id) return d;

						if (idempotencyEnabled) {
							// Check if already processed
							if (processedEventIds.has(eventId)) {
								setDuplicatesBlocked((c) => c + 1);
								return { ...d, status: 'duplicate' };
							}
							// Mark as processed
							setProcessedEventIds((prev) => new Set([...prev, eventId]));
						}

						// Process the charge
						setChargeCount((c) => {
							// If this is a duplicate (attempt > 1 for same event), customer is overcharged
							if (!idempotencyEnabled && attempt > 1) {
								setSawOvercharge(true);
							}
							return c + 1;
						});
						return { ...d, status: 'processed' };
					}),
				);
			}, 500);

			deliveryIndex++;
			if (deliveryIndex >= 12) {
				clearInterval(interval);
			}
		}, 1200);

		return () => clearInterval(interval);
	}, [idempotencyEnabled, processedEventIds]);

	const handleComplete = async () => {
		const success = await completeLevel('act3-level15-idempotency', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to use idempotency keys to prevent duplicate processing."
					instructions={[
						'Watch the duplicate webhook deliveries (same event ID)',
						'Notice customers being charged multiple times',
						'Enable idempotency to safely handle duplicates',
					]}
					scenario="Stripe sends payment webhooks with automatic retries. Without idempotency, customers get charged multiple times for the same order!"
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${idempotencyEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
							disabled={idempotencyEnabled}
							onClick={() => {
								setIdempotencyEnabled(true);
								setProcessedEventIds(new Set());
							}}
							variant={idempotencyEnabled ? 'secondary' : 'default'}
						>
							{idempotencyEnabled
								? 'Idempotency Enabled'
								: 'Enable Idempotency'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="grid grid-cols-2 gap-3">
							<div
								className={`rounded-lg p-3 text-center ${
									!idempotencyEnabled && chargeCount > 3
										? 'bg-destructive/20'
										: 'bg-secondary'
								}`}
							>
								<div
									className={`text-2xl font-bold ${
										!idempotencyEnabled && chargeCount > 3
											? 'text-destructive'
											: 'text-foreground'
									}`}
								>
									${chargeCount * 99}
								</div>
								<div className="text-xs text-muted-foreground">
									Total Charged
								</div>
								{!idempotencyEnabled && chargeCount > 3 && (
									<div className="text-destructive text-xs mt-1">
										Customer overcharged!
									</div>
								)}
							</div>
							<div className="bg-success/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-success">
									{duplicatesBlocked}
								</div>
								<div className="text-xs text-success/70">
									Duplicates Blocked
								</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Idempotency"
					levelNumber={15}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setIdempotencyEnabled(false);
						setDeliveries([]);
						setChargeCount(0);
						setDuplicatesBlocked(0);
						setProcessedEventIds(new Set());
						setSawOvercharge(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex items-center justify-center gap-8 mb-8">
						{/* Stripe */}
						<div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 w-40 text-center">
							<div className="text-2xl mb-2">S</div>
							<div className="text-purple-400 text-sm">Stripe</div>
							<div className="text-purple-300 text-xs mt-1">Sends webhooks</div>
						</div>

						<svg
							className="w-8 h-8 text-muted-foreground"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M14 5l7 7m0 0l-7 7m7-7H3"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
							/>
						</svg>

						{/* Idempotency Check */}
						{idempotencyEnabled && (
							<>
								<div className="bg-primary/20 border border-primary rounded-xl p-4 w-40 text-center">
									<div className="text-2xl mb-2">K</div>
									<div className="text-primary text-sm">Idempotency</div>
									<div className="text-primary/80 text-xs mt-1">
										Check event_id
									</div>
								</div>

								<svg
									className="w-8 h-8 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</>
						)}

						{/* Your App */}
						<div className="bg-card border border-border rounded-xl p-4 w-40 text-center">
							<div className="text-2xl mb-2">A</div>
							<div className="text-muted-foreground text-sm">Your App</div>
							<div className="text-muted-foreground text-xs mt-1">
								Charges customer
							</div>
						</div>
					</div>

					{/* Webhook Log */}
					<div className="bg-card rounded-xl p-4 max-w-2xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Webhook Deliveries
						</div>
						<div className="space-y-2 max-h-64 overflow-y-auto">
							{deliveries.map((d) => (
								<div
									className={`flex items-center justify-between p-3 rounded-lg ${
										d.status === 'pending'
											? 'bg-secondary'
											: d.status === 'processed'
												? 'bg-success/20'
												: d.status === 'duplicate'
													? 'bg-warning/20'
													: 'bg-destructive/20'
									}`}
									key={d.id}
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-2 h-2 rounded-full ${
												d.status === 'pending'
													? 'bg-muted-foreground animate-pulse'
													: d.status === 'processed'
														? 'bg-success'
														: d.status === 'duplicate'
															? 'bg-warning'
															: 'bg-destructive'
											}`}
										/>
										<div>
											<span className="text-muted-foreground font-mono text-sm">
												{d.eventId}
											</span>
											<span className="text-muted-foreground text-xs ml-2">
												Attempt #{d.attempt}
											</span>
										</div>
									</div>
									<div className="text-sm">
										{d.status === 'pending' && (
											<span className="text-muted-foreground">
												Processing...
											</span>
										)}
										{d.status === 'processed' && (
											<span className="text-success">Charged $99</span>
										)}
										{d.status === 'duplicate' && (
											<span className="text-warning">Skipped (duplicate)</span>
										)}
									</div>
								</div>
							))}
							{deliveries.length === 0 && (
								<div className="text-muted-foreground text-center py-4">
									Waiting for webhooks...
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
							filename: 'app/services/webhook_processor.rb',
							language: 'ruby',
							code: `class WebhookProcessor
  def process(event)
    # Use event ID as idempotency key
    idempotency_key = "stripe:#{event.id}"

    # Check if already processed
    return if Redis.current.get(idempotency_key)

    # Process the webhook
    case event.type
    when 'payment_intent.succeeded'
      ChargeService.new(event.data).call
    when 'customer.subscription.updated'
      SubscriptionService.new(event.data).call
    end

    # Mark as processed (expire in 24h)
    Redis.current.setex(idempotency_key, 86400, '1')
  rescue => e
    # Don't mark as processed - allow retry
    raise e
  end
end`,
							highlight: [4, 7, 18],
						},
					]}
					learningGoal="Idempotency keys ensure operations are only processed once, even when webhooks are delivered multiple times."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level15Idempotency;

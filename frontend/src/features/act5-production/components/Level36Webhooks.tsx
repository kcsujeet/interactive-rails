/**
 * Level 35: Webhooks
 *
 * Receive and process webhooks from external services.
 * Player learns webhook verification, idempotency, and async processing.
 */

import type { LucideIcon } from 'lucide-react';
import {
	Ban,
	ClipboardList,
	CreditCard,
	FileText,
	Inbox,
	Lock,
	RefreshCw,
	Search,
	Settings,
	User,
	XCircle,
} from 'lucide-react';
import { useState } from 'react';
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

interface WebhookConfig {
	signatureVerification: boolean;
	idempotencyCheck: boolean;
	asyncProcessing: boolean;
	logging: boolean;
}

interface WebhookEvent {
	id: string;
	type: string;
	signature: string;
	isDuplicate: boolean;
	status:
		| 'received'
		| 'verified'
		| 'processing'
		| 'completed'
		| 'rejected'
		| 'duplicate';
	timestamp: number;
}

const WEBHOOK_TYPES: { type: string; Icon: LucideIcon; description: string }[] =
	[
		{
			type: 'payment.completed',
			Icon: CreditCard,
			description: 'Payment successful',
		},
		{ type: 'payment.failed', Icon: XCircle, description: 'Payment declined' },
		{
			type: 'subscription.created',
			Icon: ClipboardList,
			description: 'New subscription',
		},
		{
			type: 'subscription.canceled',
			Icon: Ban,
			description: 'Subscription ended',
		},
		{
			type: 'customer.updated',
			Icon: User,
			description: 'Customer info changed',
		},
	];

export function Level36Webhooks({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [config, setConfig] = useState<WebhookConfig>({
		signatureVerification: false,
		idempotencyCheck: false,
		asyncProcessing: false,
		logging: false,
	});
	const [events, setEvents] = useState<WebhookEvent[]>([]);
	const [processedIds] = useState<Set<string>>(new Set());

	const toggleConfig = (key: keyof WebhookConfig) => {
		setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const simulateWebhook = (type: string, isDuplicate = false) => {
		const eventId =
			isDuplicate && events.length > 0
				? events[events.length - 1].id
				: `evt_${Math.random().toString(36).substr(2, 9)}`;

		const hasValidSignature = Math.random() > 0.2; // 80% valid

		const event: WebhookEvent = {
			id: eventId,
			type,
			signature: hasValidSignature ? 'valid_signature' : 'invalid_signature',
			isDuplicate,
			status: 'received',
			timestamp: Date.now(),
		};

		setEvents((prev) => [...prev.slice(-9), event]);

		// Process webhook based on config
		setTimeout(() => {
			setEvents((prev) =>
				prev.map((e) => {
					if (e.id !== event.id || e.timestamp !== event.timestamp) return e;

					// Signature verification
					if (config.signatureVerification && !hasValidSignature) {
						return { ...e, status: 'rejected' };
					}

					// Idempotency check
					if (
						config.idempotencyCheck &&
						isDuplicate &&
						processedIds.has(event.id)
					) {
						return { ...e, status: 'duplicate' };
					}

					return { ...e, status: 'verified' };
				}),
			);
		}, 500);

		setTimeout(() => {
			setEvents((prev) =>
				prev.map((e) => {
					if (e.id !== event.id || e.timestamp !== event.timestamp) return e;
					if (e.status === 'rejected' || e.status === 'duplicate') return e;
					return {
						...e,
						status: config.asyncProcessing ? 'processing' : 'completed',
					};
				}),
			);
			processedIds.add(event.id);
		}, 1000);

		if (config.asyncProcessing) {
			setTimeout(() => {
				setEvents((prev) =>
					prev.map((e) => {
						if (e.id !== event.id || e.timestamp !== event.timestamp) return e;
						if (e.status !== 'processing') return e;
						return { ...e, status: 'completed' };
					}),
				);
			}, 2000);
		}
	};

	const validateSolution = (): ValidationResult => {
		const enabledCount = Object.values(config).filter(Boolean).length;
		if (enabledCount < 3) {
			return {
				valid: false,
				message: 'Enable more webhook security features!',
				details: ['At least 3 features needed for production-ready webhooks'],
			};
		}
		return { valid: true, message: 'Secure webhook handling configured!' };
	};

	const handleComplete = async () => {
		const success = await completeLevel('act5-level36-webhooks', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getStatusColor = (status: WebhookEvent['status']) => {
		switch (status) {
			case 'completed':
				return 'text-success bg-success/10';
			case 'verified':
			case 'processing':
				return 'text-primary bg-primary/10';
			case 'rejected':
				return 'text-destructive bg-destructive/10';
			case 'duplicate':
				return 'text-warning bg-warning/10';
			default:
				return 'text-muted-foreground bg-card';
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Handle webhooks securely and reliably for production systems."
					instructions={[
						'Verify signatures to prevent forgery',
						'Check idempotency to handle duplicates',
						'Process async to respond quickly',
						'Log everything for debugging',
					]}
					scenario="Stripe sends you payment notifications via webhooks. But webhooks can be forged, duplicated, or fail during processing. Build a robust webhook handler!"
				>
					{/* Configuration */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Security Features
						</div>
						<div className="space-y-2">
							{[
								{
									key: 'signatureVerification',
									name: 'Signature Verification',
									desc: 'Verify webhook authenticity',
								},
								{
									key: 'idempotencyCheck',
									name: 'Idempotency Check',
									desc: 'Detect duplicate events',
								},
								{
									key: 'asyncProcessing',
									name: 'Async Processing',
									desc: 'Process in background',
								},
								{
									key: 'logging',
									name: 'Event Logging',
									desc: 'Audit trail for debugging',
								},
							].map((item) => (
								<Button
									className={`w-full p-2 h-auto text-left justify-start flex-col items-start rounded-lg border ${
										config[item.key as keyof WebhookConfig]
											? 'border-success bg-success/10'
											: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={item.key}
									onClick={() => toggleConfig(item.key as keyof WebhookConfig)}
									variant="ghost"
								>
									<div className="flex items-center justify-between w-full">
										<span
											className={`text-sm ${config[item.key as keyof WebhookConfig] ? 'text-success' : 'text-foreground'}`}
										>
											{item.name}
										</span>
										{config[item.key as keyof WebhookConfig] && (
											<span className="text-success text-xs">✓</span>
										)}
									</div>
									<div className="text-xs text-muted-foreground">
										{item.desc}
									</div>
								</Button>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Features enabled</span>
							<span
								className={
									Object.values(config).filter(Boolean).length >= 3
										? 'text-success'
										: 'text-foreground'
								}
							>
								{Object.values(config).filter(Boolean).length} / 4
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Webhooks"
					levelNumber={36}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setConfig({
							signatureVerification: false,
							idempotencyCheck: false,
							asyncProcessing: false,
							logging: false,
						});
						setEvents([]);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Webhook Triggers */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Simulate Incoming Webhooks
								</div>
								<div className="text-xs text-muted-foreground">
									Click to send webhook events from Stripe
								</div>
							</div>

							<div className="p-4 grid grid-cols-3 gap-3">
								{WEBHOOK_TYPES.map((wh) => (
									<Button
										className="p-3 h-auto rounded-lg bg-card border border-border hover:border-primary transition-all text-left flex-col items-start"
										key={wh.type}
										onClick={() => simulateWebhook(wh.type)}
										variant="ghost"
									>
										<div className="flex items-center gap-2 mb-1">
											<wh.Icon className="w-4 h-4" />
											<span className="text-primary text-xs font-mono">
												{wh.type}
											</span>
										</div>
										<div className="text-xs text-muted-foreground">
											{wh.description}
										</div>
									</Button>
								))}
								<Button
									className="p-3 h-auto rounded-lg bg-warning/10 border border-warning hover:border-warning/80 transition-all text-left flex-col items-start"
									onClick={() => simulateWebhook(WEBHOOK_TYPES[0].type, true)}
									variant="ghost"
								>
									<div className="flex items-center gap-2 mb-1">
										<RefreshCw className="w-4 h-4" />
										<span className="text-warning text-xs font-mono">
											duplicate
										</span>
									</div>
									<div className="text-xs text-muted-foreground">
										Send duplicate event
									</div>
								</Button>
							</div>
						</div>

						{/* Processing Pipeline */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Processing Pipeline
								</div>
							</div>
							<div className="p-6">
								<div className="flex items-center justify-between">
									{(
										[
											{ name: 'Receive', Icon: Inbox, active: true },
											{
												name: 'Verify',
												Icon: Lock,
												active: config.signatureVerification,
											},
											{
												name: 'Dedupe',
												Icon: Search,
												active: config.idempotencyCheck,
											},
											{
												name: 'Queue',
												Icon: ClipboardList,
												active: config.asyncProcessing,
											},
											{ name: 'Process', Icon: Settings, active: true },
											{ name: 'Log', Icon: FileText, active: config.logging },
										] as const
									).map((step, i, arr) => (
										<div className="flex items-center" key={step.name}>
											<div
												className={`flex flex-col items-center ${step.active ? '' : 'opacity-30'}`}
											>
												<div
													className={`w-12 h-12 rounded-full flex items-center justify-center ${
														step.active ? 'bg-primary' : 'bg-secondary'
													}`}
												>
													<step.Icon className="w-5 h-5 text-white" />
												</div>
												<span className="text-xs text-muted-foreground mt-2">
													{step.name}
												</span>
											</div>
											{i < arr.length - 1 && (
												<div
													className={`w-8 h-0.5 mx-2 ${step.active ? 'bg-primary' : 'bg-secondary'}`}
												/>
											)}
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Event Log */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">Event Log</div>
							</div>
							<div className="p-4 space-y-2 max-h-64 overflow-y-auto">
								{events.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Click a webhook type above to simulate receiving events
									</div>
								) : (
									events.map((event, i) => (
										<div
											className={`p-3 rounded-lg border ${
												event.status === 'rejected'
													? 'border-destructive'
													: event.status === 'duplicate'
														? 'border-warning'
														: 'border-border'
											}`}
											key={`${event.id}-${event.timestamp}`}
										>
											<div className="flex items-center justify-between mb-1">
												<div className="flex items-center gap-2">
													<span className="font-mono text-xs text-muted-foreground">
														{event.id}
													</span>
													<span className="text-primary text-xs">
														{event.type}
													</span>
													{event.isDuplicate && (
														<span className="text-xs px-1 bg-warning/20 text-warning rounded">
															DUPLICATE
														</span>
													)}
												</div>
												<span
													className={`text-xs px-2 py-1 rounded ${getStatusColor(event.status)}`}
												>
													{event.status}
												</span>
											</div>
											{config.logging && (
												<div className="text-xs text-muted-foreground font-mono">
													sig:{' '}
													{event.signature === 'valid_signature'
														? '✓ valid'
														: '✗ invalid'}
												</div>
											)}
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
							filename: 'app/controllers/webhooks_controller.rb',
							language: 'ruby',
							code: `class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    payload = request.body.read
    sig = request.headers['Stripe-Signature']

    # 1. Verify signature
    event = Stripe::Webhook.construct_event(
      payload, sig, ENV['STRIPE_WEBHOOK_SECRET']
    )

    # 2. Check idempotency
    return head :ok if WebhookEvent
      .exists?(external_id: event.id)

    # 3. Log event
    WebhookEvent.create!(
      external_id: event.id,
      event_type: event.type,
      payload: payload
    )

    # 4. Process async
    ProcessWebhookJob.perform_later(event.id)

    head :ok
  rescue Stripe::SignatureVerificationError
    head :bad_request
  end
end`,
							highlight: config.signatureVerification ? [8, 9, 10] : [],
						},
					]}
					learningGoal="Webhooks need security (signatures), reliability (idempotency), and performance (async processing)."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Always verify signatures</li>
							<li>• Handle duplicate deliveries</li>
							<li>• Return 200 quickly, process later</li>
							<li>• Log for debugging</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Common Webhooks
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Stripe - Payments</li>
							<li>• GitHub - Code events</li>
							<li>• Twilio - SMS status</li>
							<li>• Slack - Bot events</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level36Webhooks;

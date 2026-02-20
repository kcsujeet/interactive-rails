/**
 * Level 47: Domain Events
 *
 * Decouple services using event bus pub/sub.
 * Shows domain events pattern.
 */

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

interface Service {
	id: string;
	name: string;
	status: 'idle' | 'processing' | 'done';
}

interface Event {
	id: number;
	type: string;
	from: string;
	to: string[];
}

export function Level52DomainEvents({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [eventBusEnabled, setEventBusEnabled] = useState(false);
	const [services, setServices] = useState<Service[]>([
		{ id: 'email', name: 'Email Service', status: 'idle' },
		{ id: 'inventory', name: 'Inventory Service', status: 'idle' },
		{ id: 'analytics', name: 'Analytics Service', status: 'idle' },
		{ id: 'shipping', name: 'Shipping Service', status: 'idle' },
	]);
	const [events, setEvents] = useState<Event[]>([]);
	const [orderCount, setOrderCount] = useState(0);
	const [orderCountBefore, setOrderCountBefore] = useState(0); // Orders processed before enabling event bus
	const [orderCountAfter, setOrderCountAfter] = useState(0); // Orders processed after enabling event bus
	const [isProcessing, setIsProcessing] = useState(false);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (orderCountBefore === 0) {
			errors.push(
				'Process at least one order WITHOUT the Event Bus first to see the problem',
			);
		}

		if (!eventBusEnabled) {
			errors.push('Enable the Event Bus to decouple services');
		}

		if (orderCountAfter < 1) {
			errors.push(
				'Process at least one order WITH the Event Bus to see the improvement',
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Experience both architectures first!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Services are now loosely coupled via events!',
		};
	};

	const processOrder = async () => {
		if (isProcessing) return;
		setIsProcessing(true);
		setOrderCount((c) => c + 1);

		// Track orders before/after event bus
		if (eventBusEnabled) {
			setOrderCountAfter((c) => c + 1);
		} else {
			setOrderCountBefore((c) => c + 1);
		}

		// Reset services
		setServices((prev) => prev.map((s) => ({ ...s, status: 'idle' })));

		if (eventBusEnabled) {
			// Event-driven: publish once, all subscribe
			const eventId = Date.now();
			setEvents((prev) => [
				...prev.slice(-5),
				{
					id: eventId,
					type: 'OrderCompleted',
					from: 'Checkout',
					to: ['email', 'inventory', 'analytics', 'shipping'],
				},
			]);

			// All services process in parallel
			await new Promise((r) => setTimeout(r, 300));
			setServices((prev) => prev.map((s) => ({ ...s, status: 'processing' })));
			await new Promise((r) => setTimeout(r, 800));
			setServices((prev) => prev.map((s) => ({ ...s, status: 'done' })));
		} else {
			// Direct coupling: call each service sequentially
			for (const service of services) {
				setServices((prev) =>
					prev.map((s) =>
						s.id === service.id ? { ...s, status: 'processing' } : s,
					),
				);
				await new Promise((r) => setTimeout(r, 600));
				setServices((prev) =>
					prev.map((s) => (s.id === service.id ? { ...s, status: 'done' } : s)),
				);
			}
		}

		setIsProcessing(false);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act7-level52-domain-events', {
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
					goal="Learn event-driven architecture for loose coupling between services."
					instructions={[
						'Click "Place Order" to see direct coupling (sequential)',
						'Enable Event Bus',
						'See services process in parallel via events',
					]}
					scenario="Checkout service directly calls Email, Inventory, Analytics, and Shipping. If one is slow, the whole order fails. Adding a new service means modifying Checkout."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								eventBusEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={eventBusEnabled}
							onClick={() => setEventBusEnabled(true)}
						>
							{eventBusEnabled ? 'Event Bus Enabled' : 'Enable Event Bus'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-3"
							disabled={isProcessing}
							onClick={processOrder}
							variant="secondary"
						>
							{isProcessing ? 'Processing...' : 'Place Order'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Architecture
						</div>
						<div
							className={`text-sm p-3 rounded-lg ${
								eventBusEnabled
									? 'bg-success/20 text-success'
									: 'bg-destructive/20 text-destructive'
							}`}
						>
							{eventBusEnabled ? (
								<div>Pub/Sub - Loosely coupled</div>
							) : (
								<div>Direct calls - Tightly coupled</div>
							)}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Event-Driven"
					levelNumber={52}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setEventBusEnabled(false);
						setServices([
							{ id: 'email', name: 'Email Service', status: 'idle' },
							{ id: 'inventory', name: 'Inventory Service', status: 'idle' },
							{ id: 'analytics', name: 'Analytics Service', status: 'idle' },
							{ id: 'shipping', name: 'Shipping Service', status: 'idle' },
						]);
						setEvents([]);
						setOrderCount(0);
						setOrderCountBefore(0);
						setOrderCountAfter(0);
						setIsProcessing(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture Visualization */}
					<div className="flex flex-col items-center">
						{/* Checkout */}
						<div className="bg-secondary border border-border rounded-xl p-4 w-48 text-center mb-6">
							<div className="text-primary font-medium">Checkout Service</div>
							<div className="text-muted-foreground text-xs mt-1">
								Orders #{orderCount}
							</div>
						</div>

						{/* Connection visualization */}
						{eventBusEnabled ? (
							/* Event Bus */
							<div className="relative mb-6">
								<div className="bg-primary/20 border border-primary rounded-full px-6 py-2">
									<span className="text-primary text-sm">Event Bus</span>
								</div>
								{events.length > 0 && events[events.length - 1] && (
									<div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-primary/30 text-primary text-xs px-2 py-1 rounded whitespace-nowrap">
										{events[events.length - 1].type}
									</div>
								)}
							</div>
						) : (
							/* Direct arrows */
							<div className="h-12 flex items-center">
								<svg
									className="w-8 h-8 text-destructive"
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
								<span className="text-destructive text-xs ml-2">
									Direct calls (sequential)
								</span>
							</div>
						)}

						{/* Services Grid */}
						<div className="grid grid-cols-2 gap-4 mt-8">
							{services.map((service) => (
								<div
									className={`border rounded-xl p-4 w-40 text-center transition-all ${
										service.status === 'idle'
											? 'bg-card border-border'
											: service.status === 'processing'
												? 'bg-warning/20 border-warning'
												: 'bg-success/20 border-success'
									}`}
									key={service.id}
								>
									<div
										className={`text-sm font-medium ${
											service.status === 'idle'
												? 'text-muted-foreground'
												: service.status === 'processing'
													? 'text-warning'
													: 'text-success'
										}`}
									>
										{service.name}
									</div>
									<div className="text-xs mt-1">
										{service.status === 'idle' && (
											<span className="text-muted-foreground">Waiting</span>
										)}
										{service.status === 'processing' && (
											<span className="text-warning">Processing...</span>
										)}
										{service.status === 'done' && (
											<span className="text-success">Done</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/events/order_completed_event.rb',
							language: 'ruby',
							code: `class OrderCompletedEvent
  include Wisper::Publisher

  def initialize(order)
    @order = order
  end

  def call
    broadcast(:order_completed, @order)
  end
end

# Subscribers register globally
Rails.application.config.after_initialize do
  OrderCompletedEvent.subscribe(EmailSubscriber.new)
  OrderCompletedEvent.subscribe(InventorySubscriber.new)
  OrderCompletedEvent.subscribe(AnalyticsSubscriber.new)
  OrderCompletedEvent.subscribe(ShippingSubscriber.new)
end

# In Checkout Service:
class CheckoutService
  def call(order)
    order.complete!
    OrderCompletedEvent.new(order).call
    # That's it! No direct dependencies!
  end
end`,
							highlight: [8, 9, 15, 16, 17, 18, 25, 26],
						},
					]}
					learningGoal="Event-driven architecture decouples services. Publishers don't know about subscribers, making the system easier to extend."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level52DomainEvents;

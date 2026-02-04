/**
 * Level 7: Building a Service Object
 *
 * Player constructs a proper service with initialize+call pattern,
 * dependency injection, and result objects.
 */

import { useState } from 'react';
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

interface ServiceComponent {
	id: string;
	name: string;
	code: string;
	color: string;
	description: string;
	section: 'dependencies' | 'initialize' | 'steps' | 'results';
	order?: number; // For steps that need ordering
	placed: boolean;
}

interface ServiceSection {
	id: 'dependencies' | 'initialize' | 'steps' | 'results';
	name: string;
	description: string;
	acceptsMultiple: boolean;
	requiredCount: number;
}

const SERVICE_SECTIONS: ServiceSection[] = [
	{
		id: 'dependencies',
		name: 'Dependencies',
		description: 'What the service needs to do its job',
		acceptsMultiple: true,
		requiredCount: 2,
	},
	{
		id: 'initialize',
		name: 'Initialize',
		description: 'Set up the service with its dependencies',
		acceptsMultiple: false,
		requiredCount: 1,
	},
	{
		id: 'steps',
		name: 'Call Method',
		description: 'The business logic steps (in order)',
		acceptsMultiple: true,
		requiredCount: 3,
	},
	{
		id: 'results',
		name: 'Result Handling',
		description: 'Return success or failure',
		acceptsMultiple: true,
		requiredCount: 2,
	},
];

const INITIAL_COMPONENTS: ServiceComponent[] = [
	// Dependencies
	{
		id: 'dep-order',
		name: 'Order',
		code: 'attr_reader :order',
		color: '#8b5cf6',
		description: 'The order to process',
		section: 'dependencies',
		placed: false,
	},
	{
		id: 'dep-gateway',
		name: 'Payment Gateway',
		code: 'attr_reader :payment_gateway',
		color: '#3b82f6',
		description: 'Handles payment processing',
		section: 'dependencies',
		placed: false,
	},
	// Initialize
	{
		id: 'init',
		name: 'Constructor',
		code: 'def initialize(order:, payment_gateway: Stripe::Gateway.new)',
		color: '#06b6d4',
		description: 'Dependency injection via constructor',
		section: 'initialize',
		placed: false,
	},
	// Steps (must be in correct order)
	{
		id: 'step-validate',
		name: '1. Validate',
		code: 'return failure(order.errors) unless order.valid?',
		color: '#22c55e',
		description: 'Check data before processing',
		section: 'steps',
		order: 1,
		placed: false,
	},
	{
		id: 'step-pay',
		name: '2. Charge Payment',
		code: 'payment_gateway.charge(order.total_cents)',
		color: '#f59e0b',
		description: 'Process the payment',
		section: 'steps',
		order: 2,
		placed: false,
	},
	{
		id: 'step-save',
		name: '3. Save & Notify',
		code: 'order.save! && OrderMailer.receipt(order).deliver_later',
		color: '#ef4444',
		description: 'Persist and send confirmation',
		section: 'steps',
		order: 3,
		placed: false,
	},
	// Results
	{
		id: 'result-success',
		name: 'Success Result',
		code: 'Success.new(order)',
		color: '#10b981',
		description: 'Return success with data',
		section: 'results',
		placed: false,
	},
	{
		id: 'result-failure',
		name: 'Failure Result',
		code: 'Failure.new(errors)',
		color: '#dc2626',
		description: 'Return failure with errors',
		section: 'results',
		placed: false,
	},
];

export function Level7Services({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [components, setComponents] =
		useState<ServiceComponent[]>(INITIAL_COMPONENTS);
	const [placedInSection, setPlacedInSection] = useState<
		Record<string, string[]>
	>({
		dependencies: [],
		initialize: [],
		steps: [],
		results: [],
	});
	const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
	const [dragOverSection, setDragOverSection] = useState<string | null>(null);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		// Check each section has required components
		for (const section of SERVICE_SECTIONS) {
			const placed = placedInSection[section.id];
			if (placed.length < section.requiredCount) {
				errors.push(
					`${section.name} needs ${section.requiredCount - placed.length} more component(s)`,
				);
			}
		}

		// Check components are in correct sections
		for (const comp of components) {
			if (comp.placed) {
				const inSection = Object.entries(placedInSection).find(([_, ids]) =>
					ids.includes(comp.id),
				)?.[0];
				if (inSection !== comp.section) {
					errors.push(`"${comp.name}" is in the wrong section`);
				}
			}
		}

		// Check steps are in correct order
		const stepsPlaced = placedInSection.steps;
		const stepsWithOrder = stepsPlaced
			.map((id) => components.find((c) => c.id === id))
			.filter((c) => c?.order !== undefined);

		for (let i = 0; i < stepsWithOrder.length - 1; i++) {
			const current = stepsWithOrder[i];
			const next = stepsWithOrder[i + 1];
			if (current && next && current.order! > next.order!) {
				errors.push(
					`Steps are in wrong order: ${current.name} should come before ${next.name}`,
				);
			}
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Service needs adjustments!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Well-structured service with proper patterns!',
		};
	};

	const handleDragStart = (componentId: string) => {
		setDraggedComponent(componentId);
	};

	const handleDragEnd = () => {
		setDraggedComponent(null);
		setDragOverSection(null);
	};

	const handleDropOnSection = (sectionId: string) => {
		if (!draggedComponent) return;

		const component = components.find((c) => c.id === draggedComponent);
		if (!component) return;

		// Remove from previous section if placed
		if (component.placed) {
			setPlacedInSection((prev) => {
				const updated = { ...prev };
				for (const key of Object.keys(updated)) {
					updated[key] = updated[key].filter((id) => id !== draggedComponent);
				}
				return updated;
			});
		}

		// Add to new section
		setPlacedInSection((prev) => ({
			...prev,
			[sectionId]: [...prev[sectionId], draggedComponent],
		}));

		// Mark as placed
		setComponents((prev) =>
			prev.map((c) => (c.id === draggedComponent ? { ...c, placed: true } : c)),
		);

		setDraggedComponent(null);
		setDragOverSection(null);
	};

	const handleRemoveFromSection = (componentId: string) => {
		setPlacedInSection((prev) => {
			const updated = { ...prev };
			for (const key of Object.keys(updated)) {
				updated[key] = updated[key].filter((id) => id !== componentId);
			}
			return updated;
		});

		setComponents((prev) =>
			prev.map((c) => (c.id === componentId ? { ...c, placed: false } : c)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level7-service-objects', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Get components in palette (not placed)
	const paletteComponents = components.filter((c) => !c.placed);

	// Get components in a section
	const getComponentsInSection = (sectionId: string) =>
		placedInSection[sectionId]
			.map((id) => components.find((c) => c.id === id))
			.filter((c): c is ServiceComponent => c !== undefined);

	// Generate code preview
	const generateCodePreview = () => {
		const deps = getComponentsInSection('dependencies');
		const init = getComponentsInSection('initialize');
		const steps = getComponentsInSection('steps');
		const results = getComponentsInSection('results');

		const hasSuccess = results.some((r) => r.id === 'result-success');
		const hasFailure = results.some((r) => r.id === 'result-failure');

		return `class CheckoutService
  ${deps.map((d) => d.code).join('\n  ') || '# Add dependencies here'}

  ${init[0]?.code || '# Add constructor here'}
    @order = order
    @payment_gateway = payment_gateway
  end

  def call
    ${steps.length > 0 ? steps.map((s) => s.code).join('\n    ') : '# Add business logic steps here'}

    ${hasSuccess ? 'Success.new(order)' : '# Return success result'}
  rescue PaymentError => e
    ${hasFailure ? 'Failure.new(e.message)' : '# Return failure result'}
  end

  # Result objects for explicit success/failure
  Success = Struct.new(:order) do
    def success? = true
    def failure? = false
  end

  Failure = Struct.new(:error) do
    def success? = false
    def failure? = true
  end
end`;
	};

	// Calculate progress
	const totalRequired = SERVICE_SECTIONS.reduce(
		(sum, s) => sum + s.requiredCount,
		0,
	);
	const totalPlaced = Object.values(placedInSection).flat().length;
	const correctlyPlaced = components.filter((c) => {
		if (!c.placed) return false;
		const inSection = Object.entries(placedInSection).find(([_, ids]) =>
			ids.includes(c.id),
		)?.[0];
		return inSection === c.section;
	}).length;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn the Service Object pattern - a PORO with initialize + call interface."
					instructions={[
						'Drag components to build the CheckoutService',
						'Dependencies: What the service needs',
						'Initialize: Constructor with dependency injection',
						'Call: Business logic steps in correct order',
						'Results: Explicit success/failure handling',
					]}
					scenario="The checkout flow is ready to build. Construct a proper Service Object with dependency injection, clear interface, and result objects."
				>
					{/* Component Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Components ({paletteComponents.length} remaining)
						</div>
						<div className="space-y-2 max-h-64 overflow-y-auto">
							{paletteComponents.map((comp) => (
								<div
									className="p-2 rounded-lg cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
									draggable
									key={comp.id}
									onDragEnd={handleDragEnd}
									onDragStart={() => handleDragStart(comp.id)}
									style={{ backgroundColor: comp.color }}
								>
									<div className="text-foreground text-sm font-medium">
										{comp.name}
									</div>
									<div className="text-foreground/60 text-xs">
										{comp.description}
									</div>
								</div>
							))}
							{paletteComponents.length === 0 && (
								<div className="text-muted-foreground text-sm text-center py-4">
									All components placed!
								</div>
							)}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correctly Placed</span>
							<span
								className={
									correctlyPlaced === totalRequired
										? 'text-success'
										: 'text-foreground'
								}
							>
								{correctlyPlaced} / {totalRequired}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{ width: `${(correctlyPlaced / totalRequired) * 100}%` }}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Building a Service Object"
					levelNumber={7}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setComponents(INITIAL_COMPONENTS);
						setPlacedInSection({
							dependencies: [],
							initialize: [],
							steps: [],
							results: [],
						});
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					{/* Service Builder */}
					<div className="max-w-2xl mx-auto">
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							{/* Service Header */}
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-primary font-mono text-sm">
									class CheckoutService
								</div>
							</div>

							{/* Sections */}
							{SERVICE_SECTIONS.map((section) => {
								const sectionComponents = getComponentsInSection(section.id);
								const isComplete =
									sectionComponents.length >= section.requiredCount;
								const allCorrect = sectionComponents.every(
									(c) => c.section === section.id,
								);

								return (
									<div
										className={`border-b border-border last:border-b-0 transition-colors ${
											dragOverSection === section.id ? 'bg-foreground/5' : ''
										}`}
										key={section.id}
										onDragLeave={() => setDragOverSection(null)}
										onDragOver={(e) => {
											e.preventDefault();
											setDragOverSection(section.id);
										}}
										onDrop={() => handleDropOnSection(section.id)}
									>
										{/* Section Header */}
										<div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
											<div>
												<span className="text-foreground font-medium text-sm">
													{section.name}
												</span>
												<span className="text-muted-foreground text-xs ml-2">
													({section.description})
												</span>
											</div>
											<div
												className={`text-xs px-2 py-0.5 rounded ${
													isComplete && allCorrect
														? 'bg-success/20 text-success'
														: 'bg-secondary text-muted-foreground'
												}`}
											>
												{sectionComponents.length} / {section.requiredCount}
											</div>
										</div>

										{/* Section Content */}
										<div className="p-4 min-h-[80px]">
											{sectionComponents.length > 0 ? (
												<div className="space-y-2">
													{sectionComponents.map((comp) => {
														const isCorrectSection =
															comp.section === section.id;
														return (
															<div
																className={`p-2 rounded-lg relative group ${
																	isCorrectSection
																		? 'ring-1 ring-success/50'
																		: 'ring-1 ring-destructive/50'
																}`}
																key={comp.id}
																style={{ backgroundColor: comp.color }}
															>
																<div className="flex items-center justify-between">
																	<div>
																		<div className="text-foreground text-sm font-medium">
																			{comp.name}
																		</div>
																		<div className="text-foreground/70 text-xs font-mono">
																			{comp.code}
																		</div>
																	</div>
																	<Button
																		className="w-6 h-6 rounded bg-black/30 text-foreground/70 hover:text-foreground hover:bg-black/50 flex items-center justify-center text-sm"
																		onClick={() =>
																			handleRemoveFromSection(comp.id)
																		}
																		size="icon"
																		variant="ghost"
																	>
																		×
																	</Button>
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div
													className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
														dragOverSection === section.id
															? 'border-primary/50 text-primary/70'
															: 'border-border text-muted-foreground'
													}`}
												>
													Drop {section.name.toLowerCase()} here
												</div>
											)}
										</div>
									</div>
								);
							})}

							{/* Service Footer */}
							<div className="bg-secondary px-4 py-2">
								<div className="text-primary font-mono text-sm">end</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/services/checkout_service.rb',
							language: 'ruby',
							code: generateCodePreview(),
							highlight: [1, 5, 10, 14, 18],
						},
					]}
					learningGoal="Service Objects are POROs (Plain Old Ruby Objects) with a clear interface: initialize for setup, call for execution."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Service Object Benefits
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ Single responsibility (one job)</li>
							<li>+ Easy to test (inject mock dependencies)</li>
							<li>+ Explicit results (no exceptions for control flow)</li>
							<li>+ Reusable across controllers/jobs</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Common Patterns
						</div>
						<div className="text-xs text-muted-foreground space-y-2">
							<div>
								<span className="text-foreground">initialize:</span> Receive
								dependencies
							</div>
							<div>
								<span className="text-foreground">call:</span> Execute business
								logic
							</div>
							<div>
								<span className="text-foreground">Result:</span> Return
								Success/Failure
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Services;

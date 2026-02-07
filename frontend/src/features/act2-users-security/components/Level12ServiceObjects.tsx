/**
 * Level 12: Service Objects
 *
 * Build a service object by placing components into correct sections.
 * Teaches: Service object pattern with initialize + call interface.
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

interface ServiceComponent {
	id: string;
	name: string;
	code: string;
	color: string;
	description: string;
	correctSection: 'dependencies' | 'initialize' | 'call' | 'private';
	currentSection: string | null;
}

const SERVICE_COMPONENTS: ServiceComponent[] = [
	{
		id: 'order_dep',
		name: '@order',
		code: 'attr_reader :order',
		color: '#3b82f6',
		description: 'Order to process',
		correctSection: 'dependencies',
		currentSection: null,
	},
	{
		id: 'gateway_dep',
		name: '@gateway',
		code: 'attr_reader :gateway',
		color: '#8b5cf6',
		description: 'Payment gateway',
		correctSection: 'dependencies',
		currentSection: null,
	},
	{
		id: 'init',
		name: 'initialize',
		code: 'def initialize(order, gateway: Stripe)',
		color: '#06b6d4',
		description: 'Dependency injection',
		correctSection: 'initialize',
		currentSection: null,
	},
	{
		id: 'validate',
		name: 'validate!',
		code: 'raise InvalidOrder unless order.valid?',
		color: '#22c55e',
		description: 'Check preconditions',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'charge',
		name: 'charge_card',
		code: 'gateway.charge(order.total)',
		color: '#f59e0b',
		description: 'Process payment',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'notify',
		name: 'send_receipt',
		code: 'OrderMailer.receipt(order).deliver_later',
		color: '#ef4444',
		description: 'Send confirmation',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'log',
		name: 'log_success',
		code: 'Rails.logger.info("Order #{order.id} completed")',
		color: '#10b981',
		description: 'Audit logging',
		correctSection: 'private',
		currentSection: null,
	},
];

const SECTIONS = [
	{
		id: 'dependencies',
		name: 'Dependencies',
		description: 'What the service needs',
	},
	{
		id: 'initialize',
		name: 'Initialize',
		description: 'Setup with dependency injection',
	},
	{ id: 'call', name: 'Call Method', description: 'The main logic steps' },
	{ id: 'private', name: 'Private Helpers', description: 'Supporting methods' },
];

export function Level12ServiceObjects({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [components, setComponents] =
		useState<ServiceComponent[]>(SERVICE_COMPONENTS);
	const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
	const [dragOverSection, setDragOverSection] = useState<string | null>(null);

	const correctlyPlaced = components.filter(
		(c) => c.currentSection === c.correctSection,
	);

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const unplaced = components.filter((c) => !c.currentSection);
		if (unplaced.length > 0) {
			errors.push(`${unplaced.length} component(s) need to be placed`);
		}

		const wrongSection = components.filter(
			(c) => c.currentSection && c.currentSection !== c.correctSection,
		);
		if (wrongSection.length > 0) {
			errors.push(`${wrongSection.length} component(s) in wrong section`);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Service structure needs work!',
				details: errors,
			};
		}

		return { valid: true, message: 'Well-structured service object!' };
	};

	const handleDragStart = (componentId: string) =>
		setDraggedComponent(componentId);
	const handleDragEnd = () => {
		setDraggedComponent(null);
		setDragOverSection(null);
	};

	const handleDropOnSection = (sectionId: string) => {
		if (!draggedComponent) return;
		setComponents((prev) =>
			prev.map((c) =>
				c.id === draggedComponent ? { ...c, currentSection: sectionId } : c,
			),
		);
		setDraggedComponent(null);
		setDragOverSection(null);
	};

	const handleRemove = (componentId: string) => {
		setComponents((prev) =>
			prev.map((c) =>
				c.id === componentId ? { ...c, currentSection: null } : c,
			),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level12-service-objects', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getComponentsForSection = (sectionId: string) =>
		components.filter((c) => c.currentSection === sectionId);
	const paletteComponents = components.filter((c) => !c.currentSection);

	const generateServiceCode = () => {
		const deps = getComponentsForSection('dependencies')
			.map((c) => `  ${c.code}`)
			.join('\n');
		const init = getComponentsForSection('initialize')
			.map(
				(c) => `  ${c.code}\n    @order = order\n    @gateway = gateway\n  end`,
			)
			.join('\n');
		const callSteps = getComponentsForSection('call');
		const privates = getComponentsForSection('private');

		return `class CheckoutService
${deps || '  # Dependencies here'}

${init || '  def initialize(order)\n    # Setup here\n  end'}

  def call
${callSteps.map((c) => `    ${c.code}`).join('\n') || '    # Main logic here'}

    Result.success(order)
  end

  private

${privates.map((c) => `  def ${c.name}\n    ${c.code}\n  end`).join('\n\n') || '  # Helper methods here'}
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Service objects encapsulate business logic in a testable, reusable class."
					instructions={[
						'Service objects have a standard structure',
						'Dependencies: what the service needs (injected)',
						'Initialize: set up dependencies',
						'Call: the main entry point with steps',
						'Private: helper methods',
					]}
					scenario="Your checkout logic is scattered across controllers and models. Extract it into a dedicated service object with clear structure."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Components ({paletteComponents.length} remaining)
						</div>
						<div className="space-y-2">
							{paletteComponents.map((comp) => (
								<div
									className="p-2 rounded-lg cursor-grab active:cursor-grabbing border hover:opacity-80 transition-colors"
									draggable
									key={comp.id}
									onDragEnd={handleDragEnd}
									onDragStart={() => handleDragStart(comp.id)}
									style={{
										backgroundColor: `${comp.color}20`,
										borderColor: comp.color,
									}}
								>
									<div
										className="text-sm font-medium"
										style={{ color: comp.color }}
									>
										{comp.name}
									</div>
									<div className="text-xs text-muted-foreground">
										{comp.description}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correctly Placed</span>
							<span
								className={
									correctlyPlaced.length === components.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{correctlyPlaced.length} / {components.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${(correctlyPlaced.length / components.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Service Objects"
					levelNumber={12}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setComponents(SERVICE_COMPONENTS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-4">
						{SECTIONS.map((section) => {
							const sectionComponents = getComponentsForSection(section.id);

							return (
								<div
									className={`rounded-xl border-2 transition-all ${
										dragOverSection === section.id
											? 'border-primary bg-primary/10'
											: 'border-border bg-card'
									}`}
									key={section.id}
									onDragLeave={() => setDragOverSection(null)}
									onDragOver={(e) => {
										e.preventDefault();
										setDragOverSection(section.id);
									}}
									onDrop={() => handleDropOnSection(section.id)}
								>
									<div className="px-4 py-2 border-b border-border">
										<div className="font-semibold text-foreground">
											{section.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{section.description}
										</div>
									</div>
									<div className="p-4 min-h-[80px]">
										{sectionComponents.length > 0 ? (
											<div className="flex flex-wrap gap-2">
												{sectionComponents.map((comp) => {
													const isCorrect = comp.correctSection === section.id;
													return (
														<div
															className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
																isCorrect
																	? 'ring-2 ring-success'
																	: 'ring-2 ring-destructive'
															}`}
															key={comp.id}
															style={{
																backgroundColor: `${comp.color}30`,
																color: comp.color,
															}}
														>
															{comp.name}
															<Button
																className="text-foreground/50 hover:text-foreground p-0 h-auto"
																onClick={() => handleRemove(comp.id)}
																size="sm"
																variant="ghost"
															>
																×
															</Button>
														</div>
													);
												})}
											</div>
										) : (
											<div className="text-muted-foreground text-sm text-center py-4">
												Drop components here
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/services/checkout_service.rb',
							language: 'ruby',
							code: generateServiceCode(),
							highlight: [],
						},
					]}
					learningGoal="Service objects: initialize for setup, call for execution, private for helpers. Inject dependencies for testability."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Usage Pattern
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded">
							{`# In controller:
result = CheckoutService.new(
  order,
  gateway: Stripe
).call

if result.success?
  render json: result.data
else
  render json: result.errors
end`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level12ServiceObjects;

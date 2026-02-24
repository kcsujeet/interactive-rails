/**
 * Level 15: Service Objects
 *
 * Build a service object by placing components into correct sections.
 * Teaches: Service object pattern with initialize + call, Result pattern, Data.define
 */

import { Boxes, Check, Lock, Unlock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	resolveColor,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

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
		id: 'params_dep',
		name: '@params',
		code: 'attr_reader :params',
		color: '#3b82f6',
		description: 'Registration parameters',
		correctSection: 'dependencies',
		currentSection: null,
	},
	{
		id: 'init',
		name: 'initialize',
		code: 'def initialize(params)',
		color: '#06b6d4',
		description: 'Accept params via dependency injection',
		correctSection: 'initialize',
		currentSection: null,
	},
	{
		id: 'create_user',
		name: 'create_user',
		code: 'user = User.new(@params)',
		color: '#22c55e',
		description: 'Build and save user record',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'enqueue_email',
		name: 'enqueue_email',
		code: 'UserMailer.welcome(user).deliver_later',
		color: '#8b5cf6',
		description: 'Queue welcome email (non-blocking)',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'enqueue_stripe',
		name: 'enqueue_stripe',
		code: 'CreateStripeCustomerJob.perform_later(user.id)',
		color: '#f59e0b',
		description: 'Queue Stripe customer creation',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'build_result',
		name: 'build_result',
		code: 'Result.new(success?: true, user: user, errors: [])',
		color: '#10b981',
		description: 'Return a Result value object',
		correctSection: 'call',
		currentSection: null,
	},
	{
		id: 'validate_params',
		name: 'validate_params',
		code: 'raise ArgumentError if params.blank?',
		color: '#ef4444',
		description: 'Guard clause for input validation',
		correctSection: 'private',
		currentSection: null,
	},
];

const SECTIONS = [
	{
		id: 'dependencies',
		name: 'Dependencies',
		description: 'What the service needs (attr_reader)',
	},
	{
		id: 'initialize',
		name: 'Initialize',
		description: 'Setup with dependency injection',
	},
	{
		id: 'call',
		name: 'Call Method',
		description: 'The main entry point (one public method)',
	},
	{
		id: 'private',
		name: 'Private Helpers',
		description: 'Supporting methods',
	},
];

export function Level17ServiceObjects({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [components, setComponents] =
		useState<ServiceComponent[]>(SERVICE_COMPONENTS);
	const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
	const [dragOverSection, setDragOverSection] = useState<string | null>(null);
	const [showUnlockBanner, setShowUnlockBanner] = useState(false);
	const prevPhaseRef = useRef(1);

	const correctlyPlaced = components.filter(
		(c) => c.currentSection === c.correctSection,
	);

	// Phase gating: Phase 1 = Dependencies + Initialize, Phase 2 = Call + Private
	const phase1Complete =
		components.filter(
			(c) =>
				(c.correctSection === 'dependencies' ||
					c.correctSection === 'initialize') &&
				c.currentSection === c.correctSection,
		).length === 2;
	const currentPhase = phase1Complete ? 2 : 1;
	const isPhase2Section = (sectionId: string) =>
		sectionId === 'call' || sectionId === 'private';

	// Show unlock banner when transitioning from phase 1 to phase 2
	useEffect(() => {
		if (prevPhaseRef.current === 1 && currentPhase === 2) {
			setShowUnlockBanner(true);
			const timer = setTimeout(() => setShowUnlockBanner(false), 3000);
			return () => clearTimeout(timer);
		}
		prevPhaseRef.current = currentPhase;
	}, [currentPhase]);

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
		// Block drops onto locked phase 2 sections
		if (currentPhase === 1 && isPhase2Section(sectionId)) return;
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
		const success = await completeLevel('act3-level17-service-objects', {
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
		const init = getComponentsForSection('initialize');
		const callSteps = getComponentsForSection('call');
		const privates = getComponentsForSection('private');

		const initBlock =
			init.length > 0
				? `  ${init[0].code}\n    @params = params\n  end`
				: '  def initialize(params)\n    # Setup here\n  end';

		return `class UserRegistration < ApplicationService
  Result = Data.define(:success?, :user, :errors)

${deps || '  # Dependencies here'}

${initBlock}

  def call
${callSteps.map((c) => `    ${c.code}`).join('\n') || '    # Main logic here'}
  end

  private

${privates.map((c) => `  def ${c.name}\n    ${c.code}\n  end`).join('\n\n') || '  # Helper methods here'}
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							In Level 6, your controller actions handled everything
							directly: finding records, creating posts, rendering JSON. As
							logic grows, controllers get fat. Extract complex operations
							into Service Objects.
						</p>
					</div>
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Phase
						</div>
						<div className="space-y-2 mb-4">
							<div
								className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
									currentPhase === 1
										? 'bg-primary/10 text-primary font-medium'
										: 'bg-success/10 text-success'
								}`}
							>
								{currentPhase >= 2 ? (
									<Check className="w-4 h-4 shrink-0" />
								) : (
									<span className="w-4 h-4 shrink-0 rounded-full border-2 border-primary" />
								)}
								Phase 1: Structure
							</div>
							<div
								className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
									currentPhase === 2
										? 'bg-primary/10 text-primary font-medium'
										: 'bg-muted text-muted-foreground'
								}`}
							>
								{currentPhase < 2 ? (
									<Lock className="w-4 h-4 shrink-0" />
								) : (
									<span className="w-4 h-4 shrink-0 rounded-full border-2 border-primary" />
								)}
								Phase 2: Business Logic
							</div>
						</div>
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correctly placed</span>
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
					actNumber={3}
					levelName="Service Objects"
					levelNumber={17}
					onComplete={handleComplete}
					onReset={() => setComponents(SERVICE_COMPONENTS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-4">
						{/* Components Palette */}
						<div className="p-4 bg-card rounded-xl border border-border">
							<div className="flex items-center gap-2 mb-3">
								<Boxes className="w-4 h-4 text-primary" />
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Components ({paletteComponents.length} remaining)
								</div>
							</div>
							{paletteComponents.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{paletteComponents.map((comp) => (
										<OptionCard
											color={resolveColor(comp.color)}
											description={comp.description}
											draggable
											key={comp.id}
											name={comp.name}
											onDragEnd={handleDragEnd}
											onDragStart={() => handleDragStart(comp.id)}
										/>
									))}
								</div>
							) : (
								<div className="text-success text-sm text-center py-2">
									All components placed!
								</div>
							)}
						</div>

						{/* Unlock banner */}
						{showUnlockBanner && (
							<div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-300">
								<Unlock className="w-4 h-4 shrink-0" />
								Structure defined! Now add the business logic.
							</div>
						)}

						{SECTIONS.map((section) => {
							const sectionComponents = getComponentsForSection(section.id);
							const locked =
								currentPhase === 1 && isPhase2Section(section.id);

							return (
								<div
									className={`rounded-xl border-2 transition-all ${
										locked
											? 'border-border bg-muted/40 opacity-50 cursor-not-allowed'
											: dragOverSection === section.id
												? 'border-primary bg-primary/10'
												: 'border-border bg-card'
									}`}
									key={section.id}
									onDragLeave={() => {
										if (!locked) setDragOverSection(null);
									}}
									onDragOver={(e) => {
										e.preventDefault();
										if (!locked) setDragOverSection(section.id);
									}}
									onDrop={() => {
										if (!locked) handleDropOnSection(section.id);
									}}
								>
									<div className="px-4 py-2 border-b border-border">
										<div className="flex items-center gap-2 font-semibold text-foreground">
											{locked && (
												<Lock className="w-4 h-4 text-muted-foreground" />
											)}
											{section.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{locked
												? 'Complete Dependencies & Initialize first'
												: section.description}
										</div>
									</div>
									<div className="p-4 min-h-[80px]">
										{locked ? (
											<div className="text-muted-foreground text-sm text-center py-4 flex items-center justify-center gap-2">
												<Lock className="w-3.5 h-3.5" />
												Locked
											</div>
										) : sectionComponents.length > 0 ? (
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
															{isCorrect && <Check className="w-3 h-3" />}
															{comp.name}
															<Button
																className="text-foreground/50 hover:text-foreground h-auto p-0"
																onClick={() => handleRemove(comp.id)}
																size="icon-xs"
																variant="ghost"
															>
																<X className="w-3 h-3" />
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
							filename: 'app/services/user_registration.rb',
							language: 'ruby',
							code: generateServiceCode(),
							highlight: [],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Usage Pattern
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# In controller:
result = UserRegistration.call(
  params.expect(user: [:email, :password, :name])
)

if result.success?
  render json: UserSerializer.new(result.user),
         status: :created
else
  render json: { errors: result.errors },
         status: :unprocessable_entity
end`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17ServiceObjects;

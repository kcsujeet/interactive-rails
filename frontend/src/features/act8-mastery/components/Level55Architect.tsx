/**
 * Level 50: The Architect (Capstone)
 *
 * Full architecture canvas. Apply every concept from the game.
 * Extract billing from a monolith using state machines, domain events,
 * API gateway, multi-database, observability, tenant isolation,
 * background jobs, and circuit breakers.
 */

import type { LucideIcon } from 'lucide-react';
import {
	Activity,
	ArrowRight,
	Award,
	Building2,
	Check,
	ChevronRight,
	Database,
	Eye,
	GitBranch,
	Radio,
	Server,
	ShieldCheck,
	Zap,
} from 'lucide-react';
import { useCallback, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchComponent {
	id: string;
	name: string;
	description: string;
	Icon: LucideIcon;
	enabled: boolean;
	required: boolean;
	color: string;
}

interface SimulationStep {
	label: string;
	component: string;
	status: 'pending' | 'active' | 'done';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_IDS = [
	'state-machine',
	'domain-events',
	'api-gateway',
	'observability',
];

const INITIAL_COMPONENTS: ArchComponent[] = [
	{
		id: 'api-gateway',
		name: 'API Gateway',
		description: 'Routes billing requests, auth at edge',
		Icon: Server,
		enabled: false,
		required: true,
		color: 'text-purple-400',
	},
	{
		id: 'state-machine',
		name: 'State Machine',
		description: 'Payment status: pending → processing → completed/failed',
		Icon: GitBranch,
		enabled: false,
		required: true,
		color: 'text-blue-400',
	},
	{
		id: 'domain-events',
		name: 'Domain Events',
		description: 'payment.succeeded publishes events, subscribers react',
		Icon: Zap,
		enabled: false,
		required: true,
		color: 'text-yellow-400',
	},
	{
		id: 'multi-database',
		name: 'Multi-Database',
		description: 'Billing gets own DB, read replicas for reporting',
		Icon: Database,
		enabled: false,
		required: false,
		color: 'text-green-400',
	},
	{
		id: 'observability',
		name: 'Observability',
		description: 'Structured logging, distributed tracing, health checks',
		Icon: Eye,
		enabled: false,
		required: true,
		color: 'text-cyan-400',
	},
	{
		id: 'tenant-isolation',
		name: 'Tenant Isolation',
		description: 'Billing data scoped per company',
		Icon: ShieldCheck,
		enabled: false,
		required: false,
		color: 'text-orange-400',
	},
	{
		id: 'background-jobs',
		name: 'Background Jobs',
		description: 'Async event processing',
		Icon: Radio,
		enabled: false,
		required: false,
		color: 'text-pink-400',
	},
	{
		id: 'circuit-breaker',
		name: 'Circuit Breaker',
		description: 'Protect against gateway/billing service failures',
		Icon: Activity,
		enabled: false,
		required: false,
		color: 'text-red-400',
	},
];

function buildSimulationSteps(enabled: string[]): SimulationStep[] {
	const steps: SimulationStep[] = [];

	if (enabled.includes('api-gateway')) {
		steps.push({
			label: 'API Gateway authenticates request',
			component: 'api-gateway',
			status: 'pending',
		});
	}
	if (enabled.includes('circuit-breaker')) {
		steps.push({
			label: 'Circuit breaker checks service health',
			component: 'circuit-breaker',
			status: 'pending',
		});
	}
	if (enabled.includes('tenant-isolation')) {
		steps.push({
			label: 'Tenant scope applied (company_id)',
			component: 'tenant-isolation',
			status: 'pending',
		});
	}
	if (enabled.includes('state-machine')) {
		steps.push({
			label: 'Payment transitions pending → processing → completed',
			component: 'state-machine',
			status: 'pending',
		});
	}
	if (enabled.includes('multi-database')) {
		steps.push({
			label: 'Write to billing DB, replicate for reporting',
			component: 'multi-database',
			status: 'pending',
		});
	}
	if (enabled.includes('domain-events')) {
		steps.push({
			label: 'Publish payment.completed event to bus',
			component: 'domain-events',
			status: 'pending',
		});
	}
	if (enabled.includes('background-jobs')) {
		steps.push({
			label: 'Enqueue NotificationJob, InventoryJob, AnalyticsJob',
			component: 'background-jobs',
			status: 'pending',
		});
	}
	if (enabled.includes('observability')) {
		steps.push({
			label: 'Log structured trace, emit metrics',
			component: 'observability',
			status: 'pending',
		});
	}

	return steps;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level55Architect({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [components, setComponents] =
		useState<ArchComponent[]>(INITIAL_COMPONENTS);
	const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([]);
	const [isSimulating, setIsSimulating] = useState(false);

	const enabledComponents = components.filter((c) => c.enabled);
	const enabledIds = enabledComponents.map((c) => c.id);
	const enabledCount = enabledComponents.length;

	const toggleComponent = (componentId: string) => {
		if (isSimulating) return;
		setComponents((prev) =>
			prev.map((c) =>
				c.id === componentId ? { ...c, enabled: !c.enabled } : c,
			),
		);
		// Clear previous simulation when architecture changes
		setSimulationSteps([]);
	};

	const simulateRequest = useCallback(() => {
		if (isSimulating || enabledCount === 0) return;

		const steps = buildSimulationSteps(enabledIds);
		if (steps.length === 0) return;

		setSimulationSteps(steps);
		setIsSimulating(true);

		// Animate steps one at a time
		steps.forEach((_, index) => {
			// Set step to active
			setTimeout(() => {
				setSimulationSteps((prev) =>
					prev.map((s, i) => (i === index ? { ...s, status: 'active' } : s)),
				);
			}, index * 600);

			// Set step to done
			setTimeout(
				() => {
					setSimulationSteps((prev) =>
						prev.map((s, i) => (i === index ? { ...s, status: 'done' } : s)),
					);

					// Finish simulation after the last step
					if (index === steps.length - 1) {
						setTimeout(() => setIsSimulating(false), 400);
					}
				},
				index * 600 + 400,
			);
		});
	}, [isSimulating, enabledCount, enabledIds]);

	const validateSolution = (): ValidationResult => {
		const missingRequired = REQUIRED_IDS.filter(
			(id) => !enabledIds.includes(id),
		);
		if (missingRequired.length > 0) {
			const names = missingRequired.map(
				(id) => components.find((c) => c.id === id)?.name ?? id,
			);
			return {
				valid: false,
				message: 'Missing required architecture components',
				details: names.map((n) => `${n} must be enabled`),
			};
		}
		if (enabledCount < 6) {
			return {
				valid: false,
				message: `Enable at least 6 components (${enabledCount}/6)`,
				details: ['A complete extracted service needs most of these patterns'],
			};
		}
		return {
			valid: true,
			message: 'Architecture complete! You are The Architect.',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act8-level55-architect', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Determine which code file to show based on enabled components
	const codeFiles = buildCodeFiles(enabledIds);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Extract billing from a monolith into a fully-architected service using every concept you've learned."
					instructions={[
						'Enable architecture components to build the billing service',
						'All 4 required components must be present',
						'Enable at least 6 of 8 total components',
						'Simulate a billing request to see the full flow',
					]}
					scenario="The billing code is coupled to everything in the monolith. Apply state machines, domain events, API gateway, multi-database, observability, tenant isolation, background jobs, and circuit breakers to extract it into a clean, independent service."
				>
					{/* Component palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Architecture Components
						</div>
						<div className="space-y-2">
							{components.map((comp) => (
								<Button
									className={`w-full text-left rounded-lg border p-3 transition-all h-auto whitespace-normal justify-start ${
										comp.enabled
											? 'border-success bg-success/10'
											: 'border-border bg-card hover:border-muted-foreground/50'
									} ${isSimulating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
									key={comp.id}
									onClick={() => toggleComponent(comp.id)}
						variant="ghost"
								>
									<div className="flex items-center gap-2">
										<comp.Icon
											className={`w-4 h-4 shrink-0 ${comp.enabled ? 'text-success' : comp.color}`}
										/>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<span
													className={`text-sm font-medium ${comp.enabled ? 'text-success' : 'text-foreground'}`}
												>
													{comp.name}
												</span>
												{comp.required && (
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
														required
													</span>
												)}
											</div>
											<div className="text-xs text-muted-foreground truncate">
												{comp.description}
											</div>
										</div>
										{comp.enabled && (
											<Check className="w-4 h-4 text-success shrink-0" />
										)}
									</div>
								</Button>
							))}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">
								Components configured
							</span>
							<span
								className={
									enabledCount >= 6
										? 'text-success font-semibold'
										: 'text-foreground'
								}
							>
								{enabledCount} / 8
							</span>
						</div>
						<div className="bg-secondary rounded-full h-2 overflow-hidden">
							<div
								className={`h-full transition-all duration-300 ${enabledCount >= 6 ? 'bg-success' : 'bg-primary'}`}
								style={{ width: `${(enabledCount / 8) * 100}%` }}
							/>
						</div>
						<div className="flex justify-between mt-2">
							<span className="text-xs text-muted-foreground">
								{REQUIRED_IDS.filter((id) => enabledIds.includes(id)).length}/4
								required
							</span>
							<span className="text-xs text-muted-foreground">
								{enabledCount >= 6
									? 'Ready'
									: `${6 - enabledCount} more needed`}
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={8}
					levelName="The Architect"
					levelNumber={55}
					onComplete={handleComplete}
					onReset={() => {
						setComponents(INITIAL_COMPONENTS);
						setSimulationSteps([]);
						setIsSimulating(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-5xl mx-auto space-y-6">
						{/* Architecture Diagram */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Building2 className="w-4 h-4 text-primary" />
									<span className="text-foreground font-semibold">
										Billing Service Architecture
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Award
										className={`w-4 h-4 ${enabledCount >= 6 ? 'text-yellow-400' : 'text-muted-foreground'}`}
									/>
									<span
										className={`text-xs ${enabledCount >= 6 ? 'text-yellow-400' : 'text-muted-foreground'}`}
									>
										{enabledCount >= 8
											? 'Perfect Architecture'
											: enabledCount >= 6
												? 'Solid Architecture'
												: 'In Progress'}
									</span>
								</div>
							</div>

							<div className="p-6">
								{enabledCount === 0 ? (
									<div className="text-center py-12 text-muted-foreground">
										<Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
										<p className="text-sm">
											Enable components from the left panel to build the
											architecture
										</p>
									</div>
								) : (
									<div className="space-y-4">
										{/* Top row: Gateway → Billing Service → DB */}
										<div className="flex items-center justify-center gap-3 flex-wrap">
											{/* API Gateway */}
											{enabledIds.includes('api-gateway') && (
												<ArchNode
													color="bg-purple-600"
													Icon={Server}
													label="API Gateway"
													sublabel="Auth + Routing"
												/>
											)}

											{enabledIds.includes('api-gateway') && (
												<ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
											)}

											{/* Circuit Breaker */}
											{enabledIds.includes('circuit-breaker') && (
												<>
													<ArchNode
														color="bg-red-600"
														Icon={Activity}
														label="Circuit Breaker"
														sublabel="Failure protection"
													/>
													<ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
												</>
											)}

											{/* Billing Service (always shown when at least 1 component is enabled) */}
											<div className="bg-blue-600 rounded-xl p-4 text-center min-w-[160px]">
												<Building2 className="w-6 h-6 text-white mx-auto mb-1" />
												<div className="text-sm font-semibold text-white">
													Billing Service
												</div>
												<div className="flex flex-wrap justify-center gap-1 mt-2">
													{enabledIds.includes('state-machine') && (
														<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/30 text-blue-200">
															<GitBranch className="w-3 h-3 inline mr-0.5" />
															AASM
														</span>
													)}
													{enabledIds.includes('tenant-isolation') && (
														<span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-400/30 text-orange-200">
															<ShieldCheck className="w-3 h-3 inline mr-0.5" />
															Tenancy
														</span>
													)}
													{enabledIds.includes('observability') && (
														<span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/30 text-cyan-200">
															<Eye className="w-3 h-3 inline mr-0.5" />
															Traced
														</span>
													)}
												</div>
											</div>

											<ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />

											{/* Database(s) */}
											{enabledIds.includes('multi-database') ? (
												<div className="flex flex-col gap-2">
													<ArchNode
														color="bg-green-600"
														Icon={Database}
														label="Primary DB"
														sublabel="Writes"
													/>
													<ArchNode
														color="bg-green-800"
														Icon={Database}
														label="Replica DB"
														sublabel="Reads / Reporting"
													/>
												</div>
											) : (
												<ArchNode
													color="bg-green-600"
													Icon={Database}
													label="Database"
													sublabel="Billing data"
												/>
											)}
										</div>

										{/* Bottom row: Event Bus + Background Jobs */}
										{(enabledIds.includes('domain-events') ||
											enabledIds.includes('background-jobs')) && (
											<div className="flex items-center justify-center gap-3 pt-2 border-t border-border/50 flex-wrap">
												<div className="text-xs text-muted-foreground mr-2">
													Side effects:
												</div>

												{enabledIds.includes('domain-events') && (
													<ArchNode
														color="bg-yellow-600"
														Icon={Zap}
														label="Event Bus"
														sublabel="payment.completed"
													/>
												)}

												{enabledIds.includes('domain-events') &&
													enabledIds.includes('background-jobs') && (
														<ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
													)}

												{enabledIds.includes('background-jobs') && (
													<div className="flex gap-2">
														<ArchNode
															color="bg-pink-600"
															Icon={Radio}
															label="NotificationJob"
															sublabel=""
														/>
														<ArchNode
															color="bg-pink-600"
															Icon={Radio}
															label="InventoryJob"
															sublabel=""
														/>
														<ArchNode
															color="bg-pink-600"
															Icon={Radio}
															label="AnalyticsJob"
															sublabel=""
														/>
													</div>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Request Simulation */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Zap className="w-4 h-4 text-warning" />
									<span className="text-foreground font-semibold">
										Simulate Billing Request
									</span>
								</div>
								<Button
									className="text-sm"
									disabled={isSimulating || enabledCount === 0}
									onClick={simulateRequest}
									size="sm"
									variant="outline"
								>
									{isSimulating ? 'Simulating...' : 'Simulate Request'}
								</Button>
							</div>

							<div className="p-4">
								{simulationSteps.length === 0 ? (
									<div className="text-center py-6 text-muted-foreground text-sm">
										{enabledCount === 0
											? 'Enable components first, then simulate a billing request'
											: 'Click "Simulate Request" to see a billing request flow through the architecture'}
									</div>
								) : (
									<div className="space-y-2">
										{simulationSteps.map((step, index) => {
											const comp = components.find(
												(c) => c.id === step.component,
											);
											const StepIcon = comp?.Icon ?? ChevronRight;
											return (
												<div
													className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 ${
														step.status === 'active'
															? 'bg-primary/20 border border-primary/40'
															: step.status === 'done'
																? 'bg-success/10 border border-success/30'
																: 'bg-secondary/50 border border-transparent'
													}`}
													key={step.component}
												>
													<StepIcon
														className={`w-4 h-4 shrink-0 ${
															step.status === 'done'
																? 'text-success'
																: step.status === 'active'
																	? 'text-primary'
																	: 'text-muted-foreground'
														}`}
													/>
													<span
														className={`text-sm flex-1 ${
															step.status === 'done'
																? 'text-success'
																: step.status === 'active'
																	? 'text-primary font-medium'
																	: 'text-muted-foreground'
														}`}
													>
														{step.label}
													</span>
													<span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
														{step.status === 'done' ? (
															<Check className="w-4 h-4 text-success inline" />
														) : step.status === 'active' ? (
															<span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
														) : (
															<span className="text-muted-foreground">
																{index + 1}
															</span>
														)}
													</span>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={codeFiles}
					learningGoal="The Architect extracts a billing service from a monolith by applying state machines, domain events, API gateway, multi-database, observability, tenant isolation, background jobs, and circuit breakers."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Extraction Checklist
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							{components.map((comp) => (
								<li className="flex items-center gap-2" key={comp.id}>
									{comp.enabled ? (
										<Check className="w-3 h-3 text-success shrink-0" />
									) : (
										<span className="w-3 h-3 rounded-full border border-muted-foreground/40 shrink-0 inline-block" />
									)}
									<span className={comp.enabled ? 'text-foreground' : ''}>
										{comp.name}
									</span>
									{comp.required && !comp.enabled && (
										<span className="text-[10px] text-primary">required</span>
									)}
								</li>
							))}
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Patterns Applied
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>* AASM state machine for payment lifecycle</li>
							<li>* acts_as_tenant for data isolation</li>
							<li>* EventBus for loose coupling</li>
							<li>* ActiveJob for async processing</li>
							<li>* Multi-database for scale</li>
							<li>* Structured logging + tracing</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ArchNode({
	Icon,
	label,
	sublabel,
	color,
}: {
	Icon: LucideIcon;
	label: string;
	sublabel: string;
	color: string;
}) {
	return (
		<div className={`${color} rounded-lg px-4 py-3 text-center min-w-[110px]`}>
			<Icon className="w-5 h-5 text-white mx-auto mb-1" />
			<div className="text-xs font-semibold text-white">{label}</div>
			{sublabel && <div className="text-[10px] text-white/70">{sublabel}</div>}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Code file builder
// ---------------------------------------------------------------------------

function buildCodeFiles(enabledIds: string[]) {
	const paymentModelLines: string[] = [
		'# billing-service/app/models/payment.rb',
		'class Payment < ApplicationRecord',
	];

	if (enabledIds.includes('state-machine')) {
		paymentModelLines.push('  include AASM');
	}

	if (enabledIds.includes('tenant-isolation')) {
		paymentModelLines.push('  acts_as_tenant :company');
	}

	paymentModelLines.push('');

	if (enabledIds.includes('state-machine')) {
		paymentModelLines.push(
			'  aasm column: :status do',
			'    state :pending, initial: true',
			'    state :processing, :completed, :failed, :refunded',
			'',
			'    event :process do',
			'      transitions from: :pending, to: :processing',
			'    end',
			'',
			'    event :complete do',
			'      transitions from: :processing, to: :completed,',
			'                  after: :publish_success_event',
			'    end',
			'',
			'    event :fail do',
			'      transitions from: :processing, to: :failed',
			'    end',
			'  end',
		);
	}

	if (enabledIds.includes('domain-events')) {
		paymentModelLines.push(
			'',
			'  private',
			'',
			'  def publish_success_event',
			"    EventBus.publish('payment.completed', {",
			'      payment_id: id, tenant_id: company_id',
			'    })',
			'  end',
		);
	}

	paymentModelLines.push('end');

	const files = [
		{
			filename: 'billing-service/app/models/payment.rb',
			language: 'ruby',
			code: paymentModelLines.join('\n'),
			highlight: enabledIds.includes('state-machine')
				? [3, 7, 8, 9, 14, 15]
				: [],
		},
	];

	if (
		enabledIds.includes('domain-events') ||
		enabledIds.includes('background-jobs')
	) {
		const eventLines: string[] = [
			'# Event-driven side effects',
			"EventBus.subscribe('payment.completed') do |payload|",
		];

		if (enabledIds.includes('background-jobs')) {
			eventLines.push(
				'  NotificationJob.perform_later(payload)',
				'  InventoryJob.perform_later(payload)',
				'  AnalyticsJob.perform_later(payload)',
			);
		} else {
			eventLines.push(
				'  Notification.send_receipt(payload)',
				'  Inventory.adjust(payload)',
				'  Analytics.track(payload)',
			);
		}

		eventLines.push('end');

		files.push({
			filename: 'billing-service/config/initializers/events.rb',
			language: 'ruby',
			code: eventLines.join('\n'),
			highlight: enabledIds.includes('background-jobs') ? [3, 4, 5] : [],
		});
	}

	if (enabledIds.includes('multi-database')) {
		files.push({
			filename: 'billing-service/config/database.yml',
			language: 'ruby',
			code: `# Multi-database configuration
production:
  primary:
    database: billing_production
    adapter: postgresql
  primary_replica:
    database: billing_production
    adapter: postgresql
    replica: true
  # Reporting reads from replica
  # Writes go to primary`,
			highlight: [3, 4, 7, 8, 9],
		});
	}

	if (enabledIds.includes('observability')) {
		files.push({
			filename: 'billing-service/app/middleware/tracing.rb',
			language: 'ruby',
			code: `class TracingMiddleware
  def call(env)
    trace_id = env['HTTP_X_TRACE_ID'] || SecureRandom.uuid
    Rails.logger.tagged(trace_id: trace_id) do
      status, headers, body = @app.call(env)
      headers['X-Trace-ID'] = trace_id
      [status, headers, body]
    end
  end
end

# Health check endpoint
# GET /health => { status: "ok", db: "connected" }`,
			highlight: [3, 4, 6],
		});
	}

	if (enabledIds.includes('circuit-breaker')) {
		files.push({
			filename: 'billing-service/app/services/circuit_breaker.rb',
			language: 'ruby',
			code: `class CircuitBreaker
  THRESHOLD = 5
  TIMEOUT = 30.seconds

  def call(service, &block)
    if open?(service)
      raise ServiceUnavailableError
    end
    begin
      result = block.call
      reset!(service)
      result
    rescue => e
      record_failure(service)
      raise
    end
  end
end`,
			highlight: [2, 3, 6, 7, 10],
		});
	}

	// If nothing is enabled, show the monolith code to motivate extraction
	if (files.length === 1 && enabledIds.length === 0) {
		return [
			{
				filename: 'app/models/payment.rb (monolith)',
				language: 'ruby',
				code: `# Everything coupled in the monolith
class Payment < ApplicationRecord
  belongs_to :user
  belongs_to :order
  belongs_to :company

  after_save :send_notification
  after_save :update_inventory
  after_save :track_analytics
  after_save :sync_reporting

  # Tightly coupled to everything...
  # Time to extract into a clean service!
end`,
				highlight: [7, 8, 9, 10],
			},
		];
	}

	return files;
}

export default Level55Architect;

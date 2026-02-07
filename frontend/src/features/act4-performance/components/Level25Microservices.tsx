/**
 * Level 25: Microservices
 *
 * Extract services from monolith using the Scalpel tool.
 * Shows bounded context extraction pattern.
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

interface Domain {
	id: string;
	name: string;
	color: string;
	extracted: boolean;
	dependencies: string[];
}

export function Level25Microservices({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [scalpelActive, setScalpelActive] = useState(false);
	const [domains, setDomains] = useState<Domain[]>([
		{
			id: 'identity',
			name: 'Identity',
			color: '#8b5cf6',
			extracted: false,
			dependencies: [],
		},
		{
			id: 'billing',
			name: 'Billing',
			color: '#22c55e',
			extracted: false,
			dependencies: ['identity'],
		},
		{
			id: 'inventory',
			name: 'Inventory',
			color: '#f59e0b',
			extracted: false,
			dependencies: [],
		},
		{
			id: 'orders',
			name: 'Orders',
			color: '#3b82f6',
			extracted: false,
			dependencies: ['identity', 'billing', 'inventory'],
		},
	]);
	const [gateway, setGateway] = useState(false);

	const extractedCount = domains.filter((d) => d.extracted).length;

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!scalpelActive) {
			errors.push('Activate the Scalpel tool first');
		}

		const unextractedDomains = domains.filter((d) => !d.extracted);
		if (unextractedDomains.length > 0) {
			errors.push(
				`${unextractedDomains.length} domain(s) still in the monolith: ${unextractedDomains.map((d) => d.name).join(', ')}`,
			);
		}

		if (!gateway) {
			errors.push('Add an API Gateway to route requests to services');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Extraction incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Monolith successfully decomposed into microservices!',
		};
	};

	const extractDomain = (domainId: string) => {
		if (!scalpelActive) return;

		const domain = domains.find((d) => d.id === domainId);
		if (!domain || domain.extracted) return;

		// Check dependencies
		const unextractedDeps = domain.dependencies.filter((depId) => {
			const dep = domains.find((d) => d.id === depId);
			return dep && !dep.extracted;
		});

		if (unextractedDeps.length > 0) {
			alert(`Extract ${unextractedDeps.join(', ')} first!`);
			return;
		}

		setDomains((prev) =>
			prev.map((d) => (d.id === domainId ? { ...d, extracted: true } : d)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level25-microservices', {
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
					goal="Learn to extract microservices from a monolith using bounded contexts."
					instructions={[
						'Activate the Scalpel tool',
						'Extract domains in order (Identity first, then Billing)',
						'Add an API Gateway to route requests',
					]}
					scenario="The monolith has grown to 500k lines of code. Deploys take 45 minutes and one bug brings down everything. Time to extract bounded contexts into services."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								scalpelActive
									? 'bg-secondary text-secondary-foreground cursor-default'
									: ''
							}`}
							disabled={scalpelActive}
							onClick={() => setScalpelActive(true)}
						>
							{scalpelActive ? 'Scalpel Active' : 'Activate Scalpel Tool'}
						</Button>
					</div>

					{extractedCount >= 2 && !gateway && (
						<div className="p-4 border-t border-border">
							<Button className="w-full py-3" onClick={() => setGateway(true)}>
								Add API Gateway
							</Button>
						</div>
					)}

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Extraction Progress
						</div>
						<div className="bg-secondary rounded-full h-3 overflow-hidden">
							<div
								className="bg-primary h-full transition-all"
								style={{ width: `${(extractedCount / domains.length) * 100}%` }}
							/>
						</div>
						<div className="text-muted-foreground text-sm mt-2">
							{extractedCount} / {domains.length} domains extracted
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Domain Dependencies
						</div>
						<div className="space-y-2 text-sm">
							{domains.map((d) => (
								<div className="flex items-center justify-between" key={d.id}>
									<span
										className={d.extracted ? 'text-success' : 'text-foreground'}
									>
										{d.name}
									</span>
									<span className="text-muted-foreground text-xs">
										{d.dependencies.length > 0
											? `needs: ${d.dependencies.join(', ')}`
											: 'no deps'}
									</span>
								</div>
							))}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Microservices"
					levelNumber={25}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setScalpelActive(false);
						setDomains([
							{
								id: 'identity',
								name: 'Identity',
								color: '#8b5cf6',
								extracted: false,
								dependencies: [],
							},
							{
								id: 'billing',
								name: 'Billing',
								color: '#22c55e',
								extracted: false,
								dependencies: ['identity'],
							},
							{
								id: 'inventory',
								name: 'Inventory',
								color: '#f59e0b',
								extracted: false,
								dependencies: [],
							},
							{
								id: 'orders',
								name: 'Orders',
								color: '#3b82f6',
								extracted: false,
								dependencies: ['identity', 'billing', 'inventory'],
							},
						]);
						setGateway(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="flex gap-8 justify-center items-start">
						{/* Monolith */}
						<div
							className={`border-2 rounded-xl p-6 transition-all ${
								extractedCount === domains.length
									? 'border-border bg-card/30 opacity-50'
									: 'border-border bg-card'
							}`}
						>
							<div className="text-muted-foreground text-sm mb-4 text-center">
								Monolith
							</div>
							<div className="grid grid-cols-2 gap-3">
								{domains
									.filter((d) => !d.extracted)
									.map((domain) => (
										<Button
											className={`p-4 h-auto rounded-lg border-2 transition-all flex-col items-start ${
												scalpelActive
													? 'border-dashed hover:bg-primary/20 cursor-crosshair'
													: 'border-border cursor-not-allowed'
											}`}
											disabled={!scalpelActive}
											key={domain.id}
											onClick={() => extractDomain(domain.id)}
											style={{
												borderColor: scalpelActive ? domain.color : undefined,
											}}
											variant="ghost"
										>
											<div
												className="font-medium"
												style={{ color: domain.color }}
											>
												{domain.name}
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												Domain
											</div>
											{scalpelActive && (
												<div className="text-xs text-primary mt-2">
													Click to extract
												</div>
											)}
										</Button>
									))}
								{domains.filter((d) => !d.extracted).length === 0 && (
									<div className="col-span-2 text-muted-foreground text-center py-4">
										Monolith dismantled!
									</div>
								)}
							</div>
						</div>

						{/* Arrow / Gateway */}
						{extractedCount > 0 && (
							<div className="flex flex-col items-center gap-4">
								{gateway ? (
									<div className="bg-primary/20 border border-primary rounded-xl p-4 text-center">
										<div className="text-primary font-medium">API Gateway</div>
										<div className="text-primary/80 text-xs mt-1">
											Routes requests
										</div>
									</div>
								) : (
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
								)}
							</div>
						)}

						{/* Extracted Services */}
						{extractedCount > 0 && (
							<div className="space-y-4">
								<div className="text-muted-foreground text-sm text-center mb-2">
									Microservices
								</div>
								{domains
									.filter((d) => d.extracted)
									.map((domain) => (
										<div
											className="border-2 rounded-xl p-4 w-40 text-center animate-pulse-once"
											key={domain.id}
											style={{
												borderColor: domain.color,
												backgroundColor: `${domain.color}15`,
											}}
										>
											<div
												className="font-medium"
												style={{ color: domain.color }}
											>
												{domain.name}
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												Service
											</div>
											<div className="text-xs text-success mt-2">
												Independent
											</div>
										</div>
									))}
							</div>
						)}
					</div>

					{/* Benefits panel */}
					{extractedCount >= 2 && (
						<div className="mt-8 bg-card rounded-xl p-4 max-w-lg mx-auto">
							<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
								Benefits Achieved
							</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-success rounded-full" />
									<span className="text-foreground">Independent deploys</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-success rounded-full" />
									<span className="text-foreground">Fault isolation</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-success rounded-full" />
									<span className="text-foreground">Tech flexibility</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-success rounded-full" />
									<span className="text-foreground">Team autonomy</span>
								</div>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'architecture_decision.md',
							language: 'markdown',
							code: `# Monolith → Microservices

## Extraction Order
1. **Identity Service** (no deps)
   - User authentication
   - Session management
   - OAuth providers

2. **Billing Service** (needs Identity)
   - Subscriptions
   - Payment processing
   - Invoicing

3. **Inventory Service** (no deps)
   - Product catalog
   - Stock management

4. **Orders Service** (needs all)
   - Order processing
   - Checkout flow
   - Order history

## Communication
- Sync: REST/gRPC for queries
- Async: Events for state changes

## Data Ownership
Each service owns its data.
No shared databases!`,
							highlight: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 24, 25],
						},
					]}
					learningGoal="Extract microservices along bounded context boundaries. Start with domains that have fewer dependencies. Use an API Gateway to route client requests."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level25Microservices;

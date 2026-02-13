/**
 * Level 48: API Gateway
 *
 * Central entry point for microservices architecture.
 * Player learns routing, auth, rate limiting, and aggregation.
 */

import type { LucideIcon } from 'lucide-react';
import {
	ArrowRight,
	BarChart3,
	CreditCard,
	DoorOpen,
	Lock,
	Package,
	ShoppingCart,
	Shuffle,
	Smartphone,
	TrafficCone,
	User,
} from 'lucide-react';
import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface GatewayFeature {
	id: string;
	name: string;
	description: string;
	Icon: LucideIcon;
	enabled: boolean;
}

interface Service {
	id: string;
	name: string;
	path: string;
	Icon: LucideIcon;
	healthy: boolean;
	latency: number;
}

interface Request {
	id: number;
	path: string;
	status:
		| 'pending'
		| 'authenticated'
		| 'rate-limited'
		| 'routed'
		| 'aggregated'
		| 'completed'
		| 'blocked';
	stages: string[];
}

const INITIAL_FEATURES: GatewayFeature[] = [
	{
		id: 'auth',
		name: 'Authentication',
		description: 'Validate JWT tokens',
		Icon: Lock,
		enabled: false,
	},
	{
		id: 'rate-limit',
		name: 'Rate Limiting',
		description: 'Protect backend services',
		Icon: TrafficCone,
		enabled: false,
	},
	{
		id: 'routing',
		name: 'Request Routing',
		description: 'Route to correct service',
		Icon: Shuffle,
		enabled: false,
	},
	{
		id: 'aggregation',
		name: 'Response Aggregation',
		description: 'Combine multiple responses',
		Icon: Package,
		enabled: false,
	},
];

const SERVICES: Service[] = [
	{
		id: 'users',
		name: 'User Service',
		path: '/api/users',
		Icon: User,
		healthy: true,
		latency: 50,
	},
	{
		id: 'orders',
		name: 'Order Service',
		path: '/api/orders',
		Icon: ShoppingCart,
		healthy: true,
		latency: 80,
	},
	{
		id: 'products',
		name: 'Product Service',
		path: '/api/products',
		Icon: Package,
		healthy: true,
		latency: 40,
	},
	{
		id: 'payments',
		name: 'Payment Service',
		path: '/api/payments',
		Icon: CreditCard,
		healthy: true,
		latency: 100,
	},
];

export function Level48APIGateway({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [features, setFeatures] = useState<GatewayFeature[]>(INITIAL_FEATURES);
	const [services, setServices] = useState<Service[]>(SERVICES);
	const [requests, setRequests] = useState<Request[]>([]);

	const toggleFeature = (featureId: string) => {
		setFeatures((prev) =>
			prev.map((f) => (f.id === featureId ? { ...f, enabled: !f.enabled } : f)),
		);
	};

	const toggleServiceHealth = (serviceId: string) => {
		setServices((prev) =>
			prev.map((s) => (s.id === serviceId ? { ...s, healthy: !s.healthy } : s)),
		);
	};

	const simulateRequest = (path: string, isAggregation = false) => {
		const request: Request = {
			id: Date.now(),
			path,
			status: 'pending',
			stages: [],
		};

		setRequests((prev) => [...prev.slice(-9), request]);

		const authEnabled = features.find((f) => f.id === 'auth')?.enabled;
		const rateLimitEnabled = features.find(
			(f) => f.id === 'rate-limit',
		)?.enabled;
		const routingEnabled = features.find((f) => f.id === 'routing')?.enabled;
		const aggregationEnabled = features.find(
			(f) => f.id === 'aggregation',
		)?.enabled;

		const stages: string[] = [];
		let delay = 0;

		// Auth check
		if (authEnabled) {
			stages.push('Auth');
			delay += 200;
			setTimeout(() => {
				setRequests((prev) =>
					prev.map((r) =>
						r.id === request.id
							? { ...r, status: 'authenticated', stages: ['✓ Auth'] }
							: r,
					),
				);
			}, delay);
		}

		// Rate limit check
		if (rateLimitEnabled) {
			stages.push('Rate Limit');
			delay += 200;
			const blocked = Math.random() < 0.1; // 10% chance of rate limit
			setTimeout(() => {
				setRequests((prev) =>
					prev.map((r) =>
						r.id === request.id
							? {
									...r,
									status: blocked ? 'rate-limited' : r.status,
									stages: [
										...r.stages,
										blocked ? '✗ Rate Limited' : '✓ Rate OK',
									],
								}
							: r,
					),
				);
			}, delay);
		}

		// Routing
		if (routingEnabled && !isAggregation) {
			stages.push('Route');
			delay += 300;
			const service = services.find((s) => path.includes(s.id));
			setTimeout(() => {
				setRequests((prev) =>
					prev.map((r) =>
						r.id === request.id
							? {
									...r,
									status: 'routed',
									stages: [
										...r.stages,
										`✓ Route → ${service?.name || 'Service'}`,
									],
								}
							: r,
					),
				);
			}, delay);
		}

		// Aggregation
		if (aggregationEnabled && isAggregation) {
			stages.push('Aggregate');
			delay += 500;
			setTimeout(() => {
				setRequests((prev) =>
					prev.map((r) =>
						r.id === request.id
							? {
									...r,
									status: 'aggregated',
									stages: [
										...r.stages,
										'✓ Aggregate: Users + Orders + Products',
									],
								}
							: r,
					),
				);
			}, delay);
		}

		// Complete
		delay += 200;
		setTimeout(() => {
			setRequests((prev) =>
				prev.map((r) =>
					r.id === request.id && r.status !== 'rate-limited'
						? { ...r, status: 'completed', stages: [...r.stages, '✓ Response'] }
						: r,
				),
			);
		}, delay);
	};

	const validateSolution = (): ValidationResult => {
		const enabledCount = features.filter((f) => f.enabled).length;
		if (enabledCount < 3) {
			return {
				valid: false,
				message: 'Enable more gateway features!',
				details: ['At least 3 features needed for a proper API gateway'],
			};
		}
		if (requests.length < 3) {
			return {
				valid: false,
				message: 'Process more requests!',
				details: ['Simulate some API traffic through the gateway'],
			};
		}
		return { valid: true, message: 'API Gateway configured!' };
	};

	const handleComplete = async () => {
		const success = await completeLevel('act8-level48-api-gateway', {
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
					goal="Build a central API gateway that handles cross-cutting concerns for all microservices."
					instructions={[
						'Auth: Single point for token validation',
						'Rate Limit: Protect all services uniformly',
						'Routing: Direct traffic to correct service',
						'Aggregation: Combine responses for clients',
					]}
					scenario="Your microservices are exposed directly to the internet. Each one has its own auth, rate limiting, and routing. Time to centralize with an API Gateway!"
				>
					{/* Feature Toggles */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Gateway Features
						</div>
						<div className="space-y-2">
							{features.map((feature) => (
								<OptionCard
									color="primary"
									description={feature.description}
									icon={feature.Icon}
									key={feature.id}
									name={feature.name}
									onClick={() => toggleFeature(feature.id)}
									selected={feature.enabled}
									size="lg"
								/>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Features enabled</span>
							<span
								className={
									features.filter((f) => f.enabled).length >= 3
										? 'text-success'
										: 'text-foreground'
								}
							>
								{features.filter((f) => f.enabled).length} / {features.length}
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={8}
					levelName="API Gateway"
					levelNumber={48}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setFeatures(INITIAL_FEATURES);
						setServices(SERVICES);
						setRequests([]);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-5xl mx-auto">
						{/* Architecture Visualization */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Architecture
								</div>
							</div>
							<div className="p-8">
								<div className="flex items-center justify-between">
									{/* Clients */}
									<div className="text-center">
										<div className="w-20 h-20 bg-blue-600 rounded-lg flex flex-col items-center justify-center mb-2">
											<Smartphone className="w-6 h-6 text-white" />
											<span className="text-xs text-foreground">Clients</span>
										</div>
									</div>

									<ArrowRight className="w-6 h-6 text-muted-foreground" />

									{/* API Gateway */}
									<div className="text-center">
										<div className="w-48 p-4 bg-purple-600 rounded-xl">
											<DoorOpen className="w-7 h-7 text-white mb-2" />
											<div className="text-foreground font-semibold">
												API Gateway
											</div>
											<div className="flex flex-wrap justify-center gap-1 mt-2">
												{features.map((f) => (
													<span
														className={`text-xs px-2 py-1 rounded ${
															f.enabled
																? 'bg-success/30 text-success'
																: 'bg-secondary/50 text-muted-foreground'
														}`}
														key={f.id}
													>
														<f.Icon className="w-3 h-3" />
													</span>
												))}
											</div>
										</div>
									</div>

									<ArrowRight className="w-6 h-6 text-muted-foreground" />

									{/* Services */}
									<div className="grid grid-cols-2 gap-3">
										{services.map((service) => (
											<Button
												className={`p-3 h-auto rounded-lg border transition-all flex-col ${
													service.healthy
														? 'border-success bg-success/20'
														: 'border-destructive bg-destructive/20 opacity-60'
												}`}
												key={service.id}
												onClick={() => toggleServiceHealth(service.id)}
												variant={service.healthy ? 'default' : 'outline'}
											>
												<service.Icon className="w-5 h-5" />
												<div
													className={`text-xs ${service.healthy ? 'text-success' : 'text-destructive'}`}
												>
													{service.name}
												</div>
											</Button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Request Simulation */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Simulate Requests
								</div>
							</div>
							<div className="p-4 grid grid-cols-5 gap-3">
								{services.map((service) => (
									<Button
										className="p-3 h-auto rounded-lg bg-primary/30 border border-primary hover:bg-primary/50 transition-all flex-col"
										key={service.id}
										onClick={() => simulateRequest(service.path)}
										variant="default"
									>
										<service.Icon className="w-5 h-5" />
										<div className="text-xs text-primary font-mono">
											{service.path}
										</div>
									</Button>
								))}
								<Button
									className="p-3 h-auto rounded-lg bg-purple-900/30 border border-purple-600 hover:bg-purple-900/50 transition-all flex-col"
									onClick={() => simulateRequest('/api/dashboard', true)}
									variant="default"
								>
									<BarChart3 className="w-5 h-5" />
									<div className="text-xs text-purple-400 font-mono">
										/api/dashboard
									</div>
									<div className="text-[10px] text-muted-foreground">
										Aggregated
									</div>
								</Button>
							</div>
						</div>

						{/* Request Log */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Request Pipeline
								</div>
							</div>
							<div className="p-4 space-y-3 max-h-48 overflow-y-auto">
								{requests.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Click an endpoint above to simulate a request
									</div>
								) : (
									requests.map((req) => (
										<div className="p-3 bg-secondary rounded-lg" key={req.id}>
											<div className="flex items-center justify-between mb-2">
												<span className="font-mono text-primary">
													{req.path}
												</span>
												<span
													className={`text-xs px-2 py-1 rounded ${
														req.status === 'completed'
															? 'bg-success/40 text-success'
															: req.status === 'rate-limited'
																? 'bg-destructive/40 text-destructive'
																: 'bg-warning/40 text-warning'
													}`}
												>
													{req.status}
												</span>
											</div>
											<div className="flex gap-2 flex-wrap">
												{req.stages.map((stage) => (
													<span
														className="text-xs text-muted-foreground bg-card px-2 py-1 rounded"
														key={stage}
													>
														{stage}
													</span>
												))}
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
							filename: 'nginx/api_gateway.conf',
							language: 'nginx',
							code: `upstream users_service {
  server users:3000;
}

upstream orders_service {
  server orders:3001;
}

server {
  listen 80;

  # Auth check
  location /api/ {
    auth_request /auth/validate;

    # Rate limiting
    limit_req zone=api burst=10;
  }

  # Route to services
  location /api/users {
    proxy_pass http://users_service;
  }

  location /api/orders {
    proxy_pass http://orders_service;
  }
}`,
							highlight: features.find((f) => f.id === 'auth')?.enabled
								? [14]
								: features.find((f) => f.id === 'rate-limit')?.enabled
									? [17]
									: [],
						},
					]}
					learningGoal="API Gateway is the front door to your microservices. It handles auth, rate limiting, routing, and protocol translation."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Gateway Benefits
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Single entry point</li>
							<li>• Centralized security</li>
							<li>• Protocol translation</li>
							<li>• Request aggregation</li>
							<li>• Circuit breaking</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Tools
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Kong - Full-featured</li>
							<li>• NGINX - Lightweight</li>
							<li>• AWS API Gateway</li>
							<li>• Traefik - K8s native</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level48APIGateway;

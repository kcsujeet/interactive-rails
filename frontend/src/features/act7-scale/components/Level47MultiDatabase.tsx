/**
 * Level 43: Multi-Database
 *
 * Architecture diagram builder for Rails multi-database support.
 * Users add read replicas, configure traffic routing, and observe
 * latency improvements when reads are offloaded from the primary DB.
 */

import {
	Activity,
	ArrowRight,
	Copy,
	Database,
	Minus,
	Plus,
	Server,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

// --- Types ---

interface ReplicaNode {
	id: string;
	label: string;
}

interface TrafficRequest {
	id: number;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	path: string;
	target: 'primary' | 'replica';
	status: 'pending' | 'routing' | 'done';
}

// --- Constants ---

const SAMPLE_REQUESTS: Array<{
	method: TrafficRequest['method'];
	path: string;
}> = [
	{ method: 'GET', path: '/api/orders' },
	{ method: 'GET', path: '/api/customers/42' },
	{ method: 'GET', path: '/api/invoices' },
	{ method: 'POST', path: '/api/orders' },
	{ method: 'GET', path: '/api/orders/7' },
	{ method: 'PUT', path: '/api/subscriptions/3' },
	{ method: 'GET', path: '/api/subscriptions' },
	{ method: 'GET', path: '/api/projects' },
	{ method: 'DELETE', path: '/api/orders/5' },
	{ method: 'GET', path: '/api/invoices?status=due' },
];

const LATENCY_SINGLE_DB = { p50: 320, p95: 620, p99: 800 };
const LATENCY_WITH_REPLICAS = { p50: 45, p95: 95, p99: 150 };

// --- Component ---

export function Level47MultiDatabase({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// State
	const [replicas, setReplicas] = useState<ReplicaNode[]>([]);
	const [connectsToEnabled, setConnectsToEnabled] = useState(false);
	const [replicationDelay, setReplicationDelay] = useState(2);
	const [isSimulating, setIsSimulating] = useState(false);
	const [trafficLog, setTrafficLog] = useState<TrafficRequest[]>([]);
	const [simulationComplete, setSimulationComplete] = useState(false);

	// Refs
	const nextReplicaId = useRef(1);
	const requestIdCounter = useRef(0);
	const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

	// Derived state
	const hasReplicas = replicas.length > 0;
	const isConfigured = hasReplicas && connectsToEnabled;

	// Compute current latency based on configuration
	const currentLatency = isConfigured
		? LATENCY_WITH_REPLICAS
		: LATENCY_SINGLE_DB;
	const latencyPercent = isConfigured
		? Math.max(5, (currentLatency.p99 / LATENCY_SINGLE_DB.p99) * 100)
		: 100;
	const latencyColor = isConfigured ? 'text-success' : 'text-destructive';
	const latencyBarColor = isConfigured ? 'bg-success' : 'bg-destructive';

	// Traffic counts
	const readCount = trafficLog.filter(
		(r) => r.method === 'GET' && r.status === 'done',
	).length;
	const writeCount = trafficLog.filter(
		(r) => r.method !== 'GET' && r.status === 'done',
	).length;
	const replicaHits = trafficLog.filter(
		(r) => r.target === 'replica' && r.status === 'done',
	).length;
	const primaryHits = trafficLog.filter(
		(r) => r.target === 'primary' && r.status === 'done',
	).length;

	// --- Handlers ---

	const addReplica = () => {
		const id = nextReplicaId.current++;
		setReplicas((prev) => [
			...prev,
			{ id: `replica-${id}`, label: `Read Replica ${id}` },
		]);
	};

	const removeReplica = (replicaId: string) => {
		setReplicas((prev) => prev.filter((r) => r.id !== replicaId));
	};

	const startSimulation = useCallback(() => {
		if (isSimulating) return;
		setIsSimulating(true);
		setTrafficLog([]);
		setSimulationComplete(false);

		let requestIndex = 0;

		simulationInterval.current = setInterval(() => {
			if (requestIndex >= SAMPLE_REQUESTS.length) {
				// Mark simulation as complete
				setIsSimulating(false);
				setSimulationComplete(true);
				if (simulationInterval.current) {
					clearInterval(simulationInterval.current);
					simulationInterval.current = null;
				}
				return;
			}

			const sample = SAMPLE_REQUESTS[requestIndex];
			const reqId = ++requestIdCounter.current;
			const isRead = sample.method === 'GET';
			const target: TrafficRequest['target'] =
				isConfigured && isRead ? 'replica' : 'primary';

			// Add as routing
			const newRequest: TrafficRequest = {
				id: reqId,
				method: sample.method,
				path: sample.path,
				target,
				status: 'routing',
			};

			setTrafficLog((prev) => [...prev.slice(-14), newRequest]);

			// Mark as done after a short delay
			setTimeout(() => {
				setTrafficLog((prev) =>
					prev.map((r) => (r.id === reqId ? { ...r, status: 'done' } : r)),
				);
			}, 400);

			requestIndex++;
		}, 600);
	}, [isSimulating, isConfigured]);

	// Cleanup interval on unmount
	useEffect(() => {
		return () => {
			if (simulationInterval.current) {
				clearInterval(simulationInterval.current);
			}
		};
	}, []);

	const handleReset = () => {
		if (simulationInterval.current) {
			clearInterval(simulationInterval.current);
			simulationInterval.current = null;
		}
		setReplicas([]);
		setConnectsToEnabled(false);
		setReplicationDelay(2);
		setIsSimulating(false);
		setTrafficLog([]);
		setSimulationComplete(false);
		nextReplicaId.current = 1;
		requestIdCounter.current = 0;
	};

	const handleValidate = useCallback((): ValidationResult => {
		const errors: string[] = [];

		if (!hasReplicas) {
			errors.push('Add at least one read replica to offload read traffic');
		}
		if (!connectsToEnabled) {
			errors.push('Enable connects_to to configure database role switching');
		}
		if (!simulationComplete) {
			errors.push('Run the traffic simulator to see the latency improvement');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Complete the multi-database setup',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Multi-database configured! Read traffic offloaded to replicas.',
		};
	}, [hasReplicas, connectsToEnabled, simulationComplete]);

	const handleComplete = async () => {
		const success = await completeLevel('act7-level47-multi-database', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// --- Code Preview ---

	const databaseYml = `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
  primary_replica:
    adapter: postgresql
    host: replica-db.example.com
    database: app_production
    replica: true`;

	const connectsToCode = connectsToEnabled
		? `# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end`
		: `# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  # TODO: Add connects_to for role switching
end`;

	const selectorCode = `# config/application.rb
config.active_record.database_selector = {
  delay: ${replicationDelay}.seconds
}
config.active_record.database_resolver =
  ActiveRecord::Middleware::DatabaseSelector::Resolver
config.active_record.database_resolver_context =
  ActiveRecord::Middleware::DatabaseSelector::Resolver::Session

# Automatic routing:
# GET requests  -> reading role (replica)
# POST/PUT/DELETE -> writing role (primary)
# After a write, reads stay on primary
#   for ${replicationDelay}s (replication delay)`;

	// --- Render ---

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Scale reads with multi-database replicas and automatic role switching."
					instructions={[
						'Add at least one read replica',
						'Enable connects_to for role switching',
						'Run the traffic simulator',
						'Observe reads going to replicas, writes to primary',
					]}
					scenario="Reads are 90% of traffic, all hitting a single database. Latency spikes during peak reads as they compete with writes. You need to offload reads to replicas."
				>
					{/* Latency Meter */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							p99 Latency
						</div>
						<div className="flex items-center gap-3 mb-2">
							<Activity className={`w-4 h-4 ${latencyColor}`} />
							<span className={`text-2xl font-bold ${latencyColor}`}>
								{currentLatency.p99}ms
							</span>
						</div>
						<div className="h-3 bg-secondary rounded-full overflow-hidden">
							<div
								className={`h-full rounded-full transition-all duration-700 ${latencyBarColor}`}
								style={{ width: `${latencyPercent}%` }}
							/>
						</div>
						<div className="flex justify-between text-xs text-muted-foreground mt-1">
							<span>0ms</span>
							<span>{LATENCY_SINGLE_DB.p99}ms</span>
						</div>
					</div>

					{/* Latency Breakdown */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Latency Comparison
						</div>
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">p50</span>
								<div className="flex items-center gap-2">
									<span className="text-destructive line-through text-xs">
										{LATENCY_SINGLE_DB.p50}ms
									</span>
									{isConfigured && (
										<>
											<ArrowRight className="w-3 h-3 text-muted-foreground" />
											<span className="text-success font-medium">
												{LATENCY_WITH_REPLICAS.p50}ms
											</span>
										</>
									)}
								</div>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">p95</span>
								<div className="flex items-center gap-2">
									<span className="text-destructive line-through text-xs">
										{LATENCY_SINGLE_DB.p95}ms
									</span>
									{isConfigured && (
										<>
											<ArrowRight className="w-3 h-3 text-muted-foreground" />
											<span className="text-success font-medium">
												{LATENCY_WITH_REPLICAS.p95}ms
											</span>
										</>
									)}
								</div>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">p99</span>
								<div className="flex items-center gap-2">
									<span className="text-destructive line-through text-xs">
										{LATENCY_SINGLE_DB.p99}ms
									</span>
									{isConfigured && (
										<>
											<ArrowRight className="w-3 h-3 text-muted-foreground" />
											<span className="text-success font-medium">
												{LATENCY_WITH_REPLICAS.p99}ms
											</span>
										</>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Replication Delay */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Replication Delay
						</div>
						<div className="flex items-center gap-3">
							<input
								className="flex-1"
								max="10"
								min="1"
								onChange={(e) => setReplicationDelay(Number(e.target.value))}
								type="range"
								value={replicationDelay}
							/>
							<span className="text-sm text-foreground font-medium w-10 text-right">
								{replicationDelay}s
							</span>
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							After a write, reads stay on primary for {replicationDelay}s
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Multi-Database"
					levelNumber={47}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto space-y-6">
						{/* Architecture Diagram */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="text-foreground font-semibold flex items-center gap-2">
									<Server className="w-4 h-4 text-primary" />
									Database Architecture
								</div>
								<div className="text-xs text-muted-foreground">
									{isConfigured ? 'Multi-database active' : 'Single database'}
								</div>
							</div>

							<div className="p-6">
								{/* Application Server */}
								<div className="flex justify-center mb-6">
									<div className="bg-primary/10 border-2 border-primary rounded-xl px-6 py-3 text-center">
										<Server className="w-5 h-5 text-primary mx-auto mb-1" />
										<div className="text-primary font-medium text-sm">
											Rails Application
										</div>
										<div className="text-xs text-muted-foreground">
											{isConfigured
												? 'database_selector active'
												: 'Single connection'}
										</div>
									</div>
								</div>

								{/* Routing arrows */}
								{isConfigured && (
									<div className="flex justify-center gap-16 mb-3">
										<div className="flex flex-col items-center">
											<div className="w-px h-6 bg-success" />
											<div className="text-xs text-success font-medium px-2 py-0.5 bg-success/10 rounded">
												GET (reads)
											</div>
											<div className="w-px h-6 bg-success" />
										</div>
										<div className="flex flex-col items-center">
											<div className="w-px h-6 bg-warning" />
											<div className="text-xs text-warning font-medium px-2 py-0.5 bg-warning/10 rounded">
												POST/PUT/DELETE
											</div>
											<div className="w-px h-6 bg-warning" />
										</div>
									</div>
								)}

								{!isConfigured && (
									<div className="flex justify-center mb-3">
										<div className="flex flex-col items-center">
											<div className="w-px h-6 bg-destructive" />
											<div className="text-xs text-destructive font-medium px-2 py-0.5 bg-destructive/10 rounded">
												ALL traffic
											</div>
											<div className="w-px h-6 bg-destructive" />
										</div>
									</div>
								)}

								{/* Database nodes */}
								<div className="flex justify-center gap-6 flex-wrap">
									{/* Primary DB */}
									<div
										className={`border-2 rounded-xl p-4 text-center min-w-[140px] transition-all ${
											!isConfigured
												? 'border-destructive bg-destructive/10'
												: 'border-warning bg-warning/10'
										}`}
									>
										<Database
											className={`w-6 h-6 mx-auto mb-2 ${
												!isConfigured ? 'text-destructive' : 'text-warning'
											}`}
										/>
										<div
											className={`font-medium text-sm ${
												!isConfigured ? 'text-destructive' : 'text-warning'
											}`}
										>
											Primary DB
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											{isConfigured ? 'Writes only' : 'ALL traffic'}
										</div>
										{!isConfigured && (
											<div className="text-xs text-destructive mt-1 flex items-center justify-center gap-1">
												<Zap className="w-3 h-3" />
												Overloaded
											</div>
										)}
									</div>

									{/* Replicas */}
									{replicas.map((replica) => (
										<div
											className="border-2 border-success bg-success/10 rounded-xl p-4 text-center min-w-[140px] relative group transition-all"
											key={replica.id}
										>
											<Button
												className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0"
												color="destructive"
												onClick={() => removeReplica(replica.id)}
												size="icon"
											>
												<Minus className="w-3 h-3" />
											</Button>
											<Copy className="w-6 h-6 text-success mx-auto mb-2" />
											<div className="text-success font-medium text-sm">
												{replica.label}
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												{connectsToEnabled
													? 'Reads routed here'
													: 'Not connected'}
											</div>
										</div>
									))}

									{/* Add Replica Button */}
									<Button
										className="border-2 border-dashed border-border rounded-xl p-4 min-w-[140px] h-auto flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
										onClick={addReplica}
										variant="ghost"
									>
										<Plus className="w-6 h-6 text-muted-foreground" />
										<span className="text-muted-foreground text-sm">
											Add Replica
										</span>
									</Button>
								</div>
							</div>
						</div>

						{/* connects_to Toggle */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold flex items-center gap-2">
									<Zap className="w-4 h-4 text-primary" />
									Role Configuration
								</div>
							</div>
							<div className="p-4">
								<Button
									className={`w-full py-3 ${
										connectsToEnabled
											? 'bg-success text-success-foreground cursor-default'
											: ''
									}`}
									disabled={!hasReplicas || connectsToEnabled}
									onClick={() => setConnectsToEnabled(true)}
								>
									{connectsToEnabled
										? 'connects_to Enabled'
										: hasReplicas
											? 'Enable connects_to'
											: 'Add a replica first'}
								</Button>
								{connectsToEnabled && (
									<div className="mt-3 p-3 bg-success/10 rounded-lg text-sm text-success">
										<div className="font-medium mb-1">Active routing:</div>
										<div className="text-xs space-y-1">
											<div className="flex items-center gap-2">
												<span className="text-success">writing:</span>
												<span className="text-muted-foreground">:primary</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-success">reading:</span>
												<span className="text-muted-foreground">
													:primary_replica
												</span>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Traffic Simulator */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="text-foreground font-semibold flex items-center gap-2">
									<Activity className="w-4 h-4 text-primary" />
									Traffic Simulator
								</div>
								{trafficLog.length > 0 && (
									<div className="flex items-center gap-3 text-xs">
										<span className="text-success">Replica: {replicaHits}</span>
										<span className="text-warning">Primary: {primaryHits}</span>
									</div>
								)}
							</div>
							<div className="p-4">
								<Button
									className="w-full py-3 mb-4"
									disabled={isSimulating}
									onClick={startSimulation}
									variant="secondary"
								>
									{isSimulating
										? 'Simulating traffic...'
										: simulationComplete
											? 'Run Again'
											: 'Start Traffic Simulation'}
								</Button>

								{/* Traffic Log */}
								{trafficLog.length > 0 && (
									<div className="space-y-1.5 max-h-56 overflow-y-auto">
										{trafficLog.map((req) => {
											const isRead = req.method === 'GET';
											return (
												<div
													className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
														req.status === 'routing'
															? 'bg-primary/10 border border-primary/30'
															: req.target === 'replica'
																? 'bg-success/10 border border-success/20'
																: 'bg-warning/10 border border-warning/20'
													}`}
													key={req.id}
												>
													<div className="flex items-center gap-2">
														<span
															className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${
																isRead
																	? 'bg-success/20 text-success'
																	: 'bg-warning/20 text-warning'
															}`}
														>
															{req.method}
														</span>
														<span className="text-muted-foreground font-mono">
															{req.path}
														</span>
													</div>
													<div className="flex items-center gap-2">
														{req.status === 'routing' ? (
															<span className="text-primary">routing...</span>
														) : (
															<>
																<ArrowRight className="w-3 h-3 text-muted-foreground" />
																<span
																	className={`font-medium ${
																		req.target === 'replica'
																			? 'text-success'
																			: 'text-warning'
																	}`}
																>
																	{req.target === 'replica'
																		? 'Replica'
																		: 'Primary'}
																</span>
															</>
														)}
													</div>
												</div>
											);
										})}
									</div>
								)}

								{/* Summary */}
								{simulationComplete && (
									<div className="mt-4 p-3 bg-card border border-border rounded-lg">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Simulation Results
										</div>
										<div className="grid grid-cols-2 gap-3 text-sm">
											<div>
												<span className="text-muted-foreground">
													Total reads:
												</span>
												<span className="ml-2 text-foreground font-medium">
													{readCount}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">
													Total writes:
												</span>
												<span className="ml-2 text-foreground font-medium">
													{writeCount}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">
													To replica:
												</span>
												<span className="ml-2 text-success font-medium">
													{replicaHits}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">
													To primary:
												</span>
												<span className="ml-2 text-warning font-medium">
													{primaryHits}
												</span>
											</div>
										</div>
										{isConfigured && replicaHits > 0 && (
											<div className="mt-2 text-xs text-success">
												{Math.round(
													(replicaHits / (replicaHits + primaryHits)) * 100,
												)}
												% of traffic offloaded to replicas
											</div>
										)}
									</div>
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
							filename: 'config/database.yml',
							language: 'ruby',
							code: databaseYml,
							highlight: hasReplicas ? [7, 8, 9, 10, 11] : [],
						},
						{
							filename: 'app/models/application_record.rb',
							language: 'ruby',
							code: connectsToCode,
							highlight: connectsToEnabled ? [5, 6, 7] : [],
						},
						{
							filename: 'config/application.rb',
							language: 'ruby',
							code: selectorCode,
							highlight: isConfigured ? [2, 3] : [],
						},
					]}
					learningGoal="Rails multi-database support routes reads to replicas and writes to the primary. The database_selector middleware handles this automatically based on HTTP method, with a configurable replication delay."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<span className="text-primary">replica: true</span> marks a DB
									as read-only
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<span className="text-primary">connects_to</span> maps roles
									to database configs
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Activity className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<span className="text-primary">database_selector</span>{' '}
									auto-routes by HTTP method
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<span className="text-primary">delay:</span> after a write,
									reads stay on primary to avoid stale data
								</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level47MultiDatabase;

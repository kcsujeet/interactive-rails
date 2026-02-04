/**
 * Level 27: Load Balancing
 *
 * Distribute traffic across multiple servers.
 * Player learns load balancing strategies and session affinity.
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

interface Server {
	id: string;
	name: string;
	healthy: boolean;
	load: number;
	requestCount: number;
	responseTime: number;
}

type LoadBalancingStrategy =
	| 'round-robin'
	| 'least-connections'
	| 'ip-hash'
	| 'weighted';

const INITIAL_SERVERS: Server[] = [
	{
		id: 'server1',
		name: 'Server 1',
		healthy: true,
		load: 0,
		requestCount: 0,
		responseTime: 50,
	},
	{
		id: 'server2',
		name: 'Server 2',
		healthy: true,
		load: 0,
		requestCount: 0,
		responseTime: 50,
	},
	{
		id: 'server3',
		name: 'Server 3',
		healthy: true,
		load: 0,
		requestCount: 0,
		responseTime: 50,
	},
];

export function Level27LoadBalancing({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
	const [strategy, setStrategy] = useState<LoadBalancingStrategy | null>(null);
	const [isSimulating, setIsSimulating] = useState(false);
	const [totalRequests, setTotalRequests] = useState(0);
	const [roundRobinIndex, setRoundRobinIndex] = useState(0);
	const [requestsPerSecond, setRequestsPerSecond] = useState(10);

	// Simulate traffic
	useEffect(() => {
		if (!isSimulating || !strategy) return;

		const interval = setInterval(() => {
			const healthyServers = servers.filter((s) => s.healthy);
			if (healthyServers.length === 0) return;

			// Route request based on strategy
			let targetServer: Server;

			switch (strategy) {
				case 'round-robin':
					targetServer =
						healthyServers[roundRobinIndex % healthyServers.length];
					setRoundRobinIndex((prev) => prev + 1);
					break;
				case 'least-connections':
					targetServer = healthyServers.reduce((min, s) =>
						s.load < min.load ? s : min,
					);
					break;
				case 'ip-hash': {
					// Simulate sticky sessions
					const clientIp = Math.floor(Math.random() * 100) % 3;
					targetServer = healthyServers[clientIp % healthyServers.length];
					break;
				}
				case 'weighted': {
					// Server 1 gets 50%, Server 2 gets 30%, Server 3 gets 20%
					const rand = Math.random();
					if (rand < 0.5)
						targetServer =
							healthyServers.find((s) => s.id === 'server1') ||
							healthyServers[0];
					else if (rand < 0.8)
						targetServer =
							healthyServers.find((s) => s.id === 'server2') ||
							healthyServers[0];
					else
						targetServer =
							healthyServers.find((s) => s.id === 'server3') ||
							healthyServers[0];
					break;
				}
				default:
					targetServer = healthyServers[0];
			}

			setServers((prev) =>
				prev.map((s) => {
					if (s.id === targetServer.id) {
						const newLoad = Math.min(s.load + 10, 100);
						return {
							...s,
							load: newLoad,
							requestCount: s.requestCount + 1,
							responseTime: 50 + newLoad * 2,
						};
					}
					// Decay load over time
					return { ...s, load: Math.max(s.load - 2, 0) };
				}),
			);

			setTotalRequests((prev) => prev + 1);
		}, 1000 / requestsPerSecond);

		return () => clearInterval(interval);
	}, [isSimulating, strategy, servers, roundRobinIndex, requestsPerSecond]);

	const toggleServerHealth = (serverId: string) => {
		setServers((prev) =>
			prev.map((s) =>
				s.id === serverId ? { ...s, healthy: !s.healthy, load: 0 } : s,
			),
		);
	};

	const validateSolution = (): ValidationResult => {
		if (!strategy) {
			return {
				valid: false,
				message: 'Select a load balancing strategy!',
				details: ['Choose how traffic should be distributed'],
			};
		}
		if (totalRequests < 20) {
			return {
				valid: false,
				message: 'Run the simulation longer!',
				details: ['Let at least 20 requests flow through'],
			};
		}
		return { valid: true, message: 'Load balancing configured!' };
	};

	const handleComplete = async () => {
		const success = await completeLevel('act5-level27-load-balancing', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const avgResponseTime =
		servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Distribute traffic across multiple servers for reliability and performance."
					instructions={[
						'Round Robin: Equal distribution',
						'Least Connections: Route to least busy',
						'IP Hash: Same user → same server',
						'Weighted: More to powerful servers',
					]}
					scenario="Your single server is overwhelmed. Response times are through the roof. Add more servers and distribute the load intelligently!"
				>
					{/* Traffic Control */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Traffic Simulation
						</div>
						<div className="mb-3">
							<label className="text-xs text-muted-foreground">
								Requests per second: {requestsPerSecond}
							</label>
							<input
								className="w-full"
								max="50"
								min="1"
								onChange={(e) => setRequestsPerSecond(Number(e.target.value))}
								type="range"
								value={requestsPerSecond}
							/>
						</div>
						<Button
							className="w-full"
							disabled={!strategy}
							onClick={() => setIsSimulating(!isSimulating)}
							variant={
								!strategy
									? 'secondary'
									: isSimulating
										? 'destructive'
										: 'default'
							}
						>
							{isSimulating ? 'Stop Traffic' : 'Start Traffic'}
						</Button>
					</div>

					{/* Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Metrics
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="bg-card p-2 rounded text-center">
								<div className="text-xl font-bold text-foreground">
									{totalRequests}
								</div>
								<div className="text-xs text-muted-foreground">
									Total Requests
								</div>
							</div>
							<div className="bg-card p-2 rounded text-center">
								<div
									className={`text-xl font-bold ${avgResponseTime < 100 ? 'text-success' : avgResponseTime < 200 ? 'text-warning' : 'text-destructive'}`}
								>
									{Math.round(avgResponseTime)}ms
								</div>
								<div className="text-xs text-muted-foreground">
									Avg Response
								</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Load Balancing"
					levelNumber={27}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setServers(INITIAL_SERVERS);
						setStrategy(null);
						setTotalRequests(0);
						setIsSimulating(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Strategy Selection */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Load Balancing Strategy
								</div>
							</div>
							<div className="p-4 grid grid-cols-4 gap-3">
								{[
									{
										id: 'round-robin',
										name: 'Round Robin',
										icon: '🔄',
										desc: 'A → B → C → A...',
									},
									{
										id: 'least-connections',
										name: 'Least Conns',
										icon: '📊',
										desc: 'Route to least busy',
									},
									{
										id: 'ip-hash',
										name: 'IP Hash',
										icon: '🔗',
										desc: 'Sticky sessions',
									},
									{
										id: 'weighted',
										name: 'Weighted',
										icon: '⚖️',
										desc: '50/30/20 split',
									},
								].map((s) => (
									<Button
										className={`p-3 h-auto rounded-lg border-2 text-center transition-all flex-col ${
											strategy === s.id
												? 'border-primary bg-primary/20'
												: 'border-border bg-secondary hover:border-muted-foreground'
										}`}
										key={s.id}
										onClick={() => setStrategy(s.id as LoadBalancingStrategy)}
										variant={strategy === s.id ? 'default' : 'outline'}
									>
										<div className="text-2xl mb-1">{s.icon}</div>
										<div
											className={`text-sm font-semibold ${strategy === s.id ? 'text-primary' : 'text-foreground'}`}
										>
											{s.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{s.desc}
										</div>
									</Button>
								))}
							</div>
						</div>

						{/* Load Balancer Visualization */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">Server Farm</div>
								<div className="text-xs text-muted-foreground">
									Click servers to toggle health
								</div>
							</div>
							<div className="p-8">
								<div className="flex items-center justify-between">
									{/* Load Balancer */}
									<div className="text-center">
										<div
											className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center ${
												strategy ? 'bg-primary' : 'bg-secondary'
											}`}
										>
											<span className="text-3xl">⚖️</span>
											<span className="text-xs text-foreground mt-1">
												Load Balancer
											</span>
										</div>
									</div>

									{/* Connection Lines */}
									<div className="flex-1 flex flex-col justify-center gap-4 mx-4">
										{servers.map((server) => (
											<div
												className={`h-1 ${server.healthy ? 'bg-success' : 'bg-destructive opacity-30'}`}
												key={server.id}
											/>
										))}
									</div>

									{/* Servers */}
									<div className="space-y-4">
										{servers.map((server) => (
											<Button
												className={`w-40 p-3 h-auto rounded-lg border-2 text-left transition-all flex-col items-stretch ${
													server.healthy
														? 'border-success bg-success/20'
														: 'border-destructive bg-destructive/20 opacity-50'
												}`}
												key={server.id}
												onClick={() => toggleServerHealth(server.id)}
												variant="outline"
											>
												<div className="flex items-center justify-between mb-2">
													<span
														className={
															server.healthy
																? 'text-success'
																: 'text-destructive'
														}
													>
														{server.name}
													</span>
													<span
														className={`w-2 h-2 rounded-full ${server.healthy ? 'bg-success' : 'bg-destructive'}`}
													/>
												</div>
												<div className="h-2 bg-secondary rounded-full overflow-hidden mb-1">
													<div
														className={`h-full transition-all ${
															server.load > 80
																? 'bg-destructive'
																: server.load > 50
																	? 'bg-warning'
																	: 'bg-success'
														}`}
														style={{ width: `${server.load}%` }}
													/>
												</div>
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>{server.requestCount} reqs</span>
													<span>{server.responseTime}ms</span>
												</div>
											</Button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Request Distribution */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Request Distribution
								</div>
							</div>
							<div className="p-4">
								<div className="flex gap-4">
									{servers.map((server) => {
										const percentage =
											totalRequests > 0
												? Math.round(
														(server.requestCount / totalRequests) * 100,
													)
												: 0;
										return (
											<div className="flex-1" key={server.id}>
												<div className="text-center mb-2">
													<div className="text-2xl font-bold text-foreground">
														{percentage}%
													</div>
													<div className="text-xs text-muted-foreground">
														{server.name}
													</div>
												</div>
												<div className="h-24 bg-secondary rounded-lg overflow-hidden flex flex-col-reverse">
													<div
														className="bg-primary transition-all"
														style={{ height: `${percentage}%` }}
													/>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'nginx.conf',
							language: 'nginx',
							code:
								strategy === 'round-robin'
									? `upstream backend {
  server server1:3000;
  server server2:3000;
  server server3:3000;
}

# Round robin is default`
									: strategy === 'least-connections'
										? `upstream backend {
  least_conn;
  server server1:3000;
  server server2:3000;
  server server3:3000;
}`
										: strategy === 'ip-hash'
											? `upstream backend {
  ip_hash;  # Sticky sessions
  server server1:3000;
  server server2:3000;
  server server3:3000;
}`
											: strategy === 'weighted'
												? `upstream backend {
  server server1:3000 weight=5;
  server server2:3000 weight=3;
  server server3:3000 weight=2;
}`
												: `upstream backend {
  # Select a strategy above
  server server1:3000;
  server server2:3000;
  server server3:3000;
}`,
							highlight:
								strategy === 'least-connections'
									? [2]
									: strategy === 'ip-hash'
										? [2]
										: strategy === 'weighted'
											? [2, 3, 4]
											: [],
						},
					]}
					learningGoal="Load balancers distribute traffic and provide high availability. Choose strategy based on your app's needs."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							When to Use
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary">Round Robin:</span> Equal servers
							</li>
							<li>
								<span className="text-primary">Least Conn:</span> Varying load
							</li>
							<li>
								<span className="text-primary">IP Hash:</span> Session state
							</li>
							<li>
								<span className="text-primary">Weighted:</span> Different
								capacities
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Tools
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• NGINX - Software LB</li>
							<li>• HAProxy - High performance</li>
							<li>• AWS ALB - Managed</li>
							<li>• Cloudflare - Edge LB</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level27LoadBalancing;

/**
 * Level 38: Rate Limiting
 *
 * Protect your API from abuse with rate limiting.
 * Player learns different rate limiting strategies.
 */

import { AppWindow, Bot, Droplets, Ruler, Skull, User } from 'lucide-react';
import { useEffect, useState } from 'react';
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

interface RateLimitConfig {
	enabled: boolean;
	limit: number;
	window: number; // seconds
	strategy: 'fixed-window' | 'sliding-window' | 'token-bucket' | null;
}

interface Client {
	id: string;
	name: string;
	type: 'normal' | 'bot' | 'attacker';
	requestsPerSecond: number;
	blocked: boolean;
	requestCount: number;
}

const INITIAL_CLIENTS: Client[] = [
	{
		id: 'user1',
		name: 'Normal User',
		type: 'normal',
		requestsPerSecond: 1,
		blocked: false,
		requestCount: 0,
	},
	{
		id: 'user2',
		name: 'Power User',
		type: 'normal',
		requestsPerSecond: 3,
		blocked: false,
		requestCount: 0,
	},
	{
		id: 'bot',
		name: 'Scraper Bot',
		type: 'bot',
		requestsPerSecond: 20,
		blocked: false,
		requestCount: 0,
	},
	{
		id: 'attacker',
		name: 'DDoS Attacker',
		type: 'attacker',
		requestsPerSecond: 100,
		blocked: false,
		requestCount: 0,
	},
];

const STRATEGY_EXPLANATIONS: Record<string, { visual: string; tradeoff: string; railsCode: string }> = {
	'fixed-window': {
		visual: 'Counter resets at fixed intervals (e.g., every minute at :00). A burst of requests at :59 and :01 can double the effective rate.',
		tradeoff: 'Simple to implement, but vulnerable to edge-of-window bursts.',
		railsCode: `rate_limit to: 60, within: 1.minute`,
	},
	'sliding-window': {
		visual: 'Counts requests in a rolling window behind each request. No edge bursts possible, but requires storing timestamps.',
		tradeoff: 'Smooth limiting without bursts, but uses more memory per client.',
		railsCode: `# Rack::Attack with sliding window\nRack::Attack.throttle("api/ip", limit: 60, period: 60) { |req| req.ip }`,
	},
	'token-bucket': {
		visual: 'Each client gets a bucket of tokens that refills over time. A request costs one token. Empty bucket = rate limited. Allows short bursts.',
		tradeoff: 'Best for APIs that need burst tolerance. Most flexible but most complex.',
		railsCode: `# Token bucket via rack-attack\n# Tokens refill at limit/period rate\n# Burst allowed up to bucket size`,
	},
};

export function Level41RateLimiting({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [config, setConfig] = useState<RateLimitConfig>({
		enabled: false,
		limit: 60,
		window: 60,
		strategy: null,
	});
	const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
	const [isSimulating, setIsSimulating] = useState(false);
	const [serverHealth, setServerHealth] = useState(100);
	const [requestCounts, setRequestCounts] = useState<Record<string, number>>(
		{},
	);

	// Simulate traffic
	useEffect(() => {
		if (!isSimulating) return;

		const interval = setInterval(() => {
			let totalLoad = 0;

			setClients((prev) =>
				prev.map((client) => {
					if (client.blocked) return client;

					const newCount = client.requestCount + client.requestsPerSecond;
					totalLoad += client.requestsPerSecond;

					// Check rate limit
					if (config.enabled && config.strategy) {
						const limitPerSecond = config.limit / config.window;
						if (client.requestsPerSecond > limitPerSecond * 2) {
							return { ...client, blocked: true };
						}
					}

					setRequestCounts((prev) => ({
						...prev,
						[client.id]: (prev[client.id] || 0) + client.requestsPerSecond,
					}));

					return { ...client, requestCount: newCount };
				}),
			);

			// Update server health based on load
			if (config.enabled && config.strategy) {
				// Rate limiting protects the server
				const blockedLoad = clients
					.filter((c) => c.blocked)
					.reduce((sum, c) => sum + c.requestsPerSecond, 0);
				const effectiveLoad = totalLoad - blockedLoad;
				setServerHealth(Math.max(0, 100 - effectiveLoad));
			} else {
				// No protection, server gets overwhelmed
				setServerHealth(Math.max(0, 100 - totalLoad * 0.8));
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [isSimulating, config, clients]);

	const toggleClient = (clientId: string) => {
		setClients((prev) =>
			prev.map((c) => (c.id === clientId ? { ...c, blocked: !c.blocked } : c)),
		);
	};

	const setStrategy = (strategy: RateLimitConfig['strategy']) => {
		setConfig((prev) => ({ ...prev, strategy, enabled: strategy !== null }));
	};

	const validateSolution = (): ValidationResult => {
		if (!config.enabled || !config.strategy) {
			return {
				valid: false,
				message: 'Enable rate limiting!',
				details: ['Choose a rate limiting strategy'],
			};
		}
		if (serverHealth < 50) {
			return {
				valid: false,
				message: 'Server is struggling!',
				details: ['Your rate limits are too permissive'],
			};
		}
		const attackerBlocked = clients.find((c) => c.type === 'attacker')?.blocked;
		const normalUsersBlocked = clients.filter(
			(c) => c.type === 'normal' && c.blocked,
		).length;
		if (!attackerBlocked) {
			return {
				valid: false,
				message: 'Attacker not blocked!',
				details: ['Rate limits should block abusive traffic'],
			};
		}
		if (normalUsersBlocked > 0) {
			return {
				valid: false,
				message: "Don't block legitimate users!",
				details: ['Tune your limits to allow normal traffic'],
			};
		}
		return { valid: true, message: 'Rate limiting protects your API!' };
	};

	const handleComplete = async () => {
		const success = await completeLevel('act6-level41-rate-limiting', {
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
					goal="Protect your API from abuse while allowing legitimate traffic."
					instructions={[
						'Set requests per window (e.g., 60/minute)',
						'Choose a strategy for counting',
						'Block abusers, not legitimate users',
						'Return 429 Too Many Requests',
					]}
					scenario="Your API is being hammered by bots and scrapers. Legitimate users can't get through. You need to rate limit without blocking real users."
				>
					{/* Server Health */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Server Health
						</div>
						<div className="h-4 bg-secondary rounded-full overflow-hidden">
							<div
								className={`h-full transition-all ${
									serverHealth > 70
										? 'bg-success'
										: serverHealth > 30
											? 'bg-warning'
											: 'bg-destructive'
								}`}
								style={{ width: `${serverHealth}%` }}
							/>
						</div>
						<div className="text-xs text-muted-foreground mt-1 text-center">
							{serverHealth > 70
								? 'Healthy'
								: serverHealth > 30
									? 'Under Load'
									: 'Critical!'}
						</div>
					</div>

					{/* Rate Limit Settings */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Limit Settings
						</div>
						<div className="space-y-3">
							<div>
								<label className="text-xs text-muted-foreground">
									Requests: {config.limit}
								</label>
								<input
									className="w-full"
									max="200"
									min="10"
									onChange={(e) =>
										setConfig((prev) => ({
											...prev,
											limit: Number(e.target.value),
										}))
									}
									type="range"
									value={config.limit}
								/>
							</div>
							<div>
								<label className="text-xs text-muted-foreground">
									Window: {config.window}s
								</label>
								<input
									className="w-full"
									max="120"
									min="10"
									onChange={(e) =>
										setConfig((prev) => ({
											...prev,
											window: Number(e.target.value),
										}))
									}
									type="range"
									value={config.window}
								/>
							</div>
							<div className="text-center text-sm text-primary">
								{config.limit} requests / {config.window} seconds
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<Button
							className="w-full"
							color={isSimulating ? 'destructive' : 'primary'}
							onClick={() => setIsSimulating(!isSimulating)}
						>
							{isSimulating ? 'Stop Traffic' : 'Start Traffic'}
						</Button>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Rate Limiting"
					levelNumber={41}
					onComplete={handleComplete}
					onReset={() => {
						setConfig({
							enabled: false,
							limit: 60,
							window: 60,
							strategy: null,
						});
						setClients(INITIAL_CLIENTS);
						setServerHealth(100);
						setRequestCounts({});
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
									Rate Limiting Strategy
								</div>
							</div>
							<div className="p-4 grid grid-cols-3 gap-3">
								{(
									[
										{
											id: 'fixed-window',
											name: 'Fixed Window',
											Icon: AppWindow,
											desc: 'Reset counter each minute',
										},
										{
											id: 'sliding-window',
											name: 'Sliding Window',
											Icon: Ruler,
											desc: 'Rolling time window',
										},
										{
											id: 'token-bucket',
											name: 'Token Bucket',
											Icon: Droplets,
											desc: 'Tokens refill over time',
										},
									] as const
								).map((s) => (
									<Button
										className={`p-4 h-auto rounded-lg border-2 text-center transition-all flex-col ${
											config.strategy === s.id
												? 'border-success bg-success/20'
												: 'border-border bg-secondary hover:border-muted-foreground'
										}`}
										key={s.id}
										onClick={() =>
											setStrategy(s.id as RateLimitConfig['strategy'])
										}
										variant={config.strategy === s.id ? 'default' : 'outline'}
									>
										<s.Icon className="w-7 h-7 mb-2" />
										<div
											className={`font-semibold text-sm ${config.strategy === s.id ? 'text-success' : 'text-foreground'}`}
										>
											{s.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{s.desc}
										</div>
									</Button>
								))}
							</div>
							<div className="text-xs text-primary mt-3 mx-4 p-2 bg-primary/10 rounded">
								Rails 8 built-in: <code className="font-mono">rate_limit to: 10, within: 3.minutes</code> uses fixed-window by default.
							</div>
							{config.strategy && (
								<div className="p-4 border-t border-border mt-3">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										How It Works
									</div>
									<p className="text-sm text-foreground mb-2">
										{STRATEGY_EXPLANATIONS[config.strategy].visual}
									</p>
									<div className="text-xs text-warning bg-warning/10 p-2 rounded">
										{STRATEGY_EXPLANATIONS[config.strategy].tradeoff}
									</div>
									<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded mt-2 overflow-x-auto">
										{STRATEGY_EXPLANATIONS[config.strategy].railsCode}
									</pre>
								</div>
							)}
						</div>

						{/* Client Traffic */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Incoming Traffic
								</div>
								<div className="text-xs text-muted-foreground">
									Click to manually block/unblock
								</div>
							</div>
							<div className="p-4 space-y-3">
								{clients.map((client) => (
									<Button
										className={`w-full p-4 h-auto rounded-lg border-2 text-left transition-all ${
											client.blocked
												? 'border-destructive bg-destructive/20'
												: client.type === 'attacker'
													? 'border-destructive bg-destructive/10'
													: client.type === 'bot'
														? 'border-warning bg-warning/10'
														: 'border-success bg-success/10'
										}`}
										key={client.id}
										onClick={() => toggleClient(client.id)}
										variant="outline"
									>
										<div className="flex items-center justify-between w-full">
											<div className="flex items-center gap-3">
												<span className="flex items-center justify-center">
													{client.type === 'normal' ? (
														<User className="w-6 h-6" />
													) : client.type === 'bot' ? (
														<Bot className="w-6 h-6" />
													) : (
														<Skull className="w-6 h-6" />
													)}
												</span>
												<div>
													<div
														className={
															client.blocked
																? 'text-destructive'
																: 'text-foreground'
														}
													>
														{client.name}
													</div>
													<div className="text-xs text-muted-foreground">
														{client.requestsPerSecond} req/sec
													</div>
												</div>
											</div>
											<div className="text-right">
												<div
													className={`text-lg font-bold ${client.blocked ? 'text-destructive' : 'text-foreground'}`}
												>
													{requestCounts[client.id] || 0}
												</div>
												<div
													className={`text-xs ${client.blocked ? 'text-destructive' : 'text-muted-foreground'}`}
												>
													{client.blocked ? '429 BLOCKED' : 'requests'}
												</div>
											</div>
										</div>
									</Button>
								))}
							</div>
						</div>

						{/* Response Codes */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Response Headers
								</div>
							</div>
							<div className="p-4">
								<pre className="text-sm text-muted-foreground bg-secondary p-3 rounded">
									<code>
										{`HTTP/1.1 ${config.enabled && config.strategy ? '429 Too Many Requests' : '200 OK'}
X-RateLimit-Limit: ${config.limit}
X-RateLimit-Remaining: ${Math.max(0, config.limit - 45)}
X-RateLimit-Reset: ${Math.floor(Date.now() / 1000) + config.window}
Retry-After: ${config.window}`}
									</code>
								</pre>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/initializers/rack_attack.rb',
							language: 'ruby',
							code: `# Rack::Attack rate limiting
Rack::Attack.throttle("requests/ip",
  limit: ${config.limit},
  period: ${config.window}
) do |req|
  req.ip
end

# Block bad actors
Rack::Attack.blocklist("block bad IPs") do |req|
  Blocklist.include?(req.ip)
end

# Allow trusted clients
Rack::Attack.safelist("allow internal") do |req|
  req.ip == "127.0.0.1"
end

# Custom response
Rack::Attack.throttled_responder = -> (req) {
  [
    429,
    { 'Content-Type' => 'application/json' },
    [{ error: "Rate limit exceeded" }.to_json]
  ]
}`,
							highlight: [2, 3, 4],
						},
					]}
					learningGoal="Rate limiting protects your API from abuse. Return 429 with Retry-After header to be a good API citizen."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Strategy Comparison
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary">Fixed:</span> Simple, edge burst
							</li>
							<li>
								<span className="text-primary">Sliding:</span> Smoother, more
								memory
							</li>
							<li>
								<span className="text-primary">Token:</span> Allows bursts,
								refills
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Common Limits
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• 60 req/min - Standard API</li>
							<li>• 1000 req/hour - Generous</li>
							<li>• 10 req/min - Auth endpoints</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41RateLimiting;

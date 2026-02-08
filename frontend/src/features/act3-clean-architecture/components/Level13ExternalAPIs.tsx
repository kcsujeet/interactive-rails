/**
 * Level 13: External APIs
 *
 * Handle external API timeouts with Circuit Breaker pattern.
 * Shows graceful degradation when services are slow.
 */

import { useCallback, useEffect, useState } from 'react';
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
} from '@/components/levels';
import type { ValidationResult } from '@/components/levels';

type CircuitState = 'closed' | 'open' | 'half-open';

interface APICall {
	id: number;
	status: 'pending' | 'success' | 'timeout' | 'fallback';
	latency: number;
}

export function Level13ExternalAPIs({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [circuitBreakerEnabled, setCircuitBreakerEnabled] = useState(false);
	const [circuitState, setCircuitState] = useState<CircuitState>('closed');
	const [apiCalls, setApiCalls] = useState<APICall[]>([]);
	const [failureCount, setFailureCount] = useState(0);
	const [timeoutsSeen, setTimeoutsSeen] = useState(0);
	const [fallbacksSeen, setFallbacksSeen] = useState(0);

	const handleValidate = useCallback((): ValidationResult => {
		if (!circuitBreakerEnabled) {
			return { valid: false, message: 'Enable the Circuit Breaker', details: ['Click "Enable Circuit Breaker" to protect against timeouts'] };
		}
		if (fallbacksSeen < 3) {
			return { valid: false, message: 'Wait for fallbacks', details: [`The circuit needs to open and trigger fallback responses (${fallbacksSeen}/3)`] };
		}
		return { valid: true, message: 'Circuit Breaker is working! Fallbacks return instantly.' };
	}, [circuitBreakerEnabled, fallbacksSeen]);

	const simulateAPICall = useCallback(() => {
		const id = Date.now();
		const willTimeout = Math.random() < 0.6; // 60% chance of timeout
		const latency = willTimeout ? 5000 : Math.random() * 200 + 50;

		setApiCalls((prev) => [
			...prev.slice(-8),
			{ id, status: 'pending', latency },
		]);

		// Simulate the call
		setTimeout(
			() => {
				setApiCalls((prev) =>
					prev.map((call) => {
						if (call.id !== id) return call;

						if (circuitBreakerEnabled && circuitState === 'open') {
							setFallbacksSeen((c) => c + 1);
							return { ...call, status: 'fallback', latency: 5 };
						}

						if (willTimeout) {
							if (circuitBreakerEnabled) {
								setFailureCount((c) => {
									const newCount = c + 1;
									if (newCount >= 3) {
										setCircuitState('open');
										// Auto-close after 3 seconds
										setTimeout(() => {
											setCircuitState('half-open');
											setTimeout(() => setCircuitState('closed'), 2000);
											setFailureCount(0);
										}, 3000);
									}
									return newCount;
								});
							}
							setTimeoutsSeen((c) => c + 1);
							return { ...call, status: 'timeout', latency: 5000 };
						}

						setFailureCount(0);
						return { ...call, status: 'success', latency };
					}),
				);
			},
			circuitBreakerEnabled && circuitState === 'open'
				? 50
				: willTimeout
					? 2000
					: latency,
		);
	}, [circuitBreakerEnabled, circuitState]);

	// Auto-trigger API calls
	useEffect(() => {
		const interval = setInterval(simulateAPICall, 1500);
		return () => clearInterval(interval);
	}, [simulateAPICall]);

	const handleComplete = async () => {
		const success = await completeLevel('act3-level13-third-party-apis', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getStateColor = (state: CircuitState) => {
		switch (state) {
			case 'closed':
				return '#22c55e';
			case 'open':
				return '#ef4444';
			case 'half-open':
				return '#f59e0b';
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn the Circuit Breaker pattern for resilient external API calls."
					instructions={[
						'Watch API calls timeout (red) - each hangs the request',
						'Enable the Circuit Breaker pattern',
						'See fallbacks return instantly when circuit is open',
					]}
					scenario="The app calls GitHub's API to show repo stats. Sometimes GitHub is slow (5+ seconds), and users see a spinning loader. The whole page hangs!"
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${circuitBreakerEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
							disabled={circuitBreakerEnabled}
							onClick={() => setCircuitBreakerEnabled(true)}
							variant={circuitBreakerEnabled ? 'secondary' : 'default'}
						>
							{circuitBreakerEnabled
								? 'Circuit Breaker Enabled'
								: 'Enable Circuit Breaker'}
						</Button>
					</div>

					{circuitBreakerEnabled && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Circuit State
							</div>
							<div className="flex items-center gap-3">
								<div
									className="w-4 h-4 rounded-full"
									style={{ backgroundColor: getStateColor(circuitState) }}
								/>
								<span className="text-foreground font-medium capitalize">
									{circuitState}
								</span>
							</div>
							<div className="text-muted-foreground text-xs mt-2">
								{circuitState === 'closed' &&
									'Normal operation - requests go through'}
								{circuitState === 'open' &&
									'Failing fast - returning fallback immediately'}
								{circuitState === 'half-open' &&
									'Testing - allowing one request through'}
							</div>
							<div className="mt-3 text-muted-foreground text-sm">
								Failures: {failureCount} / 3
							</div>
						</div>
					)}

					<div className="p-4 border-t border-border">
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-destructive/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-destructive">
									{timeoutsSeen}
								</div>
								<div className="text-xs text-destructive/70">Timeouts</div>
							</div>
							<div className="bg-purple-900/30 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-purple-400">
									{fallbacksSeen}
								</div>
								<div className="text-xs text-purple-400/70">Fallbacks</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="External APIs"
					levelNumber={13}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setCircuitBreakerEnabled(false);
						setCircuitState('closed');
						setApiCalls([]);
						setFailureCount(0);
						setTimeoutsSeen(0);
						setFallbacksSeen(0);
					}}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture diagram */}
					<div className="flex items-center justify-center gap-8 mb-8">
						{/* App */}
						<div className="bg-card border border-border rounded-xl p-6 w-40 text-center">
							<div className="text-4xl mb-2">A</div>
							<div className="text-muted-foreground text-sm">Your App</div>
						</div>

						{/* Circuit Breaker */}
						{circuitBreakerEnabled && (
							<>
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

								<div
									className="border-2 rounded-xl p-4 w-32 text-center transition-colors"
									style={{
										borderColor: getStateColor(circuitState),
										backgroundColor: `${getStateColor(circuitState)}20`,
									}}
								>
									<div className="text-2xl mb-1">CB</div>
									<div
										className="text-xs capitalize"
										style={{ color: getStateColor(circuitState) }}
									>
										{circuitState}
									</div>
								</div>
							</>
						)}

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

						{/* GitHub API */}
						<div className="bg-card border border-border rounded-xl p-6 w-40 text-center">
							<div className="text-4xl mb-2">GH</div>
							<div className="text-muted-foreground text-sm">GitHub API</div>
							<div className="text-destructive text-xs mt-1">
								Sometimes slow!
							</div>
						</div>
					</div>

					{/* API Call Log */}
					<div className="bg-card rounded-xl p-4 max-w-2xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							API Call Log
						</div>
						<div className="space-y-2 max-h-64 overflow-y-auto">
							{apiCalls.map((call) => (
								<div
									className={`flex items-center justify-between p-3 rounded-lg ${
										call.status === 'pending'
											? 'bg-secondary'
											: call.status === 'success'
												? 'bg-success/20'
												: call.status === 'timeout'
													? 'bg-destructive/20'
													: 'bg-purple-900/30'
									}`}
									key={call.id}
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-2 h-2 rounded-full ${
												call.status === 'pending'
													? 'bg-muted-foreground animate-pulse'
													: call.status === 'success'
														? 'bg-success'
														: call.status === 'timeout'
															? 'bg-destructive'
															: 'bg-purple-500'
											}`}
										/>
										<span className="text-muted-foreground font-mono text-sm">
											GET /repos/rails/rails
										</span>
									</div>
									<div className="text-sm">
										{call.status === 'pending' && (
											<span className="text-muted-foreground">Loading...</span>
										)}
										{call.status === 'success' && (
											<span className="text-success">
												{Math.round(call.latency)}ms
											</span>
										)}
										{call.status === 'timeout' && (
											<span className="text-destructive">5000ms TIMEOUT</span>
										)}
										{call.status === 'fallback' && (
											<span className="text-purple-400">5ms (fallback)</span>
										)}
									</div>
								</div>
							))}
							{apiCalls.length === 0 && (
								<div className="text-muted-foreground text-center py-4">
									Waiting for API calls...
								</div>
							)}
						</div>
					</div>

				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/services/github_client.rb',
							language: 'ruby',
							code: `class GithubClient
  include Circuitbox

  circuit_breaker :github,
    exceptions: [Faraday::TimeoutError],
    threshold: 3,
    time_window: 60,
    sleep_window: 10

  def repo_stats(owner, repo)
    circuit(:github).run do
      response = connection.get("/repos/#{owner}/#{repo}")
      JSON.parse(response.body)
    end
  rescue Circuitbox::OpenCircuitError
    # Return cached/fallback data
    { stars: "N/A", forks: "N/A", cached: true }
  end
end`,
							highlight: [4, 5, 6, 7, 8, 17, 18, 19],
						},
					]}
					learningGoal="Circuit Breakers prevent cascading failures. When external services are slow, fail fast and return fallback data."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level13ExternalAPIs;

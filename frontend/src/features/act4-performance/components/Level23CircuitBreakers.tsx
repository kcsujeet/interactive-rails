/**
 * Level 23: Circuit Breakers (Advanced)
 *
 * Isolate failures between services.
 * Shows state machine: Closed → Open → Half-Open.
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

type CircuitState = 'closed' | 'open' | 'half_open';

interface ServiceHealth {
	name: string;
	circuit: CircuitState;
	failureCount: number;
	successCount: number;
	lastError: string | null;
}

export function Level23CircuitBreakers({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [circuitEnabled, setCircuitEnabled] = useState(false);
	const [recsService, setRecsService] = useState<ServiceHealth>({
		name: 'Recommendations',
		circuit: 'closed',
		failureCount: 0,
		successCount: 0,
		lastError: null,
	});
	const [feedService, setFeedService] = useState<ServiceHealth>({
		name: 'Feed',
		circuit: 'closed',
		failureCount: 0,
		successCount: 0,
		lastError: null,
	});
	const [feedFailures, setFeedFailures] = useState(0);
	const [feedSuccesses, setFeedSuccesses] = useState(0);
	const [isRecsFlaky, setIsRecsFlaky] = useState(true);

	const handleValidate = useCallback((): ValidationResult => {
		if (!circuitEnabled) {
			return { valid: false, message: 'Enable circuit breakers', details: ['Click "Enable Circuit Breakers" to isolate failures'] };
		}
		if (recsService.circuit !== 'open') {
			return { valid: false, message: 'Wait for circuit to open', details: ['The circuit needs to detect Recommendations failures and open'] };
		}
		if (feedFailures > 0) {
			return { valid: false, message: 'Feed has failures', details: ['Reset and try again — Feed should have zero failures with circuit breakers'] };
		}
		if (feedSuccesses < 5) {
			return { valid: false, message: 'Need more successes', details: [`Wait for Feed to handle more requests (${feedSuccesses}/5)`] };
		}
		return { valid: true, message: 'Circuit breakers isolate the failure! Feed stays healthy.' };
	}, [circuitEnabled, recsService.circuit, feedFailures, feedSuccesses]);

	// Simulate requests to the services
	const makeRequest = useCallback(() => {
		// Recs service is flaky - 80% failure rate
		const recsWillFail = isRecsFlaky && Math.random() < 0.8;

		if (circuitEnabled) {
			// Check circuit state for recommendations
			if (recsService.circuit === 'open') {
				// Circuit open - fail fast, feed still works
				setFeedSuccesses((s) => s + 1);
				setFeedService((prev) => ({
					...prev,
					successCount: prev.successCount + 1,
					lastError: null,
				}));
				return;
			}

			if (recsService.circuit === 'half_open') {
				// Try one request
				if (recsWillFail) {
					// Still failing, reopen
					setRecsService((prev) => ({
						...prev,
						circuit: 'open',
						failureCount: prev.failureCount + 1,
						lastError: 'Service timeout',
					}));
					// Schedule transition to half-open
					setTimeout(() => {
						setRecsService((prev) => ({ ...prev, circuit: 'half_open' }));
					}, 3000);
				} else {
					// Success! Close circuit
					setRecsService((prev) => ({
						...prev,
						circuit: 'closed',
						failureCount: 0,
						successCount: prev.successCount + 1,
						lastError: null,
					}));
				}
				setFeedSuccesses((s) => s + 1);
				return;
			}
		}

		// Normal flow - if recs fails
		if (recsWillFail) {
			setRecsService((prev) => {
				const newFailures = prev.failureCount + 1;
				if (circuitEnabled && newFailures >= 3) {
					// Open the circuit
					setTimeout(() => {
						setRecsService((p) => ({ ...p, circuit: 'half_open' }));
					}, 3000);
					return {
						...prev,
						circuit: 'open',
						failureCount: newFailures,
						lastError: 'Service timeout',
					};
				}
				return {
					...prev,
					failureCount: newFailures,
					lastError: 'Service timeout',
				};
			});

			if (!circuitEnabled) {
				// Without circuit breaker, feed also fails
				setFeedFailures((f) => f + 1);
				setFeedService((prev) => ({
					...prev,
					failureCount: prev.failureCount + 1,
					lastError: 'Dependency failed: Recommendations',
				}));
			} else {
				// With circuit breaker, feed gracefully degrades
				setFeedSuccesses((s) => s + 1);
			}
		} else {
			// Success
			setRecsService((prev) => ({
				...prev,
				failureCount: 0,
				successCount: prev.successCount + 1,
				lastError: null,
			}));
			setFeedSuccesses((s) => s + 1);
			setFeedService((prev) => ({
				...prev,
				successCount: prev.successCount + 1,
				lastError: null,
			}));
		}
	}, [circuitEnabled, recsService.circuit, isRecsFlaky]);

	useEffect(() => {
		const interval = setInterval(makeRequest, 800);
		return () => clearInterval(interval);
	}, [makeRequest]);

	const handleComplete = async () => {
		const success = await completeLevel('act4-level23-circuit-breakers', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getCircuitColor = (state: CircuitState) => {
		switch (state) {
			case 'closed':
				return 'green';
			case 'open':
				return 'red';
			case 'half_open':
				return 'yellow';
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn advanced circuit breaker patterns for fault isolation."
					instructions={[
						'Watch the Feed service fail when Recommendations fails',
						'Enable Circuit Breakers',
						'See Feed stay healthy by returning without recommendations',
					]}
					scenario="The Recommendations service is flaky and times out randomly. When it fails, the entire Feed service fails too - users see nothing!"
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								circuitEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={circuitEnabled}
							onClick={() => setCircuitEnabled(true)}
						>
							{circuitEnabled
								? 'Circuit Breakers Enabled'
								: 'Enable Circuit Breakers'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Feed Service Health
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-success/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-success">
									{feedSuccesses}
								</div>
								<div className="text-xs text-success/70">Successes</div>
							</div>
							<div
								className={`rounded-lg p-3 text-center ${
									feedFailures > 0 ? 'bg-destructive/20' : 'bg-card'
								}`}
							>
								<div
									className={`text-2xl font-bold ${feedFailures > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
								>
									{feedFailures}
								</div>
								<div className="text-xs text-muted-foreground">Failures</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Circuit Breakers"
					levelNumber={23}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setCircuitEnabled(false);
						setRecsService({
							name: 'Recommendations',
							circuit: 'closed',
							failureCount: 0,
							successCount: 0,
							lastError: null,
						});
						setFeedService({
							name: 'Feed',
							circuit: 'closed',
							failureCount: 0,
							successCount: 0,
							lastError: null,
						});
						setFeedFailures(0);
						setFeedSuccesses(0);
					}}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Service Architecture */}
					<div className="flex items-center justify-center gap-8 mb-8">
						{/* Feed Service */}
						<div
							className={`border-2 rounded-xl p-6 w-48 transition-colors ${
								feedService.lastError
									? 'border-destructive bg-destructive/10'
									: 'border-success bg-success/10'
							}`}
						>
							<div
								className={`font-medium mb-2 ${
									feedService.lastError ? 'text-destructive' : 'text-success'
								}`}
							>
								Feed Service
							</div>
							<div className="text-xs text-muted-foreground">
								{feedService.lastError || 'Healthy'}
							</div>
						</div>

						<div className="text-muted-foreground">→</div>

						{/* Circuit Breaker (if enabled) */}
						{circuitEnabled && (
							<>
								<div
									className={`border-2 rounded-full p-4 w-24 h-24 flex flex-col items-center justify-center transition-colors ${
										getCircuitColor(recsService.circuit) === 'green'
											? 'border-success bg-success/10'
											: getCircuitColor(recsService.circuit) === 'red'
												? 'border-destructive bg-destructive/10'
												: 'border-warning bg-warning/10'
									}`}
								>
									<div
										className={`text-xs font-medium mb-1 ${
											getCircuitColor(recsService.circuit) === 'green'
												? 'text-success'
												: getCircuitColor(recsService.circuit) === 'red'
													? 'text-destructive'
													: 'text-warning'
										}`}
									>
										Circuit
									</div>
									<div
										className={`text-xs capitalize ${
											getCircuitColor(recsService.circuit) === 'green'
												? 'text-success'
												: getCircuitColor(recsService.circuit) === 'red'
													? 'text-destructive'
													: 'text-warning'
										}`}
									>
										{recsService.circuit.replace('_', '-')}
									</div>
								</div>

								<div className="text-muted-foreground">→</div>
							</>
						)}

						{/* Recommendations Service */}
						<div
							className={`border-2 rounded-xl p-6 w-48 transition-colors ${
								recsService.lastError
									? 'border-destructive bg-destructive/10'
									: 'border-success bg-success/10'
							}`}
						>
							<div
								className={`font-medium mb-2 ${
									recsService.lastError ? 'text-destructive' : 'text-success'
								}`}
							>
								Recommendations
							</div>
							<div className="text-xs text-muted-foreground">
								{recsService.lastError || 'Healthy'}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								Failures: {recsService.failureCount}
							</div>
						</div>
					</div>

					{/* Circuit State Machine */}
					{circuitEnabled && (
						<div className="bg-card rounded-xl p-4 max-w-md mx-auto">
							<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
								Circuit State Machine
							</div>
							<div className="flex items-center justify-between">
								<div
									className={`text-center p-2 rounded ${
										recsService.circuit === 'closed'
											? 'bg-success/30 text-success'
											: 'text-muted-foreground'
									}`}
								>
									<div className="text-sm font-medium">Closed</div>
									<div className="text-xs">Normal</div>
								</div>
								<div className="text-muted-foreground">→</div>
								<div
									className={`text-center p-2 rounded ${
										recsService.circuit === 'open'
											? 'bg-destructive/30 text-destructive'
											: 'text-muted-foreground'
									}`}
								>
									<div className="text-sm font-medium">Open</div>
									<div className="text-xs">Fail Fast</div>
								</div>
								<div className="text-muted-foreground">→</div>
								<div
									className={`text-center p-2 rounded ${
										recsService.circuit === 'half_open'
											? 'bg-warning/30 text-warning'
											: 'text-muted-foreground'
									}`}
								>
									<div className="text-sm font-medium">Half-Open</div>
									<div className="text-xs">Test</div>
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
							filename: 'app/services/feed_service.rb',
							language: 'ruby',
							code: `class FeedService
  def call(user)
    posts = Post.for_feed(user)

    # Circuit breaker protects against flaky service
    recommendations = circuit.run(
      fallback: -> { [] }
    ) do
      RecommendationsClient.for_user(user)
    end

    {
      posts: posts,
      recommendations: recommendations
    }
  end

  private

  def circuit
    Circuitbox.circuit(:recommendations,
      exceptions: [Timeout::Error, Faraday::Error],
      threshold: 3,        # Opens after 3 failures
      time_window: 60,     # Within 60 seconds
      sleep_window: 10     # Stays open for 10 seconds
    )
  end
end`,
							highlight: [6, 7, 8, 9, 10, 20, 21, 22, 23, 24, 25],
						},
					]}
					learningGoal="Circuit breakers isolate failures. When a dependency is unhealthy, fail fast and return fallback data instead of cascading the failure."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level23CircuitBreakers;

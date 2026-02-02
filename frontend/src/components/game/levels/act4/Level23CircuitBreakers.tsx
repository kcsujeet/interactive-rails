/**
 * Level 23: Circuit Breakers (Advanced)
 *
 * Isolate failures between services.
 * Shows state machine: Closed → Open → Half-Open.
 */

import { useState, useEffect, useCallback } from 'react';
import type { LevelComponentProps } from '../index';
import {
  LevelLayout,
  LeftPanel,
  CenterPanel,
  RightPanel,
  LevelHeader,
  InstructionPanel,
  CodePreviewPanel,
  useLevelCompletion,
} from '../shared';

type CircuitState = 'closed' | 'open' | 'half_open';

interface ServiceHealth {
  name: string;
  circuit: CircuitState;
  failureCount: number;
  successCount: number;
  lastError: string | null;
}

export function Level23CircuitBreakers({ onComplete, onExit }: LevelComponentProps) {
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

  const isComplete = circuitEnabled && recsService.circuit === 'open' && feedFailures === 0 && feedSuccesses >= 5;

  // Simulate requests to the services
  const makeRequest = useCallback(() => {
    // Recs service is flaky - 80% failure rate
    const recsWillFail = isRecsFlaky && Math.random() < 0.8;

    if (circuitEnabled) {
      // Check circuit state for recommendations
      if (recsService.circuit === 'open') {
        // Circuit open - fail fast, feed still works
        setFeedSuccesses(s => s + 1);
        setFeedService(prev => ({
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
          setRecsService(prev => ({
            ...prev,
            circuit: 'open',
            failureCount: prev.failureCount + 1,
            lastError: 'Service timeout',
          }));
          // Schedule transition to half-open
          setTimeout(() => {
            setRecsService(prev => ({ ...prev, circuit: 'half_open' }));
          }, 3000);
        } else {
          // Success! Close circuit
          setRecsService(prev => ({
            ...prev,
            circuit: 'closed',
            failureCount: 0,
            successCount: prev.successCount + 1,
            lastError: null,
          }));
        }
        setFeedSuccesses(s => s + 1);
        return;
      }
    }

    // Normal flow - if recs fails
    if (recsWillFail) {
      setRecsService(prev => {
        const newFailures = prev.failureCount + 1;
        if (circuitEnabled && newFailures >= 3) {
          // Open the circuit
          setTimeout(() => {
            setRecsService(p => ({ ...p, circuit: 'half_open' }));
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
        setFeedFailures(f => f + 1);
        setFeedService(prev => ({
          ...prev,
          failureCount: prev.failureCount + 1,
          lastError: 'Dependency failed: Recommendations',
        }));
      } else {
        // With circuit breaker, feed gracefully degrades
        setFeedSuccesses(s => s + 1);
      }
    } else {
      // Success
      setRecsService(prev => ({
        ...prev,
        failureCount: 0,
        successCount: prev.successCount + 1,
        lastError: null,
      }));
      setFeedSuccesses(s => s + 1);
      setFeedService(prev => ({
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
    const success = await completeLevel('act4-level23-circuit-breakers', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getCircuitColor = (state: CircuitState) => {
    switch (state) {
      case 'closed': return 'green';
      case 'open': return 'red';
      case 'half_open': return 'yellow';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The Recommendations service is flaky and times out randomly. When it fails, the entire Feed service fails too - users see nothing!"
          instructions={[
            'Watch the Feed service fail when Recommendations fails',
            'Enable Circuit Breakers',
            'See Feed stay healthy by returning without recommendations',
          ]}
          goal="Learn advanced circuit breaker patterns for fault isolation."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setCircuitEnabled(true)}
              disabled={circuitEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                circuitEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {circuitEnabled ? 'Circuit Breakers Enabled' : 'Enable Circuit Breakers'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Feed Service Health
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{feedSuccesses}</div>
                <div className="text-xs text-green-400/70">Successes</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                feedFailures > 0 ? 'bg-red-900/30' : 'bg-gray-800'
              }`}>
                <div className={`text-2xl font-bold ${feedFailures > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {feedFailures}
                </div>
                <div className="text-xs text-gray-400">Failures</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={23}
          levelName="Circuit Breakers"
          actNumber={4}
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
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Service Architecture */}
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Feed Service */}
            <div className={`border-2 rounded-xl p-6 w-48 transition-colors ${
              feedService.lastError ? 'border-red-500 bg-red-900/20' : 'border-green-500 bg-green-900/20'
            }`}>
              <div className={`font-medium mb-2 ${
                feedService.lastError ? 'text-red-400' : 'text-green-400'
              }`}>
                Feed Service
              </div>
              <div className="text-xs text-gray-400">
                {feedService.lastError || 'Healthy'}
              </div>
            </div>

            <div className="text-gray-600">→</div>

            {/* Circuit Breaker (if enabled) */}
            {circuitEnabled && (
              <>
                <div className={`border-2 rounded-full p-4 w-24 h-24 flex flex-col items-center justify-center transition-colors`}
                  style={{
                    borderColor: getCircuitColor(recsService.circuit) === 'green' ? '#22c55e' :
                                 getCircuitColor(recsService.circuit) === 'red' ? '#ef4444' : '#eab308',
                    backgroundColor: getCircuitColor(recsService.circuit) === 'green' ? 'rgba(34, 197, 94, 0.1)' :
                                     getCircuitColor(recsService.circuit) === 'red' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                  }}
                >
                  <div className="text-xs font-medium mb-1"
                    style={{
                      color: getCircuitColor(recsService.circuit) === 'green' ? '#22c55e' :
                             getCircuitColor(recsService.circuit) === 'red' ? '#ef4444' : '#eab308',
                    }}
                  >
                    Circuit
                  </div>
                  <div className="text-xs capitalize"
                    style={{
                      color: getCircuitColor(recsService.circuit) === 'green' ? '#22c55e' :
                             getCircuitColor(recsService.circuit) === 'red' ? '#ef4444' : '#eab308',
                    }}
                  >
                    {recsService.circuit.replace('_', '-')}
                  </div>
                </div>

                <div className="text-gray-600">→</div>
              </>
            )}

            {/* Recommendations Service */}
            <div className={`border-2 rounded-xl p-6 w-48 transition-colors ${
              recsService.lastError ? 'border-red-500 bg-red-900/20' : 'border-green-500 bg-green-900/20'
            }`}>
              <div className={`font-medium mb-2 ${
                recsService.lastError ? 'text-red-400' : 'text-green-400'
              }`}>
                Recommendations
              </div>
              <div className="text-xs text-gray-400">
                {recsService.lastError || 'Healthy'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Failures: {recsService.failureCount}
              </div>
            </div>
          </div>

          {/* Circuit State Machine */}
          {circuitEnabled && (
            <div className="bg-gray-900 rounded-xl p-4 max-w-md mx-auto">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Circuit State Machine</div>
              <div className="flex items-center justify-between">
                <div className={`text-center p-2 rounded ${
                  recsService.circuit === 'closed' ? 'bg-green-900/50 text-green-400' : 'text-gray-600'
                }`}>
                  <div className="text-sm font-medium">Closed</div>
                  <div className="text-xs">Normal</div>
                </div>
                <div className="text-gray-600">→</div>
                <div className={`text-center p-2 rounded ${
                  recsService.circuit === 'open' ? 'bg-red-900/50 text-red-400' : 'text-gray-600'
                }`}>
                  <div className="text-sm font-medium">Open</div>
                  <div className="text-xs">Fail Fast</div>
                </div>
                <div className="text-gray-600">→</div>
                <div className={`text-center p-2 rounded ${
                  recsService.circuit === 'half_open' ? 'bg-yellow-900/50 text-yellow-400' : 'text-gray-600'
                }`}>
                  <div className="text-sm font-medium">Half-Open</div>
                  <div className="text-xs">Test</div>
                </div>
              </div>
            </div>
          )}

          {/* Completion button */}
          {isComplete && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-lg shadow-lg"
              >
                Complete Level
              </button>
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
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
          }]}
          learningGoal="Circuit breakers isolate failures. When a dependency is unhealthy, fail fast and return fallback data instead of cascading the failure."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level23CircuitBreakers;

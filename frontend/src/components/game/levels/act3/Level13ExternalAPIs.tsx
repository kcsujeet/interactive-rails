/**
 * Level 13: External APIs
 *
 * Handle external API timeouts with Circuit Breaker pattern.
 * Shows graceful degradation when services are slow.
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

type CircuitState = 'closed' | 'open' | 'half-open';

interface APICall {
  id: number;
  status: 'pending' | 'success' | 'timeout' | 'fallback';
  latency: number;
}

export function Level13ExternalAPIs({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [circuitBreakerEnabled, setCircuitBreakerEnabled] = useState(false);
  const [circuitState, setCircuitState] = useState<CircuitState>('closed');
  const [apiCalls, setApiCalls] = useState<APICall[]>([]);
  const [failureCount, setFailureCount] = useState(0);
  const [timeoutsSeen, setTimeoutsSeen] = useState(0);
  const [fallbacksSeen, setFallbacksSeen] = useState(0);

  const isComplete = circuitBreakerEnabled && fallbacksSeen >= 3;

  const simulateAPICall = useCallback(() => {
    const id = Date.now();
    const willTimeout = Math.random() < 0.6; // 60% chance of timeout
    const latency = willTimeout ? 5000 : Math.random() * 200 + 50;

    setApiCalls(prev => [...prev.slice(-8), { id, status: 'pending', latency }]);

    // Simulate the call
    setTimeout(() => {
      setApiCalls(prev => prev.map(call => {
        if (call.id !== id) return call;

        if (circuitBreakerEnabled && circuitState === 'open') {
          setFallbacksSeen(c => c + 1);
          return { ...call, status: 'fallback', latency: 5 };
        }

        if (willTimeout) {
          if (circuitBreakerEnabled) {
            setFailureCount(c => {
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
          setTimeoutsSeen(c => c + 1);
          return { ...call, status: 'timeout', latency: 5000 };
        }

        setFailureCount(0);
        return { ...call, status: 'success', latency };
      }));
    }, circuitBreakerEnabled && circuitState === 'open' ? 50 : (willTimeout ? 2000 : latency));
  }, [circuitBreakerEnabled, circuitState]);

  // Auto-trigger API calls
  useEffect(() => {
    const interval = setInterval(simulateAPICall, 1500);
    return () => clearInterval(interval);
  }, [simulateAPICall]);

  const handleComplete = async () => {
    const success = await completeLevel('act3-level13-third-party-apis', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getStateColor = (state: CircuitState) => {
    switch (state) {
      case 'closed': return '#22c55e';
      case 'open': return '#ef4444';
      case 'half-open': return '#f59e0b';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The app calls GitHub's API to show repo stats. Sometimes GitHub is slow (5+ seconds), and users see a spinning loader. The whole page hangs!"
          instructions={[
            'Watch API calls timeout (red) - each hangs the request',
            'Enable the Circuit Breaker pattern',
            'See fallbacks return instantly when circuit is open',
          ]}
          goal="Learn the Circuit Breaker pattern for resilient external API calls."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setCircuitBreakerEnabled(true)}
              disabled={circuitBreakerEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                circuitBreakerEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {circuitBreakerEnabled ? 'Circuit Breaker Enabled' : 'Enable Circuit Breaker'}
            </button>
          </div>

          {circuitBreakerEnabled && (
            <div className="p-4 border-t border-gray-800">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Circuit State</div>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: getStateColor(circuitState) }}
                />
                <span className="text-white font-medium capitalize">{circuitState}</span>
              </div>
              <div className="text-gray-500 text-xs mt-2">
                {circuitState === 'closed' && 'Normal operation - requests go through'}
                {circuitState === 'open' && 'Failing fast - returning fallback immediately'}
                {circuitState === 'half-open' && 'Testing - allowing one request through'}
              </div>
              <div className="mt-3 text-gray-400 text-sm">
                Failures: {failureCount} / 3
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{timeoutsSeen}</div>
                <div className="text-xs text-red-400/70">Timeouts</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{fallbacksSeen}</div>
                <div className="text-xs text-purple-400/70">Fallbacks</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={13}
          levelName="External APIs"
          actNumber={3}
          onExit={onExit}
          onReset={() => {
            setCircuitBreakerEnabled(false);
            setCircuitState('closed');
            setApiCalls([]);
            setFailureCount(0);
            setTimeoutsSeen(0);
            setFallbacksSeen(0);
          }}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Architecture diagram */}
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* App */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-40 text-center">
              <div className="text-4xl mb-2">A</div>
              <div className="text-gray-400 text-sm">Your App</div>
            </div>

            {/* Circuit Breaker */}
            {circuitBreakerEnabled && (
              <>
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>

                <div
                  className="border-2 rounded-xl p-4 w-32 text-center transition-colors"
                  style={{ borderColor: getStateColor(circuitState), backgroundColor: `${getStateColor(circuitState)}20` }}
                >
                  <div className="text-2xl mb-1">CB</div>
                  <div className="text-xs capitalize" style={{ color: getStateColor(circuitState) }}>
                    {circuitState}
                  </div>
                </div>
              </>
            )}

            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>

            {/* GitHub API */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-40 text-center">
              <div className="text-4xl mb-2">GH</div>
              <div className="text-gray-400 text-sm">GitHub API</div>
              <div className="text-red-400 text-xs mt-1">Sometimes slow!</div>
            </div>
          </div>

          {/* API Call Log */}
          <div className="bg-gray-900 rounded-xl p-4 max-w-2xl mx-auto">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">API Call Log</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {apiCalls.map(call => (
                <div
                  key={call.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    call.status === 'pending' ? 'bg-gray-800' :
                    call.status === 'success' ? 'bg-green-900/30' :
                    call.status === 'timeout' ? 'bg-red-900/30' :
                    'bg-purple-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'pending' ? 'bg-gray-500 animate-pulse' :
                      call.status === 'success' ? 'bg-green-500' :
                      call.status === 'timeout' ? 'bg-red-500' :
                      'bg-purple-500'
                    }`} />
                    <span className="text-gray-300 font-mono text-sm">
                      GET /repos/rails/rails
                    </span>
                  </div>
                  <div className="text-sm">
                    {call.status === 'pending' && (
                      <span className="text-gray-500">Loading...</span>
                    )}
                    {call.status === 'success' && (
                      <span className="text-green-400">{Math.round(call.latency)}ms</span>
                    )}
                    {call.status === 'timeout' && (
                      <span className="text-red-400">5000ms TIMEOUT</span>
                    )}
                    {call.status === 'fallback' && (
                      <span className="text-purple-400">5ms (fallback)</span>
                    )}
                  </div>
                </div>
              ))}
              {apiCalls.length === 0 && (
                <div className="text-gray-600 text-center py-4">Waiting for API calls...</div>
              )}
            </div>
          </div>

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
          }]}
          learningGoal="Circuit Breakers prevent cascading failures. When external services are slow, fail fast and return fallback data."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level13ExternalAPIs;

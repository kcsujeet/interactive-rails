/**
 * Level 22: External APIs
 *
 * Handle third-party API integrations with proper error handling.
 * Player learns timeouts, retries, and circuit breakers.
 */

import { useState, useEffect } from 'react';
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
  type ValidationResult,
} from '../shared';

interface APIConfig {
  timeout: boolean;
  retries: boolean;
  circuitBreaker: boolean;
  fallback: boolean;
}

interface APICall {
  id: number;
  status: 'pending' | 'success' | 'timeout' | 'error' | 'circuit-open' | 'fallback';
  duration: number;
  retryCount: number;
}

export function Level22ExternalAPIs({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<APIConfig>({
    timeout: false,
    retries: false,
    circuitBreaker: false,
    fallback: false,
  });
  const [calls, setCalls] = useState<APICall[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [circuitState, setCircuitState] = useState<'closed' | 'open' | 'half-open'>('closed');

  const successfulCalls = calls.filter(c => c.status === 'success' || c.status === 'fallback').length;
  const failedCalls = calls.filter(c => c.status === 'timeout' || c.status === 'error').length;

  // Simulate API calls
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const call: APICall = {
        id: Date.now(),
        status: 'pending',
        duration: 0,
        retryCount: 0,
      };

      // Simulate unreliable API (50% chance of slow/failure)
      const isAPIUnreliable = Math.random() < 0.5;
      const responseTime = isAPIUnreliable ? 5000 + Math.random() * 5000 : 100 + Math.random() * 200;

      // Circuit breaker logic
      if (config.circuitBreaker && circuitState === 'open') {
        if (config.fallback) {
          call.status = 'fallback';
          call.duration = 1;
        } else {
          call.status = 'circuit-open';
          call.duration = 0;
        }
        setCalls(prev => [...prev.slice(-19), call]);
        return;
      }

      // Timeout logic
      if (config.timeout && responseTime > 3000) {
        call.duration = 3000;

        // Retry logic
        if (config.retries) {
          call.retryCount = 2;
          // After retries, still timeout
          if (config.fallback) {
            call.status = 'fallback';
          } else {
            call.status = 'timeout';
            setConsecutiveFailures(prev => prev + 1);
          }
        } else {
          if (config.fallback) {
            call.status = 'fallback';
          } else {
            call.status = 'timeout';
            setConsecutiveFailures(prev => prev + 1);
          }
        }
      } else if (!config.timeout && responseTime > 3000) {
        // No timeout - request hangs
        call.duration = responseTime;
        call.status = isAPIUnreliable ? 'error' : 'success';
        if (call.status === 'error') {
          setConsecutiveFailures(prev => prev + 1);
        } else {
          setConsecutiveFailures(0);
        }
      } else {
        call.duration = Math.round(responseTime);
        call.status = 'success';
        setConsecutiveFailures(0);
      }

      setCalls(prev => [...prev.slice(-19), call]);
    }, 500);

    return () => clearInterval(interval);
  }, [isSimulating, config, circuitState]);

  // Circuit breaker state management
  useEffect(() => {
    if (!config.circuitBreaker) {
      setCircuitState('closed');
      return;
    }

    if (consecutiveFailures >= 3 && circuitState === 'closed') {
      setCircuitState('open');
      // Auto-reset to half-open after 5 seconds
      setTimeout(() => setCircuitState('half-open'), 5000);
    }

    if (circuitState === 'half-open') {
      // Next successful call closes circuit
      const lastCall = calls[calls.length - 1];
      if (lastCall?.status === 'success') {
        setCircuitState('closed');
        setConsecutiveFailures(0);
      } else if (lastCall?.status === 'timeout' || lastCall?.status === 'error') {
        setCircuitState('open');
        setTimeout(() => setCircuitState('half-open'), 5000);
      }
    }
  }, [consecutiveFailures, circuitState, config.circuitBreaker, calls]);

  const toggleConfig = (key: keyof APIConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const validateSolution = (): ValidationResult => {
    const enabledCount = Object.values(config).filter(Boolean).length;
    if (enabledCount < 3) {
      return {
        valid: false,
        message: 'Enable more resilience patterns!',
        details: ['Configure at least 3 patterns for robust API handling'],
      };
    }
    return { valid: true, message: 'Resilient API integration configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level22-external-apis', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getStatusColor = (status: APICall['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'fallback': return 'text-yellow-400';
      case 'timeout': return 'text-red-400';
      case 'error': return 'text-red-400';
      case 'circuit-open': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your app integrates with Stripe for payments. But sometimes Stripe is slow or down. Without proper handling, your entire checkout breaks. Time to build resilience!"
          instructions={[
            'Timeout: Don\'t wait forever',
            'Retries: Try again on failure',
            'Circuit Breaker: Stop trying when down',
            'Fallback: Graceful degradation',
          ]}
          goal="Build resilient API integrations that handle failures gracefully."
        >
          {/* Circuit Breaker State */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Circuit Breaker State
            </div>
            <div className={`text-center p-4 rounded-lg border-2 ${
              circuitState === 'closed' ? 'border-green-500 bg-green-900/20' :
              circuitState === 'open' ? 'border-red-500 bg-red-900/20' :
              'border-yellow-500 bg-yellow-900/20'
            }`}>
              <div className={`text-2xl font-bold ${
                circuitState === 'closed' ? 'text-green-400' :
                circuitState === 'open' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {circuitState.toUpperCase()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {circuitState === 'closed' ? 'Requests flowing normally' :
                 circuitState === 'open' ? 'Requests blocked' : 'Testing if service recovered'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`w-full py-2 rounded-lg font-medium transition-all ${
                isSimulating
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isSimulating ? 'Stop Simulation' : 'Start API Calls'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Patterns enabled</span>
              <span className={Object.values(config).filter(Boolean).length >= 3 ? 'text-green-400' : 'text-white'}>
                {Object.values(config).filter(Boolean).length} / 4
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={22}
          levelName="External APIs"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setConfig({ timeout: false, retries: false, circuitBreaker: false, fallback: false });
            setCalls([]);
            setConsecutiveFailures(0);
            setCircuitState('closed');
            setIsSimulating(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Configuration Panel */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { key: 'timeout', name: 'Timeout', icon: '⏱️', desc: '3 second limit' },
                { key: 'retries', name: 'Retries', icon: '🔄', desc: 'Retry 2x on failure' },
                { key: 'circuitBreaker', name: 'Circuit Breaker', icon: '🔌', desc: 'Stop after 3 failures' },
                { key: 'fallback', name: 'Fallback', icon: '🛡️', desc: 'Return cached/default' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => toggleConfig(item.key as keyof APIConfig)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    config[item.key as keyof APIConfig]
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className={`font-semibold ${config[item.key as keyof APIConfig] ? 'text-green-400' : 'text-white'}`}>
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </button>
              ))}
            </div>

            {/* API Flow Diagram */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Request Flow</div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                      <span className="text-2xl">🖥️</span>
                    </div>
                    <div className="text-xs text-gray-400">Your App</div>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <div className={`h-1 flex-1 ${config.timeout ? 'bg-green-500' : 'bg-gray-600'}`} />
                    {config.timeout && (
                      <div className="px-2 py-1 bg-green-900/40 rounded text-xs text-green-400 mx-2">
                        ⏱️ 3s
                      </div>
                    )}
                    {config.retries && (
                      <div className="px-2 py-1 bg-blue-900/40 rounded text-xs text-blue-400 mx-2">
                        🔄 x2
                      </div>
                    )}
                    {config.circuitBreaker && (
                      <div className={`px-2 py-1 rounded text-xs mx-2 ${
                        circuitState === 'closed' ? 'bg-green-900/40 text-green-400' :
                        circuitState === 'open' ? 'bg-red-900/40 text-red-400' :
                        'bg-yellow-900/40 text-yellow-400'
                      }`}>
                        🔌 {circuitState}
                      </div>
                    )}
                    <div className={`h-1 flex-1 ${config.fallback ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                      <span className="text-2xl">💳</span>
                    </div>
                    <div className="text-xs text-gray-400">Stripe API</div>
                    <div className="text-xs text-red-400">50% unreliable</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                <div className="text-white font-semibold">API Call Log</div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-400">✓ {successfulCalls}</span>
                  <span className="text-red-400">✗ {failedCalls}</span>
                </div>
              </div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
                {calls.length === 0 ? (
                  <div className="text-gray-600 text-center py-8">
                    Start simulation to see API calls...
                  </div>
                ) : (
                  calls.map(call => (
                    <div key={call.id} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        call.status === 'success' ? 'bg-green-400' :
                        call.status === 'fallback' ? 'bg-yellow-400' : 'bg-red-400'
                      }`} />
                      <span className={getStatusColor(call.status)}>
                        {call.status.toUpperCase()}
                      </span>
                      <span className="text-gray-500">{call.duration}ms</span>
                      {call.retryCount > 0 && (
                        <span className="text-blue-400">({call.retryCount} retries)</span>
                      )}
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
              filename: 'app/services/stripe_client.rb',
              language: 'ruby',
              code: `class StripeClient
  include Circuitbox

  circuit_breaker :stripe,
    exceptions: [Faraday::TimeoutError],
    time_window: 60,
    error_threshold: 3,
    timeout_seconds: 30

  def charge(amount)
    circuit_breaker.run do
      connection.post("/charges", {
        amount: amount
      })
    end
  rescue Circuitbox::OpenCircuitError
    # Fallback to manual processing
    ManualChargeJob.perform_later(amount)
    { status: "pending" }
  end

  private

  def connection
    Faraday.new do |f|
      f.options.timeout = 3  # seconds
      f.request :retry, max: 2
    end
  end
end`,
              highlight: config.timeout ? [21] : [],
            },
          ]}
          learningGoal="External APIs will fail. Design for failure with timeouts, retries, circuit breakers, and fallbacks."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Best Practices</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Always set timeouts (3-10s)</li>
              <li>• Retry with exponential backoff</li>
              <li>• Use circuit breakers for cascading failures</li>
              <li>• Have fallbacks for critical paths</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Gems</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• faraday - HTTP client</li>
              <li>• circuitbox - Circuit breaker</li>
              <li>• retriable - Retry logic</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level22ExternalAPIs;

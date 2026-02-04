/**
 * Level 22: External APIs
 *
 * Handle third-party API integrations with proper error handling.
 * Player learns timeouts, retries, and circuit breakers.
 */

import { useState, useEffect } from 'react';
import type { LevelComponentProps } from '../index';
import { Button } from '../../../ui/Button';
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
      case 'success': return 'text-success';
      case 'fallback': return 'text-warning';
      case 'timeout': return 'text-destructive';
      case 'error': return 'text-destructive';
      case 'circuit-open': return 'text-warning';
      default: return 'text-muted-foreground';
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
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Circuit Breaker State
            </div>
            <div className={`text-center p-4 rounded-lg border-2 ${
              circuitState === 'closed' ? 'border-success bg-success/10' :
              circuitState === 'open' ? 'border-destructive bg-destructive/10' :
              'border-warning bg-warning/10'
            }`}>
              <div className={`text-2xl font-bold ${
                circuitState === 'closed' ? 'text-success' :
                circuitState === 'open' ? 'text-destructive' : 'text-warning'
              }`}>
                {circuitState.toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {circuitState === 'closed' ? 'Requests flowing normally' :
                 circuitState === 'open' ? 'Requests blocked' : 'Testing if service recovered'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <Button
              onClick={() => setIsSimulating(!isSimulating)}
              variant={isSimulating ? 'destructive' : 'default'}
              className="w-full py-2"
            >
              {isSimulating ? 'Stop Simulation' : 'Start API Calls'}
            </Button>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Patterns enabled</span>
              <span className={Object.values(config).filter(Boolean).length >= 3 ? 'text-success' : 'text-foreground'}>
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

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Configuration Panel */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { key: 'timeout', name: 'Timeout', icon: '⏱️', desc: '3 second limit' },
                { key: 'retries', name: 'Retries', icon: '🔄', desc: 'Retry 2x on failure' },
                { key: 'circuitBreaker', name: 'Circuit Breaker', icon: '🔌', desc: 'Stop after 3 failures' },
                { key: 'fallback', name: 'Fallback', icon: '🛡️', desc: 'Return cached/default' },
              ].map(item => (
                <Button
                  key={item.key}
                  onClick={() => toggleConfig(item.key as keyof APIConfig)}
                  variant="ghost"
                  className={`p-4 h-auto flex-col rounded-xl border-2 transition-all ${
                    config[item.key as keyof APIConfig]
                      ? 'border-success bg-success/10'
                      : 'border-border bg-card hover:border-muted-foreground'
                  }`}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className={`font-semibold ${config[item.key as keyof APIConfig] ? 'text-success' : 'text-foreground'}`}>
                    {item.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </Button>
              ))}
            </div>

            {/* API Flow Diagram */}
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Request Flow</div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-2">
                      <span className="text-2xl">🖥️</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Your App</div>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <div className={`h-1 flex-1 ${config.timeout ? 'bg-success' : 'bg-border'}`} />
                    {config.timeout && (
                      <div className="px-2 py-1 bg-success/20 rounded text-xs text-success mx-2">
                        ⏱️ 3s
                      </div>
                    )}
                    {config.retries && (
                      <div className="px-2 py-1 bg-primary/20 rounded text-xs text-primary mx-2">
                        🔄 x2
                      </div>
                    )}
                    {config.circuitBreaker && (
                      <div className={`px-2 py-1 rounded text-xs mx-2 ${
                        circuitState === 'closed' ? 'bg-success/20 text-success' :
                        circuitState === 'open' ? 'bg-destructive/20 text-destructive' :
                        'bg-warning/20 text-warning'
                      }`}>
                        🔌 {circuitState}
                      </div>
                    )}
                    <div className={`h-1 flex-1 ${config.fallback ? 'bg-warning' : 'bg-border'}`} />
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-2">
                      <span className="text-2xl">💳</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Stripe API</div>
                    <div className="text-xs text-destructive">50% unreliable</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Log */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
                <div className="text-foreground font-semibold">API Call Log</div>
                <div className="flex gap-4 text-xs">
                  <span className="text-success">✓ {successfulCalls}</span>
                  <span className="text-destructive">✗ {failedCalls}</span>
                </div>
              </div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
                {calls.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    Start simulation to see API calls...
                  </div>
                ) : (
                  calls.map(call => (
                    <div key={call.id} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        call.status === 'success' ? 'bg-success' :
                        call.status === 'fallback' ? 'bg-warning' : 'bg-destructive'
                      }`} />
                      <span className={getStatusColor(call.status)}>
                        {call.status.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">{call.duration}ms</span>
                      {call.retryCount > 0 && (
                        <span className="text-primary">({call.retryCount} retries)</span>
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
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Best Practices</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Always set timeouts (3-10s)</li>
              <li>• Retry with exponential backoff</li>
              <li>• Use circuit breakers for cascading failures</li>
              <li>• Have fallbacks for critical paths</li>
            </ul>
          </div>

          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Gems</div>
            <ul className="text-xs text-muted-foreground space-y-1">
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

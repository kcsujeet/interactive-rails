/**
 * Level 26: Health Checks
 *
 * Implement health check endpoints for monitoring.
 * Player learns liveness, readiness, and deep health checks.
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

interface HealthCheck {
  id: string;
  name: string;
  type: 'liveness' | 'readiness' | 'deep';
  enabled: boolean;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unchecked';
  description: string;
  checks: string[];
}

interface Dependency {
  id: string;
  name: string;
  icon: string;
  healthy: boolean;
  latency: number;
}

const INITIAL_HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'liveness',
    name: 'Liveness Probe',
    type: 'liveness',
    enabled: false,
    status: 'unchecked',
    description: 'Is the app process running?',
    checks: ['Process responding', 'No deadlocks'],
  },
  {
    id: 'readiness',
    name: 'Readiness Probe',
    type: 'readiness',
    enabled: false,
    status: 'unchecked',
    description: 'Is the app ready to serve traffic?',
    checks: ['Database connected', 'Redis connected', 'Migrations current'],
  },
  {
    id: 'deep',
    name: 'Deep Health Check',
    type: 'deep',
    enabled: false,
    status: 'unchecked',
    description: 'Are all dependencies healthy?',
    checks: ['Database queries working', 'Cache read/write', 'External APIs responding', 'Disk space OK'],
  },
];

const INITIAL_DEPENDENCIES: Dependency[] = [
  { id: 'postgres', name: 'PostgreSQL', icon: '🐘', healthy: true, latency: 5 },
  { id: 'redis', name: 'Redis', icon: '🔴', healthy: true, latency: 2 },
  { id: 'stripe', name: 'Stripe API', icon: '💳', healthy: true, latency: 150 },
  { id: 'storage', name: 'S3 Storage', icon: '☁️', healthy: true, latency: 50 },
];

export function Level26HealthChecks({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>(INITIAL_HEALTH_CHECKS);
  const [dependencies, setDependencies] = useState<Dependency[]>(INITIAL_DEPENDENCIES);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Simulate random dependency failures
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setDependencies(prev => prev.map(dep => ({
        ...dep,
        healthy: Math.random() > 0.1, // 10% chance of failure
        latency: dep.healthy ? Math.floor(dep.latency * (0.8 + Math.random() * 0.4)) : 5000,
      })));

      // Update health check statuses based on dependencies
      setHealthChecks(prev => prev.map(check => {
        if (!check.enabled) return { ...check, status: 'unchecked' };

        if (check.type === 'liveness') {
          return { ...check, status: 'healthy' }; // Liveness is always healthy if we can respond
        }

        if (check.type === 'readiness') {
          const dbHealthy = dependencies.find(d => d.id === 'postgres')?.healthy;
          const redisHealthy = dependencies.find(d => d.id === 'redis')?.healthy;
          return { ...check, status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy' };
        }

        if (check.type === 'deep') {
          const allHealthy = dependencies.every(d => d.healthy);
          const someHealthy = dependencies.some(d => d.healthy);
          return {
            ...check,
            status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
          };
        }

        return check;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, dependencies]);

  const toggleHealthCheck = (checkId: string) => {
    setHealthChecks(prev => prev.map(check =>
      check.id === checkId ? { ...check, enabled: !check.enabled } : check
    ));
  };

  const toggleDependency = (depId: string) => {
    setDependencies(prev => prev.map(dep =>
      dep.id === depId ? { ...dep, healthy: !dep.healthy } : dep
    ));
  };

  const validateSolution = (): ValidationResult => {
    const enabledChecks = healthChecks.filter(c => c.enabled);
    if (enabledChecks.length < 2) {
      return {
        valid: false,
        message: 'Enable more health checks!',
        details: ['At least liveness and readiness checks needed'],
      };
    }
    const hasLiveness = healthChecks.find(c => c.id === 'liveness')?.enabled;
    const hasReadiness = healthChecks.find(c => c.id === 'readiness')?.enabled;
    if (!hasLiveness || !hasReadiness) {
      return {
        valid: false,
        message: 'Both liveness and readiness checks required!',
        details: ['Kubernetes uses these for container management'],
      };
    }
    return { valid: true, message: 'Health monitoring configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level26-health-checks', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'degraded': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'unhealthy': return 'text-red-400 bg-red-900/20 border-red-500';
      default: return 'text-gray-400 bg-gray-800 border-gray-600';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your app is deployed to Kubernetes. But how does K8s know when to restart a crashed container or stop sending traffic to an unhealthy pod? Health checks!"
          instructions={[
            'Liveness: Is the app alive? (restart if not)',
            'Readiness: Can it serve traffic? (remove from LB)',
            'Deep: Are all dependencies OK? (debugging)',
            'Enable checks for production monitoring',
          ]}
          goal="Configure health check endpoints for reliable production deployments."
        >
          {/* System Status */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              System Status
            </div>
            <div className="space-y-2">
              {dependencies.map(dep => (
                <button
                  key={dep.id}
                  onClick={() => toggleDependency(dep.id)}
                  className={`w-full p-2 rounded-lg flex items-center justify-between transition-all ${
                    dep.healthy
                      ? 'bg-green-900/20 border border-green-600'
                      : 'bg-red-900/20 border border-red-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{dep.icon}</span>
                    <span className={dep.healthy ? 'text-green-400' : 'text-red-400'}>
                      {dep.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {dep.healthy ? `${dep.latency}ms` : 'DOWN'}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              Click to toggle health
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`w-full py-2 rounded-lg font-medium transition-all ${
                isMonitoring
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Checks enabled</span>
              <span className={healthChecks.filter(c => c.enabled).length >= 2 ? 'text-green-400' : 'text-white'}>
                {healthChecks.filter(c => c.enabled).length} / 3
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={26}
          levelName="Health Checks"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setHealthChecks(INITIAL_HEALTH_CHECKS);
            setDependencies(INITIAL_DEPENDENCIES);
            setIsMonitoring(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Health Check Cards */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              {healthChecks.map(check => (
                <button
                  key={check.id}
                  onClick={() => toggleHealthCheck(check.id)}
                  className={`rounded-xl border-2 overflow-hidden text-left transition-all ${
                    check.enabled ? getStatusColor(check.status) : 'border-gray-700 bg-gray-900'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-lg font-semibold ${check.enabled ? '' : 'text-gray-400'}`}>
                        {check.name}
                      </span>
                      {check.enabled && (
                        <span className={`w-3 h-3 rounded-full ${
                          check.status === 'healthy' ? 'bg-green-400' :
                          check.status === 'degraded' ? 'bg-yellow-400 animate-pulse' :
                          check.status === 'unhealthy' ? 'bg-red-400 animate-pulse' : 'bg-gray-500'
                        }`} />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-3">{check.description}</div>
                    <div className="space-y-1">
                      {check.checks.map((c, i) => (
                        <div key={i} className="text-xs text-gray-400 flex items-center gap-1">
                          <span className={check.enabled && check.status === 'healthy' ? 'text-green-400' : ''}>
                            {check.enabled && check.status === 'healthy' ? '✓' : '○'}
                          </span>
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`px-4 py-2 text-xs font-medium ${
                    check.enabled ? 'bg-black/20' : 'bg-gray-800'
                  }`}>
                    {check.enabled ? 'Enabled' : 'Click to enable'}
                  </div>
                </button>
              ))}
            </div>

            {/* Kubernetes Integration */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Kubernetes Integration</div>
                <div className="text-xs text-gray-500">How K8s uses these endpoints</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">Liveness</div>
                  <div className="text-xs text-gray-400">
                    GET /health/liveness<br />
                    → 200: Keep running<br />
                    → 500: Restart container
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">Readiness</div>
                  <div className="text-xs text-gray-400">
                    GET /health/readiness<br />
                    → 200: Send traffic<br />
                    → 500: Remove from LB
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">Deep</div>
                  <div className="text-xs text-gray-400">
                    GET /health/deep<br />
                    → For debugging<br />
                    → Not for K8s probes
                  </div>
                </div>
              </div>
            </div>

            {/* Live Status */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                <div className="text-white font-semibold">Live Endpoint Status</div>
                {isMonitoring && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Monitoring
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {healthChecks.filter(c => c.enabled).map(check => (
                  <div key={check.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        check.status === 'healthy' ? 'bg-green-400' :
                        check.status === 'degraded' ? 'bg-yellow-400' :
                        check.status === 'unhealthy' ? 'bg-red-400' : 'bg-gray-500'
                      }`} />
                      <div>
                        <div className="text-white text-sm">{check.name}</div>
                        <div className="text-xs text-gray-500 font-mono">/health/{check.id}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${
                      check.status === 'healthy' ? 'text-green-400' :
                      check.status === 'degraded' ? 'text-yellow-400' :
                      check.status === 'unhealthy' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {check.status === 'healthy' ? '200 OK' :
                       check.status === 'degraded' ? '200 DEGRADED' :
                       check.status === 'unhealthy' ? '503 ERROR' : '--'}
                    </div>
                  </div>
                ))}
                {healthChecks.filter(c => c.enabled).length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    Enable health checks to see their status
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
              filename: 'app/controllers/health_controller.rb',
              language: 'ruby',
              code: `class HealthController < ActionController::API
  def liveness
    head :ok
  end

  def readiness
    checks = {
      database: database_connected?,
      redis: redis_connected?,
      migrations: migrations_current?
    }

    if checks.values.all?
      render json: { status: "ready" }
    else
      render json: { status: "not_ready", checks: },
             status: :service_unavailable
    end
  end

  def deep
    render json: {
      postgres: check_postgres,
      redis: check_redis,
      stripe: check_stripe,
      storage: check_storage,
      disk: check_disk_space
    }
  end

  private

  def database_connected?
    ActiveRecord::Base.connection.active?
  rescue
    false
  end
end`,
              highlight: [3, 7, 8, 9],
            },
          ]}
          learningGoal="Liveness = restart if dead. Readiness = remove from load balancer. Deep = full dependency check for debugging."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Routes</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# config/routes.rb
get '/health/liveness'
get '/health/readiness'
get '/health/deep'`}
            </pre>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">K8s Config</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level26HealthChecks;

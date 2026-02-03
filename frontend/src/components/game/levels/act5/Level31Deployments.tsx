/**
 * Level 31: Zero-Downtime Deployments
 *
 * Deploy without taking your app offline.
 * Player learns blue-green, rolling, and canary deployments.
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

type DeploymentStrategy = 'blue-green' | 'rolling' | 'canary' | null;

interface Server {
  id: string;
  version: 'v1' | 'v2';
  status: 'running' | 'deploying' | 'draining' | 'stopped';
  traffic: number;
}

export function Level31Deployments({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [strategy, setStrategy] = useState<DeploymentStrategy>(null);
  const [servers, setServers] = useState<Server[]>([
    { id: 'server1', version: 'v1', status: 'running', traffic: 33 },
    { id: 'server2', version: 'v1', status: 'running', traffic: 33 },
    { id: 'server3', version: 'v1', status: 'running', traffic: 34 },
  ]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [errorRate, setErrorRate] = useState(0);

  const executeDeployment = () => {
    if (!strategy) return;
    setIsDeploying(true);
    setDeployProgress(0);
    setDowntime(0);
    setErrorRate(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDeployProgress(step * 10);

      switch (strategy) {
        case 'blue-green':
          // Deploy all at once, then switch
          if (step < 8) {
            // Deploying new environment
          } else if (step === 8) {
            // Switch traffic instantly
            setServers(prev => prev.map(s => ({ ...s, version: 'v2', traffic: 33 })));
          }
          break;

        case 'rolling':
          // Deploy one server at a time
          if (step === 3) {
            setServers(prev => prev.map((s, i) =>
              i === 0 ? { ...s, status: 'deploying', traffic: 0 } : { ...s, traffic: 50 }
            ));
          } else if (step === 4) {
            setServers(prev => prev.map((s, i) =>
              i === 0 ? { ...s, version: 'v2', status: 'running', traffic: 33 } :
              i === 1 ? { ...s, status: 'deploying', traffic: 0 } : { ...s, traffic: 67 }
            ));
          } else if (step === 5) {
            setServers(prev => prev.map((s, i) =>
              i <= 1 ? { ...s, version: 'v2', status: 'running', traffic: 33 } :
              { ...s, status: 'deploying', traffic: 0 }
            ));
          } else if (step === 6) {
            setServers(prev => prev.map(s => ({ ...s, version: 'v2', status: 'running', traffic: 33 })));
          }
          break;

        case 'canary':
          // Gradually shift traffic
          if (step === 3) {
            setServers(prev => [
              { ...prev[0], version: 'v2', traffic: 10 },
              { ...prev[1], traffic: 45 },
              { ...prev[2], traffic: 45 },
            ]);
          } else if (step === 5) {
            setServers(prev => prev.map((s, i) =>
              i === 0 ? { ...s, version: 'v2', traffic: 33 } : { ...s, traffic: 33 }
            ));
          } else if (step === 7) {
            setServers(prev => prev.map(s => ({ ...s, version: 'v2', traffic: 33 })));
          }
          break;
      }

      if (step >= 10) {
        clearInterval(interval);
        setIsDeploying(false);
        setDeployProgress(100);
      }
    }, 500);
  };

  const validateSolution = (): ValidationResult => {
    if (!strategy) {
      return {
        valid: false,
        message: 'Select a deployment strategy!',
        details: ['Choose how to deploy your new version'],
      };
    }
    if (deployProgress < 100) {
      return {
        valid: false,
        message: 'Complete a deployment!',
        details: ['Click "Deploy" to run the deployment'],
      };
    }
    if (downtime > 0) {
      return {
        valid: false,
        message: 'Had downtime during deployment!',
        details: ['Zero-downtime means no service interruption'],
      };
    }
    return { valid: true, message: 'Zero-downtime deployment successful!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act5-level31-deployments', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const v1Count = servers.filter(s => s.version === 'v1').length;
  const v2Count = servers.filter(s => s.version === 'v2').length;
  const v1Traffic = servers.filter(s => s.version === 'v1').reduce((sum, s) => sum + s.traffic, 0);
  const v2Traffic = servers.filter(s => s.version === 'v2').reduce((sum, s) => sum + s.traffic, 0);

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="It's Friday 5 PM and you need to deploy a critical fix. But taking the site down isn't an option - users are actively shopping!"
          instructions={[
            'Blue-Green: Deploy new env, switch traffic',
            'Rolling: Update servers one by one',
            'Canary: Gradually shift traffic to new version',
            'All strategies maintain uptime!',
          ]}
          goal="Deploy new code without any downtime or service interruption."
        >
          {/* Deployment Status */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Deployment Status
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{deployProgress}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: `${deployProgress}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className={`text-lg font-bold ${downtime === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {downtime}s
                  </div>
                  <div className="text-xs text-gray-500">Downtime</div>
                </div>
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className={`text-lg font-bold ${errorRate < 1 ? 'text-green-400' : 'text-red-400'}`}>
                    {errorRate}%
                  </div>
                  <div className="text-xs text-gray-500">Error Rate</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={executeDeployment}
              disabled={!strategy || isDeploying}
              className={`w-full py-2 rounded-lg font-medium transition-all ${
                !strategy || isDeploying
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isDeploying ? 'Deploying...' : 'Deploy v2'}
            </button>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={31}
          levelName="Zero-Downtime Deployments"
          actNumber={5}
          onExit={onExit}
          onReset={() => {
            setStrategy(null);
            setServers([
              { id: 'server1', version: 'v1', status: 'running', traffic: 33 },
              { id: 'server2', version: 'v1', status: 'running', traffic: 33 },
              { id: 'server3', version: 'v1', status: 'running', traffic: 34 },
            ]);
            setDeployProgress(0);
            setDowntime(0);
            setErrorRate(0);
            setIsDeploying(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Strategy Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Deployment Strategy</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                {[
                  { id: 'blue-green', name: 'Blue-Green', icon: '🔵🟢', desc: 'Instant switch, easy rollback', pros: ['Instant rollback', 'No mixed versions'], cons: ['Needs 2x resources'] },
                  { id: 'rolling', name: 'Rolling', icon: '🔄', desc: 'Update one by one', pros: ['Resource efficient', 'Gradual'], cons: ['Mixed versions', 'Slower rollback'] },
                  { id: 'canary', name: 'Canary', icon: '🐤', desc: 'Test with small traffic', pros: ['Test in production', 'Catch issues early'], cons: ['Complex routing', 'Needs monitoring'] },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => !isDeploying && setStrategy(s.id as DeploymentStrategy)}
                    disabled={isDeploying}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      strategy === s.id
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    } ${isDeploying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className={`font-semibold ${strategy === s.id ? 'text-cyan-400' : 'text-white'}`}>
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{s.desc}</div>
                    <div className="text-xs space-y-1">
                      {s.pros.map(p => <div key={p} className="text-green-400">+ {p}</div>)}
                      {s.cons.map(c => <div key={c} className="text-red-400">- {c}</div>)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Server Visualization */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Server Fleet</div>
              </div>
              <div className="p-6">
                <div className="flex justify-center gap-8">
                  {servers.map(server => (
                    <div
                      key={server.id}
                      className={`w-32 p-4 rounded-xl border-2 transition-all ${
                        server.status === 'deploying'
                          ? 'border-yellow-500 bg-yellow-900/20 animate-pulse'
                          : server.version === 'v2'
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-blue-500 bg-blue-900/20'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">🖥️</div>
                        <div className={`font-bold ${
                          server.version === 'v2' ? 'text-green-400' : 'text-blue-400'
                        }`}>
                          {server.version}
                        </div>
                        <div className="text-xs text-gray-500">{server.status}</div>
                        <div className="mt-2">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                server.version === 'v2' ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${server.traffic}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{server.traffic}% traffic</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Traffic Split */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Traffic Distribution</div>
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2">
                  <div
                    className="h-8 bg-blue-500 transition-all rounded-l-lg flex items-center justify-center text-white text-sm"
                    style={{ width: `${v1Traffic}%` }}
                  >
                    {v1Traffic > 10 && `v1: ${v1Traffic}%`}
                  </div>
                  <div
                    className="h-8 bg-green-500 transition-all rounded-r-lg flex items-center justify-center text-white text-sm"
                    style={{ width: `${v2Traffic}%` }}
                  >
                    {v2Traffic > 10 && `v2: ${v2Traffic}%`}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="text-blue-400">v1: {v1Count} servers</span>
                  <span className="text-green-400">v2: {v2Count} servers</span>
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
              filename: 'kubernetes/deployment.yml',
              language: 'yaml',
              code: strategy === 'rolling' ? `apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero downtime!` :
strategy === 'blue-green' ? `# Blue-Green with Services
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    version: blue  # Switch to 'green' to deploy

---
# Deploy green environment
# Test green independently
# Switch selector to green
# Delete blue when confirmed` :
strategy === 'canary' ? `# Canary with Istio
apiVersion: networking.istio.io/v1
kind: VirtualService
spec:
  http:
    - route:
      - destination:
          host: myapp-v1
        weight: 90
      - destination:
          host: myapp-v2
        weight: 10  # Canary traffic` :
`# Select a strategy to see config`,
              highlight: strategy === 'rolling' ? [6, 7, 8, 9] : strategy === 'canary' ? [8, 9, 10, 11, 12, 13] : [],
            },
          ]}
          learningGoal="Zero-downtime deployments keep your service available during updates. Choose strategy based on risk tolerance and resources."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Key Concepts</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Health checks before traffic</li>
              <li>• Graceful shutdown (drain connections)</li>
              <li>• Database migrations first</li>
              <li>• Feature flags for risky changes</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Rollback Plan</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>Blue-Green: Switch back instantly</li>
              <li>Rolling: Deploy previous version</li>
              <li>Canary: Shift traffic back to v1</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level31Deployments;

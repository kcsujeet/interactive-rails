/**
 * Level 27: Load Balancing
 *
 * Distribute traffic across multiple servers.
 * Player learns load balancing strategies and session affinity.
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

interface Server {
  id: string;
  name: string;
  healthy: boolean;
  load: number;
  requestCount: number;
  responseTime: number;
}

type LoadBalancingStrategy = 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';

const INITIAL_SERVERS: Server[] = [
  { id: 'server1', name: 'Server 1', healthy: true, load: 0, requestCount: 0, responseTime: 50 },
  { id: 'server2', name: 'Server 2', healthy: true, load: 0, requestCount: 0, responseTime: 50 },
  { id: 'server3', name: 'Server 3', healthy: true, load: 0, requestCount: 0, responseTime: 50 },
];

export function Level27LoadBalancing({ onComplete, onExit }: LevelComponentProps) {
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
      const healthyServers = servers.filter(s => s.healthy);
      if (healthyServers.length === 0) return;

      // Route request based on strategy
      let targetServer: Server;

      switch (strategy) {
        case 'round-robin':
          targetServer = healthyServers[roundRobinIndex % healthyServers.length];
          setRoundRobinIndex(prev => prev + 1);
          break;
        case 'least-connections':
          targetServer = healthyServers.reduce((min, s) =>
            s.load < min.load ? s : min
          );
          break;
        case 'ip-hash':
          // Simulate sticky sessions
          const clientIp = Math.floor(Math.random() * 100) % 3;
          targetServer = healthyServers[clientIp % healthyServers.length];
          break;
        case 'weighted':
          // Server 1 gets 50%, Server 2 gets 30%, Server 3 gets 20%
          const rand = Math.random();
          if (rand < 0.5) targetServer = healthyServers.find(s => s.id === 'server1') || healthyServers[0];
          else if (rand < 0.8) targetServer = healthyServers.find(s => s.id === 'server2') || healthyServers[0];
          else targetServer = healthyServers.find(s => s.id === 'server3') || healthyServers[0];
          break;
        default:
          targetServer = healthyServers[0];
      }

      setServers(prev => prev.map(s => {
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
      }));

      setTotalRequests(prev => prev + 1);
    }, 1000 / requestsPerSecond);

    return () => clearInterval(interval);
  }, [isSimulating, strategy, servers, roundRobinIndex, requestsPerSecond]);

  const toggleServerHealth = (serverId: string) => {
    setServers(prev => prev.map(s =>
      s.id === serverId ? { ...s, healthy: !s.healthy, load: 0 } : s
    ));
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
    const success = await completeLevel('act5-level27-load-balancing', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const avgResponseTime = servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your single server is overwhelmed. Response times are through the roof. Add more servers and distribute the load intelligently!"
          instructions={[
            'Round Robin: Equal distribution',
            'Least Connections: Route to least busy',
            'IP Hash: Same user → same server',
            'Weighted: More to powerful servers',
          ]}
          goal="Distribute traffic across multiple servers for reliability and performance."
        >
          {/* Traffic Control */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Traffic Simulation
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500">Requests per second: {requestsPerSecond}</label>
              <input
                type="range"
                min="1"
                max="50"
                value={requestsPerSecond}
                onChange={(e) => setRequestsPerSecond(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              disabled={!strategy}
              className={`w-full py-2 rounded-lg font-medium transition-all ${
                !strategy
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : isSimulating
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isSimulating ? 'Stop Traffic' : 'Start Traffic'}
            </button>
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Metrics
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className="text-xl font-bold text-white">{totalRequests}</div>
                <div className="text-xs text-gray-500">Total Requests</div>
              </div>
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className={`text-xl font-bold ${avgResponseTime < 100 ? 'text-green-400' : avgResponseTime < 200 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {Math.round(avgResponseTime)}ms
                </div>
                <div className="text-xs text-gray-500">Avg Response</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={27}
          levelName="Load Balancing"
          actNumber={5}
          onExit={onExit}
          onReset={() => {
            setServers(INITIAL_SERVERS);
            setStrategy(null);
            setTotalRequests(0);
            setIsSimulating(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Strategy Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Load Balancing Strategy</div>
              </div>
              <div className="p-4 grid grid-cols-4 gap-3">
                {[
                  { id: 'round-robin', name: 'Round Robin', icon: '🔄', desc: 'A → B → C → A...' },
                  { id: 'least-connections', name: 'Least Conns', icon: '📊', desc: 'Route to least busy' },
                  { id: 'ip-hash', name: 'IP Hash', icon: '🔗', desc: 'Sticky sessions' },
                  { id: 'weighted', name: 'Weighted', icon: '⚖️', desc: '50/30/20 split' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStrategy(s.id as LoadBalancingStrategy)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      strategy === s.id
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className={`text-sm font-semibold ${strategy === s.id ? 'text-cyan-400' : 'text-white'}`}>
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-500">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Load Balancer Visualization */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Server Farm</div>
                <div className="text-xs text-gray-500">Click servers to toggle health</div>
              </div>
              <div className="p-8">
                <div className="flex items-center justify-between">
                  {/* Load Balancer */}
                  <div className="text-center">
                    <div className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center ${
                      strategy ? 'bg-cyan-600' : 'bg-gray-700'
                    }`}>
                      <span className="text-3xl">⚖️</span>
                      <span className="text-xs text-white mt-1">Load Balancer</span>
                    </div>
                  </div>

                  {/* Connection Lines */}
                  <div className="flex-1 flex flex-col justify-center gap-4 mx-4">
                    {servers.map(server => (
                      <div
                        key={server.id}
                        className={`h-1 ${server.healthy ? 'bg-green-500' : 'bg-red-500 opacity-30'}`}
                      />
                    ))}
                  </div>

                  {/* Servers */}
                  <div className="space-y-4">
                    {servers.map(server => (
                      <button
                        key={server.id}
                        onClick={() => toggleServerHealth(server.id)}
                        className={`w-40 p-3 rounded-lg border-2 text-left transition-all ${
                          server.healthy
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-red-500 bg-red-900/20 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={server.healthy ? 'text-green-400' : 'text-red-400'}>
                            {server.name}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${server.healthy ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full transition-all ${
                              server.load > 80 ? 'bg-red-500' :
                              server.load > 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${server.load}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{server.requestCount} reqs</span>
                          <span>{server.responseTime}ms</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Request Distribution */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Request Distribution</div>
              </div>
              <div className="p-4">
                <div className="flex gap-4">
                  {servers.map(server => {
                    const percentage = totalRequests > 0
                      ? Math.round((server.requestCount / totalRequests) * 100)
                      : 0;
                    return (
                      <div key={server.id} className="flex-1">
                        <div className="text-center mb-2">
                          <div className="text-2xl font-bold text-white">{percentage}%</div>
                          <div className="text-xs text-gray-500">{server.name}</div>
                        </div>
                        <div className="h-24 bg-gray-800 rounded-lg overflow-hidden flex flex-col-reverse">
                          <div
                            className="bg-cyan-500 transition-all"
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
              code: strategy === 'round-robin' ? `upstream backend {
  server server1:3000;
  server server2:3000;
  server server3:3000;
}

# Round robin is default` :
strategy === 'least-connections' ? `upstream backend {
  least_conn;
  server server1:3000;
  server server2:3000;
  server server3:3000;
}` :
strategy === 'ip-hash' ? `upstream backend {
  ip_hash;  # Sticky sessions
  server server1:3000;
  server server2:3000;
  server server3:3000;
}` :
strategy === 'weighted' ? `upstream backend {
  server server1:3000 weight=5;
  server server2:3000 weight=3;
  server server3:3000 weight=2;
}` :
`upstream backend {
  # Select a strategy above
  server server1:3000;
  server server2:3000;
  server server3:3000;
}`,
              highlight: strategy === 'least-connections' ? [2] : strategy === 'ip-hash' ? [2] : strategy === 'weighted' ? [2, 3, 4] : [],
            },
          ]}
          learningGoal="Load balancers distribute traffic and provide high availability. Choose strategy based on your app's needs."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">When to Use</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li><span className="text-cyan-400">Round Robin:</span> Equal servers</li>
              <li><span className="text-cyan-400">Least Conn:</span> Varying load</li>
              <li><span className="text-cyan-400">IP Hash:</span> Session state</li>
              <li><span className="text-cyan-400">Weighted:</span> Different capacities</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Tools</div>
            <ul className="text-xs text-gray-400 space-y-1">
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

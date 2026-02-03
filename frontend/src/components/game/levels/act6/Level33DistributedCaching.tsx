/**
 * Level 33: Distributed Caching
 *
 * Scale caching across multiple nodes with Redis Cluster.
 * Player learns cache sharding, consistency, and invalidation.
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

interface CacheNode {
  id: string;
  name: string;
  keys: number;
  memory: number;
  maxMemory: number;
  status: 'healthy' | 'degraded' | 'down';
}

interface CacheOperation {
  id: number;
  type: 'GET' | 'SET' | 'DEL';
  key: string;
  result: 'HIT' | 'MISS' | 'OK' | 'ROUTED';
  node: string;
}

const INITIAL_NODES: CacheNode[] = [
  { id: 'node1', name: 'Redis 1', keys: 0, memory: 0, maxMemory: 100, status: 'healthy' },
  { id: 'node2', name: 'Redis 2', keys: 0, memory: 0, maxMemory: 100, status: 'healthy' },
  { id: 'node3', name: 'Redis 3', keys: 0, memory: 0, maxMemory: 100, status: 'healthy' },
];

export function Level33DistributedCaching({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [nodes, setNodes] = useState<CacheNode[]>(INITIAL_NODES);
  const [operations, setOperations] = useState<CacheOperation[]>([]);
  const [clusterEnabled, setClusterEnabled] = useState(false);
  const [consistentHashing, setConsistentHashing] = useState(false);
  const [replication, setReplication] = useState(false);
  const [cachedKeys, setCachedKeys] = useState<Map<string, string>>(new Map());

  const hashKey = (key: string): number => {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getNodeForKey = (key: string): CacheNode => {
    const healthyNodes = nodes.filter(n => n.status !== 'down');
    if (healthyNodes.length === 0) return nodes[0];

    if (consistentHashing) {
      // Consistent hashing - same key always goes to same node
      const hash = hashKey(key);
      const index = hash % healthyNodes.length;
      return healthyNodes[index];
    } else {
      // Random distribution
      return healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
    }
  };

  const cacheGet = (key: string) => {
    const node = getNodeForKey(key);
    const hit = cachedKeys.has(key);

    const op: CacheOperation = {
      id: Date.now(),
      type: 'GET',
      key,
      result: hit ? 'HIT' : 'MISS',
      node: node.name,
    };
    setOperations(prev => [...prev.slice(-9), op]);
  };

  const cacheSet = (key: string) => {
    const node = getNodeForKey(key);
    cachedKeys.set(key, node.id);

    setNodes(prev => prev.map(n =>
      n.id === node.id
        ? { ...n, keys: n.keys + 1, memory: Math.min(n.memory + 5, n.maxMemory) }
        : n
    ));

    // Replication
    if (replication) {
      const otherNodes = nodes.filter(n => n.id !== node.id && n.status !== 'down');
      if (otherNodes.length > 0) {
        const replica = otherNodes[0];
        setNodes(prev => prev.map(n =>
          n.id === replica.id
            ? { ...n, keys: n.keys + 1, memory: Math.min(n.memory + 5, n.maxMemory) }
            : n
        ));
      }
    }

    const op: CacheOperation = {
      id: Date.now(),
      type: 'SET',
      key,
      result: 'OK',
      node: node.name,
    };
    setOperations(prev => [...prev.slice(-9), op]);
  };

  const toggleNodeHealth = (nodeId: string) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, status: n.status === 'healthy' ? 'down' : 'healthy' }
        : n
    ));
  };

  const simulateTraffic = () => {
    const keys = ['user:1', 'user:2', 'product:100', 'session:abc', 'cart:xyz'];
    const key = keys[Math.floor(Math.random() * keys.length)];

    if (Math.random() > 0.3) {
      cacheGet(key);
    } else {
      cacheSet(key);
    }
  };

  // Auto-simulate when cluster is enabled
  useEffect(() => {
    if (!clusterEnabled) return;

    const interval = setInterval(simulateTraffic, 1000);
    return () => clearInterval(interval);
  }, [clusterEnabled, consistentHashing, nodes]);

  const validateSolution = (): ValidationResult => {
    if (!clusterEnabled) {
      return {
        valid: false,
        message: 'Enable the Redis cluster!',
        details: ['Turn on the cluster to distribute cache'],
      };
    }
    if (!consistentHashing) {
      return {
        valid: false,
        message: 'Enable consistent hashing!',
        details: ['Consistent hashing ensures keys go to the same node'],
      };
    }
    if (!replication) {
      return {
        valid: false,
        message: 'Enable replication!',
        details: ['Replication provides redundancy when nodes fail'],
      };
    }
    return { valid: true, message: 'Distributed cache configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act6-level33-distributed-caching', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const totalKeys = nodes.reduce((sum, n) => sum + n.keys, 0);
  const hitRate = operations.length > 0
    ? Math.round((operations.filter(o => o.result === 'HIT').length / operations.filter(o => o.type === 'GET').length) * 100) || 0
    : 0;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your single Redis instance is running out of memory. Time to scale horizontally with Redis Cluster - but how do you ensure data consistency?"
          instructions={[
            'Cluster: Multiple Redis nodes',
            'Consistent Hashing: Same key → same node',
            'Replication: Copy data for redundancy',
            'Handle node failures gracefully',
          ]}
          goal="Build a distributed cache that's scalable, consistent, and fault-tolerant."
        >
          {/* Cluster Settings */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Cluster Configuration
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setClusterEnabled(!clusterEnabled)}
                className={`w-full p-2 rounded-lg text-left transition-all border ${
                  clusterEnabled ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={clusterEnabled ? 'text-green-400' : 'text-white'}>Enable Cluster</span>
                  {clusterEnabled && <span className="text-green-400">✓</span>}
                </div>
              </button>
              <button
                onClick={() => setConsistentHashing(!consistentHashing)}
                disabled={!clusterEnabled}
                className={`w-full p-2 rounded-lg text-left transition-all border ${
                  consistentHashing ? 'border-green-500 bg-green-900/20' :
                  clusterEnabled ? 'border-gray-700 bg-gray-800' : 'border-gray-700 bg-gray-800 opacity-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={consistentHashing ? 'text-green-400' : 'text-white'}>Consistent Hashing</span>
                  {consistentHashing && <span className="text-green-400">✓</span>}
                </div>
              </button>
              <button
                onClick={() => setReplication(!replication)}
                disabled={!clusterEnabled}
                className={`w-full p-2 rounded-lg text-left transition-all border ${
                  replication ? 'border-green-500 bg-green-900/20' :
                  clusterEnabled ? 'border-gray-700 bg-gray-800' : 'border-gray-700 bg-gray-800 opacity-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={replication ? 'text-green-400' : 'text-white'}>Replication</span>
                  {replication && <span className="text-green-400">✓</span>}
                </div>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className="text-xl font-bold text-white">{totalKeys}</div>
                <div className="text-xs text-gray-500">Total Keys</div>
              </div>
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className={`text-xl font-bold ${hitRate > 70 ? 'text-green-400' : hitRate > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {hitRate}%
                </div>
                <div className="text-xs text-gray-500">Hit Rate</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={33}
          levelName="Distributed Caching"
          actNumber={6}
          onExit={onExit}
          onReset={() => {
            setNodes(INITIAL_NODES);
            setOperations([]);
            setClusterEnabled(false);
            setConsistentHashing(false);
            setReplication(false);
            setCachedKeys(new Map());
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Cluster Nodes */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Redis Cluster</div>
                <div className="text-xs text-gray-500">Click nodes to simulate failures</div>
              </div>
              <div className="p-6">
                <div className="flex justify-center gap-8">
                  {nodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => toggleNodeHealth(node.id)}
                      className={`w-40 p-4 rounded-xl border-2 transition-all ${
                        node.status === 'healthy'
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-red-500 bg-red-900/20 opacity-60'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">🗄️</div>
                        <div className={node.status === 'healthy' ? 'text-green-400' : 'text-red-400'}>
                          {node.name}
                        </div>
                        <div className="text-xs text-gray-500">{node.status}</div>

                        {/* Memory bar */}
                        <div className="mt-3">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                node.memory > 80 ? 'bg-red-500' :
                                node.memory > 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${(node.memory / node.maxMemory) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {node.memory}/{node.maxMemory} MB
                          </div>
                        </div>

                        <div className="text-lg font-bold text-cyan-400 mt-2">
                          {node.keys}
                        </div>
                        <div className="text-xs text-gray-500">keys</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Hash Ring Visualization */}
                {consistentHashing && (
                  <div className="mt-6 text-center">
                    <div className="text-xs text-gray-500 mb-2">Consistent Hash Ring</div>
                    <div className="w-32 h-32 mx-auto rounded-full border-4 border-cyan-600 relative">
                      {nodes.map((node, i) => {
                        const angle = (i * 120) - 90;
                        const x = 50 + 40 * Math.cos(angle * Math.PI / 180);
                        const y = 50 + 40 * Math.sin(angle * Math.PI / 180);
                        return (
                          <div
                            key={node.id}
                            className={`absolute w-6 h-6 rounded-full ${
                              node.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Operations Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Cache Operations</div>
              </div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
                {operations.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    Enable cluster to see operations
                  </div>
                ) : (
                  operations.map(op => (
                    <div key={op.id} className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded ${
                        op.type === 'GET' ? 'bg-blue-900/40 text-blue-400' :
                        op.type === 'SET' ? 'bg-green-900/40 text-green-400' :
                        'bg-red-900/40 text-red-400'
                      }`}>
                        {op.type}
                      </span>
                      <span className="text-gray-400">{op.key}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-cyan-400">{op.node}</span>
                      <span className={
                        op.result === 'HIT' ? 'text-green-400' :
                        op.result === 'MISS' ? 'text-yellow-400' : 'text-gray-400'
                      }>
                        {op.result}
                      </span>
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
              filename: 'config/redis.yml',
              language: 'yaml',
              code: `production:
  cluster:
    - redis://redis1:6379
    - redis://redis2:6379
    - redis://redis3:6379

  # Consistent hashing
  driver: hiredis
  cluster_mode: true

  # Replication
  read_timeout: 1
  replica: true`,
              highlight: consistentHashing ? [8, 9] : replication ? [12, 13] : [],
            },
            {
              filename: 'app/services/cache_service.rb',
              language: 'ruby',
              code: `class CacheService
  def initialize
    @redis = Redis::Distributed.new([
      "redis://node1:6379",
      "redis://node2:6379",
      "redis://node3:6379"
    ])
  end

  def get(key)
    # Consistent hashing routes to same node
    @redis.get(key)
  end

  def set(key, value, expires_in: 1.hour)
    @redis.setex(key, expires_in, value)
  end
end`,
              highlight: [],
            },
          ]}
          learningGoal="Distributed caching scales horizontally. Consistent hashing ensures key locality. Replication provides fault tolerance."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Key Concepts</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Hash slot assignment (0-16383)</li>
              <li>• Replica failover</li>
              <li>• Cross-slot operations</li>
              <li>• Memory eviction policies</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Invalidation</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# Delete specific key
redis.del("user:1")

# Pattern invalidation
redis.scan_each(match: "user:*") do |key|
  redis.del(key)
end`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level33DistributedCaching;

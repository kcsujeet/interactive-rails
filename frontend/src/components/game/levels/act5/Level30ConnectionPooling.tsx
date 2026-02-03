/**
 * Level 30: Connection Pooling
 *
 * Manage database and Redis connections efficiently.
 * Player learns to configure connection pools for scale.
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

interface PoolConfig {
  size: number;
  timeout: number;
  checkout_timeout: number;
}

interface Connection {
  id: number;
  status: 'idle' | 'active' | 'waiting';
  duration: number;
}

interface PoolMetrics {
  active: number;
  idle: number;
  waiting: number;
  timeouts: number;
}

export function Level30ConnectionPooling({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<PoolConfig>({
    size: 5,
    timeout: 5000,
    checkout_timeout: 5,
  });
  const [connections, setConnections] = useState<Connection[]>([]);
  const [metrics, setMetrics] = useState<PoolMetrics>({ active: 0, idle: 0, waiting: 0, timeouts: 0 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [concurrentRequests, setConcurrentRequests] = useState(10);
  const [waitingQueue, setWaitingQueue] = useState<number[]>([]);

  // Initialize connection pool
  useEffect(() => {
    setConnections(Array.from({ length: config.size }, (_, i) => ({
      id: i + 1,
      status: 'idle',
      duration: 0,
    })));
  }, [config.size]);

  // Simulate traffic
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Generate new requests
      for (let i = 0; i < concurrentRequests; i++) {
        // Try to get a connection
        const idleConn = connections.find(c => c.status === 'idle');

        if (idleConn) {
          setConnections(prev => prev.map(c =>
            c.id === idleConn.id ? { ...c, status: 'active', duration: Math.random() * 100 + 50 } : c
          ));
        } else {
          // No connections available, add to waiting queue
          setWaitingQueue(prev => [...prev, Date.now()]);
        }
      }

      // Process active connections
      setConnections(prev => prev.map(c => {
        if (c.status === 'active') {
          if (Math.random() > 0.7) {
            // Check if waiting queue has requests
            const hasWaiting = waitingQueue.length > 0;
            if (hasWaiting) {
              setWaitingQueue(prev => prev.slice(1));
              return { ...c, duration: Math.random() * 100 + 50 };
            }
            return { ...c, status: 'idle', duration: 0 };
          }
        }
        return c;
      }));

      // Check for timeouts in waiting queue
      const now = Date.now();
      const timedOut = waitingQueue.filter(t => now - t > config.checkout_timeout * 1000);
      if (timedOut.length > 0) {
        setMetrics(prev => ({ ...prev, timeouts: prev.timeouts + timedOut.length }));
        setWaitingQueue(prev => prev.filter(t => now - t <= config.checkout_timeout * 1000));
      }

      // Update metrics
      setMetrics({
        active: connections.filter(c => c.status === 'active').length,
        idle: connections.filter(c => c.status === 'idle').length,
        waiting: waitingQueue.length,
        timeouts: metrics.timeouts,
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isSimulating, connections, waitingQueue, concurrentRequests, config.checkout_timeout, metrics.timeouts]);

  const validateSolution = (): ValidationResult => {
    if (config.size < 10) {
      return {
        valid: false,
        message: 'Pool size too small!',
        details: ['Increase pool size to handle concurrent requests'],
      };
    }
    if (metrics.timeouts > 10) {
      return {
        valid: false,
        message: 'Too many connection timeouts!',
        details: ['Adjust pool size or checkout timeout'],
      };
    }
    if (waitingQueue.length > config.size) {
      return {
        valid: false,
        message: 'Connection queue too long!',
        details: ['Pool is undersized for your load'],
      };
    }
    return { valid: true, message: 'Connection pool optimized!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act5-level30-connection-pooling', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const poolUtilization = connections.length > 0
    ? Math.round((connections.filter(c => c.status === 'active').length / connections.length) * 100)
    : 0;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your app crashes under load with 'could not obtain a connection from the pool within 5.000 seconds'. Database connections are exhausted!"
          instructions={[
            'Pool size = max concurrent DB connections',
            'Rule: pool >= web workers × threads',
            'Too small = timeouts under load',
            'Too large = wasted DB resources',
          ]}
          goal="Configure connection pools to handle your traffic without exhausting database resources."
        >
          {/* Pool Settings */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Pool Configuration
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 flex justify-between">
                  <span>Pool Size</span>
                  <span className="text-cyan-400">{config.size}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={config.size}
                  onChange={(e) => setConfig(prev => ({ ...prev, size: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 flex justify-between">
                  <span>Checkout Timeout</span>
                  <span className="text-cyan-400">{config.checkout_timeout}s</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={config.checkout_timeout}
                  onChange={(e) => setConfig(prev => ({ ...prev, checkout_timeout: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 flex justify-between">
                  <span>Concurrent Requests</span>
                  <span className="text-cyan-400">{concurrentRequests}/sec</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={concurrentRequests}
                  onChange={(e) => setConcurrentRequests(Number(e.target.value))}
                  className="w-full"
                />
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
              {isSimulating ? 'Stop Simulation' : 'Start Traffic'}
            </button>
          </div>

          {/* Metrics */}
          <div className="p-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className={`text-xl font-bold ${poolUtilization > 90 ? 'text-red-400' : poolUtilization > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {poolUtilization}%
                </div>
                <div className="text-xs text-gray-500">Utilization</div>
              </div>
              <div className="bg-gray-800 p-2 rounded text-center">
                <div className={`text-xl font-bold ${metrics.timeouts > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {metrics.timeouts}
                </div>
                <div className="text-xs text-gray-500">Timeouts</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={30}
          levelName="Connection Pooling"
          actNumber={5}
          onExit={onExit}
          onReset={() => {
            setConfig({ size: 5, timeout: 5000, checkout_timeout: 5 });
            setConnections([]);
            setMetrics({ active: 0, idle: 0, waiting: 0, timeouts: 0 });
            setWaitingQueue([]);
            setIsSimulating(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Connection Pool Visualization */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Connection Pool</div>
                <div className="text-xs text-gray-500">{config.size} connections available</div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-10 gap-2">
                  {connections.map(conn => (
                    <div
                      key={conn.id}
                      className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                        conn.status === 'active'
                          ? 'bg-green-600 animate-pulse'
                          : 'bg-gray-700'
                      }`}
                    >
                      <span className="text-xs text-white">{conn.id}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-700" />
                    <span className="text-gray-400">Idle ({metrics.idle})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-600" />
                    <span className="text-gray-400">Active ({metrics.active})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Waiting Queue */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                <div className="text-white font-semibold">Waiting Queue</div>
                <span className={`text-sm ${waitingQueue.length > 10 ? 'text-red-400' : 'text-gray-400'}`}>
                  {waitingQueue.length} waiting
                </span>
              </div>
              <div className="p-4 h-20 overflow-hidden">
                {waitingQueue.length === 0 ? (
                  <div className="text-center text-gray-600 py-4">
                    No requests waiting
                  </div>
                ) : (
                  <div className="flex gap-1 flex-wrap">
                    {waitingQueue.slice(0, 50).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"
                      />
                    ))}
                    {waitingQueue.length > 50 && (
                      <span className="text-yellow-400 text-xs">+{waitingQueue.length - 50} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sizing Formula */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Pool Sizing Formula</div>
              </div>
              <div className="p-4">
                <div className="bg-gray-800 p-4 rounded-lg text-center">
                  <div className="text-lg font-mono text-cyan-400 mb-2">
                    pool_size = workers × threads_per_worker
                  </div>
                  <div className="text-sm text-gray-400">
                    Example: 4 Puma workers × 5 threads = 20 connections
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="text-2xl font-bold text-white">{Math.ceil(concurrentRequests / 5)}</div>
                    <div className="text-xs text-gray-500">Workers needed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">5</div>
                    <div className="text-xs text-gray-500">Threads/worker</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${config.size >= Math.ceil(concurrentRequests / 5) * 5 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.ceil(concurrentRequests / 5) * 5}
                    </div>
                    <div className="text-xs text-gray-500">Recommended pool</div>
                  </div>
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
              filename: 'config/database.yml',
              language: 'yaml',
              code: `production:
  adapter: postgresql
  pool: ${config.size}
  timeout: ${config.timeout}
  checkout_timeout: ${config.checkout_timeout}

  # Connection pool settings
  # pool: max connections
  # checkout_timeout: wait time for connection
  # reaping_frequency: check for dead connections`,
              highlight: [3, 4, 5],
            },
            {
              filename: 'config/puma.rb',
              language: 'ruby',
              code: `# Puma configuration
workers ENV.fetch("WEB_CONCURRENCY") { 4 }
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
threads threads_count, threads_count

# Match database pool to threads
# pool = workers * threads = 4 * 5 = 20

on_worker_boot do
  ActiveRecord::Base.establish_connection
end`,
              highlight: [2, 3],
            },
          ]}
          learningGoal="Connection pools prevent creating new DB connections per request. Size them based on your worker/thread configuration."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Common Errors</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li className="text-red-400">• ActiveRecord::ConnectionTimeoutError</li>
              <li className="text-yellow-400">• Pool too small for load</li>
              <li className="text-yellow-400">• Connections not returned</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Best Practices</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Pool = workers × threads</li>
              <li>• Monitor with PgBouncer</li>
              <li>• Use connection_pool gem for Redis</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level30ConnectionPooling;

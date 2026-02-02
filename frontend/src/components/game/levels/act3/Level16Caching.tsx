/**
 * Level 16: Caching
 *
 * Add caching layer to reduce database load.
 * Shows cache hit (green) vs miss (red) visualization.
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
} from '../shared';

interface Query {
  id: number;
  type: string;
  status: 'pending' | 'cache_hit' | 'cache_miss';
  latency: number;
}

export function Level16Caching({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [cacheEnabled, setCacheEnabled] = useState(false);
  const [queries, setQueries] = useState<Query[]>([]);
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
  const [dbLoad, setDbLoad] = useState(0);

  const hitRate = cacheHits + cacheMisses > 0
    ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)
    : 0;

  const isComplete = cacheEnabled && hitRate >= 70;

  // Simulate queries
  useEffect(() => {
    const queryTypes = ['users/1', 'posts/hot', 'users/1', 'posts/hot', 'users/2', 'users/1'];
    let queryIndex = 0;

    const interval = setInterval(() => {
      const queryType = queryTypes[queryIndex % queryTypes.length];
      const id = Date.now();

      const query: Query = {
        id,
        type: queryType,
        status: 'pending',
        latency: 0,
      };

      setQueries(prev => [...prev.slice(-10), query]);

      // Process query
      setTimeout(() => {
        const isCacheHit = cacheEnabled && cachedKeys.has(queryType);
        const latency = isCacheHit ? 2 + Math.random() * 3 : 50 + Math.random() * 100;

        if (isCacheHit) {
          setCacheHits(c => c + 1);
        } else {
          setCacheMisses(c => c + 1);
          setDbLoad(l => Math.min(100, l + 15));
          // Add to cache
          if (cacheEnabled) {
            setCachedKeys(prev => new Set([...prev, queryType]));
          }
        }

        setQueries(prev => prev.map(q =>
          q.id === id ? { ...q, status: isCacheHit ? 'cache_hit' : 'cache_miss', latency } : q
        ));
      }, 200);

      queryIndex++;
    }, 800);

    // Reduce DB load over time
    const loadInterval = setInterval(() => {
      setDbLoad(l => Math.max(0, l - 5));
    }, 500);

    return () => {
      clearInterval(interval);
      clearInterval(loadInterval);
    };
  }, [cacheEnabled, cachedKeys]);

  const handleComplete = async () => {
    const success = await completeLevel('act3-level16-caching', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The database is at 100% CPU! Every request hits the database, even for data that rarely changes. Users are seeing slow load times."
          instructions={[
            'Watch all queries go to the database (red lines)',
            'Enable Redis caching',
            'See repeated queries hit the cache (green lines)',
          ]}
          goal="Learn to use Redis caching to reduce database load and improve response times."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setCacheEnabled(true)}
              disabled={cacheEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                cacheEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {cacheEnabled ? 'Cache Enabled' : 'Enable Redis Cache'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cache Stats</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{cacheHits}</div>
                <div className="text-xs text-green-400/70">Cache Hits</div>
              </div>
              <div className="bg-red-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{cacheMisses}</div>
                <div className="text-xs text-red-400/70">Cache Misses</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Hit Rate</span>
                <span>{hitRate}%</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${hitRate >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${hitRate}%` }}
                />
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={16}
          levelName="Caching"
          actNumber={3}
          onExit={onExit}
          onReset={() => {
            setCacheEnabled(false);
            setQueries([]);
            setCacheHits(0);
            setCacheMisses(0);
            setCachedKeys(new Set());
            setDbLoad(0);
          }}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Architecture */}
          <div className="flex items-center justify-center gap-6 mb-8">
            {/* App */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-32 text-center">
              <div className="text-2xl mb-2">A</div>
              <div className="text-gray-400 text-sm">App</div>
            </div>

            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>

            {/* Redis Cache */}
            {cacheEnabled && (
              <>
                <div className="bg-red-900/40 border border-red-600 rounded-xl p-4 w-40 text-center">
                  <div className="text-2xl mb-2">R</div>
                  <div className="text-red-400 text-sm">Redis Cache</div>
                  <div className="text-red-300 text-xs mt-1">
                    {cachedKeys.size} keys cached
                  </div>
                </div>

                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}

            {/* Database */}
            <div className={`border rounded-xl p-4 w-40 text-center transition-colors ${
              dbLoad > 80 ? 'bg-red-900/40 border-red-500' :
              dbLoad > 50 ? 'bg-yellow-900/40 border-yellow-500' :
              'bg-gray-800 border-gray-700'
            }`}>
              <div className="text-2xl mb-2">DB</div>
              <div className={`text-sm ${
                dbLoad > 80 ? 'text-red-400' : dbLoad > 50 ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                PostgreSQL
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">CPU: {dbLoad}%</div>
                <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      dbLoad > 80 ? 'bg-red-500' : dbLoad > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${dbLoad}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Query Log */}
          <div className="bg-gray-900 rounded-xl p-4 max-w-2xl mx-auto">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Query Log</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {queries.map(q => (
                <div
                  key={q.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    q.status === 'pending' ? 'bg-gray-800' :
                    q.status === 'cache_hit' ? 'bg-green-900/30' :
                    'bg-red-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      q.status === 'pending' ? 'bg-gray-500 animate-pulse' :
                      q.status === 'cache_hit' ? 'bg-green-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-gray-300 font-mono text-sm">GET /{q.type}</span>
                  </div>
                  <div className="text-sm">
                    {q.status === 'pending' && (
                      <span className="text-gray-500">...</span>
                    )}
                    {q.status === 'cache_hit' && (
                      <span className="text-green-400">{q.latency.toFixed(1)}ms (cache)</span>
                    )}
                    {q.status === 'cache_miss' && (
                      <span className="text-red-400">{q.latency.toFixed(1)}ms (db)</span>
                    )}
                  </div>
                </div>
              ))}
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
            filename: 'app/models/user.rb',
            language: 'ruby',
            code: `class User < ApplicationRecord
  def self.find_cached(id)
    Rails.cache.fetch("users/#{id}", expires_in: 1.hour) do
      find(id)
    end
  end

  # Invalidate on update
  after_commit :invalidate_cache

  private

  def invalidate_cache
    Rails.cache.delete("users/#{id}")
  end
end

# config/environments/production.rb
config.cache_store = :redis_cache_store, {
  url: ENV['REDIS_URL'],
  expires_in: 1.hour
}`,
            highlight: [3, 4, 5, 9, 14, 18, 19, 20, 21],
          }]}
          learningGoal="Caching reduces database load by storing frequently accessed data in memory. Always remember to invalidate cache when data changes!"
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level16Caching;

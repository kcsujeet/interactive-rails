/**
 * Level 21: Read/Write Split
 *
 * Route read queries to replica for scaling.
 * Shows blue (read) and orange (write) traffic separation.
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
  type: 'read' | 'write';
  target: 'primary' | 'replica';
}

export function Level21ReadWriteSplit({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [replicaEnabled, setReplicaEnabled] = useState(false);
  const [queries, setQueries] = useState<Query[]>([]);
  const [primaryLoad, setPrimaryLoad] = useState(0);
  const [replicaLoad, setReplicaLoad] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [writeCount, setWriteCount] = useState(0);

  const isComplete = replicaEnabled && primaryLoad < 50 && readCount >= 10;

  // Simulate queries
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const isRead = Math.random() > 0.3; // 70% reads
      const type = isRead ? 'read' : 'write';
      const target = replicaEnabled && isRead ? 'replica' : 'primary';

      if (type === 'read') setReadCount(c => c + 1);
      else setWriteCount(c => c + 1);

      // Update load
      if (target === 'primary') {
        setPrimaryLoad(l => Math.min(100, l + (isRead ? 8 : 5)));
      } else {
        setReplicaLoad(l => Math.min(100, l + 8));
      }

      setQueries(prev => [...prev.slice(-15), { id, type, target }]);
    }, 400);

    // Load decay
    const loadInterval = setInterval(() => {
      setPrimaryLoad(l => Math.max(0, l - 3));
      setReplicaLoad(l => Math.max(0, l - 3));
    }, 300);

    return () => {
      clearInterval(interval);
      clearInterval(loadInterval);
    };
  }, [replicaEnabled]);

  const handleComplete = async () => {
    const success = await completeLevel('act4-level21-read-write-splitting', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The primary database is at 95% CPU! Most queries are SELECTs, but they're all hitting the same database as writes."
          instructions={[
            'Watch all queries (blue=read, orange=write) hit primary',
            'Enable read replica',
            'See reads route to replica, writes stay on primary',
          ]}
          goal="Learn to scale reads with database replicas using Rails multi-database support."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setReplicaEnabled(true)}
              disabled={replicaEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                replicaEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {replicaEnabled ? 'Replica Enabled' : 'Enable Read Replica'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Query Distribution
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500" />
                <span className="text-gray-300 text-sm">Reads: {readCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500" />
                <span className="text-gray-300 text-sm">Writes: {writeCount}</span>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={21}
          levelName="Read/Write Split"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setReplicaEnabled(false);
            setQueries([]);
            setPrimaryLoad(0);
            setReplicaLoad(0);
            setReadCount(0);
            setWriteCount(0);
          }}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Architecture */}
          <div className="flex justify-center gap-16 mb-8">
            {/* App */}
            <div className="flex flex-col items-center">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-32 text-center">
                <div className="text-2xl mb-2">A</div>
                <div className="text-gray-400 text-sm">App</div>
              </div>
            </div>

            {/* Databases */}
            <div className="flex flex-col gap-4">
              {/* Primary */}
              <div className={`border rounded-xl p-4 w-48 transition-colors ${
                primaryLoad > 80 ? 'bg-red-900/40 border-red-500' :
                primaryLoad > 50 ? 'bg-yellow-900/40 border-yellow-500' :
                'bg-gray-800 border-gray-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${
                    primaryLoad > 80 ? 'text-red-400' :
                    primaryLoad > 50 ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}>
                    Primary DB
                  </span>
                  <span className="text-xs text-orange-400">writes</span>
                </div>
                <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      primaryLoad > 80 ? 'bg-red-500' :
                      primaryLoad > 50 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${primaryLoad}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">CPU: {Math.round(primaryLoad)}%</div>
              </div>

              {/* Replica */}
              {replicaEnabled && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-4 w-48">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 font-medium">Replica DB</span>
                    <span className="text-xs text-blue-400">reads</span>
                  </div>
                  <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full transition-all bg-blue-500"
                      style={{ width: `${replicaLoad}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">CPU: {Math.round(replicaLoad)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* Query Stream */}
          <div className="bg-gray-900 rounded-xl p-4 max-w-xl mx-auto">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Query Stream</div>
            <div className="flex flex-wrap gap-2 h-24 overflow-hidden">
              {queries.map(q => (
                <div
                  key={q.id}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    q.type === 'read'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-orange-900/50 text-orange-400'
                  }`}
                >
                  {q.type === 'read' ? 'SELECT' : 'INSERT'}
                  <span className="text-gray-500 ml-1">→ {q.target}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Replication lag warning */}
          {replicaEnabled && (
            <div className="mt-4 max-w-xl mx-auto bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-3 text-yellow-400 text-sm">
              Note: Replicas may have slight lag (~100ms). Reads after writes should use primary.
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
            filename: 'config/database.yml',
            language: 'yaml',
            code: `production:
  primary:
    database: myapp_production
    adapter: postgresql
    host: db-primary.example.com

  primary_replica:
    database: myapp_production
    adapter: postgresql
    host: db-replica.example.com
    replica: true

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# Automatic routing:
# - Model.find, Model.where → replica
# - Model.create, Model.update → primary`,
            highlight: [6, 11, 12, 18, 19, 20],
          }]}
          learningGoal="Read replicas scale read-heavy workloads. Rails 6+ has built-in support for automatic read/write routing."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level21ReadWriteSplit;

/**
 * Level 18: Query Optimization
 *
 * Learn select, pluck, indexes, and query analysis.
 * Player optimizes slow queries using various techniques.
 */

import { useState } from 'react';
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

interface OptimizationTechnique {
  id: string;
  name: string;
  description: string;
  applied: boolean;
}

interface QueryChallenge {
  id: string;
  title: string;
  problem: string;
  badCode: string;
  goodCode: string;
  improvement: string;
  techniques: OptimizationTechnique[];
  solved: boolean;
  memoryBefore: number;
  memoryAfter: number;
  timeBefore: number;
  timeAfter: number;
}

const INITIAL_CHALLENGES: QueryChallenge[] = [
  {
    id: 'select',
    title: 'Too Much Data',
    problem: 'Loading all 50 columns when you only need 2',
    badCode: 'User.all.map(&:email)',
    goodCode: 'User.select(:id, :email)',
    improvement: '95% less memory',
    memoryBefore: 500,
    memoryAfter: 25,
    timeBefore: 200,
    timeAfter: 20,
    solved: false,
    techniques: [
      { id: 'select', name: 'select(:columns)', description: 'Only load needed columns', applied: false },
    ],
  },
  {
    id: 'pluck',
    title: 'Object Overhead',
    problem: 'Creating AR objects just to get an array of values',
    badCode: 'User.all.map(&:email)',
    goodCode: 'User.pluck(:email)',
    improvement: 'No AR objects created',
    memoryBefore: 500,
    memoryAfter: 10,
    timeBefore: 250,
    timeAfter: 30,
    solved: false,
    techniques: [
      { id: 'pluck', name: 'pluck(:column)', description: 'Return raw array, skip AR', applied: false },
    ],
  },
  {
    id: 'index',
    title: 'Full Table Scan',
    problem: 'Finding users by email without an index',
    badCode: 'User.find_by(email: params[:email])',
    goodCode: 'add_index :users, :email, unique: true',
    improvement: 'O(n) → O(log n)',
    memoryBefore: 50,
    memoryAfter: 50,
    timeBefore: 5000,
    timeAfter: 5,
    solved: false,
    techniques: [
      { id: 'index', name: 'add_index', description: 'Create database index', applied: false },
    ],
  },
  {
    id: 'count',
    title: 'Loading to Count',
    problem: 'Loading all records just to count them',
    badCode: 'User.all.length',
    goodCode: 'User.count',
    improvement: 'Database does the counting',
    memoryBefore: 500,
    memoryAfter: 1,
    timeBefore: 300,
    timeAfter: 10,
    solved: false,
    techniques: [
      { id: 'count', name: 'count vs length', description: 'Let DB count, not Ruby', applied: false },
    ],
  },
  {
    id: 'exists',
    title: 'Loading to Check Existence',
    problem: 'Loading a record just to check if any exist',
    badCode: 'User.where(admin: true).first.present?',
    goodCode: 'User.exists?(admin: true)',
    improvement: 'Returns boolean, not record',
    memoryBefore: 100,
    memoryAfter: 1,
    timeBefore: 150,
    timeAfter: 5,
    solved: false,
    techniques: [
      { id: 'exists', name: 'exists?', description: 'Check existence without loading', applied: false },
    ],
  },
];

export function Level18QueryOptimization({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [challenges, setChallenges] = useState<QueryChallenge[]>(INITIAL_CHALLENGES);
  const [activeChallenge, setActiveChallenge] = useState<string>('select');

  const solvedCount = challenges.filter(c => c.solved).length;
  const currentChallenge = challenges.find(c => c.id === activeChallenge)!;

  const validateSolution = (): ValidationResult => {
    const unsolved = challenges.filter(c => !c.solved);
    if (unsolved.length > 0) {
      return {
        valid: false,
        message: 'Optimize all queries!',
        details: unsolved.map(c => `"${c.title}" needs optimization`),
      };
    }
    return { valid: true, message: 'All queries optimized for production!' };
  };

  const applyTechnique = (challengeId: string, techniqueId: string) => {
    setChallenges(prev => prev.map(challenge => {
      if (challenge.id !== challengeId) return challenge;

      const newTechniques = challenge.techniques.map(t =>
        t.id === techniqueId ? { ...t, applied: true } : t
      );

      const allApplied = newTechniques.every(t => t.applied);

      return {
        ...challenge,
        techniques: newTechniques,
        solved: allApplied,
      };
    }));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act3-level18-query-optimization', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your Rails app is slow. Users are complaining. The database is sweating. Let's profile and optimize your queries using Rails best practices."
          instructions={[
            'select: Load only columns you need',
            'pluck: Get raw values, skip AR objects',
            'add_index: Speed up WHERE clauses',
            'count/exists?: Let database do the work',
          ]}
          goal="Learn to write efficient queries that scale to millions of rows."
        >
          {/* Challenge List */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Optimization Challenges
            </div>
            <div className="space-y-2">
              {challenges.map(challenge => (
                <button
                  key={challenge.id}
                  onClick={() => setActiveChallenge(challenge.id)}
                  className={`w-full p-2 rounded-lg text-left transition-all ${
                    activeChallenge === challenge.id
                      ? 'bg-cyan-900/30 border border-cyan-500'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${challenge.solved ? 'text-green-400' : 'text-white'}`}>
                      {challenge.title}
                    </span>
                    {challenge.solved && <span className="text-green-400 text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Optimizations applied</span>
              <span className={solvedCount === challenges.length ? 'text-green-400' : 'text-white'}>
                {solvedCount} / {challenges.length}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(solvedCount / challenges.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={18}
          levelName="Query Optimization"
          actNumber={3}
          onExit={onExit}
          onReset={() => setChallenges(INITIAL_CHALLENGES)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* Challenge Header */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold text-lg">{currentChallenge.title}</div>
                <div className="text-sm text-red-400">{currentChallenge.problem}</div>
              </div>

              {/* Before/After Comparison */}
              <div className="grid grid-cols-2 gap-4 p-4">
                {/* Before */}
                <div className={`rounded-lg border-2 p-4 ${currentChallenge.solved ? 'border-gray-600 opacity-50' : 'border-red-500 bg-red-900/10'}`}>
                  <div className="text-xs text-red-400 font-semibold uppercase mb-2">Before (Slow)</div>
                  <pre className="text-sm text-gray-300 bg-gray-800 p-3 rounded mb-3 overflow-x-auto">
                    <code>{currentChallenge.badCode}</code>
                  </pre>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800 p-2 rounded">
                      <div className="text-gray-500">Memory</div>
                      <div className="text-red-400 font-bold">{currentChallenge.memoryBefore} MB</div>
                    </div>
                    <div className="bg-gray-800 p-2 rounded">
                      <div className="text-gray-500">Time</div>
                      <div className="text-red-400 font-bold">{currentChallenge.timeBefore} ms</div>
                    </div>
                  </div>
                </div>

                {/* After */}
                <div className={`rounded-lg border-2 p-4 ${currentChallenge.solved ? 'border-green-500 bg-green-900/10' : 'border-gray-600 opacity-50'}`}>
                  <div className="text-xs text-green-400 font-semibold uppercase mb-2">After (Optimized)</div>
                  <pre className="text-sm text-gray-300 bg-gray-800 p-3 rounded mb-3 overflow-x-auto">
                    <code>{currentChallenge.goodCode}</code>
                  </pre>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800 p-2 rounded">
                      <div className="text-gray-500">Memory</div>
                      <div className="text-green-400 font-bold">{currentChallenge.memoryAfter} MB</div>
                    </div>
                    <div className="bg-gray-800 p-2 rounded">
                      <div className="text-gray-500">Time</div>
                      <div className="text-green-400 font-bold">{currentChallenge.timeAfter} ms</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Improvement Badge */}
              <div className="px-4 pb-4">
                <div className={`text-center p-3 rounded-lg ${currentChallenge.solved ? 'bg-green-900/30' : 'bg-gray-800'}`}>
                  <span className={`text-sm font-medium ${currentChallenge.solved ? 'text-green-400' : 'text-gray-400'}`}>
                    Improvement: {currentChallenge.improvement}
                  </span>
                </div>
              </div>
            </div>

            {/* Technique Application */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Apply Optimization</div>
                <div className="text-xs text-gray-500">Click to apply the technique</div>
              </div>

              <div className="p-4 space-y-3">
                {currentChallenge.techniques.map(technique => (
                  <button
                    key={technique.id}
                    onClick={() => !technique.applied && applyTechnique(currentChallenge.id, technique.id)}
                    disabled={technique.applied}
                    className={`w-full p-4 rounded-lg text-left transition-all border-2 ${
                      technique.applied
                        ? 'border-green-500 bg-green-900/20 cursor-default'
                        : 'border-cyan-500 bg-cyan-900/20 hover:bg-cyan-900/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`font-mono text-sm ${technique.applied ? 'text-green-400' : 'text-cyan-400'}`}>
                        {technique.name}
                      </span>
                      {technique.applied && <span className="text-green-400">✓ Applied</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{technique.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {currentChallenge.solved && (
              <div className="mt-6 bg-green-900/20 border border-green-600 rounded-xl p-4 text-center">
                <div className="text-green-400 font-semibold">Query Optimized!</div>
                <div className="text-sm text-gray-300">
                  Memory: {currentChallenge.memoryBefore} MB → {currentChallenge.memoryAfter} MB |
                  Time: {currentChallenge.timeBefore} ms → {currentChallenge.timeAfter} ms
                </div>
              </div>
            )}
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'optimization_cheatsheet.rb',
            language: 'ruby',
            code: `# Query Optimization Cheatsheet

# ❌ Bad: Loads all columns
User.all.map(&:email)

# ✅ Good: Only loads needed columns
User.select(:id, :email)

# ✅ Better: Returns array, no AR objects
User.pluck(:email)

# ❌ Bad: Loads all records to count
User.all.length

# ✅ Good: Database counts
User.count

# ❌ Bad: Loads record to check existence
User.find_by(admin: true).present?

# ✅ Good: EXISTS query
User.exists?(admin: true)

# Add indexes for WHERE clauses
add_index :users, :email, unique: true
add_index :posts, :user_id
add_index :posts, [:user_id, :published_at]`,
            highlight: [],
          }]}
          learningGoal="Let the database do the work. Load less data. Use indexes. Profile before optimizing."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Golden Rules</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>1. Profile before optimizing</li>
              <li>2. Load only what you need</li>
              <li>3. Index your WHERE columns</li>
              <li>4. Let DB aggregate, not Ruby</li>
              <li>5. Measure after optimizing</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">EXPLAIN ANALYZE</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# See query plan:
User.where(email: "x")
    .explain

# In rails console:
ActiveRecord::Base
  .connection
  .execute("EXPLAIN...")`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level18QueryOptimization;

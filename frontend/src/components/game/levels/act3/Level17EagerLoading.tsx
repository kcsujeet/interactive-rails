/**
 * Level 17: Eager Loading
 *
 * Fix N+1 with includes, preload, and eager_load.
 * Player applies eager loading strategies to reduce queries.
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

interface LoadingStrategy {
  id: string;
  name: string;
  code: string;
  description: string;
  queries: number | string;
  selected: boolean;
  correct: boolean;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  code: string;
  currentQueries: number;
  strategies: LoadingStrategy[];
  solved: boolean;
}

const INITIAL_SCENARIOS: Scenario[] = [
  {
    id: 'basic',
    title: 'Posts with Authors',
    description: 'Load posts and display author names',
    code: '@posts = Post.all\n# View: post.author.name',
    currentQueries: 101,
    solved: false,
    strategies: [
      { id: 'none', name: 'No Change', code: 'Post.all', description: 'Keep N+1 problem', queries: 101, selected: true, correct: false },
      { id: 'includes', name: 'includes', code: 'Post.includes(:author)', description: 'Loads authors in separate query', queries: 2, selected: false, correct: true },
      { id: 'joins', name: 'joins', code: 'Post.joins(:author)', description: 'Only filters, does not load', queries: 101, selected: false, correct: false },
    ],
  },
  {
    id: 'nested',
    title: 'Posts → Comments → Users',
    description: 'Load posts with comments and their users',
    code: '@posts = Post.all\n# View: comment.user.name',
    currentQueries: 1001,
    solved: false,
    strategies: [
      { id: 'none', name: 'No Change', code: 'Post.all', description: 'Triple N+1!', queries: 1001, selected: true, correct: false },
      { id: 'includes', name: 'includes (nested)', code: 'Post.includes(comments: :user)', description: 'Eager load nested associations', queries: 3, selected: false, correct: true },
      { id: 'flat', name: 'includes (flat)', code: 'Post.includes(:comments)', description: 'Only loads comments', queries: 102, selected: false, correct: false },
    ],
  },
  {
    id: 'conditional',
    title: 'Posts with Filtered Tags',
    description: 'Load posts with specific tags using a WHERE clause',
    code: "@posts = Post.where(tags: { active: true })",
    currentQueries: 101,
    solved: false,
    strategies: [
      { id: 'includes', name: 'includes', code: "Post.includes(:tags).where(tags: { active: true })", description: 'Generates LEFT OUTER JOIN', queries: 2, selected: false, correct: false },
      { id: 'eager_load', name: 'eager_load', code: "Post.eager_load(:tags).where(tags: { active: true })", description: 'Forces LEFT OUTER JOIN', queries: 1, selected: false, correct: true },
      { id: 'preload', name: 'preload', code: "Post.preload(:tags).where(tags: { active: true })", description: 'Separate queries, cannot filter', queries: 'Error!', selected: false, correct: false },
    ],
  },
];

export function Level17EagerLoading({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [scenarios, setScenarios] = useState<Scenario[]>(INITIAL_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState<string>('basic');

  const solvedCount = scenarios.filter(s => s.solved).length;
  const currentScenario = scenarios.find(s => s.id === activeScenario)!;

  const validateSolution = (): ValidationResult => {
    const unsolved = scenarios.filter(s => !s.solved);
    if (unsolved.length > 0) {
      return {
        valid: false,
        message: 'Optimize all scenarios!',
        details: unsolved.map(s => `"${s.title}" still has N+1 problem`),
      };
    }
    return { valid: true, message: 'All queries optimized with eager loading!' };
  };

  const selectStrategy = (scenarioId: string, strategyId: string) => {
    setScenarios(prev => prev.map(scenario => {
      if (scenario.id !== scenarioId) return scenario;

      const newStrategies = scenario.strategies.map(s => ({
        ...s,
        selected: s.id === strategyId,
      }));

      const selectedStrategy = newStrategies.find(s => s.selected);

      return {
        ...scenario,
        strategies: newStrategies,
        currentQueries: typeof selectedStrategy?.queries === 'number' ? selectedStrategy.queries : scenario.currentQueries,
        solved: selectedStrategy?.correct || false,
      };
    }));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act3-level17-eager-loading', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getSelectedStrategy = (scenario: Scenario) => scenario.strategies.find(s => s.selected);

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Now that you understand N+1, let's fix it! Rails provides three eager loading methods. Choose wisely - each has different use cases."
          instructions={[
            'includes: Smart choice, uses separate query or JOIN',
            'preload: Always uses separate queries',
            'eager_load: Always uses LEFT OUTER JOIN',
            'Match the strategy to the scenario',
          ]}
          goal="Choose the right eager loading strategy for each scenario."
        >
          {/* Scenario Tabs */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Scenarios
            </div>
            <div className="space-y-2">
              {scenarios.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => setActiveScenario(scenario.id)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    activeScenario === scenario.id
                      ? 'bg-cyan-900/30 border border-cyan-500'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${scenario.solved ? 'text-green-400' : 'text-white'}`}>
                      {scenario.title}
                    </span>
                    {scenario.solved && <span className="text-green-400 text-xs">✓</span>}
                  </div>
                  <div className="text-xs text-gray-500">{scenario.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Scenarios optimized</span>
              <span className={solvedCount === scenarios.length ? 'text-green-400' : 'text-white'}>
                {solvedCount} / {scenarios.length}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(solvedCount / scenarios.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={17}
          levelName="Eager Loading"
          actNumber={3}
          onExit={onExit}
          onReset={() => setScenarios(INITIAL_SCENARIOS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* Current Scenario */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">{currentScenario.title}</div>
                <div className="text-xs text-gray-500">{currentScenario.description}</div>
              </div>

              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">Current Code:</div>
                <pre className="bg-gray-800 p-3 rounded-lg text-sm text-gray-300 overflow-x-auto">
                  <code>{currentScenario.code}</code>
                </pre>
              </div>

              {/* Query Counter */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50">
                  <div>
                    <div className="text-xs text-gray-500">Database Queries</div>
                    <div className="text-sm text-gray-400">for 100 posts</div>
                  </div>
                  <div className={`text-4xl font-bold ${
                    currentScenario.solved ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {typeof currentScenario.currentQueries === 'number'
                      ? currentScenario.currentQueries
                      : currentScenario.currentQueries}
                  </div>
                </div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Choose Loading Strategy</div>
                <div className="text-xs text-gray-500">Select the best approach for this scenario</div>
              </div>

              <div className="p-4 space-y-3">
                {currentScenario.strategies.map(strategy => {
                  const isSelected = strategy.selected;
                  const isCorrect = strategy.correct;
                  const showResult = isSelected;

                  return (
                    <button
                      key={strategy.id}
                      onClick={() => selectStrategy(currentScenario.id, strategy.id)}
                      className={`w-full p-4 rounded-lg text-left transition-all border-2 ${
                        isSelected
                          ? isCorrect
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-red-500 bg-red-900/20'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`font-mono text-sm ${
                            isSelected
                              ? isCorrect ? 'text-green-400' : 'text-red-400'
                              : 'text-cyan-400'
                          }`}>
                            {strategy.name}
                          </span>
                        </div>
                        <div className={`text-sm font-bold ${
                          typeof strategy.queries === 'number'
                            ? strategy.queries <= 3 ? 'text-green-400' : 'text-red-400'
                            : 'text-red-400'
                        }`}>
                          {strategy.queries} {typeof strategy.queries === 'number' ? 'queries' : ''}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">{strategy.description}</div>
                      <pre className="text-xs bg-gray-900/50 p-2 rounded text-gray-400 overflow-x-auto">
                        <code>{strategy.code}</code>
                      </pre>
                      {showResult && (
                        <div className={`mt-2 text-xs ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {isCorrect ? '✓ Optimal choice!' : '✗ Not the best option for this scenario'}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/models/post.rb',
            language: 'ruby',
            code: `class Post < ApplicationRecord
  belongs_to :author
  has_many :comments
  has_many :tags
end

# Eager Loading Comparison:

# includes (recommended default)
Post.includes(:author)
# Uses separate query OR JOIN
# Smart: adapts to your query

# preload (force separate queries)
Post.preload(:author)
# Always: 2 separate queries
# Cannot use in WHERE clause

# eager_load (force JOIN)
Post.eager_load(:author)
# Always: LEFT OUTER JOIN
# Required for WHERE on association`,
            highlight: [],
          }]}
          learningGoal="includes is usually right. Use eager_load when filtering on associations. Use preload when you need separate queries."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Quick Reference</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span className="text-cyan-400">includes</span>
                <span>Auto-picks best method</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span className="text-yellow-400">preload</span>
                <span>Separate queries only</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span className="text-purple-400">eager_load</span>
                <span>LEFT OUTER JOIN only</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Nested Associations</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# Load multiple levels:
Post.includes(comments: :user)

# Load multiple associations:
Post.includes(:author, :tags)

# Combine both:
Post.includes(:author,
  comments: [:user, :likes]
)`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level17EagerLoading;

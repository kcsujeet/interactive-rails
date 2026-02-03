/**
 * Level 10: Scopes & Query Interface
 *
 * Learn to write reusable query methods with scopes.
 * Player builds scopes to replace repetitive where clauses.
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

interface QueryBlock {
  id: string;
  raw: string;
  scopeName: string | null;
  correctScope: string;
  description: string;
}

const QUERY_BLOCKS: QueryBlock[] = [
  {
    id: 'published',
    raw: "where(published: true)",
    scopeName: null,
    correctScope: 'published',
    description: 'Find all published posts',
  },
  {
    id: 'recent',
    raw: "order(created_at: :desc).limit(10)",
    scopeName: null,
    correctScope: 'recent',
    description: 'Get 10 most recent posts',
  },
  {
    id: 'by_author',
    raw: "where(author_id: author.id)",
    scopeName: null,
    correctScope: 'by_author',
    description: 'Filter posts by author',
  },
  {
    id: 'popular',
    raw: "where('views_count > ?', 1000)",
    scopeName: null,
    correctScope: 'popular',
    description: 'Posts with 1000+ views',
  },
];

const AVAILABLE_SCOPES = ['published', 'recent', 'by_author', 'popular'];

export function Level10Scopes({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [queries, setQueries] = useState<QueryBlock[]>(QUERY_BLOCKS);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

  const scopedQueries = queries.filter(q => q.scopeName === q.correctScope);

  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    const unscopedQueries = queries.filter(q => !q.scopeName);
    if (unscopedQueries.length > 0) {
      errors.push(`${unscopedQueries.length} query(ies) need scopes`);
    }

    const wrongScopes = queries.filter(q => q.scopeName && q.scopeName !== q.correctScope);
    if (wrongScopes.length > 0) {
      errors.push(`${wrongScopes.length} scope(s) have wrong names`);
    }

    if (errors.length > 0) {
      return { valid: false, message: 'Scopes need adjustment!', details: errors };
    }

    return { valid: true, message: 'Clean, reusable scopes!' };
  };

  const assignScope = (queryId: string, scopeName: string) => {
    setQueries(prev =>
      prev.map(q => (q.id === queryId ? { ...q, scopeName } : q))
    );
    setSelectedQuery(null);
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level10-scopes', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Generate the model code preview
  const generateModelCode = () => {
    const scopeLines = queries
      .filter(q => q.scopeName)
      .map(q => {
        if (q.id === 'by_author') {
          return `  scope :${q.scopeName}, ->(author) { ${q.raw} }`;
        }
        return `  scope :${q.scopeName}, -> { ${q.raw} }`;
      });

    return `class Post < ApplicationRecord
${scopeLines.length > 0 ? scopeLines.join('\n') : '  # No scopes defined yet'}
end`;
  };

  // Generate usage examples
  const generateUsageCode = () => {
    const usages = queries
      .filter(q => q.scopeName === q.correctScope)
      .map(q => {
        if (q.id === 'by_author') {
          return `Post.${q.scopeName}(current_user)`;
        }
        return `Post.${q.scopeName}`;
      });

    const chainExample = scopedQueries.length >= 2
      ? `\n# Chain scopes together:\nPost.published.recent.popular`
      : '';

    return `# Clean, readable queries:
${usages.length > 0 ? usages.join('\n') : '# Define scopes first'}
${chainExample}`;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your codebase has the same where() clauses copy-pasted everywhere. When requirements change, you have to update 20 files. There's a better way."
          instructions={[
            'Scopes are reusable query methods',
            'Define once in the model, use everywhere',
            'Match each query with its scope name',
            'Scopes can be chained: Post.published.recent',
          ]}
          goal="DRY up your queries with scopes. Change the logic in one place, update behavior everywhere."
        >
          {/* Available Scope Names */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Scope Names
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map(scope => {
                const isUsed = queries.some(q => q.scopeName === scope);
                const isCorrect = queries.some(q => q.scopeName === scope && q.correctScope === scope);
                return (
                  <button
                    key={scope}
                    onClick={() => selectedQuery && assignScope(selectedQuery, scope)}
                    disabled={!selectedQuery}
                    className={`px-3 py-1.5 rounded-lg font-mono text-sm transition-all ${
                      isCorrect
                        ? 'bg-green-900/40 border border-green-600 text-green-400'
                        : isUsed
                        ? 'bg-red-900/40 border border-red-600 text-red-400'
                        : selectedQuery
                        ? 'bg-purple-900/40 border border-purple-500 text-purple-400 hover:bg-purple-800/40 cursor-pointer'
                        : 'bg-gray-800 border border-gray-700 text-gray-500'
                    }`}
                  >
                    :{scope}
                  </button>
                );
              })}
            </div>
            {selectedQuery && (
              <div className="mt-2 text-xs text-purple-400">
                Click a scope name to assign it
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Scopes defined</span>
              <span className={scopedQueries.length === queries.length ? 'text-green-400' : 'text-white'}>
                {scopedQueries.length} / {queries.length}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(scopedQueries.length / queries.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={10}
          levelName="Scopes & Query Interface"
          actNumber={2}
          onExit={onExit}
          onReset={() => setQueries(QUERY_BLOCKS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-gray-400 text-sm mb-2">Transform raw queries into reusable scopes</div>
              <div className="text-xs text-gray-600">Click a query, then click a scope name to assign</div>
            </div>

            {/* Query Blocks */}
            {queries.map(query => {
              const isScoped = query.scopeName === query.correctScope;
              const hasWrongScope = query.scopeName && query.scopeName !== query.correctScope;

              return (
                <div
                  key={query.id}
                  onClick={() => setSelectedQuery(query.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedQuery === query.id
                      ? 'border-purple-500 bg-purple-900/20'
                      : isScoped
                      ? 'border-green-600 bg-green-900/10'
                      : hasWrongScope
                      ? 'border-red-600 bg-red-900/10'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">{query.description}</span>
                    {isScoped && (
                      <span className="text-green-400 text-xs bg-green-900/40 px-2 py-1 rounded">
                        ✓ Scoped
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Before: raw query */}
                    <div className="flex-1 p-3 bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Raw query:</div>
                      <code className="text-amber-400 text-sm">Post.{query.raw}</code>
                    </div>

                    {/* Arrow */}
                    <div className="text-gray-600 text-2xl">→</div>

                    {/* After: scoped */}
                    <div className={`flex-1 p-3 rounded-lg ${
                      query.scopeName
                        ? isScoped ? 'bg-green-900/30' : 'bg-red-900/30'
                        : 'bg-gray-800 border-2 border-dashed border-gray-700'
                    }`}>
                      <div className="text-xs text-gray-500 mb-1">With scope:</div>
                      {query.scopeName ? (
                        <code className={isScoped ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                          Post.{query.scopeName}{query.id === 'by_author' ? '(author)' : ''}
                        </code>
                      ) : (
                        <span className="text-gray-600 text-sm">Select scope name</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Chaining Example */}
            {scopedQueries.length >= 2 && (
              <div className="mt-8 p-4 bg-purple-900/20 border border-purple-600 rounded-xl">
                <div className="text-purple-400 font-semibold mb-2">Scope Chaining</div>
                <code className="text-cyan-400">
                  Post.{scopedQueries.map(q => q.scopeName).join('.')}
                </code>
                <div className="text-gray-400 text-xs mt-2">
                  Scopes can be chained for complex queries!
                </div>
              </div>
            )}
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'app/models/post.rb',
              language: 'ruby',
              code: generateModelCode(),
              highlight: queries.filter(q => q.scopeName === q.correctScope).map((_, i) => i + 2),
            },
            {
              filename: 'usage_examples.rb',
              language: 'ruby',
              code: generateUsageCode(),
              highlight: [],
            },
          ]}
          learningGoal="Scopes encapsulate query logic in the model. They're chainable, reusable, and make your code more readable."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              Scope Syntax
            </div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# Simple scope
scope :published, -> { where(published: true) }

# Scope with argument
scope :by_author, ->(author) { where(author: author) }

# Chain them
Post.published.by_author(user).recent`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level10Scopes;

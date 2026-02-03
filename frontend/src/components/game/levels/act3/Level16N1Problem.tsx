/**
 * Level 16: N+1 Problem
 *
 * Visualize and understand the N+1 query problem.
 * Player sees queries multiplying as they load related data.
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

interface Post {
  id: number;
  title: string;
  authorId: number;
}

interface Author {
  id: number;
  name: string;
  loaded: boolean;
}

const POSTS: Post[] = [
  { id: 1, title: 'Getting Started with Rails', authorId: 1 },
  { id: 2, title: 'ActiveRecord Basics', authorId: 2 },
  { id: 3, title: 'RESTful Routes', authorId: 1 },
  { id: 4, title: 'Testing with RSpec', authorId: 3 },
  { id: 5, title: 'Background Jobs', authorId: 2 },
];

const AUTHORS: Author[] = [
  { id: 1, name: 'Alice', loaded: false },
  { id: 2, name: 'Bob', loaded: false },
  { id: 3, name: 'Charlie', loaded: false },
];

export function Level16N1Problem({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [isRunning, setIsRunning] = useState(false);
  const [queryLog, setQueryLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadedAuthors, setLoadedAuthors] = useState<Set<number>>(new Set());
  const [understood, setUnderstood] = useState(false);

  const totalQueries = queryLog.length;
  const isN1Problem = totalQueries > 2; // More than 1 (posts) + 1 (authors with includes)

  useEffect(() => {
    if (!isRunning || currentStep >= POSTS.length + 1) return;

    const timer = setTimeout(() => {
      if (currentStep === 0) {
        // First query: load all posts
        setQueryLog(prev => [...prev, 'SELECT * FROM posts']);
        setCurrentStep(1);
      } else {
        // N+1: load each author individually
        const post = POSTS[currentStep - 1];
        if (post && !loadedAuthors.has(post.authorId)) {
          setQueryLog(prev => [...prev, `SELECT * FROM authors WHERE id = ${post.authorId}`]);
          setLoadedAuthors(prev => new Set([...prev, post.authorId]));
        }
        setCurrentStep(currentStep + 1);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isRunning, currentStep, loadedAuthors]);

  const startSimulation = () => {
    setIsRunning(true);
    setQueryLog([]);
    setCurrentStep(0);
    setLoadedAuthors(new Set());
  };

  const resetSimulation = () => {
    setIsRunning(false);
    setQueryLog([]);
    setCurrentStep(0);
    setLoadedAuthors(new Set());
    setUnderstood(false);
  };

  const validateSolution = (): ValidationResult => {
    if (!understood) {
      return {
        valid: false,
        message: 'Run the simulation and confirm you understand the problem!',
        details: ['Click "Run Query" to see the N+1 problem in action'],
      };
    }
    return { valid: true, message: 'You understand the N+1 problem!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act3-level16-n1-problem', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getQueryColor = (query: string) => {
    if (query.includes('FROM posts')) return 'text-cyan-400';
    return 'text-orange-400';
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="You're loading posts with their authors. Each page load triggers 6 database queries - one for posts, then one for EACH author. As your site grows, this becomes a performance nightmare."
          instructions={[
            'N+1 means 1 query + N additional queries',
            'Loading 100 posts = 101 queries!',
            'Each query has network latency',
            'Database connections are limited',
          ]}
          goal="Understand why N+1 queries destroy performance before learning how to fix them."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Query Counter
            </div>
            <div className="text-center py-4">
              <div className={`text-5xl font-bold ${totalQueries > 2 ? 'text-red-400' : 'text-green-400'}`}>
                {totalQueries}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {totalQueries === 0 ? 'queries' : totalQueries === 1 ? 'query' : 'queries'}
              </div>
              {isN1Problem && (
                <div className="mt-2 text-xs text-red-400">
                  N+1 detected! ({1} + {totalQueries - 1})
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Performance Impact
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Latency per query</span>
                <span className="text-white">~5ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total latency</span>
                <span className={totalQueries > 2 ? 'text-red-400' : 'text-green-400'}>
                  ~{totalQueries * 5}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">With 1000 posts</span>
                <span className="text-red-400">~5000ms (5 seconds!)</span>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={16}
          levelName="N+1 Problem"
          actNumber={3}
          onExit={onExit}
          onReset={resetSimulation}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* Code Display */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">app/controllers/posts_controller.rb</span>
              </div>
              <pre className="p-4 text-sm overflow-x-auto">
                <code>
                  <span className="text-purple-400">def</span> <span className="text-cyan-400">index</span>{'\n'}
                  {'  '}<span className="text-gray-400"># This innocent-looking code...</span>{'\n'}
                  {'  '}@posts = <span className="text-yellow-400">Post</span>.all{'\n'}
                  <span className="text-purple-400">end</span>
                </code>
              </pre>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">app/views/posts/index.html.erb</span>
              </div>
              <pre className="p-4 text-sm overflow-x-auto">
                <code>
                  <span className="text-gray-400">&lt;% @posts.each do |post| %&gt;</span>{'\n'}
                  {'  '}<span className="text-cyan-400">&lt;h2&gt;</span>{'<%= post.title %>'}<span className="text-cyan-400">&lt;/h2&gt;</span>{'\n'}
                  {'  '}<span className="text-gray-400">&lt;!-- This triggers a query EACH time! --&gt;</span>{'\n'}
                  {'  '}<span className="text-orange-400">&lt;p&gt;</span>By: {'<%= '}<span className="text-red-400">post.author.name</span>{' %>'}<span className="text-orange-400">&lt;/p&gt;</span>{'\n'}
                  <span className="text-gray-400">&lt;% end %&gt;</span>
                </code>
              </pre>
            </div>

            {/* Simulation Control */}
            <div className="flex justify-center mb-6">
              <button
                onClick={startSimulation}
                disabled={isRunning && currentStep <= POSTS.length}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  isRunning && currentStep <= POSTS.length
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {isRunning ? 'Running...' : 'Run Query'}
              </button>
            </div>

            {/* Posts Visualization */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              {POSTS.map((post, index) => {
                const isLoaded = currentStep > index + 1 || (currentStep === index + 1 && loadedAuthors.has(post.authorId));
                const isLoading = currentStep === index + 1 && !loadedAuthors.has(post.authorId);
                const author = AUTHORS.find(a => a.id === post.authorId);

                return (
                  <div
                    key={post.id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isLoading
                        ? 'border-orange-500 bg-orange-900/20 animate-pulse'
                        : isLoaded
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800/50'
                    }`}
                  >
                    <div className="text-xs text-gray-400 truncate">{post.title}</div>
                    <div className={`text-xs mt-1 ${isLoaded ? 'text-green-400' : 'text-gray-600'}`}>
                      {isLoaded ? `By: ${author?.name}` : isLoading ? 'Loading...' : 'Author: ?'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Query Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                <span className="text-gray-400 text-sm font-semibold">Database Query Log</span>
                <span className={`text-xs px-2 py-1 rounded ${totalQueries > 2 ? 'bg-red-900/50 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
                  {totalQueries} queries
                </span>
              </div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
                {queryLog.length === 0 ? (
                  <div className="text-gray-600">Click "Run Query" to start...</div>
                ) : (
                  queryLog.map((query, i) => (
                    <div key={i} className={`${getQueryColor(query)} flex gap-2`}>
                      <span className="text-gray-600">[{i + 1}]</span>
                      <span>{query}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Understanding Confirmation */}
            {totalQueries > 2 && !understood && (
              <div className="mt-6 bg-red-900/20 border border-red-600 rounded-xl p-4">
                <div className="text-red-400 font-semibold mb-2">The N+1 Problem Revealed</div>
                <div className="text-sm text-gray-300 mb-4">
                  You loaded 5 posts but executed {totalQueries} queries. Each <code className="text-orange-400">post.author</code>
                  call triggers a separate database query. With 1000 posts, that's 1001 queries!
                </div>
                <button
                  onClick={() => setUnderstood(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium"
                >
                  I Understand the Problem
                </button>
              </div>
            )}

            {understood && (
              <div className="mt-6 bg-green-900/20 border border-green-600 rounded-xl p-4">
                <div className="text-green-400 font-semibold">Ready to Learn the Solution!</div>
                <div className="text-sm text-gray-300">
                  In the next level, you'll learn how to use <code className="text-cyan-400">includes</code> to
                  eager load associations and reduce these {totalQueries} queries down to just 2.
                </div>
              </div>
            )}
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'query_log.sql',
            language: 'sql',
            code: queryLog.length > 0
              ? queryLog.map((q, i) => `-- Query ${i + 1}\n${q};`).join('\n\n')
              : '-- No queries yet\n-- Click "Run Query" to start',
            highlight: [],
          }]}
          learningGoal="N+1 = 1 query for the collection + N queries for each item's association. This scales terribly."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Why It's Bad</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>- Each query has network latency</li>
              <li>- Database connections are limited</li>
              <li>- Scales linearly with data size</li>
              <li>- Often invisible until production</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Coming Next</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# The fix (Level 17):
Post.includes(:author).all

# Result: Only 2 queries!
# SELECT * FROM posts
# SELECT * FROM authors
#   WHERE id IN (1, 2, 3)`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level16N1Problem;

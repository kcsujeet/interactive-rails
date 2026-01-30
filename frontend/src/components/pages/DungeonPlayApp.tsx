/**
 * Dungeon Play App Component
 *
 * The main dungeon gameplay interface with pipeline builder and simulation.
 */

import { useState, useEffect } from 'react';

interface DungeonPlayAppProps {
  dungeonId: string;
}

type GameState = 'loading' | 'briefing' | 'playing' | 'paused' | 'completed' | 'failed';

interface DungeonData {
  id: string;
  name: string;
  description: string;
  rooms: Array<{ id: string; name: string; description: string }>;
  concepts: string[];
}

const dungeonInfo: Record<string, { name: string; description: string; concepts: string[] }> = {
  'tutorial-n-plus-one': {
    name: 'N+1 Query Tutorial',
    description: 'Learn to identify and fix the infamous N+1 query problem using Rails eager loading.',
    concepts: ['N+1 queries', 'Eager loading', 'includes()', 'Query optimization'],
  },
  'tutorial-indexing': {
    name: 'Database Indexing Tutorial',
    description: 'Learn to speed up queries with proper database indexes.',
    concepts: ['Database indexes', 'Query optimization', 'EXPLAIN ANALYZE'],
  },
  'tutorial-caching': {
    name: 'Rails Caching Tutorial',
    description: 'Implement caching strategies to dramatically improve performance.',
    concepts: ['Fragment caching', 'Russian doll caching', 'Rails.cache'],
  },
  'boss-database': {
    name: 'The Database Guardian',
    description: 'A boss dungeon that tests all your database optimization skills.',
    concepts: ['All database concepts'],
  },
};

export function DungeonPlayApp({ dungeonId }: DungeonPlayAppProps) {
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [currentRoom, setCurrentRoom] = useState(0);
  const [stability, setStability] = useState(100);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [dungeon, setDungeon] = useState<DungeonData | null>(null);

  useEffect(() => {
    loadDungeon();
  }, [dungeonId]);

  async function loadDungeon() {
    const info = dungeonInfo[dungeonId] || {
      name: 'Unknown Dungeon',
      description: '',
      concepts: [],
    };

    const mockDungeon: DungeonData = {
      id: dungeonId,
      name: info.name,
      description: info.description,
      rooms: [
        { id: 'room-1', name: 'Room 1', description: 'First challenge' },
        { id: 'room-2', name: 'Room 2', description: 'Second challenge' },
        { id: 'room-3', name: 'Room 3', description: 'Final challenge' },
      ],
      concepts: info.concepts,
    };

    setDungeon(mockDungeon);
    setLoading(false);
    setGameState('briefing');
  }

  function startDungeon() {
    setGameState('playing');
  }

  function pauseDungeon() {
    setGameState('paused');
  }

  function resumeDungeon() {
    setGameState('playing');
  }

  function exitDungeon() {
    window.location.href = '/dungeons';
  }

  async function completeDungeon(stars: number, finalStability: number) {
    try {
      const response = await fetch(`/api/pipeline/dungeons/${dungeonId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stars,
          finalStability,
          timeToComplete: 300,
          finalMetrics: {
            avgLatency: 50,
            queriesPerRequest: 3,
            cacheHitRate: 80,
            errorRate: 0,
          },
        }),
      });

      if (response.ok) {
        setGameState('completed');
      }
    } catch (err) {
      console.error('Failed to save completion:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-lg text-gray-400">Loading dungeon...</div>
      </div>
    );
  }

  // Briefing screen
  if (gameState === 'briefing' && dungeon) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-gray-800 rounded-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-4">{dungeon.name}</h1>
          <p className="text-gray-400 mb-6">{dungeon.description}</p>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Concepts you'll learn:</h3>
            <div className="flex flex-wrap gap-2">
              {dungeon.concepts?.map((concept: string) => (
                <span
                  key={concept}
                  className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm"
                >
                  {concept}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Rooms: {dungeon.rooms?.length || 0}
            </h3>
          </div>

          <div className="flex gap-4">
            <button
              onClick={startDungeon}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
            >
              Start Dungeon
            </button>
            <button
              onClick={exitDungeon}
              className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state - main game view
  if (gameState === 'playing' || gameState === 'paused') {
    return (
      <div className="h-[calc(100vh-120px)] flex">
        {/* Left sidebar - Node Palette */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-bold text-white mb-4">Node Palette</h2>
            <p className="text-xs text-gray-400 mb-4">Drag nodes to canvas</p>

            <div className="space-y-2">
              {['Request', 'Router', 'Controller', 'Model', 'Database', 'Cache', 'View', 'Response'].map(
                (node) => (
                  <div
                    key={node}
                    draggable
                    className="p-3 bg-gray-700 rounded-lg border border-gray-600 cursor-move hover:border-gray-500"
                  >
                    <span className="text-sm text-white">{node}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Main canvas area */}
        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold text-white">{dungeon?.name}</h2>
              <span className="text-sm text-gray-400">
                Room {currentRoom + 1}/{dungeon?.rooms?.length || 1}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Stability indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Stability:</span>
                <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stability >= 80
                        ? 'bg-green-500'
                        : stability >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${stability}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-bold ${
                    stability >= 80
                      ? 'text-green-400'
                      : stability >= 50
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {stability}
                </span>
              </div>

              {/* Controls */}
              {gameState === 'playing' ? (
                <button
                  onClick={pauseDungeon}
                  className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeDungeon}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Resume
                </button>
              )}
              <button
                onClick={exitDungeon}
                className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600"
              >
                Exit
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-gray-900 relative overflow-hidden">
            {/* Grid pattern */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Placeholder content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-2">Pipeline Canvas</p>
                <p className="text-gray-600 text-sm">Drag nodes from the palette to build your pipeline</p>
              </div>
            </div>

            {/* Paused overlay */}
            {gameState === 'paused' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center">
                  <h2 className="text-2xl font-bold text-white mb-4">Paused</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={resumeDungeon}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Resume
                    </button>
                    <button
                      onClick={exitDungeon}
                      className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar - Inspector */}
        {isInspectorOpen && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Inspector</h2>
                <button
                  onClick={() => setIsInspectorOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Metrics placeholder */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Latency</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-700 rounded p-2 text-center">
                      <div className="text-gray-400">p50</div>
                      <div className="text-green-400 font-bold">--ms</div>
                    </div>
                    <div className="bg-gray-700 rounded p-2 text-center">
                      <div className="text-gray-400">p95</div>
                      <div className="text-green-400 font-bold">--ms</div>
                    </div>
                    <div className="bg-gray-700 rounded p-2 text-center">
                      <div className="text-gray-400">p99</div>
                      <div className="text-green-400 font-bold">--ms</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Queries</h3>
                  <div className="bg-gray-700 rounded p-3">
                    <div className="text-2xl font-bold text-white">0</div>
                    <div className="text-xs text-gray-400">queries per request</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Objective</h3>
                  <div className="bg-blue-900/30 border border-blue-700 rounded p-3">
                    <div className="text-sm text-blue-300">Observe the N+1 pattern</div>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full w-0 bg-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspector toggle button when closed */}
        {!isInspectorOpen && (
          <button
            onClick={() => setIsInspectorOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 text-gray-400 p-2 rounded-l-lg border border-r-0 border-gray-700 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Completed state
  if (gameState === 'completed') {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4 text-green-400">&#10003;</div>
          <h1 className="text-3xl font-bold text-green-400 mb-2">Dungeon Complete!</h1>
          <p className="text-gray-400 mb-6">{dungeon?.name}</p>

          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((i) => (
              <svg
                key={i}
                className={`w-10 h-10 ${i <= 2 ? 'text-yellow-400' : 'text-gray-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={exitDungeon}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default DungeonPlayApp;

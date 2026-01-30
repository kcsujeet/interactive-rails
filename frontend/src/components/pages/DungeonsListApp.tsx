/**
 * Dungeons List App Component
 *
 * Displays the list of available dungeons with completion status.
 */

import { useState, useEffect } from 'react';

interface DungeonData {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  requiredLevel: number;
  requiredDungeons: string[];
  xpReward: number;
  isAvailable: boolean;
  isCompleted: boolean;
  stars: number;
  bestStability: number;
}

function DungeonCard({
  dungeon,
  onSelect,
}: {
  dungeon: DungeonData;
  onSelect: () => void;
}) {
  const stars = dungeon.stars || 0;
  const isAvailable = dungeon.isAvailable;
  const isCompleted = dungeon.isCompleted;

  return (
    <button
      onClick={onSelect}
      disabled={!isAvailable}
      className={`
        w-full text-left p-6 rounded-xl border-2 transition-all
        ${isAvailable ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750 cursor-pointer' : 'bg-gray-900 border-gray-800 cursor-not-allowed opacity-60'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-white">{dungeon.name}</h3>
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded">
                COMPLETED
              </span>
            )}
          </div>
          <p className="text-gray-400">{dungeon.description}</p>
        </div>
        {!isAvailable && (
          <div className="text-gray-500">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {/* Difficulty stars */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-2">Difficulty:</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              className={`w-4 h-4 ${i < dungeon.difficulty ? 'text-amber-400' : 'text-gray-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        {/* Earned stars (if completed) */}
        {isCompleted && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-2">Earned:</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <svg
                key={i}
                className={`w-5 h-5 ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        )}

        {/* XP reward */}
        <div className="text-sm">
          <span className="text-gray-400">Reward: </span>
          <span className="text-amber-400 font-bold">{dungeon.xpReward} XP</span>
        </div>
      </div>

      {/* Unlock requirements */}
      {!isAvailable && (
        <div className="mt-3 text-xs text-gray-500">
          Requires Level {dungeon.requiredLevel}
          {dungeon.requiredDungeons?.length > 0 && (
            <span> and completion of previous dungeons</span>
          )}
        </div>
      )}
    </button>
  );
}

export function DungeonsListApp() {
  const [dungeons, setDungeons] = useState<DungeonData[]>([]);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDungeons();
  }, []);

  async function fetchDungeons() {
    try {
      const response = await fetch('/api/pipeline/dungeons', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch dungeons');
      }

      const data = await response.json();
      setDungeons(data.data.dungeons);
      setPlayerLevel(data.data.playerLevel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectDungeon(dungeonId: string) {
    window.location.href = `/dungeons/${dungeonId}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-400">Loading dungeons...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-red-400 mb-4">Error: {error}</div>
        <button
          onClick={() => fetchDungeons()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Pipeline Dungeons</h1>
        <p className="text-gray-400">
          Build and optimize Rails request pipelines to defeat performance enemies.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="px-4 py-2 bg-amber-900/30 border border-amber-600 rounded-lg">
            <span className="text-amber-400 font-bold">Level {playerLevel}</span>
          </div>
          <a
            href="/sandbox"
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Practice Mode
          </a>
        </div>
      </div>

      {/* Dungeon grid */}
      <div className="grid gap-4">
        {dungeons.map((dungeon) => (
          <DungeonCard
            key={dungeon.id}
            dungeon={dungeon}
            onSelect={() => handleSelectDungeon(dungeon.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {dungeons.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No dungeons available yet.</p>
        </div>
      )}
    </div>
  );
}

export default DungeonsListApp;

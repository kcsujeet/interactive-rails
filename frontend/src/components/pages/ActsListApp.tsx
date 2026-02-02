/**
 * Acts List App Component
 *
 * Displays the list of Acts with expandable levels and completion status.
 */

import { useState, useEffect } from 'react';
import { ACTS, isLevelUnlocked, getTotalLevelCount } from '../../content/acts';
import type { Act, Level } from '../game/types';

interface LevelProgress {
  levelId: string;
  completed: boolean;
  stars: number;
  bestScore: number;
}

function LevelCard({
  level,
  actNumber,
  isUnlocked,
  progress,
  onSelect,
}: {
  level: Level;
  actNumber: number;
  isUnlocked: boolean;
  progress?: LevelProgress;
  onSelect: () => void;
}) {
  const isCompleted = progress?.completed || false;
  const stars = progress?.stars || 0;

  return (
    <button
      onClick={onSelect}
      disabled={!isUnlocked}
      className={`
        w-full text-left p-4 rounded-lg border transition-all
        ${isUnlocked
          ? 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750 cursor-pointer'
          : 'bg-gray-900 border-gray-800 cursor-not-allowed opacity-50'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-mono">
              {actNumber}.{level.levelNumber}
            </span>
            <h4 className="text-base font-semibold text-white">{level.name}</h4>
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded">
                ✓
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{level.trigger.description}</p>
        </div>
        {!isUnlocked && (
          <div className="text-gray-600 ml-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Stars if completed */}
      {isCompleted && stars > 0 && (
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <svg
              key={i}
              className={`w-4 h-4 ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      )}

      {/* Concept taught */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
          {level.learningContent.title}
        </span>
      </div>
    </button>
  );
}

function ActSection({
  act,
  completedLevels,
  levelProgress,
  defaultExpanded,
}: {
  act: Act;
  completedLevels: string[];
  levelProgress: Map<string, LevelProgress>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const completedCount = act.levels.filter(l => completedLevels.includes(l.id)).length;
  const totalCount = act.levels.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Determine if act is locked (no levels unlocked)
  const hasUnlockedLevel = act.levels.some(l => isLevelUnlocked(l.id, completedLevels));

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      hasUnlockedLevel ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-60'
    }`}>
      {/* Act Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-gray-500">
            {act.id}
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-white">{act.name}</h3>
            <p className="text-sm text-gray-400">{act.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="text-right">
            <div className="text-sm text-gray-400">
              {completedCount}/{totalCount} levels
            </div>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          {/* Expand icon */}
          <svg
            className={`w-6 h-6 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Levels */}
      {expanded && (
        <div className="p-4 pt-0 grid gap-2">
          {act.levels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              actNumber={act.id}
              isUnlocked={isLevelUnlocked(level.id, completedLevels)}
              progress={levelProgress.get(level.id)}
              onSelect={() => {
                if (isLevelUnlocked(level.id, completedLevels)) {
                  window.location.href = `/acts/${level.id}`;
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActsListApp() {
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [levelProgress, setLevelProgress] = useState<Map<string, LevelProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgress();
  }, []);

  async function fetchProgress() {
    try {
      const response = await fetch('/api/pipeline/progress', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          const storedUser = localStorage.getItem('railsexpert_user');
          if (!storedUser) {
            window.location.href = '/login';
            return;
          }
          localStorage.removeItem('railsexpert_user');
          window.location.href = '/login';
          return;
        }
        // If API doesn't exist yet, start fresh
        if (response.status === 404) {
          setLoading(false);
          return;
        }
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      if (data.data?.completedLevels) {
        setCompletedLevels(data.data.completedLevels);
      }
      if (data.data?.levelProgress) {
        const progressMap = new Map<string, LevelProgress>();
        for (const progress of data.data.levelProgress) {
          progressMap.set(progress.levelId, progress);
        }
        setLevelProgress(progressMap);
      }
    } catch (err) {
      console.error('Fetch progress error:', err);
      // Don't show error for missing API - just start fresh
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-400">Loading...</div>
      </div>
    );
  }

  const totalLevels = getTotalLevelCount();
  const totalCompleted = completedLevels.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Rails Mastery</h1>
        <p className="text-gray-400">
          Master Rails performance through {totalLevels} levels across {ACTS.length} acts.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
            <span className="text-gray-400">Progress: </span>
            <span className="text-white font-bold">{totalCompleted}/{totalLevels}</span>
          </div>
          <a
            href="/sandbox"
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Sandbox Mode
          </a>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Acts list */}
      <div className="grid gap-4">
        {ACTS.map((act, index) => (
          <ActSection
            key={act.id}
            act={act}
            completedLevels={completedLevels}
            levelProgress={levelProgress}
            defaultExpanded={index === 0 || act.levels.some(l =>
              isLevelUnlocked(l.id, completedLevels) && !completedLevels.includes(l.id)
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default ActsListApp;

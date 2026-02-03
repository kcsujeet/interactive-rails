/**
 * Acts List App Component
 *
 * Displays the list of Acts with expandable levels and completion status.
 */

import { useState, useEffect } from 'react';
import { ACTS, isLevelUnlocked, getTotalLevelCount, getAllLevels } from '../../content/acts';
import type { Act, Level } from '../game/types';
import { getProgress } from '../../lib/progress';

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
  const isCapstone = level.isCapstone || false;

  return (
    <button
      onClick={onSelect}
      disabled={!isUnlocked}
      className={`
        w-full text-left py-2.5 px-3 rounded-md transition-all
        ${isUnlocked
          ? 'hover:bg-slate-800/50 cursor-pointer'
          : 'cursor-not-allowed opacity-40'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
              {level.levelNumber}
            </span>
            <h4 className="text-sm font-medium text-white truncate">{level.name}</h4>
            {isCapstone && (
              <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-medium rounded shrink-0">
                Capstone
              </span>
            )}
            {isCompleted && (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500 truncate">{level.learningContent.title}</span>
            {isCompleted && stars > 0 && (
              <div className="flex items-center gap-px shrink-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-3 h-3 ${i < stars ? 'text-amber-400' : 'text-slate-700'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isUnlocked && (
          <svg className="w-4 h-4 text-slate-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {isUnlocked && !isCompleted && (
          <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
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
    <div className={hasUnlockedLevel ? '' : 'opacity-40'}>
      {/* Act Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-md text-sm font-semibold ${
            completedCount === totalCount
              ? 'bg-emerald-500/15 text-emerald-400'
              : hasUnlockedLevel
                ? 'bg-slate-800 text-white'
                : 'bg-slate-800/50 text-slate-500'
          }`}>
            {act.id}
          </div>
          <div className="text-left">
            <h3 className="text-base font-medium text-white group-hover:text-slate-200">{act.name}</h3>
            <p className="text-xs text-slate-500">{act.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 tabular-nums">{completedCount}/{totalCount}</span>
            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
        <div className="pl-11 pb-4 grid gap-1.5">
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
  const [isGuest, setIsGuest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgress();
  }, []);

  async function fetchProgress() {
    try {
      const progress = await getProgress();
      setIsGuest(progress.isGuest);
      setCompletedLevels(progress.completedLevels);

      const progressMap = new Map<string, LevelProgress>();
      for (const [levelId, entry] of Object.entries(progress.levelProgress)) {
        progressMap.set(levelId, {
          levelId,
          completed: true,
          stars: entry.stars,
          bestScore: entry.bestScore,
        });
      }
      setLevelProgress(progressMap);
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
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  const totalLevels = getTotalLevelCount();
  const totalCompleted = completedLevels.length;
  const allLevels = getAllLevels();
  const currentLevel = allLevels.find((level) => !completedLevels.includes(level.id));
  const currentAct = currentLevel ? ACTS.find((act) => act.id === currentLevel.actId) : ACTS[ACTS.length - 1];
  const capstoneLevel = allLevels.find((level) => level.isCapstone);
  const capstoneCompleted = capstoneLevel ? completedLevels.includes(capstoneLevel.id) : false;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Rails Mastery</h1>
        <p className="text-slate-500">
          Master Rails performance through {totalLevels} levels across {ACTS.length} acts.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="px-4 py-2 bg-game-surface border border-game-border rounded-lg">
            <span className="text-slate-500">Progress: </span>
            <span className="text-white font-semibold tabular-nums">{totalCompleted}/{totalLevels}</span>
          </div>
          <a
            href="/sandbox"
            className="px-4 py-2 bg-game-bg text-slate-400 rounded-lg border border-game-border hover:bg-game-border/50 hover:text-slate-300 transition-colors"
          >
            Sandbox Mode
          </a>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="mb-8 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">Progress</div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${Math.round((totalCompleted / totalLevels) * 100)}%` }}
              />
            </div>
            <span className="text-sm text-white font-medium tabular-nums">{totalCompleted}/{totalLevels}</span>
          </div>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Current:</span>
          <span className="text-sm text-white font-medium">{currentAct?.name || 'Complete'}</span>
        </div>
        {capstoneCompleted && (
          <>
            <div className="h-4 w-px bg-slate-700" />
            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs font-medium rounded">Capstone Cleared</span>
          </>
        )}
      </div>

      {/* Act Map */}
      <div className="mb-8 flex items-center gap-2">
        {ACTS.map((act, index) => {
          const actCompleted = act.levels.every((level) => completedLevels.includes(level.id));
          const actUnlocked = act.levels.some((level) => isLevelUnlocked(level.id, completedLevels));
          const isActive = currentAct?.id === act.id;

          return (
            <div key={act.id} className="flex items-center gap-2">
              <div
                className={`relative h-8 w-8 rounded-md flex items-center justify-center text-sm font-medium transition-colors ${
                  actCompleted
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : isActive
                      ? 'bg-sky-500/15 text-sky-400'
                      : actUnlocked
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-800/50 text-slate-600'
                }`}
              >
                {act.id}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-400" />
                )}
              </div>
              {index < ACTS.length - 1 && (
                <div className={`h-px w-4 ${actCompleted ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
          );
        })}
      </div>

      {isGuest && (
        <div className="mb-6 flex items-center justify-between gap-4 py-3 px-4 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-slate-300">Playing as guest — progress won't sync across devices</span>
          </div>
          <a
            href="/signup"
            className="text-sm text-sky-400 font-medium hover:text-sky-300 transition-colors"
          >
            Create account →
          </a>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-rose-950/50 border border-rose-900 rounded-lg text-rose-400">
          {error}
        </div>
      )}

      {/* Acts list */}
      <div className="space-y-2">
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

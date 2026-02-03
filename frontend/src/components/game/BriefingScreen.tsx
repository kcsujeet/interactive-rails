/**
 * Briefing Screen Component
 * Pre-game screen showing challenge info
 */

import type { LevelData, LevelChallenge } from './types';

interface BriefingScreenProps {
  level: LevelData;
  challenge: LevelChallenge | undefined;
  onStart: () => void;
  onExit: () => void;
}

/** @deprecated Use level prop instead */
interface LegacyBriefingScreenProps {
  dungeon: LevelData;
  challenge: LevelChallenge | undefined;
  onStart: () => void;
  onExit: () => void;
}

export function BriefingScreen(props: BriefingScreenProps | LegacyBriefingScreenProps) {
  // Support both 'level' and legacy 'dungeon' prop names
  const level = 'level' in props ? props.level : props.dungeon;
  const { challenge, onStart, onExit } = props;

  return (
    <div className="h-full overflow-auto flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Acts</span>
        </button>

        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            {(challenge?.concepts || level.concepts)?.map((concept: string) => (
              <span
                key={concept}
                className="px-2.5 py-1 bg-sky-500/15 text-sky-400 text-xs font-medium rounded"
              >
                {concept}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">{challenge?.name || level.name}</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{challenge?.description || level.description}</p>
        </div>

        {/* Content Grid */}
        <div className="space-y-3">
          {(challenge?.scenario || level.scenario) && (
            <div className="flex gap-4 items-start">
              <div className="w-20 shrink-0 pt-0.5">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Scenario</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed flex-1">{challenge?.scenario || level.scenario}</p>
            </div>
          )}

          {(challenge?.problem || level.problem) && (
            <div className="mt-4 bg-slate-900/80 rounded-lg overflow-hidden border border-slate-800">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Problem</span>
              </div>
              <pre className="p-4 text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {challenge?.problem || level.problem}
              </pre>
            </div>
          )}

          {(challenge?.goal || level.goal) && (
            <div className="mt-4 flex gap-4 items-start bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
              <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Goal</span>
                <p className="text-sm text-emerald-100 leading-relaxed mt-1">{challenge?.goal || level.goal}</p>
              </div>
            </div>
          )}

          {challenge?.initialMetrics && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1 bg-slate-900/60 rounded-lg p-3 text-center border border-slate-800">
                <div className="text-2xl font-semibold text-rose-400 tabular-nums">{challenge.initialMetrics.queries}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">queries</div>
              </div>
              <div className="flex-1 bg-slate-900/60 rounded-lg p-3 text-center border border-slate-800">
                <div className="text-2xl font-semibold text-amber-400 tabular-nums">{challenge.initialMetrics.latency}ms</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">latency</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8">
          <button
            type="button"
            onClick={onStart}
            className="w-full px-6 py-3 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            Start Challenge
          </button>
        </div>
      </div>
    </div>
  );
}

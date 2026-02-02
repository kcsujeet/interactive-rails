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
    <div className="h-full overflow-auto">
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-gray-800 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">{challenge?.name || level.name}</h1>
        <p className="text-gray-400 mb-6">{challenge?.description || level.description}</p>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Concepts:</h3>
          <div className="flex flex-wrap gap-2">
            {(challenge?.concepts || level.concepts)?.map((concept: string) => (
              <span
                key={concept}
                className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>

        {(challenge?.scenario || level.scenario) && (
          <div className="mb-4 bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">Scenario</h3>
            <p className="text-sm text-gray-300">{challenge?.scenario || level.scenario}</p>
          </div>
        )}

        {(challenge?.problem || level.problem) && (
          <div className="mb-4 bg-red-900/20 rounded-lg p-4 border border-red-800/50">
            <h3 className="text-sm font-semibold text-red-400 mb-2">The Problem</h3>
            <pre className="text-sm text-red-200/80 whitespace-pre-wrap font-mono leading-relaxed">
              {challenge?.problem || level.problem}
            </pre>
          </div>
        )}

        {(challenge?.goal || level.goal) && (
          <div className="mb-6 bg-green-900/20 rounded-lg p-4 border border-green-800/50">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Your Goal</h3>
            <p className="text-sm text-green-200/80">{challenge?.goal || level.goal}</p>
          </div>
        )}

        {challenge?.initialMetrics && (
          <div className="mb-6 flex gap-4">
            <div className="flex-1 bg-gray-900 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{challenge.initialMetrics.queries}</div>
              <div className="text-xs text-gray-400">queries</div>
            </div>
            <div className="flex-1 bg-gray-900 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{challenge.initialMetrics.latency}ms</div>
              <div className="text-xs text-gray-400">latency</div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onStart}
            className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
          >
            Start Challenge
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

/**
 * Paused Overlay Component
 */

interface PausedOverlayProps {
  onResume: () => void;
  onExit: () => void;
}

export function PausedOverlay({ onResume, onExit }: PausedOverlayProps) {
  return (
    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-20">
      <div className="bg-game-surface rounded-xl border border-game-border p-8 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-game-bg border border-game-border mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-5">Game Paused</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onResume}
            className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-6 py-2.5 bg-game-bg text-slate-400 font-medium rounded-lg border border-game-border hover:bg-game-border/50 hover:text-slate-300 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

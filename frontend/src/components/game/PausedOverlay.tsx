/**
 * Paused Overlay Component
 */

interface PausedOverlayProps {
  onResume: () => void;
  onExit: () => void;
}

export function PausedOverlay({ onResume, onExit }: PausedOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Paused</h2>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onResume}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

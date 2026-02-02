/**
 * Completion Screen Component
 * Post-game screen showing results
 */

interface CompletionScreenProps {
  levelName: string;
  stars: number;
  onExit: () => void;
}

/** @deprecated Use levelName prop instead */
interface LegacyCompletionScreenProps {
  dungeonName: string;
  stars: number;
  onExit: () => void;
}

export function CompletionScreen(props: CompletionScreenProps | LegacyCompletionScreenProps) {
  // Support both 'levelName' and legacy 'dungeonName' prop names
  const levelName = 'levelName' in props ? props.levelName : props.dungeonName;
  const { stars, onExit } = props;

  return (
    <div className="h-full overflow-auto flex items-center justify-center">
    <div className="max-w-lg mx-auto py-12">
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4 text-green-400">&#10003;</div>
        <h1 className="text-3xl font-bold text-green-400 mb-2">Level Complete!</h1>
        <p className="text-gray-400 mb-6">{levelName}</p>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <svg
              key={`star-${i}`}
              className={`w-10 h-10 ${i <= stars ? 'text-yellow-400' : 'text-gray-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-label={i <= stars ? 'Earned star' : 'Empty star'}
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onExit}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

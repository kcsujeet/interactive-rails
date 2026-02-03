/**
 * Completion Screen Component
 * Post-game screen showing results
 */

interface CompletionScreenProps {
  levelName: string;
  stars: number;
  onExit: () => void;
  learningContent?: {
    title: string;
    conceptExplanation: string;
    railsCodeExample: string;
    commonMistakes: string[];
  };
  nextLevelId?: string;
  isCapstone?: boolean;
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
  const learningContent = 'learningContent' in props ? props.learningContent : undefined;
  const nextLevelId = 'nextLevelId' in props ? props.nextLevelId : undefined;
  const isCapstone = 'isCapstone' in props ? props.isCapstone : false;

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

        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 mb-4">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            {isCapstone ? 'Capstone Complete!' : 'Level Complete!'}
          </h1>
          <p className="text-slate-500">{levelName}</p>

          {/* Stars */}
          <div className="flex justify-center gap-1 mt-5">
            {[1, 2, 3].map((i) => (
              <svg
                key={`star-${i}`}
                className={`w-7 h-7 ${i <= stars ? 'text-amber-400' : 'text-slate-700'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-label={i <= stars ? 'Earned star' : 'Empty star'}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>

        {/* Learning Content */}
        {learningContent && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-sky-500/15 text-sky-400 text-xs font-medium rounded">Concept</span>
                <span className="text-sm font-medium text-white">{learningContent.title}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                {learningContent.conceptExplanation}
              </p>
            </div>

            <div className="bg-slate-900/80 rounded-lg overflow-hidden border border-slate-800">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Rails Example</span>
              </div>
              <pre className="p-4 text-sm text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {learningContent.railsCodeExample}
              </pre>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Common Mistakes</span>
              <ul className="mt-2 text-sm text-slate-400 space-y-1.5">
                {learningContent.commonMistakes.map((mistake) => (
                  <li key={mistake} className="flex items-start gap-2">
                    <span className="text-rose-400">×</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        {nextLevelId && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/acts/${nextLevelId}`;
              }}
              className="w-full px-6 py-3 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Next Level
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

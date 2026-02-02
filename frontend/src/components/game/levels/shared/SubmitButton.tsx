/**
 * Submit Button Component
 *
 * Always-visible submit button that validates the solution on click.
 * Shows feedback about what's wrong if validation fails.
 */

import { useState } from 'react';

export interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

export type ValidateFn = () => ValidationResult;

interface SubmitButtonProps {
  onValidate: ValidateFn;
  onSuccess: () => void;
  label?: string;
  successLabel?: string;
}

export function SubmitButton({
  onValidate,
  onSuccess,
  label = 'Submit Solution',
  successLabel = 'Complete Level',
}: SubmitButtonProps) {
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleClick = async () => {
    const result = onValidate();
    setLastResult(result);

    if (result.valid) {
      setIsCompleting(true);
      await onSuccess();
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={isCompleting}
        className={`w-full py-3 rounded-lg font-bold transition-all shadow-lg ${
          isCompleting
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : lastResult?.valid
              ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-green-900/30'
              : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-cyan-900/30'
        }`}
      >
        {isCompleting ? 'Completing...' : lastResult?.valid ? successLabel : label}
      </button>

      {/* Feedback message */}
      {lastResult && !lastResult.valid && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 animate-shake">
          <div className="text-red-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {lastResult.message}
          </div>
          {lastResult.details && lastResult.details.length > 0 && (
            <ul className="mt-2 text-red-300 text-xs space-y-1">
              {lastResult.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-red-500">-</span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Success message */}
      {lastResult?.valid && (
        <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
          <div className="text-green-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {lastResult.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default SubmitButton;

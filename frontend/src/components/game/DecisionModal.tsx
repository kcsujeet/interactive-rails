/**
 * Decision Modal Component
 *
 * Shows a modal when players need to make decisions,
 * such as choosing relationship types or configuration options.
 */

import { useState } from 'react';
import type { DecisionModalConfig, DecisionOption } from './types';

interface DecisionModalProps {
  config: DecisionModalConfig;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export function DecisionModal({ config, onSelect, onCancel }: DecisionModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const selectedOptionData = config.options.find(o => o.value === selectedOption);

  function handleConfirm() {
    if (selectedOption) {
      onSelect(selectedOption);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{config.question}</h2>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {config.options.map((option) => (
            <OptionButton
              key={option.value}
              option={option}
              selected={selectedOption === option.value}
              onClick={() => setSelectedOption(option.value)}
            />
          ))}
        </div>

        {/* Preview (if option selected) */}
        {selectedOptionData && (
          <div className="px-6 pb-4">
            <button
              className="text-sm text-blue-400 hover:text-blue-300 mb-2"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? '▼ Hide Preview' : '▶ Show Preview'}
            </button>
            {showPreview && selectedOptionData.preview && (
              <div className="bg-gray-800 rounded p-3 text-sm">
                <div className="text-gray-300">{selectedOptionData.preview}</div>
                {selectedOptionData.consequence && (
                  <div className={`mt-2 text-xs ${selectedOptionData.correct === false ? 'text-red-400' : 'text-yellow-400'}`}>
                    ⚠ {selectedOptionData.consequence}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedOption}
            className={`px-6 py-2 rounded font-medium transition-colors ${
              selectedOption
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

interface OptionButtonProps {
  option: DecisionOption;
  selected: boolean;
  onClick: () => void;
}

function OptionButton({ option, selected, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/20 text-white'
          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-blue-500' : 'border-gray-600'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        <div>
          <div className="font-medium">{option.label}</div>
          {option.preview && (
            <div className="text-xs text-gray-500 mt-0.5">{option.preview}</div>
          )}
        </div>
      </div>
    </button>
  );
}

export default DecisionModal;

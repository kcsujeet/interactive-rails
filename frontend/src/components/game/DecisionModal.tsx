/**
 * Decision Modal Component
 *
 * Shows a modal when players need to make decisions,
 * such as choosing relationship types or configuration options.
 */

import { useState } from 'react';
import type { DecisionModalConfig, DecisionOption } from './types';
import { Button } from '../ui/Button';

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
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-2xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{config.question}</h2>
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
            <Button
              variant="link"
              size="sm"
              className="mb-2 p-0 h-auto"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? '▼ Hide Preview' : '▶ Show Preview'}
            </Button>
            {showPreview && selectedOptionData.preview && (
              <div className="bg-secondary rounded p-3 text-sm">
                <div className="text-foreground">{selectedOptionData.preview}</div>
                {selectedOptionData.consequence && (
                  <div className={`mt-2 text-xs ${selectedOptionData.correct === false ? 'text-destructive' : 'text-warning'}`}>
                    ⚠ {selectedOptionData.consequence}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedOption}>
            Confirm
          </Button>
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
    <Button
      variant="ghost"
      onClick={onClick}
      className={`w-full h-auto text-left px-4 py-3 rounded-lg border transition-all justify-start ${
        selected
          ? 'border-primary bg-primary/20 text-foreground'
          : 'border-border bg-secondary text-foreground hover:border-muted-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-primary' : 'border-muted'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>
        <div>
          <div className="font-medium">{option.label}</div>
          {option.preview && (
            <div className="text-xs text-muted-foreground mt-0.5">{option.preview}</div>
          )}
        </div>
      </div>
    </Button>
  );
}

export default DecisionModal;

import type { Challenge } from '../../../../shared/types';
import { Button } from '../ui/Button';

interface CodeChallengeProps {
  challenge: Challenge;
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function CodeChallenge({
  challenge,
  selectedAnswer,
  onSelect,
  isSubmitting,
  onSubmit,
}: CodeChallengeProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedAnswer && !isSubmitting) {
      onSubmit();
    }
  };

  return (
    <div className="code-challenge" onKeyDown={handleKeyDown}>
      {/* Question */}
      <div className="challenge-question">
        <h3>{challenge.question}</h3>
      </div>

      {/* Code Snippet (if any) */}
      {challenge.code_snippet && (
        <div className="challenge-code">
          <pre>
            <code>{challenge.code_snippet}</code>
          </pre>
        </div>
      )}

      {/* Answer Options */}
      {challenge.type === 'multiple_choice' && challenge.options && (
        <div className="challenge-options">
          {challenge.options.map((option) => (
            <Button
              key={option.id}
              variant={selectedAnswer === option.id ? 'default' : 'outline'}
              className={`option-btn ${selectedAnswer === option.id ? 'selected' : ''}`}
              onClick={() => onSelect(option.id)}
              disabled={isSubmitting}
            >
              <span className="option-key">{option.id.toUpperCase()}</span>
              <span className="option-text">{option.text}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Fill in the blank */}
      {challenge.type === 'fill_in_blank' && (
        <div className="challenge-input">
          <input
            type="text"
            placeholder="Type your answer..."
            value={selectedAnswer || ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
      )}

      {/* Submit Button */}
      <div className="challenge-submit">
        <Button
          onClick={onSubmit}
          disabled={!selectedAnswer || isSubmitting}
        >
          {isSubmitting ? 'Attacking...' : 'ATTACK!'}
        </Button>
      </div>

      {/* Difficulty indicator */}
      <div className="challenge-difficulty">
        <span className="difficulty-label">Difficulty:</span>
        <span className="difficulty-stars">
          {'★'.repeat(challenge.difficulty)}
          {'☆'.repeat(5 - challenge.difficulty)}
        </span>
        <span className="xp-reward">+{challenge.xp_reward} XP</span>
      </div>
    </div>
  );
}

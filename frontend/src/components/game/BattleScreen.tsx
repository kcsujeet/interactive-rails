import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $currentChallenge,
  $challengeStartTime,
  $battleResult,
  $progress,
  $currentHpPercent,
  endChallenge,
  nextChallenge,
} from '../../stores/gameStore';
import { submitAnswer } from '../../lib/api';
import type { Challenge } from '../../../../shared/types';
import HealthBar from './HealthBar';
import Monster from './Monster';
import CodeChallenge from './CodeChallenge';

export default function BattleScreen() {
  const challenge = useStore($currentChallenge);
  const startTime = useStore($challengeStartTime);
  const result = useStore($battleResult);
  const progress = useStore($progress);
  const hpPercent = useStore($currentHpPercent);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [monsterHp, setMonsterHp] = useState(100);
  const [showDamage, setShowDamage] = useState(false);

  // Reset monster HP when challenge changes
  useEffect(() => {
    if (challenge) {
      setMonsterHp(100);
      setSelectedAnswer(null);
      setShowDamage(false);
    }
  }, [challenge?.id]);

  if (!challenge) {
    return (
      <div className="battle-empty pixel-panel text-center">
        <p>No active battle. Select a dungeon to begin!</p>
        <a href="/realms" className="pixel-btn">
          Go to Realms
        </a>
      </div>
    );
  }

  async function handleSubmit() {
    if (!selectedAnswer || isSubmitting || !challenge) return;

    setIsSubmitting(true);
    const timeTaken = Date.now() - startTime;

    try {
      const result = await submitAnswer(challenge.id, selectedAnswer, timeTaken);

      if (result.isCorrect) {
        // Show damage animation
        const damagePercent = Math.min(result.damage / challenge.monster.hp * 100, 100);
        setMonsterHp(Math.max(0, monsterHp - damagePercent));
        setShowDamage(true);
        setTimeout(() => setShowDamage(false), 500);
      }

      endChallenge(result);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    const hasMore = nextChallenge();
    if (!hasMore) {
      // Dungeon complete - redirect to results
      window.location.href = '/realms';
    }
  }

  return (
    <div className="battle-screen">
      {/* Player Stats */}
      <div className="player-stats pixel-panel">
        <div className="stat-row">
          <span className="stat-label">HP</span>
          <HealthBar current={progress?.currentHp || 100} max={progress?.maxHp || 100} />
        </div>
        <div className="stat-row">
          <span className="stat-label">LVL {progress?.level || 1}</span>
          <span className="stat-value">{progress?.xp || 0} XP</span>
        </div>
      </div>

      {/* Monster Area */}
      <div className="monster-area">
        <Monster
          name={challenge.monster.name}
          hp={monsterHp}
          image={challenge.monster.image}
          showDamage={showDamage}
          isDefeated={monsterHp <= 0}
        />
      </div>

      {/* Challenge Area */}
      <div className="challenge-area pixel-panel">
        {!result ? (
          <CodeChallenge
            challenge={challenge}
            selectedAnswer={selectedAnswer}
            onSelect={setSelectedAnswer}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        ) : (
          <div className="result-display">
            <div className={`result-header ${result.isCorrect ? 'correct' : 'incorrect'}`}>
              <h2>{result.isCorrect ? '⚔️ HIT!' : '💥 MISS!'}</h2>
              {result.isCorrect ? (
                <p className="xp-gained">+{result.xpGained} XP</p>
              ) : (
                <p className="hp-lost">Monster attacked!</p>
              )}
            </div>

            <div className="explanation">
              <h3>Correct Answer: {result.correctAnswer}</h3>
              <p>{result.explanation}</p>
            </div>

            {result.leveledUp && (
              <div className="level-up">
                🎉 LEVEL UP! You are now level {result.newLevel}!
              </div>
            )}

            <button className="pixel-btn" onClick={handleNext}>
              {monsterHp <= 0 ? 'Continue' : 'Next Attack'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

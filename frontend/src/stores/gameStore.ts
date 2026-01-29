import { atom, computed } from 'nanostores';
import type { Progress, Challenge, ChallengeResult } from '../../../shared/types';

// Player progress
export const $progress = atom<Progress | null>(null);

// Current battle state
export const $currentChallenge = atom<Challenge | null>(null);
export const $challengeStartTime = atom<number>(0);
export const $battleResult = atom<ChallengeResult | null>(null);

// Battle session
export const $currentDungeonId = atom<string | null>(null);
export const $dungeonChallenges = atom<Challenge[]>([]);
export const $currentChallengeIndex = atom<number>(0);

// Computed values
export const $currentHpPercent = computed($progress, (progress) => {
  if (!progress) return 100;
  return Math.round((progress.currentHp / progress.maxHp) * 100);
});

export const $xpToNextLevel = computed($progress, (progress) => {
  if (!progress) return 100;
  // XP formula: 100 * 1.5^(level-1)
  const currentLevelXp = Math.floor(100 * Math.pow(1.5, progress.level - 1));
  const nextLevelXp = Math.floor(100 * Math.pow(1.5, progress.level));
  const xpInCurrentLevel = progress.xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return { current: xpInCurrentLevel, needed: xpNeeded, percent: Math.round((xpInCurrentLevel / xpNeeded) * 100) };
});

// Actions
export function startChallenge(challenge: Challenge) {
  $currentChallenge.set(challenge);
  $challengeStartTime.set(Date.now());
  $battleResult.set(null);
}

export function endChallenge(result: ChallengeResult) {
  $battleResult.set(result);

  // Update progress with new values
  const current = $progress.get();
  if (current) {
    $progress.set({
      ...current,
      xp: current.xp + result.xpGained,
      level: result.newLevel,
      currentHp: result.currentHp,
    });
  }
}

export function nextChallenge() {
  const challenges = $dungeonChallenges.get();
  const currentIndex = $currentChallengeIndex.get();

  if (currentIndex < challenges.length - 1) {
    $currentChallengeIndex.set(currentIndex + 1);
    startChallenge(challenges[currentIndex + 1]);
    return true;
  }

  return false; // No more challenges
}

export function startDungeon(dungeonId: string, challenges: Challenge[]) {
  $currentDungeonId.set(dungeonId);
  $dungeonChallenges.set(challenges);
  $currentChallengeIndex.set(0);
  if (challenges.length > 0) {
    startChallenge(challenges[0]);
  }
}

export function resetBattle() {
  $currentChallenge.set(null);
  $battleResult.set(null);
  $challengeStartTime.set(0);
}

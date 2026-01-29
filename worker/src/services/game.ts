/**
 * Game mechanics calculations
 * Handles XP, damage, HP, and level calculations
 */

import { GAME } from '../constants';

/**
 * XP required to reach a given level (exponential curve)
 */
export function calculateXpForLevel(level: number): number {
  return Math.floor(GAME.XP.BASE * Math.pow(GAME.XP.LEVEL_MULTIPLIER, level - 1));
}

/**
 * Calculate damage dealt to monster based on difficulty and time
 */
export function calculateDamage(difficulty: number, timeTakenMs: number): number {
  const baseDamage = GAME.DAMAGE.BASE + difficulty * GAME.DAMAGE.PER_DIFFICULTY;

  // Speed bonus: faster answers deal more damage
  let speedMultiplier = 1;
  const { CRITICAL, FAST, NORMAL } = GAME.DAMAGE.SPEED_MULTIPLIERS;

  if (timeTakenMs < CRITICAL.threshold) {
    speedMultiplier = CRITICAL.multiplier; // Critical hit!
  } else if (timeTakenMs < FAST.threshold) {
    speedMultiplier = FAST.multiplier;
  } else if (timeTakenMs < NORMAL.threshold) {
    speedMultiplier = NORMAL.multiplier;
  }

  return Math.floor(baseDamage * speedMultiplier);
}

/**
 * Calculate HP lost when answer is wrong
 */
export function calculateHpLost(difficulty: number): number {
  return GAME.HP.WRONG_ANSWER_BASE + difficulty * GAME.HP.WRONG_ANSWER_PER_DIFFICULTY;
}

/**
 * Calculate time bonus multiplier for XP
 */
export function calculateTimeBonus(timeTakenMs: number): number {
  const { FAST, NORMAL } = GAME.TIME_BONUS;

  if (timeTakenMs < FAST.threshold) return FAST.multiplier;
  if (timeTakenMs < NORMAL.threshold) return NORMAL.multiplier;
  return 1;
}

/**
 * Get level from total XP
 */
export function getLevelFromXp(totalXp: number): number {
  let level = 1;
  let xpNeeded = calculateXpForLevel(2);

  while (totalXp >= xpNeeded && level < GAME.MAX_LEVEL) {
    level++;
    xpNeeded = calculateXpForLevel(level + 1);
  }

  return level;
}

/**
 * Calculate max HP for a given level
 */
export function getMaxHp(level: number): number {
  return GAME.HP.BASE + (level - 1) * GAME.HP.PER_LEVEL;
}

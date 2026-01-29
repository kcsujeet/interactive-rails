/**
 * Progress Routes
 * Handles user progress, stats, and achievements
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { ProgressRepository } from '../repositories/progressRepository';
import { getMaxHp } from '../services/game';
import { logger } from '../utils/logger';
import type { Env, UserAchievement } from '../types';

const progressRoutes = new Hono<{ Bindings: Env }>();

// ==================== Achievement Definitions ====================

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Complete your first challenge', icon: 'sword' },
  {
    id: 'perfect_dungeon',
    name: 'Flawless Victory',
    description: 'Complete a dungeon without losing HP',
    icon: 'shield',
  },
  { id: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: 'fire' },
  { id: 'level_10', name: 'Rising Star', description: 'Reach level 10', icon: 'star' },
  { id: 'level_50', name: 'Rails Master', description: 'Reach level 50', icon: 'crown' },
  { id: 'speedster', name: 'Speedster', description: 'Complete a challenge in under 5 seconds', icon: 'lightning' },
  { id: 'realm_complete', name: 'Realm Conqueror', description: 'Complete all dungeons in a realm', icon: 'trophy' },
  { id: 'century', name: 'Centurion', description: 'Complete 100 challenges', icon: 'medal' },
];

// ==================== Helper Functions ====================

function formatProgressResponse(progress: {
  xp: number;
  level: number;
  current_hp: number;
  max_hp: number;
  daily_streak: number;
  current_realm: string | null;
  last_played_at: string | null;
}) {
  return {
    xp: progress.xp,
    level: progress.level,
    currentHp: progress.current_hp,
    maxHp: progress.max_hp,
    dailyStreak: progress.daily_streak,
    currentRealm: progress.current_realm,
    lastPlayedAt: progress.last_played_at,
  };
}

// ==================== Routes ====================

/**
 * GET /api/progress
 * Get user's full progress including stats
 */
progressRoutes.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const progressRepo = new ProgressRepository(c.env.DB);

  const [progress, stats] = await Promise.all([
    progressRepo.getByUserIdOrThrow(userId),
    progressRepo.getStats(userId),
  ]);

  return c.json({
    success: true,
    data: {
      ...formatProgressResponse(progress),
      stats,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/progress/achievements
 * Get user's achievements
 */
progressRoutes.get('/achievements', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const progressRepo = new ProgressRepository(c.env.DB);

  const userAchievements = await progressRepo.getAchievements(userId);
  const unlockedIds = new Set(userAchievements.map((a: UserAchievement) => a.achievement_id));

  const achievementsWithStatus = ACHIEVEMENTS.map((achievement) => {
    const userAchievement = userAchievements.find(
      (a: UserAchievement) => a.achievement_id === achievement.id
    );

    return {
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: userAchievement?.unlocked_at ?? null,
    };
  });

  return c.json({
    success: true,
    data: {
      achievements: achievementsWithStatus,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/progress/restore-hp
 * Restore user's HP to maximum (daily reset or premium feature)
 */
progressRoutes.post('/restore-hp', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const progressRepo = new ProgressRepository(c.env.DB);

  const progress = await progressRepo.getByUserIdOrThrow(userId);
  const maxHp = getMaxHp(progress.level);

  await progressRepo.restoreHp(userId, maxHp);

  logger.info('HP restored', {
    requestId: c.get('requestId'),
    userId,
    maxHp,
  });

  return c.json({
    success: true,
    data: {
      currentHp: maxHp,
      maxHp,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

export { progressRoutes };

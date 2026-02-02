/**
 * Pipeline Routes
 * Handles dungeons, completions, progress, and leaderboards for the pipeline builder game
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { NotFoundError } from '../errors';
import { logger } from '../utils/logger';
import type { Env } from '../types';

const pipelineRoutes = new Hono<{ Bindings: Env }>();

// ==================== Validation Schemas ====================

const completionSchema = z.object({
  stars: z.number().int().min(1).max(3),
  finalStability: z.number().int().min(0).max(100),
  timeToComplete: z.number().int().positive(),
  finalMetrics: z.object({
    avgLatency: z.number(),
    queriesPerRequest: z.number(),
    cacheHitRate: z.number(),
    errorRate: z.number(),
  }),
});

// ==================== Helper Functions ====================

function generateId(): string {
  return crypto.randomUUID();
}

// Calculate XP needed for a level (exponential curve)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate level from total XP
function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

// ==================== Routes ====================

/**
 * GET /api/pipeline/dungeons
 * Get all dungeons with user's completion status
 */
pipelineRoutes.get('/dungeons', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // Get user's progress and completions
  const [progressRow, completionsRows] = await Promise.all([
    db.prepare('SELECT * FROM player_progress WHERE user_id = ?').bind(userId).first(),
    db
      .prepare('SELECT dungeon_id, stars_earned, best_stability FROM dungeon_completions WHERE user_id = ?')
      .bind(userId)
      .all(),
  ]);

  const playerLevel = (progressRow?.level as number) || 1;
  const completions = new Map(
    (completionsRows.results || []).map((r) => [r.dungeon_id, { stars: r.stars_earned, stability: r.best_stability }])
  );

  // Dungeon definitions (in real app, would come from content module)
  // Tutorials unlock by completing the previous one, boss requires all tutorials
  const dungeons = [
    {
      id: 'tutorial-n-plus-one',
      name: 'N+1 Query Tutorial',
      description: 'Learn to identify and fix the infamous N+1 query problem',
      difficulty: 1,
      requiredLevel: 1,
      requiredDungeons: [],
      xpReward: 150,
    },
    {
      id: 'tutorial-indexing',
      name: 'Database Indexing Tutorial',
      description: 'Learn to speed up queries with proper database indexes',
      difficulty: 2,
      requiredLevel: 1,
      requiredDungeons: ['tutorial-n-plus-one'],
      xpReward: 200,
    },
    {
      id: 'tutorial-caching',
      name: 'Rails Caching Tutorial',
      description: 'Implement caching strategies to dramatically improve performance',
      difficulty: 3,
      requiredLevel: 1,
      requiredDungeons: ['tutorial-indexing'],
      xpReward: 250,
    },
    {
      id: 'boss-database',
      name: 'The Database Guardian',
      description: 'A boss dungeon that tests all your database optimization skills',
      difficulty: 5,
      requiredLevel: 1,
      requiredDungeons: ['tutorial-n-plus-one', 'tutorial-indexing', 'tutorial-caching'],
      xpReward: 500,
    },
  ];

  // Build response with availability status
  const completedIds = new Set(completions.keys());
  const dungeonsWithStatus = dungeons.map((dungeon) => {
    const completion = completions.get(dungeon.id);
    const isCompleted = !!completion;

    // Check if available
    const meetsLevel = playerLevel >= dungeon.requiredLevel;
    const meetsPrereqs = dungeon.requiredDungeons.every((id) => completedIds.has(id));
    const isAvailable = meetsLevel && meetsPrereqs;

    return {
      ...dungeon,
      isAvailable,
      isCompleted,
      stars: completion?.stars || 0,
      bestStability: completion?.stability || 0,
    };
  });

  return c.json({
    success: true,
    data: {
      dungeons: dungeonsWithStatus,
      playerLevel,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/pipeline/dungeons/:dungeonId
 * Get a specific dungeon's full definition
 */
pipelineRoutes.get('/dungeons/:dungeonId', authMiddleware, async (c) => {
  const { dungeonId } = c.req.param();

  // In a real implementation, this would load the dungeon definition
  // For now, return a placeholder
  const dungeon = {
    id: dungeonId,
    // Full dungeon definition would be loaded from content
  };

  if (!dungeon.id) {
    throw new NotFoundError('Dungeon');
  }

  return c.json({
    success: true,
    data: {
      dungeon,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/pipeline/dungeons/:dungeonId/complete
 * Record a dungeon completion
 */
pipelineRoutes.post(
  '/dungeons/:dungeonId/complete',
  authMiddleware,
  zValidator('json', completionSchema),
  async (c) => {
    const { dungeonId } = c.req.param();
    const { stars, finalStability, timeToComplete, finalMetrics } = c.req.valid('json');
    const userId = c.get('userId');
    const db = c.env.DB;

    // XP rewards by dungeon (would come from content in real app)
    const xpRewards: Record<string, number> = {
      'tutorial-n-plus-one': 150,
      'tutorial-indexing': 200,
      'tutorial-caching': 250,
      'boss-database': 500,
    };
    const xpReward = xpRewards[dungeonId] || 100;

    // Check for existing completion
    const existing = await db
      .prepare('SELECT * FROM dungeon_completions WHERE user_id = ? AND dungeon_id = ?')
      .bind(userId, dungeonId)
      .first();

    const finalMetricsJson = JSON.stringify(finalMetrics);

    if (existing) {
      // Update if this is a better run
      const isNewBestStability = finalStability > (existing.best_stability as number);
      const isNewBestTime = timeToComplete < (existing.best_time_seconds as number);
      const isNewBestStars = stars > (existing.stars_earned as number);

      if (isNewBestStability || isNewBestTime || isNewBestStars) {
        await db
          .prepare(
            `UPDATE dungeon_completions SET
              stars_earned = MAX(stars_earned, ?),
              final_stability = ?,
              time_to_complete_seconds = ?,
              final_metrics = ?,
              best_stability = MAX(best_stability, ?),
              best_time_seconds = MIN(best_time_seconds, ?),
              best_completed_at = CASE WHEN ? > best_stability THEN CURRENT_TIMESTAMP ELSE best_completed_at END,
              attempts = attempts + 1
            WHERE user_id = ? AND dungeon_id = ?`
          )
          .bind(
            stars,
            finalStability,
            timeToComplete,
            finalMetricsJson,
            finalStability,
            timeToComplete,
            finalStability,
            userId,
            dungeonId
          )
          .run();
      } else {
        // Just increment attempts
        await db
          .prepare('UPDATE dungeon_completions SET attempts = attempts + 1 WHERE user_id = ? AND dungeon_id = ?')
          .bind(userId, dungeonId)
          .run();
      }
    } else {
      // First completion
      await db
        .prepare(
          `INSERT INTO dungeon_completions
            (id, user_id, dungeon_id, stars_earned, final_stability, time_to_complete_seconds, final_metrics, best_stability, best_time_seconds)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          userId,
          dungeonId,
          stars,
          finalStability,
          timeToComplete,
          finalMetricsJson,
          finalStability,
          timeToComplete
        )
        .run();
    }

    // Update player progress
    const progress = await db.prepare('SELECT * FROM player_progress WHERE user_id = ?').bind(userId).first();

    if (progress) {
      // Only award XP on first completion
      const xpToAdd = existing ? 0 : xpReward;
      const newXp = (progress.xp as number) + xpToAdd;
      const newLevel = levelFromXp(newXp);
      const dungeonsCompleted = (progress.dungeons_completed as number) + (existing ? 0 : 1);
      const starsEarned = (progress.total_stars_earned as number) + (existing ? Math.max(0, stars - (existing.stars_earned as number)) : stars);

      await db
        .prepare(
          `UPDATE player_progress SET
            xp = ?,
            level = ?,
            dungeons_completed = ?,
            total_stars_earned = ?,
            last_played_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`
        )
        .bind(newXp, newLevel, dungeonsCompleted, starsEarned, userId)
        .run();

      logger.info('Dungeon completed', {
        requestId: c.get('requestId'),
        userId,
        dungeonId,
        stars,
        isFirstCompletion: !existing,
        xpAwarded: xpToAdd,
      });

      return c.json({
        success: true,
        data: {
          isFirstCompletion: !existing,
          xpAwarded: xpToAdd,
          newLevel,
          newTotalXp: newXp,
          stars,
          stability: finalStability,
        },
        meta: {
          requestId: c.get('requestId'),
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Create progress if it doesn't exist
    await db
      .prepare(
        `INSERT INTO player_progress (user_id, xp, level, dungeons_completed, total_stars_earned, last_played_at)
        VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`
      )
      .bind(userId, xpReward, levelFromXp(xpReward), stars)
      .run();

    return c.json({
      success: true,
      data: {
        isFirstCompletion: true,
        xpAwarded: xpReward,
        newLevel: levelFromXp(xpReward),
        newTotalXp: xpReward,
        stars,
        stability: finalStability,
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

/**
 * GET /api/pipeline/progress
 * Get player's progress (level, unlocks, stats)
 */
pipelineRoutes.get('/progress', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  let progress = await db.prepare('SELECT * FROM player_progress WHERE user_id = ?').bind(userId).first();

  if (!progress) {
    // Create default progress
    await db
      .prepare(
        `INSERT INTO player_progress (user_id, level, xp, unlocked_nodes, unlocked_defenses)
        VALUES (?, 1, 0, '["request","router","controller","view","response"]', '["index_turret"]')`
      )
      .bind(userId)
      .run();

    progress = await db.prepare('SELECT * FROM player_progress WHERE user_id = ?').bind(userId).first();
  }

  // Get completed levels (dungeon_id column stores level IDs)
  const completionsRows = await db
    .prepare('SELECT dungeon_id, stars_earned, best_stability FROM dungeon_completions WHERE user_id = ?')
    .bind(userId)
    .all();

  const completedLevels = (completionsRows.results || []).map((r) => r.dungeon_id as string);
  const levelProgress = (completionsRows.results || []).map((r) => ({
    levelId: r.dungeon_id as string,
    completed: true,
    stars: r.stars_earned as number,
    bestScore: r.best_stability as number,
  }));

  // Parse JSON fields
  const unlockedNodes = JSON.parse((progress?.unlocked_nodes as string) || '[]');
  const unlockedDefenses = JSON.parse((progress?.unlocked_defenses as string) || '[]');
  const unlockedActions = JSON.parse((progress?.unlocked_actions as string) || '[]');
  const titles = JSON.parse((progress?.titles as string) || '[]');

  return c.json({
    success: true,
    data: {
      level: progress?.level || 1,
      xp: progress?.xp || 0,
      xpToNextLevel: xpForLevel((progress?.level as number) + 1 || 2),
      unlockedNodes,
      unlockedDefenses,
      unlockedActions,
      titles,
      currentTitle: progress?.current_title || null,
      completedLevels,
      levelProgress,
      stats: {
        dungeonsCompleted: progress?.dungeons_completed || 0,
        totalStarsEarned: progress?.total_stars_earned || 0,
        totalPlayTime: progress?.total_play_time_seconds || 0,
      },
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/pipeline/levels/:levelId/complete
 * Record a level completion (alias for dungeons endpoint for new UI)
 */
pipelineRoutes.post(
  '/levels/:levelId/complete',
  authMiddleware,
  zValidator('json', completionSchema),
  async (c) => {
    const { levelId } = c.req.param();
    const { stars, finalStability, timeToComplete, finalMetrics } = c.req.valid('json');
    const userId = c.get('userId');
    const db = c.env.DB;

    // XP rewards by level (would come from content in real app)
    const xpReward = 100; // Default XP for new levels

    // Check for existing completion
    const existing = await db
      .prepare('SELECT * FROM dungeon_completions WHERE user_id = ? AND dungeon_id = ?')
      .bind(userId, levelId)
      .first();

    const finalMetricsJson = JSON.stringify(finalMetrics);

    if (existing) {
      // Update if this is a better run
      const isNewBestStability = finalStability > (existing.best_stability as number);
      const isNewBestTime = timeToComplete < (existing.best_time_seconds as number);
      const isNewBestStars = stars > (existing.stars_earned as number);

      if (isNewBestStability || isNewBestTime || isNewBestStars) {
        await db
          .prepare(
            `UPDATE dungeon_completions SET
              stars_earned = MAX(stars_earned, ?),
              final_stability = ?,
              time_to_complete_seconds = ?,
              final_metrics = ?,
              best_stability = MAX(best_stability, ?),
              best_time_seconds = MIN(best_time_seconds, ?),
              best_completed_at = CASE WHEN ? > best_stability THEN CURRENT_TIMESTAMP ELSE best_completed_at END,
              attempts = attempts + 1
            WHERE user_id = ? AND dungeon_id = ?`
          )
          .bind(
            stars,
            finalStability,
            timeToComplete,
            finalMetricsJson,
            finalStability,
            timeToComplete,
            finalStability,
            userId,
            levelId
          )
          .run();
      } else {
        // Just increment attempts
        await db
          .prepare('UPDATE dungeon_completions SET attempts = attempts + 1 WHERE user_id = ? AND dungeon_id = ?')
          .bind(userId, levelId)
          .run();
      }
    } else {
      // First completion
      await db
        .prepare(
          `INSERT INTO dungeon_completions
            (id, user_id, dungeon_id, stars_earned, final_stability, time_to_complete_seconds, final_metrics, best_stability, best_time_seconds)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          userId,
          levelId,
          stars,
          finalStability,
          timeToComplete,
          finalMetricsJson,
          finalStability,
          timeToComplete
        )
        .run();
    }

    // Update player progress
    const progress = await db.prepare('SELECT * FROM player_progress WHERE user_id = ?').bind(userId).first();

    if (progress) {
      // Only award XP on first completion
      const xpToAdd = existing ? 0 : xpReward;
      const newXp = (progress.xp as number) + xpToAdd;
      const newLevel = levelFromXp(newXp);
      const levelsCompleted = (progress.dungeons_completed as number) + (existing ? 0 : 1);
      const starsEarned = (progress.total_stars_earned as number) + (existing ? Math.max(0, stars - (existing.stars_earned as number)) : stars);

      await db
        .prepare(
          `UPDATE player_progress SET
            xp = ?,
            level = ?,
            dungeons_completed = ?,
            total_stars_earned = ?,
            last_played_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`
        )
        .bind(newXp, newLevel, levelsCompleted, starsEarned, userId)
        .run();

      logger.info('Level completed', {
        requestId: c.get('requestId'),
        userId,
        levelId,
        stars,
        isFirstCompletion: !existing,
        xpAwarded: xpToAdd,
      });

      return c.json({
        success: true,
        data: {
          isFirstCompletion: !existing,
          xpAwarded: xpToAdd,
          newLevel,
          newTotalXp: newXp,
          stars,
          stability: finalStability,
        },
        meta: {
          requestId: c.get('requestId'),
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Create progress if it doesn't exist
    await db
      .prepare(
        `INSERT INTO player_progress (user_id, xp, level, dungeons_completed, total_stars_earned, last_played_at)
        VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`
      )
      .bind(userId, xpReward, levelFromXp(xpReward), stars)
      .run();

    return c.json({
      success: true,
      data: {
        isFirstCompletion: true,
        xpAwarded: xpReward,
        newLevel: levelFromXp(xpReward),
        newTotalXp: xpReward,
        stars,
        stability: finalStability,
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

/**
 * GET /api/pipeline/leaderboard/:dungeonId
 * Get top scores for a dungeon
 */
pipelineRoutes.get('/leaderboard/:dungeonId', async (c) => {
  const { dungeonId } = c.req.param();
  const db = c.env.DB;
  const sortBy = c.req.query('sort') || 'stability'; // stability or time

  let query: string;
  if (sortBy === 'time') {
    query = `SELECT * FROM leaderboard_entries WHERE dungeon_id = ? ORDER BY time_seconds ASC LIMIT 100`;
  } else {
    query = `SELECT * FROM leaderboard_entries WHERE dungeon_id = ? ORDER BY stability DESC, time_seconds ASC LIMIT 100`;
  }

  const results = await db.prepare(query).bind(dungeonId).all();

  const entries = (results.results || []).map((row, index) => ({
    rank: index + 1,
    username: row.username,
    stability: row.stability,
    timeSeconds: row.time_seconds,
    stars: row.stars,
    achievedAt: row.achieved_at,
  }));

  return c.json({
    success: true,
    data: {
      dungeonId,
      sortBy,
      entries,
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  });
});

export { pipelineRoutes };

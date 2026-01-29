/**
 * Progress Repository
 * Handles all database operations for user progress, achievements, and stats
 */

import type { UserProgress, DungeonProgress, UserAchievement, ChallengeAttempt } from '../types';
import { NotFoundError } from '../errors';
import { GAME } from '../constants';

export interface CreateProgressData {
  userId: string;
}

export interface UpdateProgressData {
  xp?: number;
  level?: number;
  currentHp?: number;
  maxHp?: number;
  dailyStreak?: number;
  currentRealm?: string;
}

export interface RecordAttemptData {
  userId: string;
  challengeId: string;
  realmId: string;
  dungeonId: string;
  isCorrect: boolean;
  timeTakenMs: number;
  answerGiven: string;
}

export interface ProgressStats {
  dungeonsCompleted: number;
  totalDungeons: number;
  challengesAttempted: number;
  challengesCorrect: number;
  accuracy: number;
  realmsCompleted: number;
}

export class ProgressRepository {
  constructor(private db: D1Database) {}

  async findByUserId(userId: string): Promise<UserProgress | null> {
    return this.db
      .prepare('SELECT * FROM user_progress WHERE user_id = ?')
      .bind(userId)
      .first<UserProgress>();
  }

  async getByUserIdOrThrow(userId: string): Promise<UserProgress> {
    const progress = await this.findByUserId(userId);
    if (!progress) {
      throw new NotFoundError('User progress');
    }
    return progress;
  }

  async create(data: CreateProgressData): Promise<UserProgress> {
    const id = crypto.randomUUID();
    const maxHp = GAME.HP.BASE;

    await this.db
      .prepare(
        'INSERT INTO user_progress (id, user_id, xp, level, current_hp, max_hp) VALUES (?, ?, 0, 1, ?, ?)'
      )
      .bind(id, data.userId, maxHp, maxHp)
      .run();

    const progress = await this.findByUserId(data.userId);
    if (!progress) {
      throw new Error('Failed to create progress');
    }

    return progress;
  }

  async updateProgress(userId: string, data: UpdateProgressData): Promise<void> {
    const sets: string[] = [];
    const values: (string | number)[] = [];

    if (data.xp !== undefined) {
      sets.push('xp = ?');
      values.push(data.xp);
    }
    if (data.level !== undefined) {
      sets.push('level = ?');
      values.push(data.level);
    }
    if (data.currentHp !== undefined) {
      sets.push('current_hp = ?');
      values.push(data.currentHp);
    }
    if (data.maxHp !== undefined) {
      sets.push('max_hp = ?');
      values.push(data.maxHp);
    }
    if (data.dailyStreak !== undefined) {
      sets.push('daily_streak = ?');
      values.push(data.dailyStreak);
    }
    if (data.currentRealm !== undefined) {
      sets.push('current_realm = ?');
      values.push(data.currentRealm);
    }

    sets.push('last_played_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await this.db
      .prepare(`UPDATE user_progress SET ${sets.join(', ')} WHERE user_id = ?`)
      .bind(...values)
      .run();
  }

  async addXp(userId: string, xpGained: number, newLevel: number, newHp: number): Promise<void> {
    await this.db
      .prepare(
        'UPDATE user_progress SET xp = xp + ?, level = ?, current_hp = ?, last_played_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      )
      .bind(xpGained, newLevel, newHp, userId)
      .run();
  }

  async reduceHp(userId: string, newHp: number): Promise<void> {
    await this.db
      .prepare(
        'UPDATE user_progress SET current_hp = ?, last_played_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      )
      .bind(newHp, userId)
      .run();
  }

  async restoreHp(userId: string, maxHp: number): Promise<void> {
    await this.db
      .prepare('UPDATE user_progress SET current_hp = ? WHERE user_id = ?')
      .bind(maxHp, userId)
      .run();
  }

  async recordAttempt(data: RecordAttemptData): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO challenge_attempts (id, user_id, challenge_id, realm_id, dungeon_id, is_correct, time_taken_ms, answer_given) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        data.userId,
        data.challengeId,
        data.realmId,
        data.dungeonId,
        data.isCorrect ? 1 : 0,
        data.timeTakenMs,
        data.answerGiven
      )
      .run();
  }

  async getStats(userId: string): Promise<ProgressStats> {
    const [dungeonStats, challengeStats, realmsCompleted] = await Promise.all([
      this.db
        .prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
          FROM dungeon_progress
          WHERE user_id = ?
        `)
        .bind(userId)
        .first<{ total: number; completed: number }>(),
      this.db
        .prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
          FROM challenge_attempts
          WHERE user_id = ?
        `)
        .bind(userId)
        .first<{ total: number; correct: number }>(),
      this.db
        .prepare(`
          SELECT COUNT(DISTINCT realm_id) as count
          FROM dungeon_progress
          WHERE user_id = ? AND is_completed = 1
        `)
        .bind(userId)
        .first<{ count: number }>(),
    ]);

    return {
      dungeonsCompleted: dungeonStats?.completed ?? 0,
      totalDungeons: dungeonStats?.total ?? 0,
      challengesAttempted: challengeStats?.total ?? 0,
      challengesCorrect: challengeStats?.correct ?? 0,
      accuracy: challengeStats?.total
        ? Math.round(((challengeStats.correct ?? 0) / challengeStats.total) * 100)
        : 0,
      realmsCompleted: realmsCompleted?.count ?? 0,
    };
  }

  async getDungeonProgress(userId: string, realmId: string): Promise<DungeonProgress[]> {
    const result = await this.db
      .prepare('SELECT * FROM dungeon_progress WHERE user_id = ? AND realm_id = ?')
      .bind(userId, realmId)
      .all<DungeonProgress>();

    return result.results ?? [];
  }

  async getCompletedDungeonsByRealm(userId: string): Promise<Map<string, number>> {
    const result = await this.db
      .prepare(
        'SELECT realm_id, COUNT(*) as count FROM dungeon_progress WHERE user_id = ? AND is_completed = 1 GROUP BY realm_id'
      )
      .bind(userId)
      .all<{ realm_id: string; count: number }>();

    return new Map((result.results ?? []).map((r) => [r.realm_id, r.count]));
  }

  async getAchievements(userId: string): Promise<UserAchievement[]> {
    const result = await this.db
      .prepare('SELECT * FROM user_achievements WHERE user_id = ?')
      .bind(userId)
      .all<UserAchievement>();

    return result.results ?? [];
  }

  async unlockAchievement(userId: string, achievementId: string): Promise<void> {
    await this.db
      .prepare(
        'INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id) VALUES (?, ?, ?)'
      )
      .bind(crypto.randomUUID(), userId, achievementId)
      .run();
  }
}

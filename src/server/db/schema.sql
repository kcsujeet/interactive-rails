-- Interactive Rails Database Schema v2 - Pipeline Builder System
-- Simplified schema focused on progress and completion tracking
-- Simulation runs client-side, only results are stored

-- Users table (unchanged)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Player progress (pipeline builder)
CREATE TABLE IF NOT EXISTS player_progress (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  -- JSON arrays of unlocked items
  unlocked_actions TEXT DEFAULT '[]',
  unlocked_nodes TEXT DEFAULT '["request","router","controller","view","response"]',
  unlocked_defenses TEXT DEFAULT '["index_turret"]',
  -- Stack choices from Level 1
  stack_choices TEXT DEFAULT NULL,
  -- Guest import tracking
  guest_imported_at DATETIME DEFAULT NULL,
  -- Titles and achievements
  titles TEXT DEFAULT '[]',
  current_title TEXT DEFAULT NULL,
  -- Stats
  total_play_time_seconds INTEGER DEFAULT 0,
  dungeons_completed INTEGER DEFAULT 0,
  total_stars_earned INTEGER DEFAULT 0,
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_played_at DATETIME DEFAULT NULL
);

-- Dungeon completion records (levels)
CREATE TABLE IF NOT EXISTS dungeon_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  -- Completion stats
  stars_earned INTEGER NOT NULL CHECK (stars_earned BETWEEN 1 AND 3),
  final_stability INTEGER NOT NULL CHECK (final_stability BETWEEN 0 AND 100),
  time_to_complete_seconds INTEGER NOT NULL,
  -- Final metrics snapshot (JSON)
  final_metrics TEXT NOT NULL,
  -- Timestamps
  first_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  best_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Best scores tracking
  best_stability INTEGER NOT NULL,
  best_time_seconds INTEGER NOT NULL,
  -- Attempt count
  attempts INTEGER DEFAULT 1,
  UNIQUE(user_id, dungeon_id)
);

CREATE INDEX IF NOT EXISTS idx_dungeon_completions_user ON dungeon_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_completions_dungeon ON dungeon_completions(dungeon_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_completions_stars ON dungeon_completions(stars_earned DESC);

-- Metrics snapshots for analytics and leaderboards
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  -- Snapshot data (JSON with full metrics)
  snapshot_data TEXT NOT NULL,
  -- Context
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('completion', 'personal_best', 'leaderboard')),
  -- Timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_user_dungeon ON metrics_snapshots(user_id, dungeon_id);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_type ON metrics_snapshots(snapshot_type);

-- Leaderboard cache (denormalized for fast reads)
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  dungeon_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  -- Scores
  stability INTEGER NOT NULL,
  time_seconds INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  -- Rank at time of insertion
  rank INTEGER NOT NULL,
  -- Timestamp
  achieved_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dungeon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_dungeon_stability ON leaderboard_entries(dungeon_id, stability DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_dungeon_time ON leaderboard_entries(dungeon_id, time_seconds ASC);

-- User achievements (v2 - expanded)
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  -- Achievement metadata
  progress INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  -- Timestamps
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_complete ON user_achievements(user_id, is_complete);

-- Sessions for auth (unchanged)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Migration helper: view to check schema version
CREATE VIEW IF NOT EXISTS schema_info AS
SELECT
  'v2' AS version,
  'pipeline_builder' AS schema_type,
  CURRENT_TIMESTAMP AS checked_at;

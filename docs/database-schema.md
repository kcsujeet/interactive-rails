# Database Schema

Interactive Rails uses Cloudflare D1 for persistent storage. The source schema lives at `src/server/db/schema.sql`.

## Schema Version

**Version:** v2 progress schema

The schema is optimized for:

- user accounts and auth data
- authenticated progress
- level completions
- guest progress imports
- leaderboard snapshots
- achievements

Some table and column names still use legacy dungeon vocabulary. In current gameplay, those rows store level completion data.

## Entity Overview

```text
users
  |
  +-- player_progress
  |
  +-- dungeon_completions
  |
  +-- metrics_snapshots
  |
  +-- leaderboard_entries
  |
  +-- user_achievements
```

## users

Core account information.

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | User ID |
| `email` | TEXT | Unique email address |
| `username` | TEXT | Unique display name |
| `password_hash` | TEXT | Password hash for legacy auth paths |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Update timestamp |

## player_progress

Tracks player-level progress and unlock state.

```sql
CREATE TABLE IF NOT EXISTS player_progress (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  unlocked_actions TEXT DEFAULT '[]',
  unlocked_nodes TEXT DEFAULT '["request","router","controller","view","response"]',
  unlocked_defenses TEXT DEFAULT '[]',
  stack_choices TEXT DEFAULT NULL,
  guest_imported_at DATETIME DEFAULT NULL,
  titles TEXT DEFAULT '[]',
  current_title TEXT DEFAULT NULL,
  total_play_time_seconds INTEGER DEFAULT 0,
  dungeons_completed INTEGER DEFAULT 0,
  total_stars_earned INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_played_at DATETIME DEFAULT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Primary key and user reference |
| `level` | INTEGER | Player level |
| `xp` | INTEGER | Total XP |
| `unlocked_actions` | TEXT | JSON array of unlocked UI or sandbox actions |
| `unlocked_nodes` | TEXT | JSON array of unlocked pipeline nodes |
| `unlocked_defenses` | TEXT | Legacy unused JSON field, defaults to `[]` |
| `stack_choices` | TEXT | JSON stack choices from Level 1 |
| `guest_imported_at` | DATETIME | Timestamp of one-time guest import |
| `titles` | TEXT | JSON array of earned titles |
| `current_title` | TEXT | Active title |
| `total_play_time_seconds` | INTEGER | Cumulative play time |
| `dungeons_completed` | INTEGER | Legacy name for levels completed |
| `total_stars_earned` | INTEGER | Cumulative stars |

## dungeon_completions

Records level completions. `dungeon_id` stores the current level ID.

```sql
CREATE TABLE IF NOT EXISTS dungeon_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  stars_earned INTEGER NOT NULL CHECK (stars_earned BETWEEN 1 AND 3),
  final_stability INTEGER NOT NULL CHECK (final_stability BETWEEN 0 AND 100),
  time_to_complete_seconds INTEGER NOT NULL,
  final_metrics TEXT NOT NULL,
  first_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  best_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  best_stability INTEGER NOT NULL,
  best_time_seconds INTEGER NOT NULL,
  attempts INTEGER DEFAULT 1,
  UNIQUE(user_id, dungeon_id)
);
```

| Column | Type | Description |
|--------|------|-------------|
| `dungeon_id` | TEXT | Legacy name for level ID |
| `stars_earned` | INTEGER | Best star rating |
| `final_stability` | INTEGER | Compatibility score field |
| `time_to_complete_seconds` | INTEGER | Completion time |
| `final_metrics` | TEXT | JSON metrics snapshot |
| `best_stability` | INTEGER | Best compatibility score |
| `best_time_seconds` | INTEGER | Fastest completion time |
| `attempts` | INTEGER | Attempt count |

## metrics_snapshots

Stores additional metrics for analytics and leaderboard-related records.

```sql
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  snapshot_data TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('completion', 'personal_best', 'leaderboard')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## leaderboard_entries

Denormalized leaderboard cache for fast reads.

```sql
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  dungeon_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  stability INTEGER NOT NULL,
  time_seconds INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  achieved_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dungeon_id, user_id)
);
```

Indexes:

- `idx_leaderboard_dungeon_stability` on `dungeon_id, stability DESC`
- `idx_leaderboard_dungeon_time` on `dungeon_id, time_seconds ASC`

## user_achievements

Tracks achievement progress and completion.

```sql
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  UNIQUE(user_id, achievement_id)
);
```

## Example Queries

### Get completed levels for a user

```sql
SELECT dungeon_id, stars_earned, best_stability, best_time_seconds, attempts
FROM dungeon_completions
WHERE user_id = ?
ORDER BY dungeon_id;
```

### Get a level leaderboard

```sql
SELECT username, stability, time_seconds, stars, rank
FROM leaderboard_entries
WHERE dungeon_id = ?
ORDER BY stability DESC, time_seconds ASC
LIMIT 100;
```

## Cleanup Notes

- New code should use level terminology in TypeScript and UI copy.
- Existing database columns with dungeon names are compatibility names.
- `unlocked_defenses` is retained in the schema to avoid breaking existing databases, but current gameplay does not read or expose it.

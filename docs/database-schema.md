# Database Schema

RailsExpert uses Cloudflare D1 (SQLite) for persistent storage.

## Schema Location

```
worker/src/db/schema.sql
```

## Schema Version

**Version:** v2 (Pipeline Builder System)

The schema is optimized for:
- Progress and completion tracking
- Client-side simulation (only results are stored)
- Leaderboards and achievements

## Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │──────┐
│ username        │      │
│ password_hash   │      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
         │               │
         │ 1:1           │ 1:N
         ▼               │
┌─────────────────┐      │
│ player_progress │      │
├─────────────────┤      │
│ user_id (PK/FK) │      │
│ level           │      │
│ xp              │      │
│ unlocked_nodes  │      │
│ unlocked_defenses│     │
│ stack_choices   │      │
│ titles          │      │
│ total_stars     │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│dungeon_completions│    │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ dungeon_id      │      │
│ stars_earned    │      │
│ final_stability │      │
│ final_metrics   │      │
│ attempts        │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│metrics_snapshots│      │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ dungeon_id      │      │
│ snapshot_data   │      │
│ snapshot_type   │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│leaderboard_entries│   │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ dungeon_id      │      │
│ user_id (FK)    │      │
│ stability       │      │
│ time_seconds    │      │
│ rank            │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│user_achievements│      │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ achievement_id  │      │
│ progress        │      │
│ is_complete     │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│    sessions     │      │
├─────────────────┤      │
│ id (PK)         │◀─────┘
│ user_id (FK)    │
│ token           │
│ expires_at      │
└─────────────────┘
```

## Table Definitions

### users

Core user account information.

```sql
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
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| email | TEXT | UNIQUE, NOT NULL | User's email address |
| username | TEXT | UNIQUE, NOT NULL | Display name |
| password_hash | TEXT | NOT NULL | PBKDF2 hashed password |
| created_at | DATETIME | DEFAULT NOW | Account creation time |
| updated_at | DATETIME | DEFAULT NOW | Last update time |

---

### player_progress

Tracks player's game progress, unlocks, and stats.

```sql
CREATE TABLE IF NOT EXISTS player_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  unlocked_actions TEXT DEFAULT '[]',
  unlocked_nodes TEXT DEFAULT '["request","router","controller","serializer","response"]',
  unlocked_defenses TEXT DEFAULT '["index_turret"]',
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

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| user_id | TEXT | - | Primary key, foreign key to users |
| level | INTEGER | 1 | Current player level |
| xp | INTEGER | 0 | Total experience points |
| unlocked_nodes | TEXT | JSON array | Available pipeline node types |
| unlocked_defenses | TEXT | JSON array | Available defense types |
| stack_choices | TEXT | NULL | Level 1 stack choices (JSON) |
| titles | TEXT | JSON array | Earned titles |
| total_stars_earned | INTEGER | 0 | Cumulative stars across all levels |
| dungeons_completed | INTEGER | 0 | Number of levels completed |

**Notes:**
- JSON columns store arrays as TEXT for SQLite compatibility
- Default unlocked nodes: request, router, controller, view, response
- Default unlocked defense: index_turret

---

### dungeon_completions

Records level completions with stats and best scores.

```sql
CREATE TABLE IF NOT EXISTS dungeon_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
| dungeon_id | TEXT | Level ID (e.g., "1-1", "2-5") |
| stars_earned | INTEGER | Current star rating (1-3) |
| final_stability | INTEGER | Most recent stability score (0-100) |
| final_metrics | TEXT | JSON snapshot of completion metrics |
| best_stability | INTEGER | Personal best stability score |
| best_time_seconds | INTEGER | Personal best completion time |
| attempts | INTEGER | Total attempt count |

---

### metrics_snapshots

Stores detailed metrics for analytics and leaderboards.

```sql
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  snapshot_data TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('completion', 'personal_best', 'leaderboard')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Snapshot Type | Description |
|---------------|-------------|
| completion | Regular level completion |
| personal_best | New personal best score |
| leaderboard | Leaderboard-qualifying run |

---

### leaderboard_entries

Denormalized leaderboard cache for fast reads.

```sql
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  dungeon_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

**Indexes:**
- `dungeon_id, stability DESC` - For stability leaderboards
- `dungeon_id, time_seconds ASC` - For speedrun leaderboards

---

### user_achievements

Tracks achievement progress and completion.

```sql
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  UNIQUE(user_id, achievement_id)
);
```

| Column | Description |
|--------|-------------|
| achievement_id | Achievement identifier |
| progress | Current progress (for incremental achievements) |
| is_complete | 0 or 1 (SQLite boolean) |

---

### sessions

Authentication session storage.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Migrations

### Running Migrations

**Local development:**
```bash
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
```

**Production:**
```bash
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql
```

### Reset Local Database

```bash
rm -rf worker/.wrangler/state
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
```

---

## Query Examples

### Get player progress

```sql
SELECT p.*, u.username, u.email
FROM player_progress p
JOIN users u ON p.user_id = u.id
WHERE p.user_id = ?;
```

### Get level completions for user

```sql
SELECT dungeon_id, stars_earned, best_stability, best_time_seconds, attempts
FROM dungeon_completions
WHERE user_id = ?
ORDER BY dungeon_id;
```

### Get leaderboard for a level

```sql
SELECT username, stability, time_seconds, stars, rank
FROM leaderboard_entries
WHERE dungeon_id = ?
ORDER BY stability DESC, time_seconds ASC
LIMIT 100;
```

### Check if user completed a level

```sql
SELECT COUNT(*) > 0 as completed
FROM dungeon_completions
WHERE user_id = ? AND dungeon_id = ?;
```

---

## Schema Info View

Check schema version:

```sql
SELECT * FROM schema_info;
-- Returns: version='v2', schema_type='pipeline_builder'
```

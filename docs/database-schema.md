# Database Schema

RailsExpert uses Cloudflare D1 (SQLite) for persistent storage.

## Schema Location

```
worker/src/db/schema.sql
```

## Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │──────┐
│ password_hash   │      │
│ username        │      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
         │               │
         │ 1:1           │ 1:N
         ▼               │
┌─────────────────┐      │
│  user_progress  │      │
├─────────────────┤      │
│ id (PK)         │      │
│ user_id (FK)    │      │
│ xp              │      │
│ level           │      │
│ current_hp      │      │
│ max_hp          │      │
│ current_realm   │      │
│ daily_streak    │      │
│ last_played_at  │      │
│ created_at      │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│challenge_attempts│     │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ challenge_id    │      │
│ realm_id        │      │
│ dungeon_id      │      │
│ is_correct      │      │
│ time_taken_ms   │      │
│ answer_given    │      │
│ attempted_at    │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│dungeon_progress │      │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ realm_id        │      │
│ dungeon_id      │      │
│ challenges_done │      │
│ total_challenges│      │
│ is_completed    │      │
│ best_score      │      │
│ completed_at    │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│user_achievements│      │
├─────────────────┤      │
│ id (PK)         │◀─────┤
│ user_id (FK)    │      │
│ achievement_id  │      │
│ unlocked_at     │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│    sessions     │      │
├─────────────────┤      │
│ id (PK)         │◀─────┘
│ user_id (FK)    │
│ token           │
│ expires_at      │
│ created_at      │
└─────────────────┘
```

## Table Definitions

### users

Core user account information.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| email | TEXT | UNIQUE, NOT NULL | User's email address |
| password_hash | TEXT | NOT NULL | PBKDF2 hashed password |
| username | TEXT | UNIQUE, NOT NULL | Display name |
| created_at | DATETIME | DEFAULT NOW | Account creation time |
| updated_at | DATETIME | DEFAULT NOW | Last update time |

---

### user_progress

Tracks player's game progress (XP, level, HP, etc.).

```sql
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  current_realm TEXT DEFAULT 'foundation',
  daily_streak INTEGER DEFAULT 0,
  last_played_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | TEXT | - | UUID |
| user_id | TEXT | - | Foreign key to users |
| xp | INTEGER | 0 | Total experience points |
| level | INTEGER | 1 | Current player level (1-100) |
| current_hp | INTEGER | 100 | Current health points |
| max_hp | INTEGER | 100 | Maximum HP (increases with level) |
| current_realm | TEXT | 'foundation' | Last active realm |
| daily_streak | INTEGER | 0 | Consecutive days played |
| last_played_at | DATETIME | NULL | Last activity timestamp |

**Relationships:**
- One-to-one with `users` (each user has exactly one progress record)

---

### challenge_attempts

Records every challenge attempt for analytics and progress tracking.

```sql
CREATE TABLE challenge_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  challenge_id TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INTEGER,
  answer_given TEXT,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID |
| user_id | TEXT | Foreign key to users |
| challenge_id | TEXT | Challenge identifier (e.g., "foundation-mvc-001") |
| realm_id | TEXT | Realm identifier |
| dungeon_id | TEXT | Dungeon identifier |
| is_correct | BOOLEAN | 1 if correct, 0 if wrong |
| time_taken_ms | INTEGER | Milliseconds to answer |
| answer_given | TEXT | User's submitted answer |
| attempted_at | DATETIME | When attempt was made |

**Relationships:**
- Many-to-one with `users` (each user has many attempts)

**Indexes (recommended):**
```sql
CREATE INDEX idx_attempts_user ON challenge_attempts(user_id);
CREATE INDEX idx_attempts_challenge ON challenge_attempts(challenge_id);
```

---

### dungeon_progress

Tracks completion status for each dungeon per user.

```sql
CREATE TABLE dungeon_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  realm_id TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  challenges_completed INTEGER DEFAULT 0,
  total_challenges INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  best_score INTEGER DEFAULT 0,
  completed_at DATETIME,
  UNIQUE(user_id, realm_id, dungeon_id)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID |
| user_id | TEXT | Foreign key to users |
| realm_id | TEXT | Realm identifier |
| dungeon_id | TEXT | Dungeon identifier |
| challenges_completed | INTEGER | Number of challenges solved correctly |
| total_challenges | INTEGER | Total challenges in dungeon (usually 10) |
| is_completed | BOOLEAN | True when all challenges completed |
| best_score | INTEGER | Highest score achieved |
| completed_at | DATETIME | When first completed |

**Unique Constraint:** Each user can only have one progress record per dungeon.

---

### user_achievements

Tracks unlocked achievements/badges.

```sql
CREATE TABLE user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  achievement_id TEXT NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID |
| user_id | TEXT | Foreign key to users |
| achievement_id | TEXT | Achievement identifier |
| unlocked_at | DATETIME | When achievement was earned |

**Unique Constraint:** Each achievement can only be unlocked once per user.

---

### sessions

Authentication sessions for token management.

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID |
| user_id | TEXT | Foreign key to users |
| token | TEXT | JWT token (or session ID) |
| expires_at | DATETIME | Token expiration time |
| created_at | DATETIME | When session was created |

---

## Common Queries

### Get user with progress
```sql
SELECT u.*, p.*
FROM users u
JOIN user_progress p ON u.id = p.user_id
WHERE u.id = ?;
```

### Get dungeon completion for a realm
```sql
SELECT realm_id, COUNT(*) as completed
FROM dungeon_progress
WHERE user_id = ? AND is_completed = 1
GROUP BY realm_id;
```

### Get challenge accuracy
```sql
SELECT
  COUNT(*) as total,
  SUM(is_correct) as correct,
  ROUND(100.0 * SUM(is_correct) / COUNT(*), 1) as accuracy
FROM challenge_attempts
WHERE user_id = ?;
```

### Update XP and check level up
```sql
UPDATE user_progress
SET xp = xp + ?,
    level = ?,
    current_hp = ?,
    last_played_at = CURRENT_TIMESTAMP
WHERE user_id = ?;
```

---

## Migration Commands

### Local Development
```bash
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql --local
```

### Production
```bash
cd worker
bunx wrangler d1 execute railsexpert-db --file=src/db/schema.sql
```

### View Local Database
```bash
# Database is stored in:
# worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/
```

---

## Notes

1. **UUIDs**: All `id` fields use TEXT type for UUID storage (SQLite doesn't have native UUID)

2. **Booleans**: D1/SQLite stores booleans as INTEGER (0/1). TypeScript interfaces should use `boolean`.

3. **Timestamps**: Use `DATETIME` type. SQLite stores as TEXT in ISO format.

4. **Foreign Keys**: D1 supports foreign key constraints but they must be enabled per connection.

5. **No CASCADE**: The schema doesn't use CASCADE deletes. Handle orphaned records in application code.

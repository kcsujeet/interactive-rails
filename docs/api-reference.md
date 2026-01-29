# API Reference

Base URL: `http://localhost:8787` (development) or `https://api.railsexpert.com` (production)

All API endpoints are prefixed with `/api`.

## Authentication

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

## Auth Endpoints

### POST /api/auth/signup

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "username": "railswarrior"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "railswarrior"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `400` - Validation error (missing fields, invalid email)
- `409` - Email or username already exists

---

### POST /api/auth/login

Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "railswarrior"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `401` - Invalid credentials

---

### GET /api/auth/me

Get current authenticated user.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "railswarrior",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### POST /api/auth/logout

Invalidate current session.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## Game Endpoints

### GET /api/game/realms

Get all realms with user's unlock status.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "realms": [
    {
      "id": "foundation",
      "name": "Foundation Fortress",
      "description": "Master the basics of Ruby on Rails",
      "difficulty": "beginner",
      "dungeons": ["mvc", "directory", "routing-basics", "controllers-101", "views-erb"],
      "isUnlocked": true,
      "dungeonsCompleted": 2,
      "totalDungeons": 5,
      "unlockRequirement": null
    },
    {
      "id": "activerecord",
      "name": "ActiveRecord Depths",
      "description": "Dive deep into database interactions",
      "difficulty": "beginner",
      "dungeons": ["models", "associations", "validations", "callbacks", "queries"],
      "isUnlocked": true,
      "dungeonsCompleted": 0,
      "totalDungeons": 5,
      "unlockRequirement": {
        "realm": "foundation"
      }
    }
    // ... more realms
  ]
}
```

**Realm Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique realm identifier |
| name | string | Display name |
| description | string | Realm description |
| difficulty | string | "beginner", "intermediate", "advanced", "expert" |
| dungeons | string[] | Array of dungeon IDs |
| isUnlocked | boolean | Whether user can access this realm |
| dungeonsCompleted | number | How many dungeons user has completed |
| totalDungeons | number | Total dungeons in realm |
| unlockRequirement | object | null | Requirements to unlock |

---

### GET /api/game/realms/:realmId/dungeons

Get dungeons for a specific realm with progress.

**Headers:** `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `realmId` - Realm identifier (e.g., "foundation", "activerecord")

**Response (200 OK):**
```json
{
  "dungeons": [
    {
      "id": "mvc",
      "name": "Dungeon 1",
      "isUnlocked": true,
      "isCompleted": true,
      "challengesCompleted": 10,
      "totalChallenges": 10,
      "bestScore": 950
    },
    {
      "id": "directory",
      "name": "Dungeon 2",
      "isUnlocked": true,
      "isCompleted": false,
      "challengesCompleted": 3,
      "totalChallenges": 10,
      "bestScore": 280
    }
    // ... more dungeons
  ]
}
```

**Errors:**
- `404` - Realm not found

---

### GET /api/game/dungeons/:dungeonId/challenges

Get all challenges for a dungeon (starts a battle session).

**Headers:** `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `dungeonId` - Dungeon identifier (e.g., "mvc", "associations")

**Response (200 OK):**
```json
{
  "challenges": [
    {
      "id": "foundation-mvc-001",
      "type": "multiple_choice",
      "difficulty": 1,
      "xp_reward": 20,
      "question": "What does MVC stand for in Ruby on Rails?",
      "options": [
        { "id": "a", "text": "Model-View-Controller" },
        { "id": "b", "text": "Module-Variable-Class" },
        { "id": "c", "text": "Main-Visual-Component" },
        { "id": "d", "text": "Method-Value-Constant" }
      ],
      "code_snippet": null,
      "monster": {
        "name": "Architecture Gremlin",
        "hp": 30
      }
    }
    // ... 9 more challenges (10 total per dungeon)
  ]
}
```

**Note:** `correct_answer` and `explanation` are NOT included in this response to prevent cheating.

**Challenge Types:**
- `multiple_choice` - Select one option (a, b, c, or d)
- `fill_in_blank` - Type the answer (case-insensitive)
- `code_analysis` - Analyze code snippet and answer

**Errors:**
- `404` - Dungeon not found or has no challenges

---

### POST /api/game/challenges/:challengeId/attempt

Submit an answer to a challenge.

**Headers:** `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `challengeId` - Challenge identifier (e.g., "foundation-mvc-001")

**Request Body:**
```json
{
  "answer": "a",
  "timeTakenMs": 8500
}
```

**Response (200 OK):**
```json
{
  "isCorrect": true,
  "correctAnswer": "a",
  "explanation": "MVC stands for Model-View-Controller, a software design pattern that Rails is built upon.",
  "xpGained": 30,
  "newLevel": 2,
  "currentHp": 100,
  "damage": 15,
  "leveledUp": true
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| isCorrect | boolean | Whether answer was correct |
| correctAnswer | string | The correct answer |
| explanation | string | Explanation of the answer |
| xpGained | number | XP earned (0 if incorrect) |
| newLevel | number | User's current level |
| currentHp | number | User's current HP |
| damage | number | Damage dealt to monster (if correct) |
| leveledUp | boolean | Whether user leveled up |

**Errors:**
- `404` - Challenge not found
- `400` - Invalid request body
- `500` - User progress not found

---

## Progress Endpoints

### GET /api/progress

Get user's full progress data.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "progress": {
    "user_id": "uuid-here",
    "xp": 450,
    "level": 3,
    "current_hp": 85,
    "max_hp": 120,
    "current_realm": "activerecord",
    "daily_streak": 5,
    "last_played_at": "2024-01-15T18:30:00Z"
  }
}
```

---

### GET /api/progress/stats

Get user's gameplay statistics.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "stats": {
    "totalXp": 450,
    "level": 3,
    "challengesCompleted": 28,
    "challengesCorrect": 24,
    "accuracy": 85.7,
    "dungeonsCompleted": 2,
    "realmsCompleted": 0,
    "dailyStreak": 5,
    "longestStreak": 12
  }
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## Testing with cURL

### Sign Up
```bash
curl -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","username":"tester"}'
```

### Login
```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Get Realms (with token)
```bash
TOKEN="your-jwt-token"
curl http://localhost:8787/api/game/realms \
  -H "Authorization: Bearer $TOKEN"
```

### Get Challenges
```bash
curl http://localhost:8787/api/game/dungeons/mvc/challenges \
  -H "Authorization: Bearer $TOKEN"
```

### Submit Answer
```bash
curl -X POST http://localhost:8787/api/game/challenges/foundation-mvc-001/attempt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answer":"a","timeTakenMs":5000}'
```

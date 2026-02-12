# API Reference

Base URL: `http://localhost:8787` (development) or `https://api.railsexpert.com` (production)

All API endpoints are prefixed with `/api`.

## Overview

The RailsExpert API handles:
- **Authentication** - User signup, login, session management
- **Progress** - Level completion tracking, star ratings, achievements
- **Leaderboards** - Per-level rankings

**Note:** Game simulation runs entirely client-side. The API only stores completion results.

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
    "username": "railswarrior",
    "level": 5
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
    "level": 5,
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

## Progress Endpoints

### GET /api/progress

Get user's full progress data including level completions.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "progress": {
    "user_id": "uuid-here",
    "level": 5,
    "xp": 1250,
    "unlocked_nodes": ["request", "router", "controller", "model", "database", "serializer", "response", "cache"],
    "unlocked_defenses": ["index_turret", "cache_shield", "eager_loader"],
    "stack_choices": {
      "database": "postgresql"
    },
    "total_stars_earned": 24,
    "dungeons_completed": 10,
    "last_played_at": "2024-01-15T18:30:00Z"
  },
  "completions": [
    {
      "dungeon_id": "1-1",
      "stars_earned": 3,
      "best_stability": 95,
      "best_time_seconds": 45,
      "attempts": 2
    },
    {
      "dungeon_id": "1-2",
      "stars_earned": 2,
      "best_stability": 78,
      "best_time_seconds": 120,
      "attempts": 5
    }
  ]
}
```

---

### POST /api/progress/complete

Record a level completion.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "levelId": "1-5",
  "stars": 3,
  "stability": 92,
  "timeSeconds": 85,
  "metrics": {
    "latencyP50": 25,
    "latencyP95": 48,
    "latencyP99": 89,
    "throughput": 150,
    "queriesPerRequest": 2,
    "cacheHitRate": 85,
    "errorRate": 0
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "isNewBest": true,
  "xpGained": 300,
  "newLevel": 6,
  "leveledUp": true,
  "unlockedNodes": ["job"],
  "unlockedDefenses": ["worker_drone"]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether completion was recorded |
| isNewBest | boolean | Whether this beat previous best |
| xpGained | number | XP earned from completion |
| newLevel | number | Player's new level |
| leveledUp | boolean | Whether player leveled up |
| unlockedNodes | string[] | Newly unlocked node types |
| unlockedDefenses | string[] | Newly unlocked defenses |

---

### POST /api/progress/import-guest

Import guest progress to authenticated account.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "guestProgress": {
    "completedLevels": [
      { "levelId": "1-1", "stars": 2, "stability": 75 },
      { "levelId": "1-2", "stars": 1, "stability": 55 }
    ],
    "xp": 500,
    "stackChoices": { "database": "postgresql" }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "imported": {
    "levels": 2,
    "xp": 500
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
    "totalXp": 1250,
    "level": 5,
    "levelsCompleted": 10,
    "totalStars": 24,
    "threeStarCount": 6,
    "totalPlayTimeSeconds": 3600,
    "averageStability": 82,
    "bestStability": 98,
    "achievementsUnlocked": 5
  }
}
```

---

## Leaderboard Endpoints

### GET /api/leaderboard/:levelId

Get leaderboard for a specific level.

**URL Parameters:**
- `levelId` - Level identifier (e.g., "1-5", "3-2")

**Query Parameters:**
- `sort` - Sort by "stability" (default) or "time"
- `limit` - Number of entries (default: 100, max: 500)

**Response (200 OK):**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "username": "speedrunner",
      "stability": 98,
      "timeSeconds": 32,
      "stars": 3,
      "achievedAt": "2024-01-14T12:00:00Z"
    },
    {
      "rank": 2,
      "username": "railsmaster",
      "stability": 96,
      "timeSeconds": 45,
      "stars": 3,
      "achievedAt": "2024-01-15T09:30:00Z"
    }
  ],
  "userRank": 15,
  "userEntry": {
    "stability": 82,
    "timeSeconds": 120,
    "stars": 2
  }
}
```

---

## Achievement Endpoints

### GET /api/achievements

Get user's achievements.

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "achievements": [
    {
      "id": "first_pipeline",
      "name": "First Pipeline",
      "description": "Complete your first level",
      "isComplete": true,
      "completedAt": "2024-01-10T10:00:00Z"
    },
    {
      "id": "three_star",
      "name": "Perfectionist",
      "description": "Get 3 stars on any level",
      "isComplete": true,
      "completedAt": "2024-01-12T15:30:00Z"
    },
    {
      "id": "speed_runner",
      "name": "Speed Runner",
      "description": "Complete a level in under 60 seconds",
      "isComplete": false,
      "progress": 0
    }
  ]
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

### Get Progress
```bash
TOKEN="your-jwt-token"
curl http://localhost:8787/api/progress \
  -H "Authorization: Bearer $TOKEN"
```

### Record Completion
```bash
curl -X POST http://localhost:8787/api/progress/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "levelId": "1-1",
    "stars": 3,
    "stability": 92,
    "timeSeconds": 45,
    "metrics": {"latencyP50": 25, "throughput": 150}
  }'
```

### Get Leaderboard
```bash
curl "http://localhost:8787/api/leaderboard/1-5?sort=stability&limit=50"
```

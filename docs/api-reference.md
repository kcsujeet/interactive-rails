# API Reference

The active API is mounted inside the Astro app at `/api/*`. In local development, use the same origin as the frontend.

## Overview

The mounted API currently handles:

- authentication through Better Auth at `/api/auth/**`
- player progress at `/api/pipeline/progress`
- level completion at `/api/pipeline/levels/:levelId/complete`
- guest progress import at `/api/pipeline/progress/import`
- leaderboard reads at `/api/pipeline/leaderboard/:levelId`

## Authentication

Better Auth owns the `/api/auth/**` routes. Client code should use `src/lib/auth-client.ts` instead of calling those routes by hand.

Most pipeline routes require an authenticated session cookie.

## Progress

### GET /api/pipeline/progress

Returns the authenticated player's progress.

**Response**

```json
{
  "success": true,
  "data": {
    "level": 5,
    "xp": 1250,
    "xpToNextLevel": 759,
    "unlockedNodes": ["request", "router", "controller", "serializer", "response"],
    "unlockedActions": ["drag_node", "connect_ports", "view_metrics"],
    "titles": [],
    "currentTitle": null,
    "completedLevels": ["act1-level1-environment"],
    "levelProgress": [
      {
        "levelId": "act1-level1-environment",
        "completed": true,
        "stars": 3,
        "bestScore": 100
      }
    ],
    "stats": {
      "dungeonsCompleted": 1,
      "totalStarsEarned": 3,
      "totalPlayTime": 0
    },
    "stackChoices": {
      "database": "postgres",
      "frontend": "react"
    },
    "guestImportedAt": null
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-04-30T12:00:00.000Z"
  }
}
```

**Notes**

- `dungeonsCompleted` is a legacy response key. It means levels completed.
- The API no longer returns defense unlocks.

## Completion

### POST /api/pipeline/levels/:levelId/complete

Records a level completion.

**Request Body**

```json
{
  "stars": 3,
  "finalStability": 100,
  "timeToComplete": 120,
  "finalMetrics": {
    "avgLatency": 0,
    "queriesPerRequest": 0,
    "cacheHitRate": 0,
    "errorRate": 0
  },
  "stackChoices": {
    "database": "postgres",
    "frontend": "react"
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "isFirstCompletion": true,
    "xpAwarded": 100,
    "newLevel": 2,
    "newTotalXp": 100,
    "stars": 3,
    "stability": 100
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-04-30T12:00:00.000Z"
  }
}
```

**Request Fields**

| Field | Type | Description |
|-------|------|-------------|
| `stars` | number | Star rating, 1 through 3 |
| `finalStability` | number | Compatibility score field, 0 through 100 |
| `timeToComplete` | number | Completion time in seconds |
| `finalMetrics` | object | Metrics snapshot stored with the completion |
| `stackChoices` | object | Optional stack choices from Level 1 |

## Guest Import

### POST /api/pipeline/progress/import

Imports guest progress into the authenticated account. Each account can import guest progress once.

**Request Body**

```json
{
  "completedLevels": ["act1-level1-environment"],
  "levelProgress": {
    "act1-level1-environment": {
      "stars": 3,
      "bestScore": 100
    }
  },
  "stackChoices": {
    "database": "postgres",
    "frontend": "react"
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "importedCompletions": 1,
    "xpAdded": 175,
    "newLevel": 2,
    "newTotalXp": 175
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-04-30T12:00:00.000Z"
  }
}
```

## Leaderboard

### GET /api/pipeline/leaderboard/:levelId

Returns leaderboard rows for a level.

**Query Parameters**

| Parameter | Description |
|-----------|-------------|
| `sort` | `stability` or `time`, defaults to `stability` |

**Response**

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user-id",
        "username": "rails_dev",
        "stability": 100,
        "timeSeconds": 90,
        "stars": 3,
        "achievedAt": "2026-04-30T12:00:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-04-30T12:00:00.000Z"
  }
}
```

## Legacy Pipeline Routes

The router still exposes older dungeon-oriented pipeline routes for compatibility:

- `GET /api/pipeline/dungeons`
- `GET /api/pipeline/dungeons/:dungeonId`
- `POST /api/pipeline/dungeons/:dungeonId/complete`

New gameplay code should use the level-oriented routes above.

# Game Mechanics

This document details the gameplay systems in Interactive Rails.

## Overview

Interactive Rails teaches Rails optimization through pipeline-building gameplay:
- **Pipeline Building** - Drag-drop nodes to create request flows
- **Real-time Simulation** - Watch metrics as requests process
- **Enemy/Defense System** - Combat performance threats
- **Star Ratings** - Earn 1-3 stars based on stability
- **Progressive Unlocks** - Complete levels to unlock new content

---

## Core Gameplay Loop

```
1. Read Briefing
   └─> Understand the problem scenario

2. Build Pipeline
   └─> Drag nodes from palette to canvas
   └─> Connect nodes to create request flow

3. Run Simulation
   └─> Requests flow through your pipeline
   └─> Metrics update in real-time

4. Optimize
   └─> Identify bottlenecks
   └─> Add optimizations (caching, indexing)
   └─> Deploy defenses against enemies

5. Complete Level
   └─> Meet success conditions
   └─> Earn stars based on stability score
```

---

## Pipeline Building

### Node Types

| Node | Color | Purpose |
|------|-------|---------|
| Request | Blue (#3b82f6) | Incoming HTTP request |
| Router | Purple (#a78bfa) | Rails routes.rb dispatcher |
| Controller | Green (#10b981) | ActionController handler |
| Model | Orange (#f59e0b) | ActiveRecord model |
| Database | Red (#ef4444) | PostgreSQL database |
| Serializer | Teal (#14b8a6) | JSON serialization layer |
| Response | Green (#10b981) | HTTP response |
| Service | Indigo (#6366f1) | Service object (business logic) |
| Mailer | Pink (#ec4899) | ActionMailer email delivery |
| Middleware | Slate (#64748b) | Rack middleware layer |
| Cache | Cyan (#06b6d4) | Redis cache layer |
| Job | Violet (#8b5cf6) | Background job (Solid Queue) |

### Connection Rules

Valid connections follow Rails API patterns:

```
Top row:    Request → Router → Controller → Model → Database
                                    ↓
Bottom row:                    Serializer → Response
```

The controller orchestrates both the query path (right to Model/Database) and the response path (down to Serializer/Response). Data never flows directly from Database to Response.

**Valid connections:**
- Request → Router (or Request → Middleware → Router)
- Router → Controller
- Controller → Model
- Controller → Serializer
- Controller → Service
- Controller → Job (async)
- Model → Database
- Model ↔ Cache
- Serializer → Response
- Service → Model
- Service → Mailer
- Middleware → Router

**Invalid connections shown with red dashed line.**

### Pipeline Templates

Most levels with a standard request cycle use reusable templates from `frontend/src/utils/pipelineTemplates.ts` instead of defining nodes inline:

```typescript
import { standardPipeline, middlewarePipeline } from "@/utils/pipelineTemplates";

// Standard 7-node layout (Request, Router, Controller, Model, Database, Serializer, Response)
startingPipeline: standardPipeline()
startingPipeline: standardPipeline({ modelLabel: 'User' })

// With middleware (8-node: adds Middleware between Request and Router)
startingPipeline: middlewarePipeline()
```

See [Content Structure](./content-structure.md#pipeline-templates) for full details on which levels use templates vs custom topologies.

### Node Palette

Nodes available depend on the level:
- Node availability is defined per-level in the act content files (`src/features/act*-*/content.ts`)
- Early levels: Basic MVC nodes only (Request, Router, Controller, Model, Database, Response)
- Later levels: Serializer, Service, Cache, Job, Mailer, Middleware
- Sandbox: All nodes available

---

## Simulation Engine

### Tick-Based Processing

The simulation runs at ~30 FPS:

```typescript
class SimulationEngine {
  tick() {
    this.generateRequests();      // Spawn new requests
    this.processRequests();       // Move through pipeline
    this.calculateMetrics();      // Update latency, throughput
    this.spawnEnemies();          // Based on metrics
    this.activateDefenses();      // Counter enemies
    this.updateStability();       // Calculate score
  }
}
```

### Request Flow

1. **Request spawns** at Request node
2. **Travels through connections** (visualized as particle)
3. **Processed by each node** (adds latency)
4. **Reaches Response node** (request complete)
5. **Metrics updated** (latency recorded)

### Processing Time by Node

| Node | Base Latency | Notes |
|------|--------------|-------|
| Router | 1-2ms | Fast dispatch |
| Controller | 5-10ms | Action processing |
| Model | 10-50ms | Depends on query |
| Database | 20-100ms | Query execution |
| Serializer | 2-10ms | JSON serialization |
| Cache | 1-5ms | Cache hit |
| Cache Miss | +50ms | Falls through to DB |

---

## Metrics

### Inspector Panel Metrics

| Metric | Description | Good | Bad |
|--------|-------------|------|-----|
| Latency p50 | Median response time | < 50ms | > 200ms |
| Latency p95 | 95th percentile | < 100ms | > 500ms |
| Latency p99 | 99th percentile | < 200ms | > 1000ms |
| Throughput | Requests/second | Level target | Below target |
| Queries/Request | DB queries per request | 1-3 | > 10 (N+1) |
| Cache Hit Rate | % served from cache | > 80% | < 50% |
| Memory Usage | Application memory | < 70% | > 90% |
| Error Rate | Failed requests | < 1% | > 5% |

### N+1 Query Detection

The engine detects N+1 patterns:

```typescript
// Triggers N+1 warning when:
// - Multiple identical queries in one request
// - Query count scales with data size
if (queriesPerRequest > 10 && hasRepeatedPattern) {
  spawnEnemy('query_swarm');
}
```

---

## Stability Score

### Calculation

```typescript
stabilityScore = weighted_average([
  { metric: 'latency',    weight: 0.30, score: latencyScore },
  { metric: 'throughput', weight: 0.25, score: throughputScore },
  { metric: 'queries',    weight: 0.20, score: queryScore },
  { metric: 'cache',      weight: 0.15, score: cacheScore },
  { metric: 'errors',     weight: 0.10, score: errorScore },
]);
```

### Scoring Functions

```typescript
// Latency score (lower is better)
latencyScore = Math.max(0, 100 - (p95Latency / targetLatency) * 100);

// Throughput score (higher is better)
throughputScore = Math.min(100, (throughput / targetThroughput) * 100);

// Query score (fewer is better)
queryScore = Math.max(0, 100 - (queriesPerRequest - 1) * 10);

// Cache score (higher hit rate is better)
cacheScore = cacheHitRate; // 0-100

// Error score (lower is better)
errorScore = Math.max(0, 100 - errorRate * 20);
```

### Star Ratings

| Stars | Stability Score | Achievement |
|-------|-----------------|-------------|
| ⭐⭐⭐ | >= 90 | Excellent |
| ⭐⭐ | >= 70 | Good |
| ⭐ | >= 50 | Passed |
| 0 | < 50 | Failed |

---

## Enemy System

### Enemy Types

| Enemy | Visual | Trigger | Effect |
|-------|--------|---------|--------|
| Query Swarm | Buzzing particles | N+1 queries | +50ms latency |
| Memory Blob | Growing sphere | Memory > 80% | Slows all nodes |
| Callback Chain | Chain links | Deep nesting | Blocks pipeline |
| Timeout Wraith | Ghost | p99 > 500ms | Random timeouts |
| Error Spike | Red lightning | Errors > 5% | Drops requests |
| Cache Phantom | Fading ghost | Cache < 50% | DB overload |

### Enemy Spawning

```typescript
function checkEnemySpawns(metrics: Metrics) {
  if (metrics.queriesPerRequest > 10) {
    spawn('query_swarm', { strength: metrics.queriesPerRequest });
  }
  if (metrics.memoryUsage > 0.8) {
    spawn('memory_blob', { size: metrics.memoryUsage });
  }
  if (metrics.p99Latency > 500) {
    spawn('timeout_wraith');
  }
  // ... etc
}
```

### Enemy Behavior

Enemies attack specific nodes:
- Query Swarm → Database node
- Memory Blob → All nodes (global debuff)
- Timeout Wraith → Slowest node
- Cache Phantom → Cache node

---

## Defense System

### Defense Types

| Defense | Placement | Counters | Effect |
|---------|-----------|----------|--------|
| Index Turret | Database | Query Swarm | -50% query time |
| Cache Shield | Cache | Cache Phantom | +30% hit rate |
| Eager Loader | Model | Query Swarm | Prevents N+1 |
| Rate Limiter | Router | Error Spike | Throttles overflow |
| Worker Drone | Controller | Timeout Wraith | Async processing |
| Validator Wall | Router | Error Spike | Early validation |

### Defense Placement

```typescript
// Defenses attach to specific node types
const validPlacements = {
  index_turret: ['database'],
  cache_shield: ['cache'],
  eager_loader: ['model'],
  rate_limiter: ['router'],
  worker_drone: ['controller'],
  validator_wall: ['router'],
};
```

### Defense Activation

Defenses activate automatically when enemies approach:

```typescript
function activateDefenses() {
  for (const defense of activeDefenses) {
    const nearbyEnemies = findEnemiesInRange(defense);
    for (const enemy of nearbyEnemies) {
      if (defense.counters.includes(enemy.type)) {
        applyDefenseEffect(defense, enemy);
      }
    }
  }
}
```

---

## Progression System

### Level Structure

8 Acts with 56 total levels:

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | 8 | MVC, CRUD, Routes, Controllers, Serializers, Associations, Seeds |
| 2 | Guards & Gates | 8 | Authentication, Validations, Callbacks, Authorization, Testing, Strong Params, CORS, Scopes & Enums |
| 3 | Clean Architecture | 7 | Service Objects, Concerns, Validation Contracts, Error Handling, Background Jobs |
| 4 | Performance | 9 | N+1 Queries, Eager Loading, Narrow Fetching, Indexing, Caching, Pagination, Search, HTTP Caching |
| 5 | Production Features | 8 | Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning |
| 6 | Reliability | 7 | Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring |
| 7 | Scale | 6 | Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events |
| 8 | Mastery | 3 | API Gateway, Database Sharding, The Architect |

### Unlocking

- **Levels**: Complete previous level to unlock next
- **Acts**: Complete final level of previous act
- **Nodes**: Some levels unlock new node types
- **Defenses**: Some levels unlock new defenses

### XP System

```typescript
// XP earned per level completion
baseXP = level.difficulty * 100;

starMultiplier = {
  3: 1.5,
  2: 1.2,
  1: 1.0,
};

firstTimeBonus = isFirstCompletion ? 2.0 : 1.0;

totalXP = baseXP * starMultiplier[stars] * firstTimeBonus;
```

### Achievements

| Achievement | Requirement |
|-------------|-------------|
| First Pipeline | Complete Level 1 |
| Three Star | Get 3 stars on any level |
| Perfect Act | 3-star all levels in an act |
| Speed Runner | Complete level under 60 seconds |
| Query Master | 0 N+1 queries in entire act |
| Cache Champion | 95%+ cache hit rate |
| Zero Downtime | 0% error rate |
| Defender | Use all defense types |

---

## Sandbox Mode

### Features

- All node types available
- All defense types available
- No success conditions
- No time limits
- Enemies can be toggled on/off
- Metrics still tracked
- Great for experimentation

### Use Cases

1. **Practice concepts** before attempting levels
2. **Experiment** with different pipeline architectures
3. **Test optimizations** without pressure
4. **Understand metrics** in a safe environment

---

## Controls

### Pipeline Editor

| Action | Input |
|--------|-------|
| Add node | Drag from palette |
| Select node | Click node |
| Move node | Drag selected node |
| Connect | Drag from handle to handle |
| Delete | Select + Delete/Backspace |
| Pan canvas | Middle-click drag |
| Zoom | Scroll wheel |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z |

### Simulation

| Action | Input |
|--------|-------|
| Start/Pause | Space or Play button |
| Reset | R key or Reset button |
| Speed 1x | 1 key |
| Speed 2x | 2 key |
| Speed 3x | 3 key |

---

## Implementation Files

| System | Location |
|--------|----------|
| Simulation Engine | `frontend/src/utils/SimulationEngine.ts` |
| Metrics Calculation | `frontend/src/utils/metrics.ts` |
| Node Behavior | `frontend/src/utils/nodeBehavior.ts` |
| Pipeline Templates | `frontend/src/utils/pipelineTemplates.ts` |
| Game Data (node types) | `frontend/src/utils/gameData.ts` |
| Game Store | `frontend/src/stores/game.ts` |
| Pipeline Hooks | `frontend/src/hooks/usePipelineState.ts` |
| Simulation Hook | `frontend/src/hooks/usePipelineSimulation.ts` |
| Level Components | `frontend/src/features/act*-*/components/` |
| Level Registry | `frontend/src/features/levels-registry.ts` |
| Acts Registry | `frontend/src/features/acts-registry.ts` |
| Shared Level Layout | `frontend/src/components/levels/` |

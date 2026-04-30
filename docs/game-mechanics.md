# Game Mechanics

This document describes the current gameplay systems in Interactive Rails.

## Overview

Interactive Rails teaches Rails 8 API development through structured, interactive levels:

- **Briefing**: the player reads the scenario, problem, and goal before entering the level.
- **Observe phase**: the player probes the broken system and unlocks discoveries.
- **Build phase**: the player fixes the system through terminal choices, code choices, and focused interactions.
- **Reward phase**: the player stress-tests the completed solution and watches the fixed system respond.
- **Progression**: completing levels unlocks the next level and advances the app narrative.

There is no enemy/defense combat system in the current game loop.

---

## Core Gameplay Loop

```text
1. Read Briefing
   -> Understand the app state, incident, and learning goal.

2. Observe the Problem
   -> Click stages or zones to inspect code.
   -> Fire every probe in ProbeTerminal.
   -> Unlock every required discovery.

3. Build the Fix
   -> Complete each step in order.
   -> Pick terminal commands, code snippets, or interaction choices.
   -> Watch the right-panel code preview evolve as steps complete.

4. Stress-Test the Solution
   -> Fire reward scenarios in StressTestPanel.
   -> Watch the visualization show allowed, blocked, fast, slow, or recovered flows.

5. Submit
   -> The level validates the current phase and completion state.
   -> Completion records stars and progress.
```

---

## Phase Model

Most current levels use a three-phase state machine:

```text
observe -> build -> reward
```

### Observe

The observe phase teaches why the problem matters.

Common pieces:

- `DiscoveryChecklist`: shows the required discoveries.
- `ProbeTerminal`: fires one-shot probes that reveal concrete failures.
- `StageInspector`: opens code and descriptions for clickable stages or zones.
- `PipelineFlow`, `QueryZoneFlow`, or a custom visualization: shows what breaks and where.

The "Build the Fix" button appears after the required discoveries are unlocked.

### Build

The build phase teaches how to fix the problem.

Common step types:

- `TerminalChoiceStep`: choose the correct command.
- `OptionCard`: choose the correct code or configuration.
- Drag/drop or focused custom interactions where a concept needs spatial reasoning.

Build steps are sequential. The code preview shows the result of completed steps, so the player sees the solution grow over time.

### Reward

The reward phase teaches the advantage of the fix.

Common pieces:

- `StressTestPanel`: fires realistic scenarios against the fixed system.
- Dynamic visualization state: nodes, zones, counters, labels, and edges react to each request.
- Right panel final code: shows the completed implementation.

Some levels require multiple reward scenarios before submission. Others currently validate build completion only.

---

## Visualizations

Levels choose the visualization that best matches the Rails concept.

### PipelineFlow

Used when the lesson is about a request lifecycle stage that is missing, broken, or unsafe.

Examples:

- routing
- controller flow
- authentication
- authorization
- strong params
- middleware

### QueryZoneFlow

Used when the lesson is about data volume, query shape, or flow through a performance-sensitive path.

Examples:

- N+1 queries
- eager loading
- counter caches
- caching

### Custom Visualizations

Used when a level needs a domain-specific mental model.

Examples:

- Active Storage direct uploads
- WebSocket push versus polling
- deployment rotation
- feature flags
- sharding
- API gateways

---

## Shared Level Components

| Component | Purpose |
|-----------|---------|
| `LevelLayout` | Three-panel level shell |
| `LevelHeader` | Title, reset, and submit controls |
| `InstructionPanel` | Left-panel scenario, goals, and phase-specific guidance |
| `CodePreviewPanel` | Right-panel code display |
| `DiscoveryChecklist` | Observe progress and discovery gating |
| `ProbeTerminal` | Observe-phase probes |
| `StageInspector` | Click-to-inspect overlays |
| `StepProgress` | Build-step progress |
| `TerminalChoiceStep` | Command-choice build steps |
| `OptionCard` | Code/configuration choice cards |
| `StressTestPanel` | Reward-phase scenario runner |
| `PipelineFlow` | Request lifecycle visualization |
| `QueryZoneFlow` | Query/data-flow visualization |

---

## Progression

Interactive Rails currently has 8 acts and 58 levels.

| Act | Name | Levels | Focus |
|-----|------|--------|-------|
| 1 | The Foundation | L1-L8 | Environment, app boot, models, CRUD, routes, controllers, serializers, associations |
| 2 | Guards & Gates | L9-L15 | Authentication, validations, callbacks, authorization, testing, strong params, CORS |
| 3 | Clean Architecture | L16-L22 | Service objects, concerns, contracts, query objects, error handling, mailers, background jobs |
| 4 | Performance | L23-L31 | N+1, eager loading, narrow fetching, indexing, counter caches, pagination, search, caching |
| 5 | Production Features | L32-L40 | Polymorphic associations, transactions, locking, storage, encryption, real-time, external APIs, webhooks, versioning |
| 6 | Operations | L41-L49 | Middleware, rate limiting, soft deletes, safe migrations, recurring jobs, data lifecycle, monitoring, deployment, feature flags |
| 7 | Scale | L50-L55 | Multi-database, state machines, multi-tenancy, observability, modular monolith, domain events |
| 8 | Mastery | L56-L58 | API gateway, sharding, capstone architecture |

Levels unlock sequentially. In development mode, the app can unlock all levels through the local storage override used by the acts registry.

---

## Sandbox Mode

Sandbox mode is a separate free-form space for experimenting with pipeline nodes and request flow ideas. It is not the primary level loop.

Use it to:

- explore node layouts
- practice connecting pipeline pieces
- experiment without level success conditions
- inspect how simple request simulations behave

---

## Scoring and Completion

Levels report a star rating through the level completion flow. Most level components derive stars from the stepper state, including wrong attempts and completion progress.

The current gameplay emphasis is completion and learning feedback, not a global stability-score combat system.

# Content Structure

This document explains how game content (acts, levels) is organized and managed.

## Overview

Game content is defined in the frontend as TypeScript data structures and React components.

**Content Locations:**
```
frontend/src/content/acts/           # Act and level definitions (8 files + index)
frontend/src/components/game/levels/ # Level-specific components
```

---

## Content Hierarchy

```
RailsExpert (50 levels, 8 acts)
├── Act 1: The Foundation (7 levels)
│   ├── Level 1: The Stack Choice
│   ├── Level 2: The Model
│   ├── Level 3: CRUD Operations
│   ├── Level 4: The Controller
│   ├── Level 5: Serializers
│   ├── Level 6: Routes & Request Lifecycle
│   └── Level 7: Associations
│
├── Act 2: Users & Security (7 levels)
│   ├── Level 8: Authentication
│   ├── Level 9: Validations
│   ├── Level 10: Callbacks & Normalizations
│   ├── Level 11: Authorization
│   ├── Level 12: Testing
│   ├── Level 13: Security
│   └── Level 14: Scopes & Enums
│
├── Act 3: Clean Architecture (7 levels)
│   ├── Level 15: Service Objects
│   ├── Level 16: Concerns & Modules
│   ├── Level 17: Form Objects
│   ├── Level 18: Custom Validators
│   ├── Level 19: Error Handling
│   ├── Level 20: Action Mailer
│   └── Level 21: Background Jobs
│
├── Act 4: Performance (7 levels)
│   ├── Level 22: The N+1 Problem
│   ├── Level 23: Eager Loading
│   ├── Level 24: Database Indexing
│   ├── Level 25: Counter Caches
│   ├── Level 26: Pagination
│   ├── Level 27: Search
│   └── Level 28: Caching
│
├── Act 5: Production Features (8 levels)
│   ├── Level 29: Polymorphic Associations
│   ├── Level 30: Transactions & Locking
│   ├── Level 31: Active Storage
│   ├── Level 32: Encrypted Attributes
│   ├── Level 33: Real-Time
│   ├── Level 34: External APIs
│   ├── Level 35: Webhooks & Idempotency
│   └── Level 36: API Versioning
│
├── Act 6: Reliability (6 levels)
│   ├── Level 37: Middleware & Rack
│   ├── Level 38: Rate Limiting
│   ├── Level 39: Soft Deletes & Audit Trails
│   ├── Level 40: Safe Migrations
│   ├── Level 41: Recurring Jobs & Scheduling
│   └── Level 42: Structured Error Monitoring
│
├── Act 7: Scale (5 levels)
│   ├── Level 43: Multi-Database
│   ├── Level 44: State Machines
│   ├── Level 45: Multi-Tenancy
│   ├── Level 46: Observability
│   └── Level 47: Domain Events & Decoupling
│
└── Act 8: Mastery (3 levels)
    ├── Level 48: API Gateway
    ├── Level 49: Database Sharding
    └── Level 50: The Architect (Capstone)
```

**Current Status:**
- 8 acts implemented
- 50 total levels
- Rails 8 API-only focused
- Testing required from Level 12 onward

---

## Act Schema

### TypeScript Interface

The following interfaces are simplified versions of the actual types defined in `frontend/src/components/game/types.ts`. See that file for the full definitions.

```typescript
interface Act {
  id: number;
  name: string;
  tagline: string;
  description: string;
  levels: Level[];
  /** Nodes that become available after completing this act */
  unlockedNodes: string[];
  /** Whether metrics are visible during this act */
  metricsVisible: boolean;
  /** Which metrics are visible (if metricsVisible is true) */
  visibleMetrics?: string[];
}

interface Level {
  id: string;                           // e.g. 'act1-level1-stack-choice'
  actId: number;
  levelNumber: number;
  name: string;
  isCapstone?: boolean;
  trigger: LevelTrigger;
  startingPipeline: PipelineState;
  problem: LevelProblem;
  successConditions: SuccessCondition[];
  availableNodes: string[];
  unlockedNodes: string[];
  learningContent: LearningContent;
  hint?: { delay: number; text: string };
  slots?: SlotConfig[];
  decisionModals?: DecisionModalConfig[];
  logicBlocks?: LogicBlock[];
  simulationEvents?: SimulationEvent[];
  darkCanvas?: boolean;
  requiresTests?: boolean;             // from Level 12 onward
}

interface SuccessCondition {
  type:
    | 'pipeline_complete'
    | 'node_present'
    | 'connection'
    | 'node_absent'
    | 'slot_filled'
    | 'logic_block_moved'
    | 'complexity_under'
    | 'decision_made'
    | 'path_exists'
    | 'node_count'
    | 'crud_complete'
    | 'metric'
    | 'code_valid'
    | 'security_configured'
    | 'testing_configured'
    // ... many more domain-specific types
    ;
  /** For metric conditions */
  metric?: string;
  operator?: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value?: number;
  /** For node_present/absent conditions */
  nodeType?: string;
  /** For slot_filled conditions */
  slotId?: string;
  // ... additional fields depending on type
}
```

### Example Act Definition

```typescript
// frontend/src/content/acts/act1-foundation.ts
import type { Act, Level } from "@/components/game/types";

const level1StackChoice: Level = {
  id: 'act1-level1-stack-choice',
  actId: 1,
  levelNumber: 1,
  name: 'The Stack Choice',
  trigger: {
    type: 'initialization',
    description: 'Day 1. You are initializing the repository...',
  },
  startingPipeline: {
    nodes: [{ id: 'terminal', type: 'terminal', x: 500, y: 300, locked: true }],
    connections: [],
  },
  problem: {
    observation: 'A dark canvas with a blinking Terminal node...',
    rootCause: 'No application exists yet.',
    codeExample: `# Day 1: Initialize your Rails 8 API application
rails new myapp --api --database=postgresql`,
    goal: 'Choose your database. Drag the node to the slot.',
    thresholds: {},
  },
  successConditions: [
    { type: 'slot_filled', slotId: 'database-slot' },
  ],
  availableNodes: ['postgresql', 'sqlite'],
  unlockedNodes: ['request', 'router', 'controller', 'model', 'database', 'response', 'serializer'],
  learningContent: {
    title: 'Rails 8 API Application',
    conceptExplanation: '...',
    railsCodeExample: '...',
  },
  darkCanvas: true,
};

export const actOne: Act = {
  id: 1,
  name: 'The Foundation',
  tagline: 'Build a working API from nothing',
  description: 'Build a Rails 8 API from scratch...',
  levels: [level1StackChoice, /* ...more levels */],
  unlockedNodes: ['request', 'router', 'controller', 'model', 'database', 'response'],
  metricsVisible: false,
};
```

---

## Level Components

Each level has a corresponding React component that defines its specific behavior.

### Component Location

```
frontend/src/components/game/levels/
├── act1/
│   ├── Level1StackChoice.tsx
│   ├── Level2Model.tsx
│   ├── Level3CRUD.tsx
│   └── ...
├── act2/
│   ├── Level8Authentication.tsx
│   └── ...
├── act3/
│   ├── Level15ServiceObjects.tsx
│   └── ...
├── act4/
│   ├── Level22N1Problem.tsx
│   └── ...
├── act5/
│   ├── Level29Polymorphic.tsx
│   └── ...
├── act6/
│   ├── Level37Middleware.tsx
│   └── ...
├── act7/
│   ├── Level43MultiDatabase.tsx
│   └── ...
└── act8/
    ├── Level48APIGateway.tsx
    └── ...
```

### Level Component Structure

```typescript
// Level1StackChoice.tsx
import { LevelLayout } from '../LevelLayout';
import { InstructionPanel } from '../InstructionPanel';
import { PipelineCanvas } from '../../pipeline/PipelineCanvas';

export function Level1StackChoice() {
  const initialNodes = [
    { id: 'request-1', type: 'request', x: 100, y: 200 },
  ];

  const learningContent = {
    title: 'The Request Lifecycle',
    sections: [
      {
        heading: 'How Rails Handles Requests',
        content: 'Every Rails application follows the MVC pattern...',
        codeExample: `
# config/routes.rb
Rails.application.routes.draw do
  get '/posts', to: 'posts#index'
end
        `
      }
    ]
  };

  return (
    <LevelLayout levelId="act1-level1-stack-choice">
      <InstructionPanel content={learningContent} />
      <PipelineCanvas initialNodes={initialNodes} />
    </LevelLayout>
  );
}
```

---

## Learning Content

Each level includes educational content displayed in the instruction panel.

### Content Structure

```typescript
interface LearningContent {
  title: string;
  /** What the concept is */
  conceptExplanation: string;
  /** Real Rails code showing the solution */
  railsCodeExample: string;
}
```

### Example Learning Content

```typescript
const learningContent: LearningContent = {
  title: 'N+1 Query Problem',
  conceptExplanation: `
The N+1 query problem occurs when your code executes one query to fetch
a list of records, then N additional queries to fetch associated records
for each item in the list.
  `,
  railsCodeExample: `
# Bad - N+1 queries
posts = Post.all
posts.each do |post|
  puts post.author.name  # Query for EACH post!
end

# Good - Eager loading
posts = Post.includes(:author).all
posts.each do |post|
  puts post.author.name  # No additional queries
end
  `,
};
```

---

## Pipeline Configuration

### Pipeline Templates

Most levels use a standard Rails request cycle layout. Rather than duplicating inline node/connection definitions, use the reusable templates from `frontend/src/utils/pipelineTemplates.ts`:

```typescript
import { standardPipeline, middlewarePipeline } from "@/utils/pipelineTemplates";

// 7-node layout: Request → Router → Controller → Model → Database (top row)
//                                    Serializer → Response (bottom row)
startingPipeline: standardPipeline()
startingPipeline: standardPipeline({ modelLabel: 'User' })
startingPipeline: standardPipeline({ modelId: 'user-model', modelLabel: 'User' })

// 8-node layout: adds Middleware between Request and Router
startingPipeline: middlewarePipeline()
startingPipeline: middlewarePipeline({ modelLabel: 'User' })
```

**Gold-standard layout (2-row design):**
```
Top row (y:220):    Request(100) → Router(280) → Controller(460) → Model(660) → Database(860)
Bottom row (y:400):                               Serializer(460) → Response(660)

Connections:
  request → router → controller → model → database   (horizontal, top row)
  controller → serializer → response                  (vertical drop + horizontal, bottom row)
```

**Data flow rules:**
- Controller feeds both Model (right) and Serializer (down)
- Never use `database → response` — the controller orchestrates both paths
- Never skip the serializer (controller → response) in levels that have one
- The only exception is Level 5 (Serializers) where the puzzle IS to add a serializer

**Currently using templates:**
- `standardPipeline()`: Act 3 (L15, 19, 20), Act 5 (L31, 32), Act 6 (L37, 39, 40)
- `middlewarePipeline()`: Act 6 (L38, 42)

**Levels with unique topologies (do NOT use templates):**
- L1-4, L6-7 (Act 1): Progressively building the pipeline
- L5 (Act 1): No serializer yet (that's the puzzle)
- L16, L18 (Act 3): Multiple models → DB, no request cycle
- L17 (Act 3): Multi-model form pattern
- L21 (Act 3): Service + mailer branching
- L29 (Act 5): 3 diverging models
- L30 (Act 5): 2 concurrent requests
- L33 (Act 5): Polling with 2 requests
- L34-35 (Act 5): External API / webhook integration
- L36 (Act 5): 2 client versions
- L41 (Act 6): Minimal job pipeline (no response node)

### Custom Initial Nodes

For levels with unique topologies, define starting pipeline nodes inline:

```typescript
const startingPipeline: PipelineState = {
  nodes: [
    { id: 'request-1', type: 'request', x: 100, y: 200, locked: true },
    { id: 'router-1', type: 'router', x: 300, y: 200, locked: true },
    { id: 'controller-1', type: 'controller', x: 500, y: 200 },
  ],
  connections: [],
};
```

### Available Nodes

Restrict which nodes players can use:

```typescript
const availableNodes = [
  'request',      // Always present
  'router',       // Always present
  'controller',   // Basic MVC
  'model',        // After Act 1
  'database',     // After Act 1
  'view',         // After Act 1
  'cache',        // After Act 3
  'job',          // After Act 3
];
```

### Success Conditions

Define what must be achieved to complete a level:

```typescript
const successConditions: SuccessCondition[] = [
  { type: 'slot_filled', slotId: 'database-slot' },
  { type: 'pipeline_complete' },
  { type: 'node_present', nodeType: 'model' },
  { type: 'connection', sourceType: 'controller', targetType: 'model' },
  { type: 'node_count', nodeType: 'service', count: 1 },
  { type: 'crud_complete', modelType: 'Post' },
];
```

---

## Adding New Content

### Adding a New Level

1. **Update the appropriate act file in `frontend/src/features/actN-*/content.ts`** - Add level definition to the act
2. **Use pipeline templates** - For standard request-cycle levels, use `standardPipeline()` or `middlewarePipeline()` from `@/utils/pipelineTemplates` instead of inline node definitions
3. **Create component** - Add `LevelXXName.tsx` in the act's `components/` folder
4. **Add to level registry** - Update `frontend/src/features/levels-registry.ts`
5. **Test** - Verify level loads and completes correctly

### Adding a New Act

1. **Create act file** - Add `frontend/src/content/acts/actN-name.ts`
2. **Update index** - Import and add the new act in `frontend/src/content/acts/index.ts`
3. **Create folder** - `frontend/src/components/game/levels/actN/`
4. **Create components** - Add component for each level
5. **Update navigation** - Ensure acts list shows new act

### Level Component Template

```typescript
import { useState } from 'react';
import { LevelLayout } from '../LevelLayout';
import { InstructionPanel } from '../InstructionPanel';
import { PipelineCanvas } from '../../pipeline/PipelineCanvas';
import { useSimulationStore } from '@/stores/simulation';
import type { PlacedNode } from '../../types';

export function LevelXXName() {
  const initialNodes: PlacedNode[] = [
    // Define starting nodes
  ];

  const learningContent = {
    title: 'Level Title',
    sections: [
      // Define learning content
    ]
  };

  return (
    <LevelLayout
      levelId="actX-levelXX-name"
      title="Level Title"
      availableNodes={['request', 'router', 'controller']}
      successConditions={[
        { type: 'pipeline_complete' }
      ]}
    >
      <InstructionPanel content={learningContent} />
      <PipelineCanvas initialNodes={initialNodes} />
    </LevelLayout>
  );
}
```

---

## Content Guidelines

### Level Design Tips

1. **Clear Objectives** - State exactly what players need to achieve
2. **Progressive Difficulty** - Build on previous levels
3. **Realistic Scenarios** - Use production-relevant examples
4. **Educational Focus** - Teach concepts through gameplay

### Difficulty Guidelines

| Difficulty | Description | Target Audience |
|------------|-------------|-----------------|
| 1 | Basic concepts, guided setup | Beginners |
| 2 | Apply concepts with some freedom | Familiar with basics |
| 3 | Complex scenarios, multiple solutions | Intermediate |
| 4 | Optimization challenges | Advanced |
| 5 | Expert-level system design | Experts |

### Topics by Act

**Act 1 - The Foundation:**
- Stack choice (PostgreSQL vs SQLite)
- Models and migrations
- CRUD operations
- Controllers and actions
- Serializers (JSON output)
- Routes and request lifecycle
- Associations (has_many, belongs_to)

**Act 2 - Users & Security:**
- Authentication (Bearer tokens)
- Validations
- Callbacks and normalizations
- Authorization (Pundit)
- Testing (RSpec/Minitest)
- Security (CORS, rate limiting)
- Scopes and enums

**Act 3 - Clean Architecture:**
- Service objects
- Concerns and modules
- Form objects
- Custom validators
- Error handling
- Action Mailer
- Background jobs (Solid Queue)

**Act 4 - Performance:**
- N+1 query detection
- Eager loading (includes, preload)
- Database indexing
- Counter caches
- Pagination
- Search (full-text)
- Caching (Solid Cache)

**Act 5 - Production Features:**
- Polymorphic associations
- Transactions and locking
- Active Storage (file uploads)
- Encrypted attributes
- Real-time (Action Cable / Solid Cable)
- External API integrations
- Webhooks and idempotency
- API versioning

**Act 6 - Reliability:**
- Middleware and Rack
- Rate limiting (Rails 8 built-in)
- Soft deletes and audit trails
- Safe migrations (zero-downtime)
- Recurring jobs and scheduling (Solid Queue)
- Structured error monitoring

**Act 7 - Scale:**
- Multi-database (read replicas)
- State machines
- Multi-tenancy
- Observability
- Domain events and decoupling

**Act 8 - Mastery:**
- API gateway design
- Database sharding
- Service extraction (capstone)

---

## Implementation Files

| Content Type | Location |
|--------------|----------|
| Act definitions | `frontend/src/features/act*-*/content.ts` |
| Level components | `frontend/src/features/act*-*/components/` |
| Pipeline templates | `frontend/src/utils/pipelineTemplates.ts` |
| Acts registry | `frontend/src/features/acts-registry.ts` |
| Level registry | `frontend/src/features/levels-registry.ts` |
| Node types | `frontend/src/utils/gameData.ts` |
| Pipeline types | `frontend/src/types/game.ts` |
| Game store | `frontend/src/stores/game.ts` |

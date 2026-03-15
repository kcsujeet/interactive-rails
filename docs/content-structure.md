# Content Structure

This document explains how game content (acts, levels) is organized and managed.

## Overview

Game content is defined in the frontend as TypeScript data structures and React components.

**Content Locations (bulletproof-react pattern):**
```
frontend/src/features/act*-*/content.ts      # Act and level definitions (8 files)
frontend/src/features/act*-*/components/     # Level-specific React components
frontend/src/features/acts-registry.ts       # All acts registry
frontend/src/features/levels-registry.ts     # Level component registry (55 custom)
```

---

## Content Hierarchy

```
Interactive Rails (55 levels, 8 acts)
├── Act 1: The Foundation (8 levels)
│   ├── Level 1: First Boot
│   ├── Level 2: The Model
│   ├── Level 3: CRUD Operations
│   ├── Level 4: Routes & Request Lifecycle
│   ├── Level 5: The Controller
│   ├── Level 6: Serializers
│   ├── Level 7: Associations
│   └── Level 8: Seeds & Sample Data
│
├── Act 2: Guards & Gates (L9-L15, 7 levels)
│   ├── Level 9: Authentication
│   ├── Level 10: Validations
│   ├── Level 11: Callbacks & Normalizations
│   ├── Level 12: Authorization
│   ├── Level 13: Testing
│   ├── Level 14: Strong Params
│   └── Level 15: CORS
│
├── Act 3: Clean Architecture (L16-L22, 7 levels)
│   ├── Level 16: Service Objects
│   ├── Level 17: Concerns & Modules
│   ├── Level 18: Validation Contracts
│   ├── Level 19: Query Objects
│   ├── Level 20: Error Handling
│   ├── Level 21: Action Mailer
│   └── Level 22: Background Jobs
│
├── Act 4: Performance (L23-L31, 9 levels)
│   ├── Level 23: The N+1 Problem
│   ├── Level 24: Eager Loading
│   ├── Level 25: Narrow Fetching
│   ├── Level 26: Database Indexing
│   ├── Level 27: Counter Caches
│   ├── Level 28: Pagination
│   ├── Level 29: Search
│   ├── Level 30: Caching
│   └── Level 31: HTTP Caching & CDNs
│
├── Act 5: Production Features (L32-L40, 9 levels)
│   ├── Level 32: Polymorphic Associations
│   ├── Level 33: Transactions
│   ├── Level 34: Locking
│   ├── Level 35: Active Storage
│   ├── Level 36: Encrypted Attributes
│   ├── Level 37: Real-Time
│   ├── Level 38: External APIs
│   ├── Level 39: Webhooks & Idempotency
│   └── Level 40: API Versioning
│
├── Act 6: Reliability (L41-L47, 7 levels)
│   ├── Level 41: Middleware & Rack
│   ├── Level 42: Rate Limiting
│   ├── Level 43: Soft Deletes & Audit Trails
│   ├── Level 44: Safe Migrations
│   ├── Level 45: Recurring Jobs & Scheduling
│   ├── Level 46: Data Lifecycle
│   └── Level 47: Structured Error Monitoring
│
├── Act 7: Scale (L48-L53, 6 levels)
│   ├── Level 48: Multi-Database
│   ├── Level 49: State Machines
│   ├── Level 50: Multi-Tenancy
│   ├── Level 51: Observability
│   ├── Level 52: Modular Monolith
│   └── Level 53: Domain Events & Decoupling
│
└── Act 8: Mastery (L54-L56, 3 levels)
    ├── Level 54: API Gateway
    ├── Level 55: Database Sharding
    └── Level 56: The Architect (Capstone)
```

**Current Status:**
- 8 acts implemented
- 56 total levels
- Rails 8 API-only focused
- Testing required from Level 13 onward

---

## Act Schema

### TypeScript Interface

The following interfaces are simplified versions of the actual types defined in `frontend/src/types/game.ts` and `frontend/src/types/level.ts`. See those files for the full definitions.

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
// frontend/src/features/act1-foundation/content.ts
import type { Act, Level } from "@/types";

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
    goal: `In this level, you'll:\n- create your first Rails 8 application.\n- learn why PostgreSQL is the go-to database for production APIs.\n- generate an API-only project with the right flags.`,
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

Each level has a corresponding React component registered in `frontend/src/features/levels-registry.ts`. All 55 levels have custom interactive components registered in the level registry.

### Component Location

```
frontend/src/features/
├── act1-foundation/components/
│   ├── Level1StackChoice.tsx
│   ├── Level2Model.tsx
│   ├── Level3CRUD.tsx
│   ├── Level4Routes.tsx
│   ├── Level5Controller.tsx
│   └── Level7Associations.tsx
├── act2-users-security/components/
│   ├── Level12Authorization.tsx
│   ├── Level13Testing.tsx
│   ├── Level14StrongParams.tsx
│   └── Level15CORS.tsx
├── act3-clean-architecture/components/
│   ├── Level16ServiceObjects.tsx ... Level22BackgroundJobs.tsx
├── act4-performance/components/
│   ├── Level23N1Problem.tsx ... Level31HTTPCaching.tsx
├── act5-production/components/
│   ├── Level32Polymorphic.tsx ... Level39APIVersioning.tsx
├── act6-reliability/components/
│   ├── Level41RateLimiting.tsx ... Level46ErrorMonitoring.tsx
├── act7-scale/components/
│   ├── Level47MultiDatabase.tsx ... Level52DomainEvents.tsx
└── act8-mastery/components/
    ├── Level53APIGateway.tsx
    ├── Level54Sharding.tsx
    └── Level55Architect.tsx
```

### Level Component Patterns

**Custom Interactive (55 levels):** 3-panel layout with concept-specific interaction.

```typescript
// features/act4-performance/components/Level24Indexing.tsx
import { LevelLayout, LeftPanel, CenterPanel, RightPanel } from '@/components/levels';
import { InstructionPanel, CodePreviewPanel, LevelHeader } from '@/components/levels';
import { useLevelCompletion } from '@/components/levels';
import type { LevelComponentProps } from '@/features/levels-registry';

export function Level24Indexing({ onComplete }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  // ... concept-specific state

  return (
    <LevelLayout>
      <LeftPanel><InstructionPanel steps={steps} currentStep={step} /></LeftPanel>
      <CenterPanel>
        <LevelHeader levelNumber={24} actNumber={4} title="Database Indexing" validate={validate} />
        {/* Custom interactive visualization */}
      </CenterPanel>
      <RightPanel><CodePreviewPanel code={migrationCode} language="ruby" /></RightPanel>
    </LevelLayout>
  );
}
```

**Pipeline Builder (7 levels):** Some levels use the generic pipeline builder view where the pipeline position IS the lesson. These levels are NOT registered in `levels-registry.ts` and fall through to the generic view.

---

## Learning Content

Each level includes educational content displayed in the instruction panel.

### Content Structure

```typescript
interface LearningContent {
  title: string;
  /** Concise learning goal shown in the "Goal" dialog (triggered by the Goal button in LevelHeader).
   *  Format: "In this level, you'll:\n- bullet 1.\n- bullet 2.\n- bullet 3."
   *  This is NOT the same as conceptExplanation. Keep it short (3-5 bullets). */
  goal: string;
  /** Detailed concept reference shown on the completion screen.
   *  Can be long. Covers the full explanation, benchmarks, code patterns, etc. */
  conceptExplanation: string;
  /** Real Rails code showing the solution */
  railsCodeExample: string;
}
```

**`goal` vs `conceptExplanation`:** These serve different purposes. `goal` is what the player sees when they click the "Goal" button before or during gameplay. It should be a concise, scannable list of what they'll learn. `conceptExplanation` is the full reference material shown on the completion screen after the player finishes the level.

### Example Learning Content

```typescript
const learningContent: LearningContent = {
  title: 'N+1 Query Problem',
  goal: `In this level, you'll:\n- learn to spot the N+1 query problem, the most common performance killer in Rails apps.\n- understand why loading 100 posts generates 101 database queries.\n- trace the problem back to association access in serializers.\n- install Prosopite to detect N+1 queries automatically.\n- enable strict_loading to prevent lazy-loading regressions.`,
  conceptExplanation: `The N+1 problem is the most common performance killer in Rails apps.
It happens when you load a collection of records (1 query) and then
access an association on each record (N queries).

**The math is brutal:**
- 100 posts = 101 queries
- 1,000 posts = 1,001 queries
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
- Never use `database → response`. The controller orchestrates both paths
- Never skip the serializer (controller → response) in levels that have one
- The only exception is Level 5 (Serializers) where the puzzle IS to add a serializer

**Currently using templates:**
- `standardPipeline()`: Act 3 (L16, 19, 20), Act 5 (L34, 32), Act 6 (L40, 42, 43)
- `middlewarePipeline()`: Act 6 (L41, 46)

**Levels with unique topologies (do NOT use templates):**
- L1-4, L6-7 (Act 1): Progressively building the pipeline
- L5 (Act 1): No serializer yet (that's the puzzle)
- L17, L18 (Act 3): Multiple models → DB, no request cycle
- L18 (Act 3): Multi-model form pattern
- L21 (Act 3): Service + mailer branching
- L32 (Act 5): 3 diverging models
- L33 (Act 5): 2 concurrent requests
- L36 (Act 5): Polling with 2 requests
- L37-38 (Act 5): External API / webhook integration
- L39 (Act 5): 2 client versions
- L44 (Act 6): Minimal job pipeline (no response node)

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
  'serializer',   // After Act 1
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

1. **Create feature directory** - `frontend/src/features/actN-name/`
2. **Create content file** - `frontend/src/features/actN-name/content.ts`
3. **Create index** - `frontend/src/features/actN-name/index.ts` exporting content
4. **Update acts registry** - Import and add in `frontend/src/features/acts-registry.ts`
5. **Create components** - Add `components/LevelXXName.tsx` for each level
6. **Register components** - Import and add in `frontend/src/features/levels-registry.ts`

### Level Component Template

```typescript
import { useState } from 'react';
import {
  LevelLayout, LeftPanel, CenterPanel, RightPanel,
  InstructionPanel, CodePreviewPanel, LevelHeader,
  useLevelCompletion,
} from '@/components/levels';
import type { LevelComponentProps, ValidationResult } from '@/features/levels-registry';

export function LevelXXName({ onComplete }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();

  const validate = (): ValidationResult => {
    // Check if level objectives are met
    return { valid: true, message: 'Level complete!' };
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel steps={steps} currentStep={currentStep} />
      </LeftPanel>
      <CenterPanel>
        <LevelHeader
          levelNumber={XX}
          actNumber={N}
          title="Level Title"
          validate={validate}
        />
        {/* Concept-specific interactive content */}
      </CenterPanel>
      <RightPanel>
        <CodePreviewPanel code={railsCode} language="ruby" />
      </RightPanel>
    </LevelLayout>
  );
}
```

---

## Content Guidelines

### Level Design Tips

Every level teaches through three phases: **WHY -> HOW -> ADVANTAGE**.

1. **WHY** -- Context for why this concept matters. Delivered as readable notes (InstructionPanel or pre-level briefing), not quiz questions.
2. **HOW** -- The core gameplay. Players learn by doing, not by answering trivia. Wrong choices get immediate feedback teaching Rails conventions. Interaction types: SimulatedTerminal (click commands), drag-and-drop (assemble pieces), click-to-select (pick from options).
3. **ADVANTAGE** -- Post-completion notes or summary card showing the concrete improvement (before/after, line count reduction, etc.).

Act calibration: Acts 1-2 are pure fundamentals (happy path). Acts 3-4 introduce refactoring and performance. Acts 5-8 cover production, reliability, scale, architecture.

Levels within an act must form a **linear progression** -- each level builds on skills and concepts from earlier levels so the player feels cumulative mastery, not disconnected lessons.

### Shared Level Components

| Component | File | Purpose |
|-----------|------|---------|
| `useStepGating` | `src/hooks/useStepGating.ts` | Multi-step level progression with star ratings (3=0 wrong, 2=1-2 wrong, 1=3+ wrong) |
| `SimulatedTerminal` | `src/components/levels/SimulatedTerminal.tsx` | Clickable terminal commands with animated line-by-line output |
| `StepProgress` | `src/components/levels/StepProgress.tsx` | Vertical stepper (lock/pulse/check icons) |
| `ErrorFeedback` | `src/components/levels/ErrorFeedback.tsx` | Auto-dismissing error card (3s timeout) |

Additional tips:

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
- Routes and request lifecycle
- Controllers and actions
- Serializers (JSON output)
- Associations (has_many, belongs_to)

**Act 2 - Guards & Gates:**
- Authentication (Bearer tokens)
- Validations
- Callbacks and normalizations
- Authorization (Pundit)
- Testing (RSpec/Minitest)
- Strong Params (`params.expect`)
- CORS (rack-cors)

**Act 3 - Clean Architecture:**
- Service objects
- Concerns and modules
- Validation contracts (dry-validation)
- Query objects
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

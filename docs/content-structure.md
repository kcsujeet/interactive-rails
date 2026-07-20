# Content Structure

This document explains how game content (acts, levels) is organized and managed.

## Overview

Game content is defined in the frontend as TypeScript data structures and React components.

**Content Locations (bulletproof-react pattern):**
```
src/features/act*-*/content.ts      # Act and level definitions (8 files)
src/features/act*-*/components/     # Level-specific React components
src/lib/acts-registry.ts            # All acts registry
src/lib/levels-registry.ts          # Level component registry (58 custom)
```

---

## Content Hierarchy

```
Interactive Rails (58 levels, 7 acts)
├── Act 1: Foundation (L1-L8, 8 levels)
│   ├── Level 1: The Environment
│   ├── Level 2: First Boot
│   ├── Level 3: The Model
│   ├── Level 4: CRUD Operations
│   ├── Level 5: Associations
│   ├── Level 6: Routes & Request Lifecycle
│   ├── Level 7: The Controller
│   └── Level 8: Serializers
│
├── Act 2: Users & Security (L9-L14, 6 levels)
│   ├── Level 9: Authentication
│   ├── Level 10: Encrypted Attributes
│   ├── Level 11: Authorization
│   ├── Level 12: Validations
│   ├── Level 13: Strong Params
│   └── Level 14: Testing
│
├── Act 3: Clean Architecture (L15-L20, 6 levels)
│   ├── Level 15: Callbacks & Normalizations
│   ├── Level 16: Service Objects
│   ├── Level 17: Concerns & Modules
│   ├── Level 18: Validation Contracts
│   ├── Level 19: Query Objects
│   └── Level 20: Error Handling
│
├── Act 4: Performance (L21-L29, 9 levels)
│   ├── Level 21: The N+1 Problem
│   ├── Level 22: Eager Loading
│   ├── Level 23: Narrow Fetching
│   ├── Level 24: Database Indexing
│   ├── Level 25: Counter Caches
│   ├── Level 26: Pagination
│   ├── Level 27: Search
│   ├── Level 28: Caching
│   └── Level 29: HTTP Caching & CDNs
│
├── Act 5: Production (L30-L39, 10 levels)
│   ├── Level 30: Polymorphic Associations
│   ├── Level 31: Soft Deletes & Audit Trails
│   ├── Level 32: Transactions
│   ├── Level 33: Locking
│   ├── Level 34: Active Storage
│   ├── Level 35: Action Mailer
│   ├── Level 36: Background Jobs
│   ├── Level 37: Real-Time
│   ├── Level 38: External APIs
│   └── Level 39: Webhooks & Idempotency
│
├── Act 6: Operations (L40-L50, 11 levels)
│   ├── Level 40: Middleware & Rack
│   ├── Level 41: CORS
│   ├── Level 42: Rate Limiting
│   ├── Level 43: Safe Migrations
│   ├── Level 44: Recurring Jobs & Scheduling
│   ├── Level 45: Data Lifecycle
│   ├── Level 46: Structured Error Monitoring
│   ├── Level 47: Observability
│   ├── Level 48: API Versioning
│   ├── Level 49: Deployment
│   └── Level 50: Feature Flags & Staged Rollouts
│
└── Act 7: Scale (L51-L58, 8 levels)
    ├── Level 51: Multi-Database
    ├── Level 52: Multi-Tenancy
    ├── Level 53: Database Sharding
    ├── Level 54: State Machines
    ├── Level 55: Modular Monolith
    ├── Level 56: Domain Events & Decoupling
    ├── Level 57: API Gateway
    └── Level 58: The Architect (Capstone)
```

**Current Status:**
- 7 acts implemented
- 58 total levels
- Rails 8 API-only focused
- Testing required from Level 13 onward

---

## Act Schema

### TypeScript Interface

The following interfaces are simplified versions of the actual types defined in `src/types/game.ts`. See that file for the full definitions.

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
// src/features/act1-foundation/content.ts
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

Each level has a corresponding React component registered in `src/lib/levels-registry.ts`. All 58 levels have custom interactive components registered in the level registry.

### Component Location

Each level lives in its own directory under its act's `components/` folder
(see the per-level layout in CLAUDE.md). Newer levels split into phase
components + `data/` + `__tests__/`; a few legacy levels are still single-file.

```
src/features/
├── act1-foundation/components/       # level-1-environment ... level-8-serializers
├── act2-users-security/components/   # level-9-authentication ... level-14-testing
├── act3-clean-architecture/components/ # level-15-callbacks ... level-20-error-handling
├── act4-performance/components/      # level-21-n1-problem ... level-29-http-caching
├── act5-production/components/       # level-30-polymorphic ... level-39-webhooks
├── act6-operations/components/       # level-40-middleware ... level-50-feature-flags
└── act7-scale/components/            # level-51-multi-database ... level-58-architect
```

### Level Component Patterns

**Custom Interactive (58 levels):** 3-panel layout with concept-specific interaction.

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

**Generic Pipeline Builder:** `LevelPlayApp` still has a fallback for unregistered levels, but the current 58-level curriculum is registered with custom components.

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
products = Product.all
products.each do |product|
  puts product.user.name  # Query for EACH product!
end

# Good - Eager loading
products = Product.includes(:user).all
products.each do |product|
  puts product.user.name  # No additional queries
end
  `,
};
```

---

## Pipeline Configuration

### Pipeline Templates

Most levels use a standard Rails request cycle layout. Rather than duplicating inline node/connection definitions, use the reusable templates from `src/utils/pipelineTemplates.ts`:

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

The templates are one option, not a requirement. Many levels build a unique
topology instead (a custom `PipelineFlow` / `QueryZoneFlow` / bespoke
visualization) because their concept needs a specific spatial metaphor. Which
levels use a template vs a custom topology is not tracked here; the level's own
component + `startingPipeline` definition is the source of truth. Do not treat
this section as an inventory (it drifts as levels are redesigned).

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
  { type: 'crud_complete', modelType: 'Product' },
];
```

---

## Adding New Content

### Adding a New Level

1. **Update the appropriate act file in `src/features/actN-*/content/act.ts`** - Add level definition to the act
2. **Use pipeline templates** - For standard request-cycle levels, use `standardPipeline()` or `middlewarePipeline()` from `@/utils/pipelineTemplates` instead of inline node definitions
3. **Create component** - Add `LevelXXName.tsx` in the act's `components/` folder
4. **Add to level registry** - Update `src/lib/levels-registry.ts`
5. **Test** - Verify level loads and completes correctly

### Adding a New Act

1. **Create feature directory** - `src/features/actN-name/`
2. **Create content file** - `src/features/actN-name/content/act.ts`
3. **Create index** - `src/features/actN-name/index.ts` exporting content
4. **Update acts registry** - Import and add in `src/lib/acts-registry.ts`
5. **Create components** - Add `components/LevelXXName.tsx` for each level
6. **Register components** - Import and add in `src/lib/levels-registry.ts`

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

**Act 1 - Foundation (L1-L8):**
- The environment (Ruby, Rails, PostgreSQL via mise)
- First boot (`rails new --api --database=postgresql`)
- Models and migrations
- CRUD operations (Rails console)
- Associations (has_many, belongs_to)
- Routes and request lifecycle
- Controllers and actions
- Serializers (JSON output)

**Act 2 - Users & Security (L9-L14):**
- Authentication (Rails 8 built-in, Bearer tokens)
- Encrypted attributes (Active Record Encryption)
- Authorization (Pundit)
- Validations
- Strong Params (`params.expect`)
- Testing (RSpec + FactoryBot)

**Act 3 - Clean Architecture (L15-L20):**
- Callbacks and normalizations
- Service objects (Result pattern)
- Concerns and modules
- Validation contracts (dry-validation)
- Query objects
- Error handling (rescue_from)

**Act 4 - Performance (L21-L29):**
- N+1 query detection (Prosopite)
- Eager loading (includes, preload, eager_load)
- Narrow fetching (select, pluck, batches)
- Database indexing
- Counter caches
- Pagination (Pagy)
- Search (full-text, pg_search)
- Caching (Solid Cache)
- HTTP caching and CDNs

**Act 5 - Production (L30-L39):**
- Polymorphic associations
- Soft deletes and audit trails
- Transactions
- Locking (optimistic and pessimistic)
- Active Storage (file uploads)
- Action Mailer
- Background jobs (Solid Queue)
- Real-time (Action Cable / Solid Cable)
- External API integrations
- Webhooks and idempotency

**Act 6 - Operations (L40-L50):**
- Middleware and Rack
- CORS (rack-cors)
- Rate limiting (Rails 8 built-in + Rack::Attack)
- Safe migrations (strong_migrations)
- Recurring jobs and scheduling (Solid Queue)
- Data lifecycle
- Structured error monitoring (Rails.error)
- Observability (lograge, OpenTelemetry, /up)
- API versioning
- Deployment (Kamal 2)
- Feature flags and staged rollouts

**Act 7 - Scale (L51-L58):**
- Multi-database (read replicas)
- Multi-tenancy
- Database sharding
- State machines
- Modular monolith (Packwerk)
- Domain events and decoupling
- API gateway
- The Architect (service-extraction capstone)

---

## Implementation Files

| Content Type | Location |
|--------------|----------|
| Act definitions | `src/features/act*-*/content/act.ts` |
| Level components | `src/features/act*-*/components/` |
| Pipeline templates | `src/utils/pipelineTemplates.ts` |
| Acts registry | `src/lib/acts-registry.ts` |
| Level registry | `src/lib/levels-registry.ts` |
| Node types | `src/utils/gameData.ts` |
| Pipeline types | `src/types/game.ts` |
| Game store | `src/stores/game.ts` |

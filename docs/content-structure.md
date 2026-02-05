# Content Structure

This document explains how game content (acts, levels) is organized and managed.

## Overview

Game content is defined in the frontend as TypeScript data structures and React components.

**Content Locations:**
```
frontend/src/content/acts.ts          # Act and level definitions
frontend/src/components/game/levels/  # Level-specific components
```

---

## Content Hierarchy

```
RailsExpert
├── Act 1: Rails Fundamentals (8 levels)
│   ├── Level 1: Choose Your Stack
│   ├── Level 2: First Request
│   ├── Level 3: Model Introduction
│   ├── Level 4: CRUD Operations
│   ├── Level 5: Controller Actions
│   ├── Level 6: Views & Templates
│   ├── Level 7: MVC Pipeline
│   └── Level 8: Database Persistence
│
├── Act 2: Clean Code (10 levels)
│   ├── Level 9: Security Basics
│   ├── Level 10: Scopes
│   ├── Level 11: Service Objects
│   ├── Level 12: Form Objects
│   ├── Level 13: Authorization
│   ├── Level 14: View Components
│   └── ... (10 total)
│
├── Act 3: Performance (12 levels)
│   ├── Level 19: N+1 Query Problem
│   ├── Level 20: Eager Loading
│   ├── Level 21: Query Optimization
│   ├── Level 22: Caching Strategies
│   ├── Level 23: Background Jobs
│   └── ... (12 total)
│
├── Act 4: Production (12 levels)
│   ├── Event-Driven Architecture
│   ├── Feature Flags
│   ├── Read/Write Split
│   ├── Circuit Breakers
│   └── ... (12 total)
│
├── Act 5: Infrastructure (5 levels)
│   ├── Load Balancing
│   ├── CDN Configuration
│   ├── Rate Limiting
│   ├── Connection Pooling
│   └── Deployments
│
└── Act 6: System Design (4 levels)
    ├── Message Queues
    ├── Distributed Caching
    ├── API Gateway
    └── Microservices
```

**Current Status:**
- 6 acts implemented
- 35 total levels
- All with pipeline-building gameplay

---

## Act Schema

### TypeScript Interface

```typescript
interface Act {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  levels: Level[];
  unlockRequirement?: {
    actId?: string;
    levelId?: string;
  };
}

interface Level {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  concepts: string[];
  objectives: string[];
  availableNodes: string[];
  availableDefenses?: string[];
  successConditions: SuccessCondition[];
  starThresholds: {
    one: number;
    two: number;
    three: number;
  };
}

interface SuccessCondition {
  type: 'throughput' | 'latency' | 'queries' | 'cache' | 'errors';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  label: string;
}
```

### Example Act Definition

```typescript
// frontend/src/content/acts.ts
export const acts: Act[] = [
  {
    id: 'act-1',
    number: 1,
    title: 'Rails Fundamentals',
    subtitle: 'Building the Foundation',
    description: 'Learn the core concepts of Ruby on Rails through hands-on pipeline building.',
    levels: [
      {
        id: '1-1',
        number: 1,
        title: 'Choose Your Stack',
        subtitle: 'Your First Pipeline',
        description: 'Set up a basic request-response pipeline.',
        difficulty: 1,
        concepts: ['MVC', 'Request Lifecycle', 'HTTP'],
        objectives: [
          'Connect Request to Router',
          'Route to Controller',
          'Return Response'
        ],
        availableNodes: ['request', 'router', 'controller', 'response'],
        successConditions: [
          { type: 'throughput', operator: 'gte', value: 10, label: '10+ RPS' }
        ],
        starThresholds: { one: 50, two: 70, three: 90 }
      },
      // ... more levels
    ]
  },
  // ... more acts
];
```

---

## Level Components

Each level has a corresponding React component that defines its specific behavior.

### Component Location

```
frontend/src/components/game/levels/
├── act1/
│   ├── Level1StackChoice.tsx
│   ├── Level2FirstRequest.tsx
│   ├── Level3Model.tsx
│   └── ...
├── act2/
│   ├── Level9Security.tsx
│   └── ...
├── act3/
│   ├── Level19N1Query.tsx
│   └── ...
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
    <LevelLayout levelId="1-1">
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
  sections: ContentSection[];
}

interface ContentSection {
  heading: string;
  content: string;       // Markdown supported
  codeExample?: string;  // Syntax highlighted
  tips?: string[];
  warnings?: string[];
}
```

### Example Learning Content

```typescript
const learningContent: LearningContent = {
  title: 'N+1 Query Problem',
  sections: [
    {
      heading: 'What is N+1?',
      content: `
The N+1 query problem occurs when your code executes one query to fetch
a list of records, then N additional queries to fetch associated records
for each item in the list.
      `,
      codeExample: `
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
      tips: [
        'Use includes() to eager load associations',
        'Check Rails logs for repeated queries',
        'Use bullet gem to detect N+1 in development'
      ]
    }
  ]
};
```

---

## Pipeline Configuration

### Initial Nodes

Levels define starting pipeline nodes:

```typescript
const initialNodes: PlacedNode[] = [
  { id: 'request-1', type: 'request', x: 100, y: 200, locked: true },
  { id: 'router-1', type: 'router', x: 300, y: 200, locked: true },
  { id: 'controller-1', type: 'controller', x: 500, y: 200 },
  // User can move/configure controller
];
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

Define what metrics must be achieved:

```typescript
const successConditions: SuccessCondition[] = [
  { type: 'throughput', operator: 'gte', value: 100, label: 'Handle 100+ RPS' },
  { type: 'latency', operator: 'lte', value: 50, label: 'p95 latency < 50ms' },
  { type: 'queries', operator: 'lte', value: 3, label: 'Max 3 queries/request' },
];
```

---

## Adding New Content

### Adding a New Level

1. **Update acts.ts** - Add level definition to the appropriate act
2. **Create component** - Add `LevelXXName.tsx` in the act folder
3. **Add to level registry** - Update the level component map
4. **Test** - Verify level loads and completes correctly

### Adding a New Act

1. **Update acts.ts** - Add new act object with levels array
2. **Create folder** - `frontend/src/components/game/levels/actN/`
3. **Create components** - Add component for each level
4. **Update navigation** - Ensure acts list shows new act
5. **Set unlock requirements** - Define what unlocks this act

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
      levelId="X-X"
      title="Level Title"
      availableNodes={['request', 'router', 'controller']}
      successConditions={[
        { type: 'throughput', operator: 'gte', value: 50, label: '50+ RPS' }
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

**Act 1 - Rails Fundamentals:**
- MVC pattern
- Request lifecycle
- Basic routing
- Controllers and actions
- Views and templates
- Database basics

**Act 2 - Clean Code:**
- Security best practices
- Query scopes
- Service objects
- Form objects
- Authorization patterns
- View components

**Act 3 - Performance:**
- N+1 query detection
- Eager loading
- Query optimization
- Caching strategies
- Background jobs
- Pagination

**Act 4 - Production:**
- Event-driven architecture
- Feature flags
- Database scaling
- Circuit breakers
- Health checks
- Observability

**Act 5 - Infrastructure:**
- Load balancing
- CDN configuration
- Rate limiting
- Connection pooling
- Deployment strategies

**Act 6 - System Design:**
- Message queues
- Distributed caching
- API gateways
- Microservices patterns

---

## Implementation Files

| Content Type | Location |
|--------------|----------|
| Act definitions | `frontend/src/content/acts.ts` |
| Level components | `frontend/src/components/game/levels/` |
| Node types | `frontend/src/components/game/data.ts` |
| Pipeline types | `frontend/src/components/game/types.ts` |
| Game store | `frontend/src/stores/game.ts` |

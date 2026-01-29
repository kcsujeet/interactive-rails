# Content Structure

This document explains how game content (realms, dungeons, challenges) is organized and managed.

## Overview

All game content is embedded in a single TypeScript file due to Cloudflare Workers' inability to read filesystem at runtime.

**Content Location:**
```
worker/src/services/content.ts
```

---

## Content Hierarchy

```
RailsExpert
├── Realm 1: Foundation Fortress
│   ├── Dungeon: mvc (10 challenges)
│   ├── Dungeon: directory (10 challenges)
│   ├── Dungeon: routing-basics (10 challenges)
│   ├── Dungeon: controllers-101 (10 challenges)
│   └── Dungeon: views-erb (10 challenges)
│
├── Realm 2: ActiveRecord Depths
│   ├── Dungeon: models (10 challenges)
│   ├── Dungeon: associations (10 challenges)
│   ├── Dungeon: validations (10 challenges)
│   ├── Dungeon: callbacks (10 challenges)
│   └── Dungeon: queries (10 challenges)
│
├── Realm 3: Routing Labyrinth
│   ├── Dungeon: restful (10 challenges)
│   ├── Dungeon: nested (10 challenges)
│   ├── Dungeon: custom (10 challenges)
│   ├── Dungeon: constraints (10 challenges)
│   └── Dungeon: url-helpers (10 challenges)
│
└── Realms 4-11: (Planned - no challenges yet)
    ├── Controller Citadel
    ├── View Valley
    ├── Database Dungeons
    ├── Performance Peaks
    ├── Email & Notifications
    ├── Database Mastery
    ├── DevOps & Deployment
    └── Architecture Apex
```

**Current Status:**
- 3 realms implemented
- 15 dungeons with challenges
- 150 total challenges

---

## Challenge ID Format

Challenge IDs follow a consistent naming pattern:

```
{realm}-{dungeon}-{number}
```

**Examples:**
- `foundation-mvc-001` - Foundation realm, MVC dungeon, challenge 1
- `activerecord-associations-005` - ActiveRecord realm, associations dungeon, challenge 5
- `routing-restful-010` - Routing realm, RESTful dungeon, challenge 10

---

## Dungeon to Prefix Mapping

The content service uses a mapping to find challenges for each dungeon:

```typescript
const dungeonToPrefix: Record<string, string> = {
  // Foundation Fortress
  'mvc': 'foundation-mvc',
  'directory': 'foundation-directory',
  'routing-basics': 'foundation-routing',
  'controllers-101': 'foundation-controllers',
  'views-erb': 'foundation-views',

  // ActiveRecord Depths
  'models': 'activerecord-models',
  'associations': 'activerecord-associations',
  'validations': 'activerecord-validations',
  'callbacks': 'activerecord-callbacks',
  'queries': 'activerecord-queries',

  // Routing Labyrinth
  'restful': 'routing-restful',
  'nested': 'routing-nested',
  'custom': 'routing-custom',
  'constraints': 'routing-constraints',
  'url-helpers': 'routing-helpers',
};
```

---

## Challenge Schema

### TypeScript Interface

```typescript
interface Challenge {
  id: string;                    // Unique identifier
  type: 'multiple_choice' | 'fill_in_blank' | 'code_analysis';
  difficulty: 1 | 2 | 3 | 4;     // 1=easy, 4=expert
  xp_reward: number;             // Base XP for correct answer
  question: string;              // The challenge question
  code_snippet?: string;         // Optional code to display
  options?: Option[];            // For multiple choice
  correct_answer: string;        // The correct answer
  explanation: string;           // Shown after answering
  monster?: Monster;             // Optional monster data
}

interface Option {
  id: string;   // 'a', 'b', 'c', or 'd'
  text: string; // Option text
}

interface Monster {
  name: string;
  hp: number;
}
```

### Example Challenges

**Multiple Choice:**
```typescript
{
  id: 'foundation-mvc-001',
  type: 'multiple_choice',
  difficulty: 1,
  xp_reward: 20,
  question: 'What does MVC stand for in Ruby on Rails?',
  options: [
    { id: 'a', text: 'Model-View-Controller' },
    { id: 'b', text: 'Module-Variable-Class' },
    { id: 'c', text: 'Main-Visual-Component' },
    { id: 'd', text: 'Method-Value-Constant' }
  ],
  correct_answer: 'a',
  explanation: 'MVC stands for Model-View-Controller, a software design pattern that Rails is built upon. Models handle data, Views handle presentation, and Controllers handle logic.',
  monster: { name: 'Architecture Gremlin', hp: 30 }
}
```

**Fill in the Blank:**
```typescript
{
  id: 'activerecord-associations-003',
  type: 'fill_in_blank',
  difficulty: 2,
  xp_reward: 25,
  question: 'Fill in the blank to create a one-to-many association:',
  code_snippet: 'class Author < ApplicationRecord\n  has_many :____\nend',
  correct_answer: 'books',
  explanation: 'The has_many association creates a one-to-many relationship. An Author has_many :books means each author can have multiple books.'
}
```

**Code Analysis:**
```typescript
{
  id: 'activerecord-queries-007',
  type: 'code_analysis',
  difficulty: 3,
  xp_reward: 35,
  question: 'What does this query return?',
  code_snippet: 'User.where(active: true).order(created_at: :desc).limit(5).pluck(:email)',
  options: [
    { id: 'a', text: 'Array of User objects' },
    { id: 'b', text: 'Array of email strings' },
    { id: 'c', text: 'ActiveRecord::Relation' },
    { id: 'd', text: 'A single email string' }
  ],
  correct_answer: 'b',
  explanation: 'The pluck(:email) method extracts only the email column values and returns them as an array of strings, not full User objects.'
}
```

---

## Realm Schema

### TypeScript Interface

```typescript
interface Realm {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  dungeons: string[];  // Array of dungeon IDs
  unlockRequirement?: {
    level?: number;
    realm?: string;  // Complete this realm to unlock
  };
}
```

### Realm Definitions

```typescript
export const realms: Realm[] = [
  {
    id: 'foundation',
    name: 'Foundation Fortress',
    description: 'Master the basics of Ruby on Rails',
    difficulty: 'beginner',
    dungeons: ['mvc', 'directory', 'routing-basics', 'controllers-101', 'views-erb'],
    unlockRequirement: null, // Always unlocked
  },
  {
    id: 'activerecord',
    name: 'ActiveRecord Depths',
    description: 'Dive deep into database interactions',
    difficulty: 'beginner',
    dungeons: ['models', 'associations', 'validations', 'callbacks', 'queries'],
    unlockRequirement: { realm: 'foundation' },
  },
  {
    id: 'routing',
    name: 'Routing Labyrinth',
    description: 'Navigate the paths of Rails routing',
    difficulty: 'intermediate',
    dungeons: ['restful', 'nested', 'custom', 'constraints', 'url-helpers'],
    unlockRequirement: { realm: 'activerecord' },
  },
  // ... more realms
];
```

---

## Content Service Functions

### getDungeonChallenges(dungeonId)

Returns all challenges for a specific dungeon.

```typescript
export function getDungeonChallenges(dungeonId: string): Challenge[] {
  const prefix = dungeonToPrefix[dungeonId];
  if (!prefix) return [];
  return allChallenges.filter(c => c.id.startsWith(prefix));
}

// Usage
const challenges = getDungeonChallenges('mvc');
// Returns 10 challenges with IDs starting with 'foundation-mvc-'
```

### getChallenge(challengeId)

Returns a single challenge by ID.

```typescript
export function getChallenge(challengeId: string): Challenge | undefined {
  return allChallenges.find(c => c.id === challengeId);
}

// Usage
const challenge = getChallenge('foundation-mvc-001');
```

### getAllChallenges()

Returns all challenges (used for debugging/admin).

```typescript
export function getAllChallenges(): Challenge[] {
  return allChallenges;
}
```

### getDungeonMeta(dungeonId)

Returns metadata for a dungeon.

```typescript
export function getDungeonMeta(dungeonId: string): DungeonMeta | undefined {
  return dungeonMeta[dungeonId];
}

// DungeonMeta structure
interface DungeonMeta {
  name: string;
  description: string;
  difficulty: number;
}
```

---

## Adding New Content

### Adding a New Challenge

1. Open `worker/src/services/content.ts`
2. Find the `allChallenges` array
3. Add a new challenge object following the schema
4. Use the correct ID format: `{realm}-{dungeon}-{number}`

```typescript
const allChallenges: Challenge[] = [
  // ... existing challenges

  // Add new challenge
  {
    id: 'foundation-mvc-011', // Increment from last
    type: 'multiple_choice',
    difficulty: 2,
    xp_reward: 25,
    question: 'Your question here',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
      { id: 'c', text: 'Option C' },
      { id: 'd', text: 'Option D' }
    ],
    correct_answer: 'a',
    explanation: 'Explanation here'
  }
];
```

### Adding a New Dungeon

1. Add dungeon ID to the realm's `dungeons` array in `realms`
2. Add mapping in `dungeonToPrefix`
3. Add 10 challenges with the new dungeon prefix
4. Add dungeon metadata to `dungeonMeta`

```typescript
// 1. Add to realm
{
  id: 'foundation',
  dungeons: ['mvc', 'directory', ..., 'new-dungeon'],
}

// 2. Add mapping
const dungeonToPrefix = {
  // ...
  'new-dungeon': 'foundation-newdungeon',
};

// 3. Add challenges
{
  id: 'foundation-newdungeon-001',
  // ...
}

// 4. Add metadata
const dungeonMeta = {
  'new-dungeon': {
    name: 'New Dungeon Name',
    description: 'Description here',
    difficulty: 2
  }
};
```

### Adding a New Realm

1. Add realm object to `realms` array
2. Add all dungeon mappings
3. Add 50 challenges (5 dungeons × 10 challenges)

---

## Content Guidelines

### Challenge Writing Tips

1. **Clear Questions** - Be specific and unambiguous
2. **Realistic Code** - Use production-quality Ruby/Rails code
3. **Good Distractors** - Wrong options should be plausible
4. **Helpful Explanations** - Teach, don't just confirm

### Difficulty Guidelines

| Difficulty | Description | Time Expected |
|------------|-------------|---------------|
| 1 (Easy) | Basic concepts, recall | 5-10 seconds |
| 2 (Medium) | Application of concepts | 10-20 seconds |
| 3 (Hard) | Complex scenarios | 20-40 seconds |
| 4 (Expert) | Edge cases, deep knowledge | 30-60 seconds |

### Topics by Realm

**Foundation Fortress (Realm 1):**
- MVC pattern
- Directory structure
- Basic routing
- Controller basics
- Views and ERB

**ActiveRecord Depths (Realm 2):**
- Model basics
- Associations (has_many, belongs_to, has_one, has_and_belongs_to_many)
- Validations
- Callbacks
- Query interface

**Routing Labyrinth (Realm 3):**
- RESTful routes
- Nested resources
- Custom routes
- Constraints
- URL helpers

---

## Verifying Content

### Count Challenges per Dungeon

```bash
# In the project root
cd worker
grep -c "foundation-mvc-" src/services/content.ts
# Should output: 10
```

### Test API Response

```bash
# Start the worker
bun run dev:worker

# Test dungeon challenges endpoint
curl http://localhost:8787/api/game/dungeons/mvc/challenges | jq '.challenges | length'
# Should output: 10
```

---

## Future: External Content (Phase 2+)

When the content grows beyond what's practical to embed:

1. **Option A**: Cloudflare KV
   - Store challenges as JSON in KV
   - Key: challenge ID, Value: JSON
   - Pros: Simple, fast reads
   - Cons: No querying

2. **Option B**: D1 Database
   - Create `challenges` table
   - Query challenges by dungeon
   - Pros: Full SQL, relationships
   - Cons: More complex migrations

3. **Option C**: External API
   - Dedicated content API
   - Worker fetches challenges
   - Pros: Scalable, CMS-friendly
   - Cons: Added latency, complexity

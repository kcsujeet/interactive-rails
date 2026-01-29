# Game Mechanics

This document details the gameplay systems in RailsExpert.

## Overview

RailsExpert uses RPG mechanics to make learning Rails engaging:
- **XP & Levels** - Progress through correct answers
- **HP System** - Lose health on wrong answers
- **Time Bonuses** - Faster answers earn more XP
- **Damage System** - Deal damage to monsters on correct answers
- **Progression** - Unlock new realms and dungeons

---

## XP (Experience Points)

### Earning XP

XP is awarded for correct answers. Base XP comes from challenge difficulty.

**Base XP by Difficulty:**
| Difficulty | Base XP |
|------------|---------|
| 1 (Easy) | 20 |
| 2 (Medium) | 25 |
| 3 (Hard) | 35 |
| 4 (Expert) | 50 |

### Time Bonus

Answer faster to earn bonus XP multipliers.

```typescript
// worker/src/routes/game.ts
const timeBonus = timeTakenMs < 10000 ? 1.5 :  // Under 10 seconds: 50% bonus
                  timeTakenMs < 20000 ? 1.2 :  // Under 20 seconds: 20% bonus
                  1;                            // Over 20 seconds: no bonus

xpGained = Math.floor(challenge.xp_reward * timeBonus);
```

**Example:**
- Difficulty 2 challenge (25 base XP)
- Answered in 8 seconds
- XP earned: 25 × 1.5 = 37 XP

### Wrong Answers

Wrong answers award 0 XP. No partial credit.

---

## Leveling System

### XP Required per Level

XP requirements increase exponentially.

```typescript
// worker/src/services/game.ts
export function calculateXpForLevel(level: number): number {
  // Base 100 XP, increasing by 50% each level
  return Math.floor(100 * Math.pow(1.5, level - 1));
}
```

**XP Requirements:**
| Level | XP Required | Cumulative |
|-------|-------------|------------|
| 1 → 2 | 100 | 100 |
| 2 → 3 | 150 | 250 |
| 3 → 4 | 225 | 475 |
| 4 → 5 | 337 | 812 |
| 5 → 6 | 506 | 1,318 |
| 10 | 3,844 | ~7,600 |
| 20 | 221,851 | ~440,000 |
| 50 | ~637M | - |
| 100 | ~4.0E14 | - |

### Level Up Rewards

When leveling up:
1. **Full HP Restore** - HP resets to max
2. **Max HP Increase** - +10 max HP per level
3. **Realm Unlocks** - Some realms require minimum level

```typescript
if (newXp >= xpForNextLevel) {
  newLevel = progress.level + 1;
  // Heal on level up
  newHp = 100 + (newLevel - 1) * 10; // Max HP formula
}
```

**Max HP by Level:**
| Level | Max HP |
|-------|--------|
| 1 | 100 |
| 5 | 140 |
| 10 | 190 |
| 20 | 290 |

---

## HP (Health Points)

### Starting HP

All new players start with:
- Current HP: 100
- Max HP: 100

### Taking Damage (Wrong Answers)

When you answer incorrectly, the monster attacks.

```typescript
// HP lost = base 10 + (difficulty * 5)
const hpLost = 10 + challenge.difficulty * 5;
newHp = Math.max(0, progress.current_hp - hpLost);
```

**Damage Taken by Difficulty:**
| Difficulty | HP Lost |
|------------|---------|
| 1 | 15 |
| 2 | 20 |
| 3 | 25 |
| 4 | 30 |

### HP = 0 (Defeat)

When HP reaches 0:
- Battle ends
- Player must restart dungeon
- No XP penalty (keep what you earned)

### Healing

HP is restored:
1. **Level Up** - Full heal to new max HP
2. **Complete Dungeon** - Partial heal (planned)
3. **Daily Login** - Heal 20 HP (planned)

---

## Damage System (Player → Monster)

### Monster HP

Each challenge has an associated monster with HP.

**Monster HP by Difficulty:**
| Difficulty | Monster HP |
|------------|------------|
| 1 | 30 |
| 2 | 50 |
| 3 | 70 |
| 4 | 100 |

### Dealing Damage

Correct answers deal damage to the monster.

```typescript
// worker/src/services/game.ts
export function calculateDamage(difficulty: number, timeTakenMs: number): number {
  const baseDamage = 10 + difficulty * 5;
  const timeMultiplier = timeTakenMs < 10000 ? 1.5 :
                         timeTakenMs < 20000 ? 1.2 : 1;
  return Math.floor(baseDamage * timeMultiplier);
}
```

**Damage Dealt:**
| Difficulty | Base | Fast (<10s) | Medium (<20s) |
|------------|------|-------------|---------------|
| 1 | 15 | 22 | 18 |
| 2 | 20 | 30 | 24 |
| 3 | 25 | 37 | 30 |
| 4 | 30 | 45 | 36 |

### Monster Defeat

When monster HP reaches 0:
- Challenge is marked complete
- Move to next challenge
- (Animation plays on frontend)

---

## Realm Progression

### Realm Structure

```
Realm (e.g., "Foundation Fortress")
├── Dungeon 1 (e.g., "MVC Architecture") - 10 challenges
├── Dungeon 2 (e.g., "Directory Structure") - 10 challenges
├── Dungeon 3 (e.g., "Basic Routing") - 10 challenges
├── Dungeon 4 (e.g., "Controllers 101") - 10 challenges
└── Dungeon 5 (e.g., "Views & ERB") - 10 challenges
```

### Unlock Requirements

| Realm | Requirement |
|-------|-------------|
| Foundation Fortress | Always unlocked |
| ActiveRecord Depths | Complete Foundation OR Level 3 |
| Routing Labyrinth | Complete ActiveRecord OR Level 5 |
| Controller Citadel | Complete Routing |
| View Valley | Complete Controllers |
| Database Dungeons | Level 10 |
| Performance Peaks | Level 15 |
| Email & Notifications | Level 20 |
| Database Mastery | Level 25 |
| DevOps & Deployment | Level 30 |
| Architecture Apex | Level 40 |

### Dungeon Unlocks

Within a realm:
- **Dungeon 1** - Always unlocked when realm is unlocked
- **Dungeon 2+** - Requires previous dungeon completed

---

## Challenge Types

### Multiple Choice

Select the correct answer from 4 options.

```json
{
  "type": "multiple_choice",
  "question": "Which command generates a new Rails model?",
  "options": [
    { "id": "a", "text": "rails generate model" },
    { "id": "b", "text": "rails create model" },
    { "id": "c", "text": "rails new model" },
    { "id": "d", "text": "rails make model" }
  ],
  "correct_answer": "a"
}
```

**Answer format:** Single letter (a, b, c, or d)

### Fill in the Blank

Type the missing code or term.

```json
{
  "type": "fill_in_blank",
  "question": "Complete the association",
  "code_snippet": "class Post < ApplicationRecord\n  has_many :____\nend",
  "correct_answer": "comments"
}
```

**Answer format:** Text (case-insensitive comparison)

### Code Analysis

Analyze a code snippet and answer a question.

```json
{
  "type": "code_analysis",
  "question": "What will this code output?",
  "code_snippet": "User.where(active: true).pluck(:email)",
  "options": [
    { "id": "a", "text": "Array of User objects" },
    { "id": "b", "text": "Array of email strings" },
    { "id": "c", "text": "ActiveRecord::Relation" },
    { "id": "d", "text": "Single email string" }
  ],
  "correct_answer": "b"
}
```

---

## Scoring

### Dungeon Score

Score is calculated per dungeon run:

```
Score = Σ (XP gained per challenge)
```

Best score is saved for leaderboard purposes.

### Accuracy

```
Accuracy = (Correct Answers / Total Attempts) × 100
```

---

## Daily Streak (Planned)

### How It Works

1. Play at least one challenge per day
2. Streak counter increases
3. Miss a day = streak resets to 0

### Streak Bonuses (Planned)

| Streak | Bonus |
|--------|-------|
| 3 days | +10% XP |
| 7 days | +20% XP |
| 14 days | +30% XP |
| 30 days | +50% XP |

---

## Achievements (Planned)

Example achievements:

| Achievement | Requirement |
|-------------|-------------|
| First Blood | Complete first challenge |
| Perfect Run | Complete a dungeon with no wrong answers |
| Speed Demon | Answer 10 challenges under 10 seconds each |
| Streak Master | Reach 30-day streak |
| Rails Warrior | Reach level 50 |
| Realm Conqueror | Complete all dungeons in a realm |
| Bug Squasher | Answer 100 challenges correctly |

---

## Implementation Files

| Mechanic | File Location |
|----------|---------------|
| XP calculation | `worker/src/services/game.ts` |
| Damage calculation | `worker/src/services/game.ts` |
| Challenge submission | `worker/src/routes/game.ts` |
| Progress tracking | `worker/src/routes/progress.ts` |
| Level requirements | `worker/src/services/game.ts` |

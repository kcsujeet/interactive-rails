// Boss dungeon: The Database Guardian
// Combines all database optimization concepts

import type { Dungeon, Room, BossRoom, BossPhase } from '../../../../shared/types/dungeon';
import type { BaseNode, Connection } from '../../../../shared/types/pipeline';
import { createNode } from '../../../../shared/types/pipeline';

// Complex e-commerce pipeline with multiple issues
const createBossInitialNodes = (): BaseNode[] => [
  // Entry
  createNode('request', { x: 50, y: 250 }, {
    id: 'req-1',
    config: { method: 'GET', path: '/checkout/:id' }
  }),
  createNode('router', { x: 180, y: 250 }, { id: 'router-1' }),

  // Checkout controller
  createNode('controller', { x: 320, y: 250 }, {
    id: 'checkout-ctrl',
    config: {
      name: 'CheckoutController',
      actions: ['show'],
      beforeActions: [{ name: 'load_cart' }, { name: 'calculate_totals' }],
    }
  }),

  // Cart model (N+1 potential)
  createNode('model', { x: 480, y: 150 }, {
    id: 'cart-model',
    config: {
      name: 'Cart',
      tableName: 'carts',
      associations: [
        { type: 'belongs_to', name: 'user' },
        { type: 'has_many', name: 'cart_items' },
      ],
      defaultIncludes: [], // Missing eager loading!
    }
  }),

  // CartItem model (N+1 potential)
  createNode('model', { x: 480, y: 350 }, {
    id: 'cart-item-model',
    config: {
      name: 'CartItem',
      tableName: 'cart_items',
      associations: [
        { type: 'belongs_to', name: 'cart' },
        { type: 'belongs_to', name: 'product' },
      ],
      defaultIncludes: [], // Missing eager loading!
    }
  }),

  // Product model
  createNode('model', { x: 640, y: 350 }, {
    id: 'product-model',
    config: {
      name: 'Product',
      tableName: 'products',
      associations: [
        { type: 'has_many', name: 'inventory_items' },
        { type: 'belongs_to', name: 'category' },
      ],
      defaultIncludes: [],
    }
  }),

  // Database (missing indexes)
  createNode('database', { x: 800, y: 250 }, {
    id: 'db-1',
    config: {
      tables: [
        {
          name: 'carts',
          columns: [
            { name: 'id', type: 'integer' },
            { name: 'user_id', type: 'integer' },
            { name: 'status', type: 'string' },
          ],
          indexes: [], // Missing user_id index!
        },
        {
          name: 'cart_items',
          columns: [
            { name: 'id', type: 'integer' },
            { name: 'cart_id', type: 'integer' },
            { name: 'product_id', type: 'integer' },
            { name: 'quantity', type: 'integer' },
          ],
          indexes: [], // Missing foreign key indexes!
        },
        {
          name: 'products',
          columns: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'float' },
          ],
          indexes: [{ columns: ['id'], unique: true }],
        },
      ],
    }
  }),

  // View
  createNode('view', { x: 640, y: 150 }, {
    id: 'view-1',
    config: {
      template: 'checkout/show',
      partials: ['_cart_item', '_product_summary', '_price_breakdown'],
      accessedAssociations: ['cart_items', 'product', 'category'],
    }
  }),

  // Response
  createNode('response', { x: 800, y: 150 }, { id: 'resp-1' }),
];

const createBossConnections = (): Connection[] => [
  { id: 'c1', sourceNodeId: 'req-1', sourcePortId: 'out', targetNodeId: 'router-1', targetPortId: 'in' },
  { id: 'c2', sourceNodeId: 'router-1', sourcePortId: 'out', targetNodeId: 'checkout-ctrl', targetPortId: 'in' },
  { id: 'c3', sourceNodeId: 'checkout-ctrl', sourcePortId: 'model', targetNodeId: 'cart-model', targetPortId: 'in' },
  { id: 'c4', sourceNodeId: 'cart-model', sourcePortId: 'out', targetNodeId: 'cart-item-model', targetPortId: 'in' },
  { id: 'c5', sourceNodeId: 'cart-item-model', sourcePortId: 'out', targetNodeId: 'product-model', targetPortId: 'in' },
  { id: 'c6', sourceNodeId: 'cart-model', sourcePortId: 'db', targetNodeId: 'db-1', targetPortId: 'in' },
  { id: 'c7', sourceNodeId: 'cart-item-model', sourcePortId: 'db', targetNodeId: 'db-1', targetPortId: 'in' },
  { id: 'c8', sourceNodeId: 'product-model', sourcePortId: 'db', targetNodeId: 'db-1', targetPortId: 'in' },
  { id: 'c9', sourceNodeId: 'product-model', sourcePortId: 'out', targetNodeId: 'view-1', targetPortId: 'in' },
  { id: 'c10', sourceNodeId: 'view-1', sourcePortId: 'out', targetNodeId: 'resp-1', targetPortId: 'in' },
];

// Room 1: Assessment
const room1: Room = {
  id: 'boss-assess',
  name: 'The Guardian Awakens',
  description: 'The checkout page is critically slow. Multiple performance issues have summoned the Database Guardian!',
  initialNodes: createBossInitialNodes(),
  initialConnections: createBossConnections(),
  objective: {
    type: 'stabilize',
    description: 'Analyze all performance issues in the checkout pipeline',
    targetMetrics: {
      minStability: 20,
    },
    hints: [
      'Multiple N+1 patterns are present',
      'Database indexes are missing on foreign keys',
      'No caching is in place',
    ],
  },
  stabilityThreshold: 20,
  enemySpawnRate: 1.5,
  enemyScaling: 1.2,
  availableNodeTypes: ['request', 'router', 'controller', 'model', 'database', 'cache', 'view', 'response'],
  availableDefenses: ['index_turret', 'eager_loader', 'cache_shield'],
  briefing: `The checkout page is suffering from catastrophic performance issues!

The **Database Guardian** has awakened, spawning multiple enemy types:
- **Query Swarms** from N+1 patterns
- **Timeout Wraiths** from missing indexes
- **Cache Phantoms** from lack of caching

You must use EVERYTHING you've learned to defeat this boss. Analyze the pipeline and identify:
1. Which models need eager loading?
2. Which tables need indexes?
3. Where can caching help?`,
  successMessage: 'Analysis complete. You\'ve identified the issues. Now fix them!',
};

// Room 2: Fix N+1
const room2: Room = {
  id: 'boss-nplusone',
  name: 'Banish the Swarm',
  description: 'Fix all N+1 query patterns to defeat the Query Swarm.',
  initialNodes: createBossInitialNodes(),
  initialConnections: createBossConnections(),
  objective: {
    type: 'fix',
    description: 'Configure eager loading on all models',
    targetMetrics: {
      maxQueriesPerRequest: 10,
      minStability: 40,
    },
    hints: [
      'Cart needs to eager load cart_items',
      'CartItem needs to eager load product',
      'Product needs to eager load category',
    ],
  },
  stabilityThreshold: 40,
  enemySpawnRate: 1,
  enemyScaling: 1,
  availableNodeTypes: ['request', 'router', 'controller', 'model', 'database', 'cache', 'view', 'response'],
  availableDefenses: ['eager_loader', 'index_turret'],
  briefing: `Phase 1: Defeat the **Query Swarm**!

The checkout page loads the cart, then each cart item, then each product... each in separate queries!

Configure eager loading:
- **Cart**: includes(:cart_items)
- **CartItem**: includes(:product)
- **Product**: includes(:category)

Or use a single chain: \`Cart.includes(cart_items: { product: :category })\``,
  successMessage: 'The Query Swarm is defeated! N+1 patterns eliminated.',
};

// Room 3: Add Indexes
const room3: Room = {
  id: 'boss-indexes',
  name: 'Seal the Wraith',
  description: 'Add database indexes to eliminate slow queries.',
  initialNodes: createBossInitialNodes(),
  initialConnections: createBossConnections(),
  objective: {
    type: 'fix',
    description: 'Add indexes to all foreign key columns',
    targetMetrics: {
      maxLatencyP95: 200,
      minStability: 60,
    },
    hints: [
      'carts.user_id needs an index',
      'cart_items.cart_id needs an index',
      'cart_items.product_id needs an index',
    ],
  },
  stabilityThreshold: 60,
  enemySpawnRate: 0.8,
  enemyScaling: 0.9,
  availableNodeTypes: ['request', 'router', 'controller', 'model', 'database', 'cache', 'view', 'response'],
  availableDefenses: ['index_turret', 'eager_loader'],
  briefing: `Phase 2: Seal the **Timeout Wraith**!

Even with eager loading, queries are still slow because there are no indexes on foreign keys.

Add indexes:
\`\`\`ruby
add_index :carts, :user_id
add_index :cart_items, :cart_id
add_index :cart_items, :product_id
\`\`\``,
  successMessage: 'The Timeout Wraith is sealed! Queries are now fast.',
};

// Boss Room: Final Challenge
const bossPhases: BossPhase[] = [
  {
    hpThreshold: 100,
    description: 'Full power - spawns all enemy types',
    speedMultiplier: 1,
    damageMultiplier: 1,
    spawnRate: 2,
  },
  {
    hpThreshold: 60,
    description: 'Enraged - faster spawning',
    speedMultiplier: 1.5,
    damageMultiplier: 1.2,
    spawnRate: 3,
    specialAbility: 'Disables one random defense',
  },
  {
    hpThreshold: 30,
    description: 'Desperate - massive damage',
    speedMultiplier: 0.8,
    damageMultiplier: 2,
    spawnRate: 2,
    specialAbility: 'Query count multiplied by 2',
  },
];

const bossRoom: BossRoom = {
  id: 'boss-final',
  name: 'The Database Guardian',
  description: 'Face the Database Guardian in the final battle! Maintain optimal performance to defeat it.',
  initialNodes: createBossInitialNodes(),
  initialConnections: createBossConnections(),
  objective: {
    type: 'survive',
    description: 'Maintain stability above 80 for 60 seconds',
    targetMetrics: {
      minStability: 80,
      maxLatencyP95: 150,
      maxQueriesPerRequest: 5,
      minCacheHitRate: 60,
    },
    holdDuration: 3600, // 60 seconds at 60 ticks/sec
    hints: [
      'Keep all defenses active',
      'Watch for the boss disabling your defenses in phase 2',
      'Add caching to survive the damage phase',
    ],
  },
  stabilityThreshold: 80,
  enemySpawnRate: 2,
  enemyScaling: 1.5,
  availableNodeTypes: ['request', 'router', 'controller', 'model', 'database', 'cache', 'view', 'response'],
  availableDefenses: ['index_turret', 'eager_loader', 'cache_shield'],
  bossType: 'memory_blob',
  bossName: 'The Database Guardian',
  bossDescription: 'An ancient entity formed from years of technical debt. It represents all the performance sins of the codebase.',
  phases: bossPhases,
  briefing: `**FINAL BOSS: The Database Guardian**

This is it! The Guardian represents accumulated technical debt in the database layer.

To defeat it, you must maintain **80+ stability** for **60 seconds** while the Guardian throws everything at you.

You'll need:
- Eager loading (N+1 defense)
- Database indexes (slow query defense)
- Caching (reduces load during damage phases)

The Guardian has 3 phases:
1. **Full Power** (100-60% HP): Normal attacks
2. **Enraged** (60-30% HP): Disables one defense!
3. **Desperate** (30-0% HP): Doubles query count

Good luck, Pipeline Engineer!`,
  successMessage: 'VICTORY! The Database Guardian has been defeated! You are now a true Rails Performance Expert!',
  failureMessage: 'The Guardian overwhelmed your pipeline. Review your optimizations and try again.',
};

export const bossDatabase: Dungeon = {
  id: 'boss-database',
  name: 'The Database Guardian',
  description: 'A boss dungeon that tests all your database optimization skills. Defeat the Guardian to prove your mastery!',
  difficulty: 5,
  estimatedTime: 30,
  requiredLevel: 10,
  requiredDungeons: ['tutorial-n-plus-one', 'tutorial-indexing', 'tutorial-caching'],
  rooms: [room1, room2, room3],
  bossRoom,
  xpReward: 500,
  unlocks: ['database_master_title', 'advanced_profiling_tool'],
  starThresholds: {
    one: 60,
    two: 80,
    three: 95,
  },
  concepts: ['Combined optimizations', 'Performance profiling', 'Technical debt'],
  learningGoals: [
    'Apply multiple optimization techniques together',
    'Diagnose complex performance issues',
    'Maintain performance under pressure',
    'Understand how optimizations interact',
  ],
};

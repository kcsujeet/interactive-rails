/**
 * Tutorial: Rails Caching
 *
 * Teaches players to implement various caching strategies.
 */

import type { Level, Room } from '../../types/level';

const room1: Room = {
  id: 'caching-fragment',
  name: 'Fragment Caching',
  description: 'Learn to cache view fragments to avoid redundant rendering.',
  briefing: `
    Your view is rendering the same user cards repeatedly.
    Each render is expensive and slows down the page.

    Fragment caching lets you cache rendered HTML:
    <% cache user do %>
      <%= render user %>
    <% end %>
  `,
  objective: {
    type: 'fix',
    description: 'Achieve 60% cache hit rate',
    targetMetrics: {
      minCacheHitRate: 60,
      minStability: 70,
    },
    hints: [
      'Add a Cache node before the View',
      'Configure it for fragment caching',
      'Watch the hit rate climb!',
    ],
  },
  initialNodes: [
    { type: 'request', position: { x: 100, y: 300 }, locked: true },
    { type: 'controller', position: { x: 300, y: 300 }, locked: true },
    { type: 'model', position: { x: 450, y: 300 }, locked: true },
    { type: 'database', position: { x: 600, y: 300 }, locked: true },
    { type: 'view', position: { x: 450, y: 450 }, locked: false },
    { type: 'response', position: { x: 300, y: 450 }, locked: true },
  ],
  availableNodeTypes: ['cache'],
  availableDefenses: ['cache_shield'],
  enemySpawnRate: 0.5,
  stabilityThreshold: 70,
  successMessage: 'Fragment caching is working!',
};

const room2: Room = {
  id: 'caching-russian-doll',
  name: 'Russian Doll Caching',
  description: 'Master nested fragment caching.',
  briefing: `
    Russian doll caching nests cached fragments inside each other.
    When an inner fragment changes, it invalidates the outer cache.

    This requires careful cache key management:
    <% cache [post, post.comments.maximum(:updated_at)] do %>
      ...
    <% end %>
  `,
  objective: {
    type: 'optimize',
    description: 'Achieve 80% cache hit rate',
    targetMetrics: {
      minCacheHitRate: 80,
      minStability: 80,
    },
    hints: [
      'Set up nested cache layers',
      'Use touch: true on associations',
      'Balance cache granularity',
    ],
  },
  initialNodes: [
    { type: 'request', position: { x: 100, y: 300 }, locked: true },
    { type: 'controller', position: { x: 250, y: 300 }, locked: false },
    { type: 'model', position: { x: 400, y: 250 }, config: { name: 'Post' }, locked: false },
    { type: 'model', position: { x: 400, y: 350 }, config: { name: 'Comment' }, locked: false },
    { type: 'database', position: { x: 550, y: 300 }, locked: true },
    { type: 'view', position: { x: 250, y: 450 }, locked: false },
    { type: 'response', position: { x: 100, y: 450 }, locked: true },
  ],
  availableNodeTypes: ['cache'],
  availableDefenses: ['cache_shield', 'eager_loader'],
  enemySpawnRate: 0.8,
  stabilityThreshold: 80,
  successMessage: 'Russian doll caching mastered!',
};

const room3: Room = {
  id: 'caching-low-level',
  name: 'Low-Level Caching',
  description: 'Use Rails.cache for custom caching needs.',
  briefing: `
    Sometimes you need fine-grained control over caching.
    Rails.cache provides low-level caching:

    Rails.cache.fetch("user_stats_#{user.id}", expires_in: 1.hour) do
      user.calculate_stats
    end
  `,
  objective: {
    type: 'optimize',
    description: 'Achieve 90+ stability',
    targetMetrics: {
      minCacheHitRate: 85,
      maxLatencyP95: 50,
      minStability: 90,
    },
    hints: [
      'Cache expensive computations',
      'Set appropriate TTLs',
      'Handle cache invalidation carefully',
    ],
  },
  initialNodes: [
    { type: 'request', position: { x: 100, y: 300 }, locked: true },
    { type: 'controller', position: { x: 250, y: 300 }, locked: false },
    { type: 'model', position: { x: 400, y: 300 }, locked: false },
    { type: 'database', position: { x: 550, y: 300 }, locked: false },
    { type: 'view', position: { x: 250, y: 450 }, locked: false },
    { type: 'response', position: { x: 100, y: 450 }, locked: true },
  ],
  availableNodeTypes: ['cache', 'background_job'],
  availableDefenses: ['cache_shield', 'index_turret', 'worker_drone'],
  enemySpawnRate: 1.0,
  stabilityThreshold: 90,
  successMessage: 'You are now a caching expert!',
};

export const tutorialCaching: Level = {
  id: 'tutorial-caching',
  name: 'Rails Caching Tutorial',
  description: 'Implement caching strategies to dramatically improve performance.',
  difficulty: 3,
  requiredLevel: 5,
  concepts: ['Fragment caching', 'Russian doll caching', 'Rails.cache', 'Cache invalidation'],
  rooms: [room1, room2, room3],
  starThresholds: {
    one: 70,
    two: 85,
    three: 95,
  },
  rewards: {
    xp: 200,
    unlockDefenses: ['cache_shield'],
    achievement: 'caching_expert',
  },
  prerequisites: ['tutorial-indexing'],
};

/**
 * Tutorial: N+1 Query Problem
 *
 * Teaches players to identify and fix N+1 query patterns using Rails eager loading.
 */

import type { BossRoom, Level, Room } from '@/types/level';

const room1: Room = {
	id: 'nplusone-observe',
	name: 'Observe the Problem',
	description:
		'Watch the pipeline run and observe the N+1 query pattern in action.',
	briefing: `
    Welcome to your first Rails optimization challenge!

    The Post model is querying its associated Author for each post - a classic N+1 pattern.
    Watch the metrics panel and notice how the query count increases linearly with the number of posts.
  `,
	objective: {
		type: 'stabilize',
		description: 'Observe the simulation for 10 seconds',
		hints: [
			'Watch the "Queries/Request" metric',
			'Notice the Query Swarm enemies spawning',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: true },
		{
			type: 'model',
			position: { x: 550, y: 250 },
			config: { name: 'Post', hasMany: ['author'] },
			locked: true,
		},
		{
			type: 'model',
			position: { x: 550, y: 350 },
			config: { name: 'Author' },
			locked: true,
		},
		{ type: 'database', position: { x: 700, y: 300 }, locked: true },
		{ type: 'view', position: { x: 400, y: 450 }, locked: true },
		{ type: 'response', position: { x: 250, y: 450 }, locked: true },
	],
	availableNodeTypes: [],
	availableDefenses: [],
	enemySpawnRate: 0.5,
	stabilityThreshold: 0,
	timeLimit: 15,
	successMessage:
		'You observed the N+1 pattern! Notice how each Post generates an extra Author query.',
};

const room2: Room = {
	id: 'nplusone-fix',
	name: 'Fix with Eager Loading',
	description: 'Add eager loading to eliminate the N+1 queries.',
	briefing: `
    Now that you've seen the problem, let's fix it!

    In Rails, you can use includes(:author) to eager load associations.
    Click on the Post model and enable eager loading for the Author association.

    Watch the query count drop dramatically!
  `,
	objective: {
		type: 'fix',
		description: 'Reduce queries per request below 5',
		targetMetrics: {
			maxQueriesPerRequest: 5,
			minStability: 70,
		},
		hints: [
			'Click on the Post model node',
			'Enable "eager load" for the Author association',
			'This is equivalent to Post.includes(:author)',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: true },
		{
			type: 'model',
			position: { x: 550, y: 250 },
			config: { name: 'Post', hasMany: ['author'], eagerLoad: [] },
			locked: false,
		},
		{
			type: 'model',
			position: { x: 550, y: 350 },
			config: { name: 'Author' },
			locked: true,
		},
		{ type: 'database', position: { x: 700, y: 300 }, locked: true },
		{ type: 'view', position: { x: 400, y: 450 }, locked: true },
		{ type: 'response', position: { x: 250, y: 450 }, locked: true },
	],
	availableNodeTypes: [],
	availableDefenses: ['eager_loader'],
	enemySpawnRate: 0.8,
	stabilityThreshold: 70,
	successMessage: 'Excellent! You fixed the N+1 query with eager loading.',
};

const room3: Room = {
	id: 'nplusone-optimize',
	name: 'Full Optimization',
	description: 'Optimize the entire request pipeline.',
	briefing: `
    Great progress! But there's more to optimize.

    The view is rendering without caching, and the database queries could use indexes.
    Add caching and indexes to achieve maximum stability.
  `,
	objective: {
		type: 'optimize',
		description: 'Achieve 90+ stability for 5 seconds',
		targetMetrics: {
			maxQueriesPerRequest: 3,
			minCacheHitRate: 60,
			minStability: 90,
		},
		hints: [
			'Add a Cache node between the Controller and View',
			'Configure the Database with proper indexes',
			'Watch your stability climb!',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: false },
		{
			type: 'model',
			position: { x: 550, y: 250 },
			config: { name: 'Post', hasMany: ['author'], eagerLoad: ['author'] },
			locked: false,
		},
		{
			type: 'model',
			position: { x: 550, y: 350 },
			config: { name: 'Author' },
			locked: true,
		},
		{
			type: 'database',
			position: { x: 700, y: 300 },
			config: { indexes: [] },
			locked: false,
		},
		{ type: 'view', position: { x: 400, y: 450 }, locked: false },
		{ type: 'response', position: { x: 250, y: 450 }, locked: true },
	],
	availableNodeTypes: ['cache'],
	availableDefenses: ['cache_shield', 'index_turret', 'eager_loader'],
	enemySpawnRate: 1.0,
	stabilityThreshold: 90,
	successMessage: 'Outstanding! You mastered N+1 query optimization!',
};

const bossRoom: BossRoom = {
	id: 'nplusone-boss',
	name: 'The Query Hydra',
	description:
		'Face the Query Hydra - a boss that spawns from deeply nested N+1 patterns.',
	briefing: `
    You've proven your skills. Now face the Query Hydra!

    This beast represents deeply nested N+1 queries - when you have posts with authors
    with publications with citations... each level multiplies the problem.

    Use all your optimization skills to defeat it!
  `,
	objective: {
		type: 'survive',
		description: 'Defeat the Query Hydra',
		targetMetrics: {
			maxQueriesPerRequest: 5,
			minStability: 80,
		},
		hints: [
			'The Hydra grows stronger when queries pile up',
			'Use eager loading on ALL nested associations',
			'Caching is your shield against repeated attacks',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 200, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 350, y: 300 }, locked: false },
		{
			type: 'model',
			position: { x: 500, y: 200 },
			config: { name: 'Post', hasMany: ['author', 'comments'], eagerLoad: [] },
			locked: false,
		},
		{
			type: 'model',
			position: { x: 500, y: 300 },
			config: { name: 'Author', hasMany: ['publications'], eagerLoad: [] },
			locked: false,
		},
		{
			type: 'model',
			position: { x: 500, y: 400 },
			config: { name: 'Comment', hasMany: ['replies'], eagerLoad: [] },
			locked: false,
		},
		{ type: 'database', position: { x: 700, y: 300 }, locked: false },
		{ type: 'view', position: { x: 350, y: 450 }, locked: false },
		{ type: 'response', position: { x: 200, y: 450 }, locked: true },
	],
	availableNodeTypes: ['cache', 'background_job'],
	availableDefenses: [
		'cache_shield',
		'index_turret',
		'eager_loader',
		'rate_limiter',
	],
	stabilityThreshold: 80,
	bossType: 'query_swarm',
	bossName: 'The Query Hydra',
	bossDescription:
		'A many-headed beast that multiplies with each nested N+1 query.',
	bossHp: 500,
	phases: [
		{
			hpThreshold: 75,
			enemySpawnMultiplier: 1.5,
			newMechanics: ['Spawns nested query minions'],
		},
		{
			hpThreshold: 50,
			enemySpawnMultiplier: 2.0,
			newMechanics: ['Each head attacks independently'],
		},
		{
			hpThreshold: 25,
			enemySpawnMultiplier: 3.0,
			newMechanics: ['Enrage mode - faster attacks'],
		},
	],
	successMessage:
		'You defeated the Query Hydra! The N+1 menace has been vanquished!',
	failureMessage:
		'The Query Hydra overwhelmed your system. Try optimizing more aggressively!',
};

export const tutorialNPlusOne: Level = {
	id: 'tutorial-n-plus-one',
	name: 'N+1 Query Tutorial',
	description:
		'Learn to identify and fix the infamous N+1 query problem using Rails eager loading.',
	difficulty: 1,
	requiredLevel: 1,
	concepts: [
		'N+1 queries',
		'Eager loading',
		'includes()',
		'Query optimization',
	],
	rooms: [room1, room2, room3],
	bossRoom,
	starThresholds: {
		one: 70,
		two: 85,
		three: 95,
	},
	rewards: {
		xp: 100,
		unlockNodes: ['cache'],
		unlockDefenses: ['eager_loader'],
		achievement: 'n_plus_one_vanquisher',
	},
};

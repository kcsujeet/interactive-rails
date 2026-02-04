/**
 * Tutorial: Database Indexing
 *
 * Teaches players to identify slow queries and add proper database indexes.
 */

import type { Level, Room } from '../../types/level';

const room1: Room = {
	id: 'indexing-slow-query',
	name: 'The Slow Query',
	description: 'Observe how missing indexes cause full table scans.',
	briefing: `
    Your Rails app is running a query on the users table, searching by email.
    Without an index, the database must scan every row!

    Watch the latency metrics spike and the Timeout Wraith enemies spawn.
  `,
	objective: {
		type: 'stabilize',
		description: 'Observe the slow query for 10 seconds',
		hints: [
			'Notice the p95 latency is very high',
			'Timeout Wraiths spawn from high latency',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: true },
		{
			type: 'model',
			position: { x: 550, y: 300 },
			config: { name: 'User', queries: ['WHERE email = ?'] },
			locked: true,
		},
		{
			type: 'database',
			position: { x: 700, y: 300 },
			config: { indexes: [], rowCount: 100000 },
			locked: true,
		},
		{ type: 'response', position: { x: 400, y: 450 }, locked: true },
	],
	availableNodeTypes: [],
	availableDefenses: [],
	enemySpawnRate: 0.6,
	stabilityThreshold: 0,
	timeLimit: 15,
	successMessage:
		'You saw the problem! Full table scans are devastating at scale.',
};

const room2: Room = {
	id: 'indexing-add-index',
	name: 'Add the Index',
	description: 'Add a database index to speed up the query.',
	briefing: `
    Time to fix it! Add an index on the email column.

    In Rails, you'd run:
    add_index :users, :email

    Click on the Database node and add the index.
  `,
	objective: {
		type: 'fix',
		description: 'Reduce p95 latency below 100ms',
		targetMetrics: {
			maxLatencyP95: 100,
			minStability: 75,
		},
		hints: [
			'Click on the Database node',
			'Add an index on the email column',
			'Watch latency drop dramatically!',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: true },
		{
			type: 'model',
			position: { x: 550, y: 300 },
			config: { name: 'User', queries: ['WHERE email = ?'] },
			locked: true,
		},
		{
			type: 'database',
			position: { x: 700, y: 300 },
			config: { indexes: [], rowCount: 100000 },
			locked: false,
		},
		{ type: 'response', position: { x: 400, y: 450 }, locked: true },
	],
	availableNodeTypes: [],
	availableDefenses: ['index_turret'],
	enemySpawnRate: 0.8,
	stabilityThreshold: 75,
	successMessage: 'Index added! Queries now use the index instead of scanning.',
};

const room3: Room = {
	id: 'indexing-compound',
	name: 'Compound Indexes',
	description: 'Learn about compound indexes for multi-column queries.',
	briefing: `
    Some queries filter by multiple columns. A single-column index won't help!

    For queries like:
    WHERE status = 'active' AND created_at > ?

    You need a compound index: add_index :users, [:status, :created_at]
  `,
	objective: {
		type: 'optimize',
		description: 'Achieve 85+ stability',
		targetMetrics: {
			maxLatencyP95: 50,
			minStability: 85,
		},
		hints: [
			'Add a compound index on [status, created_at]',
			'The column order matters!',
			'Put the most selective column first',
		],
	},
	initialNodes: [
		{ type: 'request', position: { x: 100, y: 300 }, locked: true },
		{ type: 'router', position: { x: 250, y: 300 }, locked: true },
		{ type: 'controller', position: { x: 400, y: 300 }, locked: false },
		{
			type: 'model',
			position: { x: 550, y: 300 },
			config: {
				name: 'User',
				queries: ['WHERE status = ? AND created_at > ?'],
			},
			locked: false,
		},
		{
			type: 'database',
			position: { x: 700, y: 300 },
			config: { indexes: ['email'], rowCount: 100000 },
			locked: false,
		},
		{ type: 'response', position: { x: 400, y: 450 }, locked: true },
	],
	availableNodeTypes: ['cache'],
	availableDefenses: ['index_turret', 'cache_shield'],
	enemySpawnRate: 1.0,
	stabilityThreshold: 85,
	successMessage: 'You mastered compound indexes!',
};

export const tutorialIndexing: Level = {
	id: 'tutorial-indexing',
	name: 'Database Indexing Tutorial',
	description: 'Learn to speed up queries with proper database indexes.',
	difficulty: 2,
	requiredLevel: 3,
	concepts: [
		'Database indexes',
		'Query optimization',
		'EXPLAIN ANALYZE',
		'Compound indexes',
	],
	rooms: [room1, room2, room3],
	starThresholds: {
		one: 70,
		two: 85,
		three: 95,
	},
	rewards: {
		xp: 150,
		unlockDefenses: ['index_turret'],
		achievement: 'index_master',
	},
	prerequisites: ['tutorial-n-plus-one'],
};
